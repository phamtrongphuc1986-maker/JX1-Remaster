# Kiểm toán mã nguồn JX1M Clean — 28/11/2026

## 1. Phạm vi đã mở và kiểm tra

Đã mở và liệt kê các gói nguồn đã được người dùng cung cấp:

- `jx1m-clean-source.tar.gz`: bản Go 0.4.0 ban đầu; có `main.go`, `exp.go`, `items.go`, `skills.go`, `level.go`, `go.mod`, `go.sum`, `server.log` và hai tệp SQLite sidecar `game.db-wal`, `game.db-shm`.
- `jx1m-clean-unified-source-dev.tar.gz`: bản hợp nhất phát triển; bổ sung `world.go`, `skill_combat.go`, scripts kiểm thử và client Cocos scaffold.
- `jx1m-clean-v040-server-patched.tar.gz`: gói server 0.4.0 đã vá, không chứa client Cocos.

Đã lập một bản import sạch trong môi trường kiểm toán, chỉ gồm source Go, module manifests, scripts, tài liệu và scaffold Cocos. Bản sạch loại bỏ `data/`, database sidecars, log và binary. SHA-256 của gói import sạch:
`7c5572fab36f0547d70ee176686b725c0b40cb855ced17b4ddfe4515eccb85ab`

## 2. Kết quả kiểm tra cục bộ

- 7 tệp Go trong bản hợp nhất đều được `gofmt` phân tích cú pháp thành công.
- Chưa chạy được `go test ./...`: môi trường kiểm toán có Go 1.23.2, trong khi `go.mod` yêu cầu Go 1.26.0; môi trường hiện tại không truy cập được `proxy.golang.org` để tải toolchain.
- Gói nguồn không có bộ unit test Go rõ ràng.
- GitHub Actions trước đó báo `success` cho kiểm tra tài liệu; bước Go đã bị bỏ qua vì chưa có `server/go.mod`. Không được hiểu kết quả đó là server đã build hoặc test thành công.

## 3. Thành phần server tìm thấy

- HTTP API + SQLite.
- Đăng ký/đăng nhập, token phiên, danh sách 10 môn phái và tạo nhân vật.
- Thuộc tính, điểm tiềm năng, điểm kỹ năng, EXP/cấp độ.
- 30 kỹ năng khởi tạo; kỹ năng chủ động, hồi chiêu và tiêu hao MP ở mức prototype.
- Quái vật, đánh thường, hồi sinh, túi đồ và hai vật phẩm ban đầu.
- Dữ liệu 3 bản đồ thử nghiệm, 4 NPC, 2 nhiệm vụ, 3 trang bị mẫu và bảng rơi vật phẩm.
- Server mặc định bind `127.0.0.1:8083`; cần reverse proxy HTTPS trên VPS khi triển khai từ Internet.

## 4. Các vấn đề cần giải quyết trước khi phát hành

1. **Chưa phải MMORPG realtime:** chưa có WebSocket/world server, đồng bộ vị trí, trạng thái thế giới dùng chung, party, chat, PvP hoặc chống gian lận hoàn chỉnh.
2. **Quái đang theo từng nhân vật:** bảng `character_monsters` giữ HP quái theo cặp nhân vật/quái, không phải trạng thái quái dùng chung trong thế giới nhiều người chơi.
3. **Chưa có cân bằng gameplay được duyệt:** công thức sát thương, EXP `level*100`, cooldown, drop và chỉ số đang là công thức thử nghiệm.
4. **Bảo mật production chưa đủ:** cần rate-limit đăng nhập/đăng ký, quản lý và thu hồi session, chính sách CORS, HTTPS, logging an toàn, backup/restore, giới hạn payload nhất quán và kiểm thử quyền sở hữu trên mọi endpoint.
5. **Cần kiểm thử transaction/migration:** schema được khởi tạo bằng nhiều lệnh `CREATE/ALTER`; cần kiểm thử database trống, nâng cấp từ các phiên bản cũ và chạy init lặp lại.
6. **Client chưa phải Cocos project hoàn chỉnh:** `client-cocos/package.json` có script build chỉ in hướng dẫn mở Cocos Creator 3.8.x. Scaffold chưa có bằng chứng về scene Editor hoàn chỉnh, project settings, sprite/animation, input gameplay hoặc Android build.
7. **Endpoint client còn placeholder:** `ApiClient.baseURL` hiện là `https://YOUR_GAME_DOMAIN`; chưa được thay bằng domain HTTPS thực tế.
8. **Chưa có APK phát hành:** chưa build, chưa cài lên OPPO và chưa chạy kiểm thử end-to-end.

## 5. Quy tắc dữ liệu

- Không đưa `game.db-wal`, `game.db-shm`, `server.log`, database cá nhân, token, mật khẩu hoặc binary APK vào repository.
- Không ghi đè các thư mục server hiện có trên VPS.
- Tạo database mới trong môi trường staging; backup và xác minh trước mọi thao tác dữ liệu.
- Chỉ dùng tài nguyên hình ảnh/âm thanh có giấy phép phù hợp hoặc tự tạo; không sao chép tài nguyên độc quyền của EFUN.

## 6. Cấu hình CI mới

Workflow `.github/workflows/jx1m-integration-checks.yml` đã được nâng cấp để khi `server/go.mod` xuất hiện sẽ:
- cài đúng Go version theo `server/go.mod`;
- chạy `go mod download`, `go test ./...`, `go vet ./...`, `go build`;
- khởi chạy server trong thư mục dữ liệu CI tạm;
- gọi health endpoint và chạy smoke test API.

Khi chưa có source trong `server/`, workflow chỉ báo notice rõ ràng và không giả vờ rằng Go tests đã chạy.

## Kết luận

Bản Go hiện là nền tảng gameplay/API prototype đáng để tiếp tục, nhưng chưa đủ điều kiện gọi là game online nhiều người chơi hoàn chỉnh hoặc tạo APK phát hành. Việc tiếp theo là nhập source sạch vào repository, chạy CI bằng Go 1.26.0, sửa lỗi được CI phát hiện, rồi mới hoàn thiện Cocos project và triển khai staging.
