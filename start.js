const { exec, spawn } = require("child_process");
const axios = require("axios");

const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU";
const CHAT_ID = "7371969470";

// Hàm gửi tin nhắn qua Telegram
const sendTelegramMessage = async (message) => {
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: message });
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

    setTimeout(() => {
        clearInterval(checkServer);
        reject(new Error("Không thể kết nối đến code-server sau 30 giây."));
    }, 30000);
});

// Hàm khởi chạy Cloudflare Tunnel
const startCloudflaredTunnel = (port) => {
    const cloudflaredProcess = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);
    let isTunnelCreatedLine = false;

    cloudflaredProcess.stdout.on("data", (data) => {
        const output = data.toString().split("\n");
        output.forEach((line) => {
            if (line.includes("Your quick Tunnel has been created! Visit it at")) {
                isTunnelCreatedLine = true;
            } else if (isTunnelCreatedLine) {
                const urlMatch = line.match(/https:\/\/[^"]+/);
                if (urlMatch) {
                    const tunnelUrl = urlMatch[0] + "/?folder=/NeganServer";  // Thêm "/?folder=/NeganServer" vào URL
                    const message = `👉 Truy cập và dụng Server Free tại 👇\n🌐 Public URL: ${tunnelUrl}`;
                    sendTelegramMessage(message);
                    isTunnelCreatedLine = false;
                }
            }
        });
    });

    cloudflaredProcess.stderr.on("data", (data) => {
        console.error(`[cloudflared] ${data.toString()}`);
    });

    cloudflaredProcess.on("close", (code) => {
        sendTelegramMessage(`🔴 Cloudflared đã đóng với mã ${code}`);
    });
};

// Hàm khởi chạy code-server và Cloudflare Tunnel
const startCodeServerAndCloudflared = async () => {
    try {
        await sendTelegramMessage("🔄 Đang khởi chạy code-server...");

        const codeServerProcess = exec("code-server --bind-addr 0.0.0.0:8080 --auth none");

        codeServerProcess.stderr.on("data", () => {}); // Bỏ qua lỗi từ code-server

        await waitForCodeServer();
        await sendTelegramMessage("✅ code-server đã sẵn sàng!");

        await sendTelegramMessage("🔄 Đang khởi chạy Cloudflare Tunnel...");
        startCloudflaredTunnel(8080);
    } catch (error) {
        console.error("Lỗi trong quá trình khởi chạy:", error);
        await sendTelegramMessage(`❌ Lỗi trong quá trình khởi chạy: ${error.message}`);
    }
};

// Khởi chạy mọi thứ
startCodeServerAndCloudflared();
