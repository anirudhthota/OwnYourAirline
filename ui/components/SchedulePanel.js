import { getState, getGameTime, formatMoney } from '../../engine/state.js';
import { getRouteById, calculateBlockTime, canAircraftFlyRoute, calculateRouteDemand, calculatePriceElasticity } from '../../engine/routeEngine.js';
import { getAircraftByType, getTurnaroundTime } from '../../data/aircraft.js';
import { getAirportByIata } from '../../data/airports.js';
import { getAircraftNextFree } from '../../engine/fleetManager.js';
import { createSchedule, updateSchedule, deleteSchedule, generateFlightNumbers, validateScheduleParams, calculateMinAircraft } from '../../engine/scheduler.js';
import { showModal, closeModal } from './Modal.js';
import { showPanel } from '../services/uiState.js';
import { getAircraftNextOperationalLocation } from '../../engine/rotationEngine.js';
import { evaluateAircraftFeasibility, recalculateTimingForAircraft, getFitStatusDisplay, FIT_STATUS } from '../../engine/planningEngine.js';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    let currentDaysOfWeek = [0, 1, 2, 3, 4, 5, 6];

    if (mode === 'edit') {
        currentOutTimes = [...schedule.departureTimes];
        if (schedule.flightNumbers) currentOutFns = [...schedule.flightNumbers];
        if (schedule.daysOfWeek) currentDaysOfWeek = [...schedule.daysOfWeek];
        if (returnSchedule) {
            currentRetTimes = [...returnSchedule.departureTimes];
            if (returnSchedule.flightNumbers) currentRetFns = [...returnSchedule.flightNumbers];
        }
    }

    const title = mode === 'edit' ? `Edit Schedule (${route.origin} → ${route.destination})` : `Create Schedule (${route.origin} → ${route.destination})`;

    const container = showModal(title, '<div id="sp-content"></div>', null);

    function render() {
        const multiplier = route.fareMultiplier !== undefined ? route.fareMultiplier : 1.0;

        container.innerHTML = `
            <div class="sched-form" style="max-height: 75vh; overflow-y: auto; padding-right: 10px;">
                <!-- Step 1: Flight Times -->
                <div class="form-row" style="padding: 16px; background: var(--bg-surface-highlight); border-radius: 8px; border: 1px solid var(--border-color);">
                    <label style="margin-bottom: 12px; font-weight: bold;">Step 1 — Flight Times</label>
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

                <!-- Days of Week Selector -->
                <div class="form-row" style="margin-top: 16px; padding: 12px 16px; background: var(--bg-surface-highlight); border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                        <label style="font-weight: bold; font-size: 12px; margin: 0;">Days of Week</label>
                        <button id="sp-dow-toggle" class="btn-text" style="font-size:10px; padding:0; height:auto; color:var(--accent-blue); border:none; background:none; cursor:pointer;">Toggle All</button>
                    </div>
                    <div id="sp-dow-pills" style="display:flex; gap: 6px;"></div>
                    <div id="sp-dow-summary" style="font-size:11px; color:var(--text-muted); margin-top:6px;"></div>
                </div>

                <!-- Step 2: Aircraft Selection via Feasibility -->
                <div class="form-row" style="margin-top: 20px; padding: 16px; background: var(--bg-surface-highlight); border-radius: 8px; border: 1px solid var(--border-color);">
                    <label style="margin-bottom: 12px; font-weight: bold;">Step 2 — Aircraft Selection</label>
                    <div id="sp-feasibility-hint" style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">
                        ${currentOutTimes.length > 0 || mode === 'edit' ? '' : 'Add at least one departure time above to see aircraft feasibility.'}
                    </div>
                    <div id="sp-feasibility-table"></div>
                    <div id="sp-range-check" class="range-check hidden"></div>
                    <div id="sp-aircraft-warning" class="range-check hidden"></div>
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
                            <div id="sp-prev-lf" style="font-family: var(--font-mono); font-size: 14px; font-weight: bold;">—</div>
                        </div>
                        <div>
                            <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Est. Daily Rev.</div>
                            <div id="sp-prev-rev" style="font-family: var(--font-mono); font-size: 14px; font-weight: bold; color: var(--color-success);">—</div>
                        </div>
                    </div>
                </div>

                <div id="sp-validation-errors" class="validation-errors hidden" style="margin-top: 24px;"></div>
                <div id="sp-validation-warnings" style="margin-top: 8px;"></div>
                
                <div class="sched-editor-actions" style="margin-top: 24px;">
                    <button class="btn-accent" id="sp-confirm">${mode === 'edit' ? 'Save Changes' : 'Create Schedule'}</button>
                    ${mode === 'edit' ? '<button class="btn-danger" id="sp-delete" style="margin-left:auto;">Delete Schedule</button>' : ''}
                </div>
            </div>
        `;

        bindEvents();
        renderDaysOfWeek();
        updateTimesListDOM();
        refreshFlightNumbersDOM();
        updateFarePreview(multiplier);
        if (aircraftId) {
            checkRange();
        }
        if (currentOutTimes.length > 0 || mode === 'edit') {
            refreshFeasibilityTable();
        }
    }

    function bindEvents() {
        const outInput = container.querySelector('#sp-new-time-out');
        const retInput = container.querySelector('#sp-new-time-ret');

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

            const newFns = generateFlightNumbers(2);
            if (outInput.value && currentOutFns.length < currentOutTimes.length) {
                currentOutFns.push(newFns[0]);
            }
            if (hasReturn && retInput.value && currentRetFns.length < currentRetTimes.length) {
                currentRetFns.push(newFns[1] || newFns[0]);
            }

            updateTimesListDOM();
            refreshFlightNumbersDOM();
            refreshFeasibilityTable();

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

        container.querySelector('#sp-confirm').addEventListener('click', onConfirmClick);
        if (mode === 'edit') {
            container.querySelector('#sp-delete').addEventListener('click', () => {
                deleteSchedule(scheduleId);
                if (returnSchedule) deleteSchedule(returnSchedule.id);
                closeModal();
                showPanel('routes');
            });
        }

        // Days of week toggle all
        container.querySelector('#sp-dow-toggle').addEventListener('click', () => {
            if (currentDaysOfWeek.length === 7) {
                // Switch to weekdays only
                currentDaysOfWeek = [1, 2, 3, 4, 5];
            } else {
                currentDaysOfWeek = [0, 1, 2, 3, 4, 5, 6];
            }
            renderDaysOfWeek();
        });
    }

    // === Days of Week ===

    function renderDaysOfWeek() {
        const pillContainer = container.querySelector('#sp-dow-pills');
        const summaryDiv = container.querySelector('#sp-dow-summary');

        let html = '';
        for (let d = 0; d < 7; d++) {
            const active = currentDaysOfWeek.includes(d);
            html += `<button data-day="${d}" class="sp-dow-pill" style="
                width: 36px; height: 32px; border-radius: 6px; border: 1px solid var(--border-color);
                font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s;
                background: ${active ? 'var(--accent-blue)' : 'var(--bg-card)'};
                color: ${active ? '#fff' : 'var(--text-muted)'};
            ">${DAY_LABELS[d]}</button>`;
        }
        pillContainer.innerHTML = html;

        pillContainer.querySelectorAll('.sp-dow-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const day = parseInt(e.target.dataset.day);
                const idx = currentDaysOfWeek.indexOf(day);
                if (idx >= 0) {
                    if (currentDaysOfWeek.length > 1) currentDaysOfWeek.splice(idx, 1);
                } else {
                    currentDaysOfWeek.push(day);
                    currentDaysOfWeek.sort((a, b) => a - b);
                }
                renderDaysOfWeek();
            });
        });

        // Summary text
        if (currentDaysOfWeek.length === 7) {
            summaryDiv.textContent = 'Daily';
        } else if (currentDaysOfWeek.length === 0) {
            summaryDiv.textContent = 'No days selected';
        } else if (JSON.stringify(currentDaysOfWeek) === JSON.stringify([1, 2, 3, 4, 5])) {
            summaryDiv.textContent = 'Weekdays (Mon–Fri)';
        } else if (JSON.stringify(currentDaysOfWeek) === JSON.stringify([0, 6])) {
            summaryDiv.textContent = 'Weekends (Sat–Sun)';
        } else {
            summaryDiv.textContent = currentDaysOfWeek.map(d => DAY_FULL[d]).join(', ');
        }
    }

    // === Aircraft Feasibility Table ===

    function refreshFeasibilityTable() {
        const tableDiv = container.querySelector('#sp-feasibility-table');
        const hintDiv = container.querySelector('#sp-feasibility-hint');

        if (currentOutTimes.length === 0 && mode !== 'edit') {
            hintDiv.textContent = 'Add at least one departure time above to see aircraft feasibility.';
            tableDiv.innerHTML = '';
            return;
        }

        hintDiv.textContent = '';

        // Get outbound departure minute for feasibility evaluation
        let outDepMin = 480; // default 08:00
        if (currentOutTimes.length > 0) {
            outDepMin = currentOutTimes[0].hour * 60 + currentOutTimes[0].minute;
        }

        const excludeId = mode === 'edit' ? scheduleId : null;
        const feasibility = evaluateAircraftFeasibility(route.id, outDepMin, null, excludeId);

        if (feasibility.length === 0) {
            tableDiv.innerHTML = '<div style="font-size:12px; color:var(--text-muted); padding:8px;">No aircraft in fleet.</div>';
            return;
        }

        // Group by fit status
        const groups = {};
        for (const r of feasibility) {
            if (!groups[r.fitStatus]) groups[r.fitStatus] = [];
            groups[r.fitStatus].push(r);
        }

        let html = '<div style="max-height: 200px; overflow-y: auto;">';

        for (const status of Object.keys(groups)) {
            const display = getFitStatusDisplay(status);
            const items = groups[status];
            const isBlocked = status.startsWith('blocked_');

            html += `<div style="margin-bottom: 8px;">`;
            html += `<div style="font-size:10px; color:${display.color}; text-transform:uppercase; font-weight:600; margin-bottom:4px;">${display.icon} ${display.label} (${items.length})</div>`;

            for (const item of items) {
                const selected = item.aircraftId === aircraftId;
                const clickable = !isBlocked;
                html += `<div class="sp-ac-row" data-acid="${item.aircraftId}" style="
                    display:flex; justify-content:space-between; align-items:center;
                    padding: 6px 10px; margin-bottom: 2px; border-radius: 6px;
                    border: 1px solid ${selected ? 'var(--accent-blue)' : 'var(--border-color)'};
                    background: ${selected ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)'};
                    cursor: ${clickable ? 'pointer' : 'not-allowed'};
                    opacity: ${isBlocked ? '0.5' : '1'};
                    font-size: 12px; transition: all 0.1s;
                " ${clickable ? '' : 'data-blocked="true"'}>
                    <div>
                        <strong>${item.registration}</strong>
                        <span style="color:var(--text-muted); margin-left:8px;">${item.type}</span>
                        <span style="color:var(--text-muted); margin-left:8px;">${item.seats} seats</span>
                    </div>
                    <div style="text-align:right; font-size:11px;">
                        <span style="color:var(--text-muted);">${item.currentLocation}</span>
                        ${item.recalculatedReturnMinute != null ? `<span style="margin-left:8px; color:var(--accent-blue);">Ret ${formatMinute(item.recalculatedReturnMinute)}</span>` : ''}
                        ${item.notes && !isBlocked ? `<span style="margin-left:8px; color:${display.color};">${item.notes}</span>` : ''}
                        ${isBlocked ? `<span style="margin-left:8px; color:${display.color};">${item.notes}</span>` : ''}
                    </div>
                </div>`;
            }
            html += '</div>';
        }

        html += '</div>';
        tableDiv.innerHTML = html;

        // Bind click on available aircraft rows
        tableDiv.querySelectorAll('.sp-ac-row:not([data-blocked])').forEach(row => {
            row.addEventListener('click', () => {
                aircraftId = parseInt(row.dataset.acid);
                checkRange();
                updateAutoCalcForSelectedAircraft();
                refreshFeasibilityTable(); // re-render to show selection
                const curSlider = container.querySelector('#sp-fare-slider');
                if (curSlider) updateFarePreview(parseFloat(curSlider.value));
            });
        });
    }

    function updateAutoCalcForSelectedAircraft() {
        if (!aircraftId) return;
        const ac = state.fleet.find(f => f.id === aircraftId);
        if (!ac) return;

        const retInput = container.querySelector('#sp-new-time-ret');

        // If return time is auto, recalculate based on selected aircraft
        if (hasReturn && retInput && retInput.dataset.auto === "true") {
            updateAutoCalc('out');
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
        const turnaround = getTurnaroundTime(aircraft.type, route.distance);

        rangeDiv.classList.remove('hidden');
        if (can) {
            rangeDiv.className = 'range-check ok';
            rangeDiv.textContent = `Range OK (${acData.rangeKm}km ≥ ${Math.round(route.distance)}km). Block: ${Math.floor(blockTime / 60)}h${blockTime % 60}m, Turnaround: ${turnaround}m`;
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

        if (warnings.length > 0) {
            warnDiv.classList.remove('hidden');
            warnDiv.className = 'range-check fail';
            warnDiv.textContent = warnings.join(' | ');
        } else {
            warnDiv.classList.add('hidden');
        }
    }

    function updateAutoCalc(source) {
        // Use a provisional aircraft for timing hints if one is selected
        let acType = null;
        if (aircraftId) {
            const ac = state.fleet.find(f => f.id === aircraftId);
            if (ac) acType = ac.type;
        }

        // If no aircraft selected, use median fleet timing for hints
        let blockTime, turnaround;
        if (acType) {
            blockTime = calculateBlockTime(route.distance, acType);
            turnaround = getTurnaroundTime(acType, route.distance);
        } else {
            // Estimate with A320neo as median aircraft type for provisional calc
            blockTime = calculateBlockTime(route.distance, 'A320neo');
            turnaround = getTurnaroundTime('A320neo', route.distance);
        }
        const legDuration = blockTime + turnaround;

        const outInput = container.querySelector('#sp-new-time-out');
        const retInput = container.querySelector('#sp-new-time-ret');
        const calcHint = container.querySelector('#sp-calc-hint');
        const lblOut = container.querySelector('#sp-lbl-out');
        const lblRet = container.querySelector('#sp-lbl-ret');

        let hintHtml = `Block: ${Math.floor(blockTime / 60)}h${blockTime % 60}m | Turn: ${turnaround}m`;
        if (!acType) hintHtml += ' <span style="color:var(--text-muted);">(provisional)</span>';

        if (!hasReturn) {
            calcHint.innerHTML = hintHtml;
            return;
        }

        hintHtml += ` | ${route.origin} → ${route.destination} → ${route.origin}`;

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

                lblRet.innerHTML = `Return Departure <span style="color:var(--accent-blue)">(Auto${acType ? '' : ' · Provisional'})</span>`;
                if (resetBtn) resetBtn.classList.add('hidden');

                const returnArrMins = rawMins + legDuration * 2;
                if (returnArrMins >= 2880) hintHtml += ` <span style="color:var(--accent-yellow)">(Return +2 Days)</span>`;
                else if (returnArrMins >= 1440) hintHtml += ` <span style="color:var(--accent-yellow)">(Return +1 Day)</span>`;
                else hintHtml += ` <span style="color:var(--text-muted)">(Back at ${route.origin} ${String(Math.floor(returnArrMins / 60) % 24).padStart(2, '0')}:${String(returnArrMins % 60).padStart(2, '0')})</span>`;
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
                <span class="time-tag" style="margin-right: 8px;">${label.join(' → ')}
                    <button class="time-remove" data-idx="${i}" style="margin-left:6px; cursor:pointer; background:none; border:none; color:inherit;">×</button>
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
                refreshFeasibilityTable();
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
            html += `<div class="uc-fn-group"><div class="uc-fn-label" style="font-size:11px; margin-bottom: 4px;">${route.origin} → ${route.destination}</div>`;
            currentOutTimes.forEach((t, i) => {
                html += `<div class="uc-fn-row" style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                    <span class="uc-fn-time" style="font-family:var(--font-mono);">${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}</span>
                    <input type="text" class="sp-fn-out-input" data-idx="${i}" value="${currentOutFns[i] || ''}" maxlength="8" style="width:100px; text-align:right;" />
                </div>`;
            });
            html += '</div>';
        }

        if (currentRetTimes.length > 0) {
            html += `<div class="uc-fn-group" style="margin-top: 12px;"><div class="uc-fn-label" style="font-size:11px; margin-bottom: 4px;">${route.destination} → ${route.origin}</div>`;
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
        const priceElasticity = calculatePriceElasticity(mul);
        const estDemand = calculateRouteDemand(getAirportByIata(route.origin), getAirportByIata(route.destination), route.distance) * priceElasticity;

        container.querySelector('#sp-prev-price').textContent = '$' + Math.round(ticketPrice);
        container.querySelector('#sp-prev-demand').textContent = Math.round(estDemand);

        if (aircraftId) {
            const ac = state.fleet.find(f => f.id === aircraftId);
            if (ac) {
                const acSeats = getAircraftByType(ac.type).seats;
                // Use at least 1 frequency for preview when times haven't been added yet
                const freq = Math.max(1, currentOutTimes.length);
                const seats = acSeats * freq;
                const lf = seats > 0 ? Math.min(1, estDemand / seats) : 0;
                const rev = Math.round(seats * lf * ticketPrice);

                container.querySelector('#sp-prev-lf').textContent = (lf * 100).toFixed(1) + '%';
                container.querySelector('#sp-prev-rev').textContent = '$' + formatMoney(rev);
            } else {
                container.querySelector('#sp-prev-lf').textContent = '—';
                container.querySelector('#sp-prev-rev').textContent = '—';
            }
        } else {
            container.querySelector('#sp-prev-lf').textContent = 'Pending aircraft';
            container.querySelector('#sp-prev-rev').textContent = 'Pending aircraft';
        }
    }

    function onConfirmClick() {
        const errDiv = container.querySelector('#sp-validation-errors');
        const warnDiv = container.querySelector('#sp-validation-warnings');

        if (!aircraftId) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-error-item">Aircraft must be selected.</div>';
            return;
        }

        if (currentOutTimes.length === 0) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-error-item">At least one departure time is required.</div>';
            return;
        }

        if (currentDaysOfWeek.length === 0) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-error-item">At least one day of the week must be selected.</div>';
            return;
        }

        let result = validateScheduleParams(route.id, aircraftId, 'CUSTOM', currentOutTimes, null, mode === 'edit' ? scheduleId : null);
        let allErrors = [...result.errors];
        let allWarnings = [...result.warnings];

        if (hasReturn && currentRetTimes.length > 0) {
            const retResult = validateScheduleParams(pairedRoute.id, aircraftId, 'CUSTOM', currentRetTimes, null, mode === 'edit' && returnSchedule ? returnSchedule.id : null, route.destination);
            allErrors = allErrors.concat(retResult.errors);
            allWarnings = allWarnings.concat(retResult.warnings);
        }

        if (allErrors.length > 0) {
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = allErrors.map(e => `<div class="validation-error-item">${e}</div>`).join('');
            return;
        }

        // Show warnings but don't block
        if (allWarnings.length > 0) {
            warnDiv.innerHTML = allWarnings.map(w => `<div style="font-size:12px; color:var(--color-warning); padding:4px 0;">⚠️ ${w}</div>`).join('');
        }

        errDiv.classList.add('hidden');

        // Commit fare multiplier on confirm only
        const finalFare = parseFloat(container.querySelector('#sp-fare-slider').value);
        route.fareMultiplier = finalFare;
        if (pairedRoute) pairedRoute.fareMultiplier = finalFare;

        if (mode === 'edit') {
            updateSchedule(scheduleId, route.id, aircraftId, 'CUSTOM', currentOutTimes, null, currentOutFns);
            // Update daysOfWeek on existing schedule
            const existingSchedule = state.schedules.find(s => s.id === scheduleId);
            if (existingSchedule) existingSchedule.daysOfWeek = [...currentDaysOfWeek];

            if (hasReturn && returnSchedule) {
                updateSchedule(returnSchedule.id, pairedRoute.id, aircraftId, 'CUSTOM', currentRetTimes, null, currentRetFns);
                const existingRet = state.schedules.find(s => s.id === returnSchedule.id);
                if (existingRet) existingRet.daysOfWeek = [...currentDaysOfWeek];
            } else if (hasReturn && !returnSchedule && currentRetTimes.length > 0) {
                createSchedule(pairedRoute.id, aircraftId, 'CUSTOM', currentRetTimes, null, currentRetFns, currentDaysOfWeek);
            }
        } else {
            if (currentOutTimes.length > 0) {
                createSchedule(route.id, aircraftId, 'CUSTOM', currentOutTimes, null, currentOutFns, currentDaysOfWeek);
            }
            if (hasReturn && currentRetTimes.length > 0) {
                createSchedule(pairedRoute.id, aircraftId, 'CUSTOM', currentRetTimes, null, currentRetFns, currentDaysOfWeek);
            }
        }

        closeModal();
        showPanel(state.ui.selectedPanel || 'routes');
    }

    render();
}

function formatMinute(m) {
    const h = Math.floor((m % 1440) / 60);
    const min = (m % 1440) % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
