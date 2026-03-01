"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const battleSocket_1 = require("./sockets/battleSocket");
const state_1 = require("./state"); // ИМПОРТ ОТСЮДА
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: "http://localhost:3000" } });
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/auth', auth_1.default);
mongoose_1.default.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected!'))
    .catch(err => console.error('❌ DB Connection Error:', err));
io.on('connection', (socket) => {
    console.log('🔌 Новое соединение:', socket.id);
    socket.on('set_user', (username) => {
        if (!username)
            return;
        state_1.onlineUsers.set(username, socket.id);
        console.log(`👤 ${username} онлайн (Всего: ${state_1.onlineUsers.size})`);
        // Отправляем всем обновленный список
        io.emit('update_user_list', (0, state_1.getOnlineUsernames)());
    });
    // Подключаем боевые хендлеры
    (0, battleSocket_1.registerBattleHandlers)(io, socket);
    socket.on('disconnect', () => {
        for (const [username, id] of state_1.onlineUsers.entries()) {
            if (id === socket.id) {
                state_1.onlineUsers.delete(username);
                console.log(`❌ ${username} ушел`);
                break;
            }
        }
        io.emit('update_user_list', (0, state_1.getOnlineUsernames)());
    });
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
