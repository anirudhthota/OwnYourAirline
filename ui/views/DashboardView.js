import { getState, formatMoney } from '../../engine/state.js';
import { getAirportByIata } from '../../data/airports.js';
import { getRouteById } from '../../engine/routeEngine.js';
import { StatCard } from '../components/StatCard.js';

export function renderDashboard(container) {
    const state = getState();
    const hub = getAirportByIata(state.config.hubAirport);
    
    const MINUTES_PER_DAY = 1440;
    const startOfDay = state.clock.totalMinutes - (state.clock.totalMinutes % MINUTES_PER_DAY);
    const todayFlights = state.flights.completed.filter(f => f.completionTime >= startOfDay);
    
    // 1. Airline Status Bar
    const cash = state.finances.cash;
    let todayRevenue = 0;
    let todayCosts = 0;
    let passengersToday = 0;
    let sumLoadFactor = 0;
    let transferPassengersToday = 0;
    
    const routeProfits = {};

    todayFlights.forEach(f => {
        todayRevenue += f.revenue;
        todayCosts += f.cost;
        passengersToday += f.passengers;
        sumLoadFactor += f.loadFactor;
        transferPassengersToday += (f.transferPassengers || 0);
        
        routeProfits[f.routeId] = (routeProfits[f.routeId] || 0) + f.profit;
    });

    const profitToday = todayRevenue - todayCosts;
    const fleetSize = state.fleet.length;
    const activeRoutes = state.routes.filter(r => r.active).length;
    const avgLoadFactor = todayFlights.length > 0 ? (sumLoadFactor / todayFlights.length) * 100 : 0;
    
    // 2. Financial Snapshot
    const avgTicketYield = passengersToday > 0 ? (todayRevenue / passengersToday) : 0;
    
    // 3. Operations Health
    const flightsToday = todayFlights.length + state.flights.active.length;
    const delayedFlights = 0; 
    const aircraftInMaintenance = state.fleet.filter(ac => ac.status === 'maintenance').length;
    const aircraftMaintenanceDue = state.fleet.filter(ac => ac.status === 'maintenance_due').length;
    const scheduleConflicts = state.log.filter(l => l.type === 'error' && l.timestamp >= startOfDay).length;

    // 4. Network Performance
    let topRouteId = null;
    let maxProfit = -Infinity;
    let worstRouteId = null;
    let minProfit = Infinity;
    
    for (const rid in routeProfits) {
        if (routeProfits[rid] > maxProfit) { maxProfit = routeProfits[rid]; topRouteId = rid; }
        if (routeProfits[rid] < minProfit) { minProfit = routeProfits[rid]; worstRouteId = rid; }
    }
    
    if (todayFlights.length === 0 && state.flights.completed.length > 0) {
        state.flights.completed.forEach(f => {
            routeProfits[f.routeId] = (routeProfits[f.routeId] || 0) + f.profit;
        });
        for (const rid in routeProfits) {
            if (routeProfits[rid] > maxProfit) { maxProfit = routeProfits[rid]; topRouteId = rid; }
            if (routeProfits[rid] < minProfit) { minProfit = routeProfits[rid]; worstRouteId = rid; }
        }
    }

    const topRouteRender = topRouteId ? (() => {
        const r = getRouteById(parseInt(topRouteId));
        return r ? `${r.origin} \u2192 ${r.destination}` : 'None';
    })() : 'None';
    
    const worstRouteRender = worstRouteId ? (() => {
        const r = getRouteById(parseInt(worstRouteId));
        return r ? `${r.origin} \u2192 ${r.destination}` : 'None';
    })() : 'None';

    const hubConnectivityScore = state.routes.length > 0 ? "100%" : "0%";

    // 5. Alerts & Events
    const recentAlerts = state.log.filter(l => l.type === 'error' || l.type === 'warning').slice(-5).reverse();
    
    const formatLogTime = (totalMinutes) => {
        const w = Math.floor(totalMinutes / (1440 * 7)) + 1;
        const d = Math.floor((totalMinutes % (1440 * 7)) / 1440) + 1;
        const hh = Math.floor((totalMinutes % 1440) / 60);
        const mm = Math.floor(totalMinutes % 60);
        return `W${w}-D${d} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    };

    container.innerHTML = `
        <div class="panel-header">
            <h2>Operations Control Center</h2>
            <div class="panel-header-subtitle" style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">Hub: ${state.config.hubAirport} (${hub ? hub.city : 'Unknown'})</div>
        </div>

        <h3 class="section-title">1. Airline Status Bar</h3>
        <div class="dashboard-grid">
            ${StatCard('Cash', '$' + formatMoney(cash), '', cash < 0)}
            ${StatCard('Daily Profit', '$' + formatMoney(profitToday), '', profitToday < 0)}
            ${StatCard('Fleet Size', fleetSize)}
            ${StatCard('Active Routes', activeRoutes)}
            ${StatCard('Passengers Today', passengersToday.toLocaleString())}
            ${StatCard('Avg Load Factor', avgLoadFactor.toFixed(1) + '%')}
        </div>

        <h3 class="section-title">2. Financial Snapshot</h3>
        <div class="dashboard-grid">
            ${StatCard('Revenue Today', '$' + formatMoney(todayRevenue))}
            ${StatCard('Costs Today', '$' + formatMoney(todayCosts))}
            ${StatCard('Net Profit Today', '$' + formatMoney(profitToday), '', profitToday < 0)}
            ${StatCard('Avg Ticket Yield', '$' + avgTicketYield.toFixed(2))}
        </div>

        <h3 class="section-title">3. Operations Health</h3>
        <div class="dashboard-grid">
            ${StatCard('Flights Today', flightsToday)}
            ${StatCard('Delayed Flights', delayedFlights)}
            ${StatCard('Maintenance (Active)', aircraftInMaintenance, '', aircraftInMaintenance > 0)}
            ${StatCard('Maintenance (Due)', aircraftMaintenanceDue, '', aircraftMaintenanceDue > 0)}
            ${StatCard('Schedule Conflicts', scheduleConflicts, '', scheduleConflicts > 0)}
        </div>

        <h3 class="section-title">4. Network Performance</h3>
        <div class="dashboard-grid">
            ${StatCard('Transfer Pax Today', transferPassengersToday.toLocaleString())}
            ${StatCard('Top Route', topRouteRender, topRouteId ? '+$' + formatMoney(maxProfit) : '')}
            ${StatCard('Worst Route', worstRouteRender, worstRouteId ? (minProfit < 0 ? '-$' + formatMoney(Math.abs(minProfit)) : '+$' + formatMoney(minProfit)) : '', minProfit < 0)}
            ${StatCard('Hub Connectivity', hubConnectivityScore)}
        </div>

        <h3 class="section-title">5. Alerts & Events</h3>
        <div class="alerts-container" style="background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 4px; padding: 12px; margin-bottom: 24px;">
            ${recentAlerts.length === 0 ? '<div class="empty-state-sm" style="border: none; padding: 12px 0;">No recent alerts or warnings.</div>' : ''}
            ${recentAlerts.map(a => `
                <div style="display: flex; gap: 12px; margin-bottom: 8px; font-size: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-family: var(--font-mono); white-space: nowrap;">${formatLogTime(a.timestamp)}</span>
                    <span style="color: ${a.type === 'error' ? 'var(--danger-color)' : 'var(--warning-color)'}; font-weight: bold;">[${a.type.toUpperCase()}]</span>
                    <span>${a.message}</span>
                </div>
            `).join('')}
        </div>
    `;
}
