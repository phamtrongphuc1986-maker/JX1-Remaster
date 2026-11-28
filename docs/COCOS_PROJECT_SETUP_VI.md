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

## 2. Scene Main

Project đã có:
- `assets/scenes/Main.scene`: scene asset serialized có SceneAsset, Scene root và node `JX1GameEntry`.
- `assets/scenes/Main.scene.meta`: metadata scene.
- `assets/scripts/JX1GameEntry.ts.meta`: UUID ổn định cho component bootstrap.
- `tools/generate-cocos-main-scene.mjs`: generator có thể chạy lại để tái tạo scene.
- CI kiểm tra JSON scene, các tham chiếu object và component bootstrap.

Scene root gắn `JX1GameEntry`. Khi chạy, component tạo Camera orthographic, World node, `MapTestScene` và Canvas UI. `apiBaseUrl` phải là URL HTTPS khi kết nối server từ xa.

**Giới hạn xác minh:** scene đã được tạo và kiểm tra cấu trúc tự động, nhưng chưa được mở/lưu lại bằng Cocos Creator Editor 3.8.0 và chưa xác nhận import runtime. Tài liệu Cocos mô tả việc tạo/lưu scene và gắn script qua Editor; cần Editor tương thích để xác nhận cuối cùng.

## 3. Kiểm tra prototype

- Chạy Preview trong Creator.
- Kiểm tra bản đồ isometric, joystick, nút đánh, AUTO, túi đồ và chuyển map.
- Mở Console và xử lý mọi lỗi TypeScript/import/resource trước khi build.
- Script hiện vẽ nhân vật/quái bằng Graphics; đây là hình khối prototype, chưa phải sprite/animation art hoàn chỉnh.

## 4. Kết nối HTTPS và API thế giới

Client `GameApi.ts` hiện gọi:
- API tài khoản, môn phái, nhân vật và thuộc tính.
- `GET /api/world/snapshot?character_id=...`: trạng thái nhân vật, người chơi cùng bản đồ và quái vật.
- `POST /api/world/move`: gửi một bước di chuyển; server kiểm tra ô bản đồ, vật cản, đi chéo, tốc độ và cổng bản đồ.
- `POST /api/world/attack`: server xác định tầm đánh, sát thương, quái phản công, EXP, lên cấp và hồi sinh quái.

Trong chế độ online, `MapTestScene` lấy snapshot khoảng mỗi giây, gửi di chuyển và tấn công lên server. HP quái được lưu chung theo bản đồ nên nhiều tài khoản cùng nhìn thấy cùng một trạng thái quái. Client không chạy AI quái hay tự tính kết quả đánh trong chế độ này. Kỹ năng K/L và AUTO đang tắt trong online mode cho đến khi có API kỹ năng do server xử lý.

Đây là đồng bộ REST polling 1 giây cho prototype, **chưa phải WebSocket** và chưa phù hợp để khẳng định khả năng chịu tải MMORPG đông người.

### Chính sách HTTPS

- Server mặc định bind `127.0.0.1:8083`.
- Nếu đặt `JX1_ADDR` thành địa chỉ public mà không cấu hình cả `JX1_TLS_CERT_FILE` và `JX1_TLS_KEY_FILE`, server từ chối khởi động.
- Có thể giữ Go server ở localhost và đặt reverse proxy Caddy/Nginx xử lý HTTPS.
- `JX1_ALLOWED_ORIGINS` là danh sách origin phân cách bằng dấu phẩy cho web preview; không dùng wildcard.
- Client từ chối HTTP từ xa; chỉ cho HTTP localhost trong phát triển.

Ví dụ Caddyfile khi đã có domain và DNS trỏ đúng VPS:

```caddy
game.example.com {
    reverse_proxy 127.0.0.1:8083
}
```

Đây chỉ là mẫu cấu hình, chưa triển khai. Chưa có domain, certificate hoặc HTTPS staging được cấp và kiểm thử. Không mở cổng hoặc chạy trên VPS production trong bước này.

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

API client không lưu token vào localStorage và không tự gửi mật khẩu ngoài request đăng nhập/đăng ký. UI hiện chưa có chức năng quên mật khẩu, đổi mật khẩu hoặc thu hồi phiên.

## 5. Những phần chưa hoàn thành

- Cocos Creator Editor chưa được chạy; scene JSON và metadata mới qua kiểm tra cấu trúc trong CI. Chưa xác nhận Editor import, TypeScript compile hoặc chạy preview.
- Chưa kiểm thử EditBox, joystick, đồng bộ hai tài khoản và chiến đấu trên Android/OPPO thật.
- Chưa có domain, TLS certificate, reverse proxy hoặc HTTPS staging; server chưa được triển khai ra Internet.
- Chưa có WebSocket; đồng bộ hiện tại dùng REST polling mỗi giây.
- Kỹ năng K/L, AUTO, túi đồ và các hệ thống cũ chưa được chuyển toàn bộ sang authoritative online API.
- Chưa có AI quái di chuyển theo server tick, NPC tương tác, bang hội, nhiệm vụ, Tống–Kim hay kiểm thử tải/anti-cheat.
- Chưa có sprite/tileset/animation/VFX/audio có license.
- Chưa build APK/AAB hoặc cài lên OPPO.

VPS Ubuntu hiện tại không có Cocos Creator Editor Linux chính thức trong gói 3.8 mà project đang nhắm tới. Vì vậy chưa thể xác nhận giao diện chạy trên OPPO chỉ bằng các bước CI Ubuntu. Cần một môi trường Windows/macOS có Creator tương thích hoặc thử nghiệm build trên Windows runner trước khi coi phần này hoàn tất.

## Tài liệu Cocos Creator 3.8

- [Project structure / Hello World](https://docs.cocos.com/creator/3.8/manual/en/getting-started/helloworld.html)
- [Scene assets](https://docs.cocos.com/creator/3.8/manual/en/asset/scene.html)
- [Creating and adding scripts to a Scene node](https://docs.cocos.com/creator/3.8/manual/en/scripting/setup.html)
- [Android native build setup](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/setup-native-development.html)
