"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBattleHandlers = void 0;
const battleEngine_1 = require("../services/battleEngine");
const state_1 = require("../state");
const activeBattles = new Map();
const processingBattles = new Set();
const registerBattleHandlers = (io, socket) => {
    // --- Отправка вызова игроку
    socket.on('send_challenge', ({ to, from, team }) => {
        const targetId = state_1.onlineUsers.get(to);
        if (targetId) {
            io.to(targetId).emit('incoming_challenge', { from, team });
        }
    });
    // --- Ответ на вызов и создание боя
    socket.on('challenge_response', ({ to, from, accepted, team, opponentTeam }) => {
        const challengerId = state_1.onlineUsers.get(to);
        if (!challengerId || !accepted)
            return;
        // Генерируем уникальный ID битвы
        const battleId = `battle-${[from, to].sort().join('-')}-${Date.now()}`;
        try {
            // СТРОГО: Определяем p1 и p2 по алфавиту для стабильности
            const p1Name = from < to ? from : to;
            const p2Name = from < to ? to : from;
            const p1Team = p1Name === from ? team : opponentTeam;
            const p2Team = p2Name === from ? team : opponentTeam;
            // Создаем экземпляр движка
            const instance = new battleEngine_1.BattleInstance({ trainer: p1Name, mons: p1Team }, { trainer: p2Name, mons: p2Team });
            // Сохраняем состояние боя
            activeBattles.set(battleId, {
                instance,
                players: { p1: p1Name, p2: p2Name },
                currentTurns: {}
            });
            // Добавляем обоих игроков в комнату сокета
            socket.join(battleId);
            const challengerSocket = io.sockets.sockets.get(challengerId);
            if (challengerSocket)
                challengerSocket.join(battleId);
            console.log(`⚔️ Битва создана: ${battleId} [${p1Name} vs ${p2Name}]`);
            // Уведомляем клиентов о начале
            io.to(battleId).emit('challenge_result', {
                battleId,
                accepted: true,
                from,
                to,
                // Добавляем объект teams, чтобы фронтенд мог его прочитать
                teams: {
                    [p1Name]: p1Team,
                    [p2Name]: p2Team
                },
                roles: { [p1Name]: 'p1', [p2Name]: 'p2' }
            });
            // Первичная отправка состояния через небольшую паузу
            setTimeout(() => {
                const battle = activeBattles.get(battleId);
                if (battle) {
                    io.to(battleId).emit('battle_update', battle.instance.getInitialState());
                }
            }, 300);
        }
        catch (err) {
            console.error('❌ Ошибка инициализации боя:', err);
            socket.emit('error', 'Не удалось создать бой');
        }
    });
    // --- Подключение к существующей комнате (например, после рефреша)
    socket.on('join_battle', (battleId) => {
        socket.join(battleId);
        const battle = activeBattles.get(battleId);
        if (battle) {
            socket.emit('battle_update', battle.instance.getInitialState());
        }
    });
    // --- Обработка действий (атака, замена, команда)
    socket.on('battle_action', ({ battleId, username, action }) => {
        const battle = activeBattles.get(battleId);
        if (!battle || processingBattles.has(battleId))
            return;
        if (battle.currentTurns[username])
            return;
        battle.currentTurns[username] = action;
        const showdownBattle = battle.instance.battle;
        const globalState = showdownBattle.requestState;
        let shouldExecute = false;
        if (globalState === 'teampreview' || globalState === 'move') {
            if (Object.keys(battle.currentTurns).length === 2) {
                shouldExecute = true;
            }
        }
        else if (globalState === 'switch') {
            // Проверяем requestState каждого сайда отдельно
            const p1NeedsSwitch = showdownBattle.p1.requestState === 'switch';
            const p2NeedsSwitch = showdownBattle.p2.requestState === 'switch';
            if (p1NeedsSwitch && p2NeedsSwitch) {
                if (Object.keys(battle.currentTurns).length === 2)
                    shouldExecute = true;
            }
            else if (p1NeedsSwitch) {
                if (battle.currentTurns[battle.players.p1])
                    shouldExecute = true;
            }
            else if (p2NeedsSwitch) {
                if (battle.currentTurns[battle.players.p2])
                    shouldExecute = true;
            }
        }
        if (shouldExecute) {
            processingBattles.add(battleId);
            try {
                // Извлекаем действия согласно ролям p1/p2
                const p1Action = battle.currentTurns[battle.players.p1] || '';
                const p2Action = battle.currentTurns[battle.players.p2] || '';
                // Выполняем расчет хода в движке
                const result = battle.instance.executeTurn(p1Action, p2Action);
                // Рассылаем результат всем участникам (включая логи и новые HP)
                io.to(battleId).emit('battle_update', result);
                // Очищаем накопитель ходов для следующего раунда
                battle.currentTurns = {};
                // Если бой окончен, удаляем его из памяти через 10 минут
                if (result.winner || result.ended) {
                    setTimeout(() => activeBattles.delete(battleId), 600000);
                }
            }
            catch (err) {
                console.error('❌ Ошибка при выполнении хода:', err);
            }
            finally {
                // Разблокируем обработку следующих действий
                setTimeout(() => processingBattles.delete(battleId), 100);
            }
        }
        else {
            // Если походил только один, подтверждаем ему, что ход принят
            socket.emit('action_queued');
        }
    });
    socket.on('disconnect', () => {
        // Здесь можно реализовать логику поражения при дисконнекте
    });
};
exports.registerBattleHandlers = registerBattleHandlers;
