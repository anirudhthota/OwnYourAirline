import { getState, getGameTime } from '../../engine/state.js';
import { deleteSchedule, deleteBank, createBank } from '../../engine/scheduler.js';
import { getRouteById } from '../../engine/routeEngine.js';
import { getTurnaroundTime } from '../../data/aircraft.js';
import { openSchedulePanel } from '../services/uiState.js';

export function renderSchedulePanel(container) {
    const state = getState();

    container.innerHTML = `
        <div class="panel-header">
            <h2>Scheduling</h2>
            <div>
                <button class="btn-secondary" id="bank-create-btn">New Bank</button>
            </div>
        </div>
        <div class="sched-mode-toggle">
            <button class="btn-sm sched-mode-btn active" data-smode="simple">Simple</button>
            <button class="btn-sm sched-mode-btn" data-smode="ops">Ops</button>
        </div>
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
                    <span>Turnaround: ${aircraft && route ? getTurnaroundTime(aircraft.type, route.distance) : '?'}m</span>
                    <span>Departures: ${times || 'None'}</span>
                    <span>Days: ${formatDaysOfWeek(sched.daysOfWeek)}</span>
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
            openSchedulePanel({ mode: 'edit', scheduleId: schedId });
        });
    });

    listDiv.querySelectorAll('[data-delete-sched]').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteSchedule(parseInt(btn.dataset.deleteSched));
            renderScheduleList();
        });
    });
}

function formatDaysOfWeek(days) {
    if (!days || days.length === 7) return 'Daily';
    if (days.length === 0) return 'None';
    const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    if (JSON.stringify([...days].sort()) === JSON.stringify([1, 2, 3, 4, 5])) return 'Mon–Fri';
    if (JSON.stringify([...days].sort()) === JSON.stringify([0, 6])) return 'Sat–Sun';
    return days.map(d => labels[d]).join(', ');
}
