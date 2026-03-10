import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAppStore from '../../store/useAppStore';
import './BattleScreen.css';

const STATUS_NAMES  = { brn:'Ожог', par:'Паралич', psn:'Отравление', tox:'Сильное отравление', slp:'Сон', frz:'Заморозка' };
const STATUS_COLORS = { brn:'#e67e22', par:'#f1c40f', psn:'#9b59b6', tox:'#8e44ad', slp:'#95a5a6', frz:'#3498db' };
const STAT_NAMES    = { hp:'HP', atk:'Атака', def:'Защита', spa:'Сп.Атк', spd:'Сп.Защ', spe:'Скорость', acc:'Точность', eva:'Уклонение' };
const STAT_KEYS     = ['hp','atk','def','spa','spd','spe'];
const TYPE_COLORS   = {
  Normal:'#A8A878',Fire:'#F08030',Water:'#6890F0',Electric:'#F8D030',
  Grass:'#78C850',Ice:'#98D8D8',Fighting:'#C03028',Poison:'#A040A0',
  Ground:'#E0C068',Flying:'#A890F0',Psychic:'#F85888',Bug:'#A8B820',
  Rock:'#B8A038',Ghost:'#705898',Dragon:'#7038F8',Dark:'#705848',
  Steel:'#B8B8D0',Fairy:'#EE99AC',
};
const BOOST_MULT = {'-6':0.25,'-5':0.28,'-4':0.33,'-3':0.4,'-2':0.5,'-1':0.67,'0':1,'1':1.5,'2':2,'3':2.5,'4':3,'5':3.5,'6':4};
const NATURE_MOD = {
  Hardy:{atk:1,def:1,spa:1,spd:1,spe:1},Lonely:{atk:1.1,def:0.9,spa:1,spd:1,spe:1},
  Brave:{atk:1.1,def:1,spa:1,spd:1,spe:0.9},Adamant:{atk:1.1,def:1,spa:0.9,spd:1,spe:1},
  Naughty:{atk:1.1,def:1,spa:1,spd:0.9,spe:1},Bold:{atk:0.9,def:1.1,spa:1,spd:1,spe:1},
  Docile:{atk:1,def:1,spa:1,spd:1,spe:1},Relaxed:{atk:1,def:1.1,spa:1,spd:1,spe:0.9},
  Impish:{atk:1,def:1.1,spa:0.9,spd:1,spe:1},Lax:{atk:1,def:1.1,spa:1,spd:0.9,spe:1},
  Timid:{atk:0.9,def:1,spa:1,spd:1,spe:1.1},Hasty:{atk:1,def:0.9,spa:1,spd:1,spe:1.1},
  Serious:{atk:1,def:1,spa:1,spd:1,spe:1},Jolly:{atk:1,def:1,spa:0.9,spd:1,spe:1.1},
  Naive:{atk:1,def:1,spa:1,spd:0.9,spe:1.1},Modest:{atk:0.9,def:1,spa:1.1,spd:1,spe:1},
  Mild:{atk:1,def:0.9,spa:1.1,spd:1,spe:1},Quiet:{atk:1,def:1,spa:1.1,spd:1,spe:0.9},
  Bashful:{atk:1,def:1,spa:1,spd:1,spe:1},Rash:{atk:1,def:1,spa:1.1,spd:0.9,spe:1},
  Calm:{atk:0.9,def:1,spa:1,spd:1.1,spe:1},Gentle:{atk:1,def:0.9,spa:1,spd:1.1,spe:1},
  Sassy:{atk:1,def:1,spa:1,spd:1.1,spe:0.9},Careful:{atk:1,def:1,spa:0.9,spd:1.1,spe:1},
  Quirky:{atk:1,def:1,spa:1,spd:1,spe:1},
};
const WEATHER_NAMES = { SunnyDay:'☀️ Сильная жара', RainDance:'🌧 Ливень', Sandstorm:'🌪 Песчаная буря', Hail:'❄️ Град', Snow:'❄️ Снег', none:'☁️ Погода нормализовалась' };
const WEATHER_ICON  = { SunnyDay:'☀️', RainDance:'🌧', Sandstorm:'🌪', Hail:'❄️', Snow:'❄️' };
const WEATHER_CLR   = { SunnyDay:'#f39c12', RainDance:'#3498db', Sandstorm:'#d4ac0d', Hail:'#85c1e9', Snow:'#85c1e9' };
const HAZARD_NAMES  = {
  'Stealth Rock':'Острые камни','move: Stealth Rock':'Острые камни',
  'Spikes':'Шипы','move: Spikes':'Шипы',
  'Toxic Spikes':'Ядовитые шипы','move: Toxic Spikes':'Ядовитые шипы',
  'Sticky Web':'Липкая паутина','move: Sticky Web':'Липкая паутина',
};
const VOLATILE_NAMES = {
  'move: Taunt':'Провокация','Taunt':'Провокация',
  'move: Encore':'Encore','Encore':'Encore',
  'move: Substitute':'Замена','Substitute':'Замена',
  'move: Confusion':'Замешательство','confusion':'Замешательство',
  'move: Leech Seed':'Посев','leechseed':'Посев',
  'move: Torment':'Истязание','Torment':'Истязание',
  'move: Disable':'Блокировка','Disable':'Блокировка',
  'move: Yawn':'Зевота','Yawn':'Зевота',
  'move: Perish Song':'Гибельная песнь',
  'move: Aqua Ring':'Кольцо воды',
  'move: Ingrain':'Укоренение',
  'move: Curse':'Проклятие',
};
const VISIBLE_VOLATILE = Object.keys(VOLATILE_NAMES);


const calcFinalStat = (pokemon, statKey) => {
  if (!pokemon?.baseStats) return null;
  const base = pokemon.baseStats[statKey] ?? 0;
  const lvl  = parseInt(pokemon.level) || 100;
  const ev   = pokemon.evs?.[statKey]  ?? 0;
  const iv   = pokemon.ivs?.[statKey]  ?? 31;
  const nmod = (NATURE_MOD[pokemon.nature] || NATURE_MOD['Serious'])[statKey] ?? 1;
  if (statKey === 'hp')
    return Math.floor(((2*base+iv+Math.floor(ev/4))*lvl)/100)+lvl+10;
  return Math.floor((Math.floor(((2*base+iv+Math.floor(ev/4))*lvl)/100)+5)*nmod);
};

const calcBoostedStat = (pokemon, statKey, boosts) => {
  if (statKey === 'hp') return null;
  const base = calcFinalStat(pokemon, statKey);
  if (base === null) return null;
  const stage = Math.max(-6, Math.min(6, boosts?.[statKey] ?? 0));
  return Math.floor(base * (BOOST_MULT[String(stage)] ?? 1));
};

const getSpriteFront = (name) =>
  `https://play.pokemonshowdown.com/sprites/ani/${(name||'').toLowerCase().replace(/[^a-z0-9-]/g,'')}.gif`;
const getSpriteBack = (name) =>
  `https://play.pokemonshowdown.com/sprites/ani-back/${(name||'').toLowerCase().replace(/[^a-z0-9-]/g,'')}.gif`;

const makeFallback = (name, isBack) => {
  let tries = 0;
  return (e) => {
    tries++;
    const safe     = (name||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
    const safeName = (name||'').toLowerCase().replace(/\s+/g,'-');
    if (tries === 1) e.target.src = isBack
      ? `https://play.pokemonshowdown.com/sprites/gen5-back/${safe}.png`
      : `https://play.pokemonshowdown.com/sprites/gen5/${safe}.png`;
    else if (tries === 2) e.target.src = `https://play.pokemonshowdown.com/sprites/dex/${safe}.png`;
    else if (tries === 3) e.target.src = `/image_pokemons/${safeName}.gif`;
    else if (tries === 4) e.target.src = `/image_pokemons/${safeName}.png`;
    else if (tries  === 5) e.target.src = `/image_pokemons/${safeName}.PNG`;
    else e.target.src = 'https://play.pokemonshowdown.com/sprites/substitutes/gen5/substitute.png'
  };
};

// ─── ЛОКАЛЬНЫЙ ПАРСЕР БУСТОВ И СТАТУСОВ ─────────────────────
const parseBoostEvents = (logs) => {
  const events = [];
  for (const line of logs) {
    const parts = line.split('|');
    if (parts.length < 2) continue;
    const type = parts[1];
    const side = line.includes('|p1') ? 'p1' : 'p2';
    if (type === '-boost')   events.push({ type: 'boost',   side, stat: parts[3], amount: parseInt(parts[4]) });
    if (type === '-unboost') events.push({ type: 'unboost', side, stat: parts[3], amount: parseInt(parts[4]) });
    if (type === '-clearallboost' || type === '-clearboost') events.push({ type: 'clearboost' });
    if (type === 'switch' || type === 'drag') events.push({ type: 'switch', side });
  }
  return events;
};

// Парсим мега-эволюции из логов: |-mega|p2a: Gengar|Gengar|Gengarite
// Возвращает { p1: { base: 'Gengar', mega: 'Gengar-Mega' }, p2: ... }
const parseMegaFromLogs = (logs) => {
  const megas = {};
  for (const line of logs) {
    const parts = line.split('|');
    if (parts[1] === '-mega') {
      const side     = parts[2]?.startsWith('p1') ? 'p1' : 'p2';
      const baseName = parts[3]?.trim();
      if (baseName) megas[side] = { base: baseName, mega: baseName + '-Mega' };
    }
  }
  return megas;
};

// Парсим использованные ходы врага из логов: |move|p2a: Gengar|Hypnosis|p1a: ...
const parseSeenMoves = (logs, enemyRole) => {
  const seen = {}; // { 'Gengar': { 'Hypnosis': { pp: N, seen: true } } }
  for (const line of logs) {
    const parts = line.split('|');
    if (parts[1] !== 'move') continue;
    const slotStr = parts[2] || ''; // "p2a: Gengar"
    if (!slotStr.startsWith(enemyRole)) continue;
    const pokeName = slotStr.replace(/^p[12][a-z]:\s*/, '').trim();
    const moveName = parts[3]?.trim();
    if (!pokeName || !moveName || moveName === 'Struggle') continue;
    if (!seen[pokeName]) seen[pokeName] = {};
    if (!seen[pokeName][moveName]) seen[pokeName][moveName] = 0;
    seen[pokeName][moveName]++;
  }
  return seen;
};

const BattleScreen = ({ socket }) => {
  const { battleId } = useParams();
  const navigate     = useNavigate();
  const logEndRef    = useRef(null);
  const { user, activeBattles, getBattleState, removeBattle } = useAppStore();

  useEffect(() => { injectStyles(); }, []);

  const battleMeta  = activeBattles[battleId];
  const battleState = getBattleState(battleId);

  const [isWaiting, setIsWaiting] = useState(false);
  const [animHit,   setAnimHit]   = useState({ p1:false, p2:false });
  const [localBoosts, setLocalBoosts] = useState({ p1:{}, p2:{} });
  // Мега/Z — sessionStorage чтобы не сбрасывались при перезаходе в бой
  const [megaUsed,  setMegaUsed]  = useState(() => sessionStorage.getItem(`mega_${battleId}`) === '1');
  const [zMoveUsed, setZMoveUsed] = useState(() => sessionStorage.getItem(`zmove_${battleId}`) === '1');
  const [megaPending,  setMegaPending]  = useState(false);
  const [zMovePending, setZMovePending] = useState(false);
  // Мега-данные обоих игроков: { p1: { base: 'Gengar', mega: 'Gengar-Mega' } | null }
  const [megaNames, setMegaNames] = useState({ p1: null, p2: null });
  // Seen moves врага { pokeName: { moveName: count } }
  const [seenMovesMap, setSeenMovesMap] = useState({});

  const myRole       = battleMeta?.myRole;
  const enemyRole    = myRole === 'p1' ? 'p2' : 'p1';
  const mySide       = myRole === 'p1' ? battleState?.side1 : battleState?.side2;
  const enemySide    = myRole === 'p1' ? battleState?.side2 : battleState?.side1;
  const myBoosts     = localBoosts[myRole]    || {};
  const enemyBoosts  = localBoosts[enemyRole] || {};
  const myHazards    = battleState?.hazards?.[myRole]   || [];
  const enemyHazards = battleState?.hazards?.[enemyRole]|| [];

  const currentPhase = battleState?.winner
    ? 'ended'
    : mySide?.requestState === 'teampreview' ? 'preview'
    : mySide?.requestState === 'switch'      ? 'switch'
    : mySide?.requestState === 'move'        ? 'battle'
    : 'wait';

  // ── Парсим мега и seen moves из ПОЛНОГО лога ────────────────
  useEffect(() => {
    const allLogs = battleState?.logs?.map(l => l.raw || l.text || '') || [];
    // Мега из логов — для обоих игроков
    const newMegas = parseMegaFromLogs(allLogs);
    if (Object.keys(newMegas).length > 0) {
      setMegaNames(prev => ({ ...prev, ...newMegas }));
    }
    // Seen moves врага
    if (enemyRole) {
      const seen = parseSeenMoves(allLogs, enemyRole);
      setSeenMovesMap(seen);
    }
  }, [battleState?.logs?.length]); // eslint-disable-line

  // ── При получении battle_update — обновляем локальные бусты ─
  useEffect(() => {
    if (!battleState?.logs) return;
    const recentLogs = battleState.recentLog || [];
    const events = parseBoostEvents(recentLogs);

    // Также проверяем мегу в новых логах
    const newMegas = parseMegaFromLogs(recentLogs);
    if (Object.keys(newMegas).length > 0) {
      setMegaNames(prev => ({ ...prev, ...newMegas }));
    }

    setLocalBoosts(prev => {
      let next = { p1: {...prev.p1}, p2: {...prev.p2} };
      for (const ev of events) {
        if (ev.type === 'switch') {
          // Сбрасываем бусты при выходе покемона
          next[ev.side] = {};
        } else if (ev.type === 'boost') {
          next[ev.side] = { ...next[ev.side], [ev.stat]: (next[ev.side][ev.stat] || 0) + ev.amount };
        } else if (ev.type === 'unboost') {
          next[ev.side] = { ...next[ev.side], [ev.stat]: (next[ev.side][ev.stat] || 0) - ev.amount };
        } else if (ev.type === 'clearboost') {
          next = { p1: {}, p2: {} };
        }
      }
      return next;
    });
  }, [battleState?.recentLog]);


  useEffect(() => {
    if (!battleId || !battleMeta) { navigate('/'); return; }
    if (socket.current) socket.current.emit('join_battle', battleId);
  }, [battleId]); // eslint-disable-line

  useEffect(() => {
    if (!socket?.current) return;
    const handler = (data) => {
      if (!data) return;
      setIsWaiting(false);
      if (data.log) {
        const hasDmgP1 = data.log.some(l => l.includes('|-damage|p1'));
        const hasDmgP2 = data.log.some(l => l.includes('|-damage|p2'));
        if (hasDmgP1) { setAnimHit(p=>({...p,p1:true})); setTimeout(()=>setAnimHit(p=>({...p,p1:false})),500); }
        if (hasDmgP2) { setAnimHit(p=>({...p,p2:true})); setTimeout(()=>setAnimHit(p=>({...p,p2:false})),500); }
      }
    };
    socket.current.on('battle_update', handler);
    return () => socket.current?.off('battle_update', handler);
  }, [socket]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [battleState?.logs]);

  // Сбрасываем pending при новом ходе
  useEffect(() => {
    if (!isWaiting) {
      setMegaPending(false);
      setZMovePending(false);
    }
  }, [isWaiting]);

  const sendAction = useCallback((action, isZMove = false) => {
    if (isWaiting || battleState?.winner || !socket?.current || !user) return;
    let finalAction = action;
    if (megaPending && action.startsWith('move'))        finalAction = action + ' mega';
    else if (isZMove && action.startsWith('move'))       finalAction = action + ' zmove';
    setIsWaiting(true);
    if (megaPending) { setMegaUsed(true); sessionStorage.setItem(`mega_${battleId}`, '1'); }
    if (isZMove)     { setZMoveUsed(true); sessionStorage.setItem(`zmove_${battleId}`, '1'); }
    setMegaPending(false);
    setZMovePending(false);
    socket.current.emit('battle_action', { battleId, userId: user.id, action: finalAction });
  }, [isWaiting, battleState?.winner, socket, battleId, user, megaPending]);

  const handleExit = useCallback(() => {
    sessionStorage.removeItem(`mega_${battleId}`);
    sessionStorage.removeItem(`zmove_${battleId}`);
    removeBattle(battleId);
    navigate('/');
  }, [removeBattle, battleId, navigate]);

  if (!user) { navigate('/auth'); return null; }
  if (!battleMeta) { navigate('/'); return null; }

  if (!battleState) {
    return (
      <div className="battle-wrapper">
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#8892a4',fontSize:'1rem'}}>
          Подключение к бою...
        </div>
      </div>
    );
  }

  const activePokemon = mySide?.pokemon?.[mySide?.activeIdx];
  const activeEnemy   = enemySide?.pokemon?.[enemySide?.activeIdx];
  const activeMoves   = activePokemon?.moveSlots || [];

  return (
    <div className="battle-wrapper">
      {battleState.weather && <WeatherOverlay weather={battleState.weather} />}

      <div className="battle-header">
        <TrainerInfo name={user.username} side={mySide} isPlayer />
        <div className="header-center">
          {battleState.weather
            ? <WeatherBadge weather={battleState.weather} turns={battleState.weatherTurns} />
            : <div className="vs-circle">⚔</div>
          }
        </div>
        <TrainerInfo name={battleMeta.opponentUsername} side={enemySide} isPlayer={false} />
      </div>

      <div className="battle-arena">
        {currentPhase === 'preview' ? (
          <PreviewPhase side={mySide} enemySide={enemySide} sendAction={sendAction} isWaiting={isWaiting} />
        ) : (
          <div className="field">
            <div className="field-enemy">
              <HazardDisplay hazards={enemyHazards} />
              {activeEnemy && (
                <PokemonOnField
                  pokemon={activeEnemy} isEnemy
                  boosts={enemyBoosts}
                  statuses={battleState.statuses || {}}
                  volatiles={battleState.volatiles || {}}
                  isHit={animHit[enemyRole]}
                  seenMoves={seenMovesMap[activeEnemy.name] || {}}
                  megaData={megaNames[enemyRole]}
                />
              )}
            </div>
            <div className="field-player">
              {activePokemon && (
                <PokemonOnField
                  pokemon={activePokemon} isEnemy={false}
                  boosts={myBoosts}
                  statuses={battleState.statuses || {}}
                  volatiles={battleState.volatiles || {}}
                  isHit={animHit[myRole]}
                  seenMoves={{}}
                  megaData={megaNames[myRole]}
                />
              )}
              <HazardDisplay hazards={myHazards} flip />
            </div>
            <PartyIcons side={mySide}    position="bottom" isEnemy={false} />
            <PartyIcons side={enemySide} position="top"    isEnemy={true}  />
          </div>
        )}
      </div>

      <div className="ui-panel">
        <LogPanel logs={battleState.logs || []} logEndRef={logEndRef} />
        <div className="controls-container">
          {currentPhase === 'ended' ? (
            <WinScreen winner={battleState.winner} myName={user.username} onExit={handleExit} />
          ) : (currentPhase === 'wait' || isWaiting) ? (
            <WaitingPanel lastMove={battleState.lastMove} />
          ) : currentPhase === 'preview' ? (
            <div className="waiting-text">👆 Выберите первого покемона выше</div>
          ) : (
            <BattleControls
              moves={activeMoves} sendAction={sendAction}
              isWaiting={isWaiting}
              activePokemon={activePokemon}
              isForceSwitch={currentPhase === 'switch'}
              megaUsed={megaUsed} zMoveUsed={zMoveUsed}
              megaPending={megaPending} zMovePending={zMovePending}
              onMegaToggle={()=>{ setMegaPending(p=>!p); setZMovePending(false); }}
              onZMoveToggle={()=>{ setZMovePending(p=>!p); setMegaPending(false); }}
            />
          )}
        </div>
      </div>

      {/* Полоска команды — всегда видна во время боя */}
      {currentPhase !== 'preview' && currentPhase !== 'ended' && (
        <PartyStrip
          mySide={mySide}
          sendAction={sendAction}
          isWaiting={isWaiting}
          isForceSwitch={currentPhase === 'switch'}
        />
      )}
    </div>
  );
};


const WeatherBadge = ({ weather, turns }) => (
  <div className="weather-badge" style={{ borderColor:WEATHER_CLR[weather]||'#aaa', color:WEATHER_CLR[weather]||'#aaa' }}>
    <span className="weather-icon">{WEATHER_ICON[weather]}</span>
    <span className="weather-name">{WEATHER_NAMES[weather]?.replace(/^[^\s]+\s/,'')}</span>
    {turns>0&&(
      <div className="weather-turns">
        {Array.from({length:Math.min(turns,8)}).map((_,i)=>(
          <span key={i} className="weather-dot" style={{background:WEATHER_CLR[weather]||'#aaa'}}/>
        ))}
        <span className="weather-turns-num">{turns}</span>
      </div>
    )}
  </div>
);

const WeatherOverlay = ({ weather }) => {
  const cls = { SunnyDay:'weather-sun',RainDance:'weather-rain',Sandstorm:'weather-sand',Hail:'weather-hail',Snow:'weather-snow' };
  return <div className={`weather-overlay ${cls[weather]||''}`}/>;
};

const HazardDisplay = ({ hazards, flip }) => {
  if (!hazards?.length) return null;
  return (
    <div className={`hazard-display ${flip?'hazard-flip':''}`}>
      {hazards.map((h,i)=><span key={i} className="hazard-badge">⚠ {h}</span>)}
    </div>
  );
};

const TrainerInfo = ({ name, side, isPlayer }) => {
  const pokemon = side?.pokemon || [];
  return (
    <div className={`trainer-info ${isPlayer?'trainer-player':'trainer-enemy'}`}>
      <span className="trainer-name">{name}{isPlayer?' (Вы)':''}</span>
      <div className="team-dots">
        {pokemon.map((p,i)=>(
          <span key={i} className={`team-dot ${p.fainted?'dot-fainted':p.active?'dot-active':'dot-alive'}`} title={p.name}/>
        ))}
      </div>
    </div>
  );
};

// ── PARTY ICONS с тултипом HP% ───────────────────────────────
const PartyIcons = ({ side, position, isEnemy }) => {
  if (!side?.pokemon) return null;
  const sorted = [...side.pokemon].sort((a,b)=>a.num-b.num);
  return (
    <div className={`party-icons party-icons-${position}`}>
      {sorted.map(p => (
        <PartyIconItem key={p.num} p={p} isEnemy={isEnemy} />
      ))}
    </div>
  );
};

const PartyIconItem = ({ p, isEnemy }) => {
  const [showTip, setShowTip] = useState(false);
  const hpPct = p.maxhp > 0 ? Math.ceil((p.hp / p.maxhp) * 100) : 0;
  const hpCls = hpPct < 20 ? 'critical' : hpPct < 50 ? 'low' : 'good';

  return (
    <div
      className={`party-icon-wrap ${p.fainted?'pi-fainted':p.active?'pi-active':'pi-alive'}`}
      title=""
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <img
        src={getSpriteFront(p.name)}
        alt={p.name}
        className="party-icon-sprite"
        onError={makeFallback(p.name, false)}
      />
      {p.fainted && <div className="pi-fainted-overlay">✕</div>}

      {showTip && (
        <div className={`party-icon-tooltip ${isEnemy ? 'pit-enemy' : 'pit-player'}`}>
          {/* Шапка */}
          <div className="pit-head">
            <span className="pit-name">{p.name}</span>
            <span className="pit-lv">Ур.{p.level||100}</span>
            {p.status && (
              <span className="pit-status-badge" style={{background:STATUS_COLORS[p.status]}}>{STATUS_NAMES[p.status]?.slice(0,3)||p.status}</span>
            )}
          </div>

          {/* Типы */}
          {p.types && (
            <div className="pit-types">
              {p.types.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}
            </div>
          )}

          {/* HP-бар */}
          <div className="pit-hp-row">
            <div className="pit-hp-bar">
              <div className={`pit-hp-fill ${hpCls}`} style={{ width: `${Math.max(0, hpPct)}%` }} />
            </div>
            <span className="pit-hp-text">
              {p.fainted ? 'К.О.' : isEnemy ? `${hpPct}%` : `${p.hp}/${p.maxhp}`}
            </span>
          </div>

          {/* Статы — для своих полные, для врага только базовые */}
          {p.baseStats && (
            <div className="pit-stats">
              {STAT_KEYS.map(stat => {
                const base  = p.baseStats[stat] ?? 0;
                const final = !isEnemy ? calcFinalStat(p, stat) : null;
                const barW  = Math.min(100, base / 1.8);
                const barC  = base>=100?'#2ecc71':base>=70?'#f1c40f':'#e74c3c';
                return (
                  <div key={stat} className="pit-stat-row">
                    <span className="pit-stat-name">{STAT_NAMES[stat]?.slice(0,2)}</span>
                    <div className="pit-stat-bar"><div style={{width:`${barW}%`,background:barC,height:'100%',borderRadius:2}}/></div>
                    <span className="pit-stat-val">{base}</span>
                    {final !== null && <span className="pit-stat-final">/{final}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Атаки — только для своих */}
          {!isEnemy && p.moveSlots?.length > 0 && (
            <div className="pit-moves">
              {p.moveSlots.map((m,i) => (
                <div key={i} className={`pit-move-row ${m.disabled?'pit-move-disabled':''}`}>
                  <span className="pit-move-name">{m.move}</span>
                  <span className="pit-move-pp">{m.pp}/{m.maxpp}</span>
                </div>
              ))}
            </div>
          )}

          {/* Предмет/способность */}
          {p.ability && <div className="pit-row">Способность: <b>{p.ability}</b></div>}
          {p.item     && <div className="pit-row">Предмет: <b>{p.item}</b></div>}
        </div>
      )}
    </div>
  );
};

const PokemonOnField = ({ pokemon, isEnemy, boosts, statuses, volatiles, isHit, seenMoves, megaData }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const status    = statuses[pokemon.name];
  const myVols    = (volatiles[pokemon.name]||[]).filter(e=>VISIBLE_VOLATILE.includes(e));
  const hasSub    = myVols.some(e=>e.includes('Substitute'));
  const hpPct     = pokemon.maxhp>0?(pokemon.hp/pokemon.maxhp)*100:0;
  const hpCls     = hpPct<20?'critical':hpPct<50?'low':'';
  const hasBoosts = boosts&&Object.values(boosts).some(v=>v!==0);

  // Мега-спрайт только если активный покемон — именно тот, кто эволюционировал
  const isMega      = megaData && megaData.base === pokemon.name;
  const displayName = isMega ? megaData.mega : pokemon.name;
  const spriteUrl   = isEnemy ? getSpriteFront(displayName) : getSpriteBack(displayName);

  return (
    <div className={`pokemon-field-wrap ${isEnemy?'pfw-enemy':'pfw-player'}`}>
      <div className={`stats-box ${isEnemy?'stats-enemy':'stats-player'}`}>
        <div className="stats-top">
          <span className="poke-name">{pokemon.name}</span>
          <div className="poke-meta">
            {pokemon.types?.map(t=>(
              <span key={t} className="type-badge" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>
            ))}
            <span className="poke-level">Ур.{pokemon.level}</span>
          </div>
        </div>
        {status&&<span className="status-badge" style={{background:STATUS_COLORS[status]||'#777'}}>{STATUS_NAMES[status]||status}</span>}
        <div className="hp-row">
          <div className="hp-bar-container"><div className={`hp-fill ${hpCls}`} style={{width:`${Math.max(0,hpPct)}%`}}/></div>
          <span className="hp-text">{isEnemy?`${Math.ceil(hpPct)}%`:`${pokemon.hp}/${pokemon.maxhp}`}</span>
        </div>
        {hasBoosts&&(
          <div className="boosts-row">
            {Object.entries(boosts).filter(([,v])=>v!==0).map(([stat,val])=>(
              <span key={stat} className={`boost-badge ${val>0?'boost-pos':'boost-neg'}`}>
                {STAT_NAMES[stat]?.slice(0,3)} {val>0?`+${val}`:val}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={`sprite-container ${isHit?'hit-flash':''}`}
        onMouseEnter={()=>setShowTooltip(true)}
        onMouseLeave={()=>setShowTooltip(false)}>
        {hasSub&&<div className="substitute-badge">ЗАМЕНА</div>}
        {myVols.filter(e=>!e.includes('Substitute')).map((e,i)=>(
          <div key={i} className="volatile-badge">{VOLATILE_NAMES[e]||e}</div>
        ))}
        <img
          className={`sprite ${isEnemy?'sprite-front':'sprite-back'}`}
          src={spriteUrl}
          alt={displayName}
          onError={makeFallback(displayName, !isEnemy)}
        />
        {showTooltip&&(
          <PokemonTooltip
            pokemon={pokemon} isEnemy={isEnemy}
            boosts={boosts} status={status}
            volatiles={myVols} seenMoves={seenMoves}
          />
        )}
      </div>
    </div>
  );
};

const PokemonTooltip = ({ pokemon, isEnemy, boosts, status, volatiles, seenMoves }) => {
  const hpPct = pokemon.maxhp>0?(pokemon.hp/pokemon.maxhp)*100:0;
  return (
    <div className={`poke-tooltip ${isEnemy?'tooltip-left':'tooltip-right'}`}
         style={isEnemy ? { bottom:'auto', top:'110%' } : {}}>
      <div className="tooltip-header">
        <strong>{pokemon.name}</strong>
        <span className="tooltip-level">Ур. {pokemon.level}</span>
      </div>
      <div className="tooltip-types">
        {pokemon.types?.map(t=>(
          <span key={t} className="type-badge-sm" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>
        ))}
      </div>
      <div className="tooltip-hp">
        HP: <strong>{isEnemy?`${Math.ceil(hpPct)}%`:`${pokemon.hp}/${pokemon.maxhp}`}</strong>
        <span className={`tooltip-hp-pct ${hpPct<20?'pct-red':hpPct<50?'pct-yellow':'pct-green'}`}>
          {Math.ceil(hpPct)}%
        </span>
      </div>
      {status&&<div className="tooltip-status" style={{color:STATUS_COLORS[status]||'#aaa'}}>{STATUS_NAMES[status]||status}</div>}
      {volatiles?.filter(e=>!e.includes('Substitute')).length>0&&(
        <div className="tooltip-volatiles">
          {volatiles.filter(e=>!e.includes('Substitute')).map((e,i)=>(
            <span key={i} className="tv-badge">{VOLATILE_NAMES[e]||e}</span>
          ))}
        </div>
      )}
      {pokemon.ability&&<div className="tooltip-row"><span className="tl">Способность:</span> {pokemon.ability}</div>}
      {pokemon.item   &&<div className="tooltip-row"><span className="tl">Предмет:</span> {pokemon.item}</div>}
      {!isEnemy&&pokemon.nature&&<div className="tooltip-row"><span className="tl">Природа:</span> {pokemon.nature}</div>}

      {pokemon.baseStats&&(
        <div className="tooltip-stats">
          <div className="ts-header">
            <span className="ts-title">Статы</span>
            <span className="ts-sub">{isEnemy?'Баз / Итог':'Баз / Итог / Буст'}</span>
          </div>
          {STAT_KEYS.map(stat=>{
            const base    = pokemon.baseStats[stat]??0;
            const final   = calcFinalStat(pokemon, stat);
            const boosted = calcBoostedStat(pokemon, stat, boosts);
            const bval    = boosts?.[stat]??0;
            const barW    = Math.min(100, base/1.8);
            const barClr  = base>=100?'#2ecc71':base>=70?'#f1c40f':'#e74c3c';
            return (
              <div key={stat} className="ts-row">
                <span className="ts-name">{STAT_NAMES[stat]||stat}</span>
                <div className="ts-bar-wrap"><div className="ts-bar" style={{width:`${barW}%`,background:barClr}}/></div>
                <span className="ts-val">{base}</span>
                {final!==null&&<span className="ts-final">{final}</span>}
                {!isEnemy&&bval!==0&&boosted!==null&&(
                  <span className={`ts-boosted ${bval>0?'ts-pos':'ts-neg'}`}>{boosted}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!isEnemy&&pokemon.moveSlots?.length>0&&(
        <div className="tooltip-moves">
          <div className="ts-title">Атаки</div>
          {pokemon.moveSlots.map(m=>(
            <div key={m.id} className="tm-row">
              <span className={m.disabled?'tm-disabled':''}>{m.move}</span>
              <span className="tm-pp">{m.pp}/{m.maxpp} PP</span>
            </div>
          ))}
        </div>
      )}
      {isEnemy && Object.keys(seenMoves||{}).length > 0 && (
        <div className="tooltip-moves">
          <div className="ts-title">Замеченные атаки</div>
          {Object.entries(seenMoves).map(([moveName, uses], i) => (
            <div key={i} className="tm-row">
              <span>{moveName}</span>
              <span className="tm-pp" title="Раз использовано">×{uses}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BattleControls = ({ moves, sendAction, isWaiting, activePokemon, isForceSwitch,
  megaUsed, zMoveUsed, megaPending, zMovePending, onMegaToggle, onZMoveToggle }) => {

  // Проверяем можно ли мегаэволюция/Z-ход для активного покемона
  const canMega  = !megaUsed  && activePokemon?.canMegaEvo;
  const canZMove = !zMoveUsed && activePokemon?.canZMove;
  // Тип Z-кристалла определяем по предмету покемона
  const zCrystalType = activePokemon?.item ? (Z_CRYSTAL_TYPE[activePokemon.item] ?? null) : null;

  return (
  <div className="battle-menu">
    <div className="move-info-bar">
      {activePokemon&&(
        <span className="active-name">
          {activePokemon.name}
          {activePokemon.types?.map(t=>(
            <span key={t} className="type-badge-inline" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>
          ))}
        </span>
      )}
      {isForceSwitch && (
        <span className="force-switch-hint">⚠ Выберите замену ниже</span>
      )}
      {/* Мега / Z кнопки */}
      {!isForceSwitch && (canMega || canZMove || megaUsed || zMoveUsed) && (
        <div className="mega-z-bar">
          {(canMega || megaUsed) && (
            <button
              className={`mega-btn ${megaPending?'mega-active':''} ${megaUsed?'mega-done':''}`}
              onClick={!megaUsed ? onMegaToggle : undefined}
              disabled={isWaiting || megaUsed}
              title={megaUsed ? 'Мега-эволюция уже использована' : 'Мега-эволюция'}
            >
              {megaUsed ? '✓ Мега' : megaPending ? '⬡ Мега ВКЛ' : '⬡ Мега'}
            </button>
          )}
          {(canZMove || zMoveUsed) && (
            <button
              className={`zmove-btn ${zMovePending?'zmove-active':''} ${zMoveUsed?'zmove-done':''}`}
              onClick={!zMoveUsed ? onZMoveToggle : undefined}
              disabled={isWaiting || zMoveUsed}
              title={zMoveUsed ? 'Z-ход уже использован' : `Z-Ход${zCrystalType ? ` (${zCrystalType})` : ''}`}
            >
              {zMoveUsed ? '✓ Z-Ход' : zMovePending ? '◈ Z-Ход ВКЛ' : '◈ Z-Ход'}
            </button>
          )}
        </div>
      )}
    </div>
    <div className={`moves-layout${isForceSwitch?' moves-blocked':''}`}>
      {moves.length>0
        ? moves.map((m,i) => (
            <MoveButton
              key={i} move={m} index={i}
              sendAction={sendAction}
              isWaiting={isWaiting||isForceSwitch}
              zMovePending={zMovePending}
              zCrystalType={zCrystalType}
            />
          ))
        : <MoveButton
            key="struggle"
            move={{ move:'Struggle', pp:1, maxpp:1, disabled:false, id:'struggle' }}
            index={0} sendAction={sendAction}
            isWaiting={isWaiting||isForceSwitch}
            isStruggle
          />
      }
    </div>
    <div className="action-sidebar">
      <button className="act-btn run-btn" onClick={()=>window.location.href='/'}>↩ СБЕЖАТЬ</button>
    </div>
  </div>
  );
};

// Маппинг предмет → тип Z-кристалла
const Z_CRYSTAL_TYPE = {
  'Normalium Z':'Normal',   'Firium Z':'Fire',       'Waterium Z':'Water',
  'Electrium Z':'Electric', 'Grassium Z':'Grass',    'Icium Z':'Ice',
  'Fightinium Z':'Fighting','Poisonium Z':'Poison',  'Groundium Z':'Ground',
  'Flyinium Z':'Flying',    'Psychium Z':'Psychic',  'Buginium Z':'Bug',
  'Rockinium Z':'Rock',     'Ghostium Z':'Ghost',    'Dragonium Z':'Dragon',
  'Darkinium Z':'Dark',     'Steelium Z':'Steel',    'Fairium Z':'Fairy',
};

// Маппинг тип → Z-название
const Z_MOVE_NAMES = {
  Normal:'Breakneck Blitz', Fire:'Inferno Overdrive', Water:'Hydro Vortex',
  Electric:'Gigavolt Havoc', Grass:'Bloom Doom', Ice:'Subzero Slammer',
  Fighting:'All-Out Pummeling', Poison:'Acid Downpour', Ground:'Tectonic Rage',
  Flying:'Supersonic Skystrike', Psychic:'Shattered Psyche', Bug:'Savage Spin-Out',
  Rock:'Continental Crush', Ghost:'Never-Ending Nightmare', Dragon:'Devastating Drake',
  Dark:'Black Hole Eclipse', Steel:'Corkscrew Crash', Fairy:'Twinkle Tackle',
};

const MoveButton = ({ move, index, sendAction, isWaiting, isStruggle, zMovePending, zCrystalType }) => {
  const allPpZero = !isStruggle && move.pp === 0 && move.maxpp > 0;
  const isActualStruggle = isStruggle || allPpZero;
  const displayMove = allPpZero ? { move:'Struggle', pp:1, maxpp:1, disabled:false } : move;

  // Тип атаки — валидируем что это реальный тип (не имя атаки)
  const rawType  = displayMove.type || null;
  const moveType = (rawType && TYPE_COLORS[rawType]) ? rawType : null;

  // Z совместим если тип АТАКИ совпадает с типом Z-КРИСТАЛЛА
  // (Psychium Z + Psychic атака = можно, независимо от типа покемона)
  // Если zCrystalType неизвестен — разрешаем все атаки (fallback)
  const isZCompatible   = zMovePending && (!zCrystalType || (moveType && moveType === zCrystalType));
  const isZIncompatible = zMovePending && zCrystalType && !isZCompatible && !isActualStruggle;
  const zName = (isZCompatible && moveType) ? (Z_MOVE_NAMES[moveType] || displayMove.move) : null;

  const ppPct = displayMove.maxpp>0?(displayMove.pp/displayMove.maxpp)*100:0;
  const ppCls = ppPct<=25?'pp-critical':ppPct<=50?'pp-low':'';
  const typeClr = moveType ? (TYPE_COLORS[moveType]||'#555') : null;

  const handleClick = () => {
    if (isActualStruggle) { sendAction('move 1', false); return; }
    // Передаём флаг isZ чтобы sendAction добавил суффикс только для совместимых атак
    sendAction(`move ${index+1}`, isZCompatible);
  };

  return (
    <button
      className={[
        'move-card',
        displayMove.disabled && !isActualStruggle ? 'move-disabled' : '',
        isActualStruggle ? 'move-struggle' : '',
        isZCompatible   ? 'move-z-active' : '',
        isZIncompatible ? 'move-z-dim'    : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      disabled={isWaiting || (displayMove.disabled && !isActualStruggle)}
      title={isZIncompatible ? `Нужна атака типа ${zCrystalType}` : undefined}
    >
      <div className="move-top">
        <span className="move-name">{zName || displayMove.move}</span>
        {typeClr && <span className="move-type-badge" style={{background:typeClr}}>{moveType}</span>}
        {displayMove.disabled && !isActualStruggle && <span className="move-locked">🔒</span>}
        {isActualStruggle && <span className="move-locked">⚡</span>}
        {isZCompatible && <span className="move-z-icon">⚡Z</span>}
      </div>
      <div className="move-bottom">
        {isActualStruggle
          ? <span className="move-pp">Нет PP — авто-атака</span>
          : <>
              <span className={`move-pp ${ppCls}`}>PP: {displayMove.pp}/{displayMove.maxpp}</span>
              <div className="pp-mini-bar"><div className={`pp-fill ${ppCls}`} style={{width:`${ppPct}%`}}/></div>
            </>
        }
      </div>
    </button>
  );
};

const WaitingPanel = ({ lastMove }) => (
  <div className="waiting-panel">
    <div className="waiting-spinner"/>
    <div className="waiting-text">Ожидание противника...</div>
    {lastMove&&<div className="waiting-last-move">Последняя атака: {lastMove}</div>}
  </div>
);

const WinScreen = ({ winner, myName, onExit }) => (
  <div className="win-screen">
    <div className={`win-title ${winner===myName?'win-victory':'win-defeat'}`}>
      {winner===myName?'🏆 ПОБЕДА!':'💀 ПОРАЖЕНИЕ'}
    </div>
    <div className="win-subtitle">{winner} победил!</div>
    <button className="win-btn" onClick={onExit}>ЗАВЕРШИТЬ БОЙ</button>
  </div>
);

const PartyStrip = ({ mySide, sendAction, isWaiting, isForceSwitch }) => {
  const [hoveredNum, setHoveredNum] = useState(null);
  const sorted = [...(mySide?.pokemon||[])].sort((a,b)=>a.num-b.num);

  return (
    <div className={`party-strip${isForceSwitch ? ' party-strip-force' : ''}`}>
      {isForceSwitch && (
        <div className="party-strip-label">⚠ Выберите замену:</div>
      )}
      <div className="party-strip-slots">
        {sorted.map(p => {
          const isFainted = p.fainted || p.condition?.startsWith('0');
          const isActive  = p.active;
          const canSwitch = !isActive && !isFainted && !isWaiting;
          const hpPct     = p.maxhp > 0 ? (p.hp / p.maxhp) * 100 : 0;
          const hpCls     = hpPct < 20 ? 'critical' : hpPct < 50 ? 'low' : '';

          return (
            <div
              key={p.num}
              className={[
                'pslot',
                isActive   ? 'pslot-active'   : '',
                isFainted  ? 'pslot-fainted'  : '',
                canSwitch && isForceSwitch ? 'pslot-pick' : '',
                canSwitch && !isForceSwitch ? 'pslot-idle' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => canSwitch && sendAction(`switch ${p.num}`)}
              onMouseEnter={() => setHoveredNum(p.num)}
              onMouseLeave={() => setHoveredNum(null)}
            >
              <div className="pslot-img-wrap">
                <img
                  src={getSpriteFront(p.name)} alt={p.name}
                  className="pslot-sprite"
                  onError={makeFallback(p.name, false)}
                />
                {isFainted && <div className="pslot-fnt">✕</div>}
                {isActive  && <div className="pslot-active-ring"/>}
              </div>

              <div className="pslot-hpbar-bg">
                <div className={`pslot-hpbar-fill ${hpCls}`} style={{width:`${Math.max(0,hpPct)}%`}}/>
              </div>
              <div className="pslot-name">{p.name}</div>

              {hoveredNum === p.num && (
                <div className="pslot-tooltip">
                  <div className="pstt-head">
                    <span className="pstt-name">{p.name}</span>
                    <span className="pstt-lv">Ур.{p.level||100}</span>
                    {p.status && (
                      <span className="pstt-status" style={{background:STATUS_COLORS[p.status]}}>{STATUS_NAMES[p.status]?.slice(0,3)||p.status}</span>
                    )}
                  </div>
                  {p.types && (
                    <div className="pstt-types">
                      {p.types.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}
                    </div>
                  )}
                  <div className="pstt-hp-row">
                    <div className="pstt-hpbar">
                      <div className={`pslot-hpbar-fill ${hpCls}`} style={{width:`${Math.max(0,hpPct)}%`}}/>
                    </div>
                    <span className="pstt-hptxt">{isFainted ? 'К.О.' : `${Math.ceil(hpPct)}%`}</span>
                  </div>
                  {p.ability && <div className="pstt-row">Способность: <b>{p.ability}</b></div>}
                  {p.item    && <div className="pstt-row">Предмет: <b>{p.item}</b></div>}
                  <div className={`pstt-hint ${isActive?'hint-active':isFainted?'hint-fnt':canSwitch?'hint-switch':''}`}>
                    {isActive ? '⚔ В бою' : isFainted ? '✕ Без сознания' : '↩ Нажмите чтобы выставить'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


const PreviewPhase = ({ side, enemySide, sendAction, isWaiting }) => {
  const myList    = [...(side?.pokemon||[])].sort((a,b)=>a.num-b.num);
  const enemyList = [...(enemySide?.pokemon||[])].sort((a,b)=>a.num-b.num);
  return (
    <div className="preview-screen">
      <div className="preview-section">
        <div className="preview-label">Команда противника</div>
        <div className="preview-team-list">
          {enemyList.map(p=>(
            <div key={p.num} className="preview-mon-card enemy">
              <img src={getSpriteFront(p.name)} alt={p.name} className="preview-sprite" onError={makeFallback(p.name,false)}/>
              <span className="preview-name">{p.name}</span>
              <div className="preview-types">{p.types?.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}</div>
              {p.baseStats&&<span className="preview-bst">BST: {Object.values(p.baseStats).reduce((a,b)=>a+b,0)}</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="preview-divider">⚔ Выберите первого покемона ⚔</div>
      <div className="preview-team-list">
        {myList.map(p=>(
          <button key={p.num} onClick={()=>sendAction(`team ${p.num}`)} disabled={isWaiting} className="preview-mon-card player">
            <img src={getSpriteFront(p.name)} alt={p.name} className="preview-sprite" onError={makeFallback(p.name,false)}/>
            <span className="preview-name">{p.name}</span>
            <div className="preview-types">{p.types?.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}</div>
            {p.baseStats&&<span className="preview-bst">BST: {Object.values(p.baseStats).reduce((a,b)=>a+b,0)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

const LogPanel = ({ logs, logEndRef }) => {
  // Дедупликация: убираем подряд идущие одинаковые строки
  const deduped = logs.filter((log, i) => {
    if (i === 0) return true;
    return log.text !== logs[i-1].text;
  });
  return (
    <div className="log-container">
      {deduped.map((log,i)=><div key={i} className={`log-entry ${log.cls||''} log-entry-anim`}>{log.text}</div>)}
      <div ref={logEndRef}/>
    </div>
  );
};

// ── Инжектируемые стили для мега/Z/тип-бейджа и тултипов ────
const injectStyles = () => {
  if (document.getElementById('bs-extra-styles')) return;
  const s = document.createElement('style');
  s.id = 'bs-extra-styles';
  s.textContent = `
    /* ── Мега / Z кнопки ── */
    .mega-z-bar { display:flex; gap:8px; align-items:center; margin-left:auto; }
    .mega-btn, .zmove-btn {
      display:flex; align-items:center; gap:5px; padding:5px 13px;
      border-radius:20px; border:none; cursor:pointer; font-size:12px;
      font-weight:700; letter-spacing:.4px; transition:all .2s;
    }
    .mega-btn { background:linear-gradient(135deg,#8e44ad,#c0392b); color:#fff; box-shadow:0 0 10px rgba(192,57,43,.35); }
    .mega-btn:hover:not(:disabled) { transform:scale(1.05); box-shadow:0 0 18px rgba(192,57,43,.6); }
    .mega-btn.mega-active { background:linear-gradient(135deg,#e74c3c,#c0392b); box-shadow:0 0 22px rgba(231,76,60,.8); animation:mz-pulse 1s infinite; }
    .mega-btn.mega-done   { background:#2a2f3e; color:#555; cursor:default; box-shadow:none; }
    .zmove-btn { background:linear-gradient(135deg,#e67e22,#f39c12); color:#fff; box-shadow:0 0 10px rgba(243,156,18,.3); }
    .zmove-btn:hover:not(:disabled) { transform:scale(1.05); box-shadow:0 0 18px rgba(243,156,18,.6); }
    .zmove-btn.zmove-active { background:linear-gradient(135deg,#f1c40f,#f39c12); color:#1a1a1a; box-shadow:0 0 22px rgba(241,196,15,.8); animation:mz-pulse 1s infinite; }
    .zmove-btn.zmove-done   { background:#2a2f3e; color:#555; cursor:default; box-shadow:none; }
    @keyframes mz-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
    .move-z-active { border:2px solid #f1c40f !important; box-shadow:0 0 12px rgba(241,196,15,.5) !important; }
    .move-z-dim    { opacity:.4; filter:grayscale(.5); }
    .move-z-icon   { font-size:10px; font-weight:900; color:#f1c40f; margin-left:4px; text-shadow:0 0 6px #f1c40f; }
    .move-type-badge { font-size:9px; font-weight:700; padding:1px 5px; border-radius:8px; color:#fff; text-transform:uppercase; margin-left:4px; flex-shrink:0; }

    /* ── PartyIconItem tooltip (pit-*) ── */
    .party-icon-wrap { position:relative; }
    .party-icon-tooltip {
      position:absolute; z-index:9999; min-width:190px; max-width:230px;
      background:#151a28; border:1px solid #2e3a55;
      border-radius:10px; padding:10px 12px;
      font-size:12px; color:#c8d0e0; line-height:1.4;
      box-shadow:0 6px 28px rgba(0,0,0,.7);
      pointer-events:none;
    }
    .pit-enemy { bottom:110%; left:50%; transform:translateX(-50%); }
    .pit-player { top:110%; left:50%; transform:translateX(-50%); }
    .pit-head { display:flex; align-items:center; gap:5px; margin-bottom:5px; }
    .pit-name { color:#e8eaf6; font-size:13px; font-weight:700; }
    .pit-lv   { color:#8892a4; font-size:11px; margin-left:auto; white-space:nowrap; }
    .pit-status-badge { font-size:9px; padding:1px 6px; border-radius:6px; color:#fff; font-weight:700; }
    .pit-types { display:flex; gap:3px; flex-wrap:wrap; margin-bottom:6px; }
    .pit-hp-row { display:flex; align-items:center; gap:6px; margin-bottom:7px; }
    .pit-hp-bar { flex:1; height:7px; background:#1a2035; border-radius:4px; overflow:hidden; }
    .pit-hp-fill { height:100%; border-radius:4px; transition:width .3s; }
    .pit-hp-fill.good     { background:linear-gradient(90deg,#27ae60,#2ecc71); }
    .pit-hp-fill.low      { background:linear-gradient(90deg,#e67e22,#f39c12); }
    .pit-hp-fill.critical { background:linear-gradient(90deg,#c0392b,#e74c3c); }
    .pit-hp-text { font-size:11px; color:#8892a4; white-space:nowrap; min-width:36px; text-align:right; }
    .pit-stats { display:flex; flex-direction:column; gap:3px; margin-bottom:6px; padding:6px 0; border-top:1px solid #1e2740; border-bottom:1px solid #1e2740; }
    .pit-stat-row { display:flex; align-items:center; gap:5px; }
    .pit-stat-name { width:22px; font-size:10px; color:#6a7590; flex-shrink:0; }
    .pit-stat-bar  { flex:1; height:5px; background:#1a2035; border-radius:3px; overflow:hidden; }
    .pit-stat-val   { font-size:10px; color:#c8d0e0; width:26px; text-align:right; flex-shrink:0; font-weight:600; }
    .pit-stat-final { font-size:10px; color:#5dade2; min-width:30px; }
    .pit-moves { border-top:1px solid #1e2740; padding-top:6px; margin-top:3px; }
    .pit-move-row { display:flex; justify-content:space-between; font-size:11px; padding:2px 0; }
    .pit-move-name { color:#c8d0e0; }
    .pit-move-pp   { color:#8892a4; }
    .pit-move-disabled .pit-move-name { color:#e74c3c; }
    .pit-row { font-size:11px; color:#8892a4; margin-top:3px; }
    .pit-row b { color:#c8d0e0; }
  `;
  document.head.appendChild(s);
};

export default BattleScreen;
