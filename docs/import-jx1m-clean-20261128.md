# JX1 Remaster — Monorepo (nhánh integration/jx1m-clean-monorepo)

Đóng gói ngày 28/11/2026 từ hai nguồn chính thức của dự án:

- `server/` — Source Go của JX1M Clean **0.4.0** (lấy từ /opt/jx1m-clean-v040 trên VPS,
  đúng bản đang chạy cổng 8083): main.go, skills.go, level.go, exp.go, items.go,
  go.mod, go.sum. Module `jx1m-clean-v040`, yêu cầu Go 1.26.
  Không kèm database (data/game.db là dữ liệu production, không đưa vào repo).
- `client/cocos/` — Source Cocos Creator (TypeScript) lấy từ nhánh main của chính
  repo này, khôi phục cấu trúc thư mục gốc theo gói source 26/11/2026:
  scripts/ (gốc + character/ + combat/ + inventory/), assets/resources/maps/,
  data/maps/. Nội dung theo bản mới nhất trên main (gồm TeleportationSystem.ts
  và MapTestScene.ts bản C4.14.5).

## Kiểm tra server

```sh
cd server
gofmt -l .
go vet ./...
go test ./...
go build ./...
```

Smoke test chỉ chạy trên database thử nghiệm riêng (thư mục chạy tạm sẽ tự tạo
data/game.db mới), không dùng chung database production.

## Lưu ý

- Nhánh này chỉ để tích hợp; không sửa nhánh main.
- File "Gói JX1 Remaster Phase A V2.zip" ở thư mục gốc của main không đưa vào
  (file nhị phân, nội dung trùng với source Phase A đã có trong client/cocos/).
