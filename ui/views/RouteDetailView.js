import { getState, formatMoney } from '../../engine/state.js';
import { getAirportByIata } from '../../data/airports.js';
import { getRouteById, calculateRouteDemand } from '../../engine/routeEngine.js';
import { getSchedulesByRoute, deleteSchedule } from '../../engine/scheduler.js';
import { getAircraftByType } from '../../data/aircraft.js';
import { StatCard } from '../components/StatCard.js';
import { DataTable } from '../components/DataTable.js';
import { uiState, showPanel } from '../services/uiState.js';
import { openSwapAircraftModal } from './RoutesView.js';

export function renderRouteDetailView(container) {
    const state = getState();
    const routeId = uiState.activeRouteId;
    if (!routeId) {
        showPanel('routes');
        return;
    }

    const route = getRouteById(routeId);
    if (!route) {
        showPanel('routes');
        return;
    }

    const origin = getAirportByIata(route.origin);
    const dest = getAirportByIata(route.destination);
    const schedules = getSchedulesByRoute(routeId);

    // Cache today's flights locally in the view
    const now = state.clock.totalMinutes;
    const todayFlights = state.flights.completed.filter(f => (now - f.arrivalTime) <= 1440);
    const routeFlights = todayFlights.filter(f => f.routeId === routeId);

    const flightsToday = routeFlights.length;
    const passengersToday = routeFlights.reduce((sum, f) => sum + f.passengers, 0);
    const transfersToday = routeFlights.reduce((sum, f) => sum + (f.transferPassengers || 0), 0);
    const avgLoadFactor = flightsToday > 0 ? routeFlights.reduce((sum, f) => sum + f.loadFactor, 0) / flightsToday : 0;

    // Revenue and costs
    const revenueToday = routeFlights.reduce((sum, f) => sum + (f.revenue || 0), 0);
    const costToday = routeFlights.reduce((sum, f) => sum + (f.cost || 0), 0);
    const profitToday = revenueToday - costToday;
    const profitPerFlight = flightsToday > 0 ? profitToday / flightsToday : 0;
    const profitPerPassenger = passengersToday > 0 ? profitToday / passengersToday : 0;

    // Capacity & Demand
    const localDemand = calculateRouteDemand(route);
    const transferDemandMap = state.transfers.flowRates[`${route.origin}-${route.destination}`];
    const transferDemand = transferDemandMap ? transferDemandMap.demand : 0;
    const totalDemand = localDemand + transferDemand;

    // Calculate Seats Today (Flown)
    const seatsToday = routeFlights.reduce((sum, f) => {
        const ac = state.fleet.find(a => a.id === f.aircraftId);
        if (ac) {
            const acData = getAircraftByType(ac.type);
            return sum + (acData ? acData.seats : 0);
        }
        return sum;
    }, 0);

    // Calculate Projected Seats Offered & Spill
    const seatsOffered = schedules.reduce((sum, s) => {
        const ac = state.fleet.find(a => a.id === s.aircraftId);
        const acData = ac ? getAircraftByType(ac.type) : null;
        return sum + (acData ? acData.seats * s.departureTimes.length : 0);
    }, 0);

    const projectedLF = seatsOffered > 0 ? Math.min(totalDemand / seatsOffered, 1) : 0;
    const spill = Math.max(totalDemand - seatsOffered, 0);
    const dailySpill = Math.max(totalDemand - seatsToday, 0); // "unserved demand" today

    // 1. Route Header
    const activeHtml = route.active
        ? '<span style="color:var(--color-success,#22c55e);">Active</span>'
        : '<span style="color:var(--color-danger,#ef4444);">Inactive</span>';

    const headerHtml = `
        <div class="route-detail-header" style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
            <div>
                <h1 style="margin:0 0 4px 0;">${route.origin} → ${route.destination}</h1>
                <div style="color:var(--text-muted); font-size: 14px;">
                    Distance: ${Math.round(route.distance).toLocaleString()} km | ID: ${route.id} | Base Fare: $${Math.round(route.baseFare)} | Status: ${activeHtml}
                </div>
            </div>
            <div style="display:flex; gap: 8px;">
                <button class="btn-primary" id="rd-add-schedule">Add Schedule</button>
                <button class="btn-secondary" id="rd-swap-aircraft">Swap Aircraft</button>
                <button class="btn-danger" id="rd-deactivate">${route.active ? 'Deactivate Route' : 'Activate Route'}</button>
                <button class="btn-secondary" id="rd-back">Back to Routes</button>
            </div>
        </div>
    `;

    // 2. Health Strip
    const healthStripHtml = `
        <div class="dashboard-grid" style="margin-bottom: 24px; display:grid; grid-template-columns: repeat(3, 1fr) !important;">
            ${StatCard('Passengers Today', passengersToday.toLocaleString())}
            ${StatCard('Transfers Today', transfersToday.toLocaleString())}
            ${StatCard('Average Load Factor', (avgLoadFactor * 100).toFixed(1) + '%')}
            ${StatCard('Seats Flown Today', seatsToday.toLocaleString())}
            ${StatCard('Flights Today', flightsToday.toLocaleString())}
            ${StatCard('Daily Spill', dailySpill.toLocaleString(), 'Unserved local+transfer demand today')}
        </div>
    `;

    // 3. Schedule & Aircraft Table
    const headers = ['Flight', 'Aircraft', 'Type', 'Departure', 'Arrival', 'Seats', 'Load Factor', 'Transfers', 'Status', 'Actions'];
    let schedRows = schedules.flatMap(s => {
        const ac = state.fleet.find(a => a.id === s.aircraftId);
        const acData = ac ? getAircraftByType(ac.type) : null;
        const typeStr = ac ? ac.type : 'Unknown';
        const regStr = ac ? ac.registration : 'Unassigned';
        const seatsStr = acData ? acData.seats : '0';

        let statusHtml = '<span class="badge" style="background:var(--color-success,#22c55e);color:#fff">Active</span>';
        if (!ac) {
            statusHtml = '<span class="badge" style="background:var(--color-warning,#f59e0b);color:#fff">Unassigned</span>';
        } else if (ac.status === 'maintenance') {
            statusHtml = '<span class="badge" style="background:var(--color-danger,#ef4444);color:#fff">Maintenance</span>';
        }

        return s.departureTimes.map((t, i) => {
            const flightNumber = (s.flightNumbers && s.flightNumbers[i]) ? s.flightNumbers[i] : `${state.config.iataCode}${s.id}x${i}`;
            const arrTotal = t.hour * 60 + t.minute + Math.round(route.distance / (acData ? acData.speedKmh : 800) * 60);
            const arrH = Math.floor(arrTotal / 60) % 24;
            const arrM = arrTotal % 60;
            const depStr = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
            const arrStr = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

            const recentF = routeFlights.find(f => f.flightNumber === flightNumber) || { loadFactor: 0, transferPassengers: 0 };

            return `
                <tr>
                    <td>${flightNumber}</td>
                    <td>${regStr}</td>
                    <td>${typeStr}</td>
                    <td>${depStr}</td>
                    <td>${arrStr}</td>
                    <td>${seatsStr}</td>
                    <td>${(recentF.loadFactor * 100).toFixed(0)}%</td>
                    <td>${recentF.transferPassengers || 0}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="btn-sm js-edit-sched" data-sched-id="${s.id}">Edit Schedule</button>
                        <button class="btn-sm js-swap-btn" data-route-id="${route.id}">Swap Aircraft</button>
                        <button class="btn-sm btn-danger js-del-sched" data-sched-id="${s.id}">Delete Schedule</button>
                    </td>
                </tr>
            `;
        });
    }).join('');

    let schedTableHtml = DataTable(headers, schedRows, `
        <div class="empty-state">
            <div>No schedules configured for this route.</div>
            <button class="btn-primary" style="margin-top: 12px;" onclick="document.getElementById('rd-add-schedule').click()">Add Schedule</button>
        </div>
    `);

    // 4. Capacity Analysis
    const capacityHtml = `
        <h2 class="uc-section-title">Capacity Analysis</h2>
        <div class="dashboard-grid" style="margin-bottom: 24px; display:grid; grid-template-columns: repeat(3, 1fr) !important;">
            ${StatCard('Local Demand', localDemand.toLocaleString() + ' pax/day')}
            ${StatCard('Transfer Demand', Math.floor(transferDemand).toLocaleString() + ' pax/day')}
            ${StatCard('Total Demand', totalDemand.toLocaleString() + ' pax/day')}
            ${StatCard('Seats Offered', seatsOffered.toLocaleString() + ' seats/day')}
            ${StatCard('Projected Load Factor', (projectedLF * 100).toFixed(1) + '%')}
            ${StatCard('Projected Spill', spill.toLocaleString() + ' unserved/day')}
        </div>
    `;

    // 5. Economics
    const economicsHtml = `
        <h2 class="uc-section-title">Route Economics (Last 24h)</h2>
        <div class="dashboard-grid" style="margin-bottom: 24px;">
            ${StatCard('Revenue Today', '$' + formatMoney(revenueToday))}
            ${StatCard('Costs Today', '$' + formatMoney(costToday))}
            ${StatCard('Profit Today', '$' + formatMoney(profitToday), '', profitToday < 0)}
            ${StatCard('Profit per Flight', '$' + formatMoney(profitPerFlight), '', profitPerFlight < 0)}
            ${StatCard('Profit per Pax', '$' + formatMoney(profitPerPassenger), '', profitPerPassenger < 0)}
        </div>
    `;

    // 6. Future Placeholders
    const placeholderHtml = `
        <h2 class="uc-section-title" style="color:var(--text-muted)">Advanced Route Management (Future)</h2>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr) !important; gap: 16px; margin-bottom: 24px; opacity: 0.5; pointer-events: none;">
            <div class="dash-card">Route Pricing <br><small>Unlock advanced revenue management</small></div>
            <div class="dash-card">Competitor Analysis <br><small>View rival schedules and fares</small></div>
            <div class="dash-card">Slot Constraints <br><small>Manage premium airport access</small></div>
        </div>
    `;

    container.innerHTML = `
        <div class="route-detail-container">
            ${headerHtml}
            ${healthStripHtml}
            <h2 class="uc-section-title">Schedules & Aircraft</h2>
            ${schedTableHtml}
            ${capacityHtml}
            ${economicsHtml}
            ${placeholderHtml}
        </div>
    `;

    // Event Listeners
    container.querySelector('#rd-back').addEventListener('click', () => {
        showPanel('routes');
    });

    container.querySelector('#rd-deactivate').addEventListener('click', () => {
        route.active = !route.active;
        renderRouteDetailView(container);
    });

    const triggerSwap = () => { openSwapAircraftModal(routeId); };
    container.querySelector('#rd-swap-aircraft').addEventListener('click', triggerSwap);

    container.querySelectorAll('.js-swap-btn').forEach(btn => {
        btn.addEventListener('click', triggerSwap);
    });

    // Add Schedule Button (Fallback placeholder)
    container.querySelector('#rd-add-schedule').addEventListener('click', () => {
        alert("Scheduling currently managed via Route Creator in the main Routes view.");
    });

    // Row actions
    container.querySelectorAll('.js-edit-sched').forEach(btn => {
        btn.addEventListener('click', () => {
            alert("Schedule Editing to be implemented in Phase 3.");
        });
    });

    container.querySelectorAll('.js-del-sched').forEach(btn => {
        btn.addEventListener('click', () => {
            const sid = parseInt(btn.dataset.schedId);
            if (confirm("Are you sure you want to delete this schedule?")) {
                deleteSchedule(sid);
                renderRouteDetailView(container);
            }
        });
    });

    // Handle Unassigned Aircraft state on the header button
    const hasUnassigned = schedules.some(s => !state.fleet.find(a => a.id === s.aircraftId));
    if (hasUnassigned && schedules.length > 0) {
        const swapBtn = container.querySelector('#rd-swap-aircraft');
        if (swapBtn) {
            swapBtn.innerHTML = 'Assign Aircraft';
            swapBtn.className = 'btn-primary';
        }
    }
}
