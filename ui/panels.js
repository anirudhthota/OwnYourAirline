import { getState, formatMoney, formatGameTimestamp } from '../engine/state.js';
import { AIRCRAFT_TYPES, getAircraftByType, LEASE_DEPOSIT_MONTHS } from '../data/aircraft.js';
import { AIRPORTS, getAirportByIata, getDistanceBetweenAirports, getSlotControlLevel, SLOT_CONTROL_LEVELS, getSlotCost } from '../data/airports.js';
import { purchaseAircraft, leaseAircraft, sellAircraft, returnLeasedAircraft, OWNERSHIP_TYPE, getFleetSummary, getAircraftNextFree, purchaseUsedAircraft, leaseUsedAircraft, startMaintenance } from '../engine/fleetManager.js';
import { getGameTime, MINUTES_PER_DAY, MINUTES_PER_HOUR } from '../engine/state.js';
import { createRoute, deleteRoute, calculateBlockTime, calculateBaseFare, calculateFlightCost, canAircraftFlyRoute, getRouteById, getTotalDailySeatsOnRoute, calculateLoadFactor } from '../engine/routeEngine.js';
import { createSchedule, deleteSchedule, SCHEDULE_MODE, createBank, deleteBank, getSchedulesByRoute, getSchedulesByAircraft, calculateMinAircraft, validateScheduleParams, updateSchedule, swapAircraftOnRoute, getProjectedLocation, generateFlightNumbers, getAllUsedFlightNumbers } from '../engine/scheduler.js';
import { getTurnaroundTime } from '../data/aircraft.js';
import { getAICompetitorsOnRoute } from '../engine/aiEngine.js';
import { getSlotUsageForAirport } from '../engine/sim.js';
import { updateHUD } from './hud.js';
import { renderMap } from './map.js';
import { showConfirm, showModal, closeModal } from './modals.js';

function formatLocation(ac) {
    if (!ac.currentLocation) return '';
    if (ac.currentLocation.startsWith('airborne:')) {
        return `Airborne: ${ac.currentLocation.slice(9)}`;
    }
    return `At ${ac.currentLocation}`;
}

export function initSideNav() {
    const nav = document.getElementById('side-nav');
    if (!nav) return;

    const panels = [
        { id: 'dashboard', label: 'Dashboard', icon: '◈' },
        { id: 'fleet', label: 'Fleet', icon: '✈' },
        { id: 'routes', label: 'Routes', icon: '⟿' },
        { id: 'schedule', label: 'Schedule', icon: '◷' },
        { id: 'finances', label: 'Finances', icon: '$' },
        { id: 'log', label: 'Log', icon: '☰' }
    ];

    nav.innerHTML = panels.map(p => `
        <button class="nav-btn ${p.id === 'dashboard' ? 'active' : ''}" data-panel="${p.id}">
            <span class="nav-icon">${p.icon}</span>
            <span class="nav-label">${p.label}</span>
        </button>
    `).join('');

    nav.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            nav.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showPanel(btn.dataset.panel);
        });
    });
}

export function showPanel(panelId) {
    const state = getState();
    if (state) state.ui.selectedPanel = panelId;

    const content = document.getElementById('panel-content');
    if (!content) return;

    switch (panelId) {
        case 'dashboard': renderDashboard(content); break;
        case 'fleet': renderFleetPanel(content); break;
        case 'routes': renderRoutesPanel(content); break;
        case 'schedule': renderSchedulePanel(content); break;
        case 'finances': renderFinancesPanel(content); break;
        case 'log': renderLogPanel(content); break;
    }
}

function renderDashboard(container) {
    const state = getState();
    const hub = getAirportByIata(state.config.hubAirport);

    container.innerHTML = `
        <div class="panel-header"><h2>Dashboard</h2></div>
        <div class="dashboard-grid">
            <div class="dash-card">
                <div class="dash-card-label">Hub</div>
                <div class="dash-card-value">${state.config.hubAirport}</div>
                <div class="dash-card-sub">${hub ? hub.city + ', ' + hub.country : ''}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Cash Balance</div>
                <div class="dash-card-value ${state.finances.cash < 0 ? 'negative' : ''}">$${formatMoney(state.finances.cash)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Fleet Size</div>
                <div class="dash-card-value">${state.fleet.length}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Active Routes</div>
                <div class="dash-card-value">${state.routes.filter(r => r.active).length}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Active Flights</div>
                <div class="dash-card-value">${state.flights.active.length}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Completed Flights</div>
                <div class="dash-card-value">${state.flights.completed.length}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Transfers Carried</div>
                <div class="dash-card-value">${state.flights.completed.reduce((a, b) => a + (b.transferPassengers || 0), 0).toLocaleString()}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Total Revenue</div>
                <div class="dash-card-value">$${formatMoney(state.finances.totalRevenue)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Total Costs</div>
                <div class="dash-card-value">$${formatMoney(state.finances.totalCosts)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Reputation</div>
                <div class="dash-card-value">${state.reputation}/100</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Difficulty</div>
                <div class="dash-card-value">${state.config.difficulty}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">AI Airlines</div>
                <div class="dash-card-value">${state.ai.airlines.length}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">AI Routes</div>
                <div class="dash-card-value">${state.ai.routes.length}</div>
            </div>
        </div>
    `;
}

function renderFleetPanel(container) {
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
        <div id="fleet-list" class="fleet-list"></div>
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
    if (!listDiv) return;

    if (state.fleet.length === 0) {
        listDiv.innerHTML = '<div class="empty-state">No aircraft in fleet. Purchase or lease your first aircraft.</div>';
        return;
    }

    listDiv.innerHTML = state.fleet.map(ac => {
        const acData = getAircraftByType(ac.type);
        const schedules = getSchedulesByAircraft(ac.id);
        return `
            <div class="fleet-card">
                <div class="fleet-card-header">
                    <span class="fleet-reg" data-reg-display="${ac.id}">${ac.registration}</span>
                    <button class="fleet-rename-btn" data-rename="${ac.id}" title="Rename tail number">\u270E</button>
                    <span class="fleet-type">${ac.type}</span>
                    <span class="fleet-status status-${ac.status}">${
                        ac.status === 'in_flight' ? 'BUSY' :
                        ac.status === 'maintenance_due' ? 'AVAILABLE' :
                        ac.status.toUpperCase()
                    }</span>
                    <span class="fleet-location">${formatLocation(ac)}</span>
                </div>
                <div class="fleet-card-details">
                    <span>${acData ? acData.seats + ' seats' : ''}</span>
                    <span>${acData ? acData.rangeKm.toLocaleString() + ' km range' : ''}</span>
                    <span>${ac.ownership}</span>
                    <span>${Math.round(ac.totalFlightHours)} flight hrs</span>
                    <span>${schedules.length} schedule(s)</span>
                </div>
                ${ac.status === 'maintenance_due' ? 
                    `<div class="fleet-maintenance-warning" style="color: #ff9800; font-weight: bold; margin-bottom: 8px;">
                        ${ac.pendingCheckType || 'Unknown'}-Check Due \u2013 ${Math.ceil(ac.graceHoursRemaining || 0)}h Grace Remaining
                    </div>` : ''}
                ${ac.status === 'maintenance' ? 
                    `<div class="fleet-maintenance-critical" style="color: #f44336; font-weight: bold; margin-bottom: 8px;">
                        Under Maintenance${ac.maintenanceReleaseTime ? ' \u2013 ' + Math.ceil((ac.maintenanceReleaseTime - state.clock.totalMinutes) / 60) + 'h remaining' : ''}
                    </div>` : ''}
                <div class="fleet-card-actions">
                    ${ac.status === 'maintenance_due' ? 
                        `<button class="btn-sm btn-accent" data-start-maint="${ac.id}">Perform Maintenance</button>` : ''}
                    ${ac.ownership === 'OWNED'
                        ? `<button class="btn-sm btn-danger" data-sell="${ac.id}">Sell</button>`
                        : `<button class="btn-sm btn-danger" data-return="${ac.id}">Return Lease</button>`
                    }
                </div>
            </div>
        `;
    }).join('');

    listDiv.querySelectorAll('[data-rename]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.rename);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            const regSpan = listDiv.querySelector(`[data-reg-display="${id}"]`);
            if (!regSpan) return;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'fleet-rename-input';
            input.value = aircraft.registration;
            input.maxLength = 8;

            regSpan.replaceWith(input);
            input.focus();
            input.select();
            btn.style.display = 'none';

            function commitRename() {
                const newReg = input.value.trim().toUpperCase();
                if (newReg && newReg.length <= 8) {
                    aircraft.registration = newReg;
                }
                renderFleetList();
            }

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') renderFleetList();
            });
            input.addEventListener('blur', commitRename);
        });
    });

    listDiv.querySelectorAll('[data-sell]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.sell);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            showConfirm(
                'Sell Aircraft',
                `Sell <strong>${aircraft.type}</strong> (${aircraft.registration})?<br>You will receive the depreciated sale value.`,
                () => {
                    if (sellAircraft(id)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });

    listDiv.querySelectorAll('[data-start-maint]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.startMaint);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            
            showConfirm(
                'Start Maintenance',
                `Are you sure you want to perform the <strong>${aircraft.pendingCheckType}-Check</strong> for ${aircraft.registration}?<br>Active schedules will be unassigned.`,
                () => {
                    if (startMaintenance(id)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });

    listDiv.querySelectorAll('[data-return]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.return);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            showConfirm(
                'Return Leased Aircraft',
                `Return leased <strong>${aircraft.type}</strong> (${aircraft.registration})?<br>The deposit will not be refunded.`,
                () => {
                    if (returnLeasedAircraft(id)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });
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

function renderRoutesPanel(container) {
    const state = getState();

    container.innerHTML = `
        <div class="panel-header">
            <h2>Route Network</h2>
            <div>
                <button class="btn-sm" id="route-airports-btn" style="margin-right:6px;">Airports</button>
                <button class="btn-accent" id="route-create-btn">Create Route</button>
            </div>
        </div>
        <div id="route-creator" class="route-creator hidden"></div>
        <div id="route-airports-panel" class="hidden" style="margin-bottom:16px;"></div>
        <div id="route-list" class="route-list"></div>
    `;

    renderRouteList();

    document.getElementById('route-create-btn').addEventListener('click', () => {
        const creator = document.getElementById('route-creator');
        creator.classList.toggle('hidden');
        if (!creator.classList.contains('hidden')) renderRouteCreator();
    });

    document.getElementById('route-airports-btn').addEventListener('click', () => {
        const panel = document.getElementById('route-airports-panel');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) renderAirportsSubPanel();
    });
}

function renderAirportsSubPanel() {
    const state = getState();
    const panel = document.getElementById('route-airports-panel');
    if (!panel) return;

    // Gather all airports the player operates at
    const airportSet = new Set();
    airportSet.add(state.config.hubAirport);
    for (const route of state.routes) {
        if (route.active) {
            airportSet.add(route.origin);
            airportSet.add(route.destination);
        }
    }

    const airportData = [];
    for (const iata of airportSet) {
        const ap = getAirportByIata(iata);
        if (!ap) continue;
        const level = getSlotControlLevel(iata);
        const levelInfo = SLOT_CONTROL_LEVELS[level];
        const playerRoutes = state.routes.filter(r => r.active && (r.origin === iata || r.destination === iata));
        const playerSchedules = state.schedules.filter(s => {
            const route = getRouteById(s.routeId);
            return route && route.active && (route.origin === iata || route.destination === iata);
        });
        const dailyDeps = playerSchedules.reduce((sum, s) => {
            const route = getRouteById(s.routeId);
            if (route && route.origin === iata) return sum + s.departureTimes.length;
            return sum;
        }, 0);
        const dailyArrs = playerSchedules.reduce((sum, s) => {
            const route = getRouteById(s.routeId);
            if (route && route.destination === iata) return sum + s.departureTimes.length;
            return sum;
        }, 0);

        const slotUsage = getSlotUsageForAirport(iata);
        const isHub = iata === state.config.hubAirport;

        airportData.push({ iata, ap, level, levelInfo, playerRoutes, dailyDeps, dailyArrs, slotUsage, isHub, slotsPerHour: ap.slotsPerHour });
    }

    airportData.sort((a, b) => b.level - a.level || b.playerRoutes.length - a.playerRoutes.length);

    panel.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:6px;padding:14px;">
            <h3 class="section-title" style="margin-top:0;">Airports (${airportData.length})</h3>
            ${airportData.map(d => {
                const levelColor = d.level >= 4 ? 'var(--accent-red)' : d.level === 3 ? 'var(--accent-yellow)' : 'var(--accent-green)';
                const peakUsage = Object.values(d.slotUsage).length > 0 ? Math.max(...Object.values(d.slotUsage)) : 0;
                const availPct = d.slotsPerHour > 0 ? Math.round((1 - peakUsage / d.slotsPerHour) * 100) : 100;
                return `
                    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px;">
                        <span style="font-family:var(--font-mono);font-weight:700;color:var(--accent-blue);min-width:36px;">${d.iata}</span>
                        <span style="color:${levelColor};font-family:var(--font-mono);font-size:11px;min-width:80px;">L${d.level} ${d.levelInfo.name}</span>
                        <span style="color:var(--text-secondary);min-width:70px;">${d.dailyDeps} dep/${d.dailyArrs} arr</span>
                        <span style="color:var(--text-muted);min-width:80px;">${d.slotsPerHour} slots/hr</span>
                        ${d.level >= 4 ? `<span style="color:${availPct < 20 ? 'var(--accent-red)' : 'var(--accent-yellow)'};font-family:var(--font-mono);font-size:11px;">${availPct}% avail</span>` : ''}
                        ${d.isHub ? '<span style="color:var(--accent-blue);font-family:var(--font-mono);font-size:10px;background:rgba(0,170,255,0.1);padding:1px 6px;border-radius:3px;">HUB</span>' : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderRouteCreator() {
    const state = getState();
    const creator = document.getElementById('route-creator');

    const hasFleet = state.fleet.length > 0;
    const aircraftOptions = state.fleet.map(ac => {
        const statusLabel = ac.status === 'available' ? '\u2705 Available'
            : ac.status === 'maintenance' ? '\uD83D\uDD34 Maintenance'
            : '\uD83D\uDFE1 Busy';
        let nextFreeLabel = '';
        if (ac.status === 'in_flight') {
            const nextFree = getAircraftNextFree(ac.id);
            if (nextFree != null) {
                const gt = getGameTime(nextFree);
                nextFreeLabel = ` \u2014 Free at D${((gt.week - 1) * 7 + gt.day)} ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
            }
        }
        return `<option value="${ac.id}">${ac.registration} \u2014 ${ac.type} [${statusLabel}${nextFreeLabel}]</option>`;
    }).join('');

    const bankOptions = state.banks.map(b =>
        `<option value="${b.id}">${b.name} (${String(b.startTime.hour).padStart(2,'0')}:${String(b.startTime.minute).padStart(2,'0')}-${String(b.endTime.hour).padStart(2,'0')}:${String(b.endTime.minute).padStart(2,'0')})</option>`
    ).join('');

    creator.innerHTML = `
        <div class="unified-creator">
            <!-- Section 1: Route Setup -->
            <div class="uc-section">
                <h3 class="uc-section-title">1. Route Setup</h3>
                <div class="form-row">
                    <label>Origin</label>
                    <input type="text" id="rc-origin" placeholder="Search airport..." autocomplete="off" />
                    <div id="rc-origin-results" class="hub-search-results"></div>
                    <input type="hidden" id="rc-origin-iata" />
                </div>
                <div class="form-row">
                    <label>Destination</label>
                    <input type="text" id="rc-dest" placeholder="Search airport..." autocomplete="off" />
                    <div id="rc-dest-results" class="hub-search-results"></div>
                    <input type="hidden" id="rc-dest-iata" />
                </div>
                <div id="rc-info" class="route-info hidden"></div>
                <label class="mc-option" style="margin:8px 0;">
                    <input type="checkbox" id="rc-return-route" checked />
                    <span>Also create return route</span>
                </label>
            </div>

            <!-- Section 2: Outbound Schedule -->
            <div class="uc-section" id="uc-outbound-section">
                <h3 class="uc-section-title">2. Outbound Schedule</h3>
                ${!hasFleet ? '<div class="empty-state-sm">No aircraft in fleet. Add aircraft first, or skip scheduling.</div>' : `
                <label class="mc-option" style="margin:0 0 8px;">
                    <input type="checkbox" id="uc-outbound-enable" checked />
                    <span>Create outbound schedule</span>
                </label>
                <div id="uc-outbound-fields">
                    <div class="form-row">
                        <label>Aircraft</label>
                        <select id="uc-out-aircraft">
                            <option value="">Select aircraft...</option>
                            ${aircraftOptions}
                        </select>
                    </div>
                    <div id="uc-out-range-check" class="range-check hidden"></div>
                    <div id="uc-out-aircraft-warning" class="range-check hidden"></div>
                    <div class="form-row">
                        <label>Mode</label>
                        <select id="uc-out-mode">
                            <option value="CUSTOM">Custom (manual times)</option>
                            <option value="BANKED">Banked (connection wave)</option>
                        </select>
                    </div>
                    <div id="uc-out-custom-times" class="form-row">
                        <label>Departure Times</label>
                        <div id="uc-out-times-list" class="times-list"></div>
                        <div class="form-row-inline">
                            <input type="time" id="uc-out-new-time" value="08:00" />
                            <button class="btn-sm btn-accent" id="uc-out-add-time">Add Time</button>
                        </div>
                    </div>
                    <div id="uc-out-banked-opts" class="form-row hidden">
                        <label>Connection Bank</label>
                        <select id="uc-out-bank">
                            <option value="">Select bank...</option>
                            ${bankOptions}
                        </select>
                    </div>
                </div>
                `}
            </div>

            <!-- Section 3: Return Schedule -->
            <div class="uc-section" id="uc-return-section">
                <h3 class="uc-section-title">3. Return Schedule</h3>
                ${!hasFleet ? '<div class="empty-state-sm">No aircraft in fleet.</div>' : `
                <label class="mc-option" style="margin:0 0 8px;">
                    <input type="checkbox" id="uc-return-enable" checked />
                    <span>Create return schedule</span>
                </label>
                <div id="uc-return-fields">
                    <label class="mc-option" style="margin:0 0 8px;">
                        <input type="checkbox" id="uc-return-same-ac" checked />
                        <span>Same aircraft as outbound</span>
                    </label>
                    <div id="uc-ret-ac-row" class="form-row hidden">
                        <label>Aircraft</label>
                        <select id="uc-ret-aircraft">
                            <option value="">Select aircraft...</option>
                            ${aircraftOptions}
                        </select>
                    </div>
                    <div id="uc-ret-range-check" class="range-check hidden"></div>
                    <div id="uc-ret-aircraft-warning" class="range-check hidden"></div>
                    <div class="form-row">
                        <label>Mode</label>
                        <select id="uc-ret-mode">
                            <option value="CUSTOM">Custom (manual times)</option>
                            <option value="BANKED">Banked (connection wave)</option>
                        </select>
                    </div>
                    <div id="uc-ret-custom-times" class="form-row">
                        <label>Departure Times</label>
                        <div id="uc-ret-times-list" class="times-list"></div>
                        <div class="form-row-inline">
                            <input type="time" id="uc-ret-new-time" value="14:00" />
                            <button class="btn-sm btn-accent" id="uc-ret-add-time">Add Time</button>
                        </div>
                    </div>
                    <div id="uc-ret-banked-opts" class="form-row hidden">
                        <label>Connection Bank</label>
                        <select id="uc-ret-bank">
                            <option value="">Select bank...</option>
                            ${bankOptions}
                        </select>
                    </div>
                </div>
                `}
            </div>

            <!-- Section 4: Flight Numbers -->
            <div class="uc-section" id="uc-flight-numbers-section">
                <h3 class="uc-section-title">4. Flight Numbers</h3>
                <div id="uc-fn-list" class="uc-fn-list">
                    <div class="empty-state-sm">Add departure times above to generate flight numbers.</div>
                </div>
            </div>

            <!-- Section 5: Validation Summary -->
            <div class="uc-section" id="uc-validation-section">
                <h3 class="uc-section-title">5. Validation Summary</h3>
                <div id="uc-validation-errors" class="validation-errors hidden"></div>
                <div id="uc-validation-ok" class="hidden"></div>
            </div>

            <div class="sched-editor-actions">
                <button class="btn-accent" id="uc-confirm">Create Route & Schedule</button>
                <button class="btn-secondary" id="uc-validate">Validate</button>
                <button class="btn-secondary" id="uc-route-only">Route Only (No Schedule)</button>
            </div>
        </div>
    `;

    // State for departure times and flight numbers
    const outboundTimes = [];
    const returnTimes = [];
    let outboundFlightNumbers = [];
    let returnFlightNumbers = [];

    setupAirportSearch('rc-origin', 'rc-origin-results', 'rc-origin-iata', onRouteInfoChange);
    setupAirportSearch('rc-dest', 'rc-dest-results', 'rc-dest-iata', onRouteInfoChange);

    // Return route checkbox toggles return section
    const returnRouteCheckbox = document.getElementById('rc-return-route');
    const returnSection = document.getElementById('uc-return-section');
    if (returnRouteCheckbox) {
        returnRouteCheckbox.addEventListener('change', () => {
            returnSection.style.display = returnRouteCheckbox.checked ? '' : 'none';
            onRouteInfoChange();
            refreshFlightNumbers();
        });
    }

    if (hasFleet) {
        // Outbound: mode toggle
        document.getElementById('uc-out-mode').addEventListener('change', (e) => {
            document.getElementById('uc-out-custom-times').classList.toggle('hidden', e.target.value !== 'CUSTOM');
            document.getElementById('uc-out-banked-opts').classList.toggle('hidden', e.target.value !== 'BANKED');
        });

        // Outbound: add time
        document.getElementById('uc-out-add-time').addEventListener('click', () => {
            const [h, m] = document.getElementById('uc-out-new-time').value.split(':').map(Number);
            outboundTimes.push({ hour: h, minute: m });
            outboundTimes.sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
            renderTimesListUC(outboundTimes, 'uc-out-times-list', outboundTimes);
            refreshFlightNumbers();
        });

        // Outbound: aircraft/route range check
        const outAcSelect = document.getElementById('uc-out-aircraft');
        outAcSelect.addEventListener('change', () => { checkRangeUC('out'); refreshFlightNumbers(); });

        // Outbound: enable/disable
        const outEnableCheckbox = document.getElementById('uc-outbound-enable');
        if (outEnableCheckbox) {
            outEnableCheckbox.addEventListener('change', () => {
                document.getElementById('uc-outbound-fields').style.display = outEnableCheckbox.checked ? '' : 'none';
                refreshFlightNumbers();
            });
        }

        // Return: mode toggle
        document.getElementById('uc-ret-mode').addEventListener('change', (e) => {
            document.getElementById('uc-ret-custom-times').classList.toggle('hidden', e.target.value !== 'CUSTOM');
            document.getElementById('uc-ret-banked-opts').classList.toggle('hidden', e.target.value !== 'BANKED');
        });

        // Return: add time
        document.getElementById('uc-ret-add-time').addEventListener('click', () => {
            const [h, m] = document.getElementById('uc-ret-new-time').value.split(':').map(Number);
            returnTimes.push({ hour: h, minute: m });
            returnTimes.sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
            renderTimesListUC(returnTimes, 'uc-ret-times-list', returnTimes);
            refreshFlightNumbers();
        });

        // Return: same aircraft toggle
        const sameAcCheckbox = document.getElementById('uc-return-same-ac');
        if (sameAcCheckbox) {
            sameAcCheckbox.addEventListener('change', () => {
                document.getElementById('uc-ret-ac-row').classList.toggle('hidden', sameAcCheckbox.checked);
                checkRangeUC('ret');
            });
        }

        // Return: aircraft change
        const retAcSelect = document.getElementById('uc-ret-aircraft');
        if (retAcSelect) {
            retAcSelect.addEventListener('change', () => checkRangeUC('ret'));
        }

        // Return: enable/disable
        const retEnableCheckbox = document.getElementById('uc-return-enable');
        if (retEnableCheckbox) {
            retEnableCheckbox.addEventListener('change', () => {
                document.getElementById('uc-return-fields').style.display = retEnableCheckbox.checked ? '' : 'none';
                refreshFlightNumbers();
            });
        }
    }

    function onRouteInfoChange() {
        updateRouteInfo();
        if (hasFleet) {
            checkRangeUC('out');
            checkRangeUC('ret');
        }
    }

    function getRouteDistance() {
        const origin = document.getElementById('rc-origin-iata').value;
        const dest = document.getElementById('rc-dest-iata').value;
        if (!origin || !dest) return null;
        return getDistanceBetweenAirports(origin, dest);
    }

    function checkRangeUC(direction) {
        const origin = document.getElementById('rc-origin-iata').value;
        const dest = document.getElementById('rc-dest-iata').value;
        const distance = getRouteDistance();
        if (!distance) return;

        const routeOrigin = direction === 'out' ? origin : dest;
        const acSelect = direction === 'out'
            ? document.getElementById('uc-out-aircraft')
            : (document.getElementById('uc-return-same-ac').checked
                ? document.getElementById('uc-out-aircraft')
                : document.getElementById('uc-ret-aircraft'));

        const acId = parseInt(acSelect.value);
        const rangeDiv = document.getElementById(`uc-${direction}-range-check`);
        const warnDiv = document.getElementById(`uc-${direction}-aircraft-warning`);

        if (!acId) { rangeDiv.classList.add('hidden'); warnDiv.classList.add('hidden'); return; }

        const aircraft = state.fleet.find(f => f.id === acId);
        if (!aircraft) return;

        const acData = getAircraftByType(aircraft.type);
        const can = canAircraftFlyRoute(aircraft.type, distance);
        const blockTime = calculateBlockTime(distance, aircraft.type);
        const turnaround = getTurnaroundTime(aircraft.type);
        const roundTrip = blockTime * 2 + turnaround * 2;

        rangeDiv.classList.remove('hidden');
        if (can) {
            rangeDiv.className = 'range-check ok';
            rangeDiv.textContent = `Range OK (${acData.rangeKm}km \u2265 ${Math.round(distance)}km). Block: ${Math.floor(blockTime/60)}h${blockTime%60}m, Turnaround: ${turnaround}m`;
        } else {
            rangeDiv.className = 'range-check fail';
            rangeDiv.textContent = `Out of range! ${acData.rangeKm}km < ${Math.round(distance)}km`;
        }

        // Aircraft warnings
        const warnings = [];
        if (aircraft.status === 'in_flight') {
            const nextFree = getAircraftNextFree(aircraft.id);
            if (nextFree != null) {
                const gt = getGameTime(nextFree);
                warnings.push(`${aircraft.registration} is busy until Day ${(gt.week - 1) * 7 + gt.day} ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}.`);
            }
        } else if (aircraft.status === 'maintenance') {
            warnings.push(`${aircraft.registration} is in maintenance.`);
        }
        if (aircraft.currentLocation && aircraft.currentLocation !== routeOrigin && !aircraft.currentLocation.startsWith('airborne:')) {
            warnings.push(`${aircraft.registration} is currently at ${aircraft.currentLocation}. A prior scheduled flight must deliver it to ${routeOrigin} before departure.`);
        }

        if (warnings.length > 0) {
            warnDiv.classList.remove('hidden');
            warnDiv.className = 'range-check fail';
            warnDiv.textContent = warnings.join(' | ');
        } else {
            warnDiv.classList.add('hidden');
        }
    }

    function renderTimesListUC(times, listId, timesArr) {
        const list = document.getElementById(listId);
        list.innerHTML = times.map((t, i) => `
            <span class="time-tag">${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}
                <button class="time-remove" data-idx="${i}">\u00d7</button>
            </span>
        `).join('');
        list.querySelectorAll('.time-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                timesArr.splice(parseInt(btn.dataset.idx), 1);
                renderTimesListUC(timesArr, listId, timesArr);
                refreshFlightNumbers();
            });
        });
    }

    function refreshFlightNumbers() {
        const fnDiv = document.getElementById('uc-fn-list');
        const origin = document.getElementById('rc-origin-iata').value;
        const dest = document.getElementById('rc-dest-iata').value;
        const iata = state.config.iataCode;

        const outEnabled = hasFleet && document.getElementById('uc-outbound-enable') && document.getElementById('uc-outbound-enable').checked;
        const retEnabled = hasFleet && returnRouteCheckbox.checked && document.getElementById('uc-return-enable') && document.getElementById('uc-return-enable').checked;

        const totalNeeded = (outEnabled ? outboundTimes.length : 0) + (retEnabled ? returnTimes.length : 0);
        if (totalNeeded === 0) {
            fnDiv.innerHTML = '<div class="empty-state-sm">Add departure times above to generate flight numbers.</div>';
            outboundFlightNumbers = [];
            returnFlightNumbers = [];
            return;
        }

        const allNumbers = generateFlightNumbers(totalNeeded);
        outboundFlightNumbers = outEnabled ? allNumbers.slice(0, outboundTimes.length) : [];
        returnFlightNumbers = retEnabled ? allNumbers.slice(outboundTimes.length) : [];

        let html = '';
        if (outEnabled && outboundTimes.length > 0) {
            html += `<div class="uc-fn-group"><div class="uc-fn-label">${origin || '???'} \u2192 ${dest || '???'} (Outbound)</div>`;
            outboundTimes.forEach((t, i) => {
                html += `<div class="uc-fn-row">
                    <span class="uc-fn-time">${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}</span>
                    <input type="text" class="uc-fn-input" data-dir="out" data-idx="${i}" value="${outboundFlightNumbers[i] || ''}" maxlength="8" />
                </div>`;
            });
            html += '</div>';
        }
        if (retEnabled && returnTimes.length > 0) {
            html += `<div class="uc-fn-group"><div class="uc-fn-label">${dest || '???'} \u2192 ${origin || '???'} (Return)</div>`;
            returnTimes.forEach((t, i) => {
                html += `<div class="uc-fn-row">
                    <span class="uc-fn-time">${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}</span>
                    <input type="text" class="uc-fn-input" data-dir="ret" data-idx="${i}" value="${returnFlightNumbers[i] || ''}" maxlength="8" />
                </div>`;
            });
            html += '</div>';
        }
        fnDiv.innerHTML = html;

        // Listen for manual edits
        fnDiv.querySelectorAll('.uc-fn-input').forEach(inp => {
            inp.addEventListener('change', () => {
                const dir = inp.dataset.dir;
                const idx = parseInt(inp.dataset.idx);
                if (dir === 'out') outboundFlightNumbers[idx] = inp.value.trim();
                else returnFlightNumbers[idx] = inp.value.trim();
            });
        });
    }

    function gatherAllValues() {
        const origin = document.getElementById('rc-origin-iata').value;
        const dest = document.getElementById('rc-dest-iata').value;
        const wantsReturn = returnRouteCheckbox.checked;

        const outEnabled = hasFleet && document.getElementById('uc-outbound-enable') && document.getElementById('uc-outbound-enable').checked;
        const retEnabled = hasFleet && wantsReturn && document.getElementById('uc-return-enable') && document.getElementById('uc-return-enable').checked;

        const outAcId = outEnabled ? parseInt(document.getElementById('uc-out-aircraft').value) : null;
        const outMode = outEnabled ? document.getElementById('uc-out-mode').value : null;
        const outBankId = outEnabled && outMode === 'BANKED' ? parseInt(document.getElementById('uc-out-bank').value) : null;

        const sameAc = document.getElementById('uc-return-same-ac') && document.getElementById('uc-return-same-ac').checked;
        const retAcId = retEnabled ? (sameAc ? outAcId : parseInt(document.getElementById('uc-ret-aircraft').value)) : null;
        const retMode = retEnabled ? document.getElementById('uc-ret-mode').value : null;
        const retBankId = retEnabled && retMode === 'BANKED' ? parseInt(document.getElementById('uc-ret-bank').value) : null;

        return { origin, dest, wantsReturn, outEnabled, retEnabled, outAcId, outMode, outBankId, retAcId, retMode, retBankId, sameAc };
    }

    function runValidation() {
        const vals = gatherAllValues();
        const errors = [];

        if (!vals.origin || !vals.dest) {
            errors.push('Select both origin and destination airports.');
            return errors;
        }
        if (vals.origin === vals.dest) {
            errors.push('Origin and destination cannot be the same.');
            return errors;
        }

        // Check if route already exists
        const existing = state.routes.find(r => r.origin === vals.origin && r.destination === vals.dest);
        if (existing) errors.push(`Route ${vals.origin} \u2192 ${vals.dest} already exists.`);
        if (vals.wantsReturn) {
            const existingRet = state.routes.find(r => r.origin === vals.dest && r.destination === vals.origin);
            if (existingRet) errors.push(`Return route ${vals.dest} \u2192 ${vals.origin} already exists.`);
        }

        // Validate outbound schedule
        if (vals.outEnabled) {
            if (!vals.outAcId) errors.push('Outbound: Select an aircraft.');
            else if (outboundTimes.length === 0) errors.push('Outbound: Add at least one departure time.');
            else {
                // Create a temporary "virtual route" for validation
                const distance = getRouteDistance();
                if (distance) {
                    // We can't use validateScheduleParams since route doesn't exist yet
                    // Do manual checks
                    const aircraft = state.fleet.find(f => f.id === vals.outAcId);
                    if (aircraft) {
                        const acData = getAircraftByType(aircraft.type);
                        if (!canAircraftFlyRoute(aircraft.type, distance)) {
                            errors.push(`Outbound: ${acData.type} cannot fly this route (range ${acData.rangeKm}km < ${Math.round(distance)}km).`);
                        }
                        // Turnaround check
                        if (outboundTimes.length > 1) {
                            const blockTime = calculateBlockTime(distance, aircraft.type);
                            const turnaround = getTurnaroundTime(aircraft.type);
                            const sorted = outboundTimes.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
                            for (let i = 1; i < sorted.length; i++) {
                                const gap = sorted[i] - sorted[i - 1];
                                const needed = blockTime + turnaround;
                                if (gap < needed) {
                                    errors.push(`Outbound: Insufficient turnaround between departures at ${String(Math.floor(sorted[i-1]/60)).padStart(2,'0')}:${String(sorted[i-1]%60).padStart(2,'0')} and ${String(Math.floor(sorted[i]/60)).padStart(2,'0')}:${String(sorted[i]%60).padStart(2,'0')}.`);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Validate return schedule
        if (vals.retEnabled) {
            if (!vals.retAcId) errors.push('Return: Select an aircraft.');
            else if (returnTimes.length === 0) errors.push('Return: Add at least one departure time.');
            else {
                const distance = getRouteDistance();
                if (distance) {
                    const aircraft = state.fleet.find(f => f.id === vals.retAcId);
                    if (aircraft) {
                        const acData = getAircraftByType(aircraft.type);
                        if (!canAircraftFlyRoute(aircraft.type, distance)) {
                            errors.push(`Return: ${acData.type} cannot fly this route (range ${acData.rangeKm}km < ${Math.round(distance)}km).`);
                        }
                        if (returnTimes.length > 1) {
                            const blockTime = calculateBlockTime(distance, aircraft.type);
                            const turnaround = getTurnaroundTime(aircraft.type);
                            const sorted = returnTimes.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
                            for (let i = 1; i < sorted.length; i++) {
                                const gap = sorted[i] - sorted[i - 1];
                                const needed = blockTime + turnaround;
                                if (gap < needed) {
                                    errors.push(`Return: Insufficient turnaround between departures at ${String(Math.floor(sorted[i-1]/60)).padStart(2,'0')}:${String(sorted[i-1]%60).padStart(2,'0')} and ${String(Math.floor(sorted[i]/60)).padStart(2,'0')}:${String(sorted[i]%60).padStart(2,'0')}.`);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Validate rotation feasibility (same aircraft doing both directions)
        if (vals.outEnabled && vals.retEnabled && vals.outAcId === vals.retAcId && outboundTimes.length > 0 && returnTimes.length > 0) {
            const distance = getRouteDistance();
            if (distance) {
                const aircraft = state.fleet.find(f => f.id === vals.outAcId);
                if (aircraft) {
                    const blockTime = calculateBlockTime(distance, aircraft.type);
                    const turnaround = getTurnaroundTime(aircraft.type);
                    // Check that return departs after outbound arrives + turnaround
                    const outSorted = outboundTimes.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
                    const retSorted = returnTimes.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
                    // For rotation: each outbound arrival + turnaround should have a return departure after it
                    for (const outDep of outSorted) {
                        const outArr = outDep + blockTime;
                        const earliestRetDep = outArr + turnaround;
                        // Find the first return departure that's after this outbound arrival
                        const matchingRet = retSorted.find(r => r >= earliestRetDep);
                        if (!matchingRet && earliestRetDep < 1440) {
                            errors.push(`Rotation: Outbound dep ${String(Math.floor(outDep/60)).padStart(2,'0')}:${String(outDep%60).padStart(2,'0')} arrives ~${String(Math.floor(outArr/60)%24).padStart(2,'0')}:${String(outArr%60).padStart(2,'0')}, needs ${turnaround}min turnaround. No matching return departure found.`);
                            break;
                        }
                    }
                }
            }
        }

        // Validate flight number uniqueness
        const allFn = [...outboundFlightNumbers, ...returnFlightNumbers].filter(Boolean);
        const usedFn = getAllUsedFlightNumbers();
        const seenFn = new Set();
        for (const fn of allFn) {
            if (usedFn.has(fn)) errors.push(`Flight number ${fn} is already in use.`);
            if (seenFn.has(fn)) errors.push(`Flight number ${fn} is duplicated.`);
            seenFn.add(fn);
        }

        return errors;
    }

    function showValidationResult(errors) {
        const errDiv = document.getElementById('uc-validation-errors');
        const okDiv = document.getElementById('uc-validation-ok');
        if (errors.length === 0) {
            errDiv.classList.add('hidden');
            okDiv.classList.remove('hidden');
            okDiv.innerHTML = '<div class="validation-ok">All checks passed. Ready to create.</div>';
        } else {
            okDiv.classList.add('hidden');
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = errors.map(e => `<div class="validation-error-item">${e}</div>`).join('');
        }
    }

    // Validate button
    document.getElementById('uc-validate').addEventListener('click', () => {
        showValidationResult(runValidation());
    });

    // Route Only button
    document.getElementById('uc-route-only').addEventListener('click', () => {
        const origin = document.getElementById('rc-origin-iata').value;
        const dest = document.getElementById('rc-dest-iata').value;
        if (!origin || !dest) return;

        const route = createRoute(origin, dest);
        if (route) {
            const wantsReturn = returnRouteCheckbox.checked;
            if (wantsReturn) {
                const returnRoute = createRoute(dest, origin);
                if (returnRoute) {
                    route.pairedRouteId = returnRoute.id;
                    returnRoute.pairedRouteId = route.id;
                }
            }
            renderRouteList();
            renderMap();
            updateHUD();
            creator.classList.add('hidden');
        }
    });

    // Create Route & Schedule button
    document.getElementById('uc-confirm').addEventListener('click', () => {
        const errors = runValidation();
        if (errors.length > 0) {
            showValidationResult(errors);
            return;
        }

        const vals = gatherAllValues();

        // Step 1: Create routes
        const route = createRoute(vals.origin, vals.dest);
        if (!route) return;

        let returnRoute = null;
        if (vals.wantsReturn) {
            returnRoute = createRoute(vals.dest, vals.origin);
            if (returnRoute) {
                route.pairedRouteId = returnRoute.id;
                returnRoute.pairedRouteId = route.id;
            }
        }

        // Step 2: Create outbound schedule
        if (vals.outEnabled && outboundTimes.length > 0) {
            const result = createSchedule(route.id, vals.outAcId, vals.outMode, outboundTimes, vals.outBankId, outboundFlightNumbers);
            if (result.errors && result.errors.length > 0) {
                showValidationResult(result.errors.map(e => `Outbound schedule: ${e}`));
                return;
            }
        }

        // Step 3: Create return schedule
        if (vals.retEnabled && returnRoute && returnTimes.length > 0) {
            const result = createSchedule(returnRoute.id, vals.retAcId, vals.retMode, returnTimes, vals.retBankId, returnFlightNumbers);
            if (result.errors && result.errors.length > 0) {
                showValidationResult(result.errors.map(e => `Return schedule: ${e}`));
                return;
            }
        }

        renderRouteList();
        renderMap();
        updateHUD();
        creator.classList.add('hidden');
    });
}

function updateRouteInfo() {
    const origin = document.getElementById('rc-origin-iata').value;
    const dest = document.getElementById('rc-dest-iata').value;
    const infoDiv = document.getElementById('rc-info');

    if (!origin || !dest) {
        infoDiv.classList.add('hidden');
        return;
    }

    const distance = getDistanceBetweenAirports(origin, dest);
    if (!distance) return;

    const baseFare = calculateBaseFare(distance);
    const competitors = getAICompetitorsOnRoute(origin, dest);

    const originLevel = getSlotControlLevel(origin);
    const destLevel = getSlotControlLevel(dest);
    const originSlotInfo = SLOT_CONTROL_LEVELS[originLevel];
    const destSlotInfo = SLOT_CONTROL_LEVELS[destLevel];
    const originSlotCost = getSlotCost(origin);
    const returnCheckbox = document.getElementById('rc-return-route');
    const wantsReturn = returnCheckbox ? returnCheckbox.checked : false;
    const destSlotCost = wantsReturn ? getSlotCost(dest) : 0;
    const totalSlotCost = originSlotCost + destSlotCost;

    infoDiv.classList.remove('hidden');
    infoDiv.innerHTML = `
        <div class="route-info-grid">
            <div><span>Distance:</span> ${Math.round(distance).toLocaleString()} km</div>
            <div><span>Base Fare:</span> $${baseFare.toFixed(0)}</div>
            <div><span>AI Competitors:</span> ${competitors.length}</div>
        </div>
        <div class="route-info-grid" style="margin-top:6px;">
            <div><span>Origin slots:</span> L${originLevel} ${originSlotInfo.name}</div>
            <div><span>Dest slots:</span> L${destLevel} ${destSlotInfo.name}</div>
            ${totalSlotCost > 0 ? `<div><span>Slot fee:</span> $${formatMoney(totalSlotCost)} (one-time)</div>` : ''}
        </div>
    `;
}

function setupAirportSearch(inputId, resultsId, hiddenId, onChange) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    const hidden = document.getElementById(hiddenId);

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        results.innerHTML = '';
        hidden.value = '';

        if (query.length < 2) {
            results.classList.remove('visible');
            return;
        }

        const matches = AIRPORTS.filter(ap =>
            ap.iata.toLowerCase().includes(query) ||
            ap.city.toLowerCase().includes(query) ||
            ap.name.toLowerCase().includes(query)
        ).slice(0, 8);

        for (const ap of matches) {
            const item = document.createElement('div');
            item.className = 'hub-result-item';
            item.innerHTML = `<span class="hub-iata">${ap.iata}</span> <span class="hub-info">${ap.city}, ${ap.country}</span>`;
            item.addEventListener('click', () => {
                input.value = `${ap.iata} - ${ap.city}`;
                hidden.value = ap.iata;
                results.innerHTML = '';
                results.classList.remove('visible');
                if (onChange) onChange();
            });
            results.appendChild(item);
        }
        results.classList.add('visible');
    });
}

function renderRouteList() {
    const state = getState();
    const listDiv = document.getElementById('route-list');
    if (!listDiv) return;

    if (state.routes.length === 0) {
        listDiv.innerHTML = '<div class="empty-state">No routes. Create your first route to get started.</div>';
        return;
    }

    listDiv.innerHTML = state.routes.map(route => {
        const origin = getAirportByIata(route.origin);
        const dest = getAirportByIata(route.destination);
        const schedules = getSchedulesByRoute(route.id);
        const totalSeats = getTotalDailySeatsOnRoute(route.id);
        const loadFactor = calculateLoadFactor(route, totalSeats);

        // Daily Transfer Calculation (Last 24 Game Hours)
        const recentFlights = state.flights.completed.filter(f => f.routeId === route.id && (state.clock.totalMinutes - f.arrivalTime) <= 1440);
        const dayTransfers = recentFlights.reduce((sum, f) => sum + (f.transferPassengers || 0), 0);

        // Collect unique aircraft assigned to this route's schedules
        const assignedAcIds = [...new Set(schedules.map(s => s.aircraftId))];
        const assignedAircraft = assignedAcIds.map(id => state.fleet.find(f => f.id === id)).filter(Boolean);

        // Calculate minimum aircraft needed for daily service
        let minAcWarning = '';
        if (schedules.length > 0) {
            const firstSched = schedules[0];
            const ac = state.fleet.find(f => f.id === firstSched.aircraftId);
            if (ac) {
                const freq = schedules.reduce((sum, s) => sum + s.departureTimes.length, 0);
                const minAc = calculateMinAircraft(route.distance, ac.type, freq);
                if (assignedAcIds.length < minAc) {
                    minAcWarning = `<div class="route-warning">&#9888; Understaffed \u2014 ${assignedAcIds.length} of ${minAc} required aircraft assigned</div>`;
                }
            }
        }

        // Check for stranding
        let strandWarning = '';
        const hasReturn = state.routes.some(r => r.active && r.origin === route.destination && r.destination === route.origin);
        if (!hasReturn && schedules.length > 0) {
            for (const ac of assignedAircraft) {
                const returnSchedules = state.schedules.filter(s =>
                    s.active && s.aircraftId === ac.id &&
                    getRouteById(s.routeId)?.origin === route.destination &&
                    getRouteById(s.routeId)?.destination === route.origin
                );
                if (returnSchedules.length === 0) {
                    strandWarning = `<div class="route-warning">&#9888; ${ac.registration} will be at ${route.destination} with no scheduled return. Add a return leg or assign an additional aircraft.</div>`;
                    break;
                }
            }
        }

        const pairedRoute = route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;
        const pairedLabel = pairedRoute ? `<span class="route-paired-badge" title="Paired with ${pairedRoute.origin} → ${pairedRoute.destination}">\u2194 Paired</span>` : '';

        return `
            <div class="route-card">
                <div class="route-card-header">
                    <span class="route-pair">${route.origin} ${pairedRoute ? '\u2194' : '\u27F6'} ${route.destination}</span>
                    ${pairedLabel}
                    <span class="route-dist">${route.distance.toLocaleString()} km</span>
                    <span class="route-status ${route.active ? 'active' : 'inactive'}">${route.active ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="route-card-details">
                    <span>${origin ? origin.city : ''} \u2192 ${dest ? dest.city : ''}</span>
                    <span>Demand: ${route.demand} pax/day</span>
                    <span>Base fare: $${route.baseFare.toFixed(0)}</span>
                    <span>Schedules: ${schedules.length}</span>
                    <span>Daily seats: ${totalSeats}</span>
                    <span>Load factor: ${(loadFactor * 100).toFixed(0)}%</span>
                    <span>24h Transfers: ${dayTransfers}</span>
                </div>
                ${assignedAircraft.length > 0 ? `
                    <div class="route-aircraft-list">
                        <span class="route-aircraft-label">Aircraft:</span>
                        ${assignedAircraft.map(ac => `
                            <span class="route-aircraft-tag">
                                ${ac.registration} (${ac.type})
                                <span class="route-ac-loc">${formatLocation(ac)}</span>
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
                ${minAcWarning}
                ${strandWarning}
                <div class="route-card-actions">
                    ${assignedAircraft.length > 0 ? `<button class="btn-sm" data-swap-route="${route.id}">Swap Aircraft</button>` : ''}
                    <button class="btn-sm btn-danger" data-delete-route="${route.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    listDiv.querySelectorAll('[data-delete-route]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.deleteRoute);
            const route = getRouteById(id);
            if (!route) return;

            const pairedRoute = route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;

            if (pairedRoute) {
                // Show modal with options: delete both or just this one
                const body = showModal('Delete Paired Route', `
                    <p>This route <strong>${route.origin} → ${route.destination}</strong> is paired with <strong>${pairedRoute.origin} → ${pairedRoute.destination}</strong>.</p>
                    <div class="modal-actions">
                        <button class="btn-accent" id="del-both-btn">Delete Both Routes</button>
                        <button class="btn-secondary" id="del-one-btn">Delete This Route Only</button>
                        <button class="btn-secondary" id="del-cancel-btn">Cancel</button>
                    </div>
                `);
                body.querySelector('#del-both-btn').addEventListener('click', () => {
                    // Unlink paired route first
                    pairedRoute.pairedRouteId = null;
                    deleteRoute(id);
                    deleteRoute(pairedRoute.id);
                    closeModal();
                    renderRouteList();
                    renderMap();
                    updateHUD();
                });
                body.querySelector('#del-one-btn').addEventListener('click', () => {
                    // Unlink paired route
                    pairedRoute.pairedRouteId = null;
                    deleteRoute(id);
                    closeModal();
                    renderRouteList();
                    renderMap();
                    updateHUD();
                });
                body.querySelector('#del-cancel-btn').addEventListener('click', () => {
                    closeModal();
                });
            } else {
                if (deleteRoute(id)) {
                    renderRouteList();
                    renderMap();
                    updateHUD();
                }
            }
        });
    });

    listDiv.querySelectorAll('[data-swap-route]').forEach(btn => {
        btn.addEventListener('click', () => {
            const routeId = parseInt(btn.dataset.swapRoute);
            openSwapAircraftModal(routeId);
        });
    });
}

function openSwapAircraftModal(routeId) {
    const state = getState();
    const route = getRouteById(routeId);
    if (!route) return;

    const schedules = getSchedulesByRoute(routeId);
    const assignedAcIds = [...new Set(schedules.map(s => s.aircraftId))];

    // Build aircraft list HTML
    const acListHtml = state.fleet.map(ac => {
        const acData = getAircraftByType(ac.type);
        const isAssigned = assignedAcIds.includes(ac.id);

        // Status badge
        let statusClass, statusLabel;
        if (ac.status === 'available') {
            statusClass = 'swap-status-available';
            statusLabel = 'Available';
        } else if (ac.status === 'in_flight') {
            statusClass = 'swap-status-busy';
            statusLabel = 'Busy';
        } else {
            statusClass = 'swap-status-maint';
            statusLabel = 'Maintenance';
        }

        // Next free time for busy aircraft
        let nextFreeLabel = '';
        if (ac.status === 'in_flight') {
            const nextFree = getAircraftNextFree(ac.id);
            if (nextFree != null) {
                const gt = getGameTime(nextFree);
                nextFreeLabel = `Free at D${(gt.week - 1) * 7 + gt.day} ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
            }
        }

        const locationStr = formatLocation(ac);

        return `
            <div class="swap-ac-row ${isAssigned ? 'swap-ac-current' : ''}" data-ac-id="${ac.id}">
                <div class="swap-ac-info">
                    <span class="swap-ac-reg">${ac.registration}</span>
                    <span class="swap-ac-type">${ac.type} (${acData ? acData.seats + ' seats' : ''})</span>
                    <span class="swap-ac-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="swap-ac-details">
                    <span>${locationStr}</span>
                    ${acData ? `<span>Range: ${acData.rangeKm.toLocaleString()}km</span>` : ''}
                    ${nextFreeLabel ? `<span>${nextFreeLabel}</span>` : ''}
                    ${isAssigned ? '<span style="color:var(--accent-blue);">Currently assigned</span>' : ''}
                </div>
                ${!isAssigned ? `<button class="btn-sm btn-accent swap-select-btn" data-swap-ac="${ac.id}">Select</button>` : ''}
            </div>
        `;
    }).join('');

    // Build old aircraft selector if multiple assigned
    let oldAcSelectorHtml = '';
    if (assignedAcIds.length > 1) {
        const assignedAircraft = assignedAcIds.map(id => state.fleet.find(f => f.id === id)).filter(Boolean);
        oldAcSelectorHtml = `
            <div class="form-row" style="margin-bottom:12px;">
                <label>Replace which aircraft?</label>
                <select id="swap-old-ac">
                    ${assignedAircraft.map(ac => `<option value="${ac.id}">${ac.registration} (${ac.type})</option>`).join('')}
                </select>
            </div>
        `;
    }

    const body = showModal(`Swap Aircraft — ${route.origin} → ${route.destination}`, `
        ${oldAcSelectorHtml}
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Select replacement aircraft:</div>
        <div class="swap-ac-list">${acListHtml}</div>
        <div id="swap-errors" class="validation-errors hidden"></div>
    `);

    // Wire up select buttons
    body.querySelectorAll('.swap-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newAcId = parseInt(btn.dataset.swapAc);

            // Determine old aircraft
            let oldAcId;
            if (assignedAcIds.length === 1) {
                oldAcId = assignedAcIds[0];
            } else {
                const selector = document.getElementById('swap-old-ac');
                oldAcId = parseInt(selector.value);
            }

            const result = swapAircraftOnRoute(routeId, oldAcId, newAcId);
            const errDiv = body.querySelector('#swap-errors');

            if (result.success) {
                closeModal();
                renderRouteList();
                renderMap();
                updateHUD();
            } else {
                errDiv.classList.remove('hidden');
                errDiv.innerHTML = result.errors.map(e => `<div class="validation-error-item">${e}</div>`).join('');
            }
        });
    });
}

function renderSchedulePanel(container) {
    const state = getState();

    container.innerHTML = `
        <div class="panel-header">
            <h2>Scheduling</h2>
            <div>
                <button class="btn-accent" id="sched-create-btn">New Schedule</button>
                <button class="btn-secondary" id="bank-create-btn">New Bank</button>
            </div>
        </div>
        <div class="sched-mode-toggle">
            <button class="btn-sm sched-mode-btn active" data-smode="simple">Simple</button>
            <button class="btn-sm sched-mode-btn" data-smode="ops">Ops</button>
        </div>
        <div id="sched-creator" class="sched-creator hidden"></div>
        <div id="bank-creator" class="bank-creator hidden"></div>

        <h3 class="section-title">Connection Banks</h3>
        <div id="bank-list"></div>

        <h3 class="section-title">Schedules</h3>
        <div id="sched-list"></div>
    `;

    container.querySelectorAll('.sched-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.sched-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    renderBankList();
    renderScheduleList();

    document.getElementById('sched-create-btn').addEventListener('click', () => {
        const el = document.getElementById('sched-creator');
        el.classList.toggle('hidden');
        if (!el.classList.contains('hidden')) renderScheduleCreator();
    });

    document.getElementById('bank-create-btn').addEventListener('click', () => {
        const el = document.getElementById('bank-creator');
        el.classList.toggle('hidden');
        if (!el.classList.contains('hidden')) renderBankCreator();
    });
}

function renderBankCreator() {
    const creator = document.getElementById('bank-creator');
    creator.innerHTML = `
        <div class="bank-form">
            <div class="form-row">
                <label>Bank Name</label>
                <input type="text" id="bc-name" placeholder="e.g. Morning Wave" />
            </div>
            <div class="form-row-inline">
                <div class="form-row">
                    <label>Start Time</label>
                    <input type="time" id="bc-start" value="06:00" />
                </div>
                <div class="form-row">
                    <label>End Time</label>
                    <input type="time" id="bc-end" value="08:00" />
                </div>
            </div>
            <button class="btn-accent" id="bc-confirm">Create Bank</button>
        </div>
    `;

    document.getElementById('bc-confirm').addEventListener('click', () => {
        const name = document.getElementById('bc-name').value;
        const start = document.getElementById('bc-start').value.split(':');
        const end = document.getElementById('bc-end').value.split(':');
        const bank = createBank(name, parseInt(start[0]), parseInt(start[1]), parseInt(end[0]), parseInt(end[1]));
        if (bank) {
            renderBankList();
            creator.classList.add('hidden');
        }
    });
}

function renderBankList() {
    const state = getState();
    const listDiv = document.getElementById('bank-list');
    if (!listDiv) return;

    if (state.banks.length === 0) {
        listDiv.innerHTML = '<div class="empty-state-sm">No connection banks created.</div>';
        return;
    }

    listDiv.innerHTML = state.banks.map(bank => `
        <div class="bank-card">
            <span class="bank-name">${bank.name}</span>
            <span class="bank-time">${String(bank.startTime.hour).padStart(2, '0')}:${String(bank.startTime.minute).padStart(2, '0')} — ${String(bank.endTime.hour).padStart(2, '0')}:${String(bank.endTime.minute).padStart(2, '0')}</span>
            <button class="btn-sm btn-danger" data-delete-bank="${bank.id}">Delete</button>
        </div>
    `).join('');

    listDiv.querySelectorAll('[data-delete-bank]').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteBank(parseInt(btn.dataset.deleteBank));
            renderBankList();
            renderScheduleList();
        });
    });
}

function renderScheduleCreator() {
    const state = getState();
    const creator = document.getElementById('sched-creator');

    if (state.routes.length === 0 || state.fleet.length === 0) {
        creator.innerHTML = '<div class="empty-state-sm">Need at least one route and one aircraft to create a schedule.</div>';
        return;
    }

    creator.innerHTML = `
        <div class="sched-form">
            <div class="form-row">
                <label>Route</label>
                <select id="sc-route">
                    <option value="">Select route...</option>
                    ${state.routes.filter(r => r.active).map(r => `<option value="${r.id}">${r.origin} → ${r.destination} (${r.distance}km)</option>`).join('')}
                </select>
            </div>
            <div class="form-row">
                <label>Aircraft</label>
                <select id="sc-aircraft">
                    <option value="">Select aircraft...</option>
                    ${state.fleet.map(ac => {
                        const statusLabel = ac.status === 'available' ? '\u2705 Available'
                            : ac.status === 'maintenance' ? '\uD83D\uDD34 Maintenance'
                            : '\uD83D\uDFE1 Busy';
                        let nextFreeLabel = '';
                        if (ac.status === 'in_flight') {
                            const nextFree = getAircraftNextFree(ac.id);
                            if (nextFree != null) {
                                const gt = getGameTime(nextFree);
                                nextFreeLabel = ` \u2014 Free at D${((gt.week - 1) * 7 + gt.day)} ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
                            }
                        }
                        return `<option value="${ac.id}">${ac.registration} \u2014 ${ac.type} [${statusLabel}${nextFreeLabel}]</option>`;
                    }).join('')}
                </select>
            </div>
            <div id="sc-range-check" class="range-check hidden"></div>
            <div id="sc-aircraft-warning" class="range-check hidden"></div>
            <div class="form-row">
                <label>Mode</label>
                <select id="sc-mode">
                    <option value="CUSTOM">Custom (manual times)</option>
                    <option value="BANKED">Banked (connection wave)</option>
                </select>
            </div>
            <div id="sc-custom-times" class="form-row">
                <label>Departure Times</label>
                <div id="sc-times-list" class="times-list"></div>
                <div class="form-row-inline">
                    <input type="time" id="sc-new-time" value="08:00" />
                    <button class="btn-sm btn-accent" id="sc-add-time">Add Time</button>
                </div>
            </div>
            <div id="sc-banked-opts" class="form-row hidden">
                <label>Connection Bank</label>
                <select id="sc-bank">
                    <option value="">Select bank...</option>
                    ${state.banks.map(b => `<option value="${b.id}">${b.name} (${String(b.startTime.hour).padStart(2,'0')}:${String(b.startTime.minute).padStart(2,'0')}-${String(b.endTime.hour).padStart(2,'0')}:${String(b.endTime.minute).padStart(2,'0')})</option>`).join('')}
                </select>
            </div>
            <div id="sc-validation-errors" class="validation-errors hidden"></div>
            <div class="sched-editor-actions">
                <button class="btn-accent" id="sc-confirm">Create Schedule</button>
                <button class="btn-secondary" id="sc-validate">Validate</button>
            </div>
        </div>
    `;

    const customTimes = [];

    document.getElementById('sc-mode').addEventListener('change', (e) => {
        document.getElementById('sc-custom-times').classList.toggle('hidden', e.target.value !== 'CUSTOM');
        document.getElementById('sc-banked-opts').classList.toggle('hidden', e.target.value !== 'BANKED');
    });

    const routeSelect = document.getElementById('sc-route');
    const aircraftSelect = document.getElementById('sc-aircraft');
    const rangeCheck = document.getElementById('sc-range-check');

    function checkRange() {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        const acWarning = document.getElementById('sc-aircraft-warning');
        if (!routeId || !acId) { rangeCheck.classList.add('hidden'); if (acWarning) acWarning.classList.add('hidden'); return; }
        const route = getRouteById(routeId);
        const aircraft = state.fleet.find(f => f.id === acId);
        if (!route || !aircraft) return;
        const can = canAircraftFlyRoute(aircraft.type, route.distance);
        const acData = getAircraftByType(aircraft.type);
        const blockTime = calculateBlockTime(route.distance, aircraft.type);
        const turnaround = getTurnaroundTime(aircraft.type);
        const roundTripMinutes = blockTime * 2 + turnaround * 2;
        const minAc = calculateMinAircraft(route.distance, aircraft.type, 1);
        rangeCheck.classList.remove('hidden');
        if (can) {
            let msg = `Range OK (${acData.rangeKm}km \u2265 ${route.distance}km). Block: ${Math.floor(blockTime/60)}h${blockTime%60}m, Turnaround: ${turnaround}m`;
            if (minAc > 1) {
                msg += ` | Round trip: ${Math.floor(roundTripMinutes/60)}h${roundTripMinutes%60}m. This route requires at least ${minAc} aircraft for daily frequency. One aircraft takes ${Math.floor(roundTripMinutes/60)}h to complete the round trip.`;
            }
            rangeCheck.className = 'range-check ok';
            rangeCheck.textContent = msg;
        } else {
            rangeCheck.className = 'range-check fail';
            rangeCheck.textContent = `Out of range! ${acData.rangeKm}km < ${route.distance}km`;
        }

        if (acWarning) {
            const warnings = [];
            if (aircraft.status === 'in_flight') {
                const nextFree = getAircraftNextFree(aircraft.id);
                if (nextFree != null) {
                    const gt = getGameTime(nextFree);
                    warnings.push(`${aircraft.registration} is busy until Day ${(gt.week - 1) * 7 + gt.day} \u2014 ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}. Schedule will only activate when aircraft is free.`);
                }
            } else if (aircraft.status === 'maintenance') {
                warnings.push(`${aircraft.registration} is in maintenance. Schedule will activate when maintenance completes.`);
            }

            // Location warning — advisory; real validation uses forward projection in validateScheduleParams
            if (aircraft.currentLocation && aircraft.currentLocation !== route.origin && !aircraft.currentLocation.startsWith('airborne:')) {
                warnings.push(`${aircraft.registration} is currently at ${aircraft.currentLocation}. A prior scheduled flight must deliver it to ${route.origin} before departure.`);
            }

            if (warnings.length > 0) {
                acWarning.classList.remove('hidden');
                acWarning.className = 'range-check fail';
                acWarning.textContent = warnings.join(' | ');
            } else {
                acWarning.classList.add('hidden');
            }
        }
    }

    routeSelect.addEventListener('change', checkRange);
    aircraftSelect.addEventListener('change', checkRange);

    document.getElementById('sc-add-time').addEventListener('click', () => {
        const timeInput = document.getElementById('sc-new-time');
        const [h, m] = timeInput.value.split(':').map(Number);
        customTimes.push({ hour: h, minute: m });
        customTimes.sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
        renderTimesList(customTimes);
    });

    function getCreatorValues() {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        const mode = document.getElementById('sc-mode').value;
        const bankId = mode === 'BANKED' ? parseInt(document.getElementById('sc-bank').value) : null;
        const times = mode === 'CUSTOM' ? customTimes : [];
        return { routeId, acId, mode, times, bankId };
    }

    function showCreatorErrors(errors) {
        const errDiv = document.getElementById('sc-validation-errors');
        if (errors.length === 0) {
            errDiv.classList.add('hidden');
            errDiv.innerHTML = '';
            return false;
        }
        errDiv.classList.remove('hidden');
        errDiv.innerHTML = errors.map(e => `<div class="validation-error-item">${e}</div>`).join('');
        return true;
    }

    document.getElementById('sc-validate').addEventListener('click', () => {
        const { routeId, acId, mode, times, bankId } = getCreatorValues();
        if (!routeId || !acId) {
            showCreatorErrors(['Select both a route and an aircraft']);
            return;
        }
        const errors = validateScheduleParams(routeId, acId, mode, times, bankId);
        if (errors.length === 0) {
            const errDiv = document.getElementById('sc-validation-errors');
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-ok">All checks passed. Schedule is valid.</div>';
        } else {
            showCreatorErrors(errors);
        }
    });

    document.getElementById('sc-confirm').addEventListener('click', () => {
        const { routeId, acId, mode, times, bankId } = getCreatorValues();
        if (!routeId || !acId) {
            showCreatorErrors(['Select both a route and an aircraft']);
            return;
        }

        const result = createSchedule(routeId, acId, mode, times, bankId);
        if (result.errors && result.errors.length > 0) {
            showCreatorErrors(result.errors);
            return;
        }
        if (result.schedule) {
            renderScheduleList();
            creator.classList.add('hidden');
        }
    });

    function renderTimesList(times) {
        const list = document.getElementById('sc-times-list');
        list.innerHTML = times.map((t, i) => `
            <span class="time-tag">${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}
                <button class="time-remove" data-idx="${i}">×</button>
            </span>
        `).join('');
        list.querySelectorAll('.time-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                customTimes.splice(parseInt(btn.dataset.idx), 1);
                renderTimesList(customTimes);
            });
        });
    }
}

function renderScheduleList() {
    const state = getState();
    const listDiv = document.getElementById('sched-list');
    if (!listDiv) return;

    if (state.schedules.length === 0) {
        listDiv.innerHTML = '<div class="empty-state-sm">No schedules. Create a schedule to start operations.</div>';
        return;
    }

    // Group schedules by paired routes
    const rendered = new Set();
    const groups = [];

    for (const sched of state.schedules) {
        if (rendered.has(sched.id)) continue;
        const route = getRouteById(sched.routeId);
        const pairedRoute = route && route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;

        if (pairedRoute) {
            // Find all schedules for both paired routes
            const outbound = state.schedules.filter(s => s.routeId === route.id);
            const inbound = state.schedules.filter(s => s.routeId === pairedRoute.id);
            const allInGroup = [...outbound, ...inbound];
            allInGroup.forEach(s => rendered.add(s.id));
            groups.push({ paired: true, route, pairedRoute, schedules: outbound, returnSchedules: inbound });
        } else {
            rendered.add(sched.id);
            groups.push({ paired: false, route, schedules: [sched] });
        }
    }

    listDiv.innerHTML = groups.map(group => {
        if (group.paired) {
            return `
                <div class="sched-group-paired">
                    <div class="sched-group-header">\u2194 ${group.route.origin} \u2014 ${group.route.destination} (Paired)</div>
                    ${group.schedules.map(s => renderSchedCard(s, state)).join('')}
                    ${group.returnSchedules.length > 0 ? `
                        <div style="font-size:11px;color:var(--text-muted);padding:4px 0;font-family:var(--font-mono);">Return leg:</div>
                        ${group.returnSchedules.map(s => renderSchedCard(s, state)).join('')}
                    ` : ''}
                </div>
            `;
        } else {
            return group.schedules.map(s => renderSchedCard(s, state)).join('');
        }
    }).join('');

    function renderSchedCard(sched, state) {
        const route = getRouteById(sched.routeId);
        const aircraft = state.fleet.find(f => f.id === sched.aircraftId);
        const times = sched.departureTimes.map((t, i) => {
            const timeStr = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
            const fn = sched.flightNumbers && sched.flightNumbers[i] ? sched.flightNumbers[i] : '';
            return fn ? `${fn} ${timeStr}` : timeStr;
        }).join(', ');
        return `
            <div class="sched-card">
                <div class="sched-card-header">
                    <span>${route ? route.origin + ' \u2192 ' + route.destination : 'Unknown route'}</span>
                    <span>${aircraft ? aircraft.registration + ' (' + aircraft.type + ')' : 'Unknown aircraft'}</span>
                    <span class="sched-mode">${sched.mode}</span>
                </div>
                <div class="sched-card-details">
                    <span>Block time: ${Math.floor(sched.blockTimeMinutes / 60)}h ${sched.blockTimeMinutes % 60}m</span>
                    <span>Turnaround: ${aircraft ? getTurnaroundTime(aircraft.type) : '?'}m</span>
                    <span>Departures: ${times || 'None'}</span>
                </div>
                <div class="sched-card-actions">
                    <button class="btn-sm btn-accent" data-edit-sched="${sched.id}">Edit</button>
                    <button class="btn-sm btn-danger" data-delete-sched="${sched.id}">Delete</button>
                </div>
            </div>
        `;
    }

    listDiv.querySelectorAll('[data-edit-sched]').forEach(btn => {
        btn.addEventListener('click', () => {
            const schedId = parseInt(btn.dataset.editSched);
            renderScheduleEditor(schedId);
        });
    });

    listDiv.querySelectorAll('[data-delete-sched]').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteSchedule(parseInt(btn.dataset.deleteSched));
            renderScheduleList();
        });
    });
}

function renderScheduleEditor(scheduleId) {
    const state = getState();
    const schedule = state.schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    const route = getRouteById(schedule.routeId);
    const aircraft = state.fleet.find(f => f.id === schedule.aircraftId);

    // Show the creator area and populate it as an editor
    const creator = document.getElementById('sched-creator');
    creator.classList.remove('hidden');

    const editTimes = schedule.departureTimes.map(t => ({ hour: t.hour, minute: t.minute }));

    creator.innerHTML = `
        <div class="sched-form">
            <div class="sched-editor-title">Editing Schedule #${scheduleId}</div>
            <div class="form-row">
                <label>Route</label>
                <select id="se-route">
                    ${state.routes.filter(r => r.active).map(r => `<option value="${r.id}" ${r.id === schedule.routeId ? 'selected' : ''}>${r.origin} \u2192 ${r.destination} (${r.distance}km)</option>`).join('')}
                </select>
            </div>
            <div class="form-row">
                <label>Aircraft</label>
                <select id="se-aircraft">
                    <option value="" ${!schedule.aircraftId ? 'selected' : ''}>-- Unassigned --</option>
                    ${state.fleet.map(ac => {
                        let statusLabel = '';
                        if (ac.status === 'maintenance') {
                            if (ac.maintenanceReleaseTime) {
                                const gt = getGameTime(ac.maintenanceReleaseTime);
                                statusLabel = `\uD83D\uDD34 MAINTENANCE until Y${gt.year} M${gt.month} W${gt.week} D${gt.day} ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
                            } else {
                                statusLabel = '\uD83D\uDD34 MAINTENANCE';
                            }
                        } else if (ac.status === 'in_flight') {
                            statusLabel = '\uD83D\uDFE1 Busy';
                        } else {
                            statusLabel = '\u2705 Available';
                        }
                        
                        let nextFreeLabel = '';
                        if (ac.status === 'in_flight') {
                            const nextFree = getAircraftNextFree(ac.id);
                            if (nextFree != null) {
                                const gt = getGameTime(nextFree);
                                nextFreeLabel = ' \u2014 Free at D' + ((gt.week - 1) * 7 + gt.day) + ' ' + String(gt.hour).padStart(2, '0') + ':' + String(gt.minute).padStart(2, '0');
                            }
                        }
                        return '<option value="' + ac.id + '"' + (ac.id === schedule.aircraftId ? ' selected' : '') + '>' + ac.registration + ' \u2014 ' + ac.type + ' [' + statusLabel + nextFreeLabel + ']</option>';
                    }).join('')}
                </select>
            </div>
            <div id="se-range-check" class="range-check hidden"></div>
            <div id="se-aircraft-warning" class="range-check hidden"></div>
            <div class="form-row">
                <label>Mode</label>
                <select id="se-mode">
                    <option value="CUSTOM" ${schedule.mode === 'CUSTOM' ? 'selected' : ''}>Custom (manual times)</option>
                    <option value="BANKED" ${schedule.mode === 'BANKED' ? 'selected' : ''}>Banked (connection wave)</option>
                </select>
            </div>
            <div id="se-custom-times" class="form-row ${schedule.mode !== 'CUSTOM' ? 'hidden' : ''}">
                <label>Departure Times</label>
                <div id="se-times-list" class="times-list"></div>
                <div class="form-row-inline">
                    <input type="time" id="se-new-time" value="08:00" />
                    <button class="btn-sm btn-accent" id="se-add-time">Add Time</button>
                </div>
            </div>
            <div id="se-banked-opts" class="form-row ${schedule.mode !== 'BANKED' ? 'hidden' : ''}">
                <label>Connection Bank</label>
                <select id="se-bank">
                    <option value="">Select bank...</option>
                    ${state.banks.map(b => '<option value="' + b.id + '"' + (b.id === schedule.bankId ? ' selected' : '') + '>' + b.name + ' (' + String(b.startTime.hour).padStart(2,'0') + ':' + String(b.startTime.minute).padStart(2,'0') + '-' + String(b.endTime.hour).padStart(2,'0') + ':' + String(b.endTime.minute).padStart(2,'0') + ')</option>').join('')}
                </select>
            </div>
            <div id="se-validation-errors" class="validation-errors hidden"></div>
            <div class="sched-editor-actions">
                <button class="btn-accent" id="se-save">Save Changes</button>
                <button class="btn-secondary" id="se-validate">Validate</button>
                <button class="btn-secondary" id="se-cancel">Cancel</button>
            </div>
        </div>
    `;

    // Render existing departure times
    function renderEditorTimesList() {
        const list = document.getElementById('se-times-list');
        list.innerHTML = editTimes.map((t, i) => `
            <span class="time-tag">${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}
                <button class="time-remove" data-idx="${i}">\u00d7</button>
            </span>
        `).join('');
        list.querySelectorAll('.time-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                editTimes.splice(parseInt(btn.dataset.idx), 1);
                renderEditorTimesList();
            });
        });
    }
    renderEditorTimesList();

    // Mode toggle
    document.getElementById('se-mode').addEventListener('change', (e) => {
        document.getElementById('se-custom-times').classList.toggle('hidden', e.target.value !== 'CUSTOM');
        document.getElementById('se-banked-opts').classList.toggle('hidden', e.target.value !== 'BANKED');
    });

    // Range check on route/aircraft change
    const routeSelect = document.getElementById('se-route');
    const aircraftSelect = document.getElementById('se-aircraft');
    const rangeCheck = document.getElementById('se-range-check');

    function checkEditorRange() {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        const acWarning = document.getElementById('se-aircraft-warning');
        if (!routeId || !acId) { rangeCheck.classList.add('hidden'); if (acWarning) acWarning.classList.add('hidden'); return; }
        const r = getRouteById(routeId);
        const ac = state.fleet.find(f => f.id === acId);
        if (!r || !ac) return;
        const can = canAircraftFlyRoute(ac.type, r.distance);
        const acData = getAircraftByType(ac.type);
        const blockTime = calculateBlockTime(r.distance, ac.type);
        const turnaround = getTurnaroundTime(ac.type);
        const roundTripMinutes = blockTime * 2 + turnaround * 2;
        const minAc = calculateMinAircraft(r.distance, ac.type, 1);
        rangeCheck.classList.remove('hidden');
        if (can) {
            let msg = `Range OK (${acData.rangeKm}km \u2265 ${r.distance}km). Block: ${Math.floor(blockTime/60)}h${blockTime%60}m, Turnaround: ${turnaround}m`;
            if (minAc > 1) {
                msg += ` | Round trip: ${Math.floor(roundTripMinutes/60)}h${roundTripMinutes%60}m. Requires at least ${minAc} aircraft.`;
            }
            rangeCheck.className = 'range-check ok';
            rangeCheck.textContent = msg;
        } else {
            rangeCheck.className = 'range-check fail';
            rangeCheck.textContent = `Out of range! ${acData.rangeKm}km < ${r.distance}km`;
        }

        if (acWarning) {
            const warnings = [];
            if (ac.status === 'in_flight') {
                const nextFree = getAircraftNextFree(ac.id);
                if (nextFree != null) {
                    const gt = getGameTime(nextFree);
                    warnings.push(`${ac.registration} is busy until Day ${(gt.week - 1) * 7 + gt.day} \u2014 ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}.`);
                }
            } else if (ac.status === 'maintenance') {
                warnings.push(`${ac.registration} is in maintenance.`);
            }
            if (ac.currentLocation && ac.currentLocation !== r.origin && !ac.currentLocation.startsWith('airborne:')) {
                warnings.push(`${ac.registration} is currently at ${ac.currentLocation}. A prior scheduled flight must deliver it to ${r.origin} before departure.`);
            }
            if (warnings.length > 0) {
                acWarning.classList.remove('hidden');
                acWarning.className = 'range-check fail';
                acWarning.textContent = warnings.join(' | ');
            } else {
                acWarning.classList.add('hidden');
            }
        }
    }

    routeSelect.addEventListener('change', checkEditorRange);
    aircraftSelect.addEventListener('change', checkEditorRange);
    checkEditorRange(); // run immediately

    // Add time button
    document.getElementById('se-add-time').addEventListener('click', () => {
        const timeInput = document.getElementById('se-new-time');
        const [h, m] = timeInput.value.split(':').map(Number);
        editTimes.push({ hour: h, minute: m });
        editTimes.sort((a, b) => a.hour * 60 + a.minute - b.hour * 60 - b.minute);
        renderEditorTimesList();
    });

    // Collect form values helper
    function getEditorValues() {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        const mode = document.getElementById('se-mode').value;
        const bankId = mode === 'BANKED' ? parseInt(document.getElementById('se-bank').value) : null;
        const times = mode === 'CUSTOM' ? editTimes : [];
        return { routeId, acId, mode, times, bankId };
    }

    // Show validation errors
    function showValidationErrors(errors) {
        const errDiv = document.getElementById('se-validation-errors');
        if (errors.length === 0) {
            errDiv.classList.add('hidden');
            errDiv.innerHTML = '';
            return false;
        }
        errDiv.classList.remove('hidden');
        errDiv.innerHTML = errors.map(e => `<div class="validation-error-item">${e}</div>`).join('');
        return true;
    }

    // Validate button
    document.getElementById('se-validate').addEventListener('click', () => {
        const { routeId, acId, mode, times, bankId } = getEditorValues();
        const errors = validateScheduleParams(routeId, acId, mode, times, bankId, scheduleId);
        if (errors.length === 0) {
            const errDiv = document.getElementById('se-validation-errors');
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-ok">All checks passed. Schedule is valid.</div>';
        } else {
            showValidationErrors(errors);
        }
    });

    // Save button
    document.getElementById('se-save').addEventListener('click', () => {
        const { routeId, acId, mode, times, bankId } = getEditorValues();
        const errors = validateScheduleParams(routeId, acId, mode, times, bankId, scheduleId);
        if (showValidationErrors(errors)) return;

        const result = updateSchedule(scheduleId, routeId, acId, mode, times, bankId);
        if (result) {
            creator.classList.add('hidden');
            renderScheduleList();
        }
    });

    // Cancel button
    document.getElementById('se-cancel').addEventListener('click', () => {
        creator.classList.add('hidden');
    });
}

function renderFinancesPanel(container) {
    const state = getState();

    const recentFlights = state.flights.completed.slice(-20).reverse();
    const pnlData = state.finances.monthlyPnL.slice(-12).reverse();
    const dailyData = state.finances.dailyPnL || [];

    container.innerHTML = `
        <div class="panel-header"><h2>Finances</h2></div>
        <div class="finance-summary">
            <div class="dash-card">
                <div class="dash-card-label">Cash</div>
                <div class="dash-card-value">$${formatMoney(state.finances.cash)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Total Revenue</div>
                <div class="dash-card-value">$${formatMoney(state.finances.totalRevenue)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Total Costs</div>
                <div class="dash-card-value">$${formatMoney(state.finances.totalCosts)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Net P&L</div>
                <div class="dash-card-value ${state.finances.totalRevenue - state.finances.totalCosts < 0 ? 'negative' : ''}">$${formatMoney(Math.abs(state.finances.totalRevenue - state.finances.totalCosts))}</div>
            </div>
        </div>

        <h3 class="section-title">Daily P&L (Last 30 Days)</h3>
        <div class="finance-chart-container">
            ${dailyData.length === 0 ? '<div class="empty-state-sm">No daily data yet. Complete a full day of operations.</div>' : `
                <canvas id="daily-pnl-chart" width="800" height="200"></canvas>
            `}
        </div>

        <h3 class="section-title">Running Cash Balance</h3>
        <div class="table-container" style="margin-bottom:16px;">
            ${dailyData.length === 0 ? '<div class="empty-state-sm">No daily data yet.</div>' : `
                <table class="data-table">
                    <thead><tr><th>Day</th><th>Revenue</th><th>Costs</th><th>Net</th><th>Cash</th></tr></thead>
                    <tbody>
                        ${dailyData.slice(-10).reverse().map(d => `
                            <tr>
                                <td>${d.dayLabel}</td>
                                <td>$${formatMoney(d.revenue)}</td>
                                <td>$${formatMoney(d.costs)}</td>
                                <td class="${d.profit >= 0 ? '' : 'negative'}">${d.profit >= 0 ? '+' : '-'}$${formatMoney(Math.abs(d.profit))}</td>
                                <td>$${formatMoney(d.cashBalance)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>

        <h3 class="section-title">Monthly P&L</h3>
        <div class="table-container">
            ${pnlData.length === 0 ? '<div class="empty-state-sm">No monthly data yet.</div>' : `
                <table class="data-table">
                    <thead><tr><th>Month</th><th>Revenue</th><th>Costs</th><th>Profit/Loss</th></tr></thead>
                    <tbody>
                        ${pnlData.map(p => {
                            return `<tr>
                                <td>Y${p.year} M${p.month}</td>
                                <td>$${formatMoney(p.revenue)}</td>
                                <td>$${formatMoney(p.costs)}</td>
                                <td class="${p.profit >= 0 ? '' : 'negative'}">$${formatMoney(Math.abs(p.profit))}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            `}
        </div>

        <h3 class="section-title">Recent Flights</h3>
        <div class="table-container">
            ${recentFlights.length === 0 ? '<div class="empty-state-sm">No completed flights yet.</div>' : `
                <table class="data-table">
                    <thead><tr><th>Route</th><th>Aircraft</th><th>Pax</th><th>LF</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead>
                    <tbody>
                        ${recentFlights.map(f => `
                            <tr>
                                <td>${f.origin}→${f.destination}</td>
                                <td>${f.registration}</td>
                                <td>${f.passengers}</td>
                                <td>${(f.loadFactor * 100).toFixed(0)}%</td>
                                <td>$${formatMoney(f.revenue)}</td>
                                <td>$${formatMoney(f.cost)}</td>
                                <td class="${f.profit >= 0 ? '' : 'negative'}">$${formatMoney(Math.abs(f.profit))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;

    // Render daily P&L bar chart
    if (dailyData.length > 0) {
        renderDailyPnLChart(dailyData.slice(-30));
    }
}

function renderDailyPnLChart(data) {
    const canvas = document.getElementById('daily-pnl-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 28;
    canvas.height = 200;

    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 20, right: 10, bottom: 30, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = '#0d1120';
    ctx.fillRect(0, 0, w, h);

    if (data.length === 0) return;

    const profits = data.map(d => d.profit);
    const maxVal = Math.max(...profits.map(Math.abs), 1);

    const barWidth = Math.max(4, (chartW / data.length) - 2);
    const gap = (chartW - barWidth * data.length) / (data.length + 1);

    // Zero line
    const zeroY = padding.top + chartH / 2;
    ctx.strokeStyle = '#2a3a5c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(w - padding.right, zeroY);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = '#556078';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+$' + formatMoney(maxVal), padding.left - 6, padding.top + 10);
    ctx.fillText('$0', padding.left - 6, zeroY + 4);
    ctx.fillText('-$' + formatMoney(maxVal), padding.left - 6, h - padding.bottom - 2);

    // Bars
    for (let i = 0; i < data.length; i++) {
        const x = padding.left + gap + i * (barWidth + gap);
        const profit = data[i].profit;
        const barH = (Math.abs(profit) / maxVal) * (chartH / 2);

        if (profit >= 0) {
            ctx.fillStyle = '#00e676';
            ctx.fillRect(x, zeroY - barH, barWidth, barH);
        } else {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(x, zeroY, barWidth, barH);
        }

        // Day label (show every few bars to avoid overlap)
        if (data.length <= 15 || i % Math.ceil(data.length / 10) === 0) {
            ctx.fillStyle = '#556078';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            const label = data[i].dayLabel.split(' ').pop();
            ctx.fillText(label, x + barWidth / 2, h - padding.bottom + 14);
        }
    }
}

let logPaused = false;
let logListener = null;

function renderLogPanel(container) {
    const state = getState();

    // Clean up previous listener if any
    if (logListener) {
        window.removeEventListener('gameEvent', logListener);
        logListener = null;
    }

    container.innerHTML = `
        <div class="panel-header">
            <h2>Event Log</h2>
            <div>
                <button class="btn-sm" id="log-pause-btn">${logPaused ? 'Resume Log' : 'Pause Log'}</button>
            </div>
        </div>
        <div class="log-list" id="log-list">
            ${state.log.length === 0 ? '<div class="empty-state-sm" id="log-empty">No events yet.</div>' : ''}
            ${state.log.slice(0, 200).map(entry => renderLogEntry(entry)).join('')}
        </div>
    `;

    // Pause toggle
    document.getElementById('log-pause-btn').addEventListener('click', () => {
        logPaused = !logPaused;
        document.getElementById('log-pause-btn').textContent = logPaused ? 'Resume Log' : 'Pause Log';
    });

    // Real-time listener
    logListener = (e) => {
        if (logPaused) return;
        const list = document.getElementById('log-list');
        if (!list) return;

        // Remove empty state if present
        const empty = document.getElementById('log-empty');
        if (empty) empty.remove();

        // Prepend new entry
        const div = document.createElement('div');
        div.innerHTML = renderLogEntry(e.detail);
        list.insertBefore(div.firstElementChild, list.firstChild);

        // Enforce max 200 entries shown
        while (list.children.length > 200) {
            list.removeChild(list.lastChild);
        }
    };
    window.addEventListener('gameEvent', logListener);
}

function renderLogEntry(entry) {
    const borderColor = LOG_BORDER_COLORS[entry.type] || LOG_BORDER_COLORS.system;
    return `<div class="log-entry log-${entry.type}" style="border-left:3px solid ${borderColor};padding-left:8px;">
        <span class="log-time">${formatLogTime(entry.timestamp)}</span>
        <span class="log-msg">${entry.message}</span>
    </div>`;
}

const LOG_BORDER_COLORS = {
    system: '#666',
    route: '#00aaff',
    flight: '#00e676',
    finance: '#ffc107',
    slot: '#ff9800',
    ai: '#b388ff',
    bank: '#00bcd4',
    error: '#ff4444',
    warning: '#ffc107',
    schedule: '#80deea',
    fleet: '#b388ff',
    info: '#666'
};

function formatLogTime(totalMinutes) {
    return formatGameTimestamp(totalMinutes);
}
