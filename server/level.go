package main

import "database/sql"

func initLevelRewardDB(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS level_reward_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		character_id INTEGER NOT NULL,
		from_level INTEGER NOT NULL,
		to_level INTEGER NOT NULL,
		potential_added INTEGER NOT NULL,
		skill_added INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_level_reward_character
	ON level_reward_log(character_id);

	CREATE TRIGGER IF NOT EXISTS prevent_character_level_decrease
	BEFORE UPDATE OF level ON characters
	WHEN NEW.level < OLD.level
	BEGIN
		SELECT RAISE(ABORT, 'Không thể hạ cấp nhân vật');
	END;

	CREATE TRIGGER IF NOT EXISTS reward_character_level_up
	AFTER UPDATE OF level ON characters
	WHEN NEW.level > OLD.level
	BEGIN
		INSERT OR IGNORE INTO character_stats
		(character_id, potential_points, skill_points)
		VALUES (NEW.id, 0, 0);

		UPDATE character_stats
		SET potential_points = potential_points + ((NEW.level - OLD.level) * 5),
		    skill_points = skill_points + (NEW.level - OLD.level)
		WHERE character_id = NEW.id;

		INSERT INTO level_reward_log
		(character_id, from_level, to_level, potential_added, skill_added)
		VALUES (
			NEW.id,
			OLD.level,
			NEW.level,
			(NEW.level - OLD.level) * 5,
			NEW.level - OLD.level
		);
	END;
	`)
	return err
}
