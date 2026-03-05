import { getState, addLogEntry, getGameTime } from './state.js';
import { getRouteById, calculateBlockTime, canAircraftFlyRoute } from './routeEngine.js';
import { getAircraftByType, getTurnaroundTime } from '../data/aircraft.js';

export const SCHEDULE_MODE = {
    CUSTOM: 'CUSTOM',
    BANKED: 'BANKED'
};

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

export function createSchedule(routeId, aircraftId, mode, departureTimes, bankId) {
    const state = getState();

    // Validate all params first — no state mutation until all checks pass
    const errors = validateScheduleParams(routeId, aircraftId, mode, departureTimes, bankId);
    if (errors.length > 0) {
        for (const err of errors) {
            addLogEntry(err, 'error');
        }
        return { schedule: null, errors };
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

    const schedule = {
        id: state.nextScheduleId++,
        routeId,
        aircraftId,
        mode,
        bankId: bankId || null,
        departureTimes: times,
        blockTimeMinutes: blockTime,
        active: true,
        createdDate: state.clock.totalMinutes
    };

    state.schedules.push(schedule);
    route.schedules.push(schedule.id);

    addLogEntry(`Schedule created: ${route.origin}→${route.destination} with ${acData.type}, ${times.length} daily departure(s)`, 'schedule');
    return { schedule, errors: [] };
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

    addLogEntry(`Schedule ${scheduleId} updated: ${newTimes.length} departure(s)`, 'schedule');
    return true;
}

export function validateScheduleParams(routeId, aircraftId, mode, departureTimes, bankId) {
    const state = getState();
    const errors = [];

    const route = getRouteById(routeId);
    if (!route) {
        errors.push('Route not found');
        return errors;
    }

    const aircraft = state.fleet.find(f => f.id === aircraftId);
    if (!aircraft) {
        errors.push('Aircraft not found');
        return errors;
    }

    const acData = getAircraftByType(aircraft.type);
    if (!canAircraftFlyRoute(aircraft.type, route.distance)) {
        errors.push(`${acData.type} cannot fly ${route.origin}-${route.destination}: range ${acData.rangeKm}km < distance ${route.distance}km`);
    }

    // Location check
    if (aircraft.currentLocation && aircraft.currentLocation !== route.origin && !aircraft.currentLocation.startsWith('airborne:')) {
        errors.push(`${aircraft.registration} is at ${aircraft.currentLocation} — cannot depart ${route.origin}`);
    }

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

    // Turnaround validation
    if (times.length > 1 && acData) {
        const blockTime = calculateBlockTime(route.distance, aircraft.type);
        const turnaround = getTurnaroundTime(aircraft.type);
        const sortedMinutes = times.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
        for (let i = 1; i < sortedMinutes.length; i++) {
            const gap = sortedMinutes[i] - sortedMinutes[i - 1];
            const needed = blockTime + turnaround;
            if (gap < needed) {
                const arrH = Math.floor((sortedMinutes[i - 1] + blockTime) / 60) % 24;
                const arrM = (sortedMinutes[i - 1] + blockTime) % 60;
                const earliestH = Math.floor((sortedMinutes[i - 1] + needed) / 60) % 24;
                const earliestM = (sortedMinutes[i - 1] + needed) % 60;
                errors.push(
                    `Insufficient turnaround. ${aircraft.registration} arrives at ${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')} and needs ${turnaround}min ground time. Earliest next departure: ${String(earliestH).padStart(2, '0')}:${String(earliestM).padStart(2, '0')}.`
                );
            }
        }
    }

    // Min aircraft check
    if (acData && times.length > 0) {
        const blockTime = calculateBlockTime(route.distance, aircraft.type);
        const turnaround = getTurnaroundTime(aircraft.type);
        const roundTrip = blockTime * 2 + turnaround * 2;
        const minAc = calculateMinAircraft(route.distance, aircraft.type, times.length);
        if (minAc > 1) {
            errors.push(`This route requires at least ${minAc} aircraft for ${times.length} daily departure(s). Round trip: ${Math.floor(roundTrip / 60)}h${roundTrip % 60}m exceeds 24 hours for one aircraft.`);
        }
    }

    // Scheduling conflict check — does this aircraft already have conflicting schedules?
    if (aircraft && times.length > 0 && acData) {
        const existingScheds = state.schedules.filter(s => s.aircraftId === aircraftId && s.active);
        const blockTime = calculateBlockTime(route.distance, aircraft.type);

        for (const existing of existingScheds) {
            const existingRoute = getRouteById(existing.routeId);
            if (!existingRoute) continue;
            for (const newTime of times) {
                const newDepMin = newTime.hour * 60 + newTime.minute;
                const newReturnMin = newDepMin + blockTime;
                for (const exTime of existing.departureTimes) {
                    const exDepMin = exTime.hour * 60 + exTime.minute;
                    const exReturnMin = exDepMin + existing.blockTimeMinutes;
                    // Conflict if time windows overlap
                    if (newDepMin < exReturnMin && exDepMin < newReturnMin) {
                        errors.push(
                            `Scheduling conflict: ${aircraft.registration} is already scheduled on ${existingRoute.origin}→${existingRoute.destination} departing ${String(exTime.hour).padStart(2, '0')}:${String(exTime.minute).padStart(2, '0')} (returns ~${String(Math.floor(exReturnMin / 60) % 24).padStart(2, '0')}:${String(exReturnMin % 60).padStart(2, '0')}). Conflicts with proposed departure at ${String(newTime.hour).padStart(2, '0')}:${String(newTime.minute).padStart(2, '0')}.`
                        );
                    }
                }
            }
        }
    }

    return errors;
}

export function updateSchedule(scheduleId, routeId, aircraftId, mode, departureTimes, bankId) {
    const state = getState();
    const schedule = state.schedules.find(s => s.id === scheduleId);
    if (!schedule) {
        addLogEntry('Schedule not found for update', 'error');
        return null;
    }

    // Validate all params before mutating state
    const errors = validateScheduleParams(routeId, aircraftId, mode, departureTimes, bankId);
    if (errors.length > 0) {
        for (const err of errors) {
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
    schedule.blockTimeMinutes = blockTime;

    // Add to new route's schedule list
    if (!route.schedules.includes(scheduleId)) {
        route.schedules.push(scheduleId);
    }

    const acData = getAircraftByType(aircraft.type);
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
    const state = getState();
    return state.schedules.filter(s => s.routeId === routeId);
}

export function getSchedulesByAircraft(aircraftId) {
    const state = getState();
    return state.schedules.filter(s => s.aircraftId === aircraftId);
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

    // Range check
    if (!canAircraftFlyRoute(newAc.type, route.distance)) {
        errors.push(`${newAcData.type} cannot fly ${route.origin}→${route.destination}: range ${newAcData.rangeKm}km < distance ${route.distance}km`);
    }

    // Location check
    if (newAc.currentLocation && newAc.currentLocation !== route.origin && !newAc.currentLocation.startsWith('airborne:')) {
        errors.push(`${newAc.registration} is at ${newAc.currentLocation} — must be at ${route.origin} to serve this route`);
    }

    // Check if new aircraft is currently in flight
    if (newAc.status === 'in_flight') {
        const nextFree = state.flights.active.find(f => f.aircraftId === newAircraftId);
        if (nextFree) {
            const gt = getGameTime(nextFree.arrivalTime);
            errors.push(`${newAc.registration} is airborne until Day ${(gt.week - 1) * 7 + gt.day} ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`);
        }
    }

    // Check scheduling conflicts — does new aircraft already have schedules that overlap?
    const affectedSchedules = state.schedules.filter(s => s.routeId === routeId && s.aircraftId === oldAircraftId);
    if (affectedSchedules.length === 0) {
        errors.push('No schedules found for this aircraft on this route');
    }

    // Turnaround feasibility for each affected schedule with new aircraft
    if (errors.length === 0) {
        const newBlockTime = calculateBlockTime(route.distance, newAc.type);
        const newTurnaround = getTurnaroundTime(newAc.type);

        for (const sched of affectedSchedules) {
            if (sched.departureTimes.length > 1) {
                const sortedMinutes = sched.departureTimes.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
                for (let i = 1; i < sortedMinutes.length; i++) {
                    const gap = sortedMinutes[i] - sortedMinutes[i - 1];
                    const needed = newBlockTime + newTurnaround;
                    if (gap < needed) {
                        const arrH = Math.floor((sortedMinutes[i - 1] + newBlockTime) / 60) % 24;
                        const arrM = (sortedMinutes[i - 1] + newBlockTime) % 60;
                        errors.push(
                            `${newAc.registration} turnaround conflict on schedule #${sched.id}: arrives ${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}, needs ${newTurnaround}min ground time, but next departure at ${String(Math.floor(sortedMinutes[i] / 60)).padStart(2, '0')}:${String(sortedMinutes[i] % 60).padStart(2, '0')}`
                        );
                        break;
                    }
                }
            }
        }
    }

    if (errors.length > 0) return { success: false, errors };

    // Perform the swap
    const newBlockTime = calculateBlockTime(route.distance, newAc.type);
    let swapped = 0;
    for (const sched of affectedSchedules) {
        sched.aircraftId = newAircraftId;
        sched.blockTimeMinutes = newBlockTime;
        swapped++;
    }

    addLogEntry(`Aircraft swapped on ${route.origin}→${route.destination}: ${oldAc.registration} → ${newAc.registration} (${swapped} schedule(s))`, 'schedule');
    return { success: true, errors: [], swapped };
}

function formatBankTime(t) {
    return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}
