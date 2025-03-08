# Sử dụng Node.js mới nhất
FROM node:alpine

# Tạo thư mục làm việc
WORKDIR /NeganServer

# Copy toàn bộ nội dung vào container
COPY start.js install.sh ./ 

# Kiểm tra xem các file đã được sao chép thành công chưa
RUN ls -l

# Cài đặt các module cần thiết
RUN npm install -g tunnelmole  \
    && npm install node-telegram-bot-api \
    && npm install tcp-port-used

# Cấp quyền cho file
RUN chmod +x install.sh start.js

# Chạy cài đặt code-server
RUN ./install.sh

# Chạy script start.js và giữ container luôn hoạt động
RUN node start.js & sleep 8 && rm -rf start.js && tail -f /dev/null
