import { getState, addLogEntry, deductCash, addCash, formatMoney, MINUTES_PER_YEAR, MINUTES_PER_DAY } from './state.js';
import { getAircraftByType, AIRCRAFT_TYPES, DEPRECIATION_RATE_ANNUAL, LEASE_DEPOSIT_MONTHS } from '../data/aircraft.js';
import { AIRPORTS } from '../data/airports.js';
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
        registration: generateRegistration(state),
        currentLocation: state.config.hubAirport
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
        registration: generateRegistration(state),
        currentLocation: state.config.hubAirport
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

// ===== Used Aircraft Market =====

export function generateUsedMarketListings(includeDiscountA321) {
    const state = getState();
    const market = state.usedMarket;
    market.listings = [];

    const count = 3 + Math.floor(Math.random() * 3); // 3-5 aircraft
    const available = AIRCRAFT_TYPES.filter(a => a.category !== 'Super Heavy');

    for (let i = 0; i < count; i++) {
        const acData = available[Math.floor(Math.random() * available.length)];
        const randomAirport = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];
        market.listings.push(createUsedListing(acData, market, randomAirport.iata));
    }

    if (includeDiscountA321) {
        const a321 = getAircraftByType('A321neo');
        if (a321) {
            const randomAirport = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];
            const listing = createUsedListing(a321, market, randomAirport.iata);
            listing.priceMultiplier = 0.55;
            listing.price = Math.round(a321.purchasePrice * 0.55);
            listing.leasePrice = Math.round(a321.leaseCostPerMonth * 0.6);
            listing.featured = true;
            market.listings.unshift(listing);
        }
    }

    market.lastRefreshDay = Math.floor(state.clock.totalMinutes / MINUTES_PER_DAY);
}

function createUsedListing(acData, market, locationIata) {
    const ageYears = 2 + Math.floor(Math.random() * 9); // 2-10 years
    const hoursFlown = Math.round(ageYears * (1500 + Math.random() * 2000));
    const priceMultiplier = 0.60 + Math.random() * 0.20; // 60-80%
    const condition = Math.random() > 0.4 ? 'Good' : 'Fair';
    const price = Math.round(acData.purchasePrice * priceMultiplier);
    const leasePrice = Math.round(acData.leaseCostPerMonth * (priceMultiplier + 0.05));

    return {
        id: market.nextListingId++,
        type: acData.type,
        category: acData.category,
        seats: acData.seats,
        rangeKm: acData.rangeKm,
        ageYears,
        hoursFlown,
        condition,
        priceMultiplier,
        price,
        leasePrice,
        location: locationIata,
        featured: false
    };
}

export function checkUsedMarketRefresh() {
    const state = getState();
    const market = state.usedMarket;
    const currentDay = Math.floor(state.clock.totalMinutes / MINUTES_PER_DAY);
    if (currentDay - market.lastRefreshDay >= 30) {
        generateUsedMarketListings(false);
        addLogEntry('Used aircraft market has refreshed with new listings', 'fleet');
    }
}

export function purchaseUsedAircraft(listingId, ferryToHub = false) {
    const state = getState();
    const market = state.usedMarket;
    const listing = market.listings.find(l => l.id === listingId);
    if (!listing) {
        addLogEntry('Listing not found in used market', 'error');
        return null;
    }

    let ferryCost = 0;
    let distance = 0;
    if (ferryToHub && listing.location !== state.config.hubAirport) {
        distance = getDistanceBetweenAirports(listing.location, state.config.hubAirport);
        ferryCost = Math.round(distance * 2.5);
    }

    const totalCost = listing.price + ferryCost;
    if (state.finances.cash < totalCost) {
        addLogEntry(`Not enough cash for purchase and ferry ($${formatMoney(totalCost)})`, 'error');
        return null;
    }

    if (!deductCash(listing.price, `Purchase used ${listing.type} (${listing.ageYears}yr, ${listing.condition})`)) {
        return null;
    }

    if (ferryCost > 0) {
        deductCash(ferryCost, `Ferry flight: ${listing.location} \u2192 ${state.config.hubAirport} (${Math.round(distance)}km)`);
    }

    const aircraft = {
        id: state.nextFleetId++,
        type: listing.type,
        ownership: OWNERSHIP_TYPE.OWNED,
        purchasePrice: listing.price,
        purchaseDate: state.clock.totalMinutes,
        totalFlightHours: listing.hoursFlown,
        status: 'available',
        registration: generateRegistration(state),
        currentLocation: ferryToHub ? state.config.hubAirport : listing.location,
        usedAge: listing.ageYears,
        condition: listing.condition
    };

    state.fleet.push(aircraft);
    market.listings = market.listings.filter(l => l.id !== listingId);
    addLogEntry(`Used aircraft purchased: ${listing.type} (${aircraft.registration}), ${listing.ageYears}yr old, ${listing.condition}`, 'fleet');
    return aircraft;
}

export function leaseUsedAircraft(listingId, ferryToHub = false) {
    const state = getState();
    const market = state.usedMarket;
    const listing = market.listings.find(l => l.id === listingId);
    if (!listing) {
        addLogEntry('Listing not found in used market', 'error');
        return null;
    }

    const deposit = listing.leasePrice * LEASE_DEPOSIT_MONTHS;
    let ferryCost = 0;
    let distance = 0;
    if (ferryToHub && listing.location !== state.config.hubAirport) {
        distance = getDistanceBetweenAirports(listing.location, state.config.hubAirport);
        ferryCost = Math.round(distance * 2.5);
    }

    const totalCost = deposit + ferryCost;
    if (state.finances.cash < totalCost) {
        addLogEntry(`Not enough cash for lease deposit and ferry ($${formatMoney(totalCost)})`, 'error');
        return null;
    }

    if (!deductCash(deposit, `Lease deposit for used ${listing.type} (${LEASE_DEPOSIT_MONTHS} months)`)) {
        return null;
    }

    if (ferryCost > 0) {
        deductCash(ferryCost, `Ferry flight: ${listing.location} \u2192 ${state.config.hubAirport} (${Math.round(distance)}km)`);
    }

    const aircraft = {
        id: state.nextFleetId++,
        type: listing.type,
        ownership: OWNERSHIP_TYPE.LEASED,
        leaseCostPerMonth: listing.leasePrice,
        leaseStartDate: state.clock.totalMinutes,
        depositPaid: deposit,
        totalFlightHours: listing.hoursFlown,
        status: 'available',
        registration: generateRegistration(state),
        currentLocation: ferryToHub ? state.config.hubAirport : listing.location,
        usedAge: listing.ageYears,
        condition: listing.condition
    };

    state.fleet.push(aircraft);
    market.listings = market.listings.filter(l => l.id !== listingId);
    addLogEntry(`Used aircraft leased: ${listing.type} (${aircraft.registration}), $${formatMoney(listing.leasePrice)}/mo`, 'fleet');
    return aircraft;
}

export function addFreeAircraftToFleet(aircraftType) {
    const state = getState();
    const acData = getAircraftByType(aircraftType);
    if (!acData) return null;

    const aircraft = {
        id: state.nextFleetId++,
        type: acData.type,
        ownership: OWNERSHIP_TYPE.OWNED,
        purchasePrice: 0,
        purchaseDate: state.clock.totalMinutes,
        totalFlightHours: 0,
        status: 'available',
        registration: generateRegistration(state),
        currentLocation: state.config.hubAirport
    };

    state.fleet.push(aircraft);
    addLogEntry(`Starter aircraft added: ${acData.type} (${aircraft.registration})`, 'fleet');
    return aircraft;
}
