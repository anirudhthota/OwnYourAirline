import { getState, addLogEntry, deductCash, addCash, formatMoney } from './state.js';
import { getAirportByIata, getDistanceBetweenAirports, getSlotControlLevel, getSlotCost } from '../data/airports.js';
import { getAircraftByType, FUEL_COST_PER_KG, CREW_COST_PER_FLIGHT_HOUR, AIRPORT_FEE_PER_DEPARTURE, AIRPORT_FEE_PER_ARRIVAL } from '../data/aircraft.js';
import { markRoutesDirty, markSchedulesDirty, getSchedulesByRouteIndexed } from './indexHelpers.js';

export function createRoute(originIata, destinationIata) {
    const state = getState();
    const origin = getAirportByIata(originIata);
    const dest = getAirportByIata(destinationIata);

    if (!origin || !dest) {
        addLogEntry(`Cannot create route: invalid airport code`, 'error');
        return null;
    }

    if (originIata === destinationIata) {
        addLogEntry(`Cannot create route: origin and destination are the same`, 'error');
        return null;
    }

    const existing = state.routes.find(r =>
        r.origin === originIata && r.destination === destinationIata
    );
    if (existing) {
        addLogEntry(`Route ${originIata} \u2192 ${destinationIata} already exists`, 'warning');
        return null;
    }

    const distance = getDistanceBetweenAirports(originIata, destinationIata);

    // Slot cost: one-time fee for Level 3+ airports (player auto-holds hub slots for free)
    const isHub = originIata === state.config.hubAirport;
    const originSlotCost = isHub ? 0 : getSlotCost(originIata);
    if (originSlotCost > 0) {
        if (!deductCash(originSlotCost, `Slot fee at ${originIata} (Level ${getSlotControlLevel(originIata)})`)) {
            return null;
        }
    }

    const route = {
        id: state.nextRouteId++,
        origin: originIata,
        destination: destinationIata,
        distance: Math.round(distance),
        active: true,
        assignedAircraft: [],
        schedules: [],
        demand: calculateRouteDemand(origin, dest, distance),
        baseFare: calculateBaseFare(distance),
        createdDate: state.clock.totalMinutes,
        slotCostPaid: originSlotCost,
        pairedRouteId: null,
        fareMultiplier: 1.0
    };

    state.routes.push(route);
    markRoutesDirty();
    addLogEntry(`Route created: ${originIata} → ${destinationIata} (${Math.round(distance)} km)`, 'route');
    return route;
}

export function deleteRoute(routeId) {
    const state = getState();
    const idx = state.routes.findIndex(r => r.id === routeId);
    if (idx === -1) return false;

    const route = state.routes[idx];

    state.schedules = state.schedules.filter(s => s.routeId !== routeId);
    markRoutesDirty();
    markSchedulesDirty();

    const activeOnRoute = state.flights.active.filter(f => f.routeId === routeId);
    if (activeOnRoute.length > 0) {
        addLogEntry(`Route ${route.origin}-${route.destination} has ${activeOnRoute.length} active flights — they will complete before removal`, 'warning');
        route.active = false;
        return true;
    }

    state.routes.splice(idx, 1);
    addLogEntry(`Route deleted: ${route.origin} → ${route.destination}`, 'route');
    return true;
}

export function calculateBlockTime(distance, aircraftType) {
    const ac = getAircraftByType(aircraftType);
    if (!ac) return 0;
    const taxiTime = 30;
    const flightHours = distance / ac.cruiseSpeedKmh;
    return Math.round(flightHours * 60 + taxiTime);
}

export function calculateBaseFare(distance) {
    if (distance < 500) return 50 + distance * 0.08;
    if (distance < 1500) return 70 + distance * 0.10;
    if (distance < 4000) return 100 + distance * 0.08;
    if (distance < 8000) return 150 + distance * 0.06;
    return 200 + distance * 0.05;
}

export function calculateRouteDemand(origin, dest, distance) {
    let base = 150;

    const hubMultiplier = (origin.slotsPerHour + dest.slotsPerHour) / 60;
    base *= hubMultiplier;

    if (distance < 800) base *= 1.4;
    else if (distance < 2000) base *= 1.2;
    else if (distance < 5000) base *= 1.0;
    else if (distance < 10000) base *= 0.8;
    else base *= 0.6;

    if (origin.region !== dest.region) base *= 0.85;

    return Math.max(30, Math.round(base));
}

/**
 * Canonical price elasticity formula. All UI views should import this
 * instead of duplicating the inline formula.
 * @param {number} fareMultiplier - 0.75 to 1.50
 * @returns {number} elasticity factor (0.25 to 1.0+)
 */
export function calculatePriceElasticity(fareMultiplier) {
    return Math.max(0.25, 1 - (fareMultiplier - 1) * 0.8);
}

export function calculateLoadFactor(route, totalSeatsOffered) {
    if (totalSeatsOffered === 0) return 0;

    const multiplier = route.fareMultiplier !== undefined ? route.fareMultiplier : 1.0;
    const priceElasticity = calculatePriceElasticity(multiplier);
    const dailyDemand = route.demand * priceElasticity;

    const ratio = dailyDemand / totalSeatsOffered;

    if (ratio >= 2.0) return 0.95;
    if (ratio >= 1.5) return 0.90;
    if (ratio >= 1.0) return 0.82;
    if (ratio >= 0.7) return 0.70;
    if (ratio >= 0.5) return 0.55;
    return 0.40;
}

export function calculateFlightRevenue(route, seats, loadFactor) {
    const passengers = Math.round(seats * loadFactor);
    const multiplier = route.fareMultiplier !== undefined ? route.fareMultiplier : 1.0;
    const ticketPrice = route.baseFare * multiplier;
    return Math.round(passengers * ticketPrice);
}

export function calculateFlightCost(route, aircraftType) {
    const ac = getAircraftByType(aircraftType);
    if (!ac) return 0;

    const flightHours = route.distance / ac.cruiseSpeedKmh;
    const fuelCost = ac.fuelBurnPerHour * flightHours * FUEL_COST_PER_KG;
    const crewCost = CREW_COST_PER_FLIGHT_HOUR * flightHours;
    const airportFees = AIRPORT_FEE_PER_DEPARTURE + AIRPORT_FEE_PER_ARRIVAL;
    const maintenance = ac.maintenanceCostPerHour * flightHours;

    return Math.round(fuelCost + crewCost + airportFees + maintenance);
}

export function canAircraftFlyRoute(aircraftType, distance) {
    const ac = getAircraftByType(aircraftType);
    if (!ac) return false;
    return ac.rangeKm >= distance;
}

export function getRouteById(routeId) {
    const state = getState();
    return state.routes.find(r => r.id === routeId) || null;
}

export function getRoutesByAirport(iata) {
    const state = getState();
    return state.routes.filter(r => r.origin === iata || r.destination === iata);
}

export function getTotalDailySeatsOnRoute(routeId) {
    const state = getState();
    const schedules = getSchedulesByRouteIndexed(routeId).filter(s => s.active);
    let totalSeats = 0;
    for (const sched of schedules) {
        const aircraft = state.fleet.find(f => f.id === sched.aircraftId);
        if (aircraft) {
            const acData = getAircraftByType(aircraft.type);
            if (acData) {
                totalSeats += acData.seats * sched.departureTimes.length;
            }
        }
    }
    return totalSeats;
}
