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

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
export const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
export const MINUTES_PER_MONTH = 4 * MINUTES_PER_WEEK;
export const MINUTES_PER_YEAR = 12 * MINUTES_PER_MONTH;

let gameState = null;

export function getGameTime(totalMinutes) {
    if (totalMinutes == null) totalMinutes = 0;
    const year = 1 + Math.floor(totalMinutes / MINUTES_PER_YEAR);
    const remainAfterYear = totalMinutes % MINUTES_PER_YEAR;
    const month = 1 + Math.floor(remainAfterYear / MINUTES_PER_MONTH);
    const remainAfterMonth = remainAfterYear % MINUTES_PER_MONTH;
    const week = 1 + Math.floor(remainAfterMonth / MINUTES_PER_WEEK);
    const remainAfterWeek = remainAfterMonth % MINUTES_PER_WEEK;
    const day = 1 + Math.floor(remainAfterWeek / MINUTES_PER_DAY);
    const remainAfterDay = remainAfterWeek % MINUTES_PER_DAY;
    const hour = Math.floor(remainAfterDay / MINUTES_PER_HOUR);
    const minute = remainAfterDay % MINUTES_PER_HOUR;
    return { year, month, week, day, hour, minute };
}

export function getCurrentHour() {
    if (!gameState) return 0;
    return Math.floor((gameState.clock.totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
}

export function getCurrentMinute() {
    if (!gameState) return 0;
    return gameState.clock.totalMinutes % MINUTES_PER_HOUR;
}

export function getAbsoluteMonth() {
    if (!gameState) return 0;
    return Math.floor(gameState.clock.totalMinutes / MINUTES_PER_MONTH);
}

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
            totalMinutes: 6 * MINUTES_PER_HOUR,
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
        timestamp: gameState.clock.totalMinutes,
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
    const gt = getGameTime(gameState.clock.totalMinutes);
    return `Year ${gt.year}, Month ${gt.month}, Week ${gt.week}, Day ${gt.day}`;
}

export function getFormattedTime() {
    if (!gameState) return '';
    const gt = getGameTime(gameState.clock.totalMinutes);
    return `${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
}

export function formatGameTimestamp(totalMinutes) {
    const gt = getGameTime(totalMinutes);
    return `Y${gt.year} M${gt.month} W${gt.week} D${gt.day} ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
}

export function saveGame() {
    if (!gameState) return;
    const saveData = JSON.parse(JSON.stringify(gameState));
    saveData.clock.tickInterval = null;
    localStorage.setItem('ownYourAirline_save', JSON.stringify(saveData));
    addLogEntry('Game saved', 'system');
}

export function loadGame() {
    const raw = localStorage.getItem('ownYourAirline_save');
    if (!raw) return null;
    const data = JSON.parse(raw);
    data.clock.tickInterval = null;
    data.clock.speed = GAME_SPEEDS.PAUSED;
    gameState = data;
    return gameState;
}

export function hasSavedGame() {
    return localStorage.getItem('ownYourAirline_save') !== null;
}
