package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type gridCell struct{ X, Y int }

type worldSpawn struct {
	SpawnID   string
	MonsterID int
	X, Y      int
	Count     int
}

type worldMapConfig struct {
	Width, Height int
	SpawnX, SpawnY int
	Blocked map[gridCell]bool
	Spawns []worldSpawn
}

var worldMaps = map[string]worldMapConfig{
	"map_001_village_test": {
		Width: 20, Height: 20, SpawnX: 9, SpawnY: 12,
		Blocked: map[gridCell]bool{
			{6, 6}: true, {6, 7}: true, {7, 6}: true, {7, 7}: true,
			{3, 13}: true, {4, 13}: true, {15, 5}: true, {16, 5}: true,
		},
		Spawns: []worldSpawn{{"spawn_slime_001", 1, 15, 14, 3}},
	},
	"map_002_field_test": {
		Width: 20, Height: 20, SpawnX: 2, SpawnY: 10,
		Blocked: map[gridCell]bool{
			{5, 5}: true, {5, 6}: true, {6, 5}: true, {6, 6}: true,
			{14, 14}: true, {15, 14}: true,
		},
		Spawns: []worldSpawn{{"field_monsters_001", 1, 12, 12, 5}},
	},
}

func ensureWorldColumn(db *sql.DB, table, column, definition string) error {
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil { return err }
	found := false
	for rows.Next() {
		var cid, notnull, pk int
		var name, typ string
		var def any
		if err := rows.Scan(&cid, &name, &typ, &notnull, &def, &pk); err != nil {
			rows.Close()
			return err
		}
		if name == column { found = true }
	}
	if err := rows.Err(); err != nil { rows.Close(); return err }
	if err := rows.Close(); err != nil { return err }
	if found { return nil }
	_, err = db.Exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition)
	return err
}

func initWorldDB(db *sql.DB) error {
	columns := []struct{ table, name, definition string }{
		{"characters", "map_id", "TEXT NOT NULL DEFAULT 'map_001_village_test'"},
		{"characters", "pos_x", "INTEGER NOT NULL DEFAULT 9"},
		{"characters", "pos_y", "INTEGER NOT NULL DEFAULT 12"},
		{"characters", "last_move_at", "INTEGER NOT NULL DEFAULT 0"},
		{"character_stats", "last_world_attack_at", "INTEGER NOT NULL DEFAULT 0"},
	}
	for _, col := range columns {
		if err := ensureWorldColumn(db, col.table, col.name, col.definition); err != nil { return err }
	}

	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS world_monsters (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			map_id TEXT NOT NULL,
			spawn_id TEXT NOT NULL,
			slot_index INTEGER NOT NULL,
			monster_id INTEGER NOT NULL,
			x INTEGER NOT NULL,
			y INTEGER NOT NULL,
			hp INTEGER NOT NULL,
			respawn_at INTEGER NOT NULL DEFAULT 0,
			version INTEGER NOT NULL DEFAULT 1,
			UNIQUE(map_id, spawn_id, slot_index)
		);
		CREATE INDEX IF NOT EXISTS idx_world_monsters_map ON world_monsters(map_id);
		CREATE TABLE IF NOT EXISTS world_presence (
			character_id INTEGER PRIMARY KEY,
			user_id INTEGER NOT NULL,
			last_seen_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_world_presence_seen ON world_presence(last_seen_at);
	`)
	if err != nil { return err }

	for mapID, cfg := range worldMaps {
		for _, spawn := range cfg.Spawns {
			for slot := 0; slot < spawn.Count; slot++ {
				x := spawn.X + slot
				_, err = db.Exec(`
					INSERT OR IGNORE INTO world_monsters
					(map_id, spawn_id, slot_index, monster_id, x, y, hp)
					SELECT ?, ?, ?, m.id, ?, ?, m.max_hp
					FROM monsters m WHERE m.id = ?
				`, mapID, spawn.SpawnID, slot, x, spawn.Y, spawn.MonsterID)
				if err != nil { return err }
			}
		}
	}
	return nil
}

func worldWalkable(mapID string, x, y int) bool {
	cfg, ok := worldMaps[mapID]
	if !ok || x < 0 || y < 0 || x >= cfg.Width || y >= cfg.Height { return false }
	return !cfg.Blocked[gridCell{x, y}]
}

func validWorldStep(mapID string, x, y, dx, dy int) bool {
	if (dx == 0 && dy == 0) || absInt(dx) > 1 || absInt(dy) > 1 { return false }
	nx, ny := x+dx, y+dy
	if !worldWalkable(mapID, nx, ny) { return false }
	if dx != 0 && dy != 0 {
		if !worldWalkable(mapID, x+dx, y) || !worldWalkable(mapID, x, y+dy) { return false }
	}
	return true
}

func absInt(v int) int { if v < 0 { return -v }; return v }

type worldCharacterView struct {
	ID int64 `json:"id"`
	Name string `json:"name"`
	ClassName string `json:"class_name"`
	Level int `json:"level"`
	X int `json:"x"`
	Y int `json:"y"`
	HP int `json:"hp"`
	MaxHP int `json:"max_hp"`
}

type worldMonsterView struct {
	ID int64 `json:"id"`
	MonsterID int `json:"monster_id"`
	Name string `json:"name"`
	Level int `json:"level"`
	X int `json:"x"`
	Y int `json:"y"`
	HP int `json:"hp"`
	MaxHP int `json:"max_hp"`
	RespawnAt int64 `json:"respawn_at"`
	Version int64 `json:"version"`
}

func worldSnapshotHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet { respond(w, 405, map[string]string{"error":"Method không được hỗ trợ"}); return }
		userID, err := authenticate(r)
		if err != nil { respond(w, 401, map[string]string{"error":err.Error()}); return }
		characterID, err := strconv.ParseInt(r.URL.Query().Get("character_id"), 10, 64)
		if err != nil || characterID <= 0 { respond(w, 400, map[string]string{"error":"character_id không hợp lệ"}); return }

		tx, err := db.Begin()
		if err != nil { respond(w, 500, map[string]string{"error":"Không mở được giao dịch thế giới"}); return }
		defer tx.Rollback()
		var mapID string
		var x, y int
		err = tx.QueryRow("SELECT map_id,pos_x,pos_y FROM characters WHERE id=? AND user_id=?", characterID, userID).Scan(&mapID,&x,&y)
		if err != nil { respond(w, 404, map[string]string{"error":"Không tìm thấy nhân vật"}); return }
		if _, ok := worldMaps[mapID]; !ok { mapID = "map_001_village_test"; cfg:=worldMaps[mapID]; x,y=cfg.SpawnX,cfg.SpawnY; if _,err=tx.Exec("UPDATE characters SET map_id=?,pos_x=?,pos_y=? WHERE id=? AND user_id=?",mapID,x,y,characterID,userID); err!=nil { respond(w,500,map[string]string{"error":"Không đặt được vị trí nhân vật"}); return } }

		now := time.Now().Unix()
		if _, err = tx.Exec("UPDATE world_monsters SET hp=(SELECT max_hp FROM monsters WHERE monsters.id=world_monsters.monster_id), respawn_at=0, version=version+1 WHERE map_id=? AND hp<=0 AND respawn_at<=?", mapID, now); err != nil { respond(w,500,map[string]string{"error":"Không thể hồi sinh quái vật"}); return }
		if _, err = tx.Exec(`INSERT INTO world_presence(character_id,user_id,last_seen_at) VALUES(?,?,?)
			ON CONFLICT(character_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at`, characterID,userID,now); err != nil { respond(w,500,map[string]string{"error":"Không cập nhật được trạng thái online"}); return }

		var self worldCharacterView
		err = tx.QueryRow(`
			SELECT c.id,c.name,cl.name,c.level,c.pos_x,c.pos_y,s.current_hp,s.hp
			FROM characters c JOIN character_stats s ON s.character_id=c.id
			JOIN (SELECT id,name FROM (SELECT id,name FROM characters)) dummy ON dummy.id=c.id
			LEFT JOIN (SELECT id,name FROM (SELECT 1 AS id, 'Thiếu Lâm' AS name)) cl ON 1=0
			WHERE c.id=? AND c.user_id=?`, characterID,userID).Scan(&self.ID,&self.Name,&self.ClassName,&self.Level,&self.X,&self.Y,&self.HP,&self.MaxHP)
		if err != nil {
			// Query below uses the in-memory class catalog and avoids requiring a class table.
			err = tx.QueryRow(`SELECT c.id,c.name,c.class_id,c.level,c.pos_x,c.pos_y,s.current_hp,s.hp
				FROM characters c JOIN character_stats s ON s.character_id=c.id WHERE c.id=? AND c.user_id=?`,characterID,userID).
				Scan(&self.ID,&self.Name,&self.ClassName,&self.Level,&self.X,&self.Y,&self.HP,&self.MaxHP)
			if err != nil { respond(w,500,map[string]string{"error":"Không đọc được trạng thái nhân vật"}); return }
		}

		players := []worldCharacterView{}
		rows, err := tx.Query(`SELECT c.id,c.name,c.class_id,c.level,c.pos_x,c.pos_y,s.current_hp,s.hp
			FROM characters c JOIN character_stats s ON s.character_id=c.id
			JOIN world_presence p ON p.character_id=c.id
			WHERE c.map_id=? AND p.last_seen_at>? ORDER BY c.id`,mapID,now-20)
		if err != nil { respond(w,500,map[string]string{"error":"Không đọc được người chơi trong bản đồ"}); return }
		for rows.Next() {
			var p worldCharacterView
			var classID int
			if err=rows.Scan(&p.ID,&p.Name,&classID,&p.Level,&p.X,&p.Y,&p.HP,&p.MaxHP); err != nil { rows.Close(); respond(w,500,map[string]string{"error":"Dữ liệu người chơi không hợp lệ"}); return }
			p.ClassName = classNameByID(classID)
			players=append(players,p)
		}
		if err=rows.Err(); err != nil { rows.Close(); respond(w,500,map[string]string{"error":"Lỗi đọc người chơi"}); return }
		rows.Close()

		monsters := []worldMonsterView{}
		rows, err = tx.Query(`SELECT wm.id,m.id,m.name,m.level,wm.x,wm.y,wm.hp,m.max_hp,wm.respawn_at,wm.version
			FROM world_monsters wm JOIN monsters m ON m.id=wm.monster_id
			WHERE wm.map_id=? ORDER BY wm.id`,mapID)
		if err != nil { respond(w,500,map[string]string{"error":"Không đọc được quái vật"}); return }
		for rows.Next() {
			var m worldMonsterView
			if err=rows.Scan(&m.ID,&m.MonsterID,&m.Name,&m.Level,&m.X,&m.Y,&m.HP,&m.MaxHP,&m.RespawnAt,&m.Version); err != nil { rows.Close(); respond(w,500,map[string]string{"error":"Dữ liệu quái vật không hợp lệ"}); return }
			monsters=append(monsters,m)
		}
		if err=rows.Err(); err != nil { rows.Close(); respond(w,500,map[string]string{"error":"Lỗi đọc quái vật"}); return }
		rows.Close()
		if err=tx.Commit(); err != nil { respond(w,500,map[string]string{"error":"Không lưu được snapshot"}); return }

		self.ClassName = classNameForCharacter(db, characterID, userID)
		respond(w,200,map[string]any{"map_id":mapID,"server_time":now,"character":self,"players":players,"monsters":monsters})
	}
}

func classNameByID(id int) string { for _, c := range classes { if c.ID==id { return c.Name } }; return "Không rõ môn phái" }
func classNameForCharacter(db *sql.DB, characterID,userID int64) string {
	var id int
	if db.QueryRow("SELECT class_id FROM characters WHERE id=? AND user_id=?",characterID,userID).Scan(&id)!=nil { return "" }
	return classNameByID(id)
}

func worldMoveHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter,r *http.Request) {
		if r.Method!=http.MethodPost { respond(w,405,map[string]string{"error":"Chỉ hỗ trợ POST"}); return }
		userID,err:=authenticate(r); if err!=nil { respond(w,401,map[string]string{"error":err.Error()}); return }
		var req struct { CharacterID int64 `json:"character_id"`; DX int `json:"dx"`; DY int `json:"dy"` }
		if !decode(w,r,&req) || req.CharacterID<=0 || absInt(req.DX)>1 || absInt(req.DY)>1 || (req.DX==0 && req.DY==0) { respond(w,400,map[string]string{"error":"Bước di chuyển không hợp lệ"}); return }
		tx,err:=db.Begin(); if err!=nil { respond(w,500,map[string]string{"error":"Không mở được giao dịch"}); return }; defer tx.Rollback()
		var mapID string; var x,y int; var lastMove int64
		err=tx.QueryRow("SELECT map_id,pos_x,pos_y,last_move_at FROM characters WHERE id=? AND user_id=?",req.CharacterID,userID).Scan(&mapID,&x,&y,&lastMove)
		if err!=nil { respond(w,404,map[string]string{"error":"Không tìm thấy nhân vật"}); return }
		if !validWorldStep(mapID,x,y,req.DX,req.DY) { respond(w,400,map[string]string{"error":"Ô di chuyển bị chặn hoặc bước đi không hợp lệ"}); return }
		now:=time.Now().UnixMilli()
		if now-lastMove<140 { respond(w,429,map[string]string{"error":"Di chuyển quá nhanh, vui lòng chờ"}); return }
		nx,ny:=x+req.DX,y+req.DY
		var occupied int
		err=tx.QueryRow(`SELECT COUNT(*) FROM characters c JOIN world_presence p ON p.character_id=c.id
			WHERE c.map_id=? AND c.pos_x=? AND c.pos_y=? AND c.id<>? AND p.last_seen_at>?`,mapID,nx,ny,req.CharacterID,time.Now().Unix()-20).Scan(&occupied)
		if err!=nil { respond(w,500,map[string]string{"error":"Không kiểm tra được vị trí người chơi"}); return }
		if occupied>0 { respond(w,409,map[string]string{"error":"Vị trí đang có người chơi khác"}); return }
		result,err:=tx.Exec("UPDATE characters SET pos_x=?,pos_y=?,last_move_at=? WHERE id=? AND user_id=? AND last_move_at=?",nx,ny,now,req.CharacterID,userID,lastMove)
		if err!=nil { respond(w,500,map[string]string{"error":"Không lưu được vị trí"}); return }
		affected,_:=result.RowsAffected(); if affected!=1 { respond(w,409,map[string]string{"error":"Vị trí vừa thay đổi, hãy đồng bộ lại"}); return }
		_,err=tx.Exec(`INSERT INTO world_presence(character_id,user_id,last_seen_at) VALUES(?,?,?)
			ON CONFLICT(character_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at`,req.CharacterID,userID,time.Now().Unix())
		if err!=nil { respond(w,500,map[string]string{"error":"Không cập nhật presence"}); return }
		if err=tx.Commit(); err!=nil { respond(w,500,map[string]string{"error":"Không hoàn tất di chuyển"}); return }
		respond(w,200,map[string]any{"moved":true,"map_id":mapID,"x":nx,"y":ny})
	}
}

func worldAttackHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter,r *http.Request) {
		if r.Method!=http.MethodPost { respond(w,405,map[string]string{"error":"Chỉ hỗ trợ POST"}); return }
		userID,err:=authenticate(r); if err!=nil { respond(w,401,map[string]string{"error":err.Error()}); return }
		var req struct { CharacterID int64 `json:"character_id"`; MonsterID int64 `json:"monster_id"` }
		if !decode(w,r,&req) || req.CharacterID<=0 || req.MonsterID<=0 { respond(w,400,map[string]string{"error":"Dữ liệu tấn công không hợp lệ"}); return }
		result,err:=performWorldAttack(db,userID,req.CharacterID,req.MonsterID)
		if err!=nil { respond(w,409,map[string]string{"error":err.Error()}); return }
		respond(w,200,result)
	}
}

func performWorldAttack(db *sql.DB,userID,characterID,worldMonsterID int64)(map[string]any,error) {
	tx,err:=db.Begin(); if err!=nil{return nil,err}; defer tx.Rollback()
	var level,exp,attack,defense,currentHP,maxHP,x,y int; var mapID string; var lastAttack int64
	err=tx.QueryRow(`SELECT c.level,c.exp,c.map_id,c.pos_x,c.pos_y,s.attack,s.defense,s.current_hp,s.hp,s.last_world_attack_at
		FROM characters c JOIN character_stats s ON s.character_id=c.id WHERE c.id=? AND c.user_id=?`,characterID,userID).
		Scan(&level,&exp,&mapID,&x,&y,&attack,&defense,&currentHP,&maxHP,&lastAttack)
	if err!=nil{return nil,errors.New("Không tìm thấy nhân vật hoặc không có quyền")}
	if currentHP<=0{return nil,errors.New("Nhân vật đã tử trận, cần hồi sinh")}
	nowMS:=time.Now().UnixMilli(); if nowMS-lastAttack<450{return nil,errors.New("Hãy chờ hồi chiêu trước khi đánh tiếp")}
	var monster worldMonsterView
	err=tx.QueryRow(`SELECT wm.id,m.id,m.name,m.level,wm.x,wm.y,wm.hp,m.max_hp,wm.respawn_at,wm.version
		FROM world_monsters wm JOIN monsters m ON m.id=wm.monster_id
		WHERE wm.id=? AND wm.map_id=?`,worldMonsterID,mapID).
		Scan(&monster.ID,&monster.MonsterID,&monster.Name,&monster.Level,&monster.X,&monster.Y,&monster.HP,&monster.MaxHP,&monster.RespawnAt,&monster.Version)
	if err!=nil{return nil,errors.New("Không tìm thấy quái vật trong bản đồ hiện tại")}
	if monster.HP<=0 {
		if monster.RespawnAt>time.Now().Unix(){return nil,errors.New("Quái vật đang hồi sinh")}
		monster.HP=monster.MaxHP
	}
	if maxInt(absInt(x-monster.X),absInt(y-monster.Y))>1{return nil,errors.New("Quái vật ở quá xa")}
	damage:=attack
	if damage<1{damage=1}
	damage-=monsterDefense(monster.MonsterID)
	if damage<1{damage=1}
	monster.HP-=damage; if monster.HP<0{monster.HP=0}
	monster.Version++
	monsterDamage:=0
	if monster.HP==0 {
		exp+=monsterReward(monster.MonsterID)
		for { required:=level*100; if exp<required {break}; exp-=required; level++ }
		if _,err=tx.Exec("UPDATE characters SET exp=?,level=? WHERE id=? AND user_id=?",exp,level,characterID,userID);err!=nil{return nil,err}
		_,err=tx.Exec("UPDATE world_monsters SET hp=0,respawn_at=?,version=? WHERE id=? AND hp>0",time.Now().Unix()+int64(monsterRespawn(monster.MonsterID)),monster.Version,worldMonsterID)
	} else {
		monsterDamage=monster.Level*3+2-defense; if monsterDamage<1{monsterDamage=1}
		currentHP-=monsterDamage; if currentHP<0{currentHP=0}
		_,err=tx.Exec("UPDATE world_monsters SET hp=?,version=? WHERE id=? AND hp>0",monster.HP,monster.Version,worldMonsterID)
		if err==nil { _,err=tx.Exec("UPDATE character_stats SET current_hp=?,last_world_attack_at=? WHERE character_id=?",currentHP,nowMS,characterID) }
	}
	if err!=nil{return nil,err}
	if monster.HP==0 { if _,err=tx.Exec("UPDATE character_stats SET last_world_attack_at=? WHERE character_id=?",nowMS,characterID);err!=nil{return nil,err} }
	if err=tx.Commit();err!=nil{return nil,err}
	return map[string]any{
		"success":true,"monster_id":worldMonsterID,"monster_name":monster.Name,
		"damage":damage,"monster_hp":monster.HP,"monster_max_hp":monster.MaxHP,
		"monster_version":monster.Version,"defeated":monster.HP==0,
		"monster_damage":monsterDamage,"character_hp":currentHP,"character_max_hp":maxHP,
		"character_dead":currentHP<=0,"exp_gained":func()int{if monster.HP==0{return monsterReward(monster.MonsterID)};return 0}(),
		"current_exp":exp,"level":level,
	},nil
}

func monsterDefense(monsterID int) int { for _,m:=range monsterCatalog{if m.ID==monsterID{return m.Defense}};return 0 }
func monsterReward(monsterID int) int { for _,m:=range monsterCatalog{if m.ID==monsterID{return m.EXPReward}};return 0 }
func monsterRespawn(monsterID int) int { for _,m:=range monsterCatalog{if m.ID==monsterID{return m.RespawnSeconds}};return 10 }
func maxInt(a,b int)int{if a>b{return a};return b}

var _ = fmt.Sprintf
var _ = json.Valid
