/**
 * Lightweight lazy-rebuild index helpers for game state arrays.
 * 
 * Strategy:
 * - Each index is a Map built from state arrays on first access after invalidation.
 * - Mutation functions (create/delete schedule/route) call markXxxDirty() to invalidate.
 * - Rebuild is O(n) but only happens once per mutation cycle.
 * - All getters are read-only — they return filtered arrays, never mutate state.
 */

import { getState } from './state.js';

// === Dirty Flags ===
let _schedulesDirty = true;
let _routesDirty = true;

// === Schedule Indexes ===
let _schedByRoute = new Map();    // routeId → [schedule, ...]
let _schedByAircraft = new Map(); // aircraftId → [schedule, ...]

// === Route Indexes ===
let _routesByOrigin = new Map();      // iata → [route, ...]
let _routesByDestination = new Map(); // iata → [route, ...]
let _routeById = new Map();           // id → route

// === Invalidation ===

export function markSchedulesDirty() {
    _schedulesDirty = true;
}

export function markRoutesDirty() {
    _routesDirty = true;
}

// === Schedule Index Rebuild ===

function rebuildScheduleIndexes() {
    const state = getState();
    _schedByRoute = new Map();
    _schedByAircraft = new Map();

    for (const s of state.schedules) {
        // By route
        if (!_schedByRoute.has(s.routeId)) _schedByRoute.set(s.routeId, []);
        _schedByRoute.get(s.routeId).push(s);

        // By aircraft
        if (s.aircraftId != null) {
            if (!_schedByAircraft.has(s.aircraftId)) _schedByAircraft.set(s.aircraftId, []);
            _schedByAircraft.get(s.aircraftId).push(s);
        }
    }

    _schedulesDirty = false;
}

// === Route Index Rebuild ===

function rebuildRouteIndexes() {
    const state = getState();
    _routesByOrigin = new Map();
    _routesByDestination = new Map();
    _routeById = new Map();

    for (const r of state.routes) {
        _routeById.set(r.id, r);

        if (!_routesByOrigin.has(r.origin)) _routesByOrigin.set(r.origin, []);
        _routesByOrigin.get(r.origin).push(r);

        if (!_routesByDestination.has(r.destination)) _routesByDestination.set(r.destination, []);
        _routesByDestination.get(r.destination).push(r);
    }

    _routesDirty = false;
}

// === Public Getters ===

export function getSchedulesByRouteIndexed(routeId) {
    if (_schedulesDirty) rebuildScheduleIndexes();
    return _schedByRoute.get(routeId) || [];
}

export function getSchedulesByAircraftIndexed(aircraftId) {
    if (_schedulesDirty) rebuildScheduleIndexes();
    return _schedByAircraft.get(aircraftId) || [];
}

export function getRoutesByOrigin(iata) {
    if (_routesDirty) rebuildRouteIndexes();
    return _routesByOrigin.get(iata) || [];
}

export function getRoutesByDestination(iata) {
    if (_routesDirty) rebuildRouteIndexes();
    return _routesByDestination.get(iata) || [];
}

export function getRouteByIdIndexed(routeId) {
    if (_routesDirty) rebuildRouteIndexes();
    return _routeById.get(routeId) || null;
}
