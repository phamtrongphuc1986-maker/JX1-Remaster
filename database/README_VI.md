# Database

Chỉ lưu schema SQL, migration có version và dữ liệu mẫu không nhạy cảm.

Không commit database người chơi, file SQLite WAL/SHM, token hoặc bản dump chứa dữ liệu cá nhân. Sao lưu SQLite bằng cơ chế backup/checkpoint phù hợp trước khi migration.