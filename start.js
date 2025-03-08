const { exec, spawn } = require("child_process");
const TelegramBot = require('node-telegram-bot-api');
const tcpPortUsed = require('tcp-port-used');

// Cấu hình
const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU"; // Thay thế bằng token của bạn
const GROUP_CHAT_ID = -1002423723717; // Thay thế bằng ID nhóm của bạn

// Khởi tạo bot Telegram
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Biến toàn cục
let publicUrl = null;
let isReady = false;
let PORT = null;

// --------------------- Hàm gửi tin nhắn ---------------------
const sendMessage = async (chatId, message) => {
    try {
        await bot.sendMessage(chatId, message);
        console.log("📤 Tin nhắn đã được gửi thành công!");
    } catch (error) {
        console.error("❌ Lỗi khi gửi tin nhắn:", error);
    }
};

// --------------------- Hàm kiểm tra port trống ---------------------
const findAvailablePort = async () => {
    for (let port = 1024; port <= 65535; port++) {
        if (!(await tcpPortUsed.check(port, '127.0.0.1'))) return port;
    }
    throw new Error("❌ Không tìm thấy port trống.");
};

// --------------------- Hàm kiểm tra server ---------------------
const waitForServer = () => new Promise((resolve, reject) => {
    console.log("🕒 Đang kiểm tra server...");
    const interval = setInterval(() => {
        exec(`curl -s http://localhost:${PORT}`, (error) => {
            if (!error) {
                clearInterval(interval);
                console.log("✅ Server đã sẵn sàng!");
                resolve();
            }
        });
    }, 1000);

    setTimeout(() => {
        clearInterval(interval);
        reject(new Error("❌ Không thể kết nối đến server sau 30 giây."));
    }, 30000);
});

// --------------------- Hàm khởi chạy Tunnel với tunnelmole ---------------------
const startTunnel = (port) => {
    console.log("🚀 Đang khởi chạy Tunnel với tunnelmole...");
    const tunnelProcess = spawn("tunnelmole", [port.toString()]);

    const handleOutput = (output) => {
        console.log(`[tunnelmole] ${output}`);

        // Kiểm tra xem đầu ra có chứa cột "Your Tunnelmole Public URLs" không
        if (output.includes("Your Tunnelmole Public URLs are below and are accessible internet wide")) {
            // Tìm dòng chứa URL https://
            const urlLine = output.split("\n").find((line) => line.startsWith("https://"));
            if (urlLine) {
                // Trích xuất URL từ dòng
                const urlMatch = urlLine.match(/https:\/\/[^\s]+/);
                if (urlMatch) {
                    publicUrl = urlMatch[0].trim();
                    console.log(`🌐 Public URL: ${publicUrl}`);
                    sendMessage(GROUP_CHAT_ID, `🎉 **Server đã sẵn sàng!**\n👉 Hãy gọi lệnh /getlink để nhận Public URL.\n🔗 URL sẽ được gửi riêng cho bạn qua tin nhắn cá nhân.`);
                    isReady = true;
                }
            }
        }
    };

    tunnelProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.stderr.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.on("close", (code) => {
        console.log(`🔴 Tunnel đã đóng với mã ${code}`);
        sendMessage(GROUP_CHAT_ID, `🔴 Tunnel đã đóng với mã ${code}`);
    });
};

// --------------------- Hàm khởi chạy server và Tunnel ---------------------
const startServerAndTunnel = async () => {
    try {
        PORT = await findAvailablePort();
        console.log(`🚀 Đang khởi chạy server trên port ${PORT}...`);
        await sendMessage(GROUP_CHAT_ID, "🔄 Đang khởi chạy SERVICES...");

        const serverProcess = spawn("code-server", ["--bind-addr", `0.0.0.0:${PORT}`, "--auth", "none"]);
        serverProcess.stderr.on("data", () => {});

        await waitForServer();
        console.log("✅ Server đã sẵn sàng!");
        await sendMessage(GROUP_CHAT_ID, "✅ SERVER đã sẵn sàng");

        console.log("🚀 Đang khởi chạy Tunnel với tunnelmole...");
        await sendMessage(GROUP_CHAT_ID, "🔄 Đang thiết lập đường hầm kết nối...");

        startTunnel(PORT);
    } catch (error) {
        console.error("❌ Lỗi trong quá trình khởi chạy:", error);
        await sendMessage(GROUP_CHAT_ID, `❌ Lỗi trong quá trình khởi chạy: ${error.message}`);
    }
};

// --------------------- Xử lý lệnh /getlink ---------------------
bot.onText(/\/getlink/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (isReady && chatId === GROUP_CHAT_ID) {
        if (publicUrl) {
            await sendMessage(userId, `👉 Truy cập và sử dụng Server Free tại 👇\n🌐 Public URL: ${publicUrl}`);
            console.log("🛑 Đang dừng bot...");
            bot.stopPolling();
            console.log("✅ Bot đã dừng thành công!");
        } else {
            await sendMessage(userId, "❌ URL chưa sẵn sàng. Vui lòng thử lại sau.");
        }
    }
});

// --------------------- Khởi chạy chương trình ---------------------
startServerAndTunnel();
