import { getState, formatMoney, getFormattedDate, getFormattedTime, GAME_SPEEDS, saveGame } from '../engine/state.js';
import { setGameSpeed, getActiveFlightCount } from '../engine/sim.js';

let hudContainer = null;

export function createHUD() {
    hudContainer = document.getElementById('hud');
    if (!hudContainer) return;

    hudContainer.innerHTML = `
        <div class="hud-left">
            <div class="hud-airline-name" id="hud-airline-name"></div>
            <div class="hud-iata" id="hud-iata"></div>
        </div>
        <div class="hud-center">
            <div class="hud-date" id="hud-date"></div>
            <div class="hud-time" id="hud-time"></div>
            <div class="hud-speed-controls">
                <button class="speed-btn" data-speed="0" title="Pause">⏸</button>
                <button class="speed-btn" data-speed="1" title="1x Speed">1×</button>
                <button class="speed-btn" data-speed="2" title="2x Speed">2×</button>
                <button class="speed-btn" data-speed="4" title="4x Speed">4×</button>
                <button class="speed-btn" data-speed="8" title="8x Speed">8×</button>
            </div>
        </div>
        <div class="hud-right">
            <div class="hud-stat">
                <span class="hud-stat-label">Cash</span>
                <span class="hud-stat-value" id="hud-cash"></span>
            </div>
            <div class="hud-stat">
                <span class="hud-stat-label">Fleet</span>
                <span class="hud-stat-value" id="hud-fleet"></span>
            </div>
            <div class="hud-stat">
                <span class="hud-stat-label">Flights</span>
                <span class="hud-stat-value" id="hud-flights"></span>
            </div>
            <div class="hud-stat">
                <span class="hud-stat-label">Routes</span>
                <span class="hud-stat-value" id="hud-routes"></span>
            </div>
            <button class="hud-save-btn" id="hud-save-btn" title="Save Game">SAVE</button>
        </div>
    `;

    initSpeedControls();
    initSaveButton();
    updateHUD();
}

function initSpeedControls() {
    const buttons = hudContainer.querySelectorAll('.speed-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const speed = parseInt(btn.dataset.speed);
            setGameSpeed(speed);
            updateSpeedButtons(speed);
        });
    });
}

function initSaveButton() {
    const btn = document.getElementById('hud-save-btn');
    btn.addEventListener('click', () => {
        saveGame();
        btn.textContent = 'SAVED';
        setTimeout(() => { btn.textContent = 'SAVE'; }, 1500);
    });
}

function updateSpeedButtons(currentSpeed) {
    const buttons = hudContainer.querySelectorAll('.speed-btn');
    buttons.forEach(btn => {
        const speed = parseInt(btn.dataset.speed);
        btn.classList.toggle('active', speed === currentSpeed);
    });
}

export function updateHUD() {
    const state = getState();
    if (!state || !hudContainer) return;

    document.getElementById('hud-airline-name').textContent = state.config.airlineName;
    document.getElementById('hud-iata').textContent = state.config.iataCode;
    document.getElementById('hud-date').textContent = getFormattedDate();
    document.getElementById('hud-time').textContent = getFormattedTime();
    document.getElementById('hud-cash').textContent = '$' + formatMoney(state.finances.cash);
    document.getElementById('hud-fleet').textContent = state.fleet.length;
    document.getElementById('hud-flights').textContent = state.flights.active.length;
    document.getElementById('hud-routes').textContent = state.routes.filter(r => r.active).length;

    const cashEl = document.getElementById('hud-cash');
    cashEl.style.color = state.finances.cash < 0 ? '#ff4444' : '';

    updateSpeedButtons(state.clock.speed);
}
