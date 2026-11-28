# Hướng dẫn bàn giao Codex — nhập source JX1M Clean

Tài liệu này dùng khi Codex có quyền truy cập workspace đã clone repository. Không chạy lệnh trên VPS production trong bước nhập source.

## Thông tin cố định

- Repository: `https://github.com/phamtrongphuc1986-maker/JX1-Remaster`
- Branch làm việc: `integration/jx1m-clean-monorepo`
- Không commit trực tiếp lên `main`.
- Gói nguồn sạch do ChatGPT chuẩn bị: `JX1M-Clean-Source-Import.tar.gz`
- SHA-256: `21e2f6d6df85fbc9e6932fc35772890db7a00e407d5b4f287c806a5cbc9761d6`

## Prompt thực hiện cho Codex

> Bạn đang làm việc trên repository JX1 Remaster. Hãy kiểm tra `git status` trước; không ghi đè thay đổi chưa commit của người dùng. Checkout hoặc tạo branch `integration/jx1m-clean-monorepo` từ remote branch cùng tên. Không thao tác trên `main`.
>
> Tìm file `JX1M-Clean-Source-Import.tar.gz` do người dùng cung cấp. Xác minh SHA-256 đúng bằng `21e2f6d6df85fbc9e6932fc35772890db7a00e407d5b4f287c806a5cbc9761d6`. Nếu sai hoặc không tìm thấy thì dừng và báo rõ.
>
> Giải nén vào thư mục tạm, kiểm tra danh sách trước khi copy. Nhập các tệp `*.go`, `go.mod`, `go.sum` vào `server/`; nhập `scripts/` vào `server/scripts/`; nhập `client-cocos/` vào `client/cocos/`. Giữ nguyên README hiện có; lưu README từ gói nhập với tên `UPSTREAM_README_VI.md` để tránh ghi đè.
>
> TUYỆT ĐỐI không nhập thư mục `data/`, SQLite database/WAL/SHM, log, APK hoặc secret. Không dùng database từ máy chủ cũ. Không thay đổi cấu hình production.
>
> Sau khi nhập: chạy gofmt; xác minh `go.mod` yêu cầu Go 1.26.0; dùng toolchain Go 1.26.0 để chạy `go test ./...`, `go vet ./...`, `go build`. Nếu có lỗi, sửa và bổ sung test có ý nghĩa; không hạ phiên bản Go chỉ để né lỗi. Chạy smoke test API trên database tạm, không dùng dữ liệu production.
>
> Kiểm tra client Cocos: xác định rõ đây mới là scaffold, không tự tuyên bố đã có project Editor hoặc APK. Kiểm tra các component, API route và endpoint placeholder. Không tạo asset vi phạm bản quyền. Chỉ tạo cấu trúc project Cocos Creator 3.x có thể mở được nếu xác minh được đúng định dạng phiên bản; không tạo file giả.
>
> Cập nhật README và audit theo kết quả thực tế. Commit lên đúng branch tích hợp, push branch, đợi GitHub Actions. Nếu CI đỏ thì đọc log, sửa và push lại. Báo lại commit SHA, danh sách file, kết quả test/build và những phần còn thiếu. Không deploy VPS, không merge vào main, không phát hành APK nếu chưa có sự chấp thuận rõ ràng.

## Lệnh kiểm tra thủ công sau khi Codex hoàn tất

- GitHub branch: `integration/jx1m-clean-monorepo`
- GitHub Actions: workflow `JX1M integration checks`
- Điều kiện tối thiểu: Go tests + vet + build + API smoke test đều PASS.
- APK chỉ được coi là hoàn thành khi có artifact APK từ build Android ARM64 và đã cài/chạy được trên thiết bị thật.
