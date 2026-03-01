// Храним ID сокетов по именам пользователей
export const onlineUsers = new Map<string, string>();

// Функция для получения списка имен (для фронтенда)
export const getOnlineUsernames = () => Array.from(onlineUsers.keys());