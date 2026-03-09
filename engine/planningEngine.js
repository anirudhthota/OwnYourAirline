/**
 * Planning Engine — Lightweight read-only helpers for route planning.
 * 
 * Responsibilities:
 * - Aircraft feasibility evaluation against route + timing template
 * - Aircraft-specific return timing recalculation
 * - Classification of aircraft fit states
 * - Planner warnings (soft advisories)
 * 
 * This module NEVER mutates game state. It derives all results
 * from existing state, schedules, routes, and aircraft data.
 */

import { getState } from './state.js';
import { getRouteById, calculateBlockTime, canAircraftFlyRoute } from './routeEngine.js';
import { getAircraftByType, getTurnaroundTime, getMissionBand } from '../data/aircraft.js';
import { buildAircraftRotationChain } from './rotationEngine.js';
import { getSchedulesByAircraftIndexed } from './indexHelpers.js';

// === Fit Status Constants ===
export const FIT_STATUS = {
    AVAILABLE: 'available',
    AVAILABLE_ADJUSTED: 'available_adjusted',
    REQUIRES_TWO: 'requires_two',
    BLOCKED_LOCATION: 'blocked_location',
    BLOCKED_TURNAROUND: 'blocked_turnaround',
    BLOCKED_MAINTENANCE: 'blocked_maintenance',
    BLOCKED_OVERLAP: 'blocked_overlap',
    BLOCKED_RANGE: 'blocked_range'
};

const FIT_ORDER = [
    FIT_STATUS.AVAILABLE,
    FIT_STATUS.AVAILABLE_ADJUSTED,
    FIT_STATUS.REQUIRES_TWO,
    FIT_STATUS.BLOCKED_LOCATION,
    FIT_STATUS.BLOCKED_TURNAROUND,
    FIT_STATUS.BLOCKED_OVERLAP,
    FIT_STATUS.BLOCKED_MAINTENANCE,
    FIT_STATUS.BLOCKED_RANGE
];

/**
 * Recalculate return departure time for a specific aircraft type on a route.
 * @param {number} routeDistance - km
 * @param {string} aircraftType - e.g. 'A320neo'
 * @param {number} outboundDepMinute - minute of day (0-1439)
 * @returns {{ returnDepMinute: number, blockTime: number, turnaround: number, arrivalMinute: number }}
 */
export function recalculateTimingForAircraft(routeDistance, aircraftType, outboundDepMinute) {
    const blockTime = calculateBlockTime(routeDistance, aircraftType);
    const turnaround = getTurnaroundTime(aircraftType, routeDistance);
    const arrivalMinute = outboundDepMinute + blockTime;
    const returnDepMinute = arrivalMinute + turnaround;

    return {
        returnDepMinute: returnDepMinute % 1440,
        returnDepRaw: returnDepMinute,      // may exceed 1440 (next-day)
        blockTime,
        turnaround,
        arrivalMinute: arrivalMinute % 1440,
        arrivalRaw: arrivalMinute,
        isNextDay: returnDepMinute >= 1440
    };
}

/**
 * Evaluate all fleet aircraft against a route + timing template.
 * Returns feasibility results sorted by fit status (best first).
 * 
 * @param {number} routeId
 * @param {number} outboundDepMinute - proposed outbound departure (minute of day)
 * @param {number|null} [proposedReturnMinute] - if null, auto-calculated per aircraft
 * @param {number|null} [excludeScheduleId] - schedule being edited (exclude from conflict checks)
 * @returns {Array<Object>} sorted feasibility results
 */
export function evaluateAircraftFeasibility(routeId, outboundDepMinute, proposedReturnMinute = null, excludeScheduleId = null) {
    const state = getState();
    const route = getRouteById(routeId);
    if (!route) return [];

    const pairedRoute = route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;
    const results = [];

    for (const ac of state.fleet) {
        const acData = getAircraftByType(ac.type);
        if (!acData) continue;

        const result = {
            aircraftId: ac.id,
            registration: ac.registration,
            type: ac.type,
            category: acData.category,
            seats: acData.seats,
            currentLocation: ac.currentLocation || 'Unknown',
            fitStatus: FIT_STATUS.AVAILABLE,
            recalculatedReturnMinute: null,
            blockTimeMinutes: 0,
            turnaroundMinutes: 0,
            sameAircraftPossible: true,
            isNextDay: false,
            notes: ''
        };

        // 1. Range check
        if (!canAircraftFlyRoute(ac.type, route.distance)) {
            result.fitStatus = FIT_STATUS.BLOCKED_RANGE;
            result.sameAircraftPossible = false;
            result.notes = `Range ${acData.rangeKm}km < distance ${route.distance}km`;
            results.push(result);
            continue;
        }

        // 2. Maintenance check
        if (ac.status === 'maintenance') {
            result.fitStatus = FIT_STATUS.BLOCKED_MAINTENANCE;
            result.sameAircraftPossible = false;
            result.notes = 'Aircraft in maintenance';
            results.push(result);
            continue;
        }
        if (ac.status === 'maintenance_due') {
            result.fitStatus = FIT_STATUS.BLOCKED_MAINTENANCE;
            result.sameAircraftPossible = false;
            result.notes = 'Maintenance due';
            results.push(result);
            continue;
        }

        // 3. Calculate aircraft-specific timing
        const timing = recalculateTimingForAircraft(route.distance, ac.type, outboundDepMinute);
        result.blockTimeMinutes = timing.blockTime;
        result.turnaroundMinutes = timing.turnaround;
        result.isNextDay = timing.isNextDay;

        // Determine return departure
        let returnDep = proposedReturnMinute;
        if (returnDep == null && pairedRoute) {
            returnDep = timing.returnDepMinute;
        }
        result.recalculatedReturnMinute = returnDep;

        // 4. Check if round trip fits in 24h for same-aircraft operation
        if (pairedRoute && returnDep != null) {
            const returnBlockTime = calculateBlockTime(pairedRoute.distance, ac.type);
            const returnTurnaround = getTurnaroundTime(ac.type, pairedRoute.distance);
            const totalCycleMinutes = timing.blockTime + timing.turnaround + returnBlockTime + returnTurnaround;

            if (totalCycleMinutes > 1440) {
                result.sameAircraftPossible = false;
                result.fitStatus = FIT_STATUS.REQUIRES_TWO;
                result.notes = `Round trip ${Math.floor(totalCycleMinutes / 60)}h${totalCycleMinutes % 60}m exceeds 24h`;
                results.push(result);
                continue;
            }
        }

        // 5. Location check
        const chain = buildAircraftRotationChain(ac.id, 0, excludeScheduleId);
        let locationAtDep = ac.currentLocation || route.origin;

        if (chain.length > 0) {
            // Find where the aircraft is at the proposed outbound departure time
            const lastLeg = chain[chain.length - 1];
            let foundLoc = null;

            if (outboundDepMinute <= chain[0].depMinute) {
                // Before first flight: aircraft is at last leg's destination (overnight)
                foundLoc = lastLeg.destination;
            } else {
                for (let i = 0; i < chain.length; i++) {
                    const leg = chain[i];
                    if (outboundDepMinute >= leg.depMinute && outboundDepMinute < leg.arrMinute) {
                        foundLoc = 'airborne';
                        break;
                    }
                    const nextLeg = chain[i + 1];
                    if (outboundDepMinute >= leg.arrMinute && (!nextLeg || outboundDepMinute < nextLeg.depMinute)) {
                        foundLoc = leg.destination;
                        break;
                    }
                }
            }

            if (foundLoc) locationAtDep = foundLoc;
        }

        if (locationAtDep === 'airborne') {
            result.fitStatus = FIT_STATUS.BLOCKED_OVERLAP;
            result.sameAircraftPossible = false;
            result.notes = 'Aircraft airborne at departure time';
            results.push(result);
            continue;
        }

        if (locationAtDep !== route.origin && locationAtDep !== 'Unknown') {
            result.fitStatus = FIT_STATUS.BLOCKED_LOCATION;
            result.sameAircraftPossible = false;
            result.notes = `At ${locationAtDep}, needs ${route.origin}`;
            results.push(result);
            continue;
        }

        // 6. Schedule overlap check
        let hasOverlap = false;
        for (const leg of chain) {
            const legEnd = leg.arrMinute + leg.turnaround;
            // Check if outbound leg overlaps
            if (outboundDepMinute >= leg.depMinute && outboundDepMinute < legEnd) {
                hasOverlap = true;
                break;
            }
            // Check if our arrival + turnaround overlaps the next leg
            const ourArrival = outboundDepMinute + timing.blockTime;
            const ourEnd = ourArrival + timing.turnaround;
            if (ourArrival >= leg.depMinute && ourArrival < legEnd) {
                hasOverlap = true;
                break;
            }
            if (leg.depMinute >= outboundDepMinute && leg.depMinute < ourEnd) {
                hasOverlap = true;
                break;
            }
        }

        if (hasOverlap) {
            result.fitStatus = FIT_STATUS.BLOCKED_OVERLAP;
            result.sameAircraftPossible = false;
            result.notes = 'Conflicts with existing schedule';
            results.push(result);
            continue;
        }

        // 7. Check if return time was adjusted from proposed
        if (proposedReturnMinute != null && returnDep != null && returnDep !== proposedReturnMinute) {
            result.fitStatus = FIT_STATUS.AVAILABLE_ADJUSTED;
            result.notes = `Return adjusted to ${formatMinute(returnDep)}`;
        } else {
            result.fitStatus = FIT_STATUS.AVAILABLE;
            result.notes = 'Ready to operate';
        }

        results.push(result);
    }

    // Sort by fit status priority
    results.sort((a, b) => {
        const aIdx = FIT_ORDER.indexOf(a.fitStatus);
        const bIdx = FIT_ORDER.indexOf(b.fitStatus);
        if (aIdx !== bIdx) return aIdx - bIdx;
        // Within same status, sort by type name
        return a.type.localeCompare(b.type);
    });

    return results;
}

/**
 * Get the fit status label and color for UI rendering.
 */
export function getFitStatusDisplay(fitStatus) {
    switch (fitStatus) {
        case FIT_STATUS.AVAILABLE: return { label: 'Available', icon: '✅', color: 'var(--color-success)' };
        case FIT_STATUS.AVAILABLE_ADJUSTED: return { label: 'Available (Adjusted)', icon: '🔄', color: 'var(--accent-blue)' };
        case FIT_STATUS.REQUIRES_TWO: return { label: 'Requires 2 Aircraft', icon: '⚠️', color: 'var(--color-warning)' };
        case FIT_STATUS.BLOCKED_LOCATION: return { label: 'Wrong Location', icon: '❌', color: 'var(--color-danger)' };
        case FIT_STATUS.BLOCKED_TURNAROUND: return { label: 'Turnaround Conflict', icon: '❌', color: 'var(--color-danger)' };
        case FIT_STATUS.BLOCKED_MAINTENANCE: return { label: 'Maintenance', icon: '🔴', color: 'var(--color-danger)' };
        case FIT_STATUS.BLOCKED_OVERLAP: return { label: 'Schedule Overlap', icon: '❌', color: 'var(--color-danger)' };
        case FIT_STATUS.BLOCKED_RANGE: return { label: 'Out of Range', icon: '❌', color: 'var(--text-muted)' };
        default: return { label: fitStatus, icon: '❓', color: 'var(--text-muted)' };
    }
}

function formatMinute(m) {
    const h = Math.floor((m % 1440) / 60);
    const min = (m % 1440) % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
