import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({

      /* ══ USER ══════════════════════════════════════════════ */
      user: (() => {
        try {
            const saved = localStorage.getItem('ps_user');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
      })(),

      setUser: (user) => set({ user }),

      clearUser: () => {
        localStorage.removeItem('ps_token');
        set({ user: null });
      },

      /* ══ ONLINE USERS ══════════════════════════════════════ */
      onlineUsers: [],
      setOnlineUsers: (list) => set({ onlineUsers: list }),

      /* ══ PENDING CHALLENGES ════════════════════════════════ */
      pendingChallenges: [],

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

      /* ══ OUTGOING CHALLENGE ════════════════════════════════ */
      outgoingChallenge: null,
      setOutgoingChallenge: (data) => set({ outgoingChallenge: data }),
      clearOutgoingChallenge: () => set({ outgoingChallenge: null }),

      /* ══ ACTIVE BATTLES ════════════════════════════════════ */
      activeBattles: {},

      addBattle: (battleId, meta) => set(state => ({
        activeBattles: { ...state.activeBattles, [battleId]: { ...meta, battleId } }
      })),

      removeBattle: (battleId) => set(state => {
        const next = { ...state.activeBattles };
        delete next[battleId];
        const nextStates = { ...state.battleStates };
        delete nextStates[battleId];
        return { activeBattles: next, battleStates: nextStates };
      }),

      /* ══ BATTLE STATES ═════════════════════════════════════ */
      battleStates: {},

      updateBattleState: (battleId, data) => set(state => {
        const prev = state.battleStates[battleId] || {
          side1: null, side2: null, logs: [], winner: null,
          weather: null, weatherTurns: 0,
          statuses: {}, volatiles: {}, boosts: { p1:{}, p2:{} },
          hazards: { p1:[], p2:[] }, seenMoves: {}, lastMove: null,
          recentLog: [],
        };

        const newLog = data.log || [];
        const newLogs = newLog.map(formatLogLine).filter(Boolean);

        // Парсим статусы, волатайлы, погоду из лога
        let statuses   = { ...prev.statuses };
        let volatiles  = { ...prev.volatiles };
        let weather    = prev.weather;
        let weatherTurns = prev.weatherTurns;
        let hazards    = { p1: [...prev.hazards.p1], p2: [...prev.hazards.p2] };
        let seenMoves  = { ...prev.seenMoves };
        let lastMove   = prev.lastMove;

        for (const line of newLog) {
          const parts = line.split('|');
          if (parts.length < 2) continue;
          const type = parts[1];
          const cleanName = (s) => s?.includes(': ') ? s.split(': ')[1] : (s || '');

          switch(type) {
            case '-status':
              statuses = { ...statuses, [cleanName(parts[2])]: parts[3] };
              break;
            case '-curestatus':
              statuses = { ...statuses };
              delete statuses[cleanName(parts[2])];
              break;
            case '-weather':
              if (parts[2] === 'none') { weather = null; weatherTurns = 0; }
              else if (parts[3] !== '[upkeep]') { weather = parts[2]; weatherTurns = WEATHER_DUR[parts[2]] || 5; }
              else weatherTurns = Math.max(0, weatherTurns - 1);
              break;
            case '-sidestart': {
              const hname = HAZARD_NAMES[parts[3]] || parts[3];
              const hs = parts[2]?.startsWith('p1') ? 'p1' : 'p2';
              if (!hazards[hs].includes(hname)) hazards[hs] = [...hazards[hs], hname];
              break;
            }
            case '-sideend': {
              const hname = HAZARD_NAMES[parts[3]] || parts[3];
              const hs = parts[2]?.startsWith('p1') ? 'p1' : 'p2';
              hazards[hs] = hazards[hs].filter(h => h !== hname);
              break;
            }
            case '-start': {
              const pokemon = cleanName(parts[2]);
              const effect = parts[3];
              if (VISIBLE_VOLATILE.includes(effect)) {
                const cur = volatiles[pokemon] || [];
                if (!cur.includes(effect)) {
                  volatiles = { ...volatiles, [pokemon]: [...cur, effect] };
                }
              }
              break;
            }
            case '-end': {
              const pokemon = cleanName(parts[2]);
              const effect = parts[3];
              if (volatiles[pokemon]) {
                volatiles = { ...volatiles, [pokemon]: volatiles[pokemon].filter(e => e !== effect) };
              }
              break;
            }
            case 'switch':
            case 'drag': {
              // При свапе — очищаем волатайлы ушедшего покемона
              const pokemon = cleanName(parts[2]);
              volatiles = { ...volatiles };
              delete volatiles[pokemon];
              break;
            }
            case 'move': {
              lastMove = parts[3];
              const pokemon = cleanName(parts[2]);
              const move = parts[3];
              if (move && pokemon) {
                const cur = seenMoves[pokemon] || [];
                if (!cur.includes(move)) {
                  seenMoves = { ...seenMoves, [pokemon]: [...cur, move] };
                }
              }
              break;
            }
            default: break;
          }
        }

        return {
          battleStates: {
            ...state.battleStates,
            [battleId]: {
              ...prev,
              side1:        data.side1        || prev.side1,
              side2:        data.side2        || prev.side2,
              winner:       data.winner       || prev.winner,
              requestState: data.requestState ?? prev.requestState,
              logs:         [...prev.logs, ...newLogs],
              // recentLog — только последний пакет, для парсинга бустов в компоненте
              recentLog:    newLog,
              statuses,
              volatiles,
              weather,
              weatherTurns,
              hazards,
              seenMoves,
              lastMove,
            }
          }
        };
      }),

      getBattleState: (battleId) => get().battleStates[battleId] || null,

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
      partialize: (state) => ({
        user:          state.user,
        activeBattles: state.activeBattles,
        battleStates:  state.battleStates,
        outgoingChallenge: state.outgoingChallenge,
      }),
    }
  )
);

export default useAppStore;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS (дублируем для автономности store)
═══════════════════════════════════════════════════════════════ */
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
    case 'move':       return { type:'move',   pokemon:cleanName(parts[2]), move:parts[3] };
    case 'switch':
    case 'drag':       return { type:'switch', pokemon:cleanName(parts[2]) };
    case 'faint':      return { type:'faint',  pokemon:cleanName(parts[2]) };
    case '-damage':    return { type:'damage', side: line.includes('|p1') ? 'p1' : 'p2' };
    case '-heal':      return { type:'heal',   pokemon:cleanName(parts[2]) };
    case '-status':    return { type:'status', pokemon:cleanName(parts[2]), status:parts[3] };
    case '-curestatus':return { type:'curestatus', pokemon:cleanName(parts[2]) };
    case '-boost':     return { type:'boost',  side:line.includes('|p1')?'p1':'p2', stat:parts[3], amount:parseInt(parts[4]) };
    case '-unboost':   return { type:'unboost',side:line.includes('|p1')?'p1':'p2', stat:parts[3], amount:parseInt(parts[4]) };
    case '-clearallboost':
    case '-clearboost':return { type:'clearboost' };
    case '-weather':   return { type:'weather', weather:parts[2], upkeep:parts[3]==='[upkeep]' };
    case '-sidestart': return { type:'sidestart', side:parts[2]?.startsWith('p1')?'p1':'p2', condition:parts[3] };
    case '-sideend':   return { type:'sideend',   side:parts[2]?.startsWith('p1')?'p1':'p2', condition:parts[3] };
    case '-supereffective': return { type:'supereffective' };
    case '-resisted':  return { type:'resisted' };
    case '-immune':    return { type:'immune' };
    case '-crit':      return { type:'crit' };
    case '-miss':      return { type:'miss' };
    case '-fail':      return { type:'fail' };
    case 'win':        return { type:'win', winner:parts[2] };
    case 'turn':       return { type:'turn', num:parseInt(parts[2]) };
    case '-item':      return { type:'item', pokemon:cleanName(parts[2]), item:parts[3] };
    case '-ability':   return { type:'ability', pokemon:cleanName(parts[2]), ability:parts[3] };
    case 'cant':       return { type:'cant', pokemon:cleanName(parts[2]) };
    case '-start':     return { type:'volstart', pokemon:cleanName(parts[2]), effect:parts[3] };
    case '-end':       return { type:'volend',   pokemon:cleanName(parts[2]), effect:parts[3] };
    default: return null;
  }
};

const STAT_NAMES = { hp:'HP', atk:'Атака', def:'Защита', spa:'Сп.Атк', spd:'Сп.Защ', spe:'Скорость' };
const VOLATILE_NAMES = {
  'move: Taunt':'Провокация','Taunt':'Провокация','move: Encore':'Encore','Encore':'Encore',
  'move: Substitute':'Замена','Substitute':'Замена','move: Confusion':'Замешательство','confusion':'Замешательство',
  'move: Leech Seed':'Посев','leechseed':'Посев','move: Torment':'Истязание','Torment':'Истязание',
  'move: Disable':'Блокировка','Disable':'Блокировка','move: Yawn':'Зевота','Yawn':'Зевота',
  'move: Perish Song':'Гибельная песнь','move: Aqua Ring':'Кольцо воды',
  'move: Ingrain':'Укоренение','move: Curse':'Проклятие',
};

const formatLogLine = (line) => {
  const p = parseLog(line);
  if (!p) return null;
  const STATUS_NAMES = { brn:'Ожог', par:'Паралич', psn:'Отравление', tox:'Сильное отравление', slp:'Сон', frz:'Заморозка' };
  const WEATHER_NAMES = { SunnyDay:'☀️ Сильная жара', RainDance:'🌧 Ливень', Sandstorm:'🌪 Песчаная буря', Hail:'❄️ Град', Snow:'❄️ Снег', none:'☁️ Погода нормализовалась' };
  switch (p.type) {
    case 'move':         return { text:`▶ ${p.pokemon} использует ${p.move}!`, cls:'log-move' };
    case 'switch':       return { text:`↩ ${p.pokemon} выходит на поле!`, cls:'log-switch' };
    case 'faint':        return { text:`☠ ${p.pokemon} потерял сознание!`, cls:'log-faint' };
    case 'damage':       return { text:`💥 Получен урон`, cls:'log-damage' };
    case 'heal':         return { text:`💚 ${p.pokemon} восстанавливает HP`, cls:'log-heal' };
    case 'status':       return { text:`🔸 ${p.pokemon}: ${STATUS_NAMES[p.status]||p.status}`, cls:'log-status' };
    case 'curestatus':   return { text:`✨ ${p.pokemon} избавляется от статуса`, cls:'log-cure' };
    case 'boost':        return { text:`📈 ${p.pokemon}: ${STAT_NAMES[p.stat]} +${p.amount}`, cls:'log-boost' };
    case 'unboost':      return { text:`📉 ${p.pokemon}: ${STAT_NAMES[p.stat]} -${p.amount}`, cls:'log-unboost' };
    case 'clearboost':   return { text:`🔄 Все статы сброшены!`, cls:'log-cure' };
    case 'weather':      return { text:`🌦 ${WEATHER_NAMES[p.weather]||p.weather}`, cls:'log-weather' };
    case 'supereffective': return { text:`⚡ Суперэффективно!`, cls:'log-super' };
    case 'resisted':     return { text:`🛡 Не очень эффективно...`, cls:'log-resist' };
    case 'immune':       return { text:`🚫 Не действует!`, cls:'log-immune' };
    case 'crit':         return { text:`💢 Критический удар!`, cls:'log-crit' };
    case 'miss':         return { text:`✗ Промах!`, cls:'log-miss' };
    case 'fail':         return { text:`✗ Атака не удалась!`, cls:'log-fail' };
    case 'win':          return { text:`🏆 Победитель: ${p.winner}!`, cls:'log-win' };
    case 'turn':         return { text:`─── Ход ${p.num} ───`, cls:'log-turn' };
    case 'item':         return { text:`🎒 ${p.pokemon}: предмет активирован`, cls:'log-item' };
    case 'ability':      return { text:`✦ ${p.ability} (${p.pokemon})`, cls:'log-ability' };
    case 'cant':         return { text:`✗ ${p.pokemon} не может атаковать!`, cls:'log-cant' };
    case 'volstart':     return { text:`🔺 ${p.pokemon}: ${VOLATILE_NAMES[p.effect]||p.effect}!`, cls:'log-status' };
    case 'volend':       return { text:`🔻 ${p.pokemon}: ${VOLATILE_NAMES[p.effect]||p.effect} закончился`, cls:'log-cure' };
    case 'sidestart':    return { text:`⚠ ${HAZARD_NAMES[p.condition]||p.condition} установлен!`, cls:'log-status' };
    case 'sideend':      return { text:`✓ ${HAZARD_NAMES[p.condition]||p.condition} убран`, cls:'log-cure' };
    default: return null;
  }
};
