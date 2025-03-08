const { exec, spawn } = require("child_process");
const TelegramBot = require('node-telegram-bot-api');

// Cấu hình
const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU"; // Thay thế bằng token của bạn
const GROUP_CHAT_ID = -1002423723717; // Thay thế bằng ID nhóm của bạn

// Khởi tạo bot Telegram
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Biến toàn cục
let publicUrl = null; // Lưu trữ URL từ Cloudflare Tunnel
let isReady = false; // Trạng thái bot đã sẵn sàng hay chưa

// --------------------- Hàm gửi tin nhắn ---------------------
const sendTelegramMessage = async (chatId, message) => {
    try {
        await bot.sendMessage(chatId, message);
        console.log("Tin nhắn đã được gửi thành công!");
    } catch (error) {
        console.error("Lỗi khi gửi tin nhắn:", error);
    }
};

// --------------------- Hàm kiểm tra code-server ---------------------
const waitForCodeServer = () => new Promise((resolve, reject) => {
    console.log("🕒 Đang kiểm tra code-server...");
    const checkServer = setInterval(() => {
        exec("curl -s http://localhost:8080", (error) => {
            if (!error) {
                clearInterval(checkServer);
                console.log("✅ Code-server đã sẵn sàng!");
                resolve();
            }
        });
    }, 1000);

    // Timeout sau 30 giây
    setTimeout(() => {
        clearInterval(checkServer);
        reject(new Error("Không thể kết nối đến code-server sau 30 giây."));
    }, 30000);
});

// --------------------- Hàm khởi chạy Cloudflare Tunnel ---------------------
const startCloudflaredTunnel = (port) => {
    console.log("🚀 Đang khởi chạy Cloudflare Tunnel...");
    const cloudflaredProcess = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);

    const handleOutput = (output) => {
        console.log(`[cloudflared] ${output}`); // Log toàn bộ đầu ra để debug

        // Kiểm tra xem đầu ra có chứa URL không
        if (output.includes("https://")) {
            const urlMatch = output.match(/https:\/\/[^\s]+/); // Trích xuất URL
            if (urlMatch) {
                publicUrl = `${urlMatch[0].trim()}/?folder=/NeganServer`; // Lưu URL
                console.log(`🌐 Public URL: ${publicUrl}`);

                // Gửi thông báo hoàn tất
                sendTelegramMessage(
                    GROUP_CHAT_ID,
                    `🎉 **Server đã sẵn sàng!**\n` +
                    `👉 Hãy gọi lệnh /getlink để nhận Public URL.\n` +
                    `🔗 URL sẽ được gửi riêng cho bạn qua tin nhắn cá nhân.`
                );

                isReady = true; // Đánh dấu bot đã sẵn sàng
            }
        }
    };

    cloudflaredProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    cloudflaredProcess.stderr.on("data", (data) => handleOutput(data.toString()));
    cloudflaredProcess.on("close", (code) => {
        console.log(`Cloudflared đã đóng với mã ${code}`);
        sendTelegramMessage(GROUP_CHAT_ID, `🔴 CLF đã đóng với mã ${code}`);
    });
};

// --------------------- Hàm khởi chạy code-server và Cloudflare Tunnel ---------------------
const startCodeServerAndCloudflared = async () => {
    try {
        console.log("🚀 Đang khởi chạy code-server...");
        await sendTelegramMessage(GROUP_CHAT_ID, "🔄 Đang khởi chạy Server...");

        const codeServerProcess = exec("code-server --bind-addr 0.0.0.0:8080 --auth none");

        // Bỏ qua lỗi từ code-server
        codeServerProcess.stderr.on("data", () => {});

        // Đợi code-server khởi động
        await waitForCodeServer();
        console.log("✅ Code-server đã sẵn sàng!");
        await sendTelegramMessage(GROUP_CHAT_ID, "✅ Server đã sẵn sàng");

        console.log("🚀 Đang khởi chạy Cloudflare Tunnel...");
        await sendTelegramMessage(GROUP_CHAT_ID, "🔄 Đang thiết lập Cloudflare Tunnel...");

        startCloudflaredTunnel(8080);
    } catch (error) {
        console.error("❌ Lỗi trong quá trình khởi chạy:", error);
        await sendTelegramMessage(GROUP_CHAT_ID, `❌ Lỗi trong quá trình khởi chạy: ${error.message}`);
    }
};

// --------------------- Xử lý lệnh /getlink ---------------------
bot.onText(/\/getlink/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Chỉ xử lý lệnh nếu bot đã sẵn sàng
    if (isReady && chatId === GROUP_CHAT_ID) {
        if (publicUrl) {
            await bot.sendMessage(
                userId,
                `👉 Truy cập và sử dụng Server Free tại 👇\n🌐 Public URL: ${publicUrl}`
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
                "❌ URL chưa sẵn sàng. Vui lòng thử lại sau."
            );
        }
    }
});

// --------------------- Khởi chạy chương trình ---------------------
startCodeServerAndCloudflared();
