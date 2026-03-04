import { getState, addLogEntry, addCash, deductCash, TICK_MINUTES, GAME_SPEEDS, formatMoney, MINUTES_PER_DAY, MINUTES_PER_HOUR, MINUTES_PER_MONTH, getGameTime } from './state.js';
import { getAircraftByType } from '../data/aircraft.js';
import { getAirportByIata, getSlotControlLevel } from '../data/airports.js';
import { calculateLoadFactor, calculateFlightRevenue, calculateFlightCost, getRouteById, getTotalDailySeatsOnRoute } from './routeEngine.js';
import { processMonthlyLeaseCosts } from './fleetManager.js';
import { monthlyAIExpansion } from './aiEngine.js';

let tickCallback = null;
let monthCallback = null;
let dayEndCallback = null;

export function setTickCallback(cb) { tickCallback = cb; }
export function setMonthCallback(cb) { monthCallback = cb; }
export function setDayEndCallback(cb) { dayEndCallback = cb; }

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

    processDelayedFlights();
    processFlightDepartures();
    processActiveFlights();
    processSlotUsage();

    const prevDay = Math.floor(prevTotalMinutes / MINUTES_PER_DAY);
    const currDay = Math.floor(state.clock.totalMinutes / MINUTES_PER_DAY);
    if (currDay !== prevDay) {
        processDayEnd(prevTotalMinutes);
    }

    const prevMonth = Math.floor(prevTotalMinutes / MINUTES_PER_MONTH);
    const currMonth = Math.floor(state.clock.totalMinutes / MINUTES_PER_MONTH);
    if (currMonth !== prevMonth) {
        processMonthEnd();
    }

    if (tickCallback) tickCallback();
}

function processDelayedFlights() {
    const state = getState();
    if (!state.delayedFlights || state.delayedFlights.length === 0) return;

    const minuteOfDay = state.clock.totalMinutes % MINUTES_PER_DAY;
    const currentHour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);

    const stillDelayed = [];

    for (const delayed of state.delayedFlights) {
        const route = getRouteById(delayed.routeId);
        const aircraft = state.fleet.find(f => f.id === delayed.aircraftId);
        if (!route || !route.active || !aircraft) continue;
        if (aircraft.status !== 'available') {
            stillDelayed.push(delayed);
            continue;
        }

        const schedule = state.schedules.find(s => s.id === delayed.scheduleId);
        if (!schedule || !schedule.active) continue;

        if (checkAndUseSlot(route.origin, currentHour)) {
            delayed.delayMinutes += TICK_MINUTES;
            addLogEntry(`Delayed flight ${route.origin}→${route.destination} now departing (${delayed.delayMinutes}min late)`, 'warning');
            launchFlight(schedule, route, aircraft, delayed.depTime, delayed.delayMinutes);
        } else {
            delayed.delayMinutes += TICK_MINUTES;
            if (delayed.delayMinutes >= 120) {
                addLogEntry(`Flight ${route.origin}→${route.destination} cancelled after ${delayed.delayMinutes}min delay — no slot available`, 'error');
            } else {
                stillDelayed.push(delayed);
            }
        }
    }

    state.delayedFlights = stillDelayed;
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

                const isHub = route.origin === state.config.hubAirport;
                const slotLevel = getSlotControlLevel(route.origin);
                if (!isHub && slotLevel >= 3 && !checkAndUseSlot(route.origin, currentHour)) {
                    addLogEntry(`Slot unavailable at ${route.origin} (Level ${slotLevel}) for ${String(currentHour).padStart(2, '0')}:00 — flight delayed`, 'warning');
                    state.delayedFlights.push({
                        scheduleId: schedule.id,
                        routeId: route.id,
                        aircraftId: aircraft.id,
                        depTime,
                        delayMinutes: 0,
                        reason: `Slot unavailable at ${route.origin}`
                    });
                    continue;
                } else {
                    checkAndUseSlot(route.origin, currentHour);
                }

                launchFlight(schedule, route, aircraft, depTime, 0);
            }
        }
    }
}

function launchFlight(schedule, route, aircraft, depTime, delayMinutes) {
    const state = getState();
    const acData = getAircraftByType(aircraft.type);
    if (!acData) return;

    const departureMinute = state.clock.totalMinutes;
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
        progress: 0,
        delayMinutes: delayMinutes || 0
    };

    state.flights.active.push(flight);
    aircraft.status = 'in_flight';
    state.finances.dailyFlights++;
    state.finances.dailyPassengers += passengers;

    const delayNote = delayMinutes > 0 ? ` (delayed ${delayMinutes}min)` : '';
    deductCash(cost, `Flight ${route.origin}→${route.destination} (${aircraft.registration})${delayNote}`);
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

            // Delay cascade: if this flight was delayed, propagate delay to next rotation
            if (flight.delayMinutes > 0) {
                const nextDelayed = state.delayedFlights.find(d => d.aircraftId === aircraft.id);
                if (nextDelayed) {
                    nextDelayed.delayMinutes += flight.delayMinutes;
                }
            }
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

export function getSlotUsageForAirport(airportIata) {
    const state = getState();
    if (!state) return {};
    const usage = {};
    for (const key in state.slots) {
        if (key.startsWith(airportIata + '_')) {
            const hour = parseInt(key.split('_')[1]);
            usage[hour] = state.slots[key];
        }
    }
    return usage;
}

function processDayEnd(prevTotalMinutes) {
    const state = getState();
    const gt = getGameTime(prevTotalMinutes);
    const dayLabel = `Y${gt.year} M${gt.month} W${gt.week} D${gt.day}`;

    // Calculate best/worst performing route today
    const routeProfits = {};
    for (const flight of state.flights.completed) {
        // Only count flights from today (departed during the day that just ended)
        const flightDay = Math.floor(flight.departureTime / MINUTES_PER_DAY);
        const prevDay = Math.floor(prevTotalMinutes / MINUTES_PER_DAY);
        if (flightDay !== prevDay) continue;
        const key = `${flight.origin}→${flight.destination}`;
        if (!routeProfits[key]) routeProfits[key] = 0;
        routeProfits[key] += flight.profit;
    }

    let bestRoute = null;
    let worstRoute = null;
    let bestProfit = -Infinity;
    let worstProfit = Infinity;
    for (const [route, profit] of Object.entries(routeProfits)) {
        if (profit > bestProfit) { bestProfit = profit; bestRoute = route; }
        if (profit < worstProfit) { worstProfit = profit; worstRoute = route; }
    }

    const dailyRecord = {
        dayLabel,
        totalMinutes: prevTotalMinutes,
        flights: state.finances.dailyFlights,
        passengers: state.finances.dailyPassengers,
        revenue: state.finances.dailyRevenue,
        costs: state.finances.dailyCosts,
        profit: state.finances.dailyRevenue - state.finances.dailyCosts,
        bestRoute: bestRoute ? { route: bestRoute, profit: bestProfit } : null,
        worstRoute: worstRoute ? { route: worstRoute, profit: worstProfit } : null,
        cashBalance: state.finances.cash
    };

    state.finances.dailyPnL.push(dailyRecord);
    if (state.finances.dailyPnL.length > 90) {
        state.finances.dailyPnL.shift();
    }

    // Reset daily counters
    state.finances.dailyRevenue = 0;
    state.finances.dailyCosts = 0;
    state.finances.dailyFlights = 0;
    state.finances.dailyPassengers = 0;

    if (dayEndCallback) dayEndCallback(dailyRecord);
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
