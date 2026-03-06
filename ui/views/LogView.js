import { getState } from '../../engine/state.js';
import { formatGameTimestamp } from '../../engine/state.js';

let logPaused = false;
let logListener = null;

export function renderLogPanel(container) {
    const state = getState();

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

    document.getElementById('log-pause-btn').addEventListener('click', () => {
        logPaused = !logPaused;
        document.getElementById('log-pause-btn').textContent = logPaused ? 'Resume Log' : 'Pause Log';
    });

    logListener = (e) => {
        if (logPaused) return;
        const list = document.getElementById('log-list');
        if (!list) return;

        const empty = document.getElementById('log-empty');
        if (empty) empty.remove();

        const div = document.createElement('div');
        div.innerHTML = renderLogEntry(e.detail);
        list.insertBefore(div.firstElementChild, list.firstChild);

        while (list.children.length > 200) {
            list.removeChild(list.lastChild);
        }
    };
    window.addEventListener('gameEvent', logListener);
}

function renderLogEntry(entry) {
    const borderColor = LOG_BORDER_COLORS[entry.type] || LOG_BORDER_COLORS.system;
    return `
    <div class="log-entry log-${entry.type}" style="border-left:3px solid ${borderColor};padding-left:8px;">
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
