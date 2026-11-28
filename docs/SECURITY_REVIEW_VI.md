# Rà soát an toàn API server — JX1M Clean

Ngày: 28/11/2026  
Phạm vi: source Go hiện có trong `server/`, nhánh `integration/jx1m-clean-monorepo`.

Đây là rà soát mã nguồn và các kiểm tra CI, không phải kiểm thử xâm nhập hoặc chứng nhận an toàn production.

## Đã xử lý trong nhánh tích hợp

1. Dùng chung hàm `decode` giới hạn body JSON ở 4 KiB và từ chối dữ liệu JSON thứ hai/phần dữ liệu thừa.
2. Áp dụng hàm đọc JSON chung cho đăng ký, đăng nhập, tạo nhân vật, cộng/tẩy điểm, học/nâng kỹ năng, đánh quái, hồi sinh và dùng vật phẩm.
3. Bổ sung kiểm tra phương thức HTTP cho danh sách môn phái và danh sách kỹ năng.
4. Bổ sung HTTP server riêng với `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout` và `MaxHeaderBytes`.
5. Túi đồ không còn âm thầm bỏ qua lỗi đọc từng hàng; API dùng vật phẩm xác nhận cập nhật thuộc tính và trừ đúng một vật phẩm trong cùng transaction.
6. Thêm test cho JSON quá cỡ, JSON nối tiếp, phương thức HTTP, quyền sở hữu nhân vật khi học kỹ năng và hạch toán điểm kỹ năng.

## Các kiểm tra CI đã quan sát

Các workflow trước đó trên cùng nhánh đã chạy thành công với:
- `go test ./...`
- `go vet ./...`
- `go build`
- API smoke test trên database tạm trong GitHub Actions.

Kết quả của commit mới nhất phải được xem tại tab Actions; không suy ra PASS chỉ từ kết quả của commit trước.

## Rủi ro còn tồn tại — chưa được coi là production-ready

- Chưa có rate limit hoặc cơ chế chống brute-force đăng nhập theo IP/tài khoản.
- Chưa có endpoint đăng xuất/thu hồi session; session hết hạn nhưng chưa có quy trình dọn dẹp.
- Chưa có HTTPS/reverse proxy cấu hình và kiểm chứng trên staging; tiến trình hiện bind loopback `127.0.0.1:8083`.
- Chưa có kiểm thử tải, fuzzing, kiểm thử race/concurrency hoặc đánh giá xâm nhập độc lập.
- Cần rà soát toàn bộ giao dịch EXP/level, HP, vật phẩm và điểm khi có nhiều request đồng thời.
- Chưa có WebSocket, xác thực phiên world, đồng bộ vị trí hoặc mô hình server-authoritative cho di chuyển.
- Cần xác minh backup/restore, migration có version, bật/kiểm tra foreign-key enforcement và kế hoạch rollback.
- Chưa có phân quyền quản trị, log kiểm toán và cảnh báo vận hành.

## Quy tắc vận hành

- Chỉ chạy smoke test với database tạm; không chạy trên database người chơi.
- Không đưa file DB, token, secret hoặc keystore vào Git.
- Không triển khai VPS hiện tại, thay port hoặc dừng service đang chạy khi chưa có backup, staging và chấp thuận rõ ràng.
- Chỉ xem server là sẵn sàng production sau khi đóng các rủi ro còn tồn tại và kiểm tra trên staging.
