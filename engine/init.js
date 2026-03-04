import { createInitialState, getState, loadGame, hasSavedGame } from './state.js';
import { initializeAIAirlines } from './aiEngine.js';
import { setGameSpeed, setTickCallback, setMonthCallback, setDayEndCallback } from './sim.js';
import { GAME_SPEEDS } from './state.js';

export function initNewGame(config) {
    const state = createInitialState(config);
    initializeAIAirlines();
    return state;
}

export function initFromSave() {
    if (!hasSavedGame()) return null;
    const state = loadGame();
    if (!state) return null;
    return state;
}

export function startSimulation(onTick, onMonth, onDayEnd) {
    setTickCallback(onTick);
    setMonthCallback(onMonth);
    if (onDayEnd) setDayEndCallback(onDayEnd);
    setGameSpeed(GAME_SPEEDS.NORMAL);
}
