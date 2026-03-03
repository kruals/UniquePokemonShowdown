import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './BattleScreen.css';

// ============================================================
// LOG PARSER
// ============================================================
const parseLog = (line) => {
  const parts = line.split('|');
  if (parts.length < 2) return null;
  const type = parts[1];
  switch (type) {
    case 'move':      return { type: 'move',   pokemon: cleanPokeName(parts[2]), move: parts[3], target: cleanPokeName(parts[4]) };
    case 'switch':
    case 'drag':      return { type: 'switch', pokemon: cleanPokeName(parts[2]), details: parts[3], hp: parts[4] };
    case 'faint':     return { type: 'faint',  pokemon: cleanPokeName(parts[2]) };
    case '-damage':   return { type: 'damage', pokemon: cleanPokeName(parts[2]), hp: parts[3], from: parts[4] };
    case '-heal':     return { type: 'heal',   pokemon: cleanPokeName(parts[2]), hp: parts[3], from: parts[4] };
    case '-status':   return { type: 'status', pokemon: cleanPokeName(parts[2]), status: parts[3] };
    case '-curestatus': return { type: 'curestatus', pokemon: cleanPokeName(parts[2]) };
    case '-boost':    return { type: 'boost',   pokemon: cleanPokeName(parts[2]), stat: parts[3], amount: parseInt(parts[4]) };
    case '-unboost':  return { type: 'unboost', pokemon: cleanPokeName(parts[2]), stat: parts[3], amount: parseInt(parts[4]) };
    case '-clearallboost':
    case '-clearboost': return { type: 'clearboost', pokemon: cleanPokeName(parts[2]) };
    case '-weather':  return { type: 'weather', weather: parts[2], upkeep: parts[3] === '[upkeep]' };
    case '-fieldstart': return { type: 'fieldstart', condition: parts[2] };
    case '-fieldend':   return { type: 'fieldend',   condition: parts[2] };
    case '-sidestart':  return { type: 'sidestart',  side: parts[2], condition: parts[3] };
    case '-sideend':    return { type: 'sideend',    side: parts[2], condition: parts[3] };
    case '-supereffective': return { type: 'supereffective' };
    case '-resisted':   return { type: 'resisted' };
    case '-immune':     return { type: 'immune' };
    case '-crit':       return { type: 'crit' };
    case '-miss':       return { type: 'miss' };
    case '-fail':       return { type: 'fail',   pokemon: cleanPokeName(parts[2]) };
    case 'win':         return { type: 'win',    winner: parts[2] };
    case 'turn':        return { type: 'turn',   num: parseInt(parts[2]) };
    case '-item':       return { type: 'item',   pokemon: cleanPokeName(parts[2]), item: parts[3] };
    case '-ability':    return { type: 'ability', pokemon: cleanPokeName(parts[2]), ability: parts[3] };
    case 'cant':        return { type: 'cant',   pokemon: cleanPokeName(parts[2]), reason: parts[3] };
    case 'detailschange':
    case '-formechange': return { type: 'formechange', pokemon: cleanPokeName(parts[2]), details: parts[3] };
    case '-start':      return { type: 'volstart', pokemon: cleanPokeName(parts[2]), effect: parts[3] };
    case '-end':        return { type: 'volend',   pokemon: cleanPokeName(parts[2]), effect: parts[3] };
    default: return null;
  }
};

const cleanPokeName = (str) => {
  if (!str) return '';
  return str.includes(': ') ? str.split(': ')[1] : str;
};

const getSide = (line) => line.includes('|p1') ? 'p1' : 'p2';

const formatLogLine = (line) => {
  const p = parseLog(line);
  if (!p) return null;
  switch (p.type) {
    case 'move':         return { text: `▶ ${p.pokemon} использует ${p.move}!`, cls: 'log-move' };
    case 'switch':       return { text: `↩ ${p.pokemon} выходит на поле!`, cls: 'log-switch' };
    case 'faint':        return { text: `☠ ${p.pokemon} потерял сознание!`, cls: 'log-faint' };
    case 'damage': {
      const from = p.from ? ` [${p.from.replace(/\[from\] /, '')}]` : '';
      return { text: `💥 ${p.pokemon} получает урон${from}`, cls: 'log-damage' };
    }
    case 'heal':         return { text: `💚 ${p.pokemon} восстанавливает HP`, cls: 'log-heal' };
    case 'status':       return { text: `🔸 ${p.pokemon}: ${STATUS_NAMES[p.status] || p.status}`, cls: 'log-status' };
    case 'curestatus':   return { text: `✨ ${p.pokemon} избавляется от статуса`, cls: 'log-cure' };
    case 'boost':        return { text: `📈 ${p.pokemon}: ${STAT_NAMES[p.stat]} +${p.amount}`, cls: 'log-boost' };
    case 'unboost':      return { text: `📉 ${p.pokemon}: ${STAT_NAMES[p.stat]} -${p.amount}`, cls: 'log-unboost' };
    case 'clearboost':   return { text: `🔄 Все статы сброшены (Haze)!`, cls: 'log-cure' };
    case 'weather':      return { text: `🌦 ${WEATHER_NAMES[p.weather] || p.weather}`, cls: 'log-weather' };
    case 'supereffective': return { text: `⚡ Суперэффективно!`, cls: 'log-super' };
    case 'resisted':     return { text: `🛡 Не очень эффективно...`, cls: 'log-resist' };
    case 'immune':       return { text: `🚫 Не действует!`, cls: 'log-immune' };
    case 'crit':         return { text: `💢 Критический удар!`, cls: 'log-crit' };
    case 'miss':         return { text: `✗ Промах!`, cls: 'log-miss' };
    case 'fail':         return { text: `✗ Атака не удалась!`, cls: 'log-fail' };
    case 'win':          return { text: `🏆 Победитель: ${p.winner}!`, cls: 'log-win' };
    case 'turn':         return { text: `─── Ход ${p.num} ───`, cls: 'log-turn' };
    case 'item':         return { text: `🎒 ${p.pokemon} использует ${p.item}`, cls: 'log-item' };
    case 'ability':      return { text: `✦ ${p.ability} (${p.pokemon})`, cls: 'log-ability' };
    case 'cant':         return { text: `✗ ${p.pokemon} не может атаковать!`, cls: 'log-cant' };
    case 'formechange':  return { text: `✨ ${p.pokemon} изменяет форму!`, cls: 'log-switch' };
    case 'volstart': {
      const n = VOLATILE_NAMES[p.effect] || p.effect?.replace('move: ','') || p.effect;
      return { text: `🔺 ${p.pokemon}: ${n}!`, cls: 'log-status' };
    }
    case 'volend': {
      const n = VOLATILE_NAMES[p.effect] || p.effect?.replace('move: ','') || p.effect;
      return { text: `🔻 ${p.pokemon}: ${n} закончился`, cls: 'log-cure' };
    }
    case 'sidestart':
      return { text: `⚠ ${HAZARD_NAMES[p.condition] || p.condition} установлен!`, cls: 'log-status' };
    case 'sideend':
      return { text: `✓ ${HAZARD_NAMES[p.condition] || p.condition} убран`, cls: 'log-cure' };
    case 'fieldstart':
      return { text: `🌀 ${FIELD_NAMES[p.condition] || p.condition} активирован!`, cls: 'log-weather' };
    case 'fieldend':
      return { text: `🌀 ${FIELD_NAMES[p.condition] || p.condition} закончился`, cls: 'log-cure' };
    default: return null;
  }
};

// ============================================================
// КОНСТАНТЫ
// ============================================================
const STATUS_NAMES  = { brn:'Ожог', par:'Паралич', psn:'Отравление', tox:'Сильное отравление', slp:'Сон', frz:'Заморозка' };
const STATUS_COLORS = { brn:'#e67e22', par:'#f1c40f', psn:'#9b59b6', tox:'#8e44ad', slp:'#95a5a6', frz:'#3498db' };
const STAT_NAMES    = { hp:'HP', atk:'Атака', def:'Защита', spa:'Сп.Атк', spd:'Сп.Защ', spe:'Скорость', acc:'Точность', eva:'Уклонение' };
const STAT_KEYS     = ['hp','atk','def','spa','spd','spe'];

const WEATHER_NAMES = { SunnyDay:'☀️ Сильная жара', RainDance:'🌧 Ливень', Sandstorm:'🌪 Песчаная буря', Hail:'❄️ Град', Snow:'❄️ Снег', none:'☁️ Погода нормализовалась' };
const WEATHER_DUR   = { SunnyDay:5, RainDance:5, Sandstorm:5, Hail:5, Snow:5 };
const WEATHER_ICON  = { SunnyDay:'☀️', RainDance:'🌧', Sandstorm:'🌪', Hail:'❄️', Snow:'❄️' };
const WEATHER_CLR   = { SunnyDay:'#f39c12', RainDance:'#3498db', Sandstorm:'#d4ac0d', Hail:'#85c1e9', Snow:'#85c1e9' };

const HAZARD_NAMES  = {
  'Stealth Rock':'Острые камни', 'move: Stealth Rock':'Острые камни',
  'Spikes':'Шипы', 'move: Spikes':'Шипы',
  'Toxic Spikes':'Ядовитые шипы', 'move: Toxic Spikes':'Ядовитые шипы',
  'Sticky Web':'Липкая паутина', 'move: Sticky Web':'Липкая паутина',
};
const FIELD_NAMES   = {
  'move: Trick Room':'Комната трюков', 'move: Magic Room':'Волшебная комната',
  'move: Wonder Room':'Комната чудес', 'move: Gravity':'Гравитация',
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

const TYPE_COLORS = {
  Normal:'#A8A878',Fire:'#F08030',Water:'#6890F0',Electric:'#F8D030',
  Grass:'#78C850',Ice:'#98D8D8',Fighting:'#C03028',Poison:'#A040A0',
  Ground:'#E0C068',Flying:'#A890F0',Psychic:'#F85888',Bug:'#A8B820',
  Rock:'#B8A038',Ghost:'#705898',Dragon:'#7038F8',Dark:'#705848',
  Steel:'#B8B8D0',Fairy:'#EE99AC',
};

// Стат-стейдж множители
const BOOST_MULT = {'-6':0.25,'-5':0.28,'-4':0.33,'-3':0.4,'-2':0.5,'-1':0.67,'0':1,'1':1.5,'2':2,'3':2.5,'4':3,'5':3.5,'6':4};

// Nature модификаторы
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

// ============================================================
// УТИЛИТЫ
// ============================================================
const calcFinalStat = (pokemon, statKey) => {
  if (!pokemon?.baseStats) return null;
  const base = pokemon.baseStats[statKey] ?? 0;
  const lvl  = parseInt(pokemon.level) || 100;
  const ev   = pokemon.evs?.[statKey]  ?? 0;
  const iv   = pokemon.ivs?.[statKey]  ?? 31;
  const nmod = (NATURE_MOD[pokemon.nature] || NATURE_MOD['Serious'])[statKey] ?? 1;
  if (statKey === 'hp') {
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * lvl) / 100) + lvl + 10;
  }
  return Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * lvl) / 100) + 5) * nmod);
};

const calcBoostedStat = (pokemon, statKey, boosts) => {
  if (statKey === 'hp') return null;
  const base = calcFinalStat(pokemon, statKey);
  if (base === null) return null;
  const stage = Math.max(-6, Math.min(6, boosts?.[statKey] ?? 0));
  return Math.floor(base * (BOOST_MULT[String(stage)] ?? 1));
};

// Спрайты — цепочка фоллбеков
const getSpriteFront = (name) =>
  `https://play.pokemonshowdown.com/sprites/ani/${name.toLowerCase().replace(/[^a-z0-9-]/g,'')}.gif`;
const getSpriteBack = (name) =>
  `https://play.pokemonshowdown.com/sprites/ani-back/${name.toLowerCase().replace(/[^a-z0-9-]/g,'')}.gif`;

const makeFallback = (name, isBack) => {
  let tries = 0;
  return (e) => {
    tries++;
    const safe = name.toLowerCase().replace(/[^a-z0-9-]/g,'');
    const safeName = name.toLowerCase().replace(/\s+/g,'_');
    if (tries === 1) e.target.src = isBack
      ? `https://play.pokemonshowdown.com/sprites/gen5-back/${safe}.png`
      : `https://play.pokemonshowdown.com/sprites/gen5/${safe}.png`;
    else if (tries === 2) e.target.src = `/image_pokemons/${safeName}.gif`;
    else if (tries === 3) e.target.src = `/image_pokemons/${safeName}.png`;
    else e.target.style.display = 'none';
  };
};

// ============================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================
const BattleScreen = ({ socket, user }) => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const logEndRef = useRef(null);
  const { opponentName, battleId } = location.state || {};

  const [isWaiting,    setIsWaiting]    = useState(false);
  const [showParty,    setShowParty]    = useState(false);
  const [playerRole,   setPlayerRole]   = useState(null);

  const [boosts,       setBoosts]       = useState({ p1:{}, p2:{} });
  const [statuses,     setStatuses]     = useState({});
  const [volatiles,    setVolatiles]    = useState({});
  const [weather,      setWeather]      = useState(null);
  const [weatherTurns, setWeatherTurns] = useState(0);
  const [hazards,      setHazards]      = useState({ p1:[], p2:[] });
  const [animHit,      setAnimHit]      = useState({ p1:false, p2:false });
  const [lastMove,     setLastMove]     = useState(null);
  const [seenMoves,    setSeenMoves]    = useState({});

  const [gameState, setGameState] = useState({
    side1: null, side2: null, logs: [], winner: null, requestState: null,
  });

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [gameState.logs]);

  useEffect(() => {
    if (!battleId) { navigate('/'); return; }
    if (socket) socket.emit('join_battle', battleId);
  }, [socket, battleId, navigate]);

  const processLog = useCallback((logLines) => {
    logLines.forEach(line => {
      const p = parseLog(line);
      if (!p) return;
      const side = getSide(line);

      switch (p.type) {
        case 'weather':
          if (p.weather === 'none') { setWeather(null); setWeatherTurns(0); }
          else if (!p.upkeep) { setWeather(p.weather); setWeatherTurns(WEATHER_DUR[p.weather]||5); }
          else setWeatherTurns(t => Math.max(0, t - 1));
          break;
        case 'boost':
          setBoosts(prev => ({ ...prev, [side]:{ ...prev[side], [p.stat]:(prev[side][p.stat]||0)+p.amount } }));
          break;
        case 'unboost':
          setBoosts(prev => ({ ...prev, [side]:{ ...prev[side], [p.stat]:(prev[side][p.stat]||0)-p.amount } }));
          break;
        case 'clearboost':
          // Haze — сбрасываем все бусты у ОБОИХ
          setBoosts({ p1:{}, p2:{} });
          break;
        case 'switch':
          setBoosts(prev => ({ ...prev, [side]:{} }));
          setVolatiles(prev => { const n={...prev}; delete n[p.pokemon]; return n; });
          break;
        case 'status':
          setStatuses(prev => ({ ...prev, [p.pokemon]: p.status }));
          break;
        case 'curestatus':
          setStatuses(prev => { const n={...prev}; delete n[p.pokemon]; return n; });
          break;
        case 'damage':
          setAnimHit(prev => ({ ...prev, [side]:true }));
          setTimeout(() => setAnimHit(prev => ({ ...prev, [side]:false })), 500);
          break;
        case 'move':
          setLastMove(p.move);
          setSeenMoves(prev => {
            const ex = prev[p.pokemon] || [];
            if (!ex.includes(p.move)) return { ...prev, [p.pokemon]:[...ex, p.move] };
            return prev;
          });
          break;
        case 'volstart':
          if (VISIBLE_VOLATILE.includes(p.effect))
            setVolatiles(prev => ({ ...prev, [p.pokemon]:[...(prev[p.pokemon]||[]), p.effect] }));
          break;
        case 'volend':
          setVolatiles(prev => ({ ...prev, [p.pokemon]:(prev[p.pokemon]||[]).filter(e=>e!==p.effect) }));
          break;
        case 'sidestart': {
          const hname = HAZARD_NAMES[p.condition] || p.condition;
          const hs = p.side?.startsWith('p1') ? 'p1' : 'p2';
          setHazards(prev => ({ ...prev, [hs]: prev[hs].includes(hname) ? prev[hs] : [...prev[hs], hname] }));
          break;
        }
        case 'sideend': {
          const hname = HAZARD_NAMES[p.condition] || p.condition;
          const hs = p.side?.startsWith('p1') ? 'p1' : 'p2';
          setHazards(prev => ({ ...prev, [hs]: prev[hs].filter(h=>h!==hname) }));
          break;
        }
        default: break;
      }
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (data) => {
      if (!data) return;
      setGameState(prev => {
        let role = playerRole;
        if (!role && data.side1 && data.side2) {
          if ((data.side1.name||'').trim()===user.username.trim()) role='p1';
          else if ((data.side2.name||'').trim()===user.username.trim()) role='p2';
          if (role) setPlayerRole(role);
        }
        if (data.log) processLog(data.log);
        const newLogs = (data.log||[]).map(formatLogLine).filter(Boolean);
        return {
          ...prev,
          side1: data.side1||prev.side1, side2: data.side2||prev.side2,
          winner: data.winner||prev.winner,
          logs: [...prev.logs, ...newLogs],
          requestState: data.requestState,
        };
      });
      setIsWaiting(false);
    };
    socket.on('battle_update', handleUpdate);
    return () => socket.off('battle_update');
  }, [socket, user.username, playerRole, processLog]);

  const sendAction = useCallback((action) => {
    if (isWaiting || gameState.winner) return;
    setIsWaiting(true);
    socket.emit('battle_action', { battleId, username: user.username, action });
  }, [isWaiting, gameState.winner, socket, battleId, user.username]);

  const mySide       = playerRole === 'p1' ? gameState.side1 : gameState.side2;
  const enemySide    = playerRole === 'p1' ? gameState.side2 : gameState.side1;
  const myRole       = playerRole || 'p1';
  const enemyRole    = playerRole === 'p1' ? 'p2' : 'p1';
  const myBoosts     = boosts[myRole];
  const enemyBoosts  = boosts[enemyRole];
  const myHazards    = hazards[myRole];
  const enemyHazards = hazards[enemyRole];

  const getUIPhase = () => {
    if (gameState.winner) return 'ended';
    const rs = mySide?.requestState;
    if (!rs || rs === '') return 'wait';
    switch (rs) {
      case 'teampreview': return 'preview';
      case 'switch': return 'switch';
      case 'move': return 'battle';
      default: return 'wait';
    }
  };

  const currentPhase  = getUIPhase();
  const activePokemon = mySide?.pokemon?.[mySide?.activeIdx];
  const activeEnemy   = enemySide?.pokemon?.[enemySide?.activeIdx];
  const activeMoves   = activePokemon?.moveSlots || [];

  useEffect(() => {
    if (currentPhase === 'switch') setShowParty(true);
  }, [currentPhase]);

  return (
    <div className="battle-wrapper">
      {weather && <WeatherOverlay weather={weather} />}

      <div className="battle-header">
        <TrainerInfo name={user.username} side={mySide} isPlayer />
        <div className="header-center">
          {weather
            ? <WeatherBadge weather={weather} turns={weatherTurns} />
            : <div className="vs-circle">⚔</div>
          }
        </div>
        <TrainerInfo name={opponentName} side={enemySide} isPlayer={false} />
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
                  boosts={enemyBoosts} statuses={statuses}
                  volatiles={volatiles} isHit={animHit[enemyRole]}
                  seenMoves={seenMoves[activeEnemy.name] || []}
                />
              )}
            </div>
            <div className="field-player">
              {activePokemon && (
                <PokemonOnField
                  pokemon={activePokemon} isEnemy={false}
                  boosts={myBoosts} statuses={statuses}
                  volatiles={volatiles} isHit={animHit[myRole]}
                  seenMoves={[]}
                />
              )}
              <HazardDisplay hazards={myHazards} flip />
            </div>
            <PartyIcons side={mySide}    position="bottom" />
            <PartyIcons side={enemySide} position="top" />
          </div>
        )}
      </div>

      <div className="ui-panel">
        <LogPanel logs={gameState.logs} logEndRef={logEndRef} />
        <div className="controls-container">
          {currentPhase === 'ended' ? (
            <WinScreen winner={gameState.winner} myName={user.username} onExit={() => navigate('/')} />
          ) : (currentPhase === 'wait' || isWaiting) ? (
            <WaitingPanel lastMove={lastMove} />
          ) : currentPhase === 'preview' ? (
            <div className="waiting-text">👆 Выберите первого покемона выше</div>
          ) : (
            <BattleControls
              moves={activeMoves} sendAction={sendAction}
              setShowParty={setShowParty} isWaiting={isWaiting}
              activePokemon={activePokemon}
            />
          )}
        </div>
      </div>

      {showParty && (
        <PartyModal
          mySide={mySide} sendAction={sendAction}
          setShowParty={setShowParty} isWaiting={isWaiting}
          isForceSwitch={currentPhase === 'switch'}
        />
      )}
    </div>
  );
};

// ============================================================
// WEATHER BADGE
// ============================================================
const WeatherBadge = ({ weather, turns }) => (
  <div className="weather-badge" style={{ borderColor: WEATHER_CLR[weather]||'#aaa', color: WEATHER_CLR[weather]||'#aaa' }}>
    <span className="weather-icon">{WEATHER_ICON[weather]}</span>
    <span className="weather-name">{WEATHER_NAMES[weather]?.replace(/^[^\s]+\s/, '')}</span>
    {turns > 0 && (
      <div className="weather-turns">
        {Array.from({length: Math.min(turns, 8)}).map((_,i) => (
          <span key={i} className="weather-dot" style={{ background: WEATHER_CLR[weather]||'#aaa' }} />
        ))}
        <span className="weather-turns-num">{turns}</span>
      </div>
    )}
  </div>
);

// ============================================================
// WEATHER OVERLAY
// ============================================================
const WeatherOverlay = ({ weather }) => {
  const cls = { SunnyDay:'weather-sun', RainDance:'weather-rain', Sandstorm:'weather-sand', Hail:'weather-hail', Snow:'weather-snow' };
  return <div className={`weather-overlay ${cls[weather]||''}`} />;
};

// ============================================================
// HAZARD DISPLAY
// ============================================================
const HazardDisplay = ({ hazards, flip }) => {
  if (!hazards?.length) return null;
  return (
    <div className={`hazard-display ${flip ? 'hazard-flip' : ''}`}>
      {hazards.map((h,i) => <span key={i} className="hazard-badge">⚠ {h}</span>)}
    </div>
  );
};

// ============================================================
// TRAINER INFO
// ============================================================
const TrainerInfo = ({ name, side, isPlayer }) => {
  const pokemon = side?.pokemon || [];
  return (
    <div className={`trainer-info ${isPlayer ? 'trainer-player' : 'trainer-enemy'}`}>
      <span className="trainer-name">{name}{isPlayer ? ' (Вы)' : ''}</span>
      <div className="team-dots">
        {pokemon.map((p,i) => (
          <span key={i} className={`team-dot ${p.fainted ? 'dot-fainted' : p.active ? 'dot-active' : 'dot-alive'}`} title={p.name} />
        ))}
      </div>
    </div>
  );
};

// ============================================================
// POKEMON ON FIELD
// ============================================================
const PokemonOnField = ({ pokemon, isEnemy, boosts, statuses, volatiles, isHit, seenMoves }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const status      = statuses[pokemon.name];
  const myVols      = (volatiles[pokemon.name]||[]).filter(e => VISIBLE_VOLATILE.includes(e));
  const hasSub      = myVols.some(e => e.includes('Substitute'));
  const hpPct       = pokemon.maxhp > 0 ? (pokemon.hp / pokemon.maxhp)*100 : 0;
  const hpCls       = hpPct < 20 ? 'critical' : hpPct < 50 ? 'low' : '';
  const hasBoosts   = boosts && Object.values(boosts).some(v => v !== 0);

  return (
    <div className={`pokemon-field-wrap ${isEnemy ? 'pfw-enemy' : 'pfw-player'}`}>
      {/* STATS BOX */}
      <div className={`stats-box ${isEnemy ? 'stats-enemy' : 'stats-player'}`}>
        <div className="stats-top">
          <span className="poke-name">{pokemon.name}</span>
          <div className="poke-meta">
            {pokemon.types?.map(t => (
              <span key={t} className="type-badge" style={{ background: TYPE_COLORS[t]||'#777' }}>{t}</span>
            ))}
            <span className="poke-level">Ур.{pokemon.level}</span>
          </div>
        </div>
        {status && (
          <span className="status-badge" style={{ background: STATUS_COLORS[status]||'#777' }}>
            {STATUS_NAMES[status]||status}
          </span>
        )}
        <div className="hp-row">
          <div className="hp-bar-container">
            <div className={`hp-fill ${hpCls}`} style={{ width:`${Math.max(0,hpPct)}%` }} />
          </div>
          <span className="hp-text">{isEnemy ? `${Math.ceil(hpPct)}%` : `${pokemon.hp}/${pokemon.maxhp}`}</span>
        </div>
        {hasBoosts && (
          <div className="boosts-row">
            {Object.entries(boosts).filter(([,v])=>v!==0).map(([stat,val]) => (
              <span key={stat} className={`boost-badge ${val>0?'boost-pos':'boost-neg'}`}>
                {STAT_NAMES[stat]?.slice(0,3)} {val>0?`+${val}`:val}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* SPRITE */}
      <div
        className={`sprite-container ${isHit ? 'hit-flash' : ''}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {hasSub && <div className="substitute-badge">ЗАМЕНА</div>}
        {myVols.filter(e=>!e.includes('Substitute')).map((e,i) => (
          <div key={i} className="volatile-badge">{VOLATILE_NAMES[e]||e}</div>
        ))}
        <img
          className={`sprite ${isEnemy ? 'sprite-front' : 'sprite-back'}`}
          src={isEnemy ? getSpriteFront(pokemon.name) : getSpriteBack(pokemon.name)}
          alt={pokemon.name}
          onError={makeFallback(pokemon.name, !isEnemy)}
        />
        {showTooltip && (
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

// ============================================================
// TOOLTIP
// ============================================================
const PokemonTooltip = ({ pokemon, isEnemy, boosts, status, volatiles, seenMoves }) => {
  const hpPct = pokemon.maxhp > 0 ? (pokemon.hp / pokemon.maxhp)*100 : 0;

  return (
    <div className={`poke-tooltip ${isEnemy ? 'tooltip-left' : 'tooltip-right'}`}>
      <div className="tooltip-header">
        <strong>{pokemon.name}</strong>
        <span className="tooltip-level">Ур. {pokemon.level}</span>
      </div>

      <div className="tooltip-types">
        {pokemon.types?.map(t => (
          <span key={t} className="type-badge-sm" style={{ background: TYPE_COLORS[t]||'#777' }}>{t}</span>
        ))}
      </div>

      {/* HP */}
      <div className="tooltip-hp">
        HP: <strong>{isEnemy ? `${Math.ceil(hpPct)}%` : `${pokemon.hp}/${pokemon.maxhp}`}</strong>
        <span className={`tooltip-hp-pct ${hpPct<20?'pct-red':hpPct<50?'pct-yellow':'pct-green'}`}>
          {Math.ceil(hpPct)}%
        </span>
      </div>

      {status && <div className="tooltip-status" style={{color:STATUS_COLORS[status]}}>{STATUS_NAMES[status]||status}</div>}

      {volatiles?.filter(e=>!e.includes('Substitute')).length>0 && (
        <div className="tooltip-volatiles">
          {volatiles.filter(e=>!e.includes('Substitute')).map((e,i) => (
            <span key={i} className="tv-badge">{VOLATILE_NAMES[e]||e}</span>
          ))}
        </div>
      )}

      {pokemon.ability && <div className="tooltip-row"><span className="tl">Способность:</span> {pokemon.ability}</div>}
      {pokemon.item    && <div className="tooltip-row"><span className="tl">Предмет:</span> {pokemon.item}</div>}
      {!isEnemy && pokemon.nature && <div className="tooltip-row"><span className="tl">Природа:</span> {pokemon.nature}</div>}

      {/* СТАТЫ: базовые + финальные + с бустами */}
      {pokemon.baseStats && (
        <div className="tooltip-stats">
          <div className="ts-header">
            <span className="ts-title">Статы</span>
            <span className="ts-sub">{isEnemy ? 'Баз / Итог' : 'Баз / Итог / Буст'}</span>
          </div>
          {STAT_KEYS.map(stat => {
            const base    = pokemon.baseStats[stat] ?? 0;
            const final   = calcFinalStat(pokemon, stat);
            const boosted = calcBoostedStat(pokemon, stat, boosts);
            const bval    = boosts?.[stat] ?? 0;
            const barW    = Math.min(100, base/1.8);
            const barClr  = base>=100?'#2ecc71':base>=70?'#f1c40f':'#e74c3c';
            const isBoosted = bval !== 0;
            return (
              <div key={stat} className="ts-row">
                <span className="ts-name">{STAT_NAMES[stat]||stat}</span>
                <div className="ts-bar-wrap">
                  <div className="ts-bar" style={{width:`${barW}%`,background:barClr}} />
                </div>
                <span className="ts-val">{base}</span>
                {final!==null && <span className="ts-final">{final}</span>}
                {!isEnemy && isBoosted && boosted!==null && (
                  <span className={`ts-boosted ${bval>0?'ts-pos':'ts-neg'}`}>{boosted}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* АТАКИ */}
      {!isEnemy && pokemon.moveSlots?.length>0 && (
        <div className="tooltip-moves">
          <div className="ts-title">Атаки</div>
          {pokemon.moveSlots.map(m => (
            <div key={m.id} className="tm-row">
              <span className={m.disabled?'tm-disabled':''}>{m.move}</span>
              <span className="tm-pp">{m.pp}/{m.maxpp} PP</span>
            </div>
          ))}
        </div>
      )}
      {isEnemy && seenMoves?.length>0 && (
        <div className="tooltip-moves">
          <div className="ts-title">Замеченные атаки</div>
          {seenMoves.map((m,i) => <div key={i} className="tm-row"><span>{m}</span></div>)}
        </div>
      )}
    </div>
  );
};

// ============================================================
// PARTY ICONS
// ============================================================
const PartyIcons = ({ side, position }) => {
  const sorted = [...(side?.pokemon||[])].sort((a,b)=>a.num-b.num);
  return (
    <div className={`party-icons party-icons-${position}`}>
      {sorted.map(p => (
        <div key={p.num} className={`party-icon-wrap ${p.fainted?'pi-fainted':p.active?'pi-active':'pi-alive'}`} title={p.name}>
          <img src={getSpriteFront(p.name)} alt={p.name} className="party-icon-sprite" onError={makeFallback(p.name,false)} />
          {p.fainted && <div className="pi-fainted-overlay">✕</div>}
        </div>
      ))}
    </div>
  );
};

// ============================================================
// BATTLE CONTROLS
// ============================================================
const BattleControls = ({ moves, sendAction, setShowParty, isWaiting, activePokemon }) => (
  <div className="battle-menu">
    <div className="move-info-bar">
      {activePokemon && (
        <span className="active-name">
          {activePokemon.name}
          {activePokemon.types?.map(t=>(
            <span key={t} className="type-badge-inline" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>
          ))}
        </span>
      )}
    </div>
    <div className="moves-layout">
      {moves.length>0
        ? moves.map((m,i) => <MoveButton key={i} move={m} index={i} sendAction={sendAction} isWaiting={isWaiting} />)
        : <div className="waiting-text">Получение атак...</div>
      }
    </div>
    <div className="action-sidebar">
      <button className="act-btn poke-btn" onClick={()=>setShowParty(true)}>⊕ ПОКЕМОНЫ</button>
      <button className="act-btn run-btn" onClick={()=>window.location.href='/'}>↩ СБЕЖАТЬ</button>
    </div>
  </div>
);

const MoveButton = ({ move, index, sendAction, isWaiting }) => {
  const ppPct = move.maxpp>0 ? (move.pp/move.maxpp)*100 : 0;
  const ppCls = ppPct<=25 ? 'pp-critical' : ppPct<=50 ? 'pp-low' : '';
  return (
    <button
      className={`move-card ${move.disabled?'move-disabled':''}`}
      onClick={()=>sendAction(`move ${index+1}`)}
      disabled={isWaiting||move.disabled}
    >
      <div className="move-top">
        <span className="move-name">{move.move}</span>
        {move.disabled && <span className="move-locked">🔒</span>}
      </div>
      <div className="move-bottom">
        <span className={`move-pp ${ppCls}`}>PP: {move.pp}/{move.maxpp}</span>
        <div className="pp-mini-bar"><div className={`pp-fill ${ppCls}`} style={{width:`${ppPct}%`}} /></div>
      </div>
    </button>
  );
};

// ============================================================
// MISC
// ============================================================
const WaitingPanel = ({ lastMove }) => (
  <div className="waiting-panel">
    <div className="waiting-spinner" />
    <div className="waiting-text">Ожидание противника...</div>
    {lastMove && <div className="waiting-last-move">Последняя атака: {lastMove}</div>}
  </div>
);

const WinScreen = ({ winner, myName, onExit }) => (
  <div className="win-screen">
    <div className={`win-title ${winner===myName?'win-victory':'win-defeat'}`}>
      {winner===myName ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ'}
    </div>
    <div className="win-subtitle">{winner} победил!</div>
    <button className="win-btn" onClick={onExit}>ЗАВЕРШИТЬ БОЙ</button>
  </div>
);

const PartyModal = ({ mySide, sendAction, setShowParty, isWaiting, isForceSwitch }) => {
  const sorted = [...(mySide?.pokemon||[])].sort((a,b)=>a.num-b.num);
  return (
    <div className="modal-overlay" onClick={!isForceSwitch?()=>setShowParty(false):undefined}>
      <div className="party-window" onClick={e=>e.stopPropagation()}>
        <div className="party-header">
          <h3>ВАША КОМАНДА</h3>
          {isForceSwitch && <span className="force-switch-badge">⚠ Выберите замену</span>}
        </div>
        <div className="party-list">
          {sorted.map(p => {
            const isFainted = p.fainted||p.condition?.startsWith('0');
            const isActive  = p.active;
            const canSwitch = !isActive&&!isFainted;
            const hpPct     = p.maxhp>0 ? (p.hp/p.maxhp)*100 : 0;
            return (
              <button
                key={p.num}
                className={`party-member ${isActive?'on-field':''} ${isFainted?'fainted':''} ${canSwitch&&!isWaiting?'can-switch':''}`}
                onClick={()=>{ sendAction(`switch ${p.num}`); setShowParty(false); }}
                disabled={!canSwitch||isWaiting}
              >
                <img src={getSpriteFront(p.name)} alt={p.name} className="party-sprite" onError={makeFallback(p.name,false)} />
                <div className="p-info">
                  <div className="p-name-row">
                    <span className="p-name">{p.name}</span>
                    <span className="p-level">Ур.{p.level}</span>
                    {p.status && <span className="p-status-badge" style={{background:STATUS_COLORS[p.status]}}>{STATUS_NAMES[p.status]?.slice(0,3)||p.status}</span>}
                  </div>
                  <div className="p-types">
                    {p.types?.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}
                  </div>
                  <div className="p-hp-row">
                    <div className="p-hp-bar">
                      <div className={`p-hp-fill ${hpPct<20?'critical':hpPct<50?'low':''}`} style={{width:`${Math.max(0,hpPct)}%`}} />
                    </div>
                    <span className="p-hp-text">{isFainted?'БЕЗ СОЗНАНИЯ':isActive?'В БОЮ':`${p.hp}/${p.maxhp}`}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {!isForceSwitch && <button className="close-modal" onClick={()=>setShowParty(false)}>ОТМЕНА</button>}
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
              <img src={getSpriteFront(p.name)} alt={p.name} className="preview-sprite" onError={makeFallback(p.name,false)} />
              <span className="preview-name">{p.name}</span>
              <div className="preview-types">{p.types?.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}</div>
              {p.baseStats && <span className="preview-bst">BST: {Object.values(p.baseStats).reduce((a,b)=>a+b,0)}</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="preview-divider">⚔ Выберите первого покемона ⚔</div>
      <div className="preview-team-list">
        {myList.map(p=>(
          <button key={p.num} onClick={()=>sendAction(`team ${p.num}`)} disabled={isWaiting} className="preview-mon-card player">
            <img src={getSpriteFront(p.name)} alt={p.name} className="preview-sprite" onError={makeFallback(p.name,false)} />
            <span className="preview-name">{p.name}</span>
            <div className="preview-types">{p.types?.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}</div>
            {p.baseStats && <span className="preview-bst">BST: {Object.values(p.baseStats).reduce((a,b)=>a+b,0)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

const LogPanel = ({ logs, logEndRef }) => (
  <div className="log-container">
    {logs.map((log,i) => <div key={i} className={`log-entry ${log.cls||''}`}>{log.text}</div>)}
    <div ref={logEndRef} />
  </div>
);

export default BattleScreen;
