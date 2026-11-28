# Phân tích khoảng trống client và vận hành — 28/11/2026

## Phạm vi
Rà soát trực tiếp gói `JX1M-Clean-Source-Import.tar.gz` (26 file, 100,119 byte giải nén; SHA-256 đã ghi trong CODEX_HANDOFF_VI.md). Đây là đánh giá source hiện có, không phải kết quả chạy game.

## Client Cocos hiện tại
Có 9 TypeScript scripts:
- Core: `ApiClient.ts`
- UI: Login, Character, GameHUD, Inventory, Skill, Quest
- World: MapPanel, IsoMapView, PlayerController

Các giới hạn xác minh được:
1. `package.json` script `build` chỉ echo hướng dẫn mở Cocos Creator 3.8.x; không chạy compiler hay build Android.
2. Không có `project.json`, `settings/`, `profiles/`, scene được biên tập, UUID metadata hoặc cấu hình native Android trong gói.
3. Không có sprite sheet, model, animation, VFX, âm thanh, font hay asset bản đồ hoàn chỉnh.
4. `ApiClient.baseURL` là placeholder `https://YOUR_GAME_DOMAIN`; chưa thể đăng nhập vào server thật.
5. UI dùng các ID mặc định/hardcode (ví dụ characterId = 1); chưa có luồng chọn nhân vật hoàn chỉnh.
6. `PlayerController.moveTile` chỉ tween vị trí cục bộ trong client, không gửi tọa độ lên server và không nhận đồng bộ từ người chơi khác.
7. Không có WebSocket, snapshot state, reconnect, interpolation hoặc prediction.
8. Chưa có màn chọn máy chủ, tạo nhân vật hoàn chỉnh, túi đồ tương tác, bảng kỹ năng/nhiệm vụ thực tế hoặc luồng vào bản đồ nối với gameplay.

## Server hiện có
- API HTTP đăng ký/đăng nhập, lớp nhân vật, stats, kỹ năng, quái, combat, inventory, item, maps, NPC, quest và equipment.
- Dùng SQLite, bcrypt, bearer token 24 giờ; listen tại `127.0.0.1:8083`.
- Có endpoint `/health`.
- Không phải backend realtime MMO: chưa có kết nối WebSocket hoặc cơ chế world/session để đồng bộ nhiều người chơi.
- Chưa có rate limiting, quản lý session/revoke token hoặc kiểm thử tải.
- Cần rà soát cấu hình SQLite foreign key, backup/restore, migration và cạnh tranh ghi trước khi dùng dữ liệu thật.
- Smoke test tạo tài khoản/nhân vật thử và giữ lại dữ liệu thử trong database; chỉ chạy trên DB tạm, tuyệt đối không chạy vào production.

## Lộ trình ưu tiên
### Gate 1 — Server chạy ổn định
- Nhập source vào `server/`, dùng Go 1.26.0.
- Bổ sung unit/integration tests; chạy `go test ./...`, `go vet ./...`, `go build`.
- Chạy smoke test trên database CI tạm.
- Rà soát ownership, transaction, chống spam/abuse, rate limits, session lifecycle và migration.
- Chỉ deploy staging sau khi có backup và được cho phép.

### Gate 2 — Project Cocos mở được
- Dùng đúng Cocos Creator 3.8.x, tạo project thực tế trong Editor.
- Import 9 scripts; xử lý compile errors; tạo scene Login, Character Select, Main Game.
- Tạo UI node/prefab và gán component properties trong Editor.
- Thay endpoint bằng cấu hình staging HTTPS; không hardcode secret.
- Tạo asset riêng hoặc có giấy phép sử dụng.

### Gate 3 — Gameplay MVP
- Đăng ký/đăng nhập, tạo/chọn nhân vật, tải map, di chuyển, quái, combat, skill, inventory, quest.
- Trước khi gọi là online multiplayer: server phải là nguồn chân lý cho vị trí, HP, damage, EXP, loot; thêm WebSocket và kiểm thử hai client thật.
- Thử trên OPPO Android ARM64, xử lý reconnect/mất mạng, hiệu năng và màn hình.

### Gate 4 — Phát hành
- Build APK/AAB bằng Cocos Creator; lưu artifact và checksum.
- Cài APK lên điện thoại thật, kiểm tra clean install/update và smoke test.
- Không phát hành hoặc merge main trước khi Gate 1–4 đạt.

## Kết luận
Gói hiện tại là backend HTTP API prototype + Cocos TypeScript scaffold. Chưa có client game đóng gói, chưa có đồng bộ multiplayer, chưa có APK. Ưu tiên tiếp theo là nhập source và chạy CI thật; không nên xây thêm tính năng client trên nền chưa compile được.
