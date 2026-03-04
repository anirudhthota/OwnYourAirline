import { getState, formatMoney, formatGameTimestamp } from '../engine/state.js';
import { AIRCRAFT_TYPES, getAircraftByType, LEASE_DEPOSIT_MONTHS } from '../data/aircraft.js';
import { AIRPORTS, getAirportByIata, getDistanceBetweenAirports } from '../data/airports.js';
import { purchaseAircraft, leaseAircraft, sellAircraft, returnLeasedAircraft, OWNERSHIP_TYPE, getFleetSummary, getAircraftNextFree } from '../engine/fleetManager.js';
import { getGameTime, MINUTES_PER_DAY, MINUTES_PER_HOUR } from '../engine/state.js';
import { createRoute, deleteRoute, calculateBlockTime, calculateBaseFare, calculateFlightCost, canAircraftFlyRoute, getRouteById, getTotalDailySeatsOnRoute, calculateLoadFactor } from '../engine/routeEngine.js';
import { createSchedule, deleteSchedule, SCHEDULE_MODE, createBank, deleteBank, getSchedulesByRoute, getSchedulesByAircraft } from '../engine/scheduler.js';
import { getAICompetitorsOnRoute } from '../engine/aiEngine.js';
import { updateHUD } from './hud.js';
import { renderMap } from './map.js';
import { showConfirm } from './modals.js';

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
            <button class="btn-accent" id="fleet-buy-btn">Purchase / Lease Aircraft</button>
        </div>
        <div id="fleet-list" class="fleet-list"></div>
        <div id="fleet-shop" class="fleet-shop hidden"></div>
    `;

    renderFleetList();

    document.getElementById('fleet-buy-btn').addEventListener('click', () => {
        const shop = document.getElementById('fleet-shop');
        shop.classList.toggle('hidden');
        if (!shop.classList.contains('hidden')) renderFleetShop();
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
                    <span class="fleet-status status-${ac.status}">${ac.status === 'in_flight' ? 'BUSY' : ac.status.toUpperCase()}</span>
                </div>
                <div class="fleet-card-details">
                    <span>${acData ? acData.seats + ' seats' : ''}</span>
                    <span>${acData ? acData.rangeKm.toLocaleString() + ' km range' : ''}</span>
                    <span>${ac.ownership}</span>
                    <span>${Math.round(ac.totalFlightHours)} flight hrs</span>
                    <span>${schedules.length} schedule(s)</span>
                </div>
                <div class="fleet-card-actions">
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

function renderRoutesPanel(container) {
    const state = getState();

    container.innerHTML = `
        <div class="panel-header">
            <h2>Route Network</h2>
            <button class="btn-accent" id="route-create-btn">Create Route</button>
        </div>
        <div id="route-creator" class="route-creator hidden"></div>
        <div id="route-list" class="route-list"></div>
    `;

    renderRouteList();

    document.getElementById('route-create-btn').addEventListener('click', () => {
        const creator = document.getElementById('route-creator');
        creator.classList.toggle('hidden');
        if (!creator.classList.contains('hidden')) renderRouteCreator();
    });
}

function renderRouteCreator() {
    const state = getState();
    const creator = document.getElementById('route-creator');

    creator.innerHTML = `
        <div class="route-form">
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
            <button class="btn-accent" id="rc-confirm">Create Route</button>
        </div>
    `;

    setupAirportSearch('rc-origin', 'rc-origin-results', 'rc-origin-iata', updateRouteInfo);
    setupAirportSearch('rc-dest', 'rc-dest-results', 'rc-dest-iata', updateRouteInfo);

    document.getElementById('rc-confirm').addEventListener('click', () => {
        const origin = document.getElementById('rc-origin-iata').value;
        const dest = document.getElementById('rc-dest-iata').value;
        if (!origin || !dest) return;

        const route = createRoute(origin, dest);
        if (route) {
            const createReturn = document.getElementById('rc-return-route').checked;
            if (createReturn) {
                createRoute(dest, origin);
            }
            renderRouteList();
            renderMap();
            updateHUD();
            creator.classList.add('hidden');
        }
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

    infoDiv.classList.remove('hidden');
    infoDiv.innerHTML = `
        <div class="route-info-grid">
            <div><span>Distance:</span> ${Math.round(distance).toLocaleString()} km</div>
            <div><span>Base Fare:</span> $${baseFare.toFixed(0)}</div>
            <div><span>AI Competitors:</span> ${competitors.length}</div>
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

        return `
            <div class="route-card">
                <div class="route-card-header">
                    <span class="route-pair">${route.origin} ⟶ ${route.destination}</span>
                    <span class="route-dist">${route.distance.toLocaleString()} km</span>
                    <span class="route-status ${route.active ? 'active' : 'inactive'}">${route.active ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="route-card-details">
                    <span>${origin ? origin.city : ''} → ${dest ? dest.city : ''}</span>
                    <span>Demand: ${route.demand} pax/day</span>
                    <span>Base fare: $${route.baseFare.toFixed(0)}</span>
                    <span>Schedules: ${schedules.length}</span>
                    <span>Daily seats: ${totalSeats}</span>
                    <span>Load factor: ${(loadFactor * 100).toFixed(0)}%</span>
                </div>
                <div class="route-card-actions">
                    <button class="btn-sm btn-danger" data-delete-route="${route.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    listDiv.querySelectorAll('[data-delete-route]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.deleteRoute);
            if (deleteRoute(id)) {
                renderRouteList();
                renderMap();
                updateHUD();
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
            <button class="btn-accent" id="sc-confirm">Create Schedule</button>
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
        rangeCheck.classList.remove('hidden');
        if (can) {
            rangeCheck.className = 'range-check ok';
            rangeCheck.textContent = `Range OK (${acData.rangeKm}km >= ${route.distance}km). Block time: ${Math.floor(blockTime/60)}h ${blockTime%60}m`;
        } else {
            rangeCheck.className = 'range-check fail';
            rangeCheck.textContent = `Out of range! ${acData.rangeKm}km < ${route.distance}km`;
        }

        if (acWarning) {
            if (aircraft.status === 'in_flight') {
                const nextFree = getAircraftNextFree(aircraft.id);
                if (nextFree != null) {
                    const gt = getGameTime(nextFree);
                    acWarning.classList.remove('hidden');
                    acWarning.className = 'range-check fail';
                    acWarning.textContent = `${aircraft.registration} is busy until Day ${(gt.week - 1) * 7 + gt.day} \u2014 ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}. Schedule will only activate when aircraft is free.`;
                }
            } else if (aircraft.status === 'maintenance') {
                acWarning.classList.remove('hidden');
                acWarning.className = 'range-check fail';
                acWarning.textContent = `${aircraft.registration} is in maintenance. Schedule will activate when maintenance completes.`;
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

    document.getElementById('sc-confirm').addEventListener('click', () => {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        const mode = document.getElementById('sc-mode').value;
        const bankId = mode === 'BANKED' ? parseInt(document.getElementById('sc-bank').value) : null;

        if (!routeId || !acId) return;

        const schedule = createSchedule(routeId, acId, mode, mode === 'CUSTOM' ? customTimes : [], bankId);
        if (schedule) {
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

    listDiv.innerHTML = state.schedules.map(sched => {
        const route = getRouteById(sched.routeId);
        const aircraft = state.fleet.find(f => f.id === sched.aircraftId);
        const times = sched.departureTimes.map(t => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`).join(', ');

        return `
            <div class="sched-card">
                <div class="sched-card-header">
                    <span>${route ? route.origin + ' → ' + route.destination : 'Unknown route'}</span>
                    <span>${aircraft ? aircraft.registration + ' (' + aircraft.type + ')' : 'Unknown aircraft'}</span>
                    <span class="sched-mode">${sched.mode}</span>
                </div>
                <div class="sched-card-details">
                    <span>Block time: ${Math.floor(sched.blockTimeMinutes / 60)}h ${sched.blockTimeMinutes % 60}m</span>
                    <span>Departures: ${times || 'None'}</span>
                </div>
                <div class="sched-card-actions">
                    <button class="btn-sm btn-danger" data-delete-sched="${sched.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    listDiv.querySelectorAll('[data-delete-sched]').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteSchedule(parseInt(btn.dataset.deleteSched));
            renderScheduleList();
        });
    });
}

function renderFinancesPanel(container) {
    const state = getState();

    const recentFlights = state.flights.completed.slice(-20).reverse();
    const pnlData = state.finances.monthlyPnL.slice(-12).reverse();

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
}

function renderLogPanel(container) {
    const state = getState();

    container.innerHTML = `
        <div class="panel-header"><h2>Event Log</h2></div>
        <div class="log-list">
            ${state.log.length === 0 ? '<div class="empty-state-sm">No events yet.</div>' : ''}
            ${state.log.slice(0, 100).map(entry => `
                <div class="log-entry log-${entry.type}">
                    <span class="log-time">${formatLogTime(entry.timestamp)}</span>
                    <span class="log-msg">${entry.message}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function formatLogTime(totalMinutes) {
    return formatGameTimestamp(totalMinutes);
}
