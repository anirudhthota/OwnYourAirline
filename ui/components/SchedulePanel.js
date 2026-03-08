import { getState, getGameTime, formatMoney } from '../../engine/state.js';
import { getRouteById, calculateBlockTime, canAircraftFlyRoute, calculateRouteDemand } from '../../engine/routeEngine.js';
import { getAircraftByType, getTurnaroundTime } from '../../data/aircraft.js';
import { getAirportByIata } from '../../data/airports.js';
import { getAircraftNextFree } from '../../engine/fleetManager.js';
import { createSchedule, updateSchedule, deleteSchedule, generateFlightNumbers, validateScheduleParams, calculateMinAircraft } from '../../engine/scheduler.js';
import { showModal, closeModal } from './Modal.js';
import { showPanel } from '../services/uiState.js';
import { getAircraftNextOperationalLocation } from '../../engine/rotationEngine.js';

export function openSchedulePanel({ routeId, mode = 'create', scheduleId = null }) {
    const state = getState();

    let route = null;
    let schedule = null;
    let aircraftId = '';

    if (mode === 'edit') {
        schedule = state.schedules.find(s => s.id === scheduleId);
        if (!schedule) return;
        route = getRouteById(schedule.routeId);
        routeId = route.id;
        aircraftId = schedule.aircraftId || '';
    } else {
        route = getRouteById(routeId);
    }

    if (!route) return;

    const pairedRoute = route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;
    const hasReturn = !!pairedRoute;
    let returnSchedule = null;

    if (mode === 'edit' && hasReturn) {
        returnSchedule = state.schedules.find(s => s.routeId === pairedRoute.id && s.aircraftId === aircraftId && s.active);
    }

    // State for the panel
    let currentOutTimes = [];
    let currentRetTimes = [];
    let currentOutFns = [];
    let currentRetFns = [];

    if (mode === 'edit') {
        currentOutTimes = [...schedule.departureTimes];
        if (schedule.flightNumbers) currentOutFns = [...schedule.flightNumbers];
        if (returnSchedule) {
            currentRetTimes = [...returnSchedule.departureTimes];
            if (returnSchedule.flightNumbers) currentRetFns = [...returnSchedule.flightNumbers];
        }
    }

    const title = mode === 'edit' ? `Edit Schedule (Route ${route.origin} \u2192 ${route.destination})` : `Create Schedule (Route ${route.origin} \u2192 ${route.destination})`;

    const container = showModal(title, '<div id="sp-content"></div>', null);

    function render() {
        const hasFleet = state.fleet.length > 0;
        const aircraftOptions = state.fleet.map(ac => {
            let statusLabel = '';
            if (ac.status === 'maintenance') {
                statusLabel = '\uD83D\uDD34 Maintenance';
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
                    nextFreeLabel = ` \u2014 Free at D${((gt.week - 1) * 7 + gt.day)} ${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
                }
            }
            return `<option value="${ac.id}" ${ac.id === aircraftId ? 'selected' : ''}>${ac.registration} \u2014 ${ac.type} [${statusLabel}${nextFreeLabel}]</option>`;
        }).join('');

        const multiplier = route.fareMultiplier !== undefined ? route.fareMultiplier : 1.0;

        container.innerHTML = `
            <div class="sched-form" style="max-height: 75vh; overflow-y: auto; padding-right: 10px;">
                <!-- Aircraft Selection -->
                <div class="form-row">
                    <label>Aircraft</label>
                    <select id="sp-aircraft">
                        <option value="">${hasFleet ? 'Select aircraft...' : 'No aircraft available'}</option>
                        ${aircraftOptions}
                    </select>
                </div>
                <div id="sp-range-check" class="range-check hidden"></div>
                <div id="sp-aircraft-warning" class="range-check hidden"></div>
                
                <!-- Departure Times -->
                <div class="form-row" style="margin-top: 20px; padding: 16px; background: var(--bg-surface-highlight); border-radius: 8px; border: 1px solid var(--border-color);">
                    <label style="margin-bottom: 12px; font-weight: bold;">Flight Times</label>
                    <div id="sp-times-list" class="times-list" style="margin-bottom: 12px;"></div>
                    
                    <div class="form-row-inline" style="display:flex; gap:16px; align-items:flex-end;">
                        <div style="flex:1;">
                            <label id="sp-lbl-out" style="font-size:11px; color:var(--text-muted); margin-bottom:4px; display:block; text-transform: uppercase;">${hasReturn ? 'Outbound Departure' : 'Departure'}</label>
                            <input type="time" id="sp-new-time-out" value="08:00" data-edited="false" data-auto="false" style="width: 100%; border: 1px solid var(--border-color);" />
                        </div>
                        ${hasReturn ? `
                        <div style="flex:1;" id="sp-ret-container">
                            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px;">
                                <label id="sp-lbl-ret" style="font-size:11px; color:var(--text-muted); margin:0; display:block; text-transform: uppercase;">Return Departure <span style="color:var(--accent-blue)">(Auto)</span></label>
                                <button id="sp-reset-auto" class="btn-text hidden" style="font-size:10px; padding:0; height:auto; color:var(--accent-blue); border:none; background:none; cursor:pointer;">Reset to Auto</button>
                            </div>
                            <input type="time" id="sp-new-time-ret" data-edited="false" data-auto="true" style="width: 100%; border: 1px solid var(--border-color);" />
                        </div>
                        ` : ''}
                        <button class="btn-accent" id="sp-add-time">Add Time${hasReturn ? ' Pair' : ''}</button>
                    </div>
                    <div id="sp-calc-hint" style="font-size:11px; color:var(--text-muted); margin-top:8px; font-family:var(--font-mono); height: 16px;"></div>
                </div>

                <!-- Flight Numbers Generation -->
                <div class="form-row" style="margin-top: 20px;">
                    <label style="margin-bottom: 8px;">Flight Numbers</label>
                    <div id="sp-fn-list" class="uc-fn-list" style="background: var(--bg-surface-highlight); padding: 12px; border-radius: 6px;">
                        <div class="empty-state-sm">Add departure times above to assign flight numbers.</div>
                    </div>
                </div>

                <!-- Pricing Preview Panel -->
                <div class="form-row" style="margin-top: 24px; padding: 16px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card);">
                    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <label style="font-weight: bold; margin: 0;">Pricing Setup</label>
                    </div>

                    <div style="display:flex; justify-content: space-between; margin-bottom: 8px; font-size:12px;">
                        <span>Base Fare: <strong>$${Math.round(route.baseFare)}</strong></span>
                        <span>Multiplier: <strong id="sp-fare-val" style="color:var(--accent-blue);">${multiplier.toFixed(2)}x</strong></span>
                    </div>
                    <input type="range" id="sp-fare-slider" min="0.6" max="1.6" step="0.01" value="${multiplier}" style="width: 100%; cursor: pointer;">
                    
                    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px;">
                        <div>
                            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Ticket Price</div>
                            <div id="sp-prev-price" style="font-family: var(--font-mono); font-size: 14px; font-weight: bold;">$${Math.round(route.baseFare * multiplier)}</div>
                        </div>
                        <div>
                            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Est. Local Demand</div>
                            <div id="sp-prev-demand" style="font-family: var(--font-mono); font-size: 14px; font-weight: bold;">0</div>
                        </div>
                        <div>
                            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Est. Load Factor</div>
                            <div id="sp-prev-lf" style="font-family: var(--font-mono); font-size: 14px; font-weight: bold;">0%</div>
                        </div>
                        <div>
                            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Est. Daily Rev.</div>
                            <div id="sp-prev-rev" style="font-family: var(--font-mono); font-size: 14px; font-weight: bold; color: var(--color-success);">0</div>
                        </div>
                    </div>
                </div>

                <div id="sp-validation-errors" class="validation-errors hidden" style="margin-top: 24px;"></div>
                
                <div class="sched-editor-actions" style="margin-top: 24px;">
                    <button class="btn-accent" id="sp-confirm">${mode === 'edit' ? 'Save Changes' : 'Create Schedule'}</button>
                    ${mode === 'edit' ? '<button class="btn-danger" id="sp-delete" style="margin-left:auto;">Delete Schedule</button>' : ''}
                </div>
            </div>
        `;

        bindEvents();
        updateTimesListDOM();
        refreshFlightNumbersDOM();
        updateFarePreview(multiplier);
        if (aircraftId) checkRange();
    }

    function bindEvents() {
        const outInput = container.querySelector('#sp-new-time-out');
        const retInput = container.querySelector('#sp-new-time-ret');
        const acSelect = container.querySelector('#sp-aircraft');

        acSelect.addEventListener('change', (e) => {
            aircraftId = parseInt(e.target.value);
            outInput.dataset.auto = "false";
            if (retInput) retInput.dataset.auto = "true";
            checkRange();
            updateAutoCalc('out');
        });

        outInput.addEventListener('input', () => {
            outInput.dataset.edited = "true";
            outInput.dataset.auto = "false";
            container.querySelector('#sp-lbl-out').textContent = hasReturn ? 'Outbound Departure' : 'Departure';
            updateAutoCalc('out');
        });

        if (retInput) {
            const resetBtn = container.querySelector('#sp-reset-auto');
            retInput.addEventListener('input', () => {
                retInput.dataset.auto = "false";
                container.querySelector('#sp-lbl-ret').innerHTML = 'Return Departure <span style="color:var(--accent-yellow)">(Manual Override)</span>';
                if (resetBtn) resetBtn.classList.remove('hidden');
                updateAutoCalc('ret');
            });

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    retInput.dataset.auto = "true";
                    resetBtn.classList.add('hidden');
                    updateAutoCalc('out');
                });
            }
        }

        container.querySelector('#sp-add-time').addEventListener('click', () => {
            if (!outInput.value && !retInput?.value) return;

            if (outInput.value) {
                const [h, m] = outInput.value.split(':').map(Number);
                currentOutTimes.push({ hour: h, minute: m });
            }
            if (hasReturn && retInput.value) {
                const [h, m] = retInput.value.split(':').map(Number);
                currentRetTimes.push({ hour: h, minute: m });
            }

            // Sync structural alignment before adding fresh unmapped IDs
            const numTotal = currentOutTimes.length + currentRetTimes.length;
            const newFns = generateFlightNumbers(2); // Over-generate safely

            if (outInput.value && currentOutFns.length < currentOutTimes.length) {
                currentOutFns.push(newFns[0]);
            }
            if (hasReturn && retInput.value && currentRetFns.length < currentRetTimes.length) {
                currentRetFns.push(newFns[1] || newFns[0]);
            }

            updateTimesListDOM();
            refreshFlightNumbersDOM();
            // Re-derive fare preview with updated time count
            const curSlider = container.querySelector('#sp-fare-slider');
            if (curSlider) updateFarePreview(parseFloat(curSlider.value));
        });

        const slider = container.querySelector('#sp-fare-slider');
        const valLbl = container.querySelector('#sp-fare-val');
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            valLbl.textContent = val.toFixed(2) + 'x';
            updateFarePreview(val);
        });

        // fareMultiplier is committed in onConfirmClick, not on slider drag,
        // so cancelling the panel doesn't permanently change the fare.

        container.querySelector('#sp-confirm').addEventListener('click', onConfirmClick);
        if (mode === 'edit') {
            container.querySelector('#sp-delete').addEventListener('click', () => {
                deleteSchedule(scheduleId);
                if (returnSchedule) deleteSchedule(returnSchedule.id);
                closeModal();
                showPanel('routes'); // refresh container implicitly
            });
        }
    }

    function checkRange() {
        const rangeDiv = container.querySelector('#sp-range-check');
        const warnDiv = container.querySelector('#sp-aircraft-warning');

        if (!aircraftId) {
            rangeDiv.classList.add('hidden');
            warnDiv.classList.add('hidden');
            return;
        }

        const aircraft = state.fleet.find(f => f.id === aircraftId);
        if (!aircraft) return;

        const acData = getAircraftByType(aircraft.type);
        const can = canAircraftFlyRoute(aircraft.type, route.distance);
        const blockTime = calculateBlockTime(route.distance, aircraft.type);
        const turnaround = getTurnaroundTime(aircraft.type);

        rangeDiv.classList.remove('hidden');
        if (can) {
            rangeDiv.className = 'range-check ok';
            rangeDiv.textContent = `Range OK (${acData.rangeKm}km \u2265 ${Math.round(route.distance)}km). Block: ${Math.floor(blockTime / 60)}h${blockTime % 60}m, Turnaround: ${turnaround}m`;
        } else {
            rangeDiv.className = 'range-check fail';
            rangeDiv.textContent = `Out of range! ${acData.rangeKm}km < ${Math.round(route.distance)}km`;
        }

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

        let outVal = container.querySelector('#sp-new-time-out').value;
        let pMin = 0;
        if (outVal) {
            const [h, m] = outVal.split(':').map(Number);
            pMin = h * 60 + m;
        }

        const nextLoc = getAircraftNextOperationalLocation(aircraftId, pMin, mode === 'edit' ? scheduleId : null);

        if (nextLoc && nextLoc !== route.origin && nextLoc !== 'airborne') {
            warnings.push(`${aircraft.registration} will be at ${nextLoc} — must be at ${route.origin} to operate this flight.`);
        } else if (nextLoc === 'airborne') {
            warnings.push(`${aircraft.registration} will be airborne at this time.`);
        } else if (!nextLoc && aircraft.currentLocation && aircraft.currentLocation !== route.origin && !aircraft.currentLocation.startsWith('airborne:')) {
            warnings.push(`${aircraft.registration} is currently at ${aircraft.currentLocation}.`);
        }

        if (warnings.length > 0) {
            warnDiv.classList.remove('hidden');
            warnDiv.className = 'range-check fail';
            warnDiv.textContent = warnings.join(' | ');
        } else {
            warnDiv.classList.add('hidden');
        }
    }

    function updateAutoCalc(source) {
        if (!aircraftId) return;
        const ac = state.fleet.find(f => f.id === aircraftId);
        if (!ac) return;

        const blockTime = calculateBlockTime(route.distance, ac.type);
        const turnaround = getTurnaroundTime(ac.type);
        const legDuration = blockTime + turnaround;

        const outInput = container.querySelector('#sp-new-time-out');
        const retInput = container.querySelector('#sp-new-time-ret');
        const calcHint = container.querySelector('#sp-calc-hint');
        const lblOut = container.querySelector('#sp-lbl-out');
        const lblRet = container.querySelector('#sp-lbl-ret');

        let hintHtml = `Block Time: ${Math.floor(blockTime / 60)}h${blockTime % 60}m | Turnaround: ${turnaround}m`;

        if (!hasReturn) {
            calcHint.innerHTML = hintHtml;
            return;
        }

        hintHtml += ` | Route: ${route.origin} → ${route.destination} → ${route.origin}`;

        let outVal = outInput.value;
        let retVal = retInput.value;
        const resetBtn = container.querySelector('#sp-reset-auto');

        if (source === 'out' && outVal) {
            outInput.dataset.edited = "true";
            if (!retVal || retInput.dataset.auto === "true") {
                const [h, m] = outVal.split(':').map(Number);
                const rawMins = h * 60 + m;
                const retMins = (rawMins + legDuration + 1440) % 1440;
                retInput.value = `${String(Math.floor(retMins / 60)).padStart(2, '0')}:${String(retMins % 60).padStart(2, '0')}`;
                retInput.dataset.auto = "true";

                lblRet.innerHTML = `Return Departure <span style="color:var(--accent-blue)">(Auto)</span>`;
                if (resetBtn) resetBtn.classList.add('hidden');

                const returnArrMins = rawMins + legDuration * 2;
                if (returnArrMins >= 2880) hintHtml += ` <span style="color:var(--accent-yellow)">(Return Arrival +2 Days)</span>`;
                else if (returnArrMins >= 1440) hintHtml += ` <span style="color:var(--accent-yellow)">(Return Arrival +1 Day)</span>`;
                else hintHtml += ` <span style="color:var(--text-muted)">(Aircraft arrives ${route.origin} at ${String(Math.floor(returnArrMins / 60) % 24).padStart(2, '0')}:${String(returnArrMins % 60).padStart(2, '0')})</span>`;
            }
        } else if (source === 'ret' && retVal) {
            retInput.dataset.edited = "true";
            retInput.dataset.auto = "false";
            lblRet.innerHTML = `Return Departure <span style="color:var(--accent-yellow)">(Manual Override)</span>`;
            if (resetBtn) resetBtn.classList.remove('hidden');

            if (!outVal || outInput.dataset.auto === "true" || outInput.dataset.edited !== "true") {
                const [h, m] = retVal.split(':').map(Number);
                const rawMins = h * 60 + m;
                const outMins = (rawMins - legDuration + 1440) % 1440;
                outInput.value = `${String(Math.floor(outMins / 60)).padStart(2, '0')}:${String(outMins % 60).padStart(2, '0')}`;
                outInput.dataset.auto = "true";

                lblOut.innerHTML = `Outbound Departure <span style="color:var(--accent-blue)">(Auto)</span>`;
                hintHtml += ` <span style="color:var(--text-muted)">(Outbound back-calculated)</span>`;
                if (rawMins - legDuration < 0) hintHtml += ` <span style="color:var(--accent-yellow)">(Outbound -1 Day)</span>`;
            }
        }

        calcHint.innerHTML = hintHtml;
    }

    function updateTimesListDOM() {
        const list = container.querySelector('#sp-times-list');
        const maxLen = Math.max(currentOutTimes.length, currentRetTimes.length);
        if (maxLen === 0) {
            list.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 0; i < maxLen; i++) {
            let label = [];
            if (currentOutTimes[i]) label.push(`Out: ${String(currentOutTimes[i].hour).padStart(2, '0')}:${String(currentOutTimes[i].minute).padStart(2, '0')}`);
            if (currentRetTimes[i]) label.push(`Ret: ${String(currentRetTimes[i].hour).padStart(2, '0')}:${String(currentRetTimes[i].minute).padStart(2, '0')}`);

            html += `
                <span class="time-tag" style="margin-right: 8px;">${label.join(' \u2192 ')}
                    <button class="time-remove" data-idx="${i}" style="margin-left:6px; cursor:pointer; background:none; border:none; color:inherit;">\u00d7</button>
                </span>
            `;
        }
        list.innerHTML = html;

        list.querySelectorAll('.time-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                currentOutTimes.splice(idx, 1);
                currentOutFns.splice(idx, 1);
                currentRetTimes.splice(idx, 1);
                currentRetFns.splice(idx, 1);
                updateTimesListDOM();
                refreshFlightNumbersDOM();
            });
        });
    }

    function refreshFlightNumbersDOM() {
        const fnDiv = container.querySelector('#sp-fn-list');

        if (currentOutTimes.length === 0 && currentRetTimes.length === 0) {
            fnDiv.innerHTML = '<div class="empty-state-sm">Add departure times above to assign flight numbers.</div>';
            return;
        }

        let html = '';
        if (currentOutTimes.length > 0) {
            html += `<div class="uc-fn-group"><div class="uc-fn-label" style="font-size:11px; margin-bottom: 4px;">${route.origin} \u2192 ${route.destination}</div>`;
            currentOutTimes.forEach((t, i) => {
                html += `<div class="uc-fn-row" style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                    <span class="uc-fn-time" style="font-family:var(--font-mono);">${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}</span>
                    <input type="text" class="sp-fn-out-input" data-idx="${i}" value="${currentOutFns[i] || ''}" maxlength="8" style="width:100px; text-align:right;" />
                </div>`;
            });
            html += '</div>';
        }

        if (currentRetTimes.length > 0) {
            html += `<div class="uc-fn-group" style="margin-top: 12px;"><div class="uc-fn-label" style="font-size:11px; margin-bottom: 4px;">${route.destination} \u2192 ${route.origin}</div>`;
            currentRetTimes.forEach((t, i) => {
                html += `<div class="uc-fn-row" style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                    <span class="uc-fn-time" style="font-family:var(--font-mono);">${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}</span>
                    <input type="text" class="sp-fn-ret-input" data-idx="${i}" value="${currentRetFns[i] || ''}" maxlength="8" style="width:100px; text-align:right;" />
                </div>`;
            });
            html += '</div>';
        }

        fnDiv.innerHTML = html;

        fnDiv.querySelectorAll('.sp-fn-out-input').forEach(inp => {
            inp.addEventListener('change', (e) => { currentOutFns[parseInt(e.target.dataset.idx)] = e.target.value.trim(); });
        });
        fnDiv.querySelectorAll('.sp-fn-ret-input').forEach(inp => {
            inp.addEventListener('change', (e) => { currentRetFns[parseInt(e.target.dataset.idx)] = e.target.value.trim(); });
        });
    }

    function updateFarePreview(mul) {
        const ticketPrice = route.baseFare * mul;
        const priceElasticity = Math.max(0.25, 1 - (mul - 1) * 0.8);
        const estDemand = calculateRouteDemand(getAirportByIata(route.origin), getAirportByIata(route.destination), route.distance) * priceElasticity;

        container.querySelector('#sp-prev-price').textContent = '$' + Math.round(ticketPrice);
        container.querySelector('#sp-prev-demand').textContent = Math.round(estDemand);

        if (aircraftId) {
            const ac = state.fleet.find(f => f.id === aircraftId);
            const seats = ac ? getAircraftByType(ac.type).seats * currentOutTimes.length : 0;
            const lf = seats > 0 ? Math.min(1, estDemand / seats) : 0;
            const rev = Math.round(seats * lf * ticketPrice);

            container.querySelector('#sp-prev-lf').textContent = (lf * 100).toFixed(1) + '%';
            container.querySelector('#sp-prev-rev').textContent = '$' + formatMoney(rev);
        } else {
            container.querySelector('#sp-prev-lf').textContent = '—';
            container.querySelector('#sp-prev-rev').textContent = '—';
        }
    }

    function onConfirmClick() {
        const errDiv = container.querySelector('#sp-validation-errors');
        if (!aircraftId) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-error-item">Aircraft must be selected.</div>';
            return;
        }

        let errors = validateScheduleParams(route.id, aircraftId, 'CUSTOM', currentOutTimes, null, mode === 'edit' ? scheduleId : null);
        if (hasReturn && currentRetTimes.length > 0) {
            const retErrors = validateScheduleParams(pairedRoute.id, aircraftId, 'CUSTOM', currentRetTimes, null, mode === 'edit' && returnSchedule ? returnSchedule.id : null, route.destination);
            errors = errors.concat(retErrors);
        }

        if (errors.length > 0) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = errors.map(e => `<div class="validation-error-item">${e}</div>`).join('');
            return;
        }

        // Commit fare multiplier on confirm only
        const finalFare = parseFloat(container.querySelector('#sp-fare-slider').value);
        route.fareMultiplier = finalFare;
        if (pairedRoute) pairedRoute.fareMultiplier = finalFare;

        if (mode === 'edit') {
            updateSchedule(scheduleId, route.id, aircraftId, 'CUSTOM', currentOutTimes, null, currentOutFns);
            if (hasReturn && returnSchedule) {
                updateSchedule(returnSchedule.id, pairedRoute.id, aircraftId, 'CUSTOM', currentRetTimes, null, currentRetFns);
            } else if (hasReturn && !returnSchedule && currentRetTimes.length > 0) {
                createSchedule(pairedRoute.id, aircraftId, 'CUSTOM', currentRetTimes, null, currentRetFns);
            }
        } else {
            if (currentOutTimes.length > 0) {
                createSchedule(route.id, aircraftId, 'CUSTOM', currentOutTimes, null, currentOutFns);
            }
            if (hasReturn && currentRetTimes.length > 0) {
                createSchedule(pairedRoute.id, aircraftId, 'CUSTOM', currentRetTimes, null, currentRetFns);
            }
        }

        closeModal();

        // Refresh whatever is behind us natively avoiding circular dependencies if possible.
        showPanel(state.ui.selectedPanel || 'routes');
    }

    render();
}
