/**
 * useAppStore.js — единый Zustand store
 * Персистит: user, activeBattles, battleStates
 * НЕ персистит: socket, pendingChallenges (живут только в сессии)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── STORE ────────────────────────────────────────────────────
const useAppStore = create(
  persist(
    (set, get) => ({

      /* ══════════════════════════════════════════
         USER
      ══════════════════════════════════════════ */
      user: null,

      setUser: (user) => set({ user }),

      clearUser: () => {
        localStorage.removeItem('ps_token');
        set({ user: null });
      },

      /* ══════════════════════════════════════════
         ONLINE USERS LIST (не персистим)
      ══════════════════════════════════════════ */
      onlineUsers: [], // [{ id, username }]

      setOnlineUsers: (list) => set({ onlineUsers: list }),

      /* ══════════════════════════════════════════
         PENDING CHALLENGES (не персистим)
         Входящие вызовы пока не приняты
      ══════════════════════════════════════════ */
      pendingChallenges: [], // [{ from, fromUsername, team, receivedAt }]

      addChallenge: (challenge) => set(state => ({
        pendingChallenges: [
          ...state.pendingChallenges,
          { ...challenge, receivedAt: Date.now() }
        ]
      })),

      removeChallenge: (fromUserId) => set(state => ({
        pendingChallenges: state.pendingChallenges.filter(c => c.from !== fromUserId)
      })),

      clearChallenges: () => set({ pendingChallenges: [] }),

      /* ══════════════════════════════════════════
         ACTIVE BATTLES
         Персистируются — переживают обновление страницы
         { battleId → { battleId, opponentId, opponentUsername, myRole, startedAt } }
      ══════════════════════════════════════════ */
      activeBattles: {}, // battleId → BattleMeta

      addBattle: (battleId, meta) => set(state => ({
        activeBattles: { ...state.activeBattles, [battleId]: { ...meta, battleId } }
      })),

      removeBattle: (battleId) => set(state => {
        const next = { ...state.activeBattles };
        delete next[battleId];
        // Чистим и состояние боя
        const nextStates = { ...state.battleStates };
        delete nextStates[battleId];
        return { activeBattles: next, battleStates: nextStates };
      }),

      /* ══════════════════════════════════════════
         BATTLE STATES
         Полное состояние каждого боя — персистируется
         { battleId → BattleState }
      ══════════════════════════════════════════ */
      battleStates: {},

      // Инициализация/обновление состояния боя из данных сервера
      updateBattleState: (battleId, serverData) => set(state => {
        const prev = state.battleStates[battleId] || {
          side1: null, side2: null,
          logs: [],
          winner: null,
          requestState: null,
          // Боевые эффекты
          boosts:      { p1: {}, p2: {} },
          statuses:    {},
          volatiles:   {},
          weather:     null,
          weatherTurns: 0,
          hazards:     { p1: [], p2: [] },
          seenMoves:   {},
          lastMove:    null,
        };

        // Парсим лог и обновляем эффекты
        const effects = applyLogEffects(prev, serverData.log || []);

        const newLogs = (serverData.log || [])
          .map(formatLogLine)
          .filter(Boolean);

        return {
          battleStates: {
            ...state.battleStates,
            [battleId]: {
              ...prev,
              ...effects,
              side1:        serverData.side1        || prev.side1,
              side2:        serverData.side2        || prev.side2,
              winner:       serverData.winner       || prev.winner,
              requestState: serverData.requestState ?? prev.requestState,
              logs:         [...prev.logs, ...newLogs],
            }
          }
        };
      }),

      getBattleState: (battleId) => get().battleStates[battleId] || null,

      // Сброс только логов (для очистки UI)
      clearBattleLogs: (battleId) => set(state => {
        const bs = state.battleStates[battleId];
        if (!bs) return {};
        return {
          battleStates: {
            ...state.battleStates,
            [battleId]: { ...bs, logs: [] }
          }
        };
      }),

    }),
    {
      name: 'poke-app-store',
      // Персистируем только нужное, socket и pendingChallenges — нет
      partialize: (state) => ({
        user:         state.user,
        activeBattles: state.activeBattles,
        battleStates: state.battleStates,
      }),
    }
  )
);

export default useAppStore;

/* ════════════════════════════════════════════════════════════
   LOG PARSER — дублируем здесь чтобы store был самодостаточным
════════════════════════════════════════════════════════════ */
const WEATHER_DUR = { SunnyDay:5, RainDance:5, Sandstorm:5, Hail:5, Snow:5 };
const HAZARD_NAMES = {
  'Stealth Rock':'Острые камни','move: Stealth Rock':'Острые камни',
  'Spikes':'Шипы','move: Spikes':'Шипы',
  'Toxic Spikes':'Ядовитые шипы','move: Toxic Spikes':'Ядовитые шипы',
  'Sticky Web':'Липкая паутина','move: Sticky Web':'Липкая паутина',
};
const VISIBLE_VOLATILE = [
  'move: Taunt','Taunt','move: Encore','Encore',
  'move: Substitute','Substitute','move: Confusion','confusion',
  'move: Leech Seed','leechseed','move: Torment','Torment',
  'move: Disable','Disable','move: Yawn','Yawn',
  'move: Perish Song','move: Aqua Ring','move: Ingrain','move: Curse',
];

const parseLog = (line) => {
  const parts = line.split('|');
  if (parts.length < 2) return null;
  const type = parts[1];
  const cleanName = (s) => s?.includes(': ') ? s.split(': ')[1] : (s || '');
  switch (type) {
    case 'move':      return { type:'move',   pokemon:cleanName(parts[2]), move:parts[3] };
    case 'switch':
    case 'drag':      return { type:'switch', pokemon:cleanName(parts[2]) };
    case 'faint':     return { type:'faint',  pokemon:cleanName(parts[2]) };
    case '-damage':   return { type:'damage', side: line.includes('|p1') ? 'p1' : 'p2' };
    case '-status':   return { type:'status', pokemon:cleanName(parts[2]), status:parts[3] };
    case '-curestatus':return { type:'curestatus', pokemon:cleanName(parts[2]) };
    case '-boost':    return { type:'boost',  side:line.includes('|p1')?'p1':'p2', stat:parts[3], amount:parseInt(parts[4]) };
    case '-unboost':  return { type:'unboost',side:line.includes('|p1')?'p1':'p2', stat:parts[3], amount:parseInt(parts[4]) };
    case '-clearallboost':
    case '-clearboost':return { type:'clearboost' };
    case '-weather':  return { type:'weather', weather:parts[2], upkeep:parts[3]==='[upkeep]' };
    case '-sidestart':return { type:'sidestart', side:parts[2]?.startsWith('p1')?'p1':'p2', condition:parts[3] };
    case '-sideend':  return { type:'sideend',   side:parts[2]?.startsWith('p1')?'p1':'p2', condition:parts[3] };
    case '-start':    return { type:'volstart', pokemon:cleanName(parts[2]), effect:parts[3] };
    case '-end':      return { type:'volend',   pokemon:cleanName(parts[2]), effect:parts[3] };
    default: return null;
  }
};

// Применяет эффекты лога к предыдущему состоянию, возвращает изменения
const applyLogEffects = (prev, logLines) => {
  let boosts      = { p1:{...prev.boosts.p1}, p2:{...prev.boosts.p2} };
  let statuses    = { ...prev.statuses };
  let volatiles   = { ...prev.volatiles };
  let weather     = prev.weather;
  let weatherTurns= prev.weatherTurns;
  let hazards     = { p1:[...prev.hazards.p1], p2:[...prev.hazards.p2] };
  let seenMoves   = { ...prev.seenMoves };
  let lastMove    = prev.lastMove;

  for (const line of logLines) {
    const p = parseLog(line);
    if (!p) continue;
    switch (p.type) {
      case 'weather':
        if (p.weather === 'none') { weather = null; weatherTurns = 0; }
        else if (!p.upkeep) { weather = p.weather; weatherTurns = WEATHER_DUR[p.weather]||5; }
        else weatherTurns = Math.max(0, weatherTurns - 1);
        break;
      case 'boost':
        boosts[p.side][p.stat] = (boosts[p.side][p.stat]||0) + p.amount;
        break;
      case 'unboost':
        boosts[p.side][p.stat] = (boosts[p.side][p.stat]||0) - p.amount;
        break;
      case 'clearboost':
        boosts = { p1:{}, p2:{} };
        break;
      case 'switch':
        // При смене сбрасываем бусты (определяем сторону по имени)
        // (упрощение: сбрасываем оба — сервер знает)
        break;
      case 'status':
        statuses[p.pokemon] = p.status;
        break;
      case 'curestatus':
        delete statuses[p.pokemon];
        break;
      case 'move':
        lastMove = p.move;
        if (p.pokemon) {
          const ex = seenMoves[p.pokemon] || [];
          if (!ex.includes(p.move)) seenMoves[p.pokemon] = [...ex, p.move];
        }
        break;
      case 'volstart':
        if (VISIBLE_VOLATILE.includes(p.effect)) {
          volatiles[p.pokemon] = [...(volatiles[p.pokemon]||[]), p.effect];
        }
        break;
      case 'volend':
        volatiles[p.pokemon] = (volatiles[p.pokemon]||[]).filter(e=>e!==p.effect);
        break;
      case 'sidestart': {
        const hname = HAZARD_NAMES[p.condition] || p.condition;
        if (!hazards[p.side].includes(hname)) hazards[p.side] = [...hazards[p.side], hname];
        break;
      }
      case 'sideend': {
        const hname = HAZARD_NAMES[p.condition] || p.condition;
        hazards[p.side] = hazards[p.side].filter(h=>h!==hname);
        break;
      }
      default: break;
    }
  }

  return { boosts, statuses, volatiles, weather, weatherTurns, hazards, seenMoves, lastMove };
};

/* ════════════════════════════════════════════════════════════
   LOG FORMATTER (дублируем для store)
════════════════════════════════════════════════════════════ */
const STATUS_NAMES  = { brn:'Ожог', par:'Паралич', psn:'Отравление', tox:'Сильное отравление', slp:'Сон', frz:'Заморозка' };
const STAT_NAMES    = { hp:'HP', atk:'Атака', def:'Защита', spa:'Сп.Атк', spd:'Сп.Защ', spe:'Скорость' };
const WEATHER_NAMES = { SunnyDay:'☀️ Сильная жара', RainDance:'🌧 Ливень', Sandstorm:'🌪 Песчаная буря', Hail:'❄️ Град', Snow:'❄️ Снег', none:'☁️ Погода нормализовалась' };
const VOLATILE_NAMES = {
  'move: Taunt':'Провокация','Taunt':'Провокация','move: Encore':'Encore','Encore':'Encore',
  'move: Substitute':'Замена','Substitute':'Замена','move: Confusion':'Замешательство','confusion':'Замешательство',
  'move: Leech Seed':'Посев','leechseed':'Посев','move: Torment':'Истязание','Torment':'Истязание',
};
const FIELD_NAMES = {
  'move: Trick Room':'Комната трюков','move: Magic Room':'Волшебная комната',
  'move: Wonder Room':'Комната чудес','move: Gravity':'Гравитация',
};

const cleanPokeName = (str) => str?.includes(': ') ? str.split(': ')[1] : (str||'');

const formatLogLine = (line) => {
  const parts = line.split('|');
  if (parts.length < 2) return null;
  const type = parts[1];
  const p2 = cleanPokeName(parts[2]);

  switch(type) {
    case 'move':         return { text:`▶ ${p2} использует ${parts[3]}!`,          cls:'log-move' };
    case 'switch':
    case 'drag':         return { text:`↩ ${p2} выходит на поле!`,                 cls:'log-switch' };
    case 'faint':        return { text:`☠ ${p2} потерял сознание!`,                cls:'log-faint' };
    case '-damage': {
      const from = parts[4] ? ` [${parts[4].replace(/\[from\] /,'')}]` : '';
      return { text:`💥 ${p2} получает урон${from}`,                               cls:'log-damage' };
    }
    case '-heal':        return { text:`💚 ${p2} восстанавливает HP`,              cls:'log-heal' };
    case '-status':      return { text:`🔸 ${p2}: ${STATUS_NAMES[parts[3]]||parts[3]}`, cls:'log-status' };
    case '-curestatus':  return { text:`✨ ${p2} избавляется от статуса`,          cls:'log-cure' };
    case '-boost':       return { text:`📈 ${p2}: ${STAT_NAMES[parts[3]]} +${parts[4]}`, cls:'log-boost' };
    case '-unboost':     return { text:`📉 ${p2}: ${STAT_NAMES[parts[3]]} -${parts[4]}`, cls:'log-unboost' };
    case '-clearallboost':
    case '-clearboost':  return { text:`🔄 Все статы сброшены!`,                  cls:'log-cure' };
    case '-weather':     return { text:`🌦 ${WEATHER_NAMES[parts[2]]||parts[2]}`,  cls:'log-weather' };
    case '-supereffective': return { text:`⚡ Суперэффективно!`,                  cls:'log-super' };
    case '-resisted':    return { text:`🛡 Не очень эффективно...`,               cls:'log-resist' };
    case '-immune':      return { text:`🚫 Не действует!`,                        cls:'log-immune' };
    case '-crit':        return { text:`💢 Критический удар!`,                    cls:'log-crit' };
    case '-miss':        return { text:`✗ Промах!`,                               cls:'log-miss' };
    case '-fail':        return { text:`✗ Атака не удалась!`,                     cls:'log-fail' };
    case 'win':          return { text:`🏆 Победитель: ${parts[2]}!`,             cls:'log-win' };
    case 'turn':         return { text:`─── Ход ${parts[2]} ───`,                 cls:'log-turn' };
    case '-item':        return { text:`🎒 ${p2} использует ${parts[3]}`,         cls:'log-item' };
    case '-ability':     return { text:`✦ ${parts[3]} (${p2})`,                   cls:'log-ability' };
    case 'cant':         return { text:`✗ ${p2} не может атаковать!`,             cls:'log-cant' };
    case 'detailschange':
    case '-formechange': return { text:`✨ ${p2} изменяет форму!`,                cls:'log-switch' };
    case '-start': {
      const n = VOLATILE_NAMES[parts[3]] || parts[3]?.replace('move: ','') || parts[3];
      return { text:`🔺 ${p2}: ${n}!`,                                            cls:'log-status' };
    }
    case '-end': {
      const n = VOLATILE_NAMES[parts[3]] || parts[3]?.replace('move: ','') || parts[3];
      return { text:`🔻 ${p2}: ${n} закончился`,                                  cls:'log-cure' };
    }
    case '-sidestart':   return { text:`⚠ ${HAZARD_NAMES[parts[3]]||parts[3]} установлен!`, cls:'log-status' };
    case '-sideend':     return { text:`✓ ${HAZARD_NAMES[parts[3]]||parts[3]} убран`,       cls:'log-cure' };
    case '-fieldstart':  return { text:`🌀 ${FIELD_NAMES[parts[2]]||parts[2]} активирован!`,cls:'log-weather' };
    case '-fieldend':    return { text:`🌀 ${FIELD_NAMES[parts[2]]||parts[2]} закончился`,  cls:'log-cure' };
    default: return null;
  }
};
