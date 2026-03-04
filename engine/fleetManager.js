import { getState, addLogEntry, deductCash, addCash, formatMoney, MINUTES_PER_YEAR } from './state.js';
import { getAircraftByType, DEPRECIATION_RATE_ANNUAL, LEASE_DEPOSIT_MONTHS } from '../data/aircraft.js';
import { getSchedulesByAircraft } from './scheduler.js';

export const OWNERSHIP_TYPE = {
    OWNED: 'OWNED',
    LEASED: 'LEASED'
};

export function purchaseAircraft(aircraftType) {
    const state = getState();
    const acData = getAircraftByType(aircraftType);
    if (!acData) {
        addLogEntry(`Unknown aircraft type: ${aircraftType}`, 'error');
        return null;
    }

    if (!deductCash(acData.purchasePrice, `Purchase ${acData.type}`)) {
        return null;
    }

    const aircraft = {
        id: state.nextFleetId++,
        type: acData.type,
        ownership: OWNERSHIP_TYPE.OWNED,
        purchasePrice: acData.purchasePrice,
        purchaseDate: state.clock.totalMinutes,
        totalFlightHours: 0,
        status: 'available',
        registration: generateRegistration(state)
    };

    state.fleet.push(aircraft);
    addLogEntry(`Aircraft purchased: ${acData.type} (${aircraft.registration})`, 'fleet');
    return aircraft;
}

export function leaseAircraft(aircraftType) {
    const state = getState();
    const acData = getAircraftByType(aircraftType);
    if (!acData) {
        addLogEntry(`Unknown aircraft type: ${aircraftType}`, 'error');
        return null;
    }

    const deposit = acData.leaseCostPerMonth * LEASE_DEPOSIT_MONTHS;
    if (!deductCash(deposit, `Lease deposit for ${acData.type} (${LEASE_DEPOSIT_MONTHS} months)`)) {
        return null;
    }

    const aircraft = {
        id: state.nextFleetId++,
        type: acData.type,
        ownership: OWNERSHIP_TYPE.LEASED,
        leaseCostPerMonth: acData.leaseCostPerMonth,
        leaseStartDate: state.clock.totalMinutes,
        depositPaid: deposit,
        totalFlightHours: 0,
        status: 'available',
        registration: generateRegistration(state)
    };

    state.fleet.push(aircraft);
    addLogEntry(`Aircraft leased: ${acData.type} (${aircraft.registration}), $${formatMoney(acData.leaseCostPerMonth)}/mo`, 'fleet');
    return aircraft;
}

export function sellAircraft(aircraftId) {
    const state = getState();
    const aircraft = state.fleet.find(f => f.id === aircraftId);
    if (!aircraft) {
        addLogEntry('Aircraft not found', 'error');
        return false;
    }

    if (aircraft.ownership !== OWNERSHIP_TYPE.OWNED) {
        addLogEntry('Cannot sell a leased aircraft — return it instead', 'error');
        return false;
    }

    if (aircraft.status === 'in_flight') {
        addLogEntry('Cannot sell aircraft while in flight', 'error');
        return false;
    }

    const schedules = getSchedulesByAircraft(aircraftId);
    if (schedules.length > 0) {
        addLogEntry('Remove all schedules for this aircraft before selling', 'error');
        return false;
    }

    const ageYears = (state.clock.totalMinutes - aircraft.purchaseDate) / MINUTES_PER_YEAR;
    const depreciation = Math.pow(1 - DEPRECIATION_RATE_ANNUAL, ageYears);
    const salePrice = Math.round(aircraft.purchasePrice * depreciation * 0.85);

    const idx = state.fleet.findIndex(f => f.id === aircraftId);
    state.fleet.splice(idx, 1);

    addCash(salePrice, `Sold ${aircraft.type} (${aircraft.registration})`);
    return true;
}

export function returnLeasedAircraft(aircraftId) {
    const state = getState();
    const aircraft = state.fleet.find(f => f.id === aircraftId);
    if (!aircraft) {
        addLogEntry('Aircraft not found', 'error');
        return false;
    }

    if (aircraft.ownership !== OWNERSHIP_TYPE.LEASED) {
        addLogEntry('Aircraft is not leased', 'error');
        return false;
    }

    if (aircraft.status === 'in_flight') {
        addLogEntry('Cannot return aircraft while in flight', 'error');
        return false;
    }

    const schedules = getSchedulesByAircraft(aircraftId);
    if (schedules.length > 0) {
        addLogEntry('Remove all schedules for this aircraft before returning', 'error');
        return false;
    }

    const idx = state.fleet.findIndex(f => f.id === aircraftId);
    state.fleet.splice(idx, 1);

    addLogEntry(`Returned leased ${aircraft.type} (${aircraft.registration})`, 'fleet');
    return true;
}

export function processMonthlyLeaseCosts() {
    const state = getState();
    for (const aircraft of state.fleet) {
        if (aircraft.ownership === OWNERSHIP_TYPE.LEASED) {
            deductCash(aircraft.leaseCostPerMonth, `Lease: ${aircraft.type} (${aircraft.registration})`);
        }
    }
}

export function getAvailableAircraft() {
    const state = getState();
    return state.fleet.filter(f => f.status === 'available');
}

export function getAircraftById(aircraftId) {
    const state = getState();
    return state.fleet.find(f => f.id === aircraftId) || null;
}

function generateRegistration(state) {
    const prefix = state.config.iataCode || 'XX';
    const num = String(state.nextFleetId).padStart(3, '0');
    return `${prefix}-${num}`;
}

export function getAircraftNextFree(aircraftId) {
    const state = getState();
    const flight = state.flights.active.find(f => f.aircraftId === aircraftId);
    if (!flight) return null;
    return flight.arrivalTime;
}

export function getFleetSummary() {
    const state = getState();
    const summary = {};
    for (const aircraft of state.fleet) {
        if (!summary[aircraft.type]) {
            summary[aircraft.type] = { total: 0, available: 0, inFlight: 0, owned: 0, leased: 0 };
        }
        summary[aircraft.type].total++;
        if (aircraft.status === 'available') summary[aircraft.type].available++;
        if (aircraft.status === 'in_flight') summary[aircraft.type].inFlight++;
        if (aircraft.ownership === OWNERSHIP_TYPE.OWNED) summary[aircraft.type].owned++;
        if (aircraft.ownership === OWNERSHIP_TYPE.LEASED) summary[aircraft.type].leased++;
    }
    return summary;
}
