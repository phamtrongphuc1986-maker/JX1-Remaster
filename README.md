# JX1M Clean + JX1 Remaster

Dự án MMORPG online phong cách JX1, dùng **Go** cho game server và **Cocos Creator 3.x** cho client Android.

> **Trạng thái: ĐÃ NHẬP SOURCE GỐC — CHƯA PHẢI BẢN PHÁT HÀNH.**
> Nhánh làm việc: `integration/jx1m-clean-monorepo`. Nhánh `main` được giữ nguyên.

## Source hiện có

- `server/`: source Go JX1M Clean 0.4.0, module `jx1m-clean-v040`, yêu cầu Go 1.26.0. Có API đăng ký/đăng nhập, 10 môn phái, tạo nhân vật, thuộc tính, EXP, kỹ năng, quái, chiến đấu và túi đồ.
- `client/cocos/scripts/`: TypeScript cho điều khiển nhân vật, hướng di chuyển, bản đồ isometric, chuyển bản đồ, quái, chiến đấu và túi đồ.
- `client/cocos/assets/resources/maps/` và `client/cocos/data/maps/`: hai bản đồ thử nghiệm 20x20.
- `server/scripts/smoke-test.sh`: kiểm tra các API hiện có trên database thử nghiệm.

## Những phần chưa hoàn thành

- Client chưa phải project Cocos Creator đầy đủ: còn thiếu cấu hình project/scene, sprite, animation, VFX, âm thanh và tích hợp API thực tế.
- Chưa có đồng bộ di chuyển/chiến đấu nhiều người chơi realtime qua WebSocket.
- Một số hệ thống MMORPG như nhiệm vụ, NPC, trang bị, bang hội, Tống–Kim và vận hành máy chủ cần tiếp tục phát triển.
- Chưa có APK/AAB đã build và kiểm thử trên OPPO.

## Nguyên tắc an toàn

1. Không sửa hoặc xóa nhánh `main` trong giai đoạn tích hợp.
2. Không ghi đè thư mục server đang chạy trên VPS.
3. Không commit token, mật khẩu, khóa riêng, file SQLite hoặc log có dữ liệu nhạy cảm.
4. Chỉ dùng tài nguyên tự tạo hoặc có giấy phép sử dụng phù hợp.
5. Không dùng dịch vụ trả phí khi chưa có đồng ý.
6. Chỉ coi APK hoàn thành sau khi build thành công, cài đặt và kiểm thử trên thiết bị thật.

## Kiểm tra

Từ thư mục `server/`:

```sh
go mod download
go test ./...
go vet ./...
go build ./...
```

Chỉ chạy `server/scripts/smoke-test.sh` với server/database thử nghiệm, không dùng database production.

Xem [báo cáo kiểm kê/tích hợp](docs/INTEGRATION_AUDIT_VI.md) và [phân tích phần client còn thiếu](docs/CLIENT_GAP_ANALYSIS_VI.md). Xem thêm [điều kiện và giới hạn build Android hiện tại](docs/ANDROID_BUILD_LIMITATIONS_VI.md).
