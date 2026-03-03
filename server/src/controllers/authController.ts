import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: "Имя пользователя занято" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "Регистрация успешна" });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера при регистрации" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Неверный логин или пароль" });
    }

    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    res.json({ token, user: { id: user._id.toString(), username: user.username, rating: user.rating } });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера при входе" });
  }
};