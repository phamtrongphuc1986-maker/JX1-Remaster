package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestWorldWalkableAndMovementRules(t *testing.T) {
	if !worldWalkable("map_001_village_test", 9, 12) {
		t.Fatal("expected village spawn tile to be walkable")
	}
	if worldWalkable("map_001_village_test", 6, 6) {
		t.Fatal("expected blocked village tile to reject movement")
	}
	if worldWalkable("map_001_village_test", -1, 0) {
		t.Fatal("expected out-of-bounds tile to reject movement")
	}
	if !validWorldStep("map_001_village_test", 9, 12, 1, 0) {
		t.Fatal("expected one-tile movement to be valid")
	}
	if validWorldStep("map_001_village_test", 9, 12, 2, 0) {
		t.Fatal("expected movement larger than one tile to be rejected")
	}
	if validWorldStep("map_001_village_test", 6, 5, 0, 1) {
		t.Fatal("expected movement into a blocked tile to be rejected")
	}
	if validWorldStep("map_001_village_test", 5, 5, 1, 1) {
		t.Fatal("expected diagonal corner cutting to be rejected")
	}
}

func TestInitWorldDBCreatesSharedMonsterSpawns(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil { t.Fatal(err) }
	defer db.Close()
	db.SetMaxOpenConns(1)

	_, err = db.Exec(`
		CREATE TABLE characters (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL);
		CREATE TABLE character_stats (character_id INTEGER PRIMARY KEY);
		CREATE TABLE monsters (id INTEGER PRIMARY KEY, max_hp INTEGER NOT NULL);
		INSERT INTO monsters(id,max_hp) VALUES(1,50);
	`)
	if err != nil { t.Fatal(err) }
	if err := initWorldDB(db); err != nil { t.Fatalf("initWorldDB: %v",err) }

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM world_monsters").Scan(&count); err != nil { t.Fatal(err) }
	if count != 8 { t.Fatalf("expected 8 shared monster spawn instances, got %d",count) }

	var hp int
	if err := db.QueryRow("SELECT hp FROM world_monsters ORDER BY id LIMIT 1").Scan(&hp); err != nil { t.Fatal(err) }
	if hp != 50 { t.Fatalf("expected monster hp 50, got %d",hp) }

	if err := initWorldDB(db); err != nil { t.Fatalf("second initWorldDB should be idempotent: %v",err) }
	if err := db.QueryRow("SELECT COUNT(*) FROM world_monsters").Scan(&count); err != nil { t.Fatal(err) }
	if count != 8 { t.Fatalf("expected idempotent spawn initialization, got %d rows",count) }
}

func TestWorldCombatUsesOneSharedMonsterHealthPool(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil { t.Fatal(err) }
	defer db.Close()
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE characters (
			id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, level INTEGER NOT NULL,
			exp INTEGER NOT NULL, map_id TEXT NOT NULL, pos_x INTEGER NOT NULL, pos_y INTEGER NOT NULL
		);
		CREATE TABLE character_stats (
			character_id INTEGER PRIMARY KEY, attack INTEGER NOT NULL, defense INTEGER NOT NULL,
			current_hp INTEGER NOT NULL, hp INTEGER NOT NULL, last_world_attack_at INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE monsters (
			id INTEGER PRIMARY KEY, name TEXT NOT NULL, level INTEGER NOT NULL,
			max_hp INTEGER NOT NULL, defense INTEGER NOT NULL, exp_reward INTEGER NOT NULL,
			respawn_seconds INTEGER NOT NULL
		);
		CREATE TABLE world_monsters (
			id INTEGER PRIMARY KEY, map_id TEXT NOT NULL, monster_id INTEGER NOT NULL,
			x INTEGER NOT NULL, y INTEGER NOT NULL, hp INTEGER NOT NULL,
			respawn_at INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1
		);
		INSERT INTO characters(id,user_id,level,exp,map_id,pos_x,pos_y) VALUES
			(1,10,1,0,'map_001_village_test',15,14),
			(2,20,1,0,'map_001_village_test',15,14);
		INSERT INTO character_stats(character_id,attack,defense,current_hp,hp) VALUES
			(1,15,5,100,100),(2,15,5,100,100);
		INSERT INTO monsters(id,name,level,max_hp,defense,exp_reward,respawn_seconds)
			VALUES(1,'Sói Xám',1,50,2,20,5);
		INSERT INTO world_monsters(id,map_id,monster_id,x,y,hp,respawn_at,version)
			VALUES(100,'map_001_village_test',1,15,14,50,0,1);
	`)
	if err != nil { t.Fatal(err) }

	first, err := performWorldAttack(db,10,1,100)
	if err != nil { t.Fatalf("first player attack: %v",err) }
	if first["monster_hp"] != 37 { t.Fatalf("expected shared monster hp 37 after first hit, got %v",first["monster_hp"]) }

	second, err := performWorldAttack(db,20,2,100)
	if err != nil { t.Fatalf("second player attack: %v",err) }
	if second["monster_hp"] != 24 { t.Fatalf("expected second player to see shared hp 24, got %v",second["monster_hp"]) }

	var hp int
	if err := db.QueryRow("SELECT hp FROM world_monsters WHERE id=100").Scan(&hp); err != nil { t.Fatal(err) }
	if hp != 24 { t.Fatalf("expected persisted shared monster hp 24, got %d",hp) }
}

func TestWorldCombatRejectsOutOfRangeAndForeignCharacter(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil { t.Fatal(err) }
	defer db.Close()
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE characters (
			id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, level INTEGER NOT NULL,
			exp INTEGER NOT NULL, map_id TEXT NOT NULL, pos_x INTEGER NOT NULL, pos_y INTEGER NOT NULL
		);
		CREATE TABLE character_stats (
			character_id INTEGER PRIMARY KEY, attack INTEGER NOT NULL, defense INTEGER NOT NULL,
			current_hp INTEGER NOT NULL, hp INTEGER NOT NULL, last_world_attack_at INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE monsters (
			id INTEGER PRIMARY KEY, name TEXT NOT NULL, level INTEGER NOT NULL,
			max_hp INTEGER NOT NULL, defense INTEGER NOT NULL, exp_reward INTEGER NOT NULL,
			respawn_seconds INTEGER NOT NULL
		);
		CREATE TABLE world_monsters (
			id INTEGER PRIMARY KEY, map_id TEXT NOT NULL, monster_id INTEGER NOT NULL,
			x INTEGER NOT NULL, y INTEGER NOT NULL, hp INTEGER NOT NULL,
			respawn_at INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1
		);
		INSERT INTO characters(id,user_id,level,exp,map_id,pos_x,pos_y)
			VALUES(1,10,1,0,'map_001_village_test',0,0);
		INSERT INTO character_stats(character_id,attack,defense,current_hp,hp)
			VALUES(1,15,5,100,100);
		INSERT INTO monsters(id,name,level,max_hp,defense,exp_reward,respawn_seconds)
			VALUES(1,'Sói Xám',1,50,2,20,5);
		INSERT INTO world_monsters(id,map_id,monster_id,x,y,hp,respawn_at,version)
			VALUES(100,'map_001_village_test',1,15,14,50,0,1);
	`)
	if err != nil { t.Fatal(err) }
	if _, err := performWorldAttack(db,10,1,100); err == nil {
		t.Fatal("expected out-of-range attack to be rejected")
	}
	if _, err := performWorldAttack(db,99,1,100); err == nil {
		t.Fatal("expected a foreign account character to be rejected")
	}
}

func TestWorldKillAwardsEXPAndRespawnServerSide(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil { t.Fatal(err) }
	defer db.Close()
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE characters (
			id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, level INTEGER NOT NULL,
			exp INTEGER NOT NULL, map_id TEXT NOT NULL, pos_x INTEGER NOT NULL, pos_y INTEGER NOT NULL
		);
		CREATE TABLE character_stats (
			character_id INTEGER PRIMARY KEY, attack INTEGER NOT NULL, defense INTEGER NOT NULL,
			current_hp INTEGER NOT NULL, hp INTEGER NOT NULL, mp INTEGER NOT NULL,
			last_world_attack_at INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE monsters (
			id INTEGER PRIMARY KEY, name TEXT NOT NULL, level INTEGER NOT NULL,
			max_hp INTEGER NOT NULL, defense INTEGER NOT NULL, exp_reward INTEGER NOT NULL,
			respawn_seconds INTEGER NOT NULL
		);
		CREATE TABLE world_monsters (
			id INTEGER PRIMARY KEY, map_id TEXT NOT NULL, monster_id INTEGER NOT NULL,
			x INTEGER NOT NULL, y INTEGER NOT NULL, hp INTEGER NOT NULL,
			respawn_at INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1
		);
		INSERT INTO characters(id,user_id,level,exp,map_id,pos_x,pos_y)
			VALUES(1,10,1,90,'map_001_village_test',15,14);
		INSERT INTO character_stats(character_id,attack,defense,current_hp,hp,mp)
			VALUES(1,15,5,65,100,50);
		INSERT INTO monsters(id,name,level,max_hp,defense,exp_reward,respawn_seconds)
			VALUES(1,'Sói Xám',1,50,2,20,5);
		INSERT INTO world_monsters(id,map_id,monster_id,x,y,hp,respawn_at,version)
			VALUES(100,'map_001_village_test',1,15,14,10,0,1);
	`)
	if err != nil { t.Fatal(err) }

	result, err := performWorldAttack(db,10,1,100)
	if err != nil { t.Fatalf("world attack: %v",err) }
	if result["defeated"] != true || result["exp_gained"] != 20 || result["level"] != 2 {
		t.Fatalf("expected server-side kill, EXP and level-up, got %#v",result)
	}
	var hp,currentHP,mp,level,exp,monsterHP int
	if err := db.QueryRow("SELECT hp,current_hp,mp FROM character_stats WHERE character_id=1").Scan(&hp,&currentHP,&mp); err != nil { t.Fatal(err) }
	if hp != 110 || currentHP != 110 || mp != 55 {
		t.Fatalf("expected level-up stats hp/current_hp/mp 110/110/55, got %d/%d/%d",hp,currentHP,mp)
	}
	if err := db.QueryRow("SELECT level,exp FROM characters WHERE id=1").Scan(&level,&exp); err != nil { t.Fatal(err) }
	if level != 2 || exp != 10 { t.Fatalf("expected level 2 and 10 remaining EXP, got %d/%d",level,exp) }
	if err := db.QueryRow("SELECT hp FROM world_monsters WHERE id=100").Scan(&monsterHP); err != nil { t.Fatal(err) }
	if monsterHP != 0 { t.Fatalf("expected shared monster to be dead, got hp=%d",monsterHP) }
	if _, err := db.Exec("UPDATE character_stats SET last_world_attack_at=0 WHERE character_id=1"); err != nil { t.Fatal(err) }
	if _, err := performWorldAttack(db,10,1,100); err == nil {
		t.Fatal("expected defeated monster to remain unavailable during respawn")
	}
}

func TestWorldPortalDefinitionsAreWalkableAndConnected(t *testing.T) {
	village := worldMaps["map_001_village_test"].Portals[gridCell{18,10}]
	if village.TargetMap != "map_002_field_test" || village.TargetX != 2 || village.TargetY != 10 {
		t.Fatalf("unexpected village portal destination: %#v",village)
	}
	field := worldMaps["map_002_field_test"].Portals[gridCell{1,10}]
	if field.TargetMap != "map_001_village_test" || field.TargetX != 18 || field.TargetY != 10 {
		t.Fatalf("unexpected field portal destination: %#v",field)
	}
	if !worldWalkable(village.TargetMap,village.TargetX,village.TargetY) ||
		!worldWalkable(field.TargetMap,field.TargetX,field.TargetY) {
		t.Fatal("portal destinations must be walkable")
	}
}

func newWorldMoveTestDB(t *testing.T, mapID string, x, y, hp int) *sql.DB {
	t.Helper()
	testDB, err := sql.Open("sqlite", ":memory:")
	if err != nil { t.Fatal(err) }
	testDB.SetMaxOpenConns(1)
	_, err = testDB.Exec(`
		CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at DATETIME NOT NULL);
		CREATE TABLE characters(
			id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,map_id TEXT NOT NULL,
			pos_x INTEGER NOT NULL,pos_y INTEGER NOT NULL,last_move_at INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE character_stats(character_id INTEGER PRIMARY KEY,current_hp INTEGER NOT NULL);
		CREATE TABLE world_presence(character_id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,last_seen_at INTEGER NOT NULL);
	`)
	if err != nil { t.Fatal(err) }
	_, err = testDB.Exec("INSERT INTO sessions(token,user_id,expires_at) VALUES('test-token',10,?)",time.Now().Add(time.Hour))
	if err != nil { t.Fatal(err) }
	_, err = testDB.Exec("INSERT INTO characters(id,user_id,map_id,pos_x,pos_y,last_move_at) VALUES(1,10,?,?,?,0)",mapID,x,y)
	if err != nil { t.Fatal(err) }
	_, err = testDB.Exec("INSERT INTO character_stats(character_id,current_hp) VALUES(1,?)",hp)
	if err != nil { t.Fatal(err) }
	return testDB
}

func callWorldMove(t *testing.T, handler http.HandlerFunc, dx, dy int) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	body := `{"character_id":1,"dx":` + strconv.Itoa(dx) + `,"dy":` + strconv.Itoa(dy) + `}`
	req := httptest.NewRequest(http.MethodPost,"/api/world/move",strings.NewReader(body))
	req.Header.Set("Authorization","Bearer test-token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec,req)
	var payload map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(),&payload)
	return rec,payload
}

func TestWorldMoveHandlerPersistsPositionAndServerPortal(t *testing.T) {
	testDB := newWorldMoveTestDB(t,"map_001_village_test",9,12,100)
	defer testDB.Close()
	oldDB := db
	db = testDB
	defer func(){ db = oldDB }()

	handler := worldMoveHandler(testDB)
	rec,payload := callWorldMove(t,handler,1,0)
	if rec.Code != http.StatusOK || payload["x"] != float64(10) || payload["y"] != float64(12) {
		t.Fatalf("expected authoritative move to 10,12; status=%d payload=%#v",rec.Code,payload)
	}
	_,err := testDB.Exec("UPDATE characters SET pos_x=17,pos_y=10,last_move_at=0 WHERE id=1")
	if err != nil { t.Fatal(err) }
	rec,payload = callWorldMove(t,handler,1,0)
	if rec.Code != http.StatusOK || payload["map_id"] != "map_002_field_test" ||
		payload["x"] != float64(2) || payload["y"] != float64(10) {
		t.Fatalf("expected server portal transition to map 2 at 2,10; status=%d payload=%#v",rec.Code,payload)
	}
	var mapID string; var x,y int
	if err:=testDB.QueryRow("SELECT map_id,pos_x,pos_y FROM characters WHERE id=1").Scan(&mapID,&x,&y);err!=nil{t.Fatal(err)}
	if mapID!="map_002_field_test" || x!=2 || y!=10 { t.Fatalf("portal transition not persisted: %s %d,%d",mapID,x,y) }
}

func TestWorldMoveHandlerRejectsDeadCharacter(t *testing.T) {
	testDB := newWorldMoveTestDB(t,"map_001_village_test",9,12,0)
	defer testDB.Close()
	oldDB := db
	db = testDB
	defer func(){ db = oldDB }()
	rec,_ := callWorldMove(t,worldMoveHandler(testDB),1,0)
	if rec.Code != http.StatusConflict { t.Fatalf("expected dead character conflict, got %d",rec.Code) }
}
