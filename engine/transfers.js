import { getState, getGameTime } from './state.js';
import { getAirportByIata, getDistanceBetweenAirports } from '../data/airports.js';
import { calculateRouteDemand } from './routeEngine.js';

export const TRANSFER_RULES = {
    penalty: 0.4,
    competitorDirectPenalty: 0.15,
    minimumConnectionTime: 45 // minutes
};

export function recalculateTransferDemand() {
    const state = getState();
    const currentDay = Math.floor(state.clock.totalMinutes / 1440);
    
    // Only calculate once per day
    if (state.transfers.lastCalculatedDay === currentDay) return;
    state.transfers.lastCalculatedDay = currentDay;
    state.transfers.flowRates = {};

    const hub = state.config.hubAirport;

    // Identify active inbound and outbound routes
    const inboundRoutes = state.routes.filter(r => r.active && r.destination === hub && r.origin !== hub);
    const outboundRoutes = state.routes.filter(r => r.active && r.origin === hub && r.destination !== hub);

    // AI routes for competitor checks
    const aiRoutes = state.ai.routes || [];

    for (const inRoute of inboundRoutes) {
        for (const outRoute of outboundRoutes) {
            const originCode = inRoute.origin;
            const destCode = outRoute.destination;

            if (originCode === destCode) continue; // No looping back

            const cacheKey = `${originCode}-${destCode}`;
            if (state.transfers.flowRates[cacheKey]) continue; // Already calculated

            // Calculate base OD demand
            const originAirport = getAirportByIata(originCode);
            const destAirport = getAirportByIata(destCode);
            if (!originAirport || !destAirport) continue;
            
            const distance = getDistanceBetweenAirports(originCode, destCode);
            let baseDemand = calculateRouteDemand(originAirport, destAirport, distance);
            let transferDemand = baseDemand * TRANSFER_RULES.penalty;

            // Check competitor direct route
            const competitorDirect = aiRoutes.some(ar => 
                (ar.origin === originCode && ar.destination === destCode) ||
                (ar.origin === destCode && ar.destination === originCode)
            );
            
            if (competitorDirect) {
                transferDemand *= TRANSFER_RULES.competitorDirectPenalty;
            }

            transferDemand = Math.floor(transferDemand);
            if (transferDemand <= 0) continue;

            // Schedule Pairing Verification
            const inSchedules = state.schedules.filter(s => s.routeId === inRoute.id && s.aircraftId !== null);
            const outSchedules = state.schedules.filter(s => s.routeId === outRoute.id && s.aircraftId !== null);

            let earliestConnection = null;

            for (const inSched of inSchedules) {
                // Grounded maintenance fleet schedules strictly produce zero transfer capacity physically
                const inAircraft = state.fleet.find(f => f.id === inSched.aircraftId);
                if (!inAircraft || inAircraft.status === 'maintenance') continue;

                for (const inDep of inSched.departureTimes) {
                    const arrMinOfDay = (inDep.hour * 60 + inDep.minute + inSched.blockTimeMinutes) % 1440;
                    
                    for (const outSched of outSchedules) {
                        const outAircraft = state.fleet.find(f => f.id === outSched.aircraftId);
                        if (!outAircraft || outAircraft.status === 'maintenance') continue;

                        for (const outDep of outSched.departureTimes) {
                            let outDepMinOfDay = outDep.hour * 60 + outDep.minute;
                            
                            // Midnight wraparound buffer inclusion
                            if (outDepMinOfDay < arrMinOfDay + TRANSFER_RULES.minimumConnectionTime) {
                                outDepMinOfDay += 1440; // Projects precisely to the literal next calendar occurrence
                            }
                            
                            if (outDepMinOfDay >= arrMinOfDay + TRANSFER_RULES.minimumConnectionTime) {
                                if (!earliestConnection || outDepMinOfDay < earliestConnection) {
                                    earliestConnection = outDepMinOfDay;
                                }
                            }
                        }
                    }
                }
            }

            if (earliestConnection !== null) {
                state.transfers.flowRates[cacheKey] = {
                    inboundRouteId: inRoute.id,
                    outboundRouteId: outRoute.id,
                    potentialTransferDemand: transferDemand,
                    earliestValidConnection: earliestConnection
                };
            }
        }
    }
}
