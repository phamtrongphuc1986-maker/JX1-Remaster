# Điều kiện build Android — JX1 Remaster

Cập nhật: 28/11/2026

## Kết luận cho môi trường hiện tại

Máy triển khai đang có là VPS Ubuntu truy cập qua trình duyệt, 4 CPU, 8 GB RAM, 32 GB đĩa; thiết bị kiểm thử là OPPO Reno 13F 5G. Hiện chưa có máy Windows/macOS có Cocos Creator Editor.

Không được tuyên bố có thể build APK chỉ bằng cách chạy TypeScript hoặc Go trên VPS. Cocos Creator 3.8 có quy trình build Android riêng, cần project Cocos Creator hợp lệ, cấu hình Android SDK/NDK và JDK, sau đó hoàn tất native compile. Tài liệu chính thức hướng dẫn command-line publish với ví dụ macOS/Windows và lưu ý Cocos Creator vẫn cần môi trường GUI khi chạy command-line. Chưa xác minh được quy trình Cocos Creator 3.8 build Android headless trên VPS Ubuntu hiện tại.

## Yêu cầu kỹ thuật cần chuẩn bị

- Cocos Creator 3.8.x project hoàn chỉnh, có scene được lưu và asset metadata hợp lệ.
- Android SDK, Android NDK và JDK 17 theo bảng tương thích của Cocos Creator 3.8.
- ABI mục tiêu: `arm64-v8a`.
- Package name dự kiến: `com.cuongchien.online`.
- Cần hoàn tất native Android compile; việc Cocos Creator export project không tự động chứng minh APK đã build thành công.
- APK chỉ được coi là bàn giao khi có artifact tải được, checksum, cài đặt thành công và kiểm thử trên OPPO.

## Đường dẫn tài liệu chính thức

- Command-line publish: https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html
- Native Android build: https://docs.cocos.com/creator/3.8/manual/en/editor/publish/native-options.html
- Android build options và ABI: https://docs.cocos.com/creator/3.8/manual/en/editor/publish/android/build-options-android.html
- Thiết lập SDK/NDK/JDK: https://docs.cocos.com/creator/3.8/manual/en/editor/publish/setup-native-development.html

## Quyết định an toàn

1. Không cài phần mềm dung lượng lớn lên VPS hoặc thay đổi hệ thống đang chạy nếu chưa xác minh dung lượng và đường lui.
2. Không dùng dịch vụ build trả phí hoặc thuê máy khác nếu chưa có sự đồng ý.
3. Không đưa keystore, mật khẩu ký APK, token hoặc file database vào Git.
4. Tiếp tục hoàn thiện và kiểm thử server trên GitHub Actions; phần Cocos/Android chỉ chuyển sang build khi có môi trường build tương thích đã xác minh.
5. Không phát hành APK giả lập hoặc APK rỗng chỉ để đánh dấu hoàn thành.
