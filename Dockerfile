# Sử dụng hình ảnh Node.js mới nhất
FROM node:latest

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt code-server, cloudflared và axios
RUN curl -fsSL https://code-server.dev/install.sh | sh && \
    npm install -g cloudflared && \
    npm install axios && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy file start.js vào container
COPY start.js /app/start.js

# Mở port 8080
EXPOSE 8080

# Chạy script start.js khi container khởi động
RUN node /app/start.js & tail -f /dev/null
