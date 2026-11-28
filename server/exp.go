package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"
)

type Monster struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Level          int    `json:"level"`
	MaxHP          int    `json:"max_hp"`
	Defense        int    `json:"defense"`
	EXPReward      int    `json:"exp_reward"`
	RespawnSeconds int    `json:"respawn_seconds"`
}

var monsterCatalog = []Monster{
	{1, "Sói Xám", 1, 50, 2, 20, 5},
	{2, "Dã Trư", 1, 80, 3, 25, 5},
	{3, "Sơn Tặc", 2, 120, 5, 40, 8},
	{4, "Đạo Tặc", 3, 180, 7, 60, 8},
	{5, "Hắc Y Nhân", 4, 250, 10, 85, 10},
	{6, "Lang Vương", 5, 350, 13, 120, 12},
	{7, "Thạch Quái", 6, 500, 17, 160, 12},
	{8, "Hỏa Hồ", 7, 650, 20, 210, 15},
	{9, "Bạch Hổ", 8, 850, 25, 270, 15},
	{10, "Địa Ngục Ma", 10, 1200, 35, 400, 20},
}

func ensureCharacterEXPColumn(db *sql.DB) error {
	rows, err := db.Query("PRAGMA table_info(characters)")
	if err != nil {
		return err
	}
	defer rows.Close()

	found := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, dataType string
		var defaultValue interface{}

		if err := rows.Scan(
			&cid, &name, &dataType, &notnull, &defaultValue, &pk,
		); err != nil {
			return err
		}
		if name == "exp" {
			found = true
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	if !found {
		_, err = db.Exec(`
			ALTER TABLE characters
			ADD COLUMN exp INTEGER NOT NULL DEFAULT 0
		`)
	}
	return err
}

func ensureCurrentHPColumn(db *sql.DB) error {
	rows, err := db.Query("PRAGMA table_info(character_stats)")
	if err != nil {
		return err
	}

	found := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, dataType string
		var defaultValue interface{}

		if err := rows.Scan(
			&cid, &name, &dataType, &notnull, &defaultValue, &pk,
		); err != nil {
			rows.Close()
			return err
		}

		if name == "current_hp" {
			found = true
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	if !found {
		_, err = db.Exec(`
			ALTER TABLE character_stats
			ADD COLUMN current_hp INTEGER NOT NULL DEFAULT 100
		`)
		if err != nil {
			return err
		}

		_, err = db.Exec(`
			UPDATE character_stats SET current_hp = hp
		`)
	}
	return err
}

func initExpDB(db *sql.DB) error {
	if err := ensureCurrentHPColumn(db); err != nil {
		return err
	}

	if err := ensureCharacterEXPColumn(db); err != nil {
		return err
	}

	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS monsters (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			level INTEGER NOT NULL,
			max_hp INTEGER NOT NULL,
			defense INTEGER NOT NULL,
			exp_reward INTEGER NOT NULL,
			respawn_seconds INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS character_monsters (
			character_id INTEGER NOT NULL,
			monster_id INTEGER NOT NULL,
			hp INTEGER NOT NULL,
			defeated_until INTEGER NOT NULL DEFAULT 0,
			last_attack_at INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY(character_id, monster_id)
		);
	`)
	if err != nil {
		return err
	}

	for _, m := range monsterCatalog {
		_, err = db.Exec(`
			INSERT OR IGNORE INTO monsters
			(id, name, level, max_hp, defense, exp_reward, respawn_seconds)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			m.ID, m.Name, m.Level, m.MaxHP, m.Defense,
			m.EXPReward, m.RespawnSeconds,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func listMonstersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Chỉ hỗ trợ GET", 405)
			return
		}

		userID, err := authenticate(r)
		if err != nil {
			http.Error(w, err.Error(), 401)
			return
		}

		characterID, err := strconv.Atoi(r.URL.Query().Get("character_id"))
		if err != nil || characterID < 1 {
			http.Error(w, "character_id không hợp lệ", 400)
			return
		}

		var level int
		err = db.QueryRow(`
			SELECT level FROM characters
			WHERE id = ? AND user_id = ?`,
			characterID, userID,
		).Scan(&level)
		if err != nil {
			http.Error(w, "Không tìm thấy nhân vật hoặc không có quyền", 403)
			return
		}

		rows, err := db.Query(`
			SELECT id, name, level, max_hp, defense,
			       exp_reward, respawn_seconds
			FROM monsters ORDER BY level, id
		`)
		if err != nil {
			http.Error(w, "Lỗi truy vấn quái vật", 500)
			return
		}
		defer rows.Close()

		type monsterResult struct {
			Monster
			CanFight bool `json:"can_fight"`
		}

		result := []monsterResult{}
		for rows.Next() {
			var m monsterResult
			if err := rows.Scan(
				&m.ID, &m.Name, &m.Level, &m.MaxHP,
				&m.Defense, &m.EXPReward, &m.RespawnSeconds,
			); err != nil {
				http.Error(w, "Lỗi đọc quái vật", 500)
				return
			}
			m.CanFight = level >= m.Level
			result = append(result, m)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "Lỗi đọc danh sách", 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

type attackMonsterRequest struct {
	CharacterID int `json:"character_id"`
	MonsterID   int `json:"monster_id"`
}

func attackMonsterHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Chỉ hỗ trợ POST", 405)
			return
		}

		userID, err := authenticate(r)
		if err != nil {
			http.Error(w, err.Error(), 401)
			return
		}

		var req attackMonsterRequest
		if json.NewDecoder(r.Body).Decode(&req) != nil ||
			req.CharacterID < 1 || req.MonsterID < 1 {
			http.Error(w, "Dữ liệu không hợp lệ", 400)
			return
		}

		result, err := performMonsterAttack(
			db, userID, req.CharacterID, req.MonsterID,
		)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

func performMonsterAttack(
	db *sql.DB,
	userID int64,
	characterID, monsterID int,
) (map[string]interface{}, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var level, attack, defense, maxHP, currentHP, currentEXP int

	err = tx.QueryRow(`
		SELECT c.level, c.exp, s.attack, s.defense,
		       s.hp, s.current_hp
		FROM characters c
		JOIN character_stats s ON s.character_id = c.id
		WHERE c.id = ? AND c.user_id = ?`,
		characterID, userID,
	).Scan(
		&level, &currentEXP, &attack, &defense,
		&maxHP, &currentHP,
	)
	if err != nil {
		return nil, errors.New("không tìm thấy nhân vật hoặc không có quyền")
	}

	if currentHP <= 0 {
		return nil, errors.New("nhân vật đã tử trận, cần hồi sinh")
	}

	var m Monster
	err = tx.QueryRow(`
		SELECT id, name, level, max_hp, defense,
		       exp_reward, respawn_seconds
		FROM monsters WHERE id = ?`,
		monsterID,
	).Scan(
		&m.ID, &m.Name, &m.Level, &m.MaxHP,
		&m.Defense, &m.EXPReward, &m.RespawnSeconds,
	)
	if err != nil {
		return nil, errors.New("không tìm thấy quái vật")
	}

	if level < m.Level {
		return nil, errors.New("cấp nhân vật chưa đủ điều kiện")
	}

	_, err = tx.Exec(`
		INSERT OR IGNORE INTO character_monsters
		(character_id, monster_id, hp)
		VALUES (?, ?, ?)`,
		characterID, monsterID, m.MaxHP,
	)
	if err != nil {
		return nil, err
	}

	var monsterHP int
	var defeatedUntil, lastAttackAt int64

	err = tx.QueryRow(`
		SELECT hp, defeated_until, last_attack_at
		FROM character_monsters
		WHERE character_id = ? AND monster_id = ?`,
		characterID, monsterID,
	).Scan(&monsterHP, &defeatedUntil, &lastAttackAt)
	if err != nil {
		return nil, err
	}

	now := time.Now().Unix()

	if defeatedUntil > now {
		return nil, errors.New("quái vật đang hồi sinh")
	}
	if lastAttackAt == now {
		return nil, errors.New("hãy chờ một giây giữa các đòn đánh")
	}

	if monsterHP <= 0 {
		monsterHP = m.MaxHP
	}

	// Nhân vật tấn công.
	damage := attack - m.Defense
	if damage < 1 {
		damage = 1
	}

	monsterHP -= damage
	if monsterHP < 0 {
		monsterHP = 0
	}

	_, err = tx.Exec(`
		UPDATE character_monsters
		SET hp = ?, last_attack_at = ?
		WHERE character_id = ? AND monster_id = ?`,
		monsterHP, now, characterID, monsterID,
	)
	if err != nil {
		return nil, err
	}

	expGained := 0
	levelsGained := 0
	monsterDamage := 0

	if monsterHP == 0 {
		// Quái vật chết: cộng EXP.
		expGained = m.EXPReward
		currentEXP += expGained

		for {
			required := level * 100
			if currentEXP < required {
				break
			}
			currentEXP -= required
			level++
			levelsGained++
		}

		_, err = tx.Exec(`
			UPDATE characters
			SET exp = ?, level = ?
			WHERE id = ? AND user_id = ?`,
			currentEXP, level, characterID, userID,
		)
		if err != nil {
			return nil, err
		}

		_, err = tx.Exec(`
			UPDATE character_monsters
			SET defeated_until = ?
			WHERE character_id = ? AND monster_id = ?`,
			now+int64(m.RespawnSeconds),
			characterID, monsterID,
		)
		if err != nil {
			return nil, err
		}
	} else {
		// Quái vật phản công.
		monsterDamage = m.Level*3 + 2 - defense
		if monsterDamage < 1 {
			monsterDamage = 1
		}

		currentHP -= monsterDamage
		if currentHP < 0 {
			currentHP = 0
		}

		_, err = tx.Exec(`
			UPDATE character_stats
			SET current_hp = ?
			WHERE character_id = ?`,
			currentHP, characterID,
		)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success":          true,
		"monster":          m.Name,
		"damage":           damage,
		"monster_damage":   monsterDamage,
		"monster_hp":       monsterHP,
		"monster_max_hp":   m.MaxHP,
		"defeated":         monsterHP == 0,
		"exp_gained":       expGained,
		"current_exp":      currentEXP,
		"required_exp":     level * 100,
		"level":            level,
		"levels_gained":    levelsGained,
		"character_hp":     currentHP,
		"character_max_hp": maxHP,
		"character_dead":   currentHP <= 0,
		"respawn_seconds":  m.RespawnSeconds,
	}, nil
}

func reviveCharacterHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Chỉ hỗ trợ POST", 405)
			return
		}

		userID, err := authenticate(r)
		if err != nil {
			http.Error(w, err.Error(), 401)
			return
		}

		var req struct {
			CharacterID int `json:"character_id"`
		}

		if json.NewDecoder(r.Body).Decode(&req) != nil ||
			req.CharacterID < 1 {
			http.Error(w, "Dữ liệu không hợp lệ", 400)
			return
		}

		result, err := db.Exec(`
			UPDATE character_stats
			SET current_hp = hp
			WHERE character_id = ?
			AND current_hp <= 0
			AND character_id IN (
				SELECT id FROM characters WHERE user_id = ?
			)`,
			req.CharacterID, userID,
		)
		if err != nil {
			http.Error(w, "Lỗi hồi sinh", 500)
			return
		}

		affected, err := result.RowsAffected()
		if err != nil {
			http.Error(w, "Lỗi dữ liệu", 500)
			return
		}

		if affected != 1 {
			http.Error(w, "Nhân vật không thuộc tài khoản hoặc chưa tử trận", 400)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Nhân vật đã hồi sinh",
		})
	}
}
