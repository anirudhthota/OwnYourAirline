export const DIFFICULTY = {
    EASY: { label: 'Easy', startingCash: 1000000000, aiAggression: 0.3, description: '$1B starting capital, relaxed AI competition' },
    MEDIUM: { label: 'Medium', startingCash: 500000000, aiAggression: 0.6, description: '$500M starting capital, balanced AI' },
    HARD: { label: 'Hard', startingCash: 200000000, aiAggression: 0.9, description: '$200M starting capital, aggressive AI' },
    SANDBOX: { label: 'Sandbox', startingCash: null, aiAggression: 0.5, description: 'Player chooses starting capital, no game over' }
};

export const GAME_SPEEDS = {
    PAUSED: 0,
    NORMAL: 1,
    FAST: 2,
    FASTER: 4,
    FASTEST: 8
};

export const TICK_MINUTES = 5;

let gameState = null;

export function createInitialState(config) {
    gameState = {
        config: {
            airlineName: config.airlineName,
            iataCode: config.iataCode,
            airlineColor: config.airlineColor,
            hubAirport: config.hubAirport,
            difficulty: config.difficulty,
            sandboxCash: config.sandboxCash || null
        },

        clock: {
            currentDate: new Date(2025, 0, 1, 6, 0, 0),
            speed: GAME_SPEEDS.PAUSED,
            tickInterval: null,
            totalTicks: 0
        },

        finances: {
            cash: config.difficulty === 'SANDBOX' && config.sandboxCash
                ? config.sandboxCash
                : DIFFICULTY[config.difficulty].startingCash,
            totalRevenue: 0,
            totalCosts: 0,
            monthlyRevenue: 0,
            monthlyCosts: 0,
            monthlyPnL: [],
            godMode: false
        },

        fleet: [],
        nextFleetId: 1,

        routes: [],
        nextRouteId: 1,

        schedules: [],
        nextScheduleId: 1,

        flights: {
            active: [],
            completed: [],
            nextFlightId: 1
        },

        slots: {},

        banks: [],
        nextBankId: 1,

        ai: {
            airlines: [],
            routes: [],
            difficulty: DIFFICULTY[config.difficulty]?.aiAggression || 0.5
        },

        reputation: 50,

        log: [],

        ui: {
            selectedPanel: 'dashboard',
            mapCenter: { lat: 0, lon: 0 },
            mapZoom: 1
        }
    };

    return gameState;
}

export function getState() {
    return gameState;
}

export function setState(newState) {
    gameState = newState;
}

export function addLogEntry(message, type = 'info') {
    if (!gameState) return;
    gameState.log.unshift({
        timestamp: new Date(gameState.clock.currentDate),
        message,
        type
    });
    if (gameState.log.length > 500) {
        gameState.log.length = 500;
    }
}

export function deductCash(amount, description) {
    if (!gameState) return false;
    if (gameState.finances.godMode) {
        addLogEntry(`[GOD] ${description}: $${formatMoney(amount)} (not deducted)`, 'finance');
        return true;
    }
    if (gameState.finances.cash < amount) {
        addLogEntry(`Insufficient funds for ${description}: need $${formatMoney(amount)}, have $${formatMoney(gameState.finances.cash)}`, 'warning');
        return false;
    }
    gameState.finances.cash -= amount;
    gameState.finances.totalCosts += amount;
    gameState.finances.monthlyCosts += amount;
    addLogEntry(`${description}: -$${formatMoney(amount)}`, 'finance');
    return true;
}

export function addCash(amount, description) {
    if (!gameState) return;
    gameState.finances.cash += amount;
    gameState.finances.totalRevenue += amount;
    gameState.finances.monthlyRevenue += amount;
    addLogEntry(`${description}: +$${formatMoney(amount)}`, 'finance');
}

export function formatMoney(amount) {
    if (amount >= 1000000000) return (amount / 1000000000).toFixed(2) + 'B';
    if (amount >= 1000000) return (amount / 1000000).toFixed(2) + 'M';
    if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
    return amount.toFixed(0);
}

export function getFormattedDate() {
    if (!gameState) return '';
    const d = gameState.clock.currentDate;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function getFormattedTime() {
    if (!gameState) return '';
    const d = gameState.clock.currentDate;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function saveGame() {
    if (!gameState) return;
    const saveData = JSON.parse(JSON.stringify(gameState));
    saveData.clock.currentDate = gameState.clock.currentDate.toISOString();
    saveData.clock.tickInterval = null;
    localStorage.setItem('ownYourAirline_save', JSON.stringify(saveData));
    addLogEntry('Game saved', 'system');
}

export function loadGame() {
    const raw = localStorage.getItem('ownYourAirline_save');
    if (!raw) return null;
    const data = JSON.parse(raw);
    data.clock.currentDate = new Date(data.clock.currentDate);
    data.clock.tickInterval = null;
    data.clock.speed = GAME_SPEEDS.PAUSED;
    gameState = data;
    return gameState;
}

export function hasSavedGame() {
    return localStorage.getItem('ownYourAirline_save') !== null;
}
