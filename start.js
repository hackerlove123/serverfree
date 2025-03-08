const { exec } = require("child_process");
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

// Hàm gửi tin nhắn
const sendTelegramMessage = async (chatId, message) => {
    try {
        await bot.sendMessage(chatId, message);
        console.log("📤 Tin nhắn đã được gửi thành công!");
    } catch (error) {
        console.error("❌ Lỗi khi gửi tin nhắn:", error);
    }
};

// Hàm kiểm tra port trống
const findAvailablePort = async () => {
    let port = 1024;
    while (port <= 65535) {
        const isPortInUse = await tcpPortUsed.check(port, '127.0.0.1');
        if (!isPortInUse) return port;
        port++;
    }
    throw new Error("❌ Không tìm thấy port trống.");
};

// Hàm kiểm tra server
const waitForServer = () => new Promise((resolve, reject) => {
    console.log("🕒 Đang kiểm tra server...");
    const checkServer = setInterval(() => {
        exec(`curl -s http://localhost:${PORT}`, (error) => {
            if (!error) {
                clearInterval(checkServer);
                console.log("✅ Server đã sẵn sàng!");
                resolve();
            }
        });
    }, 1000);

    setTimeout(() => {
        clearInterval(checkServer);
        reject(new Error("❌ Không thể kết nối đến server sau 30 giây."));
    }, 30000);
});

// Hàm khởi chạy Tunnel
const startTunnel = (port) => {
    console.log("🚀 Đang khởi chạy Tunnel...");
    const command = `cloudflared tunnel --url http://localhost:${port}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Lỗi khi khởi chạy Tunnel: ${error.message}`);
            return;
        }

        if (stderr) {
            console.error(`[tunnel stderr] ${stderr}`);
        }

        if (stdout) {
            console.log(`[tunnel stdout] ${stdout}`);
            if (stdout.includes("Your quick Tunnel has been created! Visit it at")) {
                const urlMatch = stdout.match(/https:\/\/[^\s]+/);
                if (urlMatch) {
                    publicUrl = `${urlMatch[0].trim()}/?folder=/NeganServer`;
                    console.log(`🌐 Public URL: ${publicUrl}`);
                    sendTelegramMessage(
                        GROUP_CHAT_ID,
                        `🎉 **Server đã sẵn sàng!**\n` +
                        `👉 Hãy gọi lệnh /getlink để nhận Public URL.\n` +
                        `🔗 URL sẽ được gửi riêng cho bạn qua tin nhắn cá nhân.`
                    );
                    isReady = true;
                }
            }
        }
    });
};

// Hàm khởi chạy server và Tunnel
const startServerAndTunnel = async () => {
    try {
        PORT = await findAvailablePort();
        console.log(`🚀 Đang khởi chạy server trên port ${PORT}...`);
        await sendTelegramMessage(GROUP_CHAT_ID, "🔄 Đang khởi chạy Server...");

        const command = `code-server --bind-addr 0.0.0.0:${PORT} --auth none`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Lỗi khi khởi chạy server: ${error.message}`);
                return;
            }

            if (stderr) {
                console.error(`[server stderr] ${stderr}`);
            }

            if (stdout) {
                console.log(`[server stdout] ${stdout}`);
            }
        });

        await waitForServer();
        console.log("✅ Server đã sẵn sàng!");
        await sendTelegramMessage(GROUP_CHAT_ID, "✅ Server đã sẵn sàng");

        console.log("🚀 Đang khởi chạy Tunnel...");
        await sendTelegramMessage(GROUP_CHAT_ID, "🔄 Đang thiết lập Tunnel...");

        startTunnel(PORT);
    } catch (error) {
        console.error("❌ Lỗi trong quá trình khởi chạy:", error);
        await sendTelegramMessage(GROUP_CHAT_ID, `❌ Lỗi trong quá trình khởi chạy: ${error.message}`);
    }
};

// Xử lý lệnh /getlink
bot.onText(/\/getlink/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (isReady && chatId === GROUP_CHAT_ID) {
        if (publicUrl) {
            await bot.sendMessage(
                userId,
                `👉 Truy cập và sử dụng Server Free tại 👇\n🌐 Public URL: ${publicUrl}`
            );
            console.log("🛑 Đang dừng bot...");
            process.exit(0);
        } else {
            await bot.sendMessage(
                userId,
                "❌ URL chưa sẵn sàng. Vui lòng thử lại sau."
            );
        }
    }
});

// Khởi chạy chương trình
startServerAndTunnel();
