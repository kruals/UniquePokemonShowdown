
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import Home from './Components/Home/Home';
import TeamBuild from './Components/TeamBuild/TeamBuild';
import BattleScreen from './Components/Battle/BattleScreen';
import Auth from './Components/Auth/Auth';
import { io } from 'socket.io-client'

function App() {
  const navigate = useNavigate();
  const location = useLocation(); // Чтобы обновлять состояние при переходах
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [onlineList, setOnlineList] = useState([]);
  const [showPlayers, setShowPlayers] = useState(false);

  useEffect(() => {
      const newSocket = io('http://localhost:5000');
      setSocket(newSocket);

      newSocket.on('update_user_list', (list) => {
          setOnlineList(list);
      });

      return () => newSocket.close();
  }, []);

  // Когда пользователь авторизован, сообщаем его имя сокету
useEffect(() => {
    if (user && socket) {
        // Добавим небольшую задержку, чтобы сокет точно успел соединиться
        const timer = setTimeout(() => {
            console.log("Отправка set_user для:", user.username);
            socket.emit('set_user', user.username);
        }, 500);
        return () => clearTimeout(timer);
    }
}, [user, socket]);
  

  // Проверяем наличие пользователя при загрузке и при каждом изменении маршрута
  useEffect(() => {
    const savedUser = localStorage.getItem('ps_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      setUser(null);
    }
  }, [location]); // Перезапускаем проверку, когда меняется путь (например, после логина)

  const handleLogout = () => {
    localStorage.removeItem('ps_token');
    localStorage.removeItem('ps_user');
    setUser(null);
    navigate('/');
  };

  return (
    <div className="App">
      <header className="main-header">
        <div className="logo" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
          Poké<b>Showdown</b>
        </div>
        
        <div className="user-controls">
          
          {user ? (
            // Если пользователь вошел
            <div className="user-info-block">
              <button className="btn-user" onClick={handleLogout} title="Нажмите, чтобы выйти">
                <span className="status-icon online"></span>
                <span className="username">{user.username}</span>
                <span className="user-rating">({user.rating})</span>
              </button>
            </div>
          ) : (
            // Если пользователь НЕ вошел
            <button className="btn-user" onClick={() => navigate('/auth')}>
              <span className="status-icon"></span>
              Войти
            </button>
          )}
          
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home socket={socket} user={user} />} />
          <Route path="/teambuilder" element={<TeamBuild />} />
          <Route path="/battle" element={<BattleScreen socket={socket} user={user}  />} />
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;