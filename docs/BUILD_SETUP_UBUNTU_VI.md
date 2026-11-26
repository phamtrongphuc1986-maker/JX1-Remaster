# Hướng dẫn chuẩn bị build Android trên Ubuntu VPS

## Chưa chạy build
Workflow chỉ được chạy sau khi dự án có scene Cocos Creator thật, tài nguyên cần thiết và kiểm thử qua Editor. Không dùng build để tạo APK giả.

## Điều kiện bắt buộc
1. Ubuntu x64 và GitHub Actions self-hosted runner đã đăng ký vào repository.
2. Runner có nhãn: `self-hosted`, `linux`, `x64`, `cocos-creator`, `android`.
3. Cocos Creator 3.8.6 Linux đã cài hợp lệ; biến môi trường `COCOS_CREATOR_CLI` trỏ đến file CLI thực thi.
4. JDK và Android SDK/NDK tương thích với phiên bản Cocos Creator; `ANDROID_SDK_ROOT` trỏ đúng SDK.
5. Có `assets/scenes/Main.scene`, scene khởi động đã cấu hình trong Editor, và các script đã được gắn vào Node đúng cách.
6. Tài nguyên nhân vật, bản đồ, UI, hiệu ứng và âm thanh cần thiết đã được cấp phép hoặc tự tạo.

## Cách hoạt động
Workflow `.github/workflows/android-apk-self-hosted.yml` chỉ có `workflow_dispatch`, không tự chạy khi commit. Nó kiểm tra toolchain và scene trước khi gọi script build. APK chỉ được công nhận khi GitHub Actions tạo artifact thực tế.

## Giới hạn VPS
VPS 4 CPU và khoảng 4.5 GiB RAM có thể thiếu bộ nhớ/đĩa cho Cocos Editor và Android build. Trước khi cài toolchain lớn, kiểm tra dung lượng còn trống và RAM; không tự nâng cấp VPS hoặc bật dịch vụ trả phí.
