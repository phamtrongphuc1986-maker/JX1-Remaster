package main

import (
    "bytes"
    "database/sql"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
)

func TestRandomTokenFormatAndUniqueness(t *testing.T) {
    first, err := randomToken()
    if err != nil { t.Fatalf("randomToken() error = %v", err) }
    second, err := randomToken()
    if err != nil { t.Fatalf("randomToken() second call error = %v", err) }
    if len(first) != 64 { t.Fatalf("token length = %d, want 64 hex characters", len(first)) }
    if first == second { t.Fatal("randomToken() returned the same token twice") }
}

func TestDecodeAcceptsSingleJSONObject(t *testing.T) {
    req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"test"}`))
    rec := httptest.NewRecorder()
    var got struct { Name string `json:"name"` }
    if !decode(rec, req, &got) { t.Fatalf("decode() rejected valid JSON: %s", rec.Body.String()) }
    if got.Name != "test" { t.Fatalf("decoded name = %q, want test", got.Name) }
}

func TestDecodeRejectsTrailingJSON(t *testing.T) {
    req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"one"} {"name":"two"}`))
    rec := httptest.NewRecorder()
    var got map[string]string
    if decode(rec, req, &got) { t.Fatal("decode() accepted multiple JSON values") }
    if rec.Code != http.StatusBadRequest { t.Fatalf("status = %d, want 400", rec.Code) }
}

func TestDecodeRejectsOversizedBody(t *testing.T) {
    body := bytes.NewBufferString(`{"value":"` + strings.Repeat("x", 5000) + `"}`)
    req := httptest.NewRequest(http.MethodPost, "/", body)
    rec := httptest.NewRecorder()
    var got map[string]string
    if decode(rec, req, &got) { t.Fatal("decode() accepted body larger than 4096 bytes") }
    if rec.Code != http.StatusBadRequest { t.Fatalf("status = %d, want 400", rec.Code) }
}

func TestClassListRequiresGET(t *testing.T) {
    req := httptest.NewRequest(http.MethodPost, "/api/classes", nil)
    rec := httptest.NewRecorder()
    classList(rec, req)
    if rec.Code != http.StatusMethodNotAllowed { t.Fatalf("status = %d, want 405", rec.Code) }
}

func TestClassListReturnsTenClasses(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/classes", nil)
	rec := httptest.NewRecorder()
	classList(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"count":10`) {
		t.Fatalf("response does not report 10 classes: %s", rec.Body.String())
	}
}

func TestListCharactersRejectsNonGETBeforeAuthentication(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/characters", nil)
	rec := httptest.NewRecorder()
	listCharacters(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestGameplayHandlersEnforceMethods(t *testing.T) {
	tests := []struct {
		name string
		handler http.HandlerFunc
		method string
	}{
		{"skills catalog", listSkillsHandler(nil), http.MethodPost},
		{"learn skill", learnSkillHandler(nil), http.MethodGet},
		{"upgrade skill", upgradeSkillHandler(nil), http.MethodGet},
		{"inventory", inventoryHandler(nil), http.MethodPost},
		{"use item", useItemHandler(nil), http.MethodGet},
		{"list monsters", listMonstersHandler(nil), http.MethodPost},
		{"attack monster", attackMonsterHandler(nil), http.MethodGet},
		{"revive character", reviveCharacterHandler(nil), http.MethodGet},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/", nil)
			rec := httptest.NewRecorder()
			tt.handler(rec, req)
			if rec.Code != http.StatusMethodNotAllowed {
				t.Fatalf("status = %d, want 405", rec.Code)
			}
		})
	}
}

func newSkillTestDB(t *testing.T) *sql.DB {
	t.Helper()
	testDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	testDB.SetMaxOpenConns(1)
	schema := `
		CREATE TABLE characters (
			id INTEGER PRIMARY KEY,
			user_id INTEGER NOT NULL,
			class_id INTEGER NOT NULL,
			level INTEGER NOT NULL
		);
		CREATE TABLE skills (
			id INTEGER PRIMARY KEY,
			class_id INTEGER NOT NULL,
			required_level INTEGER NOT NULL,
			max_level INTEGER NOT NULL
		);
		CREATE TABLE character_stats (
			character_id INTEGER PRIMARY KEY,
			skill_points INTEGER NOT NULL
		);
		CREATE TABLE character_skills (
			character_id INTEGER NOT NULL,
			skill_id INTEGER NOT NULL,
			level INTEGER NOT NULL,
			PRIMARY KEY(character_id, skill_id)
		);
		INSERT INTO characters(id,user_id,class_id,level) VALUES(1,7,1,10);
		INSERT INTO skills(id,class_id,required_level,max_level) VALUES(1,1,5,10);
		INSERT INTO character_stats(character_id,skill_points) VALUES(1,3);
	`
	if _, err := testDB.Exec(schema); err != nil {
		testDB.Close()
		t.Fatalf("create skill test schema: %v", err)
	}
	t.Cleanup(func() { testDB.Close() })
	return testDB
}

func TestChangeSkillLevelRejectsAnotherUsersCharacter(t *testing.T) {
	testDB := newSkillTestDB(t)
	if err := changeSkillLevel(testDB, 99, 1, 1, false); err == nil {
		t.Fatal("expected ownership check to reject another user's character")
	}
	var points int
	if err := testDB.QueryRow("SELECT skill_points FROM character_stats WHERE character_id=1").Scan(&points); err != nil {
		t.Fatalf("read skill points: %v", err)
	}
	if points != 3 {
		t.Fatalf("skill points = %d, want unchanged 3", points)
	}
}

func TestChangeSkillLevelConsumesPointOnSuccessfulLearn(t *testing.T) {
	testDB := newSkillTestDB(t)
	if err := changeSkillLevel(testDB, 7, 1, 1, false); err != nil {
		t.Fatalf("learn skill: %v", err)
	}
	var points, level int
	if err := testDB.QueryRow("SELECT skill_points FROM character_stats WHERE character_id=1").Scan(&points); err != nil {
		t.Fatalf("read skill points: %v", err)
	}
	if err := testDB.QueryRow("SELECT level FROM character_skills WHERE character_id=1 AND skill_id=1").Scan(&level); err != nil {
		t.Fatalf("read learned skill: %v", err)
	}
	if points != 2 || level != 1 {
		t.Fatalf("after learn: skill_points=%d level=%d, want 2 and 1", points, level)
	}
}

func TestChangeSkillLevelRejectsWrongClassWithoutSpendingPoint(t *testing.T) {
	testDB := newSkillTestDB(t)
	if _, err := testDB.Exec("UPDATE skills SET class_id=2 WHERE id=1"); err != nil {
		t.Fatalf("change skill class: %v", err)
	}
	if err := changeSkillLevel(testDB, 7, 1, 1, false); err == nil {
		t.Fatal("expected wrong-class skill to be rejected")
	}
	var points int
	if err := testDB.QueryRow("SELECT skill_points FROM character_stats WHERE character_id=1").Scan(&points); err != nil {
		t.Fatalf("read skill points: %v", err)
	}
	if points != 3 {
		t.Fatalf("skill points = %d, want unchanged 3", points)
	}
}
