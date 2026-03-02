// Храним socketId по userId (MongoDB _id)
export const onlineUsers = new Map<string, string>(); // userId → socketId

// Для фронтенда нужны имена — храним отдельно
export const userIdToUsername = new Map<string, string>(); // userId → username

export const getOnlineUsers = () =>
    Array.from(userIdToUsername.entries()).map(([id, username]) => ({ id, username }));