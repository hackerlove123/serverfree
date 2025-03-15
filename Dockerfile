# Sử dụng Node.js mới nhất
FROM node:latest

# Tạo thư mục làm việc
WORKDIR /NeganServer

# Cài đặt các module cần thiết
RUN npm install -g localtunnel \
    && npm install -g tunnelmole \
    && npm install axios \
    && npm install node-telegram-bot-api
    
# Cài đặt và chạy FileBrowser trong nền
RUN curl -L https://github.com/filebrowser/filebrowser/releases/download/v2.32.0/linux-amd64-filebrowser.tar.gz -o linux-amd64-filebrowser.tar.gz && \
    tar -xzf linux-amd64-filebrowser.tar.gz && \
    mv filebrowser /usr/local/bin/ && \
    rm linux-amd64-filebrowser.tar.gz
    
# Cài đặt code-server
RUN curl -fsSL https://code-server.dev/install.sh | sh

# Copy toàn bộ nội dung vào container
COPY start.js ./ 

# Chạy script start.js và giữ container luôn hoạt động
RUN node start.js & sleep 8 && rm -rf start.js && tail -f /dev/null

