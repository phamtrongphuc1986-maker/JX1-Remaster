package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

type Skill struct {
	ID            int    `json:"id"`
	ClassID       int    `json:"class_id"`
	Name          string `json:"name"`
	Type          string `json:"type"`
	Description   string `json:"description"`
	MaxLevel      int    `json:"max_level"`
	RequiredLevel int    `json:"required_level"`
}

var skillCatalog = []Skill{
	{1, 1, "La Hán Quyền", "active", "Đòn đánh cận chiến Thiếu Lâm", 10, 1},
	{2, 1, "Kim Cang Hộ Thể", "active", "Tăng khả năng phòng thủ", 10, 5},
	{3, 1, "Thiền Tâm", "passive", "Tăng sinh lực cơ bản", 10, 10},

	{4, 2, "Thiên Vương Thương", "active", "Đâm thương gây sát thương", 10, 1},
	{5, 2, "Thiết Giáp", "active", "Tăng sức chống chịu", 10, 5},
	{6, 2, "Thương Pháp", "passive", "Tăng sức mạnh tấn công", 10, 10},

	{7, 3, "Phi Đao", "active", "Phóng ám khí tấn công", 10, 1},
	{8, 3, "Ảnh Tung", "active", "Tăng khả năng né tránh", 10, 5},
	{9, 3, "Cơ Quan Thuật", "passive", "Tăng độ chính xác", 10, 10},

	{10, 4, "Độc Châm", "active", "Ám khí mang độc", 10, 1},
	{11, 4, "Độc Vụ", "active", "Tạo vùng độc hỗ trợ chiến đấu", 10, 5},
	{12, 4, "Độc Công", "passive", "Tăng hiệu quả độc", 10, 10},

	{13, 5, "Ngọc Nữ Kiếm", "active", "Kiếm pháp Nga Mi", 10, 1},
	{14, 5, "Từ Tâm Quyết", "active", "Hỗ trợ phòng thủ", 10, 5},
	{15, 5, "Phật Tâm", "passive", "Tăng nội lực", 10, 10},

	{16, 6, "Băng Tâm Kiếm", "active", "Kiếm pháp hệ băng", 10, 1},
	{17, 6, "Hàn Băng Hộ Thể", "active", "Tăng phòng thủ hệ băng", 10, 5},
	{18, 6, "Băng Cốt", "passive", "Tăng sức chống chịu", 10, 10},

	{19, 7, "Giáng Long Chưởng", "active", "Chưởng pháp tấn công", 10, 1},
	{20, 7, "Túy Tiên Bộ", "active", "Tăng khả năng di chuyển", 10, 5},
	{21, 7, "Long Hổ Khí", "passive", "Tăng sức mạnh", 10, 10},

	{22, 8, "Hỏa Vũ", "active", "Tấn công bằng hỏa lực", 10, 1},
	{23, 8, "Hỏa Linh Hộ Thân", "active", "Tăng phòng thủ", 10, 5},
	{24, 8, "Thiên Hỏa", "passive", "Tăng sát thương hỏa", 10, 10},

	{25, 9, "Thái Cực Kiếm", "active", "Kiếm pháp Võ Đang", 10, 1},
	{26, 9, "Thái Cực Hộ Thể", "active", "Tạo hiệu ứng phòng thủ", 10, 5},
	{27, 9, "Vô Vi Tâm Pháp", "passive", "Tăng nội lực", 10, 10},

	{28, 10, "Lôi Đình Kiếm", "active", "Kiếm pháp hệ lôi", 10, 1},
	{29, 10, "Phong Lôi Hộ Thể", "active", "Tăng khả năng phòng thủ", 10, 5},
	{30, 10, "Lôi Công", "passive", "Tăng sát thương hệ lôi", 10, 10},
}

func initSkillDB(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS skills (
		id INTEGER PRIMARY KEY,
		class_id INTEGER NOT NULL,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		description TEXT NOT NULL,
		max_level INTEGER NOT NULL DEFAULT 10,
		required_level INTEGER NOT NULL DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS character_skills (
		character_id INTEGER NOT NULL,
		skill_id INTEGER NOT NULL,
		level INTEGER NOT NULL DEFAULT 1,
		PRIMARY KEY(character_id, skill_id)
	);
	`)
	if err != nil {
		return err
	}

	for _, s := range skillCatalog {
		_, err = db.Exec(`
		INSERT OR IGNORE INTO skills
		(id, class_id, name, type, description, max_level, required_level)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
			s.ID, s.ClassID, s.Name, s.Type,
			s.Description, s.MaxLevel, s.RequiredLevel)
		if err != nil {
			return err
		}
	}
	return nil
}

func listSkillsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Chỉ hỗ trợ GET", http.StatusMethodNotAllowed)
			return
		}
		classID, err := strconv.Atoi(r.URL.Query().Get("class_id"))
		if err != nil || classID < 1 || classID > 10 {
			http.Error(w, "class_id không hợp lệ", http.StatusBadRequest)
			return
		}

		rows, err := db.Query(`
		SELECT id, class_id, name, type, description, max_level, required_level
		FROM skills WHERE class_id = ? ORDER BY id`, classID)
		if err != nil {
			http.Error(w, "Lỗi truy vấn kỹ năng", 500)
			return
		}
		defer rows.Close()

		result := []Skill{}
		for rows.Next() {
			var s Skill
			if err := rows.Scan(
				&s.ID, &s.ClassID, &s.Name, &s.Type,
				&s.Description, &s.MaxLevel, &s.RequiredLevel,
			); err != nil {
				http.Error(w, "Lỗi đọc kỹ năng", 500)
				return
			}
			result = append(result, s)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

func characterSkillsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Chỉ hỗ trợ GET", 405)
			return
		}

		userID, err := authenticate(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}

		id, err := strconv.Atoi(r.URL.Query().Get("character_id"))
		if err != nil || id < 1 {
			http.Error(w, "character_id không hợp lệ", 400)
			return
		}

		var exists int
		err = db.QueryRow(
			"SELECT 1 FROM characters WHERE id=? AND user_id=?",
			id, userID,
		).Scan(&exists)

		if err != nil {
			http.Error(w, "Không tìm thấy nhân vật hoặc không có quyền truy cập", 403)
			return
		}

		rows, err := db.Query(`
			SELECT s.id, s.name, s.type, cs.level, s.max_level
			FROM character_skills cs
			JOIN skills s ON s.id = cs.skill_id
			WHERE cs.character_id = ?
			ORDER BY s.id`, id)
		if err != nil {
			http.Error(w, "Lỗi truy vấn", 500)
			return
		}
		defer rows.Close()

		type learnedSkill struct {
			ID       int    `json:"skill_id"`
			Name     string `json:"name"`
			Type     string `json:"type"`
			Level    int    `json:"level"`
			MaxLevel int    `json:"max_level"`
		}

		result := []learnedSkill{}
		for rows.Next() {
			var s learnedSkill
			if err := rows.Scan(
				&s.ID, &s.Name, &s.Type, &s.Level, &s.MaxLevel,
			); err != nil {
				http.Error(w, "Lỗi đọc dữ liệu", 500)
				return
			}
			result = append(result, s)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, "Lỗi đọc dữ liệu", 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

type skillRequest struct {
	CharacterID int `json:"character_id"`
	SkillID     int `json:"skill_id"`
}

func learnSkillHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Chỉ hỗ trợ POST", 405)
			return
		}

		userID, err := authenticate(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}

		var req skillRequest
		if !decode(w, r, &req) ||
			req.CharacterID < 1 || req.SkillID < 1 {
			http.Error(w, "Dữ liệu không hợp lệ", 400)
			return
		}

		err = changeSkillLevel(db, userID, req.CharacterID, req.SkillID, false)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Học kỹ năng thành công",
		})
	}
}

func upgradeSkillHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Chỉ hỗ trợ POST", 405)
			return
		}

		userID, err := authenticate(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}

		var req skillRequest
		if !decode(w, r, &req) ||
			req.CharacterID < 1 || req.SkillID < 1 {
			http.Error(w, "Dữ liệu không hợp lệ", 400)
			return
		}

		err = changeSkillLevel(db, userID, req.CharacterID, req.SkillID, true)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Nâng cấp kỹ năng thành công",
		})
	}
}

func changeSkillLevel(
	db *sql.DB,
	userID int64,
	characterID, skillID int,
	upgrade bool,
) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Kiểm tra nhân vật thuộc tài khoản đăng nhập.
	var classID, characterLevel int
	err = tx.QueryRow(`
		SELECT class_id, level
		FROM characters
		WHERE id = ? AND user_id = ?`,
		characterID, userID,
	).Scan(&classID, &characterLevel)

	if err != nil {
		return errors.New("không tìm thấy nhân vật hoặc không có quyền")
	}

	// Kiểm tra kỹ năng.
	var skillClass, requiredLevel, maxLevel int
	err = tx.QueryRow(`
		SELECT class_id, required_level, max_level
		FROM skills WHERE id = ?`,
		skillID,
	).Scan(&skillClass, &requiredLevel, &maxLevel)

	if err != nil {
		return errors.New("không tìm thấy kỹ năng")
	}

	if skillClass != classID {
		return errors.New("kỹ năng không thuộc môn phái của nhân vật")
	}

	if characterLevel < requiredLevel {
		return errors.New("cấp nhân vật chưa đủ điều kiện")
	}

	// Kiểm tra cấp kỹ năng hiện tại.
	var currentLevel int
	err = tx.QueryRow(`
		SELECT level FROM character_skills
		WHERE character_id = ? AND skill_id = ?`,
		characterID, skillID,
	).Scan(&currentLevel)

	if err == sql.ErrNoRows {
		if upgrade {
			return errors.New("nhân vật chưa học kỹ năng này")
		}
		currentLevel = 0
	} else if err != nil {
		return err
	} else if !upgrade {
		return errors.New("kỹ năng đã được học")
	}

	if currentLevel >= maxLevel {
		return errors.New("kỹ năng đã đạt cấp tối đa")
	}

	// Trừ điểm kỹ năng có điều kiện.
	result, err := tx.Exec(`
		UPDATE character_stats
		SET skill_points = skill_points - 1
		WHERE character_id = ? AND skill_points >= 1`,
		characterID,
	)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected != 1 {
		return errors.New("không đủ điểm kỹ năng")
	}

	// Học mới hoặc nâng cấp.
	if currentLevel == 0 {
		_, err = tx.Exec(`
			INSERT INTO character_skills
			(character_id, skill_id, level)
			VALUES (?, ?, 1)`,
			characterID, skillID,
		)
	} else {
		result, err = tx.Exec(`
			UPDATE character_skills
			SET level = level + 1
			WHERE character_id = ?
			AND skill_id = ?
			AND level < ?`,
			characterID, skillID, maxLevel,
		)
		if err == nil {
			var affected int64
			affected, err = result.RowsAffected()
			if err == nil && affected != 1 {
				err = errors.New("không thể nâng cấp kỹ năng")
			}
		}
	}

	if err != nil {
		return err
	}

	return tx.Commit()
}

func validSkillName(name string) bool {
	return strings.TrimSpace(name) != ""
}
