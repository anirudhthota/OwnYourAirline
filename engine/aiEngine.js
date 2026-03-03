import { getState, addLogEntry } from './state.js';
import { AI_AIRLINES } from '../data/airlines.js';
import { AIRPORTS, getAirportByIata, getDistanceBetweenAirports } from '../data/airports.js';
import { getAircraftByType } from '../data/aircraft.js';

export function initializeAIAirlines() {
    const state = getState();
    const aggression = state.ai.difficulty;

    state.ai.airlines = [];
    state.ai.routes = [];

    for (const airline of AI_AIRLINES) {
        const hub = getAirportByIata(airline.hub);
        if (!hub) continue;

        const aiAirline = {
            iata: airline.iata,
            name: airline.name,
            hub: airline.hub,
            color: airline.color,
            alliance: airline.alliance,
            fleetPreference: airline.fleetPreference,
            routeCount: 0,
            region: airline.region
        };

        state.ai.airlines.push(aiAirline);

        const numRoutes = Math.floor(3 + aggression * 12 + Math.random() * 8);
        generateAIRoutes(aiAirline, numRoutes, aggression);
    }

    addLogEntry(`AI initialized: ${state.ai.airlines.length} airlines, ${state.ai.routes.length} routes`, 'system');
}

function generateAIRoutes(airline, numRoutes, aggression) {
    const state = getState();
    const hub = getAirportByIata(airline.hub);
    if (!hub) return;

    const preferredAircraft = airline.fleetPreference[0];
    const acData = getAircraftByType(preferredAircraft);
    const maxRange = acData ? acData.rangeKm : 6000;

    const candidates = AIRPORTS.filter(ap => {
        if (ap.iata === airline.hub) return false;
        const dist = getDistanceBetweenAirports(airline.hub, ap.iata);
        return dist && dist <= maxRange;
    });

    candidates.sort((a, b) => {
        const sameRegionA = a.region === hub.region ? 1 : 0;
        const sameRegionB = b.region === hub.region ? 1 : 0;
        return (sameRegionB + b.slotsPerHour / 100) - (sameRegionA + a.slotsPerHour / 100);
    });

    const routeCount = Math.min(numRoutes, candidates.length);
    const selected = candidates.slice(0, routeCount);

    for (const dest of selected) {
        const dist = getDistanceBetweenAirports(airline.hub, dest.iata);
        if (!dist) continue;

        const dailyFreq = Math.max(1, Math.floor(aggression * 3 + Math.random() * 2));

        state.ai.routes.push({
            airlineIata: airline.iata,
            origin: airline.hub,
            destination: dest.iata,
            distance: Math.round(dist),
            dailyFrequency: dailyFreq,
            aircraftType: selectAIAircraft(airline.fleetPreference, dist)
        });

        airline.routeCount++;
    }
}

function selectAIAircraft(preferences, distance) {
    for (const pref of preferences) {
        const ac = getAircraftByType(pref);
        if (ac && ac.rangeKm >= distance) return pref;
    }
    return preferences[0];
}

export function tickAI() {
    // AI expansion happens monthly, not every tick
}

export function monthlyAIExpansion() {
    const state = getState();
    const aggression = state.ai.difficulty;

    if (Math.random() > aggression * 0.3) return;

    const expandingAirlines = state.ai.airlines
        .filter(() => Math.random() < aggression * 0.2)
        .slice(0, 5);

    for (const airline of expandingAirlines) {
        const hub = getAirportByIata(airline.hub);
        if (!hub) continue;

        const existingDests = new Set(
            state.ai.routes
                .filter(r => r.airlineIata === airline.iata)
                .map(r => r.destination)
        );

        const preferredAircraft = airline.fleetPreference[0];
        const acData = getAircraftByType(preferredAircraft);
        const maxRange = acData ? acData.rangeKm : 6000;

        const candidates = AIRPORTS.filter(ap => {
            if (ap.iata === airline.hub) return false;
            if (existingDests.has(ap.iata)) return false;
            const dist = getDistanceBetweenAirports(airline.hub, ap.iata);
            return dist && dist <= maxRange;
        });

        if (candidates.length === 0) continue;

        const dest = candidates[Math.floor(Math.random() * Math.min(10, candidates.length))];
        const dist = getDistanceBetweenAirports(airline.hub, dest.iata);

        state.ai.routes.push({
            airlineIata: airline.iata,
            origin: airline.hub,
            destination: dest.iata,
            distance: Math.round(dist),
            dailyFrequency: Math.max(1, Math.floor(Math.random() * 3)),
            aircraftType: selectAIAircraft(airline.fleetPreference, dist)
        });

        airline.routeCount++;
    }
}

export function getAIRoutesByAirline(iata) {
    const state = getState();
    return state.ai.routes.filter(r => r.airlineIata === iata);
}

export function getAIRoutesAtAirport(airportIata) {
    const state = getState();
    return state.ai.routes.filter(r => r.origin === airportIata || r.destination === airportIata);
}

export function getAICompetitorsOnRoute(origin, destination) {
    const state = getState();
    return state.ai.routes.filter(r =>
        (r.origin === origin && r.destination === destination) ||
        (r.origin === destination && r.destination === origin)
    );
}
