import { getState, formatMoney, getGameTime } from '../../engine/state.js';
import { AIRPORTS, getAirportByIata, getDistanceBetweenAirports, getSlotControlLevel, SLOT_CONTROL_LEVELS, getSlotCost } from '../../data/airports.js';
import { createRoute, deleteRoute, calculateBlockTime, calculateBaseFare, canAircraftFlyRoute, getRouteById, getTotalDailySeatsOnRoute, calculateLoadFactor } from '../../engine/routeEngine.js';
import { getSchedulesByRoute, calculateMinAircraft, swapAircraftOnRoute } from '../../engine/scheduler.js';
import { getAircraftByType, getTurnaroundTime } from '../../data/aircraft.js';
import { getAircraftNextFree } from '../../engine/fleetManager.js';
import { getAICompetitorsOnRoute } from '../../engine/aiEngine.js';
import { getSlotUsageForAirport } from '../../engine/sim.js';
import { updateHUD } from '../hud.js';
import { renderMap } from '../map.js';
import { uiState, formatLocation, openRouteDetail, openSchedulePanel } from '../services/uiState.js';
import { showConfirm, showModal, closeModal } from '../components/Modal.js';

export function renderRoutesPanel(container) {
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
    const creator = document.getElementById('route-creator');

    creator.innerHTML = `
        <div class="unified-creator">
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

            <div class="uc-section" id="uc-validation-section">
                <div id="uc-validation-errors" class="validation-errors hidden"></div>
            </div>

            <div class="sched-editor-actions">
                <button class="btn-accent" id="uc-confirm">Create Route & Continue to Scheduling</button>
            </div>
        </div>
    `;

    setupAirportSearch('rc-origin', 'rc-origin-results', 'rc-origin-iata', updateRouteInfo);
    setupAirportSearch('rc-dest', 'rc-dest-results', 'rc-dest-iata', updateRouteInfo);

    const returnRouteCheckbox = document.getElementById('rc-return-route');
    if (returnRouteCheckbox) {
        returnRouteCheckbox.addEventListener('change', updateRouteInfo);
    }

    document.getElementById('uc-confirm').addEventListener('click', () => {
        const origin = document.getElementById('rc-origin-iata').value;
        const dest = document.getElementById('rc-dest-iata').value;
        const errDiv = document.getElementById('uc-validation-errors');

        if (!origin || !dest) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-error-item">Select both origin and destination airports.</div>';
            return;
        }
        if (origin === dest) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-error-item">Origin and destination cannot be the same.</div>';
            return;
        }

        const state = getState();
        const existing = state.routes.find(r => r.origin === origin && r.destination === dest);
        if (existing) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = `<div class="validation-error-item">Route ${origin} \u2192 ${dest} already exists.</div>`;
            return;
        }

        const route = createRoute(origin, dest);
        if (!route) return;

        if (returnRouteCheckbox.checked) {
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

        openSchedulePanel({ routeId: route.id, mode: 'create' });
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

        const recentFlights = state.flights.completed.filter(f => f.routeId === route.id && (state.clock.totalMinutes - f.arrivalTime) <= 1440);
        const dayTransfers = recentFlights.reduce((sum, f) => sum + (f.transferPassengers || 0), 0);

        const assignedAcIds = [...new Set(schedules.map(s => s.aircraftId))];
        const assignedAircraft = assignedAcIds.map(id => state.fleet.find(f => f.id === id)).filter(Boolean);

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
                    <button class="btn-sm btn-accent" data-detail-route="${route.id}">View Details</button>
                    ${assignedAircraft.length > 0 ? `<button class="btn-sm" data-swap-route="${route.id}">Swap Aircraft</button>` : ''}
                    <button class="btn-sm btn-danger" data-delete-route="${route.id}">Delete</button>
                </div>
            </div>
        `;
    }).join('');
    // Use event delegation for route actions since listDiv content may be rebuilt dynamically
    if (!listDiv.dataset.delegated) {
        listDiv.dataset.delegated = 'true';
        listDiv.addEventListener('click', (e) => {
            const detailBtn = e.target.closest('[data-detail-route]');
            if (detailBtn) {
                const id = parseInt(detailBtn.dataset.detailRoute);
                openRouteDetail(id);
                return;
            }

            const deleteBtn = e.target.closest('[data-delete-route]');
            if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.deleteRoute);
                const route = getRouteById(id);
                if (!route) return;

                const pairedRoute = route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;

                if (pairedRoute) {
                    const body = showModal('Delete Paired Route', `
                    <p>This route <strong>${route.origin} → ${route.destination}</strong> is paired with <strong>${pairedRoute.origin} → ${pairedRoute.destination}</strong>.</p>
                    <div class="modal-actions">
                        <button class="btn-accent" id="del-both-btn">Delete Both Routes</button>
                        <button class="btn-secondary" id="del-one-btn">Delete This Route Only</button>
                        <button class="btn-secondary" id="del-cancel-btn">Cancel</button>
                    </div>
                `);
                    body.querySelector('#del-both-btn').addEventListener('click', () => {
                        pairedRoute.pairedRouteId = null;
                        deleteRoute(id);
                        deleteRoute(pairedRoute.id);
                        closeModal();
                        renderRouteList();
                        renderMap();
                        updateHUD();
                    });
                    body.querySelector('#del-one-btn').addEventListener('click', () => {
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
                return;
            }

            const swapBtn = e.target.closest('[data-swap-route]');
            if (swapBtn) {
                const routeId = parseInt(swapBtn.dataset.swapRoute);
                openSwapAircraftModal(routeId);
            }
        });
    }
}

export function openSwapAircraftModal(routeId) {
    const state = getState();
    const route = getRouteById(routeId);
    if (!route) return;

    const schedules = getSchedulesByRoute(routeId);
    const assignedAcIds = [...new Set(schedules.map(s => s.aircraftId))];

    const acListHtml = state.fleet.map(ac => {
        const acData = getAircraftByType(ac.type);
        const isAssigned = assignedAcIds.includes(ac.id);

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

    body.querySelectorAll('.swap-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newAcId = parseInt(btn.dataset.swapAc);

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
