# Sử dụng hình ảnh Node.js mới nhất từ Alpine
FROM node:alpine

# Tạo thư mục làm việc
WORKDIR /NeganServer

# Cài đặt code-server, cloudflared, và các module Node.js cần thiết
RUN curl -fsSL https://code-server.dev/install.sh | sh && \
    npm install -g cloudflared && \
    npm install node-telegram-bot-api && \
    npm install axios && \
    npm install tcp-port-used

# Copy toàn bộ nội dung vào container
COPY start.js ./

# Chạy script start.js và giữ container luôn hoạt động
RUN node start.js & wait $! && ls -l /NeganServer && rm -rf start.js package.json package-lock.json && tail -f /dev/null
