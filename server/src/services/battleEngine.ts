// BattleEngine.ts
import { Battle, PokemonSet, ID } from '@pkmn/sim';
import { Dex } from '@pkmn/sim';

export interface PlayerTeam {
    trainer: string;
    mons: any[];
}

/* ===============================
   CUSTOM DEX SETUP
================================ */

let pokedexData: any;
let movesData: any;

try {
    const pData = require('#pokedex');
    const mData = require('#moves');

    pokedexData = pData.default || pData;
    movesData = mData.default || mData;
} catch {
    console.warn('⚠️ Custom data not loaded');
}

const setupCustomDex = () => {
    // Патчим оба — и базовый Dex, и gen9
    const dexInstances = [Dex, Dex.forGen(9)] as any[];

    for (const dex of dexInstances) {
        const data = dex.data as any;
        if (!data) continue;

        if (pokedexData && data.Pokedex) {
            Object.assign(data.Pokedex, pokedexData);
        }
        if (movesData && data.Moves) {
            Object.assign(data.Moves, movesData);
        }

        // Сбрасываем ВСЕ Map-кэши какие есть
        for (const key of Object.keys(dex)) {
            if ((dex as any)[key] instanceof Map) {
                (dex as any)[key].clear();
            }
        }
    }

    console.log('✅ Dex configured. Pokedex entries:', 
        Object.keys((Dex as any).data?.Pokedex || {}).length);
};

setupCustomDex();

/* ===============================
   BATTLE INSTANCE
================================ */

export class BattleInstance {
    public battle: Battle;
    public battleId!:string;

    constructor(p1: PlayerTeam, p2: PlayerTeam,battleId:string) {
        this.battleId = battleId
        this.battle = new Battle({
            formatid: 'gen9customgame' as ID,
            dex: Dex.forGen(9),
        } as any);

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
                (p as any).originalNum = i + 1;
            });
        });
    }

    private sanitizeTeam(team: any[]): PokemonSet[] {
        // Здесь num добавлять бесполезно, движок его сотрет.
        // Просто чистим данные.
        return team
            .filter(mon => mon !== null)
            .map(mon => ({
                name: mon.name || mon.species || 'MissingNo',
                species: (mon.species || mon.name || 'MissingNo').toLowerCase() as ID,
                ability: mon.ability || 'None',
                item: mon.item || '',
                level: mon.level || 100,
                shiny: mon.shiny || false,
                moves: (mon.moves || [])
                    .filter((m: any) => m)
                    .map((m: any) => m.toString().toLowerCase().replace(/[^a-z0-9]/g, '')),
                nature: mon.nature || 'Serious',
                evs: mon.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
                ivs: mon.ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
            } as any));
    }

    // ЕДИНЫЙ метод для сбора данных (и для init, и для хода)
            private prepareSideData(sideIndex: number) {
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
                num: (p as any).originalNum,
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
            battleId:this.battleId,
            log: this.battle.log,
            side1: this.prepareSideData(0),
            side2: this.prepareSideData(1),
            ended: this.battle.ended,
            // Глобальный requestState оставляем для серверной логики
            requestState: this.battle.requestState,
        };
}

    executeTurn(p1Action: string, p2Action: string) {
    const startLogIdx = this.battle.log.length;

    const processAction = (player: 'p1' | 'p2', act: string): string => {
        if (!act) return '';

        const side = player === 'p1' ? this.battle.p1 : this.battle.p2;

        // Team Preview: "team 3" → находим реальный индекс по originalNum
        if (act.startsWith('team ')) {
            const requestedNum = parseInt(act.split(' ')[1]);
            const realIndex = side.pokemon.findIndex(p => (p as any).originalNum === requestedNum);
            if (realIndex !== -1) {
                return `team ${realIndex + 1}`;
            }
            console.warn(`[processAction] Не найден покемон с originalNum=${requestedNum} для team`);
            return act;
        }

        // Switch: "switch 3" → находим реальный индекс по originalNum
        if (act.startsWith('switch ')) {
            const requestedNum = parseInt(act.split(' ')[1]);
            const realIndex = side.pokemon.findIndex(p => (p as any).originalNum === requestedNum);
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
    if (c1) this.safeChoose('p1', c1);
    if (c2) this.safeChoose('p2', c2);

    return {
        battleId:this.battleId,
        log: this.battle.log.slice(startLogIdx),
        side1: this.prepareSideData(0),
        side2: this.prepareSideData(1),
        winner: this.battle.winner,
        ended: this.battle.ended,
        requestState: this.battle.requestState,
    };
}

    private safeChoose(player: 'p1' | 'p2', action: string) {
        try {
            const side = player === 'p1' ? this.battle.p1 : this.battle.p2;
            if (side.isChoiceDone()) return;
            
            const success = this.battle.choose(player, action);
            if (!success) {
                console.warn(`Action failed: ${action}, using default`);
                this.battle.choose(player, 'default');
            }
        } catch (e) {
            console.error(`🔴 Ошибка в safeChoose (${player}):`, e);
        }
    }
}