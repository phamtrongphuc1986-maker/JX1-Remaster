# Phân tích khoảng trống client và vận hành — 28/11/2026

## Phạm vi
Cập nhật 28/11/2026 dựa trên source đang có trong nhánh tích hợp `integration/jx1m-clean-monorepo`. Các nhận định về project Cocos bên dưới vẫn là đánh giá source, không phải kết quả mở Editor hoặc chạy game.

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

## Server hiện có — đối chiếu trực tiếp `server/main.go` và các handler
Server hiện tại là API HTTP prototype dùng SQLite, bcrypt và bearer token có hạn 24 giờ; tiến trình bind `127.0.0.1:8083`. Endpoint đã đăng ký trong source:
- `GET /health`
- `POST /api/register`, `POST /api/login`
- `GET /api/classes`
- `GET /api/characters`, `POST /api/characters/create`
- `GET /api/characters/stats`, `POST /api/characters/allocate`, `POST /api/characters/reset-stats`
- `GET /api/skills`, `GET /api/characters/skills`, `POST /api/skills/learn`, `POST /api/skills/upgrade`
- `GET /api/monsters`, `POST /api/combat/attack`, `POST /api/characters/revive`
- `GET /api/inventory`, `POST /api/items/use`

**Chưa có endpoint trong source hiện tại cho bản đồ, NPC, nhiệm vụ, trang bị, bang hội hoặc Tống–Kim.** Không được coi những hệ thống này đã được backend hỗ trợ chỉ vì tài liệu cũ hoặc bản scaffold trước có nhắc tới chúng.
- Chưa có WebSocket/world session, snapshot state, reconnect hoặc đồng bộ realtime nhiều người chơi.
- Chưa có rate limiting, thu hồi phiên đăng nhập, kiểm thử tải hoặc quy trình backup/restore đã được xác minh.
- Cần tiếp tục rà soát migration SQLite, quyền sở hữu, giao dịch nhiều bước và xử lý lỗi trước khi dùng dữ liệu thật.
- Smoke test tạo tài khoản và nhân vật thử; chỉ chạy với database tạm trong CI, tuyệt đối không chạy vào production.

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
