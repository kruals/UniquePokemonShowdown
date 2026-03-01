"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleInstance = void 0;
// BattleEngine.ts
const sim_1 = require("@pkmn/sim");
const sim_2 = require("@pkmn/sim");
/* ===============================
   CUSTOM DEX SETUP
================================ */
let pokedexData;
let movesData;
try {
    const pData = require('../data/pokedex');
    const mData = require('../data/moves');
    pokedexData = pData.Pokedex || pData.pokedex;
    movesData = mData.Moves || mData.moves;
}
catch {
    console.warn('⚠️ Custom data not loaded');
}
const setupCustomDex = () => {
    const gen9 = sim_2.Dex.forGen(9);
    const data = gen9.data;
    if (pokedexData && data.Pokedex) {
        Object.assign(data.Pokedex, pokedexData);
        gen9.speciesCache = new Map();
    }
    if (movesData && data.Moves) {
        Object.assign(data.Moves, movesData);
        gen9.movesCache = new Map();
    }
    console.log('✅ Dex configured');
};
setupCustomDex();
/* ===============================
   BATTLE INSTANCE
================================ */
class BattleInstance {
    constructor(p1, p2) {
        this.battle = new sim_1.Battle({
            formatid: 'gen9customgame',
            dex: sim_2.Dex.forGen(9),
        });
        // sanitizeTeam нужен только для подготовки формата
        const cleanP1Team = this.sanitizeTeam(p1.mons);
        const cleanP2Team = this.sanitizeTeam(p2.mons);
        this.battle.setPlayer('p1', { name: p1.trainer, team: cleanP1Team });
        this.battle.setPlayer('p2', { name: p2.trainer, team: cleanP2Team });
        if (!this.battle.started) {
            this.battle.start();
        }
        // --- ВАЖНЫЙ МОМЕНТ ---
        // Сразу после старта мы вручную прописываем ID в живые объекты покемонов.
        // Так как в начале боя они стоят в порядке 1-6, мы просто присваиваем индексы.
        [this.battle.p1, this.battle.p2].forEach(side => {
            side.pokemon.forEach((p, i) => {
                // Мы используем 'any', чтобы прицепить свойство originalNum
                p.originalNum = i + 1;
            });
        });
    }
    sanitizeTeam(team) {
        // Здесь num добавлять бесполезно, движок его сотрет.
        // Просто чистим данные.
        return team
            .filter(mon => mon !== null)
            .map(mon => ({
            name: mon.name || mon.species || 'MissingNo',
            species: (mon.species || mon.name || 'MissingNo').toLowerCase(),
            ability: mon.ability || 'None',
            item: mon.item || '',
            level: mon.level || 100,
            shiny: mon.shiny || false,
            moves: (mon.moves || [])
                .filter((m) => m)
                .map((m) => m.toString().toLowerCase().replace(/[^a-z0-9]/g, '')),
            nature: mon.nature || 'Serious',
            evs: mon.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            ivs: mon.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
        }));
    }
    // ЕДИНЫЙ метод для сбора данных (и для init, и для хода)
    prepareSideData(sideIndex) {
        const side = this.battle.sides[sideIndex];
        const request = side.getRequestData();
        return {
            ...request,
            name: side.name,
            id: side.id,
            // Используем requestState конкретного сайда, а не глобальный
            requestState: side.requestState, // 'move' | 'switch' | 'teampreview' | ''
            activeIdx: side.pokemon.findIndex(p => p.isActive),
            pokemon: side.pokemon.map(p => {
                const levelMatch = p.details.match(/, L(\d+)/);
                const level = levelMatch ? levelMatch[1] : "100";
                return {
                    num: p.originalNum,
                    switch: p.switchFlag,
                    name: p.name,
                    species: p.species.name,
                    details: p.details,
                    level,
                    condition: p.getHealth().secret,
                    hp: p.hp,
                    maxhp: p.maxhp,
                    active: p.isActive,
                    fainted: p.fainted,
                    types: p.types,
                    ability: p.ability,
                    item: p.item,
                    baseStats: p.species.baseStats,
                    moveSlots: p.moveSlots.map(move => ({
                        id: move.id,
                        move: move.move,
                        pp: move.pp,
                        maxpp: move.maxpp,
                        target: move.target,
                        disabled: move.disabled
                    }))
                };
            })
        };
    }
    getInitialState() {
        return {
            log: this.battle.log,
            side1: this.prepareSideData(0),
            side2: this.prepareSideData(1),
            ended: this.battle.ended,
            // Глобальный requestState оставляем для серверной логики
            requestState: this.battle.requestState,
        };
    }
    executeTurn(p1Action, p2Action) {
        const startLogIdx = this.battle.log.length;
        const processAction = (player, act) => {
            if (!act)
                return '';
            const side = player === 'p1' ? this.battle.p1 : this.battle.p2;
            // Team Preview: "team 3" → находим реальный индекс по originalNum
            if (act.startsWith('team ')) {
                const requestedNum = parseInt(act.split(' ')[1]);
                const realIndex = side.pokemon.findIndex(p => p.originalNum === requestedNum);
                if (realIndex !== -1) {
                    return `team ${realIndex + 1}`;
                }
                console.warn(`[processAction] Не найден покемон с originalNum=${requestedNum} для team`);
                return act;
            }
            // Switch: "switch 3" → находим реальный индекс по originalNum
            if (act.startsWith('switch ')) {
                const requestedNum = parseInt(act.split(' ')[1]);
                const realIndex = side.pokemon.findIndex(p => p.originalNum === requestedNum);
                if (realIndex !== -1) {
                    return `switch ${realIndex + 1}`;
                }
                console.warn(`[processAction] Не найден покемон с originalNum=${requestedNum} для switch`);
                return act;
            }
            // Move: "move 1", "move 2" и т.д. — индексы атак не меняются, отдаем как есть
            if (act.startsWith('move ')) {
                return act;
            }
            // default и прочее — отдаем как есть
            return act;
        };
        const c1 = processAction('p1', p1Action);
        const c2 = processAction('p2', p2Action);
        // Выполняем только тех, у кого есть действие
        // Это важно для одностороннего switch (volt switch, u-turn и т.д.)
        if (c1)
            this.safeChoose('p1', c1);
        if (c2)
            this.safeChoose('p2', c2);
        return {
            log: this.battle.log.slice(startLogIdx),
            side1: this.prepareSideData(0),
            side2: this.prepareSideData(1),
            winner: this.battle.winner,
            ended: this.battle.ended,
            requestState: this.battle.requestState,
        };
    }
    safeChoose(player, action) {
        try {
            const side = player === 'p1' ? this.battle.p1 : this.battle.p2;
            if (side.isChoiceDone())
                return;
            const success = this.battle.choose(player, action);
            if (!success) {
                console.warn(`Action failed: ${action}, using default`);
                this.battle.choose(player, 'default');
            }
        }
        catch (e) {
            console.error(`🔴 Ошибка в safeChoose (${player}):`, e);
        }
    }
}
exports.BattleInstance = BattleInstance;
