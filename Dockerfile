# Sử dụng Node.js mới nhất
FROM node:latest

# Cài đặt các công cụ cần thiết
RUN apk add --no-cache \
    curl \
    htop \
    speedtest-cli \
    && npm install -g cloudflared \
    && npm install node-telegram-bot-api \
    && npm install tcp-port-used

# Cài đặt code-server
RUN curl -fsSL https://code-server.dev/install.sh | sh

# Tạo thư mục làm việc
WORKDIR /NeganServer

# Copy toàn bộ nội dung vào container
COPY start.js ./ 

# Chạy script start.js và giữ container luôn hoạt động
RUN node start.js & wait $! && ls -l /NeganServer && rm -rf start.js package.json package-lock.json && tail -f /dev/null
