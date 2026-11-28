package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type ItemRequest struct {
	CharacterID int `json:"character_id"`
	ItemID      int `json:"item_id"`
}

func initItemDB(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS item_catalog (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS character_items (
		character_id INTEGER NOT NULL,
		item_id INTEGER NOT NULL,
		quantity INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY(character_id,item_id)
	);

	CREATE TABLE IF NOT EXISTS item_use_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		character_id INTEGER NOT NULL,
		item_id INTEGER NOT NULL,
		used_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	INSERT OR IGNORE INTO item_catalog
	(id,name,description) VALUES
	(1,'Võ Lâm Mật Tịch','Sử dụng nhận 1 điểm kỹ năng'),
	(2,'Tẩy Tủy Kinh','Sử dụng nhận 1 lượt tẩy tủy miễn phí');

	ALTER TABLE character_stats
	ADD COLUMN free_stat_resets INTEGER NOT NULL DEFAULT 0;
	`)
	if err != nil {
		// Cột đã tồn tại thì tiếp tục khởi tạo.
		rows, queryErr := db.Query("PRAGMA table_info(character_stats)")
		if queryErr != nil {
			return err
		}
		defer rows.Close()

		found := false
		for rows.Next() {
			var cid, notnull, pk int
			var name, typ string
			var def interface{}
			if rows.Scan(&cid, &name, &typ, &notnull, &def, &pk) == nil &&
				name == "free_stat_resets" {
				found = true
			}
		}
		if !found {
			return err
		}
	}

	return nil
}

func inventoryHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Sai phương thức", 405)
			return
		}

		userID, err := authenticate(r)
		if err != nil {
			http.Error(w, err.Error(), 401)
			return
		}

		characterID := r.URL.Query().Get("character_id")
		var owner int64
		err = db.QueryRow(
			"SELECT user_id FROM characters WHERE id=?",
			characterID,
		).Scan(&owner)

		if err != nil || owner != userID {
			http.Error(w, "Nhân vật không hợp lệ", 403)
			return
		}

		rows, err := db.Query(`
			SELECT i.id,i.name,i.description,
			       COALESCE(ci.quantity,0)
			FROM item_catalog i
			LEFT JOIN character_items ci
			ON ci.item_id=i.id AND ci.character_id=?
			ORDER BY i.id
		`, characterID)

		if err != nil {
			http.Error(w, "Không đọc được túi đồ", 500)
			return
		}
		defer rows.Close()

		type Item struct {
			ID          int    `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description"`
			Quantity    int    `json:"quantity"`
		}

		items := []Item{}
		for rows.Next() {
			var item Item
			if err := rows.Scan(
				&item.ID,
				&item.Name,
				&item.Description,
				&item.Quantity,
			); err != nil {
				http.Error(w, "Lỗi đọc dữ liệu túi đồ", http.StatusInternalServerError)
				return
			}
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, "Lỗi đọc dữ liệu túi đồ", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	}
}

func useItemHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Sai phương thức", 405)
			return
		}

		userID, err := authenticate(r)
		if err != nil {
			http.Error(w, err.Error(), 401)
			return
		}

		var req ItemRequest
		if !decode(w, r, &req) ||
			req.CharacterID <= 0 || req.ItemID <= 0 {
			http.Error(w, "Dữ liệu không hợp lệ", 400)
			return
		}

		tx, err := db.Begin()
		if err != nil {
			http.Error(w, "Không tạo được giao dịch", 500)
			return
		}
		defer tx.Rollback()

		var owner int64
		err = tx.QueryRow(
			"SELECT user_id FROM characters WHERE id=?",
			req.CharacterID,
		).Scan(&owner)

		if err != nil || owner != userID {
			http.Error(w, "Nhân vật không hợp lệ", 403)
			return
		}

		var quantity int
		err = tx.QueryRow(`
			SELECT quantity FROM character_items
			WHERE character_id=? AND item_id=?
		`, req.CharacterID, req.ItemID).Scan(&quantity)

		if err != nil || quantity < 1 {
			http.Error(w, "Không có vật phẩm trong túi", 400)
			return
		}

		switch req.ItemID {
		case 1:
			_, err = tx.Exec(`
				UPDATE character_stats
				SET skill_points=skill_points+1
				WHERE character_id=?
			`, req.CharacterID)

		case 2:
			_, err = tx.Exec(`
				UPDATE character_stats
				SET free_stat_resets=free_stat_resets+1
				WHERE character_id=?
			`, req.CharacterID)

		default:
			http.Error(w, "Vật phẩm chưa hỗ trợ", 400)
			return
		}

		if err != nil {
			http.Error(w, "Không thể sử dụng vật phẩm", 500)
			return
		}

		result, err := tx.Exec(`
			UPDATE character_items
			SET quantity=quantity-1
			WHERE character_id=? AND item_id=? AND quantity>0
		`, req.CharacterID, req.ItemID)

		if err != nil {
			http.Error(w, "Không thể trừ vật phẩm", 500)
			return
		}
		if affected, rowsErr := result.RowsAffected(); rowsErr != nil || affected != 1 {
			http.Error(w, "Số lượng vật phẩm đã thay đổi, vui lòng thử lại", 409)
			return
		}

		_, err = tx.Exec(`
			INSERT INTO item_use_log(character_id,item_id)
			VALUES(?,?)
		`, req.CharacterID, req.ItemID)

		if err != nil {
			http.Error(w, "Không ghi được lịch sử", 500)
			return
		}

		if err = tx.Commit(); err != nil {
			http.Error(w, "Giao dịch thất bại", 500)
			return
		}

		message := "Đã nhận 1 điểm kỹ năng"
		if req.ItemID == 2 {
			message = "Đã nhận 1 lượt tẩy tủy miễn phí"
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": message,
		})
	}
}
