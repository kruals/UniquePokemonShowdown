import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../../store/useAppStore';
import './Home.css';

// ─── HELPERS ────────────────────────────────────────────────
const cleanTeamForServer = (mons) => {
  if (!mons) return [];
  return mons
    .filter(m => m && (m.name || m.id))
    .map(m => ({
      name:    m.name,
      species: m.name,
      ability: m.ability || 'No Ability',
      moves:   m.moves?.filter(Boolean).length ? m.moves : ['Tackle'],
      nature:  m.nature  || 'Serious',
      gender:  m.gender  || 'M',
      item:    m.item    || '',
      level:   m.level   || 100,
      evs:     m.evs     || { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 },
      ivs:     m.ivs     || { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 },
    }));
};

const getSpriteUrl = (name) =>
  `https://play.pokemonshowdown.com/sprites/ani/${(name||'').toLowerCase().replace(/[^a-z0-9-]/g,'')}.gif`;

// ─── ГЛАВНЫЙ КОМПОНЕНТ ──────────────────────────────────────
const Home = ({ socket }) => {
  const navigate = useNavigate();
  const {
    user, onlineUsers, pendingChallenges,
    activeBattles, removeChallenge,
  } = useAppStore();

  // Команды из localStorage (тимбилдер)
  const teams         = JSON.parse(localStorage.getItem('ps_teams') || '[]');
  const [selTeam, setSelTeam] = useState(0);

  // UI state
  const [searchQuery,  setSearchQuery]  = useState('');
  const [foundUser,    setFoundUser]    = useState(null);
  const [challengeUI,  setChallengeUI]  = useState('idle'); // idle | setup | waiting
  const [activeTab,    setActiveTab]    = useState('home'); // home | battle:<id>

  const activeBattleList = Object.values(activeBattles);

  // ── Поиск игрока ────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const found = onlineUsers.find(u => u.username.toLowerCase() === q);
    setFoundUser(found || { username: searchQuery.trim(), online: false });
  }, [searchQuery, onlineUsers]);

    
  // ── Отправить вызов ─────────────────────────────────────────
  const sendChallenge = useCallback(() => {
    if (!user || !foundUser?.id || !socket.current) return;
    const team = teams[selTeam];
    if (!team?.mons) return alert('Выберите корректную команду!');

    socket.current.emit('send_challenge', {
      to:          foundUser.id,
      from:        user.id,
      fromUsername: user.username,
      team:        cleanTeamForServer(team.mons),
    });
    setChallengeUI('waiting');
  }, [user, foundUser, teams, selTeam, socket]);

  // ── Ответить на вызов ───────────────────────────────────────
  const respondToChallenge = useCallback((challenge, accepted) => {
    if (!socket.current) return;
    removeChallenge(challenge.from);

    if (!accepted) {
      socket.current.emit('challenge_response', {
        to: challenge.from, from: user.id, accepted: false,
      });
      return;
    }
    const team = teams[selTeam];
    if (!team?.mons) return alert('Выберите команду!');

    socket.current.emit('challenge_response', {
      to:          challenge.from,
      from:        user.id,
      accepted:    true,
      team:        cleanTeamForServer(team.mons),
      opponentTeam: challenge.team,
    });
  }, [socket, user, teams, selTeam, removeChallenge]);

  // ── Перейти в бой ───────────────────────────────────────────
  const goToBattle = (battleId) => navigate(`/battle/${battleId}`);

  const currentTeam = teams[selTeam];

  return (
    <div className="home-root">
      {/* ══ SIDEBAR ═══════════════════════════════════════════ */}
      <aside className="home-sidebar">
        {/* Вкладки: Home + активные бои */}
        <div className="sidebar-tabs">
          <button
            className={`stab ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            🏠 Главная
          </button>
          {activeBattleList.map(b => (
            <button
              key={b.battleId}
              className={`stab battle-tab ${activeTab === b.battleId ? 'active' : ''}`}
              onClick={() => { setActiveTab(b.battleId); goToBattle(b.battleId); }}
            >
              ⚔ {b.opponentUsername}
              <span className="battle-tab-dot" />
            </button>
          ))}
        </div>

        {/* Профиль */}
        {user && (
          <div className="sidebar-profile">
            <div className="sp-avatar">
              {user.username[0].toUpperCase()}
            </div>
            <div className="sp-info">
              <span className="sp-name">{user.username}</span>
              <span className="sp-rating">★ {user.rating ?? 1000}</span>
            </div>
          </div>
        )}

        {/* Навигация */}
        <nav className="sidebar-nav">
          <button className="snav-btn" onClick={() => navigate('/teambuilder')}>
            🗂 Тимбилдер
          </button>
          <button className="snav-btn disabled" disabled>
            🏆 Рейтинг (скоро)
          </button>
        </nav>

        {/* Уведомления о вызовах */}
        {pendingChallenges.length > 0 && (
          <div className="challenges-section">
            <div className="cs-title">⚔ Входящие вызовы</div>
            {pendingChallenges.map(c => (
              <ChallengeCard
                key={c.from}
                challenge={c}
                teams={teams}
                selTeam={selTeam}
                setSelTeam={setSelTeam}
                onAccept={() => respondToChallenge(c, true)}
                onDecline={() => respondToChallenge(c, false)}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ══ MAIN CONTENT ══════════════════════════════════════ */}
      <main className="home-main">
        {!user ? (
          <GuestBanner navigate={navigate} />
        ) : (
          <>
            {/* Активная команда */}
            <section className="home-card team-card">
              <div className="card-title">Активная команда</div>
              <TeamSelector teams={teams} selTeam={selTeam} setSelTeam={setSelTeam} />
              <div className="team-actions">
                <button className="action-btn primary disabled" disabled>
                  🔍 Найти бой (скоро)
                </button>
              </div>
            </section>

            {/* Поиск игрока */}
            <section className="home-card">
              <div className="card-title">Бросить вызов</div>
              <div className="search-row">
                <input
                  className="home-input"
                  placeholder="Никнейм игрока..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button className="action-btn" onClick={handleSearch}>🔍</button>
              </div>

              {foundUser && (
                <div className="found-user-card">
                  <span className={`online-dot ${foundUser.online !== false ? 'online' : 'offline'}`} />
                  <span className="fu-name">{foundUser.username}</span>
                  {foundUser.id && foundUser.id !== user.id && (
                    <button
                      className="action-btn challenge-btn"
                      onClick={() => setChallengeUI('setup')}
                    >
                      ⚔ Вызвать
                    </button>
                  )}
                  {!foundUser.id && <span className="fu-offline">не в сети</span>}
                </div>
              )}
            </section>

            {/* Онлайн список */}
            <section className="home-card online-card">
              <div className="card-title">
                Онлайн
                <span className="online-count">{onlineUsers.length}</span>
              </div>
              <div className="online-list">
                {onlineUsers
                  .filter(u => u.id !== user.id)
                  .map(u => (
                    <div key={u.id} className="online-item">
                      <span className="online-dot online" />
                      <span className="oi-name">{u.username}</span>
                      <button
                        className="action-btn sm"
                        onClick={() => {
                          setFoundUser(u);
                          setChallengeUI('setup');
                        }}
                      >
                        ⚔
                      </button>
                    </div>
                  ))}
                {onlineUsers.filter(u => u.id !== user.id).length === 0 && (
                  <div className="empty-online">Никого нет онлайн</div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* ══ MODALS ════════════════════════════════════════════ */}
      {challengeUI === 'setup' && (
        <div className="modal-overlay" onClick={() => setChallengeUI('idle')}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Подтвердите вызов</div>
            <p>Вы вызываете <b>{foundUser?.username}</b></p>
            <TeamSelector teams={teams} selTeam={selTeam} setSelTeam={setSelTeam} />
            <div className="modal-btns">
              <button className="action-btn primary" onClick={sendChallenge}>⚔ Отправить</button>
              <button className="action-btn danger"  onClick={() => setChallengeUI('idle')}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {challengeUI === 'waiting' && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Вызов отправлен!</div>
            <div className="spinner" />
            <p>Ожидаем ответа от {foundUser?.username}...</p>
            <button className="action-btn danger" onClick={() => setChallengeUI('idle')}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CHALLENGE CARD ──────────────────────────────────────────
const ChallengeCard = ({ challenge, teams, selTeam, setSelTeam, onAccept, onDecline }) => (
  <div className="challenge-card">
    <div className="cc-header">
      <span className="cc-from">⚔ {challenge.fromUsername}</span>
      <span className="cc-time">
        {Math.round((Date.now() - challenge.receivedAt) / 1000)}с назад
      </span>
    </div>
    <TeamSelector teams={teams} selTeam={selTeam} setSelTeam={setSelTeam} mini />
    <div className="cc-btns">
      <button className="action-btn primary sm" onClick={onAccept}>✓ Принять</button>
      <button className="action-btn danger  sm" onClick={onDecline}>✗ Отказать</button>
    </div>
  </div>
);

// ─── TEAM SELECTOR ───────────────────────────────────────────
const TeamSelector = ({ teams, selTeam, setSelTeam, mini = false }) => {

  const [open, setOpen] = useState(false);
  const team = teams[selTeam];

const makeFallback = (name) => {
  let tries = 0;
  return (e) => {
    tries++;
    const safe     = (name||'').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const safeName = (name||'').toLowerCase().replace(/\s+/g, '-');
    if (tries === 1)      e.target.src = `https://play.pokemonshowdown.com/sprites/gen5/${safe}.png`;
    else if (tries === 2) e.target.src = `https://play.pokemonshowdown.com/sprites/dex/${safe}.png`;
    else if (tries === 3) e.target.src = `/image_pokemons/${safeName}.png`;
    else                  e.target.style.display = 'none';
  };
};

  if (!teams.length) return <div className="no-teams">Нет команд. <a href="/teambuilder">Создать →</a></div>;

  return (
    <div className={`team-selector ${mini ? 'mini' : ''}`}>
      <div className={`ts-current ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        {team ? (
          <>
            <div className="ts-sprites">
              {team.mons.map((m, i) =>
                m ? <img key={i} src={getSpriteUrl(m.name)} alt={m.name} className="ts-spr"
                 onError={makeFallback(m.name)} />
                  : <div key={i} className="ts-empty-slot" />
              )}
            </div>
            <span className="ts-name">{team.name}</span>
          </>
        ) : <span>Выберите команду</span>}
        <span className="ts-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="ts-dropdown">
          {teams.map((t, i) => (
            <div key={i} className={`ts-option ${i === selTeam ? 'selected' : ''}`}
              onClick={() => { setSelTeam(i); setOpen(false); }}>
              <span className="ts-opt-name">{t.name}</span>
              <div className="ts-opt-sprites">
                {t.mons.map((m, j) =>
                  m ? <img key={j} src={getSpriteUrl(m.name)} alt={m.name} className="ts-spr-sm"
                    onError={makeFallback(m.name)} /> : null
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── GUEST BANNER ────────────────────────────────────────────
const GuestBanner = ({ navigate }) => (
  <div className="guest-banner">
    <div className="gb-title">Poké<b>Showdown</b></div>
    <div className="gb-sub">Сражайся с другими игроками в реальном времени</div>
    <button className="action-btn primary large" onClick={() => navigate('/auth')}>
      Войти / Регистрация
    </button>
  </div>
);

export default Home;
