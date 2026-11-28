# JX1 Remaster — Cocos Creator client

Mục tiêu project: Cocos Creator 3.8.x, Android ARM64, package dự kiến `com.cuongchien.online`.

## Project

- Mở trực tiếp thư mục `client/cocos` trong Cocos Creator Dashboard.
- TypeScript assets nằm trong `assets/scripts/`.
- Map JSON nằm trong `assets/resources/maps/`.
- Gắn component `JX1GameEntry` lên node gốc của scene mới để khởi tạo camera, map prototype và Canvas UI.
- `JX1GameEntry.apiBaseUrl` nhận URL HTTPS staging; để trống khi server chưa có HTTPS.
- `AuthFlowController` cung cấp đăng nhập/đăng ký, chọn môn phái, tạo nhân vật, chọn nhân vật và xác nhận vào bản đồ. Màn hình gọi `GameApi` qua REST.
- Xem [hướng dẫn tạo scene, chạy thử và kết nối API](../../docs/COCOS_PROJECT_SETUP_VI.md).

Các file trong `scripts/` ở cấp root là bản nguồn prototype giữ lại để so sánh. Project Creator import từ `assets/`.

## Trạng thái

Project manifest và thư mục Assets đã được tạo; các script hiện có đã được đưa vào Assets. Scene serialized vẫn cần được tạo/lưu bằng Cocos Creator Editor để Creator tự sinh metadata UUID hợp lệ. Đã có luồng UI và nối các request REST tương ứng trong mã nguồn. Chưa có xác nhận Editor import/compile hoặc kiểm thử EditBox trên Android. Scene serialized vẫn chưa được tạo/lưu bằng Editor; chưa có APK hoặc AAB. Server chưa có HTTPS staging nên chưa thể đăng nhập từ thiết bị thật.

Không đưa URL server thật, token, keystore hoặc database production vào repository. Không dùng asset của game thương mại khác nếu không có quyền sử dụng.
