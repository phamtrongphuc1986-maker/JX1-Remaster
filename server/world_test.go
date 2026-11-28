package main

import (
	"database/sql"
	"testing"

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
