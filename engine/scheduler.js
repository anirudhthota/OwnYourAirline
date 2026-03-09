import { getState, addLogEntry, getGameTime } from './state.js';
import { getRouteById, calculateBlockTime, canAircraftFlyRoute } from './routeEngine.js';
import { getAircraftByType, getTurnaroundTime } from '../data/aircraft.js';
import { validateAircraftRotationChain, getAircraftNextOperationalLocation } from './rotationEngine.js';
import { markSchedulesDirty, getSchedulesByRouteIndexed, getSchedulesByAircraftIndexed } from './indexHelpers.js';

export const SCHEDULE_MODE = {
    CUSTOM: 'CUSTOM',
    BANKED: 'BANKED'
};

/**
 * Returns all flight numbers currently in use across all schedules.
 */
export function getAllUsedFlightNumbers() {
    const state = getState();
    const used = new Set();
    for (const sched of state.schedules) {
        if (sched.flightNumbers) {
            for (const fn of sched.flightNumbers) {
                if (fn) used.add(fn);
            }
        }
    }
    return used;
}

/**
 * Generates the next available flight number(s) for a schedule.
 * Format: {IATA}{number} e.g., "6E101", "6E102"
 * Numbers start at 101 and increment.
 * @param {number} count - How many flight numbers to generate
 * @returns {string[]} Array of flight number strings
 */
export function generateFlightNumbers(count) {
    const state = getState();
    const iata = state.config.iataCode;
    const used = getAllUsedFlightNumbers();
    const result = [];
    let num = 101;
    while (result.length < count) {
        const fn = `${iata}${num}`;
        if (!used.has(fn)) {
            result.push(fn);
            used.add(fn); // prevent duplicates within this batch
        }
        num++;
    }
    return result;
}

export function createBank(name, startHour, startMinute, endHour, endMinute) {
    const state = getState();

    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
        addLogEntry('Invalid bank time: hours must be 0-23', 'error');
        return null;
    }

    const bank = {
        id: state.nextBankId++,
        name: name || `Bank ${state.nextBankId - 1}`,
        startTime: { hour: startHour, minute: startMinute || 0 },
        endTime: { hour: endHour, minute: endMinute || 0 },
        active: true
    };

    state.banks.push(bank);
    addLogEntry(`Connection bank created: ${bank.name} (${formatBankTime(bank.startTime)}-${formatBankTime(bank.endTime)})`, 'schedule');
    return bank;
}

export function deleteBank(bankId) {
    const state = getState();
    const idx = state.banks.findIndex(b => b.id === bankId);
    if (idx === -1) return false;

    const bank = state.banks[idx];

    const affectedSchedules = state.schedules.filter(s => s.bankId === bankId);
    for (const sched of affectedSchedules) {
        sched.active = false;
        sched.bankId = null;
        sched.departureTimes = [];
        addLogEntry(`Schedule ${sched.id} deactivated: bank "${bank.name}" was deleted`, 'warning');
    }

    state.banks.splice(idx, 1);
    addLogEntry(`Bank deleted: ${bank.name}`, 'schedule');
    return true;
}

export function createSchedule(routeId, aircraftId, mode, departureTimes, bankId, flightNumbers, daysOfWeek = null) {
    const state = getState();

    // Validate all params first — no state mutation until all checks pass
    const validation = validateScheduleParams(routeId, aircraftId, mode, departureTimes, bankId);
    if (validation.errors.length > 0) {
        for (const err of validation.errors) {
            addLogEntry(err, 'error');
        }
        return { schedule: null, errors: validation.errors, warnings: validation.warnings };
    }

    const route = getRouteById(routeId);
    const aircraft = state.fleet.find(f => f.id === aircraftId);
    const acData = getAircraftByType(aircraft.type);

    let times = [];
    if (mode === SCHEDULE_MODE.CUSTOM) {
        times = departureTimes.map(t => ({
            hour: t.hour,
            minute: t.minute
        })).sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
    } else if (mode === SCHEDULE_MODE.BANKED) {
        const bank = state.banks.find(b => b.id === bankId);
        times = generateBankedDepartures(bank, route, aircraft.type);
    }

    const blockTime = calculateBlockTime(route.distance, aircraft.type);

    // Auto-generate flight numbers if not provided
    const fnums = flightNumbers && flightNumbers.length === times.length
        ? flightNumbers
        : generateFlightNumbers(times.length);

    const schedule = {
        id: state.nextScheduleId++,
        routeId,
        aircraftId,
        mode,
        bankId: bankId || null,
        departureTimes: times,
        flightNumbers: fnums,
        blockTimeMinutes: blockTime,
        daysOfWeek: daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        active: true,
        createdDate: state.clock.totalMinutes
    };

    state.schedules.push(schedule);
    route.schedules.push(schedule.id);
    markSchedulesDirty();

    addLogEntry(`Schedule created: ${route.origin}→${route.destination} with ${acData.type}, ${times.length} departure(s)`, 'schedule');
    return { schedule, errors: [], warnings: validation.warnings };
}

export function deleteSchedule(scheduleId) {
    const state = getState();
    const idx = state.schedules.findIndex(s => s.id === scheduleId);
    if (idx === -1) return false;

    const schedule = state.schedules[idx];
    const route = getRouteById(schedule.routeId);
    if (route) {
        const sIdx = route.schedules.indexOf(scheduleId);
        if (sIdx !== -1) route.schedules.splice(sIdx, 1);
    }

    state.schedules.splice(idx, 1);
    markSchedulesDirty();
    addLogEntry(`Schedule ${scheduleId} deleted`, 'schedule');
    return true;
}

export function updateScheduleDepartures(scheduleId, newTimes) {
    const state = getState();
    const schedule = state.schedules.find(s => s.id === scheduleId);
    if (!schedule) return false;

    schedule.departureTimes = newTimes.map(t => ({
        hour: t.hour,
        minute: t.minute
    })).sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);

    markSchedulesDirty();
    addLogEntry(`Schedule ${scheduleId} updated: ${newTimes.length} departure(s)`, 'schedule');
    return true;
}

export function validateScheduleParams(routeId, aircraftId, mode, departureTimes, bankId, excludeScheduleId, assumedStartLocation = null) {
    const state = getState();
    const errors = [];
    const warnings = [];

    const route = getRouteById(routeId);
    if (!route) {
        errors.push('Route not found');
        return { errors, warnings };
    }

    const aircraft = state.fleet.find(f => f.id === aircraftId);
    if (!aircraft) {
        errors.push('Aircraft not found');
        return { errors, warnings };
    }

    const acData = getAircraftByType(aircraft.type);
    if (!canAircraftFlyRoute(aircraft.type, route.distance)) {
        errors.push(`${acData.type} cannot fly ${route.origin}-${route.destination}: range ${acData.rangeKm}km < distance ${route.distance}km`);
    }

    // Maintenance validation will be checked after times are resolved

    // Location check — use forward projection for each proposed departure time
    // Defer detailed per-time location checks until after times are resolved (below)

    let times = [];
    if (mode === SCHEDULE_MODE.CUSTOM) {
        if (!departureTimes || departureTimes.length === 0) {
            errors.push('Custom schedule requires at least one departure time');
        } else {
            times = [...departureTimes].sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
        }
    } else if (mode === SCHEDULE_MODE.BANKED) {
        if (!bankId) {
            errors.push('Banked schedule requires a connection bank');
        } else {
            const bank = state.banks.find(b => b.id === bankId);
            if (!bank) {
                errors.push('Connection bank not found');
            }
        }
    }

    // Use Rotation Engine for Maintenance, Location Continuity, Turnaround, and Conflict validation
    if (times.length > 0) {
        const earliestTime = times[0];
        const earliestDepMin = earliestTime.hour * 60 + earliestTime.minute;
        const nextLoc = getAircraftNextOperationalLocation(aircraftId, earliestDepMin, excludeScheduleId, assumedStartLocation);

        if (nextLoc && nextLoc !== route.origin && nextLoc !== 'airborne') {
            errors.push(`${aircraft.registration} will be at ${nextLoc} at ${String(earliestTime.hour).padStart(2, '0')}:${String(earliestTime.minute).padStart(2, '0')} — cannot depart ${route.origin}`);
        } else if (nextLoc === 'airborne') {
            errors.push(`${aircraft.registration} will be airborne at ${String(earliestTime.hour).padStart(2, '0')}:${String(earliestTime.minute).padStart(2, '0')} — cannot depart ${route.origin}`);
        }

        const blockTime = calculateBlockTime(route.distance, aircraft.type);
        const extraLegs = times.map(t => ({
            origin: route.origin,
            destination: route.destination,
            depMinute: t.hour * 60 + t.minute,
            blockTime: blockTime,
            routeDistance: route.distance
        }));

        const rotationResult = validateAircraftRotationChain(aircraftId, extraLegs, excludeScheduleId, assumedStartLocation);
        rotationResult.errors.forEach(err => errors.push(err));
        rotationResult.warnings.forEach(w => warnings.push(w));
    } else if (aircraft.currentLocation && aircraft.currentLocation !== route.origin && !aircraft.currentLocation.startsWith('airborne:')) {
        // Fallback for banked mode where times aren't resolved yet
        errors.push(`${aircraft.registration} is at ${aircraft.currentLocation} — cannot depart ${route.origin}`);

        // Maintenance check fallback
        if (aircraft.status === 'maintenance' && aircraft.maintenanceReleaseTime) {
            errors.push(`${aircraft.registration} is in maintenance.`);
        }
    }

    // Min aircraft check
    if (acData && times.length > 0) {
        const blockTime = calculateBlockTime(route.distance, aircraft.type);
        const turnaround = getTurnaroundTime(aircraft.type, route.distance);
        const roundTrip = blockTime * 2 + turnaround * 2;
        const minAc = calculateMinAircraft(route.distance, aircraft.type, times.length);
        if (minAc > 1) {
            warnings.push(`This route likely requires ${minAc} aircraft for ${times.length} daily departure(s). Round trip: ${Math.floor(roundTrip / 60)}h${roundTrip % 60}m.`);
        }
    }

    return { errors, warnings };
}

export function updateSchedule(scheduleId, routeId, aircraftId, mode, departureTimes, bankId, flightNumbers) {
    const state = getState();
    const schedule = state.schedules.find(s => s.id === scheduleId);
    if (!schedule) {
        addLogEntry('Schedule not found for update', 'error');
        return null;
    }

    // Validate all params before mutating state — exclude this schedule from conflict checks
    const validation = validateScheduleParams(routeId, aircraftId, mode, departureTimes, bankId, scheduleId);
    if (validation.errors.length > 0) {
        for (const err of validation.errors) {
            addLogEntry(err, 'error');
        }
        return null;
    }

    const route = getRouteById(routeId);
    const aircraft = state.fleet.find(f => f.id === aircraftId);

    let times = [];
    if (mode === SCHEDULE_MODE.CUSTOM) {
        times = departureTimes.map(t => ({
            hour: t.hour,
            minute: t.minute
        })).sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
    } else if (mode === SCHEDULE_MODE.BANKED) {
        const bank = state.banks.find(b => b.id === bankId);
        times = generateBankedDepartures(bank, route, aircraft.type);
    }

    const blockTime = calculateBlockTime(route.distance, aircraft.type);

    // Remove old schedule from old route's schedule list
    const oldRoute = getRouteById(schedule.routeId);
    if (oldRoute) {
        const sIdx = oldRoute.schedules.indexOf(scheduleId);
        if (sIdx !== -1) oldRoute.schedules.splice(sIdx, 1);
    }

    // Update schedule in place
    schedule.routeId = routeId;
    schedule.aircraftId = aircraftId;
    schedule.mode = mode;
    schedule.bankId = bankId || null;
    schedule.departureTimes = times;
    schedule.flightNumbers = flightNumbers && flightNumbers.length === times.length
        ? flightNumbers
        : generateFlightNumbers(times.length);
    schedule.blockTimeMinutes = blockTime;

    // Add to new route's schedule list
    if (!route.schedules.includes(scheduleId)) {
        route.schedules.push(scheduleId);
    }

    const acData = getAircraftByType(aircraft.type);
    markSchedulesDirty();
    addLogEntry(`Schedule ${scheduleId} updated: ${route.origin}\u2192${route.destination} with ${acData.type}, ${times.length} departure(s)`, 'schedule');
    return schedule;
}

function generateBankedDepartures(bank, route, aircraftType) {
    const blockTime = calculateBlockTime(route.distance, aircraftType);
    const turnTime = 45;
    const totalCycleMinutes = blockTime * 2 + turnTime * 2;

    const bankStartMinutes = bank.startTime.hour * 60 + bank.startTime.minute;
    let bankEndMinutes = bank.endTime.hour * 60 + bank.endTime.minute;
    if (bankEndMinutes <= bankStartMinutes) bankEndMinutes += 1440;

    const bankDuration = bankEndMinutes - bankStartMinutes;

    const times = [];
    const arrivalWindowStart = bankStartMinutes;
    const departureTime = arrivalWindowStart - blockTime;

    if (departureTime >= 0 && bankDuration >= 60) {
        const depHour = Math.floor(((departureTime % 1440) + 1440) % 1440 / 60);
        const depMinute = ((departureTime % 1440) + 1440) % 1440 % 60;
        times.push({ hour: depHour, minute: depMinute });

        if (totalCycleMinutes < 1440 && bankDuration >= 180) {
            const secondDep = departureTime + totalCycleMinutes;
            if (secondDep < 1440) {
                const dep2Hour = Math.floor(secondDep / 60);
                const dep2Minute = secondDep % 60;
                times.push({ hour: dep2Hour, minute: dep2Minute });
            }
        }
    } else if (bankDuration >= 30) {
        const midBank = bankStartMinutes + Math.floor(bankDuration / 2);
        const depTime = midBank - blockTime;
        const normDep = ((depTime % 1440) + 1440) % 1440;
        times.push({ hour: Math.floor(normDep / 60), minute: normDep % 60 });
    }

    return times;
}

export function getSchedulesByRoute(routeId) {
    return getSchedulesByRouteIndexed(routeId);
}

export function getSchedulesByAircraft(aircraftId) {
    return getSchedulesByAircraftIndexed(aircraftId);
}

export function calculateMinAircraft(routeDistance, aircraftType, frequency) {
    const blockTime = calculateBlockTime(routeDistance, aircraftType);
    const turnaround = getTurnaroundTime(aircraftType);
    const cycleTime = (blockTime * 2) + (turnaround * 2);
    const operatingDay = 1440;
    const slotsPerAircraft = Math.floor(operatingDay / cycleTime);
    if (slotsPerAircraft <= 0) return frequency;
    return Math.ceil(frequency / slotsPerAircraft);
}

export function swapAircraftOnRoute(routeId, oldAircraftId, newAircraftId) {
    const state = getState();
    const route = getRouteById(routeId);
    if (!route) return { success: false, errors: ['Route not found'] };

    const oldAc = state.fleet.find(f => f.id === oldAircraftId);
    const newAc = state.fleet.find(f => f.id === newAircraftId);
    if (!oldAc) return { success: false, errors: ['Old aircraft not found'] };
    if (!newAc) return { success: false, errors: ['New aircraft not found'] };

    const newAcData = getAircraftByType(newAc.type);
    const errors = [];

    // Swap ALL active schedules for the old aircraft, not just the single route,
    // to maintain a sane daily flight plan and prevent stranded aircraft.
    const affectedSchedules = state.schedules.filter(s => s.aircraftId === oldAircraftId && s.active);

    if (affectedSchedules.length === 0) {
        return { success: false, errors: ['No schedules found for this aircraft to swap'] };
    }

    // Range check for ALL routes this aircraft will inherit
    const affectedRouteIds = new Set(affectedSchedules.map(s => s.routeId));
    for (const rid of affectedRouteIds) {
        const r = getRouteById(rid);
        if (r && !canAircraftFlyRoute(newAc.type, r.distance)) {
            errors.push(`${newAcData.type} cannot fly ${r.origin}\u2192${r.destination} (Distance: ${r.distance}km)`);
        }
    }

    // Weave ALL inherited schedules into a list of extraLegs to simulate the swap
    const extraLegs = [];
    let earliestDepMin = Infinity;
    let earliestRouteOrigin = null;

    for (const sched of affectedSchedules) {
        const schedRoute = getRouteById(sched.routeId);
        if (!schedRoute) continue;
        const newBlockTime = calculateBlockTime(schedRoute.distance, newAc.type);
        for (const t of sched.departureTimes) {
            const depMin = t.hour * 60 + t.minute;
            if (depMin < earliestDepMin) {
                earliestDepMin = depMin;
                earliestRouteOrigin = schedRoute.origin;
            }

            extraLegs.push({
                origin: schedRoute.origin,
                destination: schedRoute.destination,
                depMinute: depMin,
                blockTime: newBlockTime,
                routeDistance: schedRoute.distance
            });
        }
    }

    // Location check: new aircraft must be at the origin of the FIRST flight of the chain
    if (earliestDepMin < Infinity && earliestRouteOrigin) {
        const nextLoc = getAircraftNextOperationalLocation(newAircraftId, earliestDepMin, null);
        if (nextLoc && nextLoc !== earliestRouteOrigin && nextLoc !== 'airborne') {
            errors.push(`${newAc.registration} will be at ${nextLoc} at ${String(Math.floor(earliestDepMin / 60)).padStart(2, '0')}:${String(earliestDepMin % 60).padStart(2, '0')} — must be at ${earliestRouteOrigin} to start the duty day`);
        } else if (nextLoc === 'airborne') {
            errors.push(`${newAc.registration} will be airborne at ${String(Math.floor(earliestDepMin / 60)).padStart(2, '0')}:${String(earliestDepMin % 60).padStart(2, '0')} — must be at ${earliestRouteOrigin}`);
        } else if (!nextLoc && newAc.currentLocation && newAc.currentLocation !== earliestRouteOrigin && !newAc.currentLocation.startsWith('airborne:')) {
            errors.push(`${newAc.registration} is at ${newAc.currentLocation} — must be at ${earliestRouteOrigin}`);
        }
    }

    // Use Rotation Engine to validate if new aircraft can physically take over this entire chain
    const rotationResult = validateAircraftRotationChain(newAircraftId, extraLegs, null, null);
    rotationResult.errors.forEach(err => errors.push(err));
    // Swap warnings are non-blocking — ignore for swap validation

    if (errors.length > 0) return { success: false, errors };

    // Perform the swap
    let swapped = 0;
    for (const sched of affectedSchedules) {
        const schedRoute = getRouteById(sched.routeId);
        sched.aircraftId = newAircraftId;
        sched.blockTimeMinutes = calculateBlockTime(schedRoute.distance, newAc.type);
        swapped++;
    }

    markSchedulesDirty();
    addLogEntry(`Aircraft swapped: ${oldAc.registration} \u2192 ${newAc.registration} (${swapped} schedule(s) transferred)`, 'schedule');
    return { success: true, errors: [], swapped };
}


function formatBankTime(t) {
    return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}
