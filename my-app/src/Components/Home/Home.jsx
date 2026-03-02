import React, { useState, useEffect, useRef } from 'react';
import './Home.css';
import { useNavigate } from 'react-router-dom';

const Home = ({ socket, user }) => {
    const navigate = useNavigate();
    
    // Состояния для команд
    const [onlineUsersList, setOnlineUsersList] = useState([]);
    console.log(onlineUsersList)
    const [teams, setTeams] = useState([]);
    const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
    const [isSelectOpen, setIsSelectOpen] = useState(false);

    // Состояния для поиска и статусов вызова
    const [searchName, setSearchName] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const [challengeStatus, setChallengeStatus] = useState('idle'); // idle, setup, waiting, received
    const [challengerData, setChallengerData] = useState(null);

    // Используем Ref для доступа к актуальным данным внутри слушателей сокетов
    const teamsRef = useRef([]);
    const selectedIdxRef = useRef(0);

    useEffect(() => {
        const savedTeams = localStorage.getItem('ps_teams');
        if (savedTeams) {
            const parsed = JSON.parse(savedTeams);
            setTeams(parsed);
            teamsRef.current = parsed;
        }
    }, []);

    // Синхронизируем Ref с состоянием при каждом изменении
    useEffect(() => {
        teamsRef.current = teams;
        selectedIdxRef.current = selectedTeamIdx;
    }, [teams, selectedTeamIdx]);

    // Логика Socket.io
 useEffect(() => {
    if (!socket) return;

    // Регистрация пользователя на сервере при входе на главную
    if (user?.username) {
        socket.emit('set_user', { userId: user.id, username: user.username });
    }

    socket.on('update_user_list', (users) => {
        setOnlineUsersList(users);
    });

    socket.on('user_status', (data) => setFoundUser(data));

    socket.on('incoming_challenge', (data) => {
        setChallengerData(data);
        setChallengeStatus('received');
    });

        socket.on('challenge_result', (data) => {
    if (!data || !data.accepted || !data.teams) return;
    if (!user?.username) return;

    const myName = user.username;
    const opponentName = data.from === myName ? data.to : data.from;
    
    // БЕРЕМ СВОЮ КОМАНДУ ИЗ ПАКЕТА СЕРВЕРА (это надежнее всего)
    const myTeamFromServer = data.teams[myName];
    const opponentTeamFromServer = data.teams[opponentName];

    // Очищаем состояния перед уходом
    setChallengeStatus('idle');
    setChallengerData(null);

    navigate('/battle', { 
        state: { 
            battleId: data.battleId,
            myTeam: { mons: myTeamFromServer }, // Оборачиваем в объект, как ждет BattleScreen
            opponentTeam: opponentTeamFromServer,
            opponentName: opponentName
        }
    });
});
    return () => {
        socket.off('update_user_list');
        socket.off('user_status');
        socket.off('incoming_challenge');
        socket.off('challenge_result');
    };
}, [socket, navigate, user]); // Добавили user в зависимости

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

    // Превращает "сырые" данные из Тимбилдера в формат PokemonSet для сервера
    const cleanTeamForServer = (mons) => {
        if (!mons) return [];
        return mons
            .filter(m => m && (m.name || m.id)) // Убираем null и пустые объекты
            .map(m => ({
                name: m.name,
                species: m.name,
                ability: m.ability || 'No Ability',
                // Если атак нет, даем базовую, иначе сервер упадет
                moves: m.moves && m.moves.length > 0 ? m.moves : ['Tackle'], 
                nature: m.nature || 'Serious',
                gender: m.gender || 'M',
                item: m.item || '',
                level: m.level || 100,
                evs: m.evs || {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0},
                ivs: m.ivs || {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}
            }));
    };

    // --- ОБРАБОТЧИКИ ---

    const handleSearch = () => {
    const name = searchName.trim();
    console.log(name)
    if (!name) return;
    
    // Проверяем, есть ли такой юзер в нашем актуальном списке
    const isOnline = onlineUsersList.includes(name);
    setFoundUser({
        username: name,
        online: isOnline
    });
};

    const openChallengeSetup = () => {
        if (!user) return alert("Войдите в аккаунт!");
        if (teams.length === 0) return alert("Создайте команду в Тимбилдере!");
        setChallengeStatus('setup');
    };

    const confirmAndSendChallenge = () => {
        const myTeam = teams[selectedTeamIdx];
        if (!myTeam || !myTeam.mons) return alert("Выберите корректную команду!");

        const cleanedMons = cleanTeamForServer(myTeam.mons);
        
        setChallengeStatus('waiting');
        socket.emit('send_challenge', { 
            to: foundUser.id, 
            from: user.id,
            fromUsername :user.username,
            team: cleanedMons // ПЕРЕДАЕМ ОЧИЩЕННУЮ КОМАНДУ
        });
    };

    const respondToChallenge = (accepted) => {
    if (accepted) {
        const myTeam = teams[selectedTeamIdx];
        if (!myTeam || !myTeam.mons) return alert("Выберите команду для боя!");
        
        const cleanedMons = cleanTeamForServer(myTeam.mons);
        console.log(challengerData)
        socket.emit('challenge_response', { 
            to: challengerData.id, 
            from: user.id, 
            accepted: true,
            team: cleanedMons, 
            opponentTeam: challengerData.team 
        });
        
        // navigate('/battle', {...}) УДАЛЯЕМ ОТСЮДА! 
        // Переход произойдет автоматически, когда сервер пришлет 'challenge_result'
    } else {
        socket.emit('challenge_response', { to: challengerData.id, from: user.id, accepted: false });
        setChallengeStatus('idle');
        setChallengerData(null);
    }
};

    const currentTeam = teams[selectedTeamIdx];

    const TeamSelector = () => (
        <div className="custom-select-wrapper">
            <div className={`custom-select ${isSelectOpen ? 'open' : ''}`} onClick={() => setIsSelectOpen(!isSelectOpen)}>
                {currentTeam ? (
                    <div className="selected-team-info">
                        <div className="team-icons-mini">
                            {currentTeam.mons.map((m, i) => (
                                m ? <img key={i} src={`/image_pokemons/${m.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`} onError={(e) => e.target.src = `https://play.pokemonshowdown.com/sprites/ani/${m.name.toLowerCase()}.gif`} alt="p" /> : <div key={i} className="empty-dot" />
                            ))}
                        </div>
                        <span className="team-name-text">{currentTeam.name}</span>
                    </div>
                ) : <span>Нет команд</span>}
                <div className="arrow">▼</div>
            </div>
            {isSelectOpen && (
                <div className="options-dropdown">
                    {teams.map((team, idx) => (
                        <div key={idx} className="option-item" onClick={() => { setSelectedTeamIdx(idx); setIsSelectOpen(false); }}>
                            <span className="opt-name">{team.name}</span>
                            <div className="team-icons-mini">
                                {team.mons.map((m, i) => m && <img key={i} src={`https://play.pokemonshowdown.com/sprites/ani/${m.name.toLowerCase()}.gif`} alt="p" />)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="Home">
            <div className="background-overlay"></div>
            <img className="bg-animation" src="background1.gif" alt="BG" />
            
            <div className="home-layout">
                <aside className="search-sidebar">
                    <div className="card">
                        <h3>Бросить вызов</h3>
                        <div className="search-input-group">
                            <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Никнейм..." />
                            <button onClick={handleSearch}>🔍</button>
                        </div>
                        {foundUser && (
                            <div className="search-result-box">
                                <p><span className={`dot ${foundUser.online ? 'online' : 'offline'}`}></span> {foundUser.username}</p>
                                {foundUser.online && foundUser.username !== user?.username && (
                                    <button className="btn-challenge-action" onClick={openChallengeSetup}>ВЫЗВАТЬ</button>
                                )}
                            </div>
                        )}
                    </div>
                </aside>

                <main className="action-sidebar">
                    <div className="card">
                        <div className="select-group">
                            <label>Ваша активная команда:</label>
                            <TeamSelector />
                        </div>
                        <button className="btn-battle primary">НАЙТИ БОЙ (СКОРО)</button>
                        <div className="divider"></div>
                        <nav className="side-nav">
                            <button className="nav-item" onClick={() => navigate('/teambuilder')}>Тимбилдер</button>
                            <button className="nav-item">Рейтинг</button>
                        </nav>
                    </div>
                </main>
            </div>

            {challengeStatus === 'setup' && (
                <div className="modal-overlay">
                    <div className="challenge-modal preparation">
                        <h3>Подтверждение вызова</h3>
                        <p>Вы вызываете <b>{foundUser.username}</b>. Подтвердите команду:</p>
                        <TeamSelector />
                        <div className="modal-actions">
                            <button className="btn-accept" onClick={confirmAndSendChallenge}>ОТПРАВИТЬ</button>
                            <button className="btn-decline" onClick={() => setChallengeStatus('idle')}>ОТМЕНА</button>
                        </div>
                    </div>
                </div>
            )}

            {challengeStatus === 'waiting' && (
                <div className="modal-overlay">
                    <div className="challenge-modal">
                        <h3>Вызов отправлен!</h3>
                        <p>Ждем ответа...</p>
                        <div className="spinner"></div>
                        <button className="btn-decline" onClick={() => setChallengeStatus('idle')}>ОТМЕНА</button>
                    </div>
                </div>
            )}

            {challengeStatus === 'received' && (
                <div className="modal-overlay">
                    <div className="challenge-modal preparation">
                        <div className="challenge-header">⚔️ <h3>Вызов от {challengerData?.from}</h3></div>
                        <p>Выберите вашу команду:</p>
                        <TeamSelector />
                        <div className="modal-actions">
                            <button className="btn-accept" onClick={() => respondToChallenge(true)}>ПРИНЯТЬ</button>
                            <button className="btn-decline" onClick={() => respondToChallenge(false)}>ОТКАЗАТЬ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;