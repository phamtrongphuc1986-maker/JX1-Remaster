# Trạng thái thế giới và multiplayer

## Đã đưa vào nhánh
- Danh mục dữ liệu định danh 7 thành và 14 địa danh: `assets/resources/world/world_catalog.json`.
- 21 mẫu dữ liệu bản đồ isometric 20x20: `assets/resources/maps/world_map_templates.json`.

## Giới hạn dữ liệu bản đồ
Các mẫu này chỉ định nghĩa kích thước, layer, spawn mặc định và các mảng rỗng cho NPC/quái/cổng/vật cản. Chúng KHÔNG phải bản đồ hoàn chỉnh. Cần thiết kế địa hình, collision, lối ra, tọa độ NPC, khu quái, điểm lưu rương, đường đi và kiểm tra cân bằng từng bản đồ.

## Máy chủ
- Có WebSocket server mẫu trong `server/` với xác thực token HMAC, join map, snapshot, broadcast di chuyển, ping/pong, giới hạn tốc độ và health endpoint.
- Đây là prototype truyền trạng thái di chuyển; chưa có dịch vụ tài khoản phát hành token, lưu trữ bền vững, inventory/quest/combat authoritative, guild, chat moderation, chống gian lận hoặc TLS reverse proxy.
- Không mở máy chủ ra Internet công cộng trước khi hoàn thiện các lớp bảo mật và persistence.

## Việc cần kiểm thử
- Nhiều client vào cùng map, rời map và reconnect.
- Không cho client tự sửa HP/EXP/vật phẩm/tiền.
- Validate đường đi dựa trên dữ liệu collision thực của map.
- Kiểm tra tải 2/10/50/120 người chơi và hành vi mất mạng.
