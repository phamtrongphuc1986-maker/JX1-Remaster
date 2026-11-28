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
