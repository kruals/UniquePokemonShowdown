"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const register = async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User_1.default.findOne({ username });
        if (existingUser)
            return res.status(400).json({ error: "Имя пользователя занято" });
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = new User_1.default({ username, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: "Регистрация успешна" });
    }
    catch (err) {
        res.status(500).json({ error: "Ошибка сервера при регистрации" });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User_1.default.findOne({ username });
        if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
            return res.status(400).json({ error: "Неверный логин или пароль" });
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { username: user.username, rating: user.rating } });
    }
    catch (err) {
        res.status(500).json({ error: "Ошибка сервера при входе" });
    }
};
exports.login = login;
