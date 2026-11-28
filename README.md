# JX1M Clean + JX1 Remaster

Dự án MMORPG online phong cách JX1, dùng **Go** cho game server và **Cocos Creator 3.x** cho client Android.

> **Trạng thái: ĐÃ NHẬP SOURCE GỐC — CHƯA PHẢI BẢN PHÁT HÀNH.**
> Nhánh làm việc: `integration/jx1m-clean-monorepo`. Nhánh `main` được giữ nguyên.

## Source hiện có

- `server/`: source Go JX1M Clean 0.4.0, module `jx1m-clean-v040`, yêu cầu Go 1.26.0. Có API đăng ký/đăng nhập, 10 môn phái, tạo nhân vật, thuộc tính, EXP, kỹ năng, quái, chiến đấu và túi đồ.
- `client/cocos/package.json`: manifest project mục tiêu Cocos Creator 3.8.x.
- `client/cocos/assets/scripts/`: TypeScript trong Assets, gồm bản đồ, nhân vật, chiến đấu, túi đồ, bootstrap, luồng tài khoản và REST world client.
- `client/cocos/assets/scenes/Main.scene`: scene serialized gắn component `JX1GameEntry`, có generator và CI kiểm tra object references.
- `server/world.go`: trạng thái thế giới chung, di chuyển/cổng bản đồ, snapshot người chơi/quái và chiến đấu authoritative.
- `client/cocos/assets/resources/maps/`: JSON bản đồ thử nghiệm 20x20, tile 64x32.
- `client/cocos/assets/resources/maps/` và `client/cocos/data/maps/`: hai bản đồ thử nghiệm 20x20.
- `server/scripts/smoke-test.sh`: kiểm tra các API hiện có trên database thử nghiệm.

## Những phần chưa hoàn thành

- Main.scene và metadata đã được tạo, nhưng chưa được mở bằng Cocos Creator Editor để xác nhận import/compile/runtime.
- Chưa có domain, HTTPS certificate, reverse proxy hoặc staging; server chưa được triển khai ra VPS.
- World sync hiện dùng REST polling 1 giây, chưa có WebSocket hay load test.
- Kỹ năng K/L, AUTO, túi đồ và AI quái chưa được chuyển hết sang server authoritative.
- Chưa kiểm thử đồng thời hai thiết bị Android; chưa kiểm tra giao diện trên OPPO.
- Còn thiếu sprite, animation, VFX, âm thanh và asset có license.
- Nhiệm vụ, NPC, trang bị, bang hội, Tống–Kim, chống gian lận và vận hành máy chủ cần tiếp tục phát triển.
- Chưa có APK/AAB đã build và cài thử.


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

Xem [hướng dẫn project Cocos, scene và API](docs/COCOS_PROJECT_SETUP_VI.md), [chuẩn bị HTTPS server](server/HTTPS_DEPLOYMENT_VI.md), [báo cáo kiểm kê/tích hợp](docs/INTEGRATION_AUDIT_VI.md) và [phân tích phần client còn thiếu](docs/CLIENT_GAP_ANALYSIS_VI.md). Xem thêm [điều kiện và giới hạn build Android hiện tại](docs/ANDROID_BUILD_LIMITATIONS_VI.md). Xem thêm [rà soát an toàn API server](docs/SECURITY_REVIEW_VI.md).
