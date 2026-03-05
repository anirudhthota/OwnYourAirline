import { createInitialState, getState, loadGame, hasSavedGame } from './state.js';
import { initializeAIAirlines } from './aiEngine.js';
import { generateUsedMarketListings, addFreeAircraftToFleet } from './fleetManager.js';
import { setGameSpeed, setTickCallback, setMonthCallback, setDayEndCallback } from './sim.js';
import { GAME_SPEEDS } from './state.js';

export function initNewGame(config) {
    const state = createInitialState(config);
    initializeAIAirlines();

    // Initialize used aircraft market
    const includeDiscountA321 = config.difficulty === 'EASY' || config.difficulty === 'MEDIUM';
    generateUsedMarketListings(includeDiscountA321);

    // Sandbox: free A321neo in fleet
    if (config.difficulty === 'SANDBOX') {
        addFreeAircraftToFleet('A321neo');
    }

    return state;
}

export function initFromSave() {
    if (!hasSavedGame()) return null;
    const state = loadGame();
    if (!state) return null;
    // Ensure usedMarket exists for older saves
    if (!state.usedMarket) {
        state.usedMarket = { listings: [], lastRefreshDay: 0, nextListingId: 1 };
    }
    // Ensure currentLocation exists for older saves
    for (const ac of state.fleet) {
        if (!ac.currentLocation) {
            ac.currentLocation = ac.status === 'in_flight' ? null : state.config.hubAirport;
        }
    }
    // Ensure pairedRouteId exists for older saves
    for (const route of state.routes) {
        if (route.pairedRouteId === undefined) {
            route.pairedRouteId = null;
        }
    }
    return state;
}

export function startSimulation(onTick, onMonth, onDayEnd) {
    setTickCallback(onTick);
    setMonthCallback(onMonth);
    if (onDayEnd) setDayEndCallback(onDayEnd);
    setGameSpeed(GAME_SPEEDS.NORMAL);
}
