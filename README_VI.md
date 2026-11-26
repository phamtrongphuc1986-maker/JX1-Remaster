# JX1 Remaster

Dự án MMORPG 2D isometric độc lập, dùng Cocos Creator 3.8.6 và tài nguyên tự tạo hoặc có giấy phép.

## Cấu trúc hiện tại
- `assets/scripts/`: mã nguồn bản đồ, nhân vật, chiến đấu, quái vật, túi đồ và dịch chuyển.
- `assets/resources/maps/`: hai bản đồ thử nghiệm.
- `docs/`: tài liệu thiết kế, ghi chú và danh sách việc còn thiếu.
- `.github/workflows/`: workflow Android APK chạy trên self-hosted runner.

## Trạng thái
Đây là bước chuẩn hóa cấu trúc nguồn. Chưa được coi là bản game hoàn chỉnh hoặc sẵn sàng phát hành. Chưa có scene Cocos Creator `assets/scenes/Main.scene`, prefab/UI hoàn chỉnh, bộ hình ảnh/âm thanh, server multiplayer hoặc đủ dữ liệu 7 thành và 14 địa danh.

## Nguyên tắc
- Không dùng asset độc quyền trích xuất từ game EFUN.
- Không dùng WebView giả lập game Cocos.
- Chưa build APK cho đến khi scene, tài nguyên, toolchain và kiểm thử đạt.
- Không phát sinh dịch vụ trả phí nếu chưa được chủ dự án đồng ý.

## Build
Xem `docs/BUILD_SETUP_UBUNTU_VI.md`. Workflow chỉ chạy khi VPS đã đăng ký GitHub Actions self-hosted runner và cài đúng Cocos Creator CLI, JDK, Android SDK/NDK.
