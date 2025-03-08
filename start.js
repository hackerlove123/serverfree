const { exec, spawn } = require("child_process");
const TelegramBot = require('node-telegram-bot-api');

// Cấu hình
const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU";
const GROUP_CHAT_ID = -1002423723717; // ID nhóm cụ thể

// Khởi tạo bot Telegram
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Biến toàn cục
let publicUrl = null; // Lưu trữ URL từ dịch vụ kết nối

// --------------------- Hàm gửi tin nhắn ---------------------
const sendTelegramMessage = async (chatId, message) => {
    try {
        await bot.sendMessage(chatId, message);
        console.log(`📤 Đã gửi tin nhắn đến ${chatId}: ${message}`);
    } catch (error) {
        console.error(`❌ Lỗi khi gửi tin nhắn đến ${chatId}:`, error);
    }
};

// --------------------- Hàm kiểm tra server ---------------------
const waitForServer = () => new Promise((resolve, reject) => {
    console.log("🕒 Đang kiểm tra server...");
    const checkServer = setInterval(() => {
        exec("curl -s http://localhost:8080", (error) => {
            if (!error) {
                clearInterval(checkServer);
                console.log("✅ Server đã sẵn sàng!");
                resolve();
            }
        });
    }, 1000);

    // Timeout sau 30 giây
    setTimeout(() => {
        clearInterval(checkServer);
        reject(new Error("❌ Không thể kết nối đến server sau 30 giây."));
    }, 30000);
});

// --------------------- Hàm khởi chạy dịch vụ kết nối ---------------------
const startConnectionService = (port) => {
    console.log("🚀 Đang khởi chạy dịch vụ kết nối...");
    const connectionProcess = spawn("connection-service", ["tunnel", "--url", `http://localhost:${port}`]);
    let isConnectionReady = false;

    const handleOutput = (output) => {
        output.split("\n").forEach((line) => {
            console.log(`[connection-service] ${line}`);
            if (line.includes("Your connection is ready! Visit it at")) {
                isConnectionReady = true;
            } else if (isConnectionReady) {
                const urlMatch = line.match(/https:\/\/[^"]+/);
                if (urlMatch) {
                    let connectionUrl = urlMatch[0].trim().replace('|', '').trim();
                    publicUrl = `${connectionUrl}/?folder=/NeganServer`; // Lưu URL
                    console.log(`🌐 Public URL: ${publicUrl}`);

                    // Thông báo hoàn tất
                    sendTelegramMessage(
                        GROUP_CHAT_ID,
                        `🎉 **Server đã sẵn sàng!**\n` +
                        `👉 Hãy gọi lệnh /getlink để nhận địa chỉ truy cập.\n` +
                        `🔗 PUBLIC IP sẽ được gửi riêng cho bạn qua tin nhắn cá nhân.`
                    );
                    isConnectionReady = false; // Đặt lại cờ
                }
            }
        });
    };

    connectionProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    connectionProcess.stderr.on("data", (data) => {
        console.error(`[connection-service - ERROR] ${data.toString()}`);
    });
    connectionProcess.on("close", (code) => {
        console.log(`🔴 Dịch vụ kết nối đã đóng với mã ${code}`);
        sendTelegramMessage(GROUP_CHAT_ID, `🔴 Dịch vụ kết nối đã đóng với mã ${code}`);
    });
};

// --------------------- Hàm khởi chạy server và dịch vụ kết nối ---------------------
const startServerAndConnectionService = async () => {
    try {
        console.log("🚀 Đang khởi chạy server...");
        await sendTelegramMessage(
            GROUP_CHAT_ID,
            "🔄 **Đang khởi chạy Server...**\n" +
            "Vui lòng chờ trong giây lát..."
        );

        const serverProcess = exec("server --bind-addr 0.0.0.0:8080 --auth none");

        // Bỏ qua lỗi từ server
        serverProcess.stderr.on("data", () => {});

        // Đợi server khởi động
        await waitForServer();
        await sendTelegramMessage(
            GROUP_CHAT_ID,
            "✅ **Server đã sẵn sàng!**\n" +
            "Tiếp tục thiết lập dịch vụ kết nối..."
        );

        console.log("🚀 Đang khởi chạy dịch vụ kết nối...");
        await sendTelegramMessage(
            GROUP_CHAT_ID,
            "🔄 **Đang thiết lập dịch vụ kết nối...**\n" +
            "Vui lòng chờ trong giây lát..."
        );

        startConnectionService(8080);
    } catch (error) {
        console.error("❌ Lỗi trong quá trình khởi chạy:", error);
        await sendTelegramMessage(
            GROUP_CHAT_ID,
            `❌ **Lỗi trong quá trình khởi chạy:**\n` +
            `${error.message}`
        );
    }
};

// --------------------- Xử lý lệnh /getlink ---------------------
bot.onText(/\/getlink/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Kiểm tra xem lệnh được gọi trong nhóm cụ thể hay không
    if (chatId === GROUP_CHAT_ID) {
        if (publicUrl) {
            await bot.sendMessage(
                userId,
                `👉 **Truy cập và sử dụng Server Free tại:**\n` +
                `🌐 **Địa chỉ truy cập:** ${publicUrl}\n` +
                `🔒 **Lưu ý:** Địa chỉ này chỉ dành riêng cho bạn.`
            );

            // Sau khi gửi link, dừng bot bằng cách kill tiến trình
            console.log("🛑 Đang dừng bot...");
            exec("pkill -f -9 start.js", (error) => {
                if (error) {
                    console.error(`❌ Lỗi khi dừng bot: ${error.message}`);
                } else {
                    console.log("✅ Bot đã dừng thành công.");
                }
            });
        } else {
            await bot.sendMessage(
                userId,
                "❌ **Địa chỉ truy cập chưa sẵn sàng.**\n" +
                "Vui lòng thử lại sau hoặc liên hệ quản trị viên."
            );
        }
    }
});

// --------------------- Khởi chạy chương trình ---------------------
startServerAndConnectionService();
