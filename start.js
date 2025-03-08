const { exec, spawn } = require("child_process");
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU";
const GROUP_CHAT_ID = -1002423723717; // ID nhóm cụ thể

// Khởi tạo bot Telegram
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Biến toàn cục để lưu trữ URL từ Cloudflare Tunnel
let publicUrl = null;

// Hàm gửi tin nhắn qua Telegram
const sendTelegramMessage = async (chatId, message) => {
    try {
        await bot.sendMessage(chatId, message);
        console.log("Tin nhắn đã được gửi thành công!");
    } catch (error) {
        console.error("Lỗi khi gửi tin nhắn:", error);
    }
};

// Hàm kiểm tra xem code-server đã sẵn sàng chưa
const waitForCodeServer = () => new Promise((resolve, reject) => {
    const checkServer = setInterval(() => {
        exec("curl -s http://localhost:8080", (error) => {
            if (!error) {
                clearInterval(checkServer);
                resolve();
            }
        });
    }, 1000);

    // Timeout sau 30 giây nếu code-server không khởi động được
    setTimeout(() => {
        clearInterval(checkServer);
        reject(new Error("Không thể kết nối đến code-server sau 30 giây."));
    }, 30000);
});

// Hàm khởi chạy Cloudflare Tunnel
const startCloudflaredTunnel = (port) => {
    const cloudflaredProcess = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);
    let isTunnelCreatedLine = false;

    const handleOutput = (output) => {
        output.split("\n").forEach((line) => {
            console.log(`[cloudflared] ${line}`);
            if (line.includes("Your quick Tunnel has been created! Visit it at")) {
                isTunnelCreatedLine = true;
            } else if (isTunnelCreatedLine) {
                const urlMatch = line.match(/https:\/\/[^"]+/);
                if (urlMatch) {
                    let tunnelUrl = urlMatch[0].trim();
                    // Xóa dấu '|' nếu có
                    tunnelUrl = tunnelUrl.replace('|', '').trim();
                    // Lưu trữ URL vào biến toàn cục
                    publicUrl = `${tunnelUrl}/?folder=/NeganServer`;
                    console.log(`🌐 URL: ${publicUrl}`);

                    // Gửi thông báo hoàn tất build và yêu cầu gọi /getlink
                    sendTelegramMessage(GROUP_CHAT_ID, "🔄 Đã hoàn tất build. Hãy gọi lệnh /getlink để nhận Public URL.");
                    isTunnelCreatedLine = false; // Đặt lại cờ
                }
            }
        });
    };

    cloudflaredProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    cloudflaredProcess.stderr.on("data", (data) => {
        console.error(`[cloudflared - ERROR] ${data.toString()}`);
    });
    cloudflaredProcess.on("close", (code) => {
        console.log(`Cloudflared đã đóng với mã ${code}`);
        sendTelegramMessage(GROUP_CHAT_ID, `🔴 CLF đã đóng với mã ${code}`);
    });
};

// Hàm khởi chạy code-server và Cloudflare Tunnel
const startCodeServerAndCloudflared = async () => {
    try {
        console.log("Đang khởi chạy code-server...");
        await sendTelegramMessage(GROUP_CHAT_ID, "🔄 Đang khởi chạy Server...");

        const codeServerProcess = exec("code-server --bind-addr 0.0.0.0:8080 --auth none");

        // Log lỗi từ code-server
        codeServerProcess.stderr.on("data", (data) => {
            console.error(`[code-server - ERROR] ${data.toString()}`);
        });

        // Đợi code-server khởi động thành công
        await waitForCodeServer();
        console.log("✅ code-server đã sẵn sàng!");
        await sendTelegramMessage(GROUP_CHAT_ID, "✅ Server đã sẵn sàng");

        console.log("Đang khởi chạy Cloudflare Tunnel...");
        await sendTelegramMessage(GROUP_CHAT_ID, "🔄 Đang setup các gói phụ thuộc...");

        startCloudflaredTunnel(8080);
    } catch (error) {
        console.error("Lỗi trong quá trình khởi chạy:", error);
        sendTelegramMessage(GROUP_CHAT_ID, `❌ Lỗi trong quá trình khởi chạy: ${error.message}`);
    }
};

// Xử lý lệnh /getlink
bot.onText(/\/getlink/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Kiểm tra xem lệnh được gọi trong nhóm cụ thể hay không
    if (chatId === GROUP_CHAT_ID) {
        if (publicUrl) {
            // Gửi tin nhắn riêng cho người dùng với URL từ Cloudflare
            await bot.sendMessage(userId, `👉 Truy cập và sử dụng Server Free tại 👇\n🌐 Public URL: ${publicUrl}`);
        } else {
            // Nếu URL chưa sẵn sàng, thông báo cho người dùng
            await bot.sendMessage(userId, "❌ URL chưa sẵn sàng. Vui lòng thử lại sau.");
        }
    }
});

// Khởi chạy mọi thứ
startCodeServerAndCloudflared();
