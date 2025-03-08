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
    const tunnelProcess = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], { detached: true, stdio: 'pipe' });

    tunnelProcess.on('error', (err) => {
        console.error('Không thể khởi động tiến trình tunnel:', err);
    });

    tunnelProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[tunnel] ${output}`);
        if (output.includes("Your quick Tunnel has been created! Visit it at")) {
            const urlMatch = output.match(/https:\/\/[^\s]+/);
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
    });

    tunnelProcess.stderr.on("data", (data) => console.error(`[tunnel error] ${data.toString()}`));
    tunnelProcess.on("close", (code) => {
        console.log(`🔴 Tunnel đã đóng với mã ${code}`);
        sendTelegramMessage(GROUP_CHAT_ID, `🔴 Tunnel đã đóng với mã ${code}`);
    });
};

// Hàm khởi chạy server và Tunnel
const startServerAndTunnel = async () => {
    try {
        PORT = await findAvailablePort();
        console.log(`🚀 Đang khởi chạy server trên port ${PORT}...`);
        await sendTelegramMessage(GROUP_CHAT_ID, "🔄 Đang khởi chạy Server...");

        const serverProcess = spawn("code-server", ["--bind-addr", `0.0.0.0:${PORT}`, "--auth", "none"], { detached: true, stdio: 'pipe' });

        serverProcess.on('error', (err) => {
            console.error('Không thể khởi động tiến trình server:', err);
        });

        serverProcess.stdout.on('data', (data) => {
            console.log(`Server stdout: ${data}`);
        });

        serverProcess.stderr.on ('data', (data) => {
            console.error(`Server stderr: ${data}`);
        });

        await waitForServer();
        startTunnel(PORT);
    } catch (error) {
        console.error("❌ Lỗi trong quá trình khởi chạy server và tunnel:", error);
        await sendTelegramMessage(GROUP_CHAT_ID, `❌ Lỗi trong quá trình khởi chạy: ${error.message}`);
    }
};

// Bắt đầu quá trình
startServerAndTunnel();
