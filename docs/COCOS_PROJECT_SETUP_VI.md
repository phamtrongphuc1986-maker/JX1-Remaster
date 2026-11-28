# Project Cocos Creator — hướng dẫn mở và chạy thử

Cập nhật: 28/11/2026

## 1. Cấu trúc project

Thư mục `client/cocos/` hiện có:
- `package.json`: manifest project, phiên bản mục tiêu Cocos Creator 3.8.
- `assets/scripts/`: mã TypeScript nằm trong thư mục Assets để Creator import.
- `assets/resources/maps/`: JSON bản đồ được tải bằng `resources.load('maps/...')`.
- `scripts/`: bản nguồn prototype giữ nguyên để đối chiếu, không phải vị trí import chính thức của project.
- `.gitignore`: loại trừ cache, build output, cấu hình máy cá nhân và khóa ký Android.

Cocos Creator import các file trong `assets` và tự sinh metadata `.meta` trong lần mở project. Không tự viết UUID giả cho các script.

## 2. Tạo scene chạy thử

Cocos Creator lưu scene dưới dạng asset riêng. Để tránh commit một file scene tự dựng sai schema/UUID, scene đầu tiên phải được tạo và lưu bằng Editor:

1. Mở Cocos Dashboard, chọn **Open Other** (hoặc Open Project).
2. Chọn thư mục `client/cocos` trong repository.
3. Chờ Creator import xong các script trong `assets/scripts`.
4. Trong Assets, nhấp phải `assets` → Create → Scene; đặt tên `Main` và lưu tại `assets/scenes/Main.scene`.
5. Chọn node Scene gốc trong Hierarchy.
6. Inspector → Add Component → tìm `JX1GameEntry` → thêm component.
7. Lưu scene. Trong Build, chọn `Main.scene` làm Start Scene.

Component `JX1GameEntry` tự tạo Camera orthographic, World node và gắn `MapTestScene`. Bản đồ đầu vào là `map_001_village_test`; dữ liệu tài nguyên nằm ở `assets/resources/maps`.

## 3. Kiểm tra prototype

- Chạy Preview trong Creator.
- Kiểm tra bản đồ isometric, joystick, nút đánh, AUTO, túi đồ và chuyển map.
- Mở Console và xử lý mọi lỗi TypeScript/import/resource trước khi build.
- Script hiện vẽ nhân vật/quái bằng Graphics; đây là hình khối prototype, chưa phải sprite/animation art hoàn chỉnh.

## 4. Kết nối API

Client có `assets/scripts/network/GameApi.ts`, bao gồm các endpoint REST hiện tồn tại:
- đăng ký, đăng nhập, danh sách môn phái;
- danh sách/tạo nhân vật, đọc và cộng thuộc tính;
- danh sách/học/nâng kỹ năng;
- danh sách quái, đánh quái, hồi sinh;
- túi đồ và sử dụng vật phẩm.

Ví dụ khởi tạo:

```ts
import { GameApi } from './network/GameApi';

const api = new GameApi('https://YOUR-STAGING-HOST');
const login = await api.login(username, password);
if (login.ok && login.data) {
    // Token được giữ trong bộ nhớ của GameApi.
    const characters = await api.listCharacters();
}
```

Thay `https://YOUR-STAGING-HOST` bằng URL HTTPS staging thực tế sau khi backend được triển khai và kiểm tra. Không dùng `127.0.0.1` trên điện thoại để trỏ tới VPS; địa chỉ đó là chính điện thoại. Server hiện trong source bind `127.0.0.1:8083`, chưa mở ra Internet và chưa có HTTPS/reverse proxy. Không kết nối client ra ngoài cho tới khi có staging an toàn.

API client không lưu token vào localStorage và không tự gửi mật khẩu ngoài request đăng nhập/đăng ký.

## 5. Những phần chưa hoàn thành

- File scene `Main.scene` do Editor tạo và lưu: chưa có trong Git ở thời điểm tài liệu này viết.
- Chưa mở project trong Cocos Creator Editor để xác nhận import/compile TypeScript.
- Chưa có sprite/tileset/animation/VFX/audio có license.
- Chưa có đồng bộ realtime WebSocket; GameApi chỉ là REST client cho các API hiện có.
- Chưa build APK/AAB hoặc cài lên OPPO.

## Tài liệu Cocos Creator 3.8

- [Project structure / Hello World](https://docs.cocos.com/creator/3.8/manual/en/getting-started/helloworld.html)
- [Scene assets](https://docs.cocos.com/creator/3.8/manual/en/asset/scene.html)
- [Creating and adding scripts to a Scene node](https://docs.cocos.com/creator/3.8/manual/en/scripting/setup.html)
- [Android native build setup](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/setup-native-development.html)
