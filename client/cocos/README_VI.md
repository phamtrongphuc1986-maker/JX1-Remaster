# JX1 Remaster — Cocos Creator client

Mục tiêu project: Cocos Creator 3.8.x, Android ARM64, package dự kiến `com.cuongchien.online`.

## Project

- Mở trực tiếp thư mục `client/cocos` trong Cocos Creator Dashboard.
- TypeScript assets nằm trong `assets/scripts/`.
- Map JSON nằm trong `assets/resources/maps/`.
- `assets/scenes/Main.scene` đã được tạo với node gốc gắn `JX1GameEntry`; generator và CI kiểm tra cấu trúc scene/metadata.
- `JX1GameEntry` khởi tạo camera, map prototype và Canvas UI.
- `JX1GameEntry.apiBaseUrl` nhận URL HTTPS staging; để trống khi server chưa có HTTPS.
- `AuthFlowController` cung cấp đăng nhập/đăng ký, chọn môn phái, tạo nhân vật và vào thế giới online.
- `MapTestScene` đồng bộ snapshot mỗi giây, gửi di chuyển và đánh quái tới server; HP quái dùng chung theo bản đồ.
- Xem [hướng dẫn tạo scene, chạy thử và kết nối API](../../docs/COCOS_PROJECT_SETUP_VI.md).

Các file trong `scripts/` ở cấp root là bản nguồn prototype giữ lại để so sánh. Project Creator import từ `assets/`.

## Trạng thái

- Đã tạo Main.scene và metadata; CI kiểm tra cấu trúc JSON, UUID và object references. Chưa mở bằng Cocos Creator Editor để xác nhận runtime.
- REST world API đã có snapshot, movement, portal và combat do server quyết định. Client online tắt local monster AI, local damage và AUTO/K/L.
- Đồng bộ hiện là REST polling 1 giây, chưa phải WebSocket.
- Server mặc định chỉ bind localhost; public bind không TLS bị từ chối. Client bắt buộc HTTPS khi kết nối từ xa.
- Chưa có HTTPS staging, chưa deploy VPS, chưa test trên OPPO và chưa có APK/AAB.
- Cần kiểm thử Editor/Android thật, đồng bộ hai tài khoản, kiểm thử tải và hoàn thiện kỹ năng online trước phát hành.

Không đưa URL server thật, token, keystore hoặc database production vào repository. Không dùng asset của game thương mại khác nếu không có quyền sử dụng.
