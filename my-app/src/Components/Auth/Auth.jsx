import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Выбираем маршрут в зависимости от режима
        const path = isLogin ? '/api/auth/login' : '/api/auth/register';
        
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Произошла ошибка');
            }

            if (isLogin) {
                // Если вошли — сохраняем токен и идем на главную
                localStorage.setItem('ps_token', data.token);
                localStorage.setItem('ps_user', JSON.stringify(data.user));
                navigate('/');
            } else {
                // Если зарегистрировались — перекидываем на вход
                alert('Регистрация успешна! Теперь войдите.');
                setIsLogin(true);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="auth-screen">
            <div className="auth-box">
                <h2>{isLogin ? 'Вход' : 'Регистрация'}</h2>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        placeholder="Никнейм" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        required 
                    />
                    <input 
                        type="password" 
                        placeholder="Пароль" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                    />
                    {error && <p className="error-msg">{error}</p>}
                    <button type="submit" className="auth-btn">
                        {isLogin ? 'Погнали!' : 'Создать аккаунт'}
                    </button>
                </form>
                <button className="toggle-btn" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? 'Еще нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
                </button>
            </div>
        </div>
    );
};

export default Auth;
