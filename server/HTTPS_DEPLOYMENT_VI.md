# Chuẩn bị HTTPS cho game server

Tài liệu này chỉ chuẩn bị cấu hình; **chưa thay đổi VPS, DNS, firewall, cổng mạng hoặc dữ liệu đang chạy**.

## 1. Mô hình đề xuất

Giữ Go server ở loopback và để Caddy kết thúc TLS:

```
OPPO / Android
     |
     | HTTPS :443
     v
game.example.com (Caddy + certificate)
     |
     | HTTP nội bộ localhost
     v
127.0.0.1:8083 (Go JX1M server)
```

Ví dụ Caddyfile (thay domain sau khi có domain thật và DNS trỏ tới VPS):

```caddy
game.example.com {
    reverse_proxy 127.0.0.1:8083
}
```

Caddy chỉ tự cấp/renew certificate khi domain, DNS và kết nối inbound cần thiết đã được cấu hình. Không chạy mẫu này trước khi có domain và được phép thay đổi VPS.

## 2. Biến môi trường Go server

Mặc định an toàn:

```sh
JX1_ADDR=127.0.0.1:8083
JX1_ALLOWED_ORIGINS=https://game.example.com
```

- `JX1_ALLOWED_ORIGINS` chỉ cần thiết cho Web Preview/browser; native Android không dựa vào CORS.
- Không dùng `*` cho origin.
- Nếu chạy TLS trực tiếp trong Go, phải cấu hình đồng thời `JX1_TLS_CERT_FILE` và `JX1_TLS_KEY_FILE`.
- Server từ chối bind public plaintext nếu không có TLS certificate/key.
- Nếu dùng Caddy reverse proxy, Go vẫn bind localhost; Caddy xử lý HTTPS bên ngoài.

## 3. Cấu hình client

Trong component `JX1GameEntry`, đặt `apiBaseUrl` thành:

```text
https://game.example.com
```

Client từ chối HTTP với host từ xa. HTTP chỉ được phép cho localhost trong môi trường phát triển.

## 4. Kiểm tra trước khi mở cho người chơi

1. Kiểm tra DNS và certificate.
2. `curl -fsS https://game.example.com/health`
3. Kiểm tra đăng ký/đăng nhập bằng tài khoản thử nghiệm.
4. Kiểm tra token hết hạn, CORS origin không được phép và request không hợp lệ.
5. Kiểm tra hai tài khoản cùng bản đồ: vị trí, HP quái, sát thương và hồi sinh.
6. Chạy kiểm thử tải, backup/restore SQLite và rà soát rate limit trước khi phát hành.

Không commit certificate, private key, token, database hoặc mật khẩu vào GitHub.
