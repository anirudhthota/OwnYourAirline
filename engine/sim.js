import { getState, addLogEntry, addCash, deductCash, TICK_MINUTES, GAME_SPEEDS, formatMoney, MINUTES_PER_DAY, MINUTES_PER_HOUR, MINUTES_PER_MONTH, getGameTime } from './state.js';
import { getAircraftByType } from '../data/aircraft.js';
import { getAirportByIata } from '../data/airports.js';
import { calculateLoadFactor, calculateFlightRevenue, calculateFlightCost, getRouteById, getTotalDailySeatsOnRoute } from './routeEngine.js';
import { processMonthlyLeaseCosts } from './fleetManager.js';
import { monthlyAIExpansion } from './aiEngine.js';

let tickCallback = null;
let monthCallback = null;

export function setTickCallback(cb) { tickCallback = cb; }
export function setMonthCallback(cb) { monthCallback = cb; }

export function setGameSpeed(speed) {
    const state = getState();
    if (state.clock.tickInterval) {
        clearInterval(state.clock.tickInterval);
        state.clock.tickInterval = null;
    }

    state.clock.speed = speed;

    if (speed === GAME_SPEEDS.PAUSED) return;

    const intervalMs = Math.max(50, 1000 / speed);
    state.clock.tickInterval = setInterval(() => tick(), intervalMs);
}

export function tick() {
    const state = getState();
    if (!state || state.clock.speed === GAME_SPEEDS.PAUSED) return;

    const prevTotalMinutes = state.clock.totalMinutes;
    state.clock.totalMinutes += TICK_MINUTES;
    state.clock.totalTicks++;

    processFlightDepartures();
    processActiveFlights();
    processSlotUsage();

    const prevMonth = Math.floor(prevTotalMinutes / MINUTES_PER_MONTH);
    const currMonth = Math.floor(state.clock.totalMinutes / MINUTES_PER_MONTH);
    if (currMonth !== prevMonth) {
        processMonthEnd();
    }

    if (tickCallback) tickCallback();
}

function processFlightDepartures() {
    const state = getState();
    const minuteOfDay = state.clock.totalMinutes % MINUTES_PER_DAY;
    const currentHour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
    const currentMinute = minuteOfDay % MINUTES_PER_HOUR;

    for (const schedule of state.schedules) {
        if (!schedule.active) continue;

        const route = getRouteById(schedule.routeId);
        if (!route || !route.active) continue;

        const aircraft = state.fleet.find(f => f.id === schedule.aircraftId);
        if (!aircraft) continue;

        for (const depTime of schedule.departureTimes) {
            const depMinutes = depTime.hour * 60 + depTime.minute;
            const currentMinutes = currentHour * 60 + currentMinute;

            if (currentMinutes >= depMinutes && currentMinutes < depMinutes + TICK_MINUTES) {
                if (aircraft.status !== 'available') continue;

                if (!checkAndUseSlot(route.origin, currentHour)) {
                    addLogEntry(`Slot unavailable at ${route.origin} for ${String(currentHour).padStart(2, '0')}:00 — flight skipped`, 'warning');
                    continue;
                }

                launchFlight(schedule, route, aircraft, depTime);
            }
        }
    }
}

function launchFlight(schedule, route, aircraft, depTime) {
    const state = getState();
    const acData = getAircraftByType(aircraft.type);
    if (!acData) return;

    const minuteOfDay = state.clock.totalMinutes % MINUTES_PER_DAY;
    const currentDayStart = state.clock.totalMinutes - minuteOfDay;
    const departureMinute = currentDayStart + depTime.hour * 60 + depTime.minute;
    const arrivalMinute = departureMinute + schedule.blockTimeMinutes;

    const totalSeats = getTotalDailySeatsOnRoute(route.id);
    const loadFactor = calculateLoadFactor(route, totalSeats);
    const revenue = calculateFlightRevenue(route, acData.seats, loadFactor);
    const cost = calculateFlightCost(route, aircraft.type);
    const passengers = Math.round(acData.seats * loadFactor);

    const flight = {
        id: state.flights.nextFlightId++,
        routeId: route.id,
        scheduleId: schedule.id,
        aircraftId: aircraft.id,
        aircraftType: aircraft.type,
        registration: aircraft.registration,
        origin: route.origin,
        destination: route.destination,
        departureTime: departureMinute,
        arrivalTime: arrivalMinute,
        distance: route.distance,
        passengers,
        loadFactor,
        revenue,
        cost,
        profit: revenue - cost,
        status: 'in_flight',
        progress: 0
    };

    state.flights.active.push(flight);
    aircraft.status = 'in_flight';

    deductCash(cost, `Flight ${route.origin}→${route.destination} (${aircraft.registration})`);
}

function processActiveFlights() {
    const state = getState();
    const now = state.clock.totalMinutes;
    const completed = [];

    for (const flight of state.flights.active) {
        const depTime = flight.departureTime;
        const arrTime = flight.arrivalTime;
        const totalTime = arrTime - depTime;

        if (totalTime <= 0) {
            flight.progress = 1;
        } else {
            flight.progress = Math.min(1, (now - depTime) / totalTime);
        }

        if (now >= arrTime) {
            completed.push(flight);
        }
    }

    for (const flight of completed) {
        flight.status = 'completed';
        flight.progress = 1;

        addCash(flight.revenue, `Pax revenue ${flight.origin}→${flight.destination}`);

        const aircraft = state.fleet.find(f => f.id === flight.aircraftId);
        if (aircraft) {
            aircraft.status = 'available';
            const flightHours = (flight.arrivalTime - flight.departureTime) / 60;
            aircraft.totalFlightHours += flightHours;
        }

        const idx = state.flights.active.indexOf(flight);
        if (idx !== -1) state.flights.active.splice(idx, 1);

        state.flights.completed.push(flight);
        if (state.flights.completed.length > 1000) {
            state.flights.completed.shift();
        }
    }
}

function processSlotUsage() {
    const state = getState();
    const minuteOfDay = state.clock.totalMinutes % MINUTES_PER_DAY;
    const currentHour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
    const currentMinute = minuteOfDay % MINUTES_PER_HOUR;

    if (currentMinute === 0) {
        for (const key in state.slots) {
            const parts = key.split('_');
            const slotHour = parseInt(parts[parts.length - 1]);
            if (slotHour !== currentHour) {
                delete state.slots[key];
            }
        }
    }
}

function checkAndUseSlot(airportIata, hour) {
    const state = getState();
    const airport = getAirportByIata(airportIata);
    if (!airport) return false;

    const key = `${airportIata}_${hour}`;
    if (!state.slots[key]) state.slots[key] = 0;

    if (state.slots[key] >= airport.slotsPerHour) {
        return false;
    }

    state.slots[key]++;
    return true;
}

function processMonthEnd() {
    const state = getState();

    processMonthlyLeaseCosts();
    monthlyAIExpansion();

    const gt = getGameTime(state.clock.totalMinutes);

    const pnl = {
        month: gt.month,
        year: gt.year,
        revenue: state.finances.monthlyRevenue,
        costs: state.finances.monthlyCosts,
        profit: state.finances.monthlyRevenue - state.finances.monthlyCosts
    };

    state.finances.monthlyPnL.push(pnl);

    addLogEntry(
        `Monthly P&L: Revenue $${formatMoney(pnl.revenue)} | Costs $${formatMoney(pnl.costs)} | ${pnl.profit >= 0 ? 'Profit' : 'Loss'} $${formatMoney(Math.abs(pnl.profit))}`,
        pnl.profit >= 0 ? 'finance' : 'warning'
    );

    state.finances.monthlyRevenue = 0;
    state.finances.monthlyCosts = 0;

    if (state.config.difficulty !== 'SANDBOX' && state.finances.cash < 0) {
        addLogEntry('WARNING: Your airline is bankrupt! Cash balance is negative.', 'error');
    }

    if (monthCallback) monthCallback();
}

export function getActiveFlightCount() {
    const state = getState();
    return state ? state.flights.active.length : 0;
}

export function stopSimulation() {
    const state = getState();
    if (state && state.clock.tickInterval) {
        clearInterval(state.clock.tickInterval);
        state.clock.tickInterval = null;
    }
    if (state) state.clock.speed = GAME_SPEEDS.PAUSED;
}
