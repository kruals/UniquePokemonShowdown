import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAppStore from '../../store/useAppStore';
import './BattleScreen.css';

// ============================================================
// КОНСТАНТЫ
// ============================================================
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
const FIELD_NAMES = {
  'move: Trick Room':'Комната трюков','move: Magic Room':'Волшебная комната',
  'move: Wonder Room':'Комната чудес','move: Gravity':'Гравитация',
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
    else e.target.src = `/image_pokemons/${safeName}.PNG` ;
  };
};

// ============================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================
const BattleScreen = ({ socket }) => {
  const { battleId } = useParams();
  const navigate     = useNavigate();
  const logEndRef    = useRef(null);

  const { user, activeBattles, getBattleState, removeBattle } = useAppStore();

  const battleMeta  = activeBattles[battleId];
  const battleState = getBattleState(battleId);

  const [isWaiting, setIsWaiting] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [animHit,   setAnimHit]   = useState({ p1:false, p2:false });
  
  const myRole      = battleMeta?.myRole;
  const enemyRole   = myRole === 'p1' ? 'p2' : 'p1';
  const mySide      = myRole === 'p1' ? battleState?.side1 : battleState?.side2;
  const enemySide   = myRole === 'p1' ? battleState?.side2 : battleState?.side1;
  const myBoosts    = battleState?.boosts?.[myRole];
  const enemyBoosts = battleState?.boosts?.[enemyRole];
  const myHazards   = battleState?.hazards?.[myRole];
  const enemyHazards= battleState?.hazards?.[enemyRole];
  const currentPhase = battleState?.winner
  ? 'ended'
  : mySide?.requestState === 'teampreview' ? 'preview'
  : mySide?.requestState === 'switch'      ? 'switch'
  : mySide?.requestState === 'move'        ? 'battle'
  : 'wait';

  // Все хуки выше — проверки после них

  // При монтировании / обновлении страницы — реджойним комнату
  useEffect(() => {
    if (!battleId || !battleMeta) { navigate('/'); return; }
    if (socket.current) {
      socket.current.emit('join_battle', battleId);
    }
  }, [battleId]); // eslint-disable-line

  useEffect(() => {
    if (currentPhase === 'switch') setShowParty(true);
  }, [currentPhase]);

  // Локальный listener только для анимации попадания
  useEffect(() => {
    if (!socket.current) return;
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

  const sendAction = useCallback((action) => {
    if (isWaiting || battleState?.winner || !socket.current || !user) return;
    setIsWaiting(true);
    socket.current.emit('battle_action', { battleId, userId: user.id, action });
  }, [isWaiting, battleState?.winner, socket, battleId, user]);

  const handleExit = useCallback(() => {
    removeBattle(battleId);
    navigate('/');
  }, [removeBattle, battleId, navigate]);

if (!user) {
    navigate('/auth');
    return null;
  }

  if (!battleMeta) {
    navigate('/');
    return null;
  }

  // Пока store ещё не загрузил состояние боя
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
                  statuses={battleState.statuses}
                  volatiles={battleState.volatiles}
                  isHit={animHit[enemyRole]}
                  seenMoves={battleState.seenMoves[activeEnemy.name] || []}
                />
              )}
            </div>
            <div className="field-player">
              {activePokemon && (
                <PokemonOnField
                  pokemon={activePokemon} isEnemy={false}
                  boosts={myBoosts}
                  statuses={battleState.statuses}
                  volatiles={battleState.volatiles}
                  isHit={animHit[myRole]}
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
        <LogPanel logs={battleState.logs} logEndRef={logEndRef} />
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
// WEATHER
// ============================================================
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

// ============================================================
// HAZARDS
// ============================================================
const HazardDisplay = ({ hazards, flip }) => {
  if (!hazards?.length) return null;
  return (
    <div className={`hazard-display ${flip?'hazard-flip':''}`}>
      {hazards.map((h,i)=><span key={i} className="hazard-badge">⚠ {h}</span>)}
    </div>
  );
};

// ============================================================
// TRAINER INFO
// ============================================================
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

// ============================================================
// PARTY ICONS
// ============================================================
const PartyIcons = ({ side, position }) => {
  if (!side?.pokemon) return null;
  const sorted = [...side.pokemon].sort((a,b)=>a.num-b.num);
  return (
    <div className={`party-icons ${position==='top'?'pi-top':'pi-bottom'}`}>
      {sorted.map(p=>(
        <div key={p.num} className={`pi-dot ${p.fainted?'pi-faint':p.active?'pi-active':''}`}>
          <img src={getSpriteFront(p.name)} alt={p.name} className="pi-spr" onError={makeFallback(p.name,false)}/>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// POKEMON ON FIELD
// ============================================================
const PokemonOnField = ({ pokemon, isEnemy, boosts, statuses, volatiles, isHit, seenMoves }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const status    = statuses[pokemon.name];
  const myVols    = (volatiles[pokemon.name]||[]).filter(e=>VISIBLE_VOLATILE.includes(e));
  const hasSub    = myVols.some(e=>e.includes('Substitute'));
  const hpPct     = pokemon.maxhp>0?(pokemon.hp/pokemon.maxhp)*100:0;
  const hpCls     = hpPct<20?'critical':hpPct<50?'low':'';
  const hasBoosts = boosts&&Object.values(boosts).some(v=>v!==0);

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
          src={isEnemy?getSpriteFront(pokemon.name):getSpriteBack(pokemon.name)}
          alt={pokemon.name}
          onError={makeFallback(pokemon.name,!isEnemy)}
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

// ============================================================
// TOOLTIP
// ============================================================
const PokemonTooltip = ({ pokemon, isEnemy, boosts, status, volatiles, seenMoves }) => {
  const hpPct = pokemon.maxhp>0?(pokemon.hp/pokemon.maxhp)*100:0;
  return (
    <div className={`poke-tooltip ${isEnemy?'tooltip-left':'tooltip-right'}`}>
      <div className="tooltip-header">
        <strong>{pokemon.name}</strong>
        <span className="tt-level">Ур.{pokemon.level}</span>
      </div>
      <div className="tt-types">
        {pokemon.types?.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}
      </div>
      <div className="tt-hp-bar">
        <div className={`tt-hp-fill ${hpPct<20?'critical':hpPct<50?'low':''}`} style={{width:`${Math.max(0,hpPct)}%`}}/>
      </div>
      <div className="tt-hp-text">{isEnemy?`${Math.ceil(hpPct)}% HP`:`${pokemon.hp}/${pokemon.maxhp}`}</div>
      {status&&<div className="tt-status" style={{color:STATUS_COLORS[status]||'#aaa'}}>{STATUS_NAMES[status]||status}</div>}
      {STAT_KEYS.map(s=>{
        const base=calcFinalStat(pokemon,s);
        if(!base) return null;
        const stage=Math.max(-6,Math.min(6,boosts?.[s]??0));
        const boosted=s==='hp'?base:Math.floor(base*(BOOST_MULT[String(stage)]??1));
        return (
          <div key={s} className="tt-stat-row">
            <span className="tt-stat-key">{STAT_NAMES[s]}</span>
            <span className={`tt-stat-val ${stage>0?'boost-pos':stage<0?'boost-neg':''}`}>
              {boosted}{stage!==0?` (${stage>0?'+':''}${stage})`:''}
            </span>
          </div>
        );
      })}
      {seenMoves?.length>0&&(
        <div className="tt-moves">
          <div className="tt-moves-title">Замечены атаки:</div>
          {seenMoves.map(m=><span key={m} className="tt-move">{m}</span>)}
        </div>
      )}
      {volatiles?.length>0&&(
        <div className="tt-vols">
          {volatiles.map(e=><span key={e} className="volatile-badge">{VOLATILE_NAMES[e]||e}</span>)}
        </div>
      )}
    </div>
  );
};

// ============================================================
// BATTLE CONTROLS
// ============================================================
const BattleControls = ({ moves, sendAction, setShowParty, isWaiting, activePokemon }) => (
  <div className="battle-controls">
    <div className="active-mon-info">
      {activePokemon&&(
        <span className="active-mon-name">{activePokemon.name}</span>
      )}
    </div>
    <div className="moves-layout">
      {moves.length>0
        ?moves.map((m,i)=><MoveButton key={i} move={m} index={i} sendAction={sendAction} isWaiting={isWaiting}/>)
        :<div className="waiting-text">Получение атак...</div>
      }
    </div>
    <div className="action-sidebar">
      <button className="act-btn poke-btn" onClick={()=>setShowParty(true)}>⊕ ПОКЕМОНЫ</button>
      <button className="act-btn run-btn" onClick={()=>window.location.href='/'}>↩ СБЕЖАТЬ</button>
    </div>
  </div>
);

const MoveButton = ({ move, index, sendAction, isWaiting }) => {
  const ppPct = move.maxpp>0?(move.pp/move.maxpp)*100:0;
  const ppCls = ppPct<=25?'pp-critical':ppPct<=50?'pp-low':'';
  return (
    <button
      className={`move-card ${move.disabled?'move-disabled':''}`}
      onClick={()=>sendAction(`move ${index+1}`)}
      disabled={isWaiting||move.disabled}
    >
      <div className="move-top">
        <span className="move-name">{move.move}</span>
        {move.disabled&&<span className="move-locked">🔒</span>}
      </div>
      <div className="move-bottom">
        <span className={`move-pp ${ppCls}`}>PP: {move.pp}/{move.maxpp}</span>
        <div className="pp-mini-bar"><div className={`pp-fill ${ppCls}`} style={{width:`${ppPct}%`}}/></div>
      </div>
    </button>
  );
};

// ============================================================
// MISC
// ============================================================
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

const PartyModal = ({ mySide, sendAction, setShowParty, isWaiting, isForceSwitch }) => {
  const sorted = [...(mySide?.pokemon||[])].sort((a,b)=>a.num-b.num);
  return (
    <div className="modal-overlay" onClick={!isForceSwitch?()=>setShowParty(false):undefined}>
      <div className="party-window" onClick={e=>e.stopPropagation()}>
        <div className="party-header">
          <h3>ВАША КОМАНДА</h3>
          {isForceSwitch&&<span className="force-switch-badge">⚠ Выберите замену</span>}
        </div>
        <div className="party-list">
          {sorted.map(p=>{
            const isFainted=p.fainted||p.condition?.startsWith('0');
            const isActive=p.active;
            const canSwitch=!isActive&&!isFainted;
            const hpPct=p.maxhp>0?(p.hp/p.maxhp)*100:0;
            return (
              <button
                key={p.num}
                className={`party-member ${isActive?'on-field':''} ${isFainted?'fainted':''} ${canSwitch&&!isWaiting?'can-switch':''}`}
                onClick={()=>{sendAction(`switch ${p.num}`);setShowParty(false);}}
                disabled={!canSwitch||isWaiting}
              >
                <img src={getSpriteFront(p.name)} alt={p.name} className="party-sprite" onError={makeFallback(p.name,false)}/>
                <div className="p-info">
                  <div className="p-name-row">
                    <span className="p-name">{p.name}</span>
                    <span className="p-level">Ур.{p.level}</span>
                    {p.status&&<span className="p-status-badge" style={{background:STATUS_COLORS[p.status]}}>{STATUS_NAMES[p.status]?.slice(0,3)||p.status}</span>}
                  </div>
                  <div className="p-types">
                    {p.types?.map(t=><span key={t} className="type-badge-xs" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}
                  </div>
                  <div className="p-hp-row">
                    <div className="p-hp-bar">
                      <div className={`p-hp-fill ${hpPct<20?'critical':hpPct<50?'low':''}`} style={{width:`${Math.max(0,hpPct)}%`}}/>
                    </div>
                    <span className="p-hp-text">{isFainted?'БЕЗ СОЗНАНИЯ':isActive?'В БОЮ':`${p.hp}/${p.maxhp}`}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {!isForceSwitch&&<button className="close-modal" onClick={()=>setShowParty(false)}>ОТМЕНА</button>}
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

const LogPanel = ({ logs, logEndRef }) => (
  <div className="log-container">
    {logs.map((log,i)=><div key={i} className={`log-entry ${log.cls||''}`}>{log.text}</div>)}
    <div ref={logEndRef}/>
  </div>
);

export default BattleScreen;
