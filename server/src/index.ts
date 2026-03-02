import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import { registerBattleHandlers } from './sockets/battleSocket';
import { onlineUsers, userIdToUsername, getOnlineUsers } from './state';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', credentials: true } });

app.use(cors({ origin: process.env.CLIENT_URL, methods: ['GET', 'POST'], credentials: true }));
app.use(express.json());
app.use('/api/auth', authRoutes);

mongoose.connect(process.env.MONGO_URI!)
    .then(() => console.log('✅ MongoDB Connected!'))
    .catch(err => console.error('❌ DB Connection Error:', err));

io.on('connection', (socket) => {
    console.log('🔌 Новое соединение:', socket.id);

    // Фронтенд отправляет { userId, username } после логина
    socket.on('set_user', ({ userId, username }: { userId: string; username: string }) => {
        if (!userId || !username) return;

        onlineUsers.set(userId, socket.id);
        userIdToUsername.set(userId, username);

        console.log(`👤 ${username} (${userId}) онлайн. Всего: ${onlineUsers.size}`);
        io.emit('update_user_list', getOnlineUsers());
    });

    registerBattleHandlers(io, socket);

    socket.on('disconnect', () => {
        for (const [userId, id] of onlineUsers.entries()) {
            if (id === socket.id) {
                const username = userIdToUsername.get(userId);
                onlineUsers.delete(userId);
                userIdToUsername.delete(userId);
                console.log(`❌ ${username} (${userId}) ушёл`);
                break;
            }
        }
        io.emit('update_user_list', getOnlineUsers());
    });
});

const PORT = Number(process.env.PORT) || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server on port ${PORT}`);
    console.log(`📡 CORS Origin: ${process.env.CLIENT_URL}`);
});