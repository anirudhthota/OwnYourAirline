import { getState } from './state.js';
import { getRouteById, calculateBlockTime } from './routeEngine.js';
import { getTurnaroundTime, getAircraftByType } from '../data/aircraft.js';

/**
 * Builds a chronological day-level chain of scheduled flights for an aircraft.
 * @param {number} aircraftId 
 * @param {number} dayOffset - Currently unused, defaults to 0 for a generic 24h day.
 * @param {number|null} excludeScheduleId - Schedule ID to exclude (useful when editing a schedule)
 * @returns {Array} Array of flight legs sorted by departure time.
 */
export function buildAircraftRotationChain(aircraftId, dayOffset = 0, excludeScheduleId = null) {
    const state = getState();
    const schedules = state.schedules.filter(s => s.aircraftId === aircraftId && s.active && s.id !== excludeScheduleId);

    const aircraft = state.fleet.find(f => f.id === aircraftId);
    if (!aircraft) return [];

    const chain = [];

    // Flatten all schedules into individual flight legs
    for (const sched of schedules) {
        const route = getRouteById(sched.routeId);
        if (!route) continue;

        const blockTime = sched.blockTimeMinutes;
        const turnaround = getTurnaroundTime(aircraft.type);

        sched.departureTimes.forEach((t, i) => {
            const depMinute = t.hour * 60 + t.minute;
            const arrMinute = depMinute + blockTime;
            const flightNumber = (sched.flightNumbers && sched.flightNumbers[i]) ? sched.flightNumbers[i] : null;

            chain.push({
                scheduleId: sched.id,
                routeId: route.id,
                flightNumber,
                origin: route.origin,
                destination: route.destination,
                depMinute,
                arrMinute,
                turnaround,
                isNextDay: false // useful for multi-day extensions
            });
        });
    }

    // Sort chronologically within the 24-hour window
    chain.sort((a, b) => a.depMinute - b.depMinute);

    return chain;
}

/**
 * Validates physical continuity, turnaround, and maintenance across an entire proposed chain.
 * @param {number} aircraftId 
 * @param {Array} extraLegs - Optional array of additional flight legs to weave into the chain for validation.
 *                            Format: [{ origin, destination, depMinute, blockTime }]
 * @param {number|null} excludeScheduleId - Optional schedule to ignore.
 * @param {string|null} assumedStartLocation - Assumed starting location for the first leg if chain is empty or for paired overrides.
 * @returns {Array} Array of error message strings. Empty if valid.
 */
export function validateAircraftRotationChain(aircraftId, extraLegs = [], excludeScheduleId = null, assumedStartLocation = null) {
    const state = getState();
    const errors = [];

    // 1. Build the base chain and mix in extra legs
    const baseChain = buildAircraftRotationChain(aircraftId, 0, excludeScheduleId);
    const aircraft = state.fleet.find(f => f.id === aircraftId);
    if (!aircraft) return ['Aircraft not found.'];

    const turnaround = getTurnaroundTime(aircraft.type);

    const fullChain = [...baseChain];

    for (const extra of extraLegs) {
        fullChain.push({
            scheduleId: 'proposed',
            routeId: 'proposed',
            origin: extra.origin,
            destination: extra.destination,
            depMinute: extra.depMinute,
            arrMinute: extra.depMinute + extra.blockTime,
            turnaround: turnaround,
            isProposed: true
        });
    }

    // Sort total pool chronologically by abstract minute
    fullChain.sort((a, b) => a.depMinute - b.depMinute);

    if (fullChain.length <= 1) {
        // Maintenance checks still apply
        if (aircraft.status === 'maintenance' && aircraft.maintenanceReleaseTime && fullChain.length > 0) {
            checkMaintenanceConflict(aircraft, fullChain[0].depMinute, errors, state.clock.totalMinutes);
        }
        return errors;
    }

    // 2. Validate Turnaround and Physical Location Continuity across the chain
    for (let i = 0; i < fullChain.length; i++) {
        const currentLeg = fullChain[i];

        // Maintenance check
        if (aircraft.status === 'maintenance' && aircraft.maintenanceReleaseTime) {
            checkMaintenanceConflict(aircraft, currentLeg.depMinute, errors, state.clock.totalMinutes);
        }

        // The "next" leg wraps around to the beginning for a daily cycle
        const nextIdx = (i + 1) % fullChain.length;
        const nextLeg = fullChain[nextIdx];

        // Special case: if this is a proposed leg and there is an assumedStartLocation, use it if it's the very first leg being checked against an empty base chain, or directly overriding.
        // For simplicity, we just inject a check that if assumedStartLocation is provided and we are transitioning into the first proposed leg, we accept it.
        let requireLink = true;
        if (nextLeg.isProposed && assumedStartLocation !== null && nextLeg.origin === assumedStartLocation) {
            // If the UI explicitly says "assume it starts here" (e.g. return leg validation), we skip the origin link check for this specific proposed leg.
            // Only if the current leg isn't providing a valid link itself that would conflict.
            requireLink = false;
        }

        // 2a. Location Continuity
        if (requireLink && currentLeg.destination !== nextLeg.origin) {
            let msg = `Rotation broken: Arrives at ${currentLeg.destination} at ${formatTime(currentLeg.arrMinute)}, but next flight departs ${nextLeg.origin} at ${formatTime(nextLeg.depMinute)}.`;
            if (nextIdx === 0) {
                msg = `Overnight rotation broken: End of day arrives at ${currentLeg.destination}, but start of day departs ${nextLeg.origin}.`;
            }
            if (!errors.includes(msg)) errors.push(msg);
        }

        // 2b. Turnaround Padding
        const arrivalPlusTurn = currentLeg.arrMinute + currentLeg.turnaround;

        let gap;
        if (nextIdx === 0) {
            // Gap across midnight
            gap = (nextLeg.depMinute + 1440) - currentLeg.arrMinute;
        } else {
            gap = nextLeg.depMinute - currentLeg.arrMinute;
        }

        if (gap < currentLeg.turnaround) {
            const msg = `Insufficient turnaround: Arrives ${formatTime(currentLeg.arrMinute)}, needs ${currentLeg.turnaround}m. Next departure at ${formatTime(nextLeg.depMinute)} is too early.`;
            if (!errors.includes(msg)) errors.push(msg);
        }
    }

    return errors;
}

function checkMaintenanceConflict(aircraft, depMinute, errors, currentSimMinute) {
    let nextDep = Math.floor(currentSimMinute / 1440) * 1440 + depMinute;
    if (nextDep <= currentSimMinute) {
        nextDep += 1440;
    }
    if (nextDep < aircraft.maintenanceReleaseTime) {
        const msg = `${aircraft.registration} is in maintenance. Cannot fulfill departure at ${formatTime(depMinute)} before release.`;
        if (!errors.includes(msg)) errors.push(msg);
    }
}

/**
 * Returns where the aircraft should physically be at a given time within its daily plan.
 * Used for swap validation and initial location assumptions.
 * @param {number} aircraftId 
 * @param {number} timeMinute - minute of day (0-1439)
 * @param {number|null} excludeScheduleId 
 * @param {string|null} assumedStartLocation
 * @returns {string} IATA code or 'airborne'
 */
export function getAircraftNextOperationalLocation(aircraftId, timeMinute, excludeScheduleId = null, assumedStartLocation = null) {
    if (assumedStartLocation) return assumedStartLocation;

    const chain = buildAircraftRotationChain(aircraftId, 0, excludeScheduleId);
    if (chain.length === 0) {
        const state = getState();
        const ac = state.fleet.find(f => f.id === aircraftId);
        return ac ? ac.currentLocation : null;
    }

    // If time is before the first flight of the day, it's at the start of the chain
    if (timeMinute <= chain[0].depMinute) {
        // Technically it arrived the previous night from the LAST flight of the chain
        return chain[chain.length - 1].destination;
    }

    for (let i = 0; i < chain.length; i++) {
        const leg = chain[i];
        if (timeMinute >= leg.depMinute && timeMinute < leg.arrMinute) {
            return 'airborne';
        }

        const nextLeg = chain[i + 1];
        if (timeMinute >= leg.arrMinute) {
            if (!nextLeg || timeMinute <= nextLeg.depMinute) {
                return leg.destination;
            }
        }
    }

    // Default to ending location of the final leg
    return chain[chain.length - 1].destination;
}

/**
 * Generates an array of non-overlapping timeline blocks representing a full 24h period.
 * Formatted for standard UI canvas rendering: { type, start, end, label, color }
 */
export function getAircraftRotationTimelineBlocks(aircraftId, dayOffset = 0) {
    const state = getState();
    const ac = state.fleet.find(f => f.id === aircraftId);
    if (!ac) return [];

    const blocks = [];

    if (ac.status === 'maintenance') {
        const remainingHours = Math.ceil((ac.maintenanceReleaseTime - state.clock.totalMinutes) / 60);
        blocks.push({
            type: 'maintenance',
            start: 0,
            end: 1440,
            label: `IN MAINTENANCE (${remainingHours}h left)`,
            color: 'var(--color-danger,#ef4444)'
        });
        return blocks;
    }

    const chain = buildAircraftRotationChain(aircraftId, dayOffset);
    if (chain.length === 0) {
        blocks.push({
            type: 'idle',
            start: 0,
            end: 1440,
            label: 'IDLE',
            color: 'var(--bg-surface-highlight)'
        });
        return blocks;
    }

    chain.forEach(leg => {
        const depAbs = leg.depMinute;
        const arrAbs = leg.arrMinute;
        const turnEndAbs = arrAbs + leg.turnaround;
        const fltLabel = `${leg.origin}\u2192${leg.destination}`;

        // Flight
        blocks.push({ type: 'flight', start: depAbs, end: arrAbs, label: fltLabel, color: 'var(--color-info,#3b82f6)' });
        if (arrAbs > 1440) blocks.push({ type: 'flight', start: depAbs - 1440, end: arrAbs - 1440, label: fltLabel, color: 'var(--color-info,#3b82f6)' });

        // Turnaround
        blocks.push({ type: 'turnaround', start: arrAbs, end: turnEndAbs, label: 'TURN', color: 'var(--color-warning,#f59e0b)' });
        if (turnEndAbs > 1440) blocks.push({ type: 'turnaround', start: arrAbs - 1440, end: turnEndAbs - 1440, label: 'TURN', color: 'var(--color-warning,#f59e0b)' });
    });

    return blocks;
}

function formatTime(totalMins) {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
