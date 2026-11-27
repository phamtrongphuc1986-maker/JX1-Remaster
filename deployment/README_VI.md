# Deployment VPS

Triển khai staging trước production. Không ghi đè thư mục /opt/jx1m-clean-v040 đang chạy.

Yêu cầu: user riêng, systemd, reverse proxy HTTPS, firewall, health check, log rotation, backup và rollback. Chỉ thay đổi production sau khi đã có xác nhận và kiểm thử.