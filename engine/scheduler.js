import { getState, addLogEntry } from './state.js';
import { getRouteById, calculateBlockTime, canAircraftFlyRoute } from './routeEngine.js';
import { getAircraftByType } from '../data/aircraft.js';

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
    const route = getRouteById(routeId);
    if (!route) {
        addLogEntry('Cannot create schedule: route not found', 'error');
        return null;
    }

    const aircraft = state.fleet.find(f => f.id === aircraftId);
    if (!aircraft) {
        addLogEntry('Cannot create schedule: aircraft not found', 'error');
        return null;
    }

    const acData = getAircraftByType(aircraft.type);
    if (!canAircraftFlyRoute(aircraft.type, route.distance)) {
        addLogEntry(`${acData.type} cannot fly ${route.origin}-${route.destination}: range ${acData.rangeKm}km < distance ${route.distance}km`, 'error');
        return null;
    }

    let times = [];

    if (mode === SCHEDULE_MODE.CUSTOM) {
        if (!departureTimes || departureTimes.length === 0) {
            addLogEntry('Custom schedule requires at least one departure time', 'error');
            return null;
        }
        times = departureTimes.map(t => ({
            hour: t.hour,
            minute: t.minute
        })).sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
    } else if (mode === SCHEDULE_MODE.BANKED) {
        if (!bankId) {
            addLogEntry('Banked schedule requires a connection bank', 'error');
            return null;
        }
        const bank = state.banks.find(b => b.id === bankId);
        if (!bank) {
            addLogEntry('Cannot create schedule: bank not found', 'error');
            return null;
        }
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
    return schedule;
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

function formatBankTime(t) {
    return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}
