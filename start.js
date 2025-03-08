const { exec, spawn } = require("child_process");
const TelegramBot = require('node-telegram-bot-api');

// Cấu hình
const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU";
const GROUP_CHAT_ID = -1002423723717; // ID nhóm cụ thể

// Khởi tạo bot Telegram
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Biến toàn cục
let publicUrl = null; // Lưu trữ URL từ Cloudflare Tunnel
let isReady = false; // Trạng thái bot đã sẵn sàng hay chưa

// --------------------- Hàm gửi tin nhắn ---------------------
const sendTelegramMessage = async (chatId, message) => {
    try {
        await bot.sendMessage(chatId, message);
        console.log(`📤 Đã gửi tin nhắn đến ${chatId}: ${message}`);
    } catch (error) {
        console.error(`❌ Lỗi khi gửi tin nhắn đến ${chatId}:`, error);
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
        reject(new Error("❌ Không thể kết nối đến code-server sau 30 giây."));
    }, 30000);
});

// --------------------- Hàm khởi chạy Cloudflare Tunnel ---------------------
const startCloudflaredTunnel = (port) => {
    console.log("🚀 Đang khởi chạy Cloudflare Tunnel...");
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
                    let tunnelUrl = urlMatch[0].trim().replace('|', '').trim();
                    publicUrl = `${tunnelUrl}/?folder=/NeganServer`; // Lưu URL
                    console.log(`🌐 Public URL: ${publicUrl}`);

                    // Thông báo hoàn tất
                    sendTelegramMessage(
                        GROUP_CHAT_ID,
                        `🎉 **Server đã sẵn sàng!**\n` +
                        `👉 Hãy gọi lệnh /getlink để nhận Public URL.\n` +
                        `🔗 URL sẽ được gửi riêng cho bạn qua tin nhắn cá nhân.`
                    );
                    isTunnelCreatedLine = false; // Đặt lại cờ
                    isReady = true; // Đánh dấu bot đã sẵn sàng
                }
            }
        });
    };

    cloudflaredProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    cloudflaredProcess.stderr.on("data", (data) => {
        console.error(`[cloudflared - ERROR] ${data.toString()}`);
    });
    cloudflaredProcess.on("close", (code) => {
        console.log(`🔴 Cloudflared đã đóng với mã ${code}`);
        sendTelegramMessage(GROUP_CHAT_ID, `🔴 Cloudflared đã đóng với mã ${code}`);
    });
};

// --------------------- Hàm khởi chạy code-server và Cloudflare Tunnel ---------------------
const startCodeServerAndCloudflared = async () => {
    try {
        console.log("🚀 Đang khởi chạy code-server...");
        await sendTelegramMessage(
            GROUP_CHAT_ID,
            "🔄 **Đang khởi chạy Server...**\n" +
            "Vui lòng chờ trong giây lát..."
        );

        const codeServerProcess = exec("code-server --bind-addr 0.0.0.0:8080 --auth none");

        // Bỏ qua lỗi từ code-server
        codeServerProcess.stderr.on("data", () => {});

        // Đợi code-server khởi động
        await waitForCodeServer();
        await sendTelegramMessage(
            GROUP_CHAT_ID,
            "✅ **Server đã sẵn sàng!**\n" +
            "Tiếp tục thiết lập Cloudflare Tunnel..."
        );

        console.log("🚀 Đang khởi chạy Cloudflare Tunnel...");
        await sendTelegramMessage(
            GROUP_CHAT_ID,
            "🔄 **Đang thiết lập Cloudflare Tunnel...**\n" +
            "Vui lòng chờ trong giây lát..."
        );

        startCloudflaredTunnel(8080);
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

    // Chỉ xử lý lệnh nếu bot đã sẵn sàng
    if (isReady && chatId === GROUP_CHAT_ID) {
        if (publicUrl) {
            await bot.sendMessage(
                userId,
                `👉 **Truy cập và sử dụng Server Free tại:**\n` +
                `🌐 **Public URL:** ${publicUrl}\n` +
                `🔒 **Lưu ý:** URL chỉ dành riêng cho bạn.`
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
                "❌ **URL chưa sẵn sàng.**\n" +
                "Vui lòng thử lại sau hoặc liên hệ quản trị viên."
            );
        }
    }
});

// --------------------- Khởi chạy chương trình ---------------------
startCodeServerAndCloudflared();
