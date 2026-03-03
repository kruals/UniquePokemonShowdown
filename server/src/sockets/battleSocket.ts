import { Server, Socket } from 'socket.io';
import { BattleInstance } from '../services/battleEngine';
import { onlineUsers, userIdToUsername } from '../state';

interface ActiveBattle {
    instance: BattleInstance;
    // Храним userId, а не username
    players: { p1: string; p2: string };
    currentTurns: Record<string, string>;  
}

const activeBattles = new Map<string, ActiveBattle>();
const processingBattles = new Set<string>();

export const registerBattleHandlers = (io: Server, socket: Socket) => {

    // Вызов: from/to теперь userId
    socket.on('send_challenge', ({
        to,       // userId цели
        from,     // userId отправителя
        fromUsername,
        team
    }) => {
        const targetSocketId = onlineUsers.get(to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('incoming_challenge', { from, fromUsername, team });
        }
    });

    socket.on('challenge_response', ({
        to,           // userId challenger'а
        from,         // userId того кто отвечает
        accepted,
        team,
        opponentTeam
    }) => {
        const challengerSocketId = onlineUsers.get(to);
        if (!challengerSocketId || !accepted) return;

        const battleId = `battle-${[from, to].sort().join('-')}-${Date.now()}`;

        try {
            // Стабильный порядок по userId (сравниваем строки)
            const p1Id = from < to ? from : to;
            const p2Id = from < to ? to   : from;

            const p1Team = p1Id === from ? team : opponentTeam;
            const p2Team = p2Id === from ? team : opponentTeam;

            const p1Username = userIdToUsername.get(p1Id) ?? p1Id;
            const p2Username = userIdToUsername.get(p2Id) ?? p2Id;

            const instance = new BattleInstance(
                { trainer: p1Username, mons: p1Team },
                { trainer: p2Username, mons: p2Team },
                battleId,
            );

            activeBattles.set(battleId, {
                instance,
                players: { p1: p1Id, p2: p2Id }, // ← userId, не username
                currentTurns: {}
            });

            socket.join(battleId);
            const challengerSocket = io.sockets.sockets.get(challengerSocketId);
            if (challengerSocket) challengerSocket.join(battleId);

            console.log(`⚔️ Битва: ${battleId} [${p1Username} vs ${p2Username}]`);

            io.to(battleId).emit('challenge_result', {
                battleId,
                accepted: true,
                from,
                to,
                teams: { [p1Id]: p1Team, [p2Id]: p2Team },
                roles: { [p1Id]: 'p1', [p2Id]: 'p2' },
                // Имена для отображения
                usernames: { [p1Id]: p1Username, [p2Id]: p2Username }
            });

            setTimeout(() => {
                const battle = activeBattles.get(battleId);
                if (battle) {
                    const state = battle.instance.getInitialState();
                    io.to(battleId).emit('battle_update', { ...state, battleId }); // battleId внутри объекта
                }
            }, 300);

        } catch (err) {
            console.error('❌ Ошибка инициализации боя:', err);
            socket.emit('error', 'Не удалось создать бой');
        }
    });

    socket.on('join_battle', (battleId: string) => {
        socket.join(battleId);
        const battle = activeBattles.get(battleId);
        if (battle) {
            socket.emit('battle_update', { ...battle.instance.getInitialState(), battleId });;
        }
    });

    // action: { battleId, userId, action }  ← userId вместо username
    socket.on('battle_action', ({ battleId, userId, action }) => {
        const battle = activeBattles.get(battleId);
        if (!battle || processingBattles.has(battleId)) return;
        if (battle.currentTurns[userId]) return;

        battle.currentTurns[userId] = action;

        const showdownBattle = battle.instance.battle;
        const globalState = showdownBattle.requestState;
        let shouldExecute = false;

        if (globalState === 'teampreview' || globalState === 'move') {
            if (Object.keys(battle.currentTurns).length === 2) shouldExecute = true;
        } else if (globalState === 'switch') {
            const p1NeedsSwitch = showdownBattle.p1.requestState === 'switch';
            const p2NeedsSwitch = showdownBattle.p2.requestState === 'switch';

            if (p1NeedsSwitch && p2NeedsSwitch) {
                if (Object.keys(battle.currentTurns).length === 2) shouldExecute = true;
            } else if (p1NeedsSwitch) {
                if (battle.currentTurns[battle.players.p1]) shouldExecute = true;
            } else if (p2NeedsSwitch) {
                if (battle.currentTurns[battle.players.p2]) shouldExecute = true;
            }
        }

        if (shouldExecute) {
            processingBattles.add(battleId);
            try {
                const p1Action = battle.currentTurns[battle.players.p1] || '';
                const p2Action = battle.currentTurns[battle.players.p2] || '';

                const result = battle.instance.executeTurn(p1Action, p2Action);
                io.to(battleId).emit('battle_update', {...result,battleId});
                battle.currentTurns = {};

                if (result.winner || result.ended) {
                    setTimeout(() => activeBattles.delete(battleId), 600000);
                }
            } catch (err) {
                console.error('❌ Ошибка при выполнении хода:', err);
            } finally {
                setTimeout(() => processingBattles.delete(battleId), 100);
            }
        } else {
            socket.emit('action_queued');
        }
    });

    socket.on('disconnect', () => {
        // TODO: можно добавить forfeit при дисконнекте
    });
};