# Rà soát kỹ thuật source JX1M Clean — 28/11/2026

## Nguồn được rà soát
Gói `JX1M-Clean-Source-Import.tar.gz` do người dùng cung cấp trong cuộc trò chuyện, SHA-256:
`21e2f6d6df85fbc9e6932fc35772890db7a00e407d5b4f287c806a5cbc9761d6`.

Các tệp mã nguồn: `main.go`, `exp.go`, `items.go`, `level.go`, `skills.go`, `skill_combat.go`, `world.go`, `go.mod`, `go.sum`; client có 9 TypeScript scripts và scaffold Cocos.

## Kết quả đã xác minh
- `gofmt -d ./*.go` không đưa ra khác biệt định dạng.
- `go.mod` yêu cầu Go 1.26.0.
- Máy kiểm tra hiện tại có Go 1.23.2; `GOTOOLCHAIN=local go test ./...` dừng ngay vì toolchain thấp hơn yêu cầu.
- Gói không có tệp `*_test.go`; do đó chưa có unit tests do dự án cung cấp.
- Server khởi tạo SQLite ở `./data/game.db`, giới hạn một kết nối mở và bind `127.0.0.1:8083`.
- Đăng ký dùng bcrypt; session bearer token có hạn 24 giờ.
- Các handler thao tác nhân vật được kiểm tra chủ sở hữu qua user ID trong phần lớn endpoint đã rà soát.
- Dữ liệu bản đồ seed hiện có 3 map và 4 NPC.
- `scripts/smoke-test.sh` là kiểm tra tích hợp API; chỉ được chạy trên database staging sạch, không chạy vào dữ liệu production.
- Không tìm thấy tệp bí mật cấu hình thực tế trong gói. `ApiClient.baseURL` vẫn là placeholder `https://YOUR_GAME_DOMAIN`.

## Các điểm chặn trước khi phát hành
1. Chưa có source được commit vào `server/` và `client/cocos/` trong repository.
2. `client-cocos/package.json` chỉ có lệnh echo hướng dẫn mở Cocos Creator 3.8.x; không phải lệnh build.
3. Thư mục scene hiện chưa có scene Cocos được biên tập; chưa có cấu hình project/editor hoàn chỉnh.
4. Chưa có sprite, animation, âm thanh, VFX hoặc asset game hoàn chỉnh.
5. Chưa có world server realtime, đồng bộ vị trí, reconnect hoặc kiểm thử nhiều client.
6. Chưa có endpoint HTTPS/domain thật được cấu hình cho client.
7. Chưa có APK/AAB build artifact, và chưa cài thử trên thiết bị Android.
8. Chưa chạy được Go test/build/API smoke test với Go 1.26.0 trong môi trường kiểm tra hiện tại.

## Quy tắc nhập source an toàn
- Giải nén gói và chuyển 7 tệp Go cùng `go.mod`, `go.sum` vào `server/`.
- Chuyển `scripts/` vào `server/scripts/`.
- Chuyển `client-cocos/` vào `client/cocos/`.
- Không nhập `data/`, SQLite DB/WAL/SHM, log, binary, token hoặc secret.
- Không thay đổi nhánh `main`; chỉ làm trên `integration/jx1m-clean-monorepo`.
- Sau khi nhập, chạy CI, xem log lỗi, sửa lỗi trên nhánh tích hợp và chỉ mở PR khi build + smoke test staging PASS.
- Không deploy hoặc ghi đè thư mục server đang chạy trên VPS nếu chưa backup và chưa được chủ dự án cho phép.

## Kết luận
Source này là nền server API + client scaffold để phát triển tiếp, chưa phải game online nhiều người chơi hoàn chỉnh. Không được gắn nhãn APK phát hành hoặc tuyên bố game sẵn sàng tải về cho tới khi toàn bộ điểm chặn trên được giải quyết và kiểm chứng.
