package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
}

type Character struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	ClassID   int    `json:"class_id"`
	ClassName string `json:"class_name"`
	Level     int    `json:"level"`
}

type Class struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

var db *sql.DB

var classes = []Class{
	{1, "Thiếu Lâm"},
	{2, "Thiên Vương"},
	{3, "Đường Môn"},
	{4, "Ngũ Độc"},
	{5, "Nga Mi"},
	{6, "Thúy Yên"},
	{7, "Cái Bang"},
	{8, "Thiên Nhẫn"},
	{9, "Võ Đang"},
	{10, "Côn Lôn"},
}

func respond(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func initDB() error {
	var err error
	db, err = sql.Open("sqlite", "./data/game.db")
	if err != nil {
		return err
	}

	db.SetMaxOpenConns(1)

	_, err = db.Exec(`
	PRAGMA journal_mode=WAL;

	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL,
		expires_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS characters (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		name TEXT NOT NULL,
		class_id INTEGER NOT NULL,
		level INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, name)
	);
	`)
	return err
}

type CharacterStats struct {
	CharacterID     int64 `json:"character_id"`
	HP              int   `json:"hp"`
	MP              int   `json:"mp"`
	Strength        int   `json:"strength"`
	Agility         int   `json:"agility"`
	Attack          int   `json:"attack"`
	Defense         int   `json:"defense"`
	PotentialPoints int   `json:"potential_points"`
	SkillPoints     int   `json:"skill_points"`
	SpentPoints     int   `json:"spent_points"`
}

func initStatsDB() error {
	_, err := db.Exec(`
        CREATE TABLE IF NOT EXISTS character_stats (
            character_id INTEGER PRIMARY KEY,
            hp INTEGER NOT NULL DEFAULT 100,
            mp INTEGER NOT NULL DEFAULT 50,
            strength INTEGER NOT NULL DEFAULT 10,
            agility INTEGER NOT NULL DEFAULT 10,
            attack INTEGER NOT NULL DEFAULT 15,
            defense INTEGER NOT NULL DEFAULT 5,
            potential_points INTEGER NOT NULL DEFAULT 5,
            skill_points INTEGER NOT NULL DEFAULT 0,
            spent_points INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(character_id) REFERENCES characters(id)
        )
    `)
	if err != nil {
		return err
	}

	// Tu dong tao thuoc tinh cho nhan vat da ton tai.
	_, err = db.Exec(`
        INSERT OR IGNORE INTO character_stats(character_id)
        SELECT id FROM characters
    `)
	return err
}

func readCharacterStats(characterID, userID int64) (CharacterStats, error) {
	var st CharacterStats
	err := db.QueryRow(`
        SELECT s.character_id, s.hp, s.mp, s.strength, s.agility,
               s.attack, s.defense, s.potential_points,
               s.skill_points, s.spent_points
        FROM character_stats s
        JOIN characters c ON c.id = s.character_id
        WHERE s.character_id = ? AND c.user_id = ?
    `, characterID, userID).Scan(
		&st.CharacterID, &st.HP, &st.MP, &st.Strength, &st.Agility,
		&st.Attack, &st.Defense, &st.PotentialPoints,
		&st.SkillPoints, &st.SpentPoints,
	)
	return st, err
}

func getCharacterStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respond(w, 405, map[string]string{"error": "Method không được hỗ trợ"})
		return
	}

	userID, err := authenticate(r)
	if err != nil {
		respond(w, 401, map[string]string{"error": err.Error()})
		return
	}

	characterID, err := strconv.ParseInt(r.URL.Query().Get("character_id"), 10, 64)
	if err != nil || characterID <= 0 {
		respond(w, 400, map[string]string{"error": "character_id không hợp lệ"})
		return
	}

	st, err := readCharacterStats(characterID, userID)
	if err != nil {
		respond(w, 404, map[string]string{"error": "Không tìm thấy nhân vật hoặc thuộc tính"})
		return
	}
	respond(w, 200, st)
}

func allocateStat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respond(w, 405, map[string]string{"error": "Method không được hỗ trợ"})
		return
	}

	userID, err := authenticate(r)
	if err != nil {
		respond(w, 401, map[string]string{"error": err.Error()})
		return
	}

	var req struct {
		CharacterID int64  `json:"character_id"`
		Attribute   string `json:"attribute"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.CharacterID <= 0 {
		respond(w, 400, map[string]string{"error": "character_id không hợp lệ"})
		return
	}

	// Chi chap nhan ten cot co trong danh sach cho phep.
	column := ""
	switch req.Attribute {
	case "hp":
		column = "hp"
	case "mp":
		column = "mp"
	case "strength":
		column = "strength"
	case "agility":
		column = "agility"
	case "attack":
		column = "attack"
	case "defense":
		column = "defense"
	default:
		respond(w, 400, map[string]string{"error": "Thuộc tính không hợp lệ"})
		return
	}

	query := `
        UPDATE character_stats
        SET ` + column + ` = ` + column + ` + 1,
            potential_points = potential_points - 1,
            spent_points = spent_points + 1
        WHERE character_id = ?
          AND potential_points > 0
          AND EXISTS (
              SELECT 1 FROM characters c
              WHERE c.id = character_stats.character_id
                AND c.user_id = ?
          )
    `

	result, err := db.Exec(query, req.CharacterID, userID)
	if err != nil {
		respond(w, 500, map[string]string{"error": "Không thể cộng điểm"})
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		respond(w, 400, map[string]string{
			"error": "Không đủ điểm tiềm năng hoặc không tìm thấy nhân vật",
		})
		return
	}

	st, err := readCharacterStats(req.CharacterID, userID)
	if err != nil {
		respond(w, 500, map[string]string{"error": "Không đọc được thuộc tính sau khi cộng"})
		return
	}
	respond(w, 200, map[string]any{
		"message": "Cộng 1 điểm thành công",
		"stats":   st,
	})
}

func resetCharacterStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respond(w, 405, map[string]string{"error": "Method không được hỗ trợ"})
		return
	}

	userID, err := authenticate(r)
	if err != nil {
		respond(w, 401, map[string]string{"error": err.Error()})
		return
	}

	var req struct {
		CharacterID int64 `json:"character_id"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.CharacterID <= 0 {
		respond(w, 400, map[string]string{"error": "character_id không hợp lệ"})
		return
	}

	result, err := db.Exec(`
        UPDATE character_stats
        SET hp = 100,
            mp = 50,
            strength = 10,
            agility = 10,
            attack = 15,
            defense = 5,
            potential_points = potential_points + spent_points,
            spent_points = 0
        WHERE character_id = ?
          AND EXISTS (
              SELECT 1 FROM characters c
              WHERE c.id = character_stats.character_id
                AND c.user_id = ?
          )
    `, req.CharacterID, userID)

	if err != nil {
		respond(w, 500, map[string]string{"error": "Không thể tẩy điểm"})
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		respond(w, 404, map[string]string{"error": "Không tìm thấy nhân vật"})
		return
	}

	st, err := readCharacterStats(req.CharacterID, userID)
	if err != nil {
		respond(w, 500, map[string]string{"error": "Không đọc được thuộc tính sau khi tẩy"})
		return
	}
	respond(w, 200, map[string]any{
		"message": "Tẩy điểm thành công, điểm đã phân bổ được hoàn lại",
		"stats":   st,
	})
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(v); err != nil {
		respond(w, 400, map[string]string{"error": "JSON không hợp lệ"})
		return false
	}
	// Từ chối dữ liệu JSON thứ hai hoặc phần dữ liệu thừa sau object đầu tiên.
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		respond(w, 400, map[string]string{"error": "Chỉ chấp nhận một đối tượng JSON"})
		return false
	}
	return true
}

func register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respond(w, 405, map[string]string{"error": "Method không được hỗ trợ"})
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !decode(w, r, &req) {
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 4 || len(req.Username) > 24 ||
		len(req.Password) < 8 || len(req.Password) > 72 {
		respond(w, 400, map[string]string{
			"error": "Tên tài khoản 4-24 ký tự, mật khẩu 8-72 ký tự",
		})
		return
	}

	hash, err := bcrypt.GenerateFromPassword(
		[]byte(req.Password), bcrypt.DefaultCost,
	)
	if err != nil {
		respond(w, 500, map[string]string{"error": "Không mã hóa được mật khẩu"})
		return
	}

	result, err := db.Exec(
		"INSERT INTO users(username,password_hash) VALUES(?,?)",
		req.Username, string(hash),
	)
	if err != nil {
		respond(w, 409, map[string]string{"error": "Tên tài khoản đã tồn tại hoặc không hợp lệ"})
		return
	}

	id, _ := result.LastInsertId()
	respond(w, 201, map[string]any{
		"message": "Đăng ký thành công",
		"user":    User{ID: id, Username: req.Username},
	})
}

func login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respond(w, 405, map[string]string{"error": "Method không được hỗ trợ"})
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !decode(w, r, &req) {
		return
	}

	var u User
	var hash string
	err := db.QueryRow(
		"SELECT id,username,password_hash FROM users WHERE username=?",
		strings.TrimSpace(req.Username),
	).Scan(&u.ID, &u.Username, &hash)

	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		respond(w, 401, map[string]string{"error": "Tài khoản hoặc mật khẩu không đúng"})
		return
	}

	token, err := randomToken()
	if err != nil {
		respond(w, 500, map[string]string{"error": "Không tạo được phiên đăng nhập"})
		return
	}

	expires := time.Now().Add(24 * time.Hour)
	_, err = db.Exec(
		"INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)",
		token, u.ID, expires,
	)
	if err != nil {
		respond(w, 500, map[string]string{"error": "Không lưu được phiên đăng nhập"})
		return
	}

	respond(w, 200, map[string]any{
		"message":    "Đăng nhập thành công",
		"user":       u,
		"token":      token,
		"expires_at": expires.Format(time.RFC3339),
	})
}

func authenticate(r *http.Request) (int64, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return 0, errors.New("Thiếu token")
	}

	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	var userID int64
	var expiry time.Time

	err := db.QueryRow(
		"SELECT user_id,expires_at FROM sessions WHERE token=?",
		token,
	).Scan(&userID, &expiry)

	if err != nil || time.Now().After(expiry) {
		return 0, errors.New("Token không hợp lệ hoặc đã hết hạn")
	}
	return userID, nil
}

func classList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respond(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method không được hỗ trợ"})
		return
	}
	respond(w, 200, map[string]any{
		"count":   len(classes),
		"classes": classes,
	})
}

func createCharacter(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respond(w, 405, map[string]string{"error": "Method không được hỗ trợ"})
		return
	}

	userID, err := authenticate(r)
	if err != nil {
		respond(w, 401, map[string]string{"error": err.Error()})
		return
	}

	var req struct {
		Name    string `json:"name"`
		ClassID int    `json:"class_id"`
	}
	if !decode(w, r, &req) {
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if len([]rune(req.Name)) < 2 || len([]rune(req.Name)) > 16 {
		respond(w, 400, map[string]string{"error": "Tên nhân vật phải từ 2-16 ký tự"})
		return
	}

	var className string
	for _, c := range classes {
		if c.ID == req.ClassID {
			className = c.Name
			break
		}
	}
	if className == "" {
		respond(w, 400, map[string]string{"error": "Môn phái không hợp lệ"})
		return
	}

	result, err := db.Exec(
		"INSERT INTO characters(user_id,name,class_id) VALUES(?,?,?)",
		userID, req.Name, req.ClassID,
	)
	if err != nil {
		respond(w, 409, map[string]string{"error": "Tên nhân vật đã tồn tại hoặc dữ liệu không hợp lệ"})
		return
	}

	id, _ := result.LastInsertId()
	if _, err := db.Exec("INSERT OR IGNORE INTO character_stats(character_id) VALUES(?)", id); err != nil {
		respond(w, 500, map[string]string{"error": "Tạo thuộc tính nhân vật thất bại"})
		return
	}
	respond(w, 201, Character{
		ID: id, Name: req.Name,
		ClassID: req.ClassID, ClassName: className, Level: 1,
	})
}

func listCharacters(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respond(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method không được hỗ trợ"})
		return
	}
	userID, err := authenticate(r)
	if err != nil {
		respond(w, 401, map[string]string{"error": err.Error()})
		return
	}

	rows, err := db.Query(
		"SELECT id,name,class_id,level FROM characters WHERE user_id=? ORDER BY id",
		userID,
	)
	if err != nil {
		respond(w, 500, map[string]string{"error": "Không đọc được nhân vật"})
		return
	}
	defer rows.Close()

	result := []Character{}
	for rows.Next() {
		var c Character
		if err := rows.Scan(&c.ID, &c.Name, &c.ClassID, &c.Level); err != nil {
			respond(w, 500, map[string]string{"error": "Lỗi dữ liệu nhân vật"})
			return
		}
		for _, cl := range classes {
			if cl.ID == c.ClassID {
				c.ClassName = cl.Name
				break
			}
		}
		result = append(result, c)
	}

	respond(w, 200, map[string]any{"characters": result})
}

func main() {
	if err := initDB(); err != nil {
		log.Fatal(err)
	}

	if err := initStatsDB(); err != nil {
		log.Fatal(err)
	}

	if err := initLevelRewardDB(db); err != nil {
		log.Fatal(err)
	}

	if err := initExpDB(db); err != nil {
		log.Fatal(err)
	}

	if err := initItemDB(db); err != nil {
		log.Fatal("Item DB:", err)
	}

	if err := initSkillDB(db); err != nil {
		log.Fatal(err)
	}

	defer db.Close()

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 200, map[string]string{
			"game":    "JX1M Clean",
			"version": "0.4.0",
			"status":  "online",
		})
	})

	http.HandleFunc("/api/register", register)
	http.HandleFunc("/api/login", login)
	http.HandleFunc("/api/classes", classList)

	http.HandleFunc("/api/characters", listCharacters)
	http.HandleFunc("/api/characters/create", createCharacter)
	http.HandleFunc("/api/characters/stats", getCharacterStats)
	http.HandleFunc("/api/characters/allocate", allocateStat)
	http.HandleFunc("/api/characters/reset-stats", resetCharacterStats)

	// He thong ky nang 10 mon phai
	http.HandleFunc("/api/skills", listSkillsHandler(db))
	http.HandleFunc("/api/characters/skills", characterSkillsHandler(db))
	http.HandleFunc("/api/skills/learn", learnSkillHandler(db))
	http.HandleFunc("/api/skills/upgrade", upgradeSkillHandler(db))
	http.HandleFunc("/api/monsters", listMonstersHandler(db))
	http.HandleFunc("/api/combat/attack", attackMonsterHandler(db))
	http.HandleFunc("/api/characters/revive", reviveCharacterHandler(db))
	http.HandleFunc("/api/inventory", inventoryHandler(db))
	http.HandleFunc("/api/items/use", useItemHandler(db))

	log.Println("JX1M Clean 0.4.0 starting at 127.0.0.1:8083")
	log.Fatal(http.ListenAndServe("127.0.0.1:8083", nil))
}
