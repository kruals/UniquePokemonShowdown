import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAppStore from '../../store/useAppStore';
import './BattleScreen.css';

const STATUS_ABBR   = { brn:'BRN', par:'PAR', psn:'PSN', tox:'TOX', slp:'SLP', frz:'FRZ' };
const STATUS_COLORS = { brn:'#c1772b', par:'#c8b800', psn:'#8b46af', tox:'#6e2f8f', slp:'#6d7b8d', frz:'#2d8ab5' };
const TYPE_COLORS   = {
  Normal:'#9099A1',Fire:'#FD7D24',Water:'#4592C4',Electric:'#EED535',
  Grass:'#9BCC50',Ice:'#51C4E7',Fighting:'#D56723',Poison:'#B97FC9',
  Ground:'#AB9842',Flying:'#82BAEF',Psychic:'#F366B9',Bug:'#729F3F',
  Rock:'#A38C21',Ghost:'#7B62A3',Dragon:'#F16E57',Dark:'#707070',
  Steel:'#9EB7B8',Fairy:'#FDB9E9',
};
const STAT_NAMES  = { hp:'HP', atk:'Atk', def:'Def', spa:'SpA', spd:'SpD', spe:'Spe' };
const BOOST_MULT  = {'-6':0.25,'-5':0.28,'-4':0.33,'-3':0.4,'-2':0.5,'-1':0.67,'0':1,'1':1.5,'2':2,'3':2.5,'4':3,'5':3.5,'6':4};
const NATURE_MOD  = {
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
const WEATHER_TEXT  = { SunnyDay:'Harsh sunlight', RainDance:'Rain', Sandstorm:'Sandstorm', Hail:'Hail', Snow:'Snow' };
const WEATHER_COLOR = { SunnyDay:'#d4a843', RainDance:'#4592C4', Sandstorm:'#b8972a', Hail:'#6ab5d4', Snow:'#8cc8dd' };
const SWITCH_DELAY  = 2500;

const toId = (name='') => name.toLowerCase().replace(/[^a-z0-9-]/g,'');
const spriteFront = (name) => `https://play.pokemonshowdown.com/sprites/ani/${toId(name)}.gif`;
const spriteBack  = (name) => `https://play.pokemonshowdown.com/sprites/ani-back/${toId(name)}.gif`;
const makeFallback = (name, isBack) => {
  let t = 0;
  return (e) => {
    t++;
    const s = toId(name), n = (name||'').toLowerCase().replace(/\s+/g,'-');
    if (t===1) e.target.src = isBack
      ? `https://play.pokemonshowdown.com/sprites/gen5-back/${s}.png`
      : `https://play.pokemonshowdown.com/sprites/gen5/${s}.png`;
    else if (t===2) e.target.src = `https://play.pokemonshowdown.com/sprites/dex/${s}.png`;
    else if (t===3) e.target.src = `/image_pokemons/${n}.gif`;
    else if (t===4) e.target.src = `/image_pokemons/${n}.png`;
    else e.target.src = `/image_pokemons/${n}.PNG`;
  };
};

const parseBoostEvents = (logs=[]) => {
  const ev = [];
  for (const line of logs) {
    const p = line.split('|');
    if (p.length < 2) continue;
    const t = p[1], side = line.includes('|p1')?'p1':'p2';
    if (t==='-boost')   ev.push({type:'boost',  side, stat:p[3], amount:parseInt(p[4])});
    if (t==='-unboost') ev.push({type:'unboost',side, stat:p[3], amount:parseInt(p[4])});
    if (t==='-clearallboost'||t==='-clearboost') ev.push({type:'clearboost'});
    if (t==='switch'||t==='drag') ev.push({type:'switch', side});
  }
  return ev;
};

const BattleScreen = ({ socket }) => {
  const { battleId } = useParams();
  const navigate     = useNavigate();
  const logRef       = useRef(null);
  const switchTimer  = useRef(null);

  const { user, activeBattles, getBattleState, removeBattle } = useAppStore();
  const battleMeta  = activeBattles[battleId];
  const battleState = getBattleState(battleId);

  const [isWaiting,     setIsWaiting]     = useState(false);
  const [animHit,       setAnimHit]       = useState({p1:false,p2:false});
  const [localBoosts,   setLocalBoosts]   = useState({p1:{},p2:{}});
  const [switchPending, setSwitchPending] = useState(false);
  const [showFullParty, setShowFullParty] = useState(false);

  const myRole      = battleMeta?.myRole;
  const enemyRole   = myRole==='p1'?'p2':'p1';
  const mySide      = myRole==='p1'?battleState?.side1:battleState?.side2;
  const enemySide   = myRole==='p1'?battleState?.side2:battleState?.side1;
  const myBoosts    = localBoosts[myRole]    || {};
  const enemyBoosts = localBoosts[enemyRole] || {};

  const phase = !battleState ? 'loading'
    : battleState?.winner             ? 'ended'
    : mySide?.requestState==='teampreview' ? 'preview'
    : mySide?.requestState==='switch'      ? 'switch'
    : mySide?.requestState==='move'        ? 'battle'
    : 'wait';

  useEffect(() => {
    const events = parseBoostEvents(battleState?.recentLog || []);
    setLocalBoosts(prev => {
      let next = {p1:{...prev.p1}, p2:{...prev.p2}};
      for (const ev of events) {
        if (ev.type==='switch') next[ev.side]={};
        else if (ev.type==='boost')   next[ev.side]={...next[ev.side],[ev.stat]:(next[ev.side][ev.stat]||0)+ev.amount};
        else if (ev.type==='unboost') next[ev.side]={...next[ev.side],[ev.stat]:(next[ev.side][ev.stat]||0)-ev.amount};
        else if (ev.type==='clearboost') next={p1:{},p2:{}};
      }
      return next;
    });
  }, [battleState?.recentLog]);

  useEffect(() => {
    if (phase==='switch') {
      setSwitchPending(true);
      if (switchTimer.current) clearTimeout(switchTimer.current);
      switchTimer.current = setTimeout(()=>setSwitchPending(false), SWITCH_DELAY);
    } else {
      if (switchTimer.current) clearTimeout(switchTimer.current);
      setSwitchPending(false);
    }
    return () => { if (switchTimer.current) clearTimeout(switchTimer.current); };
  }, [phase]);

  useEffect(() => {
    if (!battleId||!battleMeta) { navigate('/'); return; }
    if (socket.current) socket.current.emit('join_battle', battleId);
  }, [battleId]); // eslint-disable-line

  useEffect(() => {
    if (!socket?.current) return;
    const handler = (data) => {
      if (!data) return;
      setIsWaiting(false);
      if (data.log) {
        if (data.log.some(l=>l.includes('|-damage|p1'))) { setAnimHit(p=>({...p,p1:true})); setTimeout(()=>setAnimHit(p=>({...p,p1:false})),500); }
        if (data.log.some(l=>l.includes('|-damage|p2'))) { setAnimHit(p=>({...p,p2:true})); setTimeout(()=>setAnimHit(p=>({...p,p2:false})),500); }
      }
    };
    socket.current.on('battle_update', handler);
    return () => socket.current?.off('battle_update', handler);
  }, [socket]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [battleState?.logs]);

  const sendAction = useCallback((action) => {
    if (isWaiting||battleState?.winner||!socket?.current||!user) return;
    setIsWaiting(true); setShowFullParty(false);
    socket.current.emit('battle_action', {battleId, userId:user.id, action});
  }, [isWaiting,battleState?.winner,socket,battleId,user]);

  const handleExit = useCallback(()=>{ removeBattle(battleId); navigate('/'); },[removeBattle,battleId,navigate]);

  if (!user) { navigate('/auth'); return null; }
  if (!battleMeta) { navigate('/'); return null; }

  const activePokemon = mySide?.pokemon?.[mySide?.activeIdx];
  const activeEnemy   = enemySide?.pokemon?.[enemySide?.activeIdx];
  const moves         = activePokemon?.moveSlots || [];
  const myTeam        = [...(mySide?.pokemon||[])].sort((a,b)=>a.num-b.num);
  const enemyTeam     = [...(enemySide?.pokemon||[])].sort((a,b)=>a.num-b.num);

  const isForceSwitch = phase==='switch' && !switchPending;
  const showTeamBar   = isForceSwitch || showFullParty;

  return (
    <div className="ps-root">

      {/* ARENA */}
      <div className="ps-arena">
        {battleState?.weather && <div className="ps-weather-overlay" data-weather={battleState.weather}/>}

        <div className="ps-side ps-enemy">
          {activeEnemy && <InfoBox pokemon={activeEnemy} boosts={enemyBoosts} statuses={battleState?.statuses||{}} isEnemy/>}
          <div className="ps-sprite-zone enemy-zone">
            {activeEnemy && (
              <img key={activeEnemy.name} src={spriteFront(activeEnemy.name)} alt={activeEnemy.name}
                className={`ps-sprite${animHit[enemyRole]?' ps-hit':''} ps-enter`}
                onError={makeFallback(activeEnemy.name,false)}/>
            )}
          </div>
          <BallRow team={enemyTeam}/>
        </div>

        <div className="ps-side ps-player">
          <BallRow team={myTeam} flip/>
          <div className="ps-sprite-zone player-zone">
            {activePokemon && (
              <img key={activePokemon.name} src={spriteBack(activePokemon.name)} alt={activePokemon.name}
                className={`ps-sprite ps-sprite-back${animHit[myRole]?' ps-hit':''} ps-enter`}
                onError={makeFallback(activePokemon.name,true)}/>
            )}
          </div>
          {activePokemon && <InfoBox pokemon={activePokemon} boosts={myBoosts} statuses={battleState?.statuses||{}} isEnemy={false}/>}
        </div>

        {battleState?.currentTurn>0 && <div className="ps-turn-label">Turn {battleState.currentTurn}</div>}
      </div>

      {/* UI PANEL */}
      <div className="ps-ui">

        <div className="ps-prompt-bar">
          <span className="ps-prompt-text">
            {phase==='ended'   ? null
            :phase==='preview' ? 'Choose lead Pokémon!'
            :switchPending     ? 'Choose a replacement Pokémon!'
            :isForceSwitch     ? 'Choose a replacement Pokémon!'
            :activePokemon     ? <>What will <b>{activePokemon.name}</b> do?</>
            :'Waiting...'}
          </span>
          {battleState?.weather && (
            <span className="ps-weather-pill" style={{background: WEATHER_COLOR[battleState.weather]+'33', color:WEATHER_COLOR[battleState.weather], borderColor:WEATHER_COLOR[battleState.weather]+'66'}}>
              {WEATHER_TEXT[battleState.weather]}
            </span>
          )}
        </div>

        <div className="ps-ui-body">
          <div className="ps-log" ref={logRef}>
            {(battleState?.logs||[]).map((log,i)=>(
              <div key={i} className={`ps-ll ${log.cls||''}`}>{log.text}</div>
            ))}
          </div>

          <div className="ps-controls">
            {phase==='loading' && <div className="ps-msg">Connecting...</div>}
            {phase==='ended'   && <WinPanel winner={battleState?.winner} myName={user.username} onExit={handleExit}/>}
            {(phase==='wait'||isWaiting) && (
              <div className="ps-msg"><div className="ps-spin"/>Waiting for {battleMeta?.opponentUsername}...</div>
            )}
            {switchPending && (
              <div className="ps-msg">
                <div className="ps-spin"/>
                <span>Choosing replacement...</span>
                <div className="ps-cdbar"><div className="ps-cdfill" style={{animationDuration:`${SWITCH_DELAY}ms`}}/></div>
              </div>
            )}
            {phase==='preview' && <PreviewPanel mySide={mySide} sendAction={sendAction}/>}
            {phase==='battle' && !isWaiting && (
              <MovePanel moves={moves} sendAction={sendAction} onSwitch={()=>setShowFullParty(true)}/>
            )}
          </div>
        </div>

        {/* PARTY BAR — стиль Pokemon Showdown */}
        <PartyBar
          myTeam={myTeam}
          showTeamBar={showTeamBar}
          isForceSwitch={isForceSwitch}
          sendAction={sendAction}
          onCancelSwitch={()=>setShowFullParty(false)}
        />

      </div>
    </div>
  );
};

/* ── Ball row ── */
const BallRow = ({team, flip}) => (
  <div className={`ps-balls${flip?' balls-flip':''}`}>
    {team.map(p=>(
      <svg key={p.num} viewBox="0 0 20 20" width="18" height="18" className={`ps-ball${p.fainted?' b-fnt':p.active?' b-act':' b-ok'}`} title={p.name}>
        <circle cx="10" cy="10" r="9" fill={p.fainted?'#444':p.active?'#e74c3c':'#27ae60'} stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>
        <path d="M1 10h18" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <circle cx="10" cy="10" r="3" fill="white" stroke="rgba(0,0,0,0.25)" strokeWidth="1"/>
      </svg>
    ))}
  </div>
);

/* ── Info box ── */
const InfoBox = ({pokemon, boosts, statuses, isEnemy}) => {
  const status  = statuses[pokemon.name];
  const hpPct   = pokemon.maxhp>0?(pokemon.hp/pokemon.maxhp)*100:0;
  const hpCls   = hpPct<20?'hp-c':hpPct<50?'hp-l':'hp-g';
  const hasBoost= boosts&&Object.values(boosts).some(v=>v!==0);
  return (
    <div className={`ib${isEnemy?' ib-e':' ib-p'}`}>
      <div className="ib-row1">
        <span className="ib-name">{pokemon.name}</span>
        <span className="ib-lv">L{pokemon.level||100}</span>
        {status&&<span className="ib-st" style={{background:STATUS_COLORS[status]}}>{STATUS_ABBR[status]||status}</span>}
        {pokemon.types?.map(t=><span key={t} className="ib-t" style={{background:TYPE_COLORS[t]||'#777'}}>{t}</span>)}
      </div>
      <div className="ib-row2">
        <div className="ib-hpbar"><div className={`ib-hpfill ${hpCls}`} style={{width:`${Math.max(0,hpPct)}%`}}/></div>
        <span className="ib-hptxt">{isEnemy?`${Math.ceil(hpPct)}%`:`${pokemon.hp}/${pokemon.maxhp}`}</span>
      </div>
      {hasBoost&&<div className="ib-boosts">
        {Object.entries(boosts).filter(([,v])=>v!==0).map(([s,v])=>(
          <span key={s} className={`ib-b ${v>0?'bb-p':'bb-n'}`}>{STAT_NAMES[s]} {v>0?`+${v}`:v}</span>
        ))}
      </div>}
    </div>
  );
};

/* ── Move panel ── */
const MovePanel = ({moves, sendAction, onSwitch}) => (
  <div className="ps-movepanel">
    <div className="ps-mp-left">
      <div className="ps-mp-header">Attack</div>
      <div className="ps-movegrid">
        {moves.map((m,i)=>{
          const ppPct=m.maxpp>0?(m.pp/m.maxpp)*100:0;
          return (
            <button key={i} className={`ps-mbtn${m.disabled?' ps-mbtn-dis':''}`}
              onClick={()=>!m.disabled&&sendAction(`move ${i+1}`)} disabled={m.disabled}>
              <span className="ps-mname">{m.move}</span>
              <span className={`ps-mpp${ppPct<=25?' mpp-low':''}`}>{m.pp}/{m.maxpp} PP</span>
            </button>
          );
        })}
        {Array(Math.max(0,4-moves.length)).fill(0).map((_,i)=>(
          <button key={`e${i}`} className="ps-mbtn ps-mbtn-empty" disabled>–</button>
        ))}
      </div>
    </div>
    <div className="ps-mp-right">
      <div className="ps-mp-header">Switch</div>
      <button className="ps-switch-btn" onClick={onSwitch}>Pokémon ▶</button>
    </div>
  </div>
);

/* ── Preview ── */
const PreviewPanel = ({mySide, sendAction}) => (
  <div className="ps-preview">
    {[...(mySide?.pokemon||[])].sort((a,b)=>a.num-b.num).map(p=>(
      <button key={p.num} className="ps-prev-card" onClick={()=>sendAction(`team ${p.num}`)}>
        <img src={spriteFront(p.name)} alt={p.name} className="prev-spr" onError={makeFallback(p.name,false)}/>
        <span className="prev-name">{p.name}</span>
        <div className="prev-types">{p.types?.map(t=><span key={t} className="ib-t" style={{background:TYPE_COLORS[t]||'#777',fontSize:'.55rem'}}>{t}</span>)}</div>
      </button>
    ))}
  </div>
);

/* ── Party Bar (Pokemon Showdown style) ── */
const PartyBar = ({ myTeam, showTeamBar, isForceSwitch, sendAction, onCancelSwitch }) => {
  const [hovered, setHovered] = useState(null);

  return (
    <div className={`ps-partybar${showTeamBar ? ' partybar-active' : ''}`}>
      {showTeamBar && (
        <div className="partybar-label">
          {isForceSwitch ? '⚡ Choose a replacement Pokémon!' : '🔄 Switch to which Pokémon?'}
        </div>
      )}
      <div className="partybar-slots">
        {myTeam.map(p => {
          const fainted   = p.fainted || p.condition?.startsWith('0 fnt') || (p.hp===0 && p.maxhp>0);
          const active    = p.active;
          const hpPct     = p.maxhp > 0 ? (p.hp / p.maxhp) * 100 : 0;
          const hpCls     = hpPct < 20 ? 'hp-c' : hpPct < 50 ? 'hp-l' : 'hp-g';
          const canSwitch = showTeamBar && !fainted && !active;

          return (
            <div
              key={p.num}
              className={[
                'pbslot',
                active   ? 'pbslot-active'   : '',
                fainted  ? 'pbslot-fainted'  : '',
                canSwitch? 'pbslot-pick'     : '',
              ].join(' ')}
              onClick={() => canSwitch && sendAction(`switch ${p.num}`)}
              onMouseEnter={() => setHovered(p.num)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Sprite */}
              <div className="pbslot-sprite-wrap">
                <img
                  src={spriteFront(p.name)}
                  alt={p.name}
                  className="pbslot-sprite"
                  onError={makeFallback(p.name, false)}
                />
                {fainted && <div className="pbslot-fnt-overlay">✕</div>}
                {active  && <div className="pbslot-active-dot"/>}
              </div>

              {/* HP bar below sprite */}
              <div className="pbslot-hpbar-wrap">
                <div className={`pbslot-hpbar ${hpCls}`} style={{width:`${Math.max(0,Math.min(100,hpPct))}%`}}/>
              </div>
              <div className="pbslot-name">{p.name}</div>

              {/* Tooltip on hover */}
              {hovered === p.num && (
                <div className="pbslot-tip">
                  <div className="pbt-head">
                    <span className="pbt-name">{p.name}</span>
                    <span className="pbt-lv">Lv.{p.level||100}</span>
                    {p.status && (
                      <span className="pbt-status" style={{background:STATUS_COLORS[p.status]}}>
                        {STATUS_ABBR[p.status]}
                      </span>
                    )}
                  </div>
                  {p.types && (
                    <div className="pbt-types">
                      {p.types.map(t => (
                        <span key={t} className="ib-t" style={{background:TYPE_COLORS[t]||'#777',fontSize:'.55rem'}}>{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="pbt-hp-row">
                    <div className="pbt-hpbar-bg">
                      <div className={`pbt-hpbar-fill ${hpCls}`} style={{width:`${Math.max(0,hpPct)}%`}}/>
                    </div>
                    <span className="pbt-hptxt">
                      {fainted ? 'Fainted' : `${Math.ceil(hpPct)}%`}
                    </span>
                  </div>
                  {p.ability && <div className="pbt-row">Ability: <b>{p.ability}</b></div>}
                  {p.item    && <div className="pbt-row">Item: <b>{p.item}</b></div>}
                  {canSwitch && <div className="pbt-hint">Click to send out</div>}
                  {active    && <div className="pbt-hint pbt-hint-active">Currently on field</div>}
                  {fainted   && <div className="pbt-hint pbt-hint-fnt">Fainted</div>}
                </div>
              )}
            </div>
          );
        })}

        {showTeamBar && !isForceSwitch && (
          <button className="partybar-cancel" onClick={onCancelSwitch} title="Cancel">✕</button>
        )}
      </div>
    </div>
  );
};

/* ── Win ── */
const WinPanel = ({winner, myName, onExit}) => (
  <div className="ps-win">
    <div className={winner===myName?'ps-winv':'ps-wind'}>{winner===myName?'🏆 You win!':'You lose...'}</div>
    <button className="ps-winbtn" onClick={onExit}>Back to Lobby</button>
  </div>
);

export default BattleScreen;
