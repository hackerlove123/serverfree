const { exec, spawn } = require("child_process");
const axios = require("axios");

const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU";
const CHAT_ID = "7371969470";

// Hàm gửi tin nhắn qua Telegram
const sendTelegramMessage = async (message) => {
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: message });
        console.log("Tin nhắn đã được gửi thành công!");
    } catch (error) {
        console.error("Lỗi khi gửi tin nhắn:", error);
    }
};

// Kiểm tra xem code-server đã sẵn sàng chưa
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

// Khởi chạy Cloudflare Tunnel
const startCloudflaredTunnel = (port) => {
    const cloudflaredProcess = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`]);

    cloudflaredProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[cloudflared] ${output}`);

        const urlMatch = output.match(/https:\/\/[^"]+/);
        if (urlMatch) {
            let tunnelUrl = urlMatch[0].replace('|', '').trim();
            const finalUrl = `${tunnelUrl}/?folder=/NeganServer`;
            console.log(`🌐 URL: ${finalUrl}`);
            sendTelegramMessage(`👉 Truy cập và sử dụng Server Free tại 👇\n🌐 Public URL: ${finalUrl}`);
        }
    });

    cloudflaredProcess.stderr.on("data", (data) => console.error(`[cloudflared] Error: ${data.toString()}`));
    cloudflaredProcess.on("close", (code) => {
        console.log(`Cloudflared đã đóng với mã ${code}`);
        sendTelegramMessage(`🔴 CLF đã đóng với mã ${code}`);
    });
};

// Khởi chạy code-server và Cloudflare Tunnel
const startCodeServerAndCloudflared = async () => {
    try {
        console.log("Đang khởi chạy code-server...");
        await sendTelegramMessage("🔄 Đang khởi chạy Server...");

        exec("code-server --bind-addr 0.0.0.0:8080 --auth none", (err, stdout, stderr) => {
            if (stderr) {
                console.error(`Lỗi khi chạy code-server: ${stderr}`);
            }
        });

        await waitForCodeServer();
        console.log("✅ code-server đã sẵn sàng!");
        await sendTelegramMessage("✅ Server đã sẵn sàng");

        console.log("Đang khởi chạy Cloudflare Tunnel...");
        await sendTelegramMessage("🔄 Setup gói cài đặt phụ thuộc Vui lòng đợi...");
        startCloudflaredTunnel(8080);

    } catch (error) {
        console.error("Lỗi trong quá trình khởi chạy:", error);
        sendTelegramMessage(`❌ Lỗi trong quá trình khởi chạy: ${error.message}`);
    }
};

// Khởi chạy
startCodeServerAndCloudflared();
