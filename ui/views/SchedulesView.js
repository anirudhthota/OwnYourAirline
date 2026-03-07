import { getState, getGameTime } from '../../engine/state.js';
import { createSchedule, deleteSchedule, deleteBank, createBank, updateSchedule, validateScheduleParams } from '../../engine/scheduler.js';
import { getRouteById, canAircraftFlyRoute, calculateBlockTime } from '../../engine/routeEngine.js';
import { getAircraftByType, getTurnaroundTime } from '../../data/aircraft.js';
import { getAircraftNextFree } from '../../engine/fleetManager.js';
import { calculateMinAircraft } from '../../engine/scheduler.js';

export function renderSchedulePanel(container) {
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
                
                <div class="form-row-inline" style="display:flex; gap:10px; align-items:flex-end;">
                    <div style="flex:1;">
                        <label id="sc-lbl-out" style="font-size:10px; color:var(--text-muted); margin-bottom:4px; display:block;">Outbound</label>
                        <input type="time" id="sc-new-time-out" value="08:00" />
                    </div>
                    <div style="flex:1;" id="sc-ret-container">
                        <label id="sc-lbl-ret" style="font-size:10px; color:var(--text-muted); margin-bottom:4px; display:block;">Return <span style="color:var(--accent-blue)">(Auto)</span></label>
                        <input type="time" id="sc-new-time-ret" />
                    </div>
                    <button class="btn-sm btn-accent" id="sc-add-time">Add Time</button>
                </div>
                <div id="sc-calc-hint" style="font-size:11px; color:var(--text-muted); margin-top:6px; font-family:var(--font-mono); height: 16px;"></div>
            </div>
            <div id="sc-banked-opts" class="form-row hidden">
                <label>Connection Bank</label>
                <select id="sc-bank">
                    <option value="">Select bank...</option>
                    ${state.banks.map(b => `<option value="${b.id}">${b.name} (${String(b.startTime.hour).padStart(2, '0')}:${String(b.startTime.minute).padStart(2, '0')}-${String(b.endTime.hour).padStart(2, '0')}:${String(b.endTime.minute).padStart(2, '0')})</option>`).join('')}
                </select>
            </div>
            <div id="sc-validation-errors" class="validation-errors hidden"></div>
            <div class="sched-editor-actions">
                <button class="btn-accent" id="sc-confirm">Create Schedule</button>
                <button class="btn-secondary" id="sc-validate">Validate</button>
            </div>
        </div>
    `;

    const customPairs = [];

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
            let msg = `Range OK (${acData.rangeKm}km \u2265 ${route.distance}km). Block: ${Math.floor(blockTime / 60)}h${blockTime % 60}m, Turnaround: ${turnaround}m`;
            if (minAc > 1) {
                msg += ` | Round trip: ${Math.floor(roundTripMinutes / 60)}h${roundTripMinutes % 60}m. This route requires at least ${minAc} aircraft for daily frequency. One aircraft takes ${Math.floor(roundTripMinutes / 60)}h to complete the round trip.`;
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

    const outInput = document.getElementById('sc-new-time-out');
    const retInput = document.getElementById('sc-new-time-ret');
    const calcHint = document.getElementById('sc-calc-hint');
    const retContainer = document.getElementById('sc-ret-container');
    const lblOut = document.getElementById('sc-lbl-out');
    const lblRet = document.getElementById('sc-lbl-ret');

    function updateAutoCalc(source) {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        if (!routeId || !acId) { calcHint.textContent = ''; return; }

        const route = getRouteById(routeId);
        const ac = state.fleet.find(f => f.id === acId);
        if (!route || !ac) return;

        const pairedRoute = route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;
        if (!pairedRoute) {
            retContainer.style.display = 'none';
            lblOut.textContent = 'Departure';
        } else {
            retContainer.style.display = 'block';
            lblOut.textContent = 'Outbound';
        }

        const blockTime = calculateBlockTime(route.distance, ac.type);
        const turnaround = getTurnaroundTime(ac.type);
        const legDuration = blockTime + turnaround;

        const bHrs = Math.floor(blockTime / 60);
        const bMins = blockTime % 60;
        let hintHtml = `Block: ${bHrs}h${bMins}m | Turnaround: ${turnaround}m`;

        let outVal = outInput.value;
        let retVal = retInput.value;

        if (source === 'out' && outVal) {
            outInput.dataset.edited = "true";
            if (pairedRoute && (!retVal || retInput.dataset.auto === "true")) {
                const [h, m] = outVal.split(':').map(Number);
                const rawMins = h * 60 + m;
                const retMins = (rawMins + legDuration + 1440) % 1440;
                retInput.value = `${String(Math.floor(retMins / 60)).padStart(2, '0')}:${String(retMins % 60).padStart(2, '0')}`;
                retInput.dataset.auto = "true";

                lblRet.innerHTML = `Return <span style="color:var(--accent-blue)">(Auto)</span>`;
                if (rawMins + legDuration >= 1440) hintHtml += ` <span style="color:var(--accent-yellow)">(Arrival +1 Day)</span>`;
            }
        } else if (source === 'ret' && retVal) {
            retInput.dataset.edited = "true";
            retInput.dataset.auto = "false";
            lblRet.innerHTML = `Return <span style="color:var(--accent-yellow)">(Manual Override)</span>`;

            if (!outVal || outInput.dataset.auto === "true") {
                const [h, m] = retVal.split(':').map(Number);
                const rawMins = h * 60 + m;
                const outMins = (rawMins - legDuration + 1440) % 1440;
                outInput.value = `${String(Math.floor(outMins / 60)).padStart(2, '0')}:${String(outMins % 60).padStart(2, '0')}`;
                outInput.dataset.auto = "true";

                lblOut.innerHTML = `Outbound <span style="color:var(--accent-blue)">(Auto)</span>`;
                if (rawMins - legDuration < 0) hintHtml += ` <span style="color:var(--accent-yellow)">(Outbound -1 Day)</span>`;
            }
        }

        calcHint.innerHTML = hintHtml;
    }

    outInput.addEventListener('input', () => { outInput.dataset.auto = "false"; lblOut.textContent = 'Outbound'; updateAutoCalc('out'); });
    retInput.addEventListener('input', () => { retInput.dataset.auto = "false"; lblRet.innerHTML = 'Return <span style="color:var(--accent-yellow)">(Manual Override)</span>'; updateAutoCalc('ret'); });
    routeSelect.addEventListener('change', () => { outInput.dataset.auto = "false"; retInput.dataset.auto = "true"; updateAutoCalc('out'); });
    aircraftSelect.addEventListener('change', () => { outInput.dataset.auto = "false"; retInput.dataset.auto = "true"; updateAutoCalc('out'); });

    document.getElementById('sc-add-time').addEventListener('click', () => {
        const routeId = parseInt(routeSelect.value);
        const route = getRouteById(routeId);
        if (!route) return;

        let pair = {};
        if (outInput.value) {
            const [h, m] = outInput.value.split(':').map(Number);
            pair.out = { hour: h, minute: m };
        }
        if (route.pairedRouteId && retInput.value) {
            const [h, m] = retInput.value.split(':').map(Number);
            pair.ret = { hour: h, minute: m };
        }

        if (pair.out || pair.ret) {
            customPairs.push(pair);
            customPairs.sort((a, b) => {
                const aMins = a.out ? a.out.hour * 60 + a.out.minute : (a.ret.hour * 60 + a.ret.minute);
                const bMins = b.out ? b.out.hour * 60 + b.out.minute : (b.ret.hour * 60 + b.ret.minute);
                return aMins - bMins;
            });
            renderTimesList(customPairs);
        }
    });

    function getCreatorValues() {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        const mode = document.getElementById('sc-mode').value;
        const bankId = mode === 'BANKED' ? parseInt(document.getElementById('sc-bank').value) : null;

        const outTimes = mode === 'CUSTOM' ? customPairs.map(p => p.out).filter(Boolean) : [];
        const retTimes = mode === 'CUSTOM' ? customPairs.map(p => p.ret).filter(Boolean) : [];

        return { routeId, acId, mode, outTimes, retTimes, bankId };
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
        const { routeId, acId, mode, outTimes, retTimes, bankId } = getCreatorValues();
        if (!routeId || !acId) {
            showCreatorErrors(['Select both a route and an aircraft']);
            return;
        }

        let errors = validateScheduleParams(routeId, acId, mode, outTimes, bankId);

        const route = getRouteById(routeId);
        if (route && route.pairedRouteId && retTimes.length > 0) {
            const retErrors = validateScheduleParams(route.pairedRouteId, acId, mode, retTimes, bankId);
            errors = errors.concat(retErrors);
        }

        if (errors.length === 0) {
            const errDiv = document.getElementById('sc-validation-errors');
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-ok">All checks passed. Schedule is valid.</div>';
        } else {
            showCreatorErrors(errors);
        }
    });

    document.getElementById('sc-confirm').addEventListener('click', () => {
        const { routeId, acId, mode, outTimes, retTimes, bankId } = getCreatorValues();
        if (!routeId || !acId) {
            showCreatorErrors(['Select both a route and an aircraft']);
            return;
        }

        const route = getRouteById(routeId);
        let errors = validateScheduleParams(routeId, acId, mode, outTimes, bankId);
        if (route && route.pairedRouteId && retTimes.length > 0) {
            const retErrors = validateScheduleParams(route.pairedRouteId, acId, mode, retTimes, bankId);
            errors = errors.concat(retErrors);
        }

        if (errors && errors.length > 0) {
            showCreatorErrors(errors);
            return;
        }

        createSchedule(routeId, acId, mode, outTimes, bankId);
        if (route && route.pairedRouteId && retTimes.length > 0) {
            createSchedule(route.pairedRouteId, acId, mode, retTimes, bankId);
        }

        renderScheduleList();
        creator.classList.add('hidden');
    });

    function renderTimesList(pairs) {
        const list = document.getElementById('sc-times-list');
        list.innerHTML = pairs.map((p, i) => {
            let label = [];
            if (p.out) label.push(`Out: ${String(p.out.hour).padStart(2, '0')}:${String(p.out.minute).padStart(2, '0')}`);
            if (p.ret) label.push(`Ret: ${String(p.ret.hour).padStart(2, '0')}:${String(p.ret.minute).padStart(2, '0')}`);
            return `
            <span class="time-tag">${label.join(' \u2192 ')}
                <button class="time-remove" data-idx="${i}">×</button>
            </span>
        `}).join('');
        list.querySelectorAll('.time-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                customPairs.splice(parseInt(btn.dataset.idx), 1);
                renderTimesList(customPairs);
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

    const rendered = new Set();
    const groups = [];

    for (const sched of state.schedules) {
        if (rendered.has(sched.id)) continue;
        const route = getRouteById(sched.routeId);
        const pairedRoute = route && route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;

        if (pairedRoute) {
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

    const creator = document.getElementById('sched-creator');
    creator.classList.remove('hidden');

    const pairedRoute = route && route.pairedRouteId ? getRouteById(route.pairedRouteId) : null;
    const returnSchedule = pairedRoute ? state.schedules.find(s => s.routeId === pairedRoute.id && s.aircraftId === schedule.aircraftId && s.active) : null;

    const editPairs = [];
    const maxLen = Math.max(schedule.departureTimes.length, returnSchedule ? returnSchedule.departureTimes.length : 0);
    for (let i = 0; i < maxLen; i++) {
        const outT = schedule.departureTimes[i] ? { hour: schedule.departureTimes[i].hour, minute: schedule.departureTimes[i].minute } : null;
        const retT = returnSchedule && returnSchedule.departureTimes[i] ? { hour: returnSchedule.departureTimes[i].hour, minute: returnSchedule.departureTimes[i].minute } : null;
        editPairs.push({ out: outT, ret: retT });
    }

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
                <div class="form-row-inline" style="display:flex; gap:10px; align-items:flex-end;">
                    <div style="flex:1;">
                        <label id="se-lbl-out" style="font-size:10px; color:var(--text-muted); margin-bottom:4px; display:block;">Outbound</label>
                        <input type="time" id="se-new-time-out" value="08:00" />
                    </div>
                    <div style="flex:1;" id="se-ret-container">
                        <label id="se-lbl-ret" style="font-size:10px; color:var(--text-muted); margin-bottom:4px; display:block;">Return <span style="color:var(--accent-blue)">(Auto)</span></label>
                        <input type="time" id="se-new-time-ret" />
                    </div>
                    <button class="btn-sm btn-accent" id="se-add-time">Add Pair</button>
                </div>
                <div id="se-calc-hint" style="font-size:11px; color:var(--text-muted); margin-top:6px; font-family:var(--font-mono); height: 16px;"></div>
            </div>
            <div id="se-banked-opts" class="form-row ${schedule.mode !== 'BANKED' ? 'hidden' : ''}">
                <label>Connection Bank</label>
                <select id="se-bank">
                    <option value="">Select bank...</option>
                    ${state.banks.map(b => '<option value="' + b.id + '"' + (b.id === schedule.bankId ? ' selected' : '') + '>' + b.name + ' (' + String(b.startTime.hour).padStart(2, '0') + ':' + String(b.startTime.minute).padStart(2, '0') + '-' + String(b.endTime.hour).padStart(2, '0') + ':' + String(b.endTime.minute).padStart(2, '0') + ')</option>').join('')}
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

    function renderEditorTimesList() {
        const list = document.getElementById('se-times-list');
        list.innerHTML = editPairs.map((p, i) => {
            let label = [];
            if (p.out) label.push(`Out: ${String(p.out.hour).padStart(2, '0')}:${String(p.out.minute).padStart(2, '0')}`);
            if (p.ret) label.push(`Ret: ${String(p.ret.hour).padStart(2, '0')}:${String(p.ret.minute).padStart(2, '0')}`);
            return `
            <span class="time-tag">${label.join(' \u2192 ')}
                <button class="time-remove" data-idx="${i}">\u00d7</button>
            </span>
        `}).join('');
        list.querySelectorAll('.time-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                editPairs.splice(parseInt(btn.dataset.idx), 1);
                renderEditorTimesList();
            });
        });
    }
    renderEditorTimesList();

    document.getElementById('se-mode').addEventListener('change', (e) => {
        document.getElementById('se-custom-times').classList.toggle('hidden', e.target.value !== 'CUSTOM');
        document.getElementById('se-banked-opts').classList.toggle('hidden', e.target.value !== 'BANKED');
    });

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
            let msg = `Range OK (${acData.rangeKm}km \u2265 ${r.distance}km). Block: ${Math.floor(blockTime / 60)}h${blockTime % 60}m, Turnaround: ${turnaround}m`;
            if (minAc > 1) {
                msg += ` | Round trip: ${Math.floor(roundTripMinutes / 60)}h${roundTripMinutes % 60}m. Requires at least ${minAc} aircraft.`;
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
    checkEditorRange();

    const seOutInput = document.getElementById('se-new-time-out');
    const seRetInput = document.getElementById('se-new-time-ret');
    const seCalcHint = document.getElementById('se-calc-hint');
    const seRetContainer = document.getElementById('se-ret-container');
    const seLblOut = document.getElementById('se-lbl-out');
    const seLblRet = document.getElementById('se-lbl-ret');

    function updateEditorAutoCalc(source) {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        if (!routeId || !acId) { seCalcHint.textContent = ''; return; }

        const r = getRouteById(routeId);
        const ac = state.fleet.find(f => f.id === acId);
        if (!r || !ac) return;

        const pRoute = r.pairedRouteId ? getRouteById(r.pairedRouteId) : null;
        if (!pRoute) {
            seRetContainer.style.display = 'none';
            seLblOut.textContent = 'Departure';
        } else {
            seRetContainer.style.display = 'block';
            seLblOut.textContent = 'Outbound';
        }

        const blockTime = calculateBlockTime(r.distance, ac.type);
        const turnaround = getTurnaroundTime(ac.type);
        const legDuration = blockTime + turnaround;

        const bHrs = Math.floor(blockTime / 60);
        const bMins = blockTime % 60;
        let hintHtml = `Block: ${bHrs}h${bMins}m | Turnaround: ${turnaround}m`;

        let outVal = seOutInput.value;
        let retVal = seRetInput.value;

        if (source === 'out' && outVal) {
            seOutInput.dataset.edited = "true";
            if (pRoute && (!retVal || seRetInput.dataset.auto === "true")) {
                const [h, m] = outVal.split(':').map(Number);
                const rawMins = h * 60 + m;
                const retMins = (rawMins + legDuration + 1440) % 1440;
                seRetInput.value = `${String(Math.floor(retMins / 60)).padStart(2, '0')}:${String(retMins % 60).padStart(2, '0')}`;
                seRetInput.dataset.auto = "true";

                seLblRet.innerHTML = `Return <span style="color:var(--accent-blue)">(Auto)</span>`;
                if (rawMins + legDuration >= 1440) hintHtml += ` <span style="color:var(--accent-yellow)">(Arrival +1 Day)</span>`;
            }
        } else if (source === 'ret' && retVal) {
            seRetInput.dataset.edited = "true";
            seRetInput.dataset.auto = "false";
            seLblRet.innerHTML = `Return <span style="color:var(--accent-yellow)">(Manual Override)</span>`;

            if (!outVal || seOutInput.dataset.auto === "true") {
                const [h, m] = retVal.split(':').map(Number);
                const rawMins = h * 60 + m;
                const outMins = (rawMins - legDuration + 1440) % 1440;
                seOutInput.value = `${String(Math.floor(outMins / 60)).padStart(2, '0')}:${String(outMins % 60).padStart(2, '0')}`;
                seOutInput.dataset.auto = "true";

                seLblOut.innerHTML = `Outbound <span style="color:var(--accent-blue)">(Auto)</span>`;
                if (rawMins - legDuration < 0) hintHtml += ` <span style="color:var(--accent-yellow)">(Outbound -1 Day)</span>`;
            }
        }
        seCalcHint.innerHTML = hintHtml;
    }

    seOutInput.addEventListener('input', () => { seOutInput.dataset.auto = "false"; seLblOut.textContent = 'Outbound'; updateEditorAutoCalc('out'); });
    seRetInput.addEventListener('input', () => { seRetInput.dataset.auto = "false"; seLblRet.innerHTML = 'Return <span style="color:var(--accent-yellow)">(Manual Override)</span>'; updateEditorAutoCalc('ret'); });
    routeSelect.addEventListener('change', () => { seOutInput.dataset.auto = "false"; seRetInput.dataset.auto = "true"; updateEditorAutoCalc('out'); });
    aircraftSelect.addEventListener('change', () => { seOutInput.dataset.auto = "false"; seRetInput.dataset.auto = "true"; updateEditorAutoCalc('out'); });

    document.getElementById('se-add-time').addEventListener('click', () => {
        const routeId = parseInt(routeSelect.value);
        const r = getRouteById(routeId);
        if (!r) return;

        let pair = {};
        if (seOutInput.value) {
            const [h, m] = seOutInput.value.split(':').map(Number);
            pair.out = { hour: h, minute: m };
        }
        if (r.pairedRouteId && seRetInput.value) {
            const [h, m] = seRetInput.value.split(':').map(Number);
            pair.ret = { hour: h, minute: m };
        }

        if (pair.out || pair.ret) {
            editPairs.push(pair);
            editPairs.sort((a, b) => {
                const aMins = a.out ? a.out.hour * 60 + a.out.minute : (a.ret.hour * 60 + a.ret.minute);
                const bMins = b.out ? b.out.hour * 60 + b.out.minute : (b.ret.hour * 60 + b.ret.minute);
                return aMins - bMins;
            });
            renderEditorTimesList();
        }
    });

    function getEditorValues() {
        const routeId = parseInt(routeSelect.value);
        const acId = parseInt(aircraftSelect.value);
        const mode = document.getElementById('se-mode').value;
        const bankId = mode === 'BANKED' ? parseInt(document.getElementById('se-bank').value) : null;

        const outTimes = mode === 'CUSTOM' ? editPairs.map(p => p.out).filter(Boolean) : [];
        const retTimes = mode === 'CUSTOM' ? editPairs.map(p => p.ret).filter(Boolean) : [];

        return { routeId, acId, mode, outTimes, retTimes, bankId };
    }

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

    document.getElementById('se-validate').addEventListener('click', () => {
        const { routeId, acId, mode, outTimes, retTimes, bankId } = getEditorValues();
        let errors = validateScheduleParams(routeId, acId, mode, outTimes, bankId, scheduleId);

        const route = getRouteById(routeId);
        if (route && route.pairedRouteId && retTimes.length > 0) {
            const pSchId = returnSchedule ? returnSchedule.id : null;
            const retErrors = validateScheduleParams(route.pairedRouteId, acId, mode, retTimes, bankId, pSchId);
            errors = errors.concat(retErrors);
        }

        if (errors.length === 0) {
            const errDiv = document.getElementById('se-validation-errors');
            errDiv.classList.remove('hidden');
            errDiv.innerHTML = '<div class="validation-ok">All checks passed. Schedule is valid.</div>';
        } else {
            showValidationErrors(errors);
        }
    });

    document.getElementById('se-save').addEventListener('click', () => {
        const { routeId, acId, mode, outTimes, retTimes, bankId } = getEditorValues();

        const route = getRouteById(routeId);
        let errors = validateScheduleParams(routeId, acId, mode, outTimes, bankId, scheduleId);

        let pSchId = returnSchedule ? returnSchedule.id : null;
        if (route && route.pairedRouteId && retTimes.length > 0) {
            const retErrors = validateScheduleParams(route.pairedRouteId, acId, mode, retTimes, bankId, pSchId);
            errors = errors.concat(retErrors);
        }

        if (showValidationErrors(errors)) return;

        updateSchedule(scheduleId, routeId, acId, mode, outTimes, bankId);

        if (route && route.pairedRouteId && retTimes.length > 0) {
            if (pSchId) {
                updateSchedule(pSchId, route.pairedRouteId, acId, mode, retTimes, bankId);
            } else {
                createSchedule(route.pairedRouteId, acId, mode, retTimes, bankId);
            }
        }

        creator.classList.add('hidden');
        renderScheduleList();
    });

    document.getElementById('se-cancel').addEventListener('click', () => {
        creator.classList.add('hidden');
    });
}
