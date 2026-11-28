# JX1M Clean + JX1 Remaster

Dự án MMORPG online phong cách JX1, dùng **Go** cho game server và **Cocos Creator 3.x** cho client Android.

> **Trạng thái: ĐANG TÍCH HỢP — CHƯA PHẢI BẢN PHÁT HÀNH.**
> Nhánh làm việc: `integration/jx1m-clean-monorepo`. Nhánh `main` được giữ nguyên.

## Kiến trúc mục tiêu

- `server/`: Go API, xác thực, nhân vật, môn phái, thuộc tính, EXP, kỹ năng, quái, vật phẩm, nhiệm vụ và thế giới.
- `client/cocos/`: project Cocos Creator hoàn chỉnh, giao diện, bản đồ isometric, điều khiển nhân vật, hiệu ứng và kết nối API.
- `database/`: schema và migration; không commit database người chơi.
- `deployment/`: cấu hình triển khai VPS Ubuntu, reverse proxy HTTPS và service.
- `tests/`: unit, integration, API smoke và kiểm thử gameplay.
- `android/`: cấu hình build APK/AAB ARM64 và hướng dẫn cài OPPO.

## Nguồn đang được bảo toàn

- Client prototype và dữ liệu bản đồ hiện có trong repository.
- Server Go JX1M Clean 0.4.0 từ gói source do chủ dự án cung cấp; đang được kiểm kê trước khi đưa vào cấu trúc chuẩn.
- Không lấy mã/tài nguyên độc quyền từ game bên thứ ba.

## Nguyên tắc an toàn

1. Không sửa hoặc xóa `main` trong giai đoạn tích hợp.
2. Không ghi đè thư mục server đang chạy trên VPS.
3. Không commit token, mật khẩu, khóa riêng, file SQLite hoặc log có dữ liệu nhạy cảm.
4. Chỉ dùng tài nguyên tự tạo hoặc có giấy phép sử dụng phù hợp.
5. Không dùng dịch vụ trả phí khi chưa có đồng ý.
6. Chỉ coi APK hoàn thành sau khi build thành công, cài đặt và kiểm thử trên thiết bị thật.

## Trạng thái và kế hoạch

Xem [báo cáo kiểm kê/tích hợp](docs/INTEGRATION_AUDIT_VI.md).