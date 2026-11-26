# Ghi chú nghiệm thu đợt tiếp theo

## Đã thêm vào nhánh làm việc
- SQLite: bảng accounts, characters, inventory (schema), player_sessions; WAL, foreign keys, lưu vị trí nhân vật.
- Đăng ký/đăng nhập prototype: username validation, scrypt password hash, HMAC token ký và session expiry.
- 21 layout bản đồ logic 20x20, tile legend, vùng chặn nước/tường, 4 cổng mỗi bản đồ; NPC prototype cho thành và địa danh.
- Bộ SVG gốc prototype: tile, nhân vật, quái, khung UI; kèm ghi chú giấy phép.

## Chưa được coi là hoàn thành
- Layout 21 bản đồ là thiết kế logic khởi đầu, chưa đối chiếu bản đồ địa lý/địa hình chuẩn và chưa được cân bằng, playtest.
- Sprite SVG hiện chỉ là placeholder tĩnh, chưa có sprite sheet animation đa hướng, hiệu ứng, âm thanh, prefab.
- Cần tạo Main.scene trong Cocos Creator Editor, gắn MapTestScene và cấu hình camera/canvas; không thể xác nhận scene chạy khi chưa mở Editor.
- Máy chủ mới lưu tài khoản/vị trí/session; inventory table chưa có API gameplay, chưa có combat authoritative, quest, economy, guild/chat, anti-cheat, backup automation hoặc production TLS.
- CI mới kiểm thử Node server; không phải kiểm thử Cocos Editor hay Android APK.
