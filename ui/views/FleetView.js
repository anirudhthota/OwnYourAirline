import { getState, formatMoney, MINUTES_PER_DAY } from '../../engine/state.js';
import { AIRCRAFT_TYPES, getAircraftByType, LEASE_DEPOSIT_MONTHS, MAINTENANCE_RULES } from '../../data/aircraft.js';
import { getDistanceBetweenAirports } from '../../data/airports.js';
import { purchaseAircraft, leaseAircraft, sellAircraft, returnLeasedAircraft, startMaintenance, purchaseUsedAircraft, leaseUsedAircraft } from '../../engine/fleetManager.js';
import { getSchedulesByAircraft } from '../../engine/scheduler.js';
import { updateHUD } from '../hud.js';
import { formatLocation, openAircraftDetail } from '../services/uiState.js';
import { showConfirm, showModal, closeModal } from '../components/Modal.js';
import { StatCard } from '../components/StatCard.js';
import { DataTable } from '../components/DataTable.js';
import { calculateBlockTime } from '../../engine/routeEngine.js';
import { getRouteById } from '../../engine/routeEngine.js';

let selectedAircraftId = null;

export function renderFleetPanel(container) {
    const state = getState();

    container.innerHTML = `
        <div class="panel-header">
            <h2>Fleet Management</h2>
            <div>
                <button class="btn-sm" id="fleet-used-btn" style="margin-right:6px;">Used Market</button>
                <button class="btn-accent" id="fleet-buy-btn">New Aircraft</button>
            </div>
        </div>
        <div id="fleet-used-market" class="fleet-shop hidden"></div>
        <div id="fleet-shop" class="fleet-shop hidden"></div>
        <div id="fleet-dashboard-stats" class="stats-grid" style="margin-bottom: 20px;"></div>
        <div class="fleet-ops-container" style="display: flex; gap: 20px; align-items: flex-start;">
            <div id="fleet-list" class="fleet-list" style="flex: 2; overflow-x: auto;"></div>
            <div id="fleet-timeline" class="fleet-timeline-panel" style="flex: 1; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px;"></div>
        </div>
    `;

    renderFleetList();

    document.getElementById('fleet-buy-btn').addEventListener('click', () => {
        const shop = document.getElementById('fleet-shop');
        const used = document.getElementById('fleet-used-market');
        used.classList.add('hidden');
        shop.classList.toggle('hidden');
        if (!shop.classList.contains('hidden')) renderFleetShop();
    });

    document.getElementById('fleet-used-btn').addEventListener('click', () => {
        const shop = document.getElementById('fleet-shop');
        const used = document.getElementById('fleet-used-market');
        shop.classList.add('hidden');
        used.classList.toggle('hidden');
        if (!used.classList.contains('hidden')) renderUsedMarket();
    });
}

function renderFleetList() {
    const state = getState();
    const listDiv = document.getElementById('fleet-list');
    const statsDiv = document.getElementById('fleet-dashboard-stats');
    if (!listDiv || !statsDiv) return;

    if (state.fleet.length === 0) {
        listDiv.innerHTML = DataTable(
            ['Reg', 'Type', 'Status', 'Location', 'Flights', 'Utilization', 'Next Event', 'Maintenance', 'Today Profit', 'Actions'],
            '',
            '<div class="empty-state" style="padding: 40px; text-align: center;">No aircraft in fleet. Purchase or lease your first aircraft.</div>'
        );
        statsDiv.innerHTML = `
            ${StatCard('Avg Utilization', '0.0%')}
            ${StatCard('Idle Aircraft', 0)}
            ${StatCard('In Maintenance', 0)}
            ${StatCard('Maint. Due', 0)}
        `;
        renderAircraftTimeline();
        return;
    }

    let totalUtil = 0;
    let idleCount = 0;
    let maintCount = 0;
    let maintDueCount = 0;

    // Filter completions once for the whole fleet (last 24h)
    const recentFlights = state.flights.completed.filter(f => (state.clock.totalMinutes - f.arrivalTime) <= 1440);

    const rowsHtml = state.fleet.map(ac => {
        const acData = getAircraftByType(ac.type);
        const schedules = getSchedulesByAircraft(ac.id);

        // Accumulate minutes spent flying or in turnaround today
        let activeMinutes = 0;
        let flightsToday = 0;
        let nextEventLabel = 'None';
        let earliestNextTime = Infinity;

        schedules.forEach(s => {
            const route = getRouteById(s.routeId);
            if (!route) return;
            const blockTime = acData ? calculateBlockTime(route.distance, ac.type) : 0;
            s.departureTimes.forEach(t => {
                flightsToday++;
                activeMinutes += blockTime + s.turnaroundMinutes;

                const depAbs = t.hour * 60 + t.minute; // Minute of the day
                const currentMinuteOfDay = state.clock.totalMinutes % MINUTES_PER_DAY;
                let relDelay = depAbs - currentMinuteOfDay;
                if (relDelay < 0) relDelay += MINUTES_PER_DAY; // next occurrence

                if (relDelay < earliestNextTime) {
                    earliestNextTime = relDelay;
                    nextEventLabel = `FLT to ${route.destination} (in ${Math.floor(relDelay / 60)}h ${relDelay % 60}m)`;
                }
            });
        });

        // Compute Today Income
        const acFlights = recentFlights.filter(f => f.aircraftId === ac.id);
        let todayIncome = 0;
        acFlights.forEach(f => {
            const flightRev = f.revenue || 0;
            const flightCost = f.cost || 0;
            todayIncome += (flightRev - flightCost);
        });

        const utilPercent = Math.min(100, (activeMinutes / 1440) * 100);
        totalUtil += utilPercent;

        if (ac.status === 'idle' || ac.status === 'available') {
            if (activeMinutes === 0) idleCount++;
        }
        if (ac.status === 'maintenance') maintCount++;
        if (ac.status === 'maintenance_due') maintDueCount++;

        let badgeHtml = '<span class="badge" style="background:var(--color-success,#22c55e);">AVAILABLE</span>';
        if (ac.status === 'in_flight') badgeHtml = '<span class="badge" style="background:var(--color-info,#3b82f6);">IN FLIGHT</span>';
        if (ac.status === 'maintenance') badgeHtml = '<span class="badge" style="background:var(--color-danger,#ef4444);">MAINTENANCE</span>';
        if (ac.status === 'maintenance_due') badgeHtml = '<span class="badge" style="background:var(--color-warning,#f59e0b); color:#fff;">MAINT DUE</span>';

        let maintAction = '';
        if (ac.status === 'maintenance_due') maintAction = `<button class="btn-sm btn-accent" data-start-maint="${ac.id}">Fix</button>`;

        let ownershipAction = ac.ownership === 'OWNED'
            ? `<button class="btn-sm btn-danger" data-sell="${ac.id}">Sell</button>`
            : `<button class="btn-sm btn-danger" data-return="${ac.id}">Return</button>`;

        const isSelected = selectedAircraftId === ac.id ? 'background: var(--bg-surface-hover); border-left: 3px solid var(--accent-color);' : 'cursor: pointer;';

        let maintenanceStatus = 'OK';
        if (ac.status === 'maintenance') {
            maintenanceStatus = 'In Progress';
        } else if (ac.status === 'maintenance_due') {
            maintenanceStatus = `<span style="color:var(--color-danger);">${ac.pendingCheckType}-Check Due</span>`;
        } else if (ac.hoursSinceACheck !== undefined) {
            const hrsToNext = Math.min(
                MAINTENANCE_RULES.A.threshold - ac.hoursSinceACheck,
                MAINTENANCE_RULES.B.threshold - ac.hoursSinceBCheck,
                MAINTENANCE_RULES.C.threshold - ac.hoursSinceCCheck
            );
            maintenanceStatus = hrsToNext < 50 ? 'Soon' : 'OK';
        }

        return `
            <tr style="${isSelected}" class="fleet-row" data-ac-id="${ac.id}">
                <td><strong>${ac.registration}</strong></td>
                <td>${ac.type}</td>
                <td>${badgeHtml}</td>
                <td>${formatLocation(ac)}</td>
                <td>${flightsToday}</td>
                <td>
                    <div style="font-size:12px; margin-bottom: 2px;">${utilPercent.toFixed(1)}%</div>
                    <div style="width:100%; height:4px; background:var(--bg-surface-highlight); border-radius:2px;">
                        <div style="width:${utilPercent}%; height:100%; background:var(--accent-color); border-radius:2px;"></div>
                    </div>
                </td>
                <td style="font-size:11px; color:var(--text-muted);">${ac.status === 'maintenance' ? 'In Maintenance' : nextEventLabel}</td>
                <td style="font-size:11px;">${maintenanceStatus}</td>
                <td style="color:${todayIncome >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}; font-family:var(--font-mono);">$${formatMoney(todayIncome)}</td>
                <td>${maintAction} ${ownershipAction}</td>
            </tr>
        `;
    }).join('');
    statsDiv.innerHTML = `
        <div style="display:flex; gap:16px; width:100%; overflow-x:auto;">
            ${StatCard('Avg Utilization', (state.fleet.length ? (totalUtil / state.fleet.length) : 0).toFixed(1) + '%')}
            ${StatCard('Idle Aircraft', idleCount)}
            ${StatCard('In Maintenance', maintCount)}
            ${StatCard('Maint. Due', maintDueCount)}
        </div>
    `;

    listDiv.innerHTML = DataTable(
        ['Reg', 'Type', 'Status', 'Location', 'Flights', 'Utilization', 'Next Event', 'Maintenance', 'Today Profit', 'Actions'],
        rowsHtml
    );

    // Wire up row selection
    listDiv.querySelectorAll('.fleet-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('button')) return; // let buttons handle themselves
            selectedAircraftId = parseInt(row.dataset.acId);
            openAircraftDetail(selectedAircraftId);
        });
    });

    listDiv.querySelectorAll('[data-sell]').forEach(btn => { /* implementation remains same but inside delegation */
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.sell);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            showConfirm('Sell Aircraft', `Sell <strong>${aircraft.type}</strong> (${aircraft.registration})?`, () => {
                if (selectedAircraftId === id) selectedAircraftId = null;
                if (sellAircraft(id)) { renderFleetList(); updateHUD(); }
            });
        });
    });

    listDiv.querySelectorAll('[data-start-maint]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.startMaint);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            showConfirm('Start Maintenance', `Start <strong>${aircraft.pendingCheckType}-Check</strong> for ${aircraft.registration}? Schedules will be unassigned.`, () => {
                if (startMaintenance(id)) { renderFleetList(); updateHUD(); }
            });
        });
    });

    listDiv.querySelectorAll('[data-return]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.return);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            showConfirm('Return Leased Aircraft', `Return leased <strong>${aircraft.type}</strong> (${aircraft.registration})?`, () => {
                if (selectedAircraftId === id) selectedAircraftId = null;
                if (returnLeasedAircraft(id)) { renderFleetList(); updateHUD(); }
            });
        });
    });

    renderAircraftTimeline();
}

function renderAircraftTimeline() {
    const timelineDiv = document.getElementById('fleet-timeline');
    if (!timelineDiv) return;

    if (!selectedAircraftId) {
        timelineDiv.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <h4>No Aircraft Selected</h4>
                <p style="color:var(--text-muted); font-size:14px; margin-top:10px;">Select an aircraft from the operations table to view its 24-hour daily utilization timeline.</p>
            </div>
        `;
        return;
    }

    const state = getState();
    const ac = state.fleet.find(f => f.id === selectedAircraftId);
    if (!ac) return;

    const acData = getAircraftByType(ac.type);
    const schedules = getSchedulesByAircraft(ac.id);

    let blocksHtml = '';

    // If fully in maintenance
    if (ac.status === 'maintenance') {
        const remainingHours = Math.ceil((ac.maintenanceReleaseTime - state.clock.totalMinutes) / 60);
        blocksHtml = `<div style="position:absolute; left:0; width:100%; height:100%; background:var(--color-danger,#ef4444); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:12px;">IN MAINTENANCE (${remainingHours}h remaining)</div>`;
    } else if (schedules.length === 0) {
        // Render 24-hour idle block for empty schedule
        blocksHtml = `<div title="IDLE" style="position:absolute; left:0; width:100%; height:100%; background:var(--bg-surface-highlight); display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:12px; font-weight:bold;">IDLE</div>`;
    } else {
        // Build flight and turnaround blocks
        schedules.forEach(s => {
            const route = getRouteById(s.routeId);
            if (!route) return;
            const blockTime = acData ? calculateBlockTime(route.distance, ac.type) : 0;
            const turnaround = s.turnaroundMinutes;

            s.departureTimes.forEach(t => {
                const depAbs = t.hour * 60 + t.minute;
                const arrAbs = depAbs + blockTime;
                const turnEndAbs = arrAbs + turnaround;

                const renderBlock = (start, end, color, label) => {
                    if (start >= 1440) return; // Completely next day
                    const clampedStart = Math.max(0, start);
                    const clampedEnd = Math.min(1440, end);
                    const widthPct = ((clampedEnd - clampedStart) / 1440) * 100;
                    const leftPct = (clampedStart / 1440) * 100;

                    if (widthPct <= 0) return;

                    const showLabel = widthPct > 10 ? label : '';
                    blocksHtml += `<div title="${label} (${Math.floor(clampedStart / 60)}:${String(clampedStart % 60).padStart(2, '0')} - ${Math.floor(clampedEnd / 60)}:${String(clampedEnd % 60).padStart(2, '0')})" style="position:absolute; left:${leftPct}%; width:${widthPct}%; height:100%; background:${color}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:9px; overflow:hidden; white-space:nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${showLabel}</div>`;
                };

                const fltLabel = `${route.origin}\u2192${route.destination}`;

                // Flight block (supports wrapping over midnight)
                renderBlock(depAbs, arrAbs, 'var(--color-info,#3b82f6)', fltLabel);
                if (arrAbs > 1440) renderBlock(depAbs - 1440, arrAbs - 1440, 'var(--color-info,#3b82f6)', fltLabel);

                // Turnaround block
                renderBlock(arrAbs, turnEndAbs, 'var(--color-warning,#f59e0b)', 'TURN');
                if (turnEndAbs > 1440) renderBlock(arrAbs - 1440, turnEndAbs - 1440, 'var(--color-warning,#f59e0b)', 'TURN');
            });
        });
    }

    // Calculate panel stats
    let activeMinutes = 0;
    let flightsToday = 0;
    schedules.forEach(s => {
        const route = getRouteById(s.routeId);
        if (!route) return;
        const blockTime = acData ? calculateBlockTime(route.distance, ac.type) : 0;
        flightsToday += s.departureTimes.length;
        activeMinutes += (blockTime + s.turnaroundMinutes) * s.departureTimes.length;
    });
    const utilPercent = Math.min(100, (activeMinutes / 1440) * 100);

    let panelMaintState = 'OK';
    if (ac.status === 'maintenance') panelMaintState = 'In Progress';
    if (ac.status === 'maintenance_due') panelMaintState = ac.pendingCheckType + '-Check Due';

    timelineDiv.innerHTML = `
        <h3 style="margin-top:0; margin-bottom:5px;">${ac.registration} <span style="font-size:14px;color:var(--text-muted);font-weight:normal;">| ${ac.type}</span></h3>
        <div style="display:flex; flex-wrap:wrap; gap:15px; font-size:13px; margin-bottom:15px; background:var(--bg-surface-highlight); padding:10px; border-radius:4px;">
            <div><span style="color:var(--text-muted);">Location:</span> <strong>${formatLocation(ac)}</strong></div>
            <div><span style="color:var(--text-muted);">Maintenance:</span> <strong>${panelMaintState}</strong></div>
            <div><span style="color:var(--text-muted);">Utilization:</span> <strong>${utilPercent.toFixed(1)}%</strong></div>
            <div><span style="color:var(--text-muted);">Flights Today:</span> <strong>${flightsToday}</strong></div>
        </div>
        
        <h4 style="margin:0 0 10px 0; font-size:14px;">24h Timeline</h4>
        <!-- Legend -->
        <div style="display:flex; gap:15px; margin-bottom:15px; font-size:11px;">
            <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px; height:12px; background:var(--color-info,#3b82f6); border-radius:2px;"></div> Flight</div>
            <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px; height:12px; background:var(--color-warning,#f59e0b); border-radius:2px;"></div> Turnaround</div>
            <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px; height:12px; background:var(--color-danger,#ef4444); border-radius:2px;"></div> Maintenance</div>
            <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px; height:12px; background:var(--bg-surface-highlight); border-radius:2px;"></div> Idle</div>
        </div>

        <!-- The Timeline Bar -->
        <div style="position:relative; width:100%; height:40px; background:var(--bg-surface-highlight); border-radius:4px; overflow:hidden; border:1px solid var(--border-color);">
            ${blocksHtml}
        </div>
        
        <!-- Time Axis -->
        <div style="display:flex; justify-content:space-between; width:100%; font-size:10px; color:var(--text-muted); margin-top:5px; font-family:var(--font-mono);">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
        </div>
    `;
}

function renderFleetShop() {
    const shopDiv = document.getElementById('fleet-shop');
    if (!shopDiv) return;

    shopDiv.innerHTML = `
        <h3>Aircraft Market</h3>
        <div class="shop-grid">
            ${AIRCRAFT_TYPES.map(ac => `
                <div class="shop-card">
                    <div class="shop-card-header">
                        <span class="shop-type">${ac.type}</span>
                        <span class="shop-category">${ac.category}</span>
                    </div>
                    <div class="shop-specs">
                        <div><span>Seats:</span> ${ac.seats}</div>
                        <div><span>Range:</span> ${ac.rangeKm.toLocaleString()} km</div>
                        <div><span>Speed:</span> ${ac.cruiseSpeedKmh} km/h</div>
                        <div><span>Fuel/hr:</span> ${ac.fuelBurnPerHour} kg</div>
                    </div>
                    <div class="shop-prices">
                        <div>Buy: $${formatMoney(ac.purchasePrice)}</div>
                        <div>Lease: $${formatMoney(ac.leaseCostPerMonth)}/mo</div>
                    </div>
                    <div class="shop-actions">
                        <button class="btn-sm btn-accent" data-buy="${ac.type}">Buy</button>
                        <button class="btn-sm btn-secondary" data-lease="${ac.type}">Lease</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    shopDiv.querySelectorAll('[data-buy]').forEach(btn => {
        btn.addEventListener('click', () => {
            const acData = getAircraftByType(btn.dataset.buy);
            if (!acData) return;
            showConfirm(
                'Purchase Aircraft',
                `<strong>${acData.type}</strong> (${acData.category})<br>` +
                `${acData.seats} seats | ${acData.rangeKm.toLocaleString()} km range<br><br>` +
                `Price: <strong>$${formatMoney(acData.purchasePrice)}</strong>`,
                () => {
                    if (purchaseAircraft(btn.dataset.buy)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });

    shopDiv.querySelectorAll('[data-lease]').forEach(btn => {
        btn.addEventListener('click', () => {
            const acData = getAircraftByType(btn.dataset.lease);
            if (!acData) return;
            const deposit = acData.leaseCostPerMonth * LEASE_DEPOSIT_MONTHS;
            showConfirm(
                'Lease Aircraft',
                `<strong>${acData.type}</strong> (${acData.category})<br>` +
                `${acData.seats} seats | ${acData.rangeKm.toLocaleString()} km range<br><br>` +
                `Lease: <strong>$${formatMoney(acData.leaseCostPerMonth)}/month</strong><br>` +
                `Deposit (${LEASE_DEPOSIT_MONTHS} months): <strong>$${formatMoney(deposit)}</strong>`,
                () => {
                    if (leaseAircraft(btn.dataset.lease)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });
}

function renderUsedMarket() {
    const state = getState();
    const usedDiv = document.getElementById('fleet-used-market');
    if (!usedDiv) return;

    const market = state.usedMarket;
    if (!market || market.listings.length === 0) {
        usedDiv.innerHTML = `
            <h3>Used Aircraft Market</h3>
            <div class="empty-state-sm">No used aircraft available. Market refreshes every 30 in-game days.</div>
        `;
        return;
    }

    const currentDay = Math.floor(state.clock.totalMinutes / MINUTES_PER_DAY);
    const daysUntilRefresh = Math.max(0, 30 - (currentDay - market.lastRefreshDay));

    usedDiv.innerHTML = `
        <h3>Used Aircraft Market</h3>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;font-family:var(--font-mono);">Refreshes in ${daysUntilRefresh} days | ${market.listings.length} aircraft available</div>
        <div class="shop-grid">
            ${market.listings.map(listing => {
        const condColor = listing.condition === 'Good' ? 'var(--accent-green)' : 'var(--accent-yellow)';
        return `
                    <div class="shop-card" ${listing.featured ? 'style="border-color:var(--accent-green);"' : ''}>
                        ${listing.featured ? '<div style="color:var(--accent-green);font-family:var(--font-mono);font-size:10px;text-transform:uppercase;margin-bottom:4px;">Featured Deal</div>' : ''}
                        <div class="shop-card-header">
                            <span class="shop-type">${listing.type}</span>
                            <span class="shop-category">${listing.category}</span>
                        </div>
                        <div class="shop-specs">
                            <div><span>Seats:</span> ${listing.seats}</div>
                            <div><span>Range:</span> ${listing.rangeKm.toLocaleString()} km</div>
                            <div><span>Age:</span> ${listing.ageYears} years</div>
                            <div><span>Hours:</span> ${listing.hoursFlown.toLocaleString()}</div>
                            <div><span>Condition:</span> <span style="color:${condColor}">${listing.condition}</span></div>
                        </div>
                        <div class="shop-prices">
                            <div>Buy: $${formatMoney(listing.price)}</div>
                            <div>Lease: $${formatMoney(listing.leasePrice)}/mo</div>
                            <div style="font-size:11px;color:var(--text-muted);">${Math.round(listing.priceMultiplier * 100)}% of new</div>
                        </div>
                        <div class="shop-actions">
                            <button class="btn-sm btn-accent" data-buy-used="${listing.id}">Buy</button>
                            <button class="btn-sm btn-secondary" data-lease-used="${listing.id}">Lease</button>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    usedDiv.querySelectorAll('[data-buy-used]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.buyUsed);
            const listing = market.listings.find(l => l.id === id);
            if (!listing) return;

            const state = getState();
            const processPurchase = (ferry) => {
                if (purchaseUsedAircraft(id, ferry)) {
                    renderUsedMarket();
                    renderFleetList();
                    updateHUD();
                }
            };

            const baseMsg = `<strong>${listing.type}</strong> (${listing.category})<br>` +
                `${listing.seats} seats | ${listing.rangeKm.toLocaleString()} km range<br>` +
                `${listing.ageYears} years old | ${listing.hoursFlown.toLocaleString()} hrs | ${listing.condition}<br><br>` +
                `Price: <strong>$${formatMoney(listing.price)}</strong> (${Math.round(listing.priceMultiplier * 100)}% of new)<br>` +
                `Location: <strong>${listing.location}</strong>`;

            if (listing.location === state.config.hubAirport) {
                showConfirm('Purchase Used Aircraft', baseMsg, () => processPurchase(false));
                return;
            }

            const distance = getDistanceBetweenAirports(listing.location, state.config.hubAirport);
            const ferryCost = Math.round(distance * 2.5);

            const modalBody = showModal('Purchase Used Aircraft', `
                <p>${baseMsg}</p>
                <div style="margin: 15px 0; padding: 10px; background: rgba(255,165,0,0.1); border-left: 3px solid var(--accent-yellow); border-radius: 4px;">
                    <strong>Location Requirement</strong><br>
                    This aircraft is located at <strong>${listing.location}</strong>. Your hub is <strong>${state.config.hubAirport}</strong> (${Math.round(distance)}km away).<br>
                    You can either keep it there and create a route from ${listing.location}, or ferry it back to your hub instantly for <strong>$${formatMoney(ferryCost)}</strong>.
                </div>
                <div class="modal-actions" style="flex-direction: column; gap: 8px;">
                    <button class="btn-accent modal-ferry-btn" style="width: 100%">Buy & Ferry to Hub (+$${formatMoney(ferryCost)})</button>
                    <button class="btn-secondary modal-keep-btn" style="width: 100%">Buy & Keep at ${listing.location}</button>
                    <button class="btn-secondary modal-cancel-btn" style="width: 100%; border-color: transparent;">Cancel</button>
                </div>
            `);

            modalBody.querySelector('.modal-ferry-btn').addEventListener('click', () => { closeModal(); processPurchase(true); });
            modalBody.querySelector('.modal-keep-btn').addEventListener('click', () => { closeModal(); processPurchase(false); });
            modalBody.querySelector('.modal-cancel-btn').addEventListener('click', () => closeModal());
        });
    });

    usedDiv.querySelectorAll('[data-lease-used]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.leaseUsed);
            const listing = market.listings.find(l => l.id === id);
            if (!listing) return;

            const state = getState();
            const deposit = listing.leasePrice * LEASE_DEPOSIT_MONTHS;
            const processLease = (ferry) => {
                if (leaseUsedAircraft(id, ferry)) {
                    renderUsedMarket();
                    renderFleetList();
                    updateHUD();
                }
            };

            const baseMsg = `<strong>${listing.type}</strong> (${listing.category})<br>` +
                `${listing.seats} seats | ${listing.rangeKm.toLocaleString()} km range<br>` +
                `${listing.ageYears} years old | ${listing.hoursFlown.toLocaleString()} hrs | ${listing.condition}<br><br>` +
                `Lease: <strong>$${formatMoney(listing.leasePrice)}/month</strong><br>` +
                `Deposit (${LEASE_DEPOSIT_MONTHS} months): <strong>$${formatMoney(deposit)}</strong><br>` +
                `Location: <strong>${listing.location}</strong>`;

            if (listing.location === state.config.hubAirport) {
                showConfirm('Lease Used Aircraft', baseMsg, () => processLease(false));
                return;
            }

            const distance = getDistanceBetweenAirports(listing.location, state.config.hubAirport);
            const ferryCost = Math.round(distance * 2.5);

            const modalBody = showModal('Lease Used Aircraft', `
                <p>${baseMsg}</p>
                <div style="margin: 15px 0; padding: 10px; background: rgba(255,165,0,0.1); border-left: 3px solid var(--accent-yellow); border-radius: 4px;">
                    <strong>Location Requirement</strong><br>
                    This aircraft is located at <strong>${listing.location}</strong>. Your hub is <strong>${state.config.hubAirport}</strong> (${Math.round(distance)}km away).<br>
                    You can either keep it there and create a route from ${listing.location}, or ferry it back to your hub instantly for <strong>$${formatMoney(ferryCost)}</strong>.
                </div>
                <div class="modal-actions" style="flex-direction: column; gap: 8px;">
                    <button class="btn-accent modal-ferry-btn" style="width: 100%">Lease & Ferry to Hub (+$${formatMoney(ferryCost)})</button>
                    <button class="btn-secondary modal-keep-btn" style="width: 100%">Lease & Keep at ${listing.location}</button>
                    <button class="btn-secondary modal-cancel-btn" style="width: 100%; border-color: transparent;">Cancel</button>
                </div>
            `);

            modalBody.querySelector('.modal-ferry-btn').addEventListener('click', () => { closeModal(); processLease(true); });
            modalBody.querySelector('.modal-keep-btn').addEventListener('click', () => { closeModal(); processLease(false); });
            modalBody.querySelector('.modal-cancel-btn').addEventListener('click', () => closeModal());
        });
    });
}
