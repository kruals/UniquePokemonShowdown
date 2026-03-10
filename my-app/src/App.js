import React, { useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import Home from './Components/Home/Home';
import TeamBuild from './Components/TeamBuild/TeamBuild';
import BattleScreen from './Components/Battle/BattleScreen';
import Auth from './Components/Auth/Auth';
import NewsPage from './Components/News/NewsPage'
import { io } from 'socket.io-client';
import useAppStore from './store/useAppStore';

function App() {
  const navigate  = useNavigate();
  const socketRef = useRef(null);

  const {
    user, setUser, clearUser,
    setOnlineUsers,
    addChallenge,
    addBattle, removeBattle,
    updateBattleState,
    clearOutgoingChallenge,
  } = useAppStore();

  // ── Инициализация сокета один раз ──────────────────────────
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL);
    socketRef.current = socket;

    // Сначала регистрируем ВСЕ listeners...
    socket.on('update_user_list', (list) => {
      setOnlineUsers(list);
    });

    socket.on('incoming_challenge', (data) => {
      addChallenge(data);
    });

    socket.on('challenge_result', (data) => {
      clearOutgoingChallenge();
      if (!data?.accepted || !data?.teams) return;
      const currentUser = useAppStore.getState().user;
      if (!currentUser) return;

      const myId       = currentUser.id;
      const myRole     = data.roles[myId];
      const opponentId = Object.keys(data.roles).find(id => id !== myId);
      const opponentUsername = data.usernames?.[opponentId] || opponentId;

      addBattle(data.battleId, {
        opponentId,
        opponentUsername,
        myRole,
        startedAt: Date.now(),
      });

      navigate(`/battle/${data.battleId}`);
    });

    socket.on('challenge_declined', () => {
      clearOutgoingChallenge();
    });

    socket.on('battle_update', (data) => {
      if (!data?.battleId) return;
      updateBattleState(data.battleId, data);

      if (data.winner || data.ended) {
        setTimeout(() => {
          removeBattle(data.battleId);
        }, 50000);
      }
    });

    // ...и только ПОТОМ отправляем set_user при connect/reconnect
    // Это гарантирует что incoming_challenge не придёт раньше чем слушатель готов
    socket.on('connect', () => {
      const currentUser = useAppStore.getState().user;
      if (currentUser) {
        socket.emit('set_user', { userId: currentUser.id, username: currentUser.username });
      }
    });

    return () => socket.close();
  }, []); // eslint-disable-line

  // ── Регистрация пользователя при логине ────────────────────
  // (когда user появляется уже после mount — например, после входа)
  useEffect(() => {
    if (!user || !socketRef.current) return;
    // Отправляем только если сокет уже подключён
    // connect handler выше справится с первичной регистрацией
    if (socketRef.current.connected) {
      socketRef.current.emit('set_user', { userId: user.id, username: user.username });
    }
  }, [user]);

  const handleLogout = () => {
    clearUser();
    localStorage.removeItem('ps_user');
    navigate('/');
  };

  return (
    <div className="App">
      <AppHeader user={user} onLogout={handleLogout} navigate={navigate} />
      <main>
        <Routes>
          <Route path="/"                element={<Home socket={socketRef} />} />
          <Route path="/teambuilder"     element={<TeamBuild />} />
          <Route path="/battle/:battleId" element={<BattleScreen socket={socketRef} />} />
          <Route path="/auth"            element={<Auth onLogin={setUser} />} />
          <Route path = '/news' element={<NewsPage/>}/>
        </Routes>
      </main>
    </div>
  );
}

const AppHeader = ({ user, onLogout, navigate }) => (
  <header className="main-header">
    <div className="logo" onClick={() => navigate('/')} style={{ cursor:'pointer' }}>
      Poké<b>Showdown</b>
    </div>
    <div className="user-controls">
      {user ? (
        <div className="user-info-block">
          <button className="btn-user" onClick={onLogout} title="Нажмите, чтобы выйти">
            <span className="status-icon online" />
            <span className="username">{user.username}</span>
            <span className="user-rating">({user.rating ?? 1000})</span>
          </button>
        </div>
      ) : (
        <button className="btn-user" onClick={() => navigate('/auth')}>
          <span className="status-icon" />
          Войти
        </button>
      )}
    </div>
  </header>
);

export default App;