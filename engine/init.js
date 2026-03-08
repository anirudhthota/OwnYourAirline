import { createInitialState, getState, loadGame, hasSavedGame } from './state.js';
import { initializeAIAirlines } from './aiEngine.js';
import { generateUsedMarketListings, addFreeAircraftToFleet } from './fleetManager.js';
import { setGameSpeed, setTickCallback, setMonthCallback, setDayEndCallback } from './sim.js';
import { GAME_SPEEDS } from './state.js';
import { generateFlightNumbers } from './scheduler.js';

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
    // Ensure fareMultiplier exists for older saves
    for (const route of state.routes) {
        if (route.fareMultiplier === undefined) route.fareMultiplier = 1.0;
    }
    // Ensure maintenance fields exist for older saves
    for (const ac of state.fleet) {
        if (ac.hoursSinceACheck === undefined) ac.hoursSinceACheck = 0;
        if (ac.hoursSinceBCheck === undefined) ac.hoursSinceBCheck = 0;
        if (ac.hoursSinceCCheck === undefined) ac.hoursSinceCCheck = 0;
        if (ac.pendingCheckType === undefined) ac.pendingCheckType = null;
        if (ac.graceHoursRemaining === undefined) ac.graceHoursRemaining = 0;
        if (ac.maintenanceReleaseTime === undefined) ac.maintenanceReleaseTime = null;
    }
    // Ensure flightNumbers exist for older saves
    for (const sched of state.schedules) {
        if (!sched.flightNumbers) {
            sched.flightNumbers = generateFlightNumbers(sched.departureTimes.length);
        }
    }
    // Ensure transfer caching structures exist
    if (!state.transfers) {
        state.transfers = { flowRates: {}, lastCalculatedDay: -1 };
    }
    return state;
}

export function startSimulation(onTick, onMonth, onDayEnd) {
    setTickCallback(onTick);
    setMonthCallback(onMonth);
    if (onDayEnd) setDayEndCallback(onDayEnd);
    setGameSpeed(GAME_SPEEDS.NORMAL);
}
