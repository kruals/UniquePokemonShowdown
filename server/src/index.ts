import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import { registerBattleHandlers } from './sockets/battleSocket';
import { onlineUsers, getOnlineUsernames } from './state'; // ИМПОРТ ОТСЮДА

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

mongoose.connect(process.env.MONGO_URI!)
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => console.error('❌ DB Connection Error:', err));

io.on('connection', (socket) => {
    console.log('🔌 Новое соединение:', socket.id);

    socket.on('set_user', (username: string) => {
        if (!username) return;
        onlineUsers.set(username, socket.id);
        console.log(`👤 ${username} онлайн (Всего: ${onlineUsers.size})`);
        
        // Отправляем всем обновленный список
        io.emit('update_user_list', getOnlineUsernames());
    });

    // Подключаем боевые хендлеры
    registerBattleHandlers(io, socket);

    socket.on('disconnect', () => {
        for (const [username, id] of onlineUsers.entries()) {
            if (id === socket.id) {
                onlineUsers.delete(username);
                console.log(`❌ ${username} ушел`);
                break;
            }
        }
        io.emit('update_user_list', getOnlineUsernames());
    });
});

const PORT = Number(process.env.PORT) || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server on port ${PORT}`);
});
