const { exec, spawn } = require("child_process");
const TelegramBot = require('node-telegram-bot-api');
const tcpPortUsed = require('tcp-port-used');

// Cấu hình
const BOT_TOKEN = "7828296793:AAEw4A7NI8tVrdrcR0TQZXyOpNSPbJmbGUU"; // Thay thế bằng token của bạn
const GROUP_CHAT_ID = -1002423723717; // Thay thế bằng ID nhóm của bạn

// Khởi tạo bot Telegram
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Biến toàn cục
let vscodeUrl = null;
let filebrowserUrl = null;
let isReady = false;
let vscodePort = null;
let filebrowserPort = null;
let tunnelPassword = null;

// --------------------- Hàm gửi tin nhắn ---------------------
const sendMessage = async (chatId, message) => {
    try {
        await bot.sendMessage(chatId, message);
        console.log("📤 Tin nhắn đã được gửi thành công!");
    } catch (error) {
        console.error("❌ Lỗi khi gửi tin nhắn:", error);
    }
};

// --------------------- Hàm tìm cổng trống trong khoảng 3000-6999 ---------------------
const findAvailablePort = async () => {
    for (let port = 3000; port <= 6999; port++) {
        if (!(await tcpPortUsed.check(port, '127.0.0.1'))) return port;
    }
    throw new Error("❌ Không tìm thấy port trống.");
};

// --------------------- Hàm kiểm tra server ---------------------
const waitForServer = (port) => new Promise((resolve, reject) => {
    console.log(`🕒 Đang kiểm tra server trên port ${port}...`);
    const interval = setInterval(() => {
        exec(`curl -s http://localhost:${port}`, (error) => {
            if (!error) {
                clearInterval(interval);
                console.log(`✅ Server trên port ${port} đã sẵn sàng!`);
                resolve();
            }
        });
    }, 1000);

    setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`❌ Không thể kết nối đến server trên port ${port} sau 30 giây.`));
    }, 30000);
});

// --------------------- Hàm lấy mật khẩu từ localtunnel ---------------------
const getTunnelPassword = () => new Promise((resolve, reject) => {
    console.log("🔐 Đang lấy mật khẩu từ localtunnel...");
    exec("curl https://loca.lt/mytunnelpassword", (error, stdout, stderr) => {
        if (error) {
            console.error("❌ Lỗi khi lấy mật khẩu:", stderr);
            reject(error);
        } else {
            tunnelPassword = stdout.trim();
            console.log(`🔐 Mật khẩu: ${tunnelPassword}`);
            resolve();
        }
    });
});

// --------------------- Hàm khởi chạy localtunnel cho code-server ---------------------
const startVscodeTunnel = (port) => {
    console.log("🚀 Đang khởi chạy localtunnel cho code-server...");
    const randomSuffix = Math.floor(Math.random() * 1000); // Tạo số ngẫu nhiên từ 0 đến 999
    const subdomain = `neganconsoleserver${randomSuffix}`;
    const tunnelProcess = spawn("lt", ["--port", port.toString(), "--subdomain", subdomain]);

    const handleOutput = (output) => {
        console.log(`[localtunnel] ${output}`);

        // Kiểm tra xem đầu ra có chứa URL không
        if (output.includes("your url is:")) {
            const urlMatch = output.match(/https:\/\/[^\s]+/);
            if (urlMatch) {
                vscodeUrl = `${urlMatch[0].trim()}/?folder=/NeganServer`;
                console.log(`🌐 Public URL (code-server): ${vscodeUrl}`);

                // Lấy mật khẩu và gửi thông báo hoàn tất
                getTunnelPassword().then(() => {
                    sendMessage(GROUP_CHAT_ID, `🎉 **Server đã sẵn sàng!**\n👉 Hãy gọi lệnh /getlink để nhận Public URL.\n🔗 URL sẽ được gửi riêng cho bạn qua tin nhắn cá nhân.`);
                    isReady = true;
                }).catch((error) => {
                    console.error("❌ Lỗi khi lấy mật khẩu:", error);
                });
            }
        }
    };

    tunnelProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.stderr.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.on("close", (code) => {
        console.log(`🔴 Tunnel (code-server) đã đóng với mã ${code}`);
        sendMessage(GROUP_CHAT_ID, `🔴 Tunnel (code-server) đã đóng với mã ${code}`);
    });
};

// --------------------- Hàm khởi chạy tunnelmole cho filebrowser ---------------------
const startFilebrowserTunnel = (port) => {
    console.log("🚀 Đang khởi chạy tunnelmole cho filebrowser...");
    const tunnelProcess = spawn("tunnelmole", [port.toString()]);

    const handleOutput = (output) => {
        console.log(`[tunnelmole] ${output}`);

        // Kiểm tra xem đầu ra có chứa URL không
        if (output.includes("Your Tunnelmole Public URLs are below and are accessible internet wide")) {
            const urlLine = output.split("\n").find((line) => line.startsWith("https://"));
            if (urlLine) {
                filebrowserUrl = urlLine.match(/https:\/\/[^\s]+/)[0].trim();
                console.log(`📁 Public URL (filebrowser): ${filebrowserUrl}`);
            }
        }
    };

    tunnelProcess.stdout.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.stderr.on("data", (data) => handleOutput(data.toString()));
    tunnelProcess.on("close", (code) => {
        console.log(`🔴 Tunnel (filebrowser) đã đóng với mã ${code}`);
        sendMessage(GROUP_CHAT_ID, `🔴 Tunnel (filebrowser) đã đóng với mã ${code}`);
    });
};

// --------------------- Hàm khởi chạy server và các tunnel ---------------------
const startServerAndTunnels = async () => {
    try {
        // Tìm cổng và khởi chạy code-server
        vscodePort = await findAvailablePort();
        console.log(`🚀 Đang khởi chạy code-server trên port ${vscodePort}...`);
        await sendMessage(GROUP_CHAT_ID, "🔄 Đang khởi chạy SERVICES...");

        const vscodeProcess = spawn("code-server", ["--bind-addr", `0.0.0.0:${vscodePort}`, "--auth", "none", "--disable-telemetry"]);
        vscodeProcess.stderr.on("data", () => {});

        await waitForServer(vscodePort);
        console.log("✅ code-server đã sẵn sàng!");
        await sendMessage(GROUP_CHAT_ID, "✅ code-server đã sẵn sàng");

        // Khởi chạy localtunnel cho code-server
        startVscodeTunnel(vscodePort);

        // Tìm cổng và khởi chạy filebrowser
        filebrowserPort = await findAvailablePort();
        console.log(`🚀 Đang khởi chạy filebrowser trên port ${filebrowserPort}...`);
        const filebrowserProcess = spawn("filebrowser", ["--port", filebrowserPort.toString(), "--address", "0.0.0.0", "--noauth"]);
        filebrowserProcess.stderr.on("data", () => {});

        await waitForServer(filebrowserPort);
        console.log("✅ filebrowser đã sẵn sàng!");

        // Khởi chạy tunnelmole cho filebrowser
        startFilebrowserTunnel(filebrowserPort);
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
        if (vscodeUrl && tunnelPassword && filebrowserUrl) {
            await sendMessage(userId, `👉 Truy cập và sử dụng Server Free tại 👇\n🌐 Public URL SERVER: ${vscodeUrl}\n🔒 Mật khẩu: ${tunnelPassword}\n📁 Manager File 👉 ${filebrowserUrl}`);
            console.log("🛑 Đang dừng bot...");
            bot.stopPolling();
            console.log("✅ Bot đã dừng thành công!");
        } else {
            await sendMessage(userId, `👉 Truy cập và sử dụng Server Free tại 👇\n🌐 Public URL SERVER: ${vscodeUrl || "URL hoặc mật khẩu chưa sẵn sàng. Vui lòng thử lại sau. ❌"}\n🔒 Mật khẩu: ${tunnelPassword || "ERROR ❌"}\n📁 Manager File 👉 ${filebrowserUrl || "URL hoặc mật khẩu chưa sẵn sàng. Vui lòng thử lại sau. ❌"}`);
        }
    }
});

// --------------------- Khởi chạy chương trình ---------------------
startServerAndTunnels();
