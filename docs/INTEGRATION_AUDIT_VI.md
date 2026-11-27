# Báo cáo kiểm kê JX1M Clean + JX1 Remaster

Ngày kiểm kê: 2026-11-28  
Nhánh: `integration/jx1m-clean-monorepo`

## 1. Repository hiện tại

Repository đích: `phamtrongphuc1986-maker/JX1-Remaster`.

Các file client đang ở thư mục gốc, gồm module bản đồ isometric, camera, chuyển bản đồ, nhân vật, quái, chiến đấu, túi đồ và dịch chuyển. Có dữ liệu `map_001_village_test.json` và `map_002_field_test.json`.

Repository đích hiện chưa có project Cocos Creator hoàn chỉnh ở root: chưa thấy bộ `assets/`, `settings/`, `project.json`/cấu hình editor chuẩn được tổ chức thành project mở trực tiếp. Các file TypeScript hiện có cần được chuyển vào cấu trúc project và kiểm tra tương thích.

## 2. Server source do chủ dự án cung cấp

Gói `jx1m-clean-source.tar.gz` được mở kiểm tra:
- `main.go`, `skills.go`, `level.go`, `exp.go`, `items.go`
- `go.mod`, `go.sum`, `server.log`
- thư mục `data/` chỉ có `game.db-wal` và `game.db-shm`, không có `game.db` chính.

**Không đưa WAL/SHM vào repository.** Không dùng hai sidecar này làm bản sao lưu database. Không khôi phục dữ liệu người chơi từ gói này.

## 3. Gói hợp nhất thử nghiệm trước đây

Gói `jx1m-clean-unified-source-dev.tar.gz` chứa server Go bổ sung (`world.go`, `skill_combat.go`) và client Cocos scaffold với các panel đăng nhập, nhân vật, kỹ năng, túi đồ, nhiệm vụ, HUD và map isometric.

Đây là scaffold thử nghiệm, chưa được xác nhận là project Cocos Creator có thể mở/build hoàn chỉnh. `client-cocos/package.json` chỉ có script placeholder hướng dẫn mở bằng Cocos Creator 3.8.x, chưa có dependency/build pipeline thực tế.

## 4. Kiểm thử hiện tại

- Hai gói TAR đọc được và danh sách file không báo lỗi.
- Kiểm thử Go chưa chạy được trong môi trường kiểm tra hiện tại: `go.mod` yêu cầu Go 1.26.0, môi trường kiểm tra chỉ có Go 1.23.2; tải toolchain bị chặn do môi trường không có kết nối mạng.
- Vì vậy **chưa có kết quả PASS/FAIL của `go test ./...` hoặc build với đúng Go 1.26.0**.
- Chưa có kết quả mở project trong Cocos Creator Editor, build APK hoặc cài đặt lên OPPO.

## 5. Rủi ro cần xử lý

1. Xác minh mã server và chạy test bằng Go 1.26.0 trên VPS đã có toolchain phù hợp.
2. Kiểm tra schema/migration và quyền sở hữu nhân vật ở mọi API.
3. Kiểm tra tính nguyên tử khi trao EXP, phần thưởng, vật phẩm và lượt tẩy.
4. Chuyển combat/HP/EXP/loot và vị trí có ảnh hưởng gameplay sang server-authoritative; không tin client.
5. Thay URL placeholder `https://YOUR_GAME_DOMAIN` bằng cấu hình môi trường; không hardcode domain chưa có.
6. Không lưu token dài hạn trong localStorage nếu có phương án lưu trữ an toàn hơn trên Android.
7. Tạo project Cocos Creator 3.8.x thực tế, scene và prefab; kiểm tra TypeScript trong editor.
8. Tạo pipeline build Android ARM64, ký APK/AAB bằng secrets; không đưa keystore vào Git.

## 6. Cấu trúc hợp nhất được chọn

```
server/
client/cocos/
database/
deployment/
tests/
android/
docs/
```

## 7. Điều kiện trước khi triển khai VPS

- Có bản sao lưu hợp lệ của database bằng SQLite backup/checkpoint.
- Có user triển khai riêng, không chạy app bằng root.
- Có systemd service và reverse proxy HTTPS.
- Có health check, log rotation, rollback và migration có thể phục hồi.
- Không đổi port hoặc dừng phiên bản đang chạy trước khi kiểm thử staging.

## 8. Kết luận

Có đủ nguyên liệu để tiếp tục tích hợp, nhưng chưa đủ bằng chứng để gọi đây là một source thống nhất đã build được. Giữ nguyên `main`; mọi thay đổi tiếp theo chỉ ở nhánh tích hợp cho đến khi test đầy đủ.