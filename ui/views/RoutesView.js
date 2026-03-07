import { getState, formatMoney, getGameTime } from '../../engine/state.js';
import { AIRPORTS, getAirportByIata, getDistanceBetweenAirports, getSlotControlLevel, SLOT_CONTROL_LEVELS, getSlotCost } from '../../data/airports.js';
import { createRoute, deleteRoute, calculateBlockTime, calculateBaseFare, canAircraftFlyRoute, getRouteById, getTotalDailySeatsOnRoute, calculateLoadFactor } from '../../engine/routeEngine.js';
import { getSchedulesByRoute, calculateMinAircraft, swapAircraftOnRoute, createSchedule, generateFlightNumbers, getAllUsedFlightNumbers } from '../../engine/scheduler.js';
import { getAircraftByType, getTurnaroundTime } from '../../data/aircraft.js';
import { getAircraftNextFree } from '../../engine/fleetManager.js';
import { getAICompetitorsOnRoute } from '../../engine/aiEngine.js';
import { getSlotUsageForAirport } from '../../engine/sim.js';
import { updateHUD } from '../hud.js';
import { renderMap } from '../map.js';
import { uiState, formatLocation, openRouteDetail } from '../services/uiState.js';
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
        `<option value="${b.id}">${b.name} (${String(b.startTime.hour).padStart(2, '0')}:${String(b.startTime.minute).padStart(2, '0')}-${String(b.endTime.hour).padStart(2, '0')}:${String(b.endTime.minute).padStart(2, '0')})</option>`
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

        rangeDiv.classList.remove('hidden');
        if (can) {
            rangeDiv.className = 'range-check ok';
            rangeDiv.textContent = `Range OK (${acData.rangeKm}km \u2265 ${Math.round(distance)}km). Block: ${Math.floor(blockTime / 60)}h${blockTime % 60}m, Turnaround: ${turnaround}m`;
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

        const existing = state.routes.find(r => r.origin === vals.origin && r.destination === vals.dest);
        if (existing) errors.push(`Route ${vals.origin} \u2192 ${vals.dest} already exists.`);
        if (vals.wantsReturn) {
            const existingRet = state.routes.find(r => r.origin === vals.dest && r.destination === vals.origin);
            if (existingRet) errors.push(`Return route ${vals.dest} \u2192 ${vals.origin} already exists.`);
        }

        if (vals.outEnabled) {
            if (!vals.outAcId) errors.push('Outbound: Select an aircraft.');
            else if (outboundTimes.length === 0) errors.push('Outbound: Add at least one departure time.');
            else {
                const distance = getRouteDistance();
                if (distance) {
                    const aircraft = state.fleet.find(f => f.id === vals.outAcId);
                    if (aircraft) {
                        const acData = getAircraftByType(aircraft.type);
                        if (!canAircraftFlyRoute(aircraft.type, distance)) {
                            errors.push(`Outbound: ${acData.type} cannot fly this route (range ${acData.rangeKm}km < ${Math.round(distance)}km).`);
                        }
                        if (outboundTimes.length > 1) {
                            const blockTime = calculateBlockTime(distance, aircraft.type);
                            const turnaround = getTurnaroundTime(aircraft.type);
                            const sorted = outboundTimes.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
                            for (let i = 1; i < sorted.length; i++) {
                                const gap = sorted[i] - sorted[i - 1];
                                const needed = blockTime + turnaround;
                                if (gap < needed) {
                                    errors.push(`Outbound: Insufficient turnaround between departures at ${String(Math.floor(sorted[i - 1] / 60)).padStart(2, '0')}:${String(sorted[i - 1] % 60).padStart(2, '0')} and ${String(Math.floor(sorted[i] / 60)).padStart(2, '0')}:${String(sorted[i] % 60).padStart(2, '0')}.`);
                                }
                            }
                        }
                    }
                }
            }
        }

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
                                    errors.push(`Return: Insufficient turnaround between departures at ${String(Math.floor(sorted[i - 1] / 60)).padStart(2, '0')}:${String(sorted[i - 1] % 60).padStart(2, '0')} and ${String(Math.floor(sorted[i] / 60)).padStart(2, '0')}:${String(sorted[i] % 60).padStart(2, '0')}.`);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (vals.outEnabled && vals.retEnabled && vals.outAcId === vals.retAcId && outboundTimes.length > 0 && returnTimes.length > 0) {
            const distance = getRouteDistance();
            if (distance) {
                const aircraft = state.fleet.find(f => f.id === vals.outAcId);
                if (aircraft) {
                    const blockTime = calculateBlockTime(distance, aircraft.type);
                    const turnaround = getTurnaroundTime(aircraft.type);
                    const outSorted = outboundTimes.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
                    const retSorted = returnTimes.map(t => t.hour * 60 + t.minute).sort((a, b) => a - b);
                    for (const outDep of outSorted) {
                        const outArr = outDep + blockTime;
                        const earliestRetDep = outArr + turnaround;
                        const matchingRet = retSorted.find(r => r >= earliestRetDep);
                        if (!matchingRet && earliestRetDep < 1440) {
                            errors.push(`Rotation: Outbound dep ${String(Math.floor(outDep / 60)).padStart(2, '0')}:${String(outDep % 60).padStart(2, '0')} arrives ~${String(Math.floor(outArr / 60) % 24).padStart(2, '0')}:${String(outArr % 60).padStart(2, '0')}, needs ${turnaround}min turnaround. No matching return departure found.`);
                            break;
                        }
                    }
                }
            }
        }

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

    document.getElementById('uc-validate').addEventListener('click', () => {
        showValidationResult(runValidation());
    });

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

    document.getElementById('uc-confirm').addEventListener('click', () => {
        const errors = runValidation();
        if (errors.length > 0) {
            showValidationResult(errors);
            return;
        }

        const vals = gatherAllValues();

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

        if (vals.outEnabled && outboundTimes.length > 0) {
            const result = createSchedule(route.id, vals.outAcId, vals.outMode, outboundTimes, vals.outBankId, outboundFlightNumbers);
            if (result.errors && result.errors.length > 0) {
                showValidationResult(result.errors.map(e => `Outbound schedule: ${e}`));
                return;
            }
        }

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
