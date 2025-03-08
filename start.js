const { exec, spawn } = require("child_process");
const TelegramBot = require('node-telegram-bot-api');

// Cấu hình
const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU"; // Thay thế bằng token của bạn
const GROUP_CHAT_ID = -1002423723717; // Thay thế bằng ID nhóm của bạn

// Khởi tạo bot Telegram
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Biến toàn cục
let vscodeUrl = null, filebrowserUrl = null, isReady = false, tunnelPassword = null;

// --------------------- Hàm gửi tin nhắn ---------------------
const sendMessage = async (chatId, message) => {
    try { await bot.sendMessage(chatId, message); console.log(`📤 [${chatId}] Tin nhắn đã được gửi: ${message}`); }
    catch (error) { console.error(`❌ [${chatId}] Lỗi khi gửi tin nhắn:`, error); }
};

// --------------------- Hàm tạo cổng ngẫu nhiên từ 3000 đến 6999 ---------------------
const getRandomPort = () => Math.floor(Math.random() * 4000) + 3000;

// --------------------- Hàm kiểm tra server ---------------------
const waitForServer = (port, serviceName) => new Promise((resolve, reject) => {
    console.log(`🕒 [${serviceName}] Đang kiểm tra port ${port}...`);
    const interval = setInterval(() => {
        exec(`curl -s http://localhost:${port}`, (error) => {
            if (!error) { clearInterval(interval); console.log(`✅ [${serviceName}] Port ${port} đã sẵn sàng!`); resolve(); }
        });
    }, 1000);
    setTimeout(() => { clearInterval(interval); reject(new Error(`❌ [${serviceName}] Không thể kết nối đến port ${port} sau 30 giây.`)); }, 30000);
});

// --------------------- Hàm lấy mật khẩu từ localtunnel ---------------------
const getTunnelPassword = () => new Promise((resolve, reject) => {
    console.log("🔐 [localtunnel] Đang lấy mật khẩu...");
    exec("curl https://loca.lt/mytunnelpassword", (error, stdout, stderr) => {
        if (error) { console.error("❌ [localtunnel] Lỗi khi lấy mật khẩu:", stderr); reject(error); }
        else { tunnelPassword = stdout.trim(); console.log(`🔐 [localtunnel] Mật khẩu: ${tunnelPassword}`); resolve(); }
    });
});

// --------------------- Hàm khởi chạy localtunnel cho code-server ---------------------
const startVscodeTunnel = (port) => {
    console.log("🚀 [localtunnel] Đang khởi chạy cho code-server...");
    const subdomain = `neganconsoleserver${Math.floor(Math.random() * 1000)}`;
    const tunnelProcess = spawn("lt", ["--port", port.toString(), "--subdomain", subdomain]);

    const handleOutput = (output) => {
        console.log(`[localtunnel] ${output}`);
        if (output.includes("your url is:")) {
            const urlMatch = output.match(/https:\/\/[^\s]+/);
            if (urlMatch) {
                vscodeUrl = `${urlMatch[0].trim()}/?folder=/NeganServer`;
                console.log(`🌐 [localtunnel] Public URL (code-server): ${vscodeUrl}`);
                getTunnelPassword().then(() => {
                    sendMessage(GROUP_CHAT_ID, `🎉 **Server đã sẵn sàng!**\n👉 Hãy gọi lệnh /getlink để nhận Public URL.\n🔗 URL sẽ được gửi riêng cho bạn qua tin nhắn cá nhân.`);
                    isReady = true;
                }).catch((error) => { console.error("❌ [localtunnel] Lỗi khi lấy mật khẩu:", error); });
            }
        }
    };

    tunnelProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.stderr.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.on("close", (code) => { console.log(`🔴 [localtunnel] Đã đóng với mã ${code}`); sendMessage(GROUP_CHAT_ID, `🔴 [localtunnel] Đã đóng với mã ${code}`); });
};

// --------------------- Hàm khởi chạy tunnelmole cho filebrowser ---------------------
const startFilebrowserTunnel = (port) => {
    console.log("🚀 [tunnelmole] Đang khởi chạy cho filebrowser...");
    const tunnelProcess = spawn("tunnelmole", [port.toString()]);

    const handleOutput = (output) => {
        console.log(`[tunnelmole] ${output}`);
        if (output.includes("⟶")) {
            const urlMatch = output.match(/https:\/\/[^\s]+/);
            if (urlMatch) { filebrowserUrl = `${urlMatch[0].trim()}/files/`; console.log(`📁 [tunnelmole] Public URL (filebrowser): ${filebrowserUrl}`); }
        }
    };

    tunnelProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.stderr.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.on("close", (code) => { console.log(`🔴 [tunnelmole] Đã đóng với mã ${code}`); sendMessage(GROUP_CHAT_ID, `🔴 [tunnelmole] Đã đóng với mã ${code}`); });
};

// --------------------- Hàm khởi chạy server và các tunnel ---------------------
const startServerAndTunnels = async () => {
    try {
        const vscodePort = getRandomPort();
        console.log(`🚀 [code-server] Đang khởi chạy trên port ${vscodePort}...`);
        await sendMessage(GROUP_CHAT_ID, "🔄 Đang khởi chạy SERVICES...");

        const vscodeProcess = spawn("code-server", ["--bind-addr", `0.0.0.0:${vscodePort}`, "--auth", "none", "--disable-telemetry"]);
        vscodeProcess.stderr.on("data", () => {});

        await waitForServer(vscodePort, "code-server");
        console.log("✅ [code-server] Đã sẵn sàng!");
        await sendMessage(GROUP_CHAT_ID, "✅ [code-server] Đã sẵn sàng");

        startVscodeTunnel(vscodePort);

        const filebrowserPort = getRandomPort();
        console.log(`🚀 [filebrowser] Đang khởi chạy trên port ${filebrowserPort}...`);
        const filebrowserProcess = spawn("filebrowser", ["--port", filebrowserPort.toString(), "--address", "0.0.0.0", "--noauth"]);
        filebrowserProcess.stderr.on("data", () => {});

        await waitForServer(filebrowserPort, "filebrowser");
        console.log("✅ [filebrowser] Đã sẵn sàng!");

        startFilebrowserTunnel(filebrowserPort);
    } catch (error) {
        console.error("❌ Lỗi trong quá trình khởi chạy:", error);
        await sendMessage(GROUP_CHAT_ID, `❌ Lỗi trong quá trình khởi chạy: ${error.message}`);
    }
};

// --------------------- Xử lý lệnh /getlink ---------------------
bot.onText(/\/getlink/, async (msg) => {
    const chatId = msg.chat.id, userId = msg.from.id;
    if (isReady && chatId === GROUP_CHAT_ID) {
        const message = `👉 Truy cập và sử dụng Server Free tại 👇\n🌐 Public URL SERVER: ${vscodeUrl}\n🔒 Mật khẩu: ${tunnelPassword}\n📁 Manager File 👉 ${filebrowserUrl || "URL hoặc mật khẩu chưa sẵn sàng. Vui lòng thử lại sau. ❌"}`;
        await sendMessage(userId, message);
        console.log("🛑 Đang dừng bot..."); bot.stopPolling(); console.log("✅ Bot đã dừng thành công!");
    }
});

// --------------------- Khởi chạy chương trình ---------------------
startServerAndTunnels();
