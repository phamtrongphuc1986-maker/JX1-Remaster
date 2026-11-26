# Máy chủ JX1 Remaster — prototype có lưu SQLite

Yêu cầu Node.js 20+, npm và công cụ biên dịch native nếu máy không có binary better-sqlite3 phù hợp.

```bash
cd server
npm install
mkdir -p data
export JX1_SESSION_SECRET="$(openssl rand -hex 32)"
export JX1_DB_PATH="$PWD/data/jx1.sqlite"
export HOST=127.0.0.1
npm run check
npm test
npm start
``

HTTP: GET /health; POST /auth/register và /auth/login với JSON username/password (username 3–20 ký tự; mật khẩu tối thiểu 10 ký tự).

WebSocket: authenticate với token nhận từ HTTP; join_map với mapId; move với x/y trong lưới 20x20.

SQLite lưu tài khoản, hash mật khẩu scrypt, nhân vật, cấp độ, vị trí, HP/MP/EXP/vàng và phiên đăng nhập. Bật WAL và khóa ngoại. Sao lưu file database cùng các file -wal/-shm sau khi dừng server hoặc dùng SQLite backup API.

CẢNH BÁO: Đây chưa phải máy chủ phát hành công khai. Còn thiếu HTTPS/WSS reverse proxy, giới hạn đăng nhập, xác minh email/khôi phục mật khẩu, thu hồi token/logout, backup/restore được kiểm thử, kiểm tra va chạm đường đi, chiến đấu/túi đồ/nhiệm vụ/kinh tế authoritative, chống gian lận và kiểm thử tải. Di chuyển hiện vẫn cho phép client chọn ô bất kỳ trong lưới.
