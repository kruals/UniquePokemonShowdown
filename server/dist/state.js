"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOnlineUsernames = exports.onlineUsers = void 0;
// Храним ID сокетов по именам пользователей
exports.onlineUsers = new Map();
// Функция для получения списка имен (для фронтенда)
const getOnlineUsernames = () => Array.from(exports.onlineUsers.keys());
exports.getOnlineUsernames = getOnlineUsernames;
