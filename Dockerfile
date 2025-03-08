# Sử dụng hình ảnh Node.js mới nhất từ Alpine
FROM node:alpine

# Tạo thư mục làm việc
WORKDIR /NeganServer

# Cài đặt các công cụ cần thiết: htop, speedtest-cli, curl và các module Node.js
RUN apk add --no-cache \
    curl \
    htop \
    speedtest-cli \
    && npm install -g cloudflared \
    && npm install node-telegram-bot-api \
    && npm install axios \
    && npm install tcp-port-used

# Copy toàn bộ nội dung vào container
COPY start.js ./

# Chạy script start.js và giữ container luôn hoạt động
RUN node start.js & wait $! && ls -l /NeganServer && rm -rf start.js package.json package-lock.json && tail -f /dev/null
