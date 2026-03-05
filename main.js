import { showNewGameScreen } from './ui/newGame.js';
import { initNewGame, initFromSave, startSimulation } from './engine/init.js';
import { getState, hasSavedGame, GAME_SPEEDS, MINUTES_PER_DAY, MINUTES_PER_WEEK, MINUTES_PER_MONTH } from './engine/state.js';
import { setGameSpeed } from './engine/sim.js';
import { createHUD, updateHUD } from './ui/hud.js';
import { initMap, renderMap } from './ui/map.js';
import { initSideNav, showPanel } from './ui/panels.js';
import { showDailyPnLNotification } from './ui/dailyPnl.js';

function boot() {
    const app = document.getElementById('app');

    if (hasSavedGame()) {
        app.innerHTML = `
            <div class="title-screen">
                <h1>OWN YOUR AIRLINE</h1>
                <p>Realistic Airline Management Simulation</p>
                <div class="title-buttons">
                    <button class="btn-primary btn-large" id="ts-continue">Continue Game</button>
                    <button class="btn-secondary btn-large" id="ts-new">New Game</button>
                </div>
            </div>
        `;
        document.getElementById('ts-continue').addEventListener('click', () => {
            const state = initFromSave();
            if (state) launchGame();
            else startNewGame();
        });
        document.getElementById('ts-new').addEventListener('click', startNewGame);
    } else {
        startNewGame();
    }
}

function startNewGame() {
    showNewGameScreen((config) => {
        initNewGame(config);
        launchGame();
    });
}

function launchGame() {
    const state = getState();
    const app = document.getElementById('app');

    app.innerHTML = `
        <div id="hud" class="hud"></div>
        <div id="game-body" class="game-body">
            <nav id="side-nav" class="side-nav"></nav>
            <div id="main-area" class="main-area">
                <div id="map-container" class="map-container"></div>
                <div id="panel-content" class="panel-content"></div>
            </div>
        </div>
    `;

    document.documentElement.style.setProperty('--airline-color', state.config.airlineColor);

    createHUD();
    initSideNav();
    initMap();
    showPanel('dashboard');

    setGameSpeed(GAME_SPEEDS.PAUSED);

    startSimulation(onTick, onMonth, onDayEnd);

    initKeyboardInput();
}

let tickCounter = 0;

function onTick() {
    tickCounter++;
    updateHUD();

    if (tickCounter % 3 === 0) {
        renderMap();
    }

    const state = getState();
    if (state.ui.selectedPanel === 'dashboard' && tickCounter % 10 === 0) {
        showPanel('dashboard');
    }
}

function onMonth() {
    const state = getState();
    if (state.ui.selectedPanel === 'finances') {
        showPanel('finances');
    }
}

function onDayEnd(dailyRecord) {
    if (dailyRecord.flights > 0) {
        showDailyPnLNotification(dailyRecord);
    }
    const state = getState();
    if (state.ui.selectedPanel === 'finances') {
        showPanel('finances');
    }
}

let secretBuffer = '';
const SECRET_CODE = 'DEVMODE';

function initKeyboardInput() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key.length === 1) {
            secretBuffer += e.key.toUpperCase();
            if (secretBuffer.length > SECRET_CODE.length) {
                secretBuffer = secretBuffer.slice(-SECRET_CODE.length);
            }
            if (secretBuffer === SECRET_CODE) {
                secretBuffer = '';
                toggleSecretPanel();
            }
        }
    });
}

function toggleSecretPanel() {
    let panel = document.getElementById('__dp');
    if (panel) {
        panel.remove();
        return;
    }

    panel = document.createElement('div');
    panel.id = '__dp';
    panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:#000;color:#0f0;border:2px solid #0f0;padding:24px;font-family:"Courier New",monospace;font-size:13px;min-width:400px;max-width:500px;box-shadow:0 0 30px rgba(0,255,0,0.3);';

    const state = getState();

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #0f0;padding-bottom:8px;">
            <span style="font-size:16px;font-weight:bold;">[ SYSTEM TERMINAL ]</span>
            <button id="__dp_close" style="background:none;border:1px solid #0f0;color:#0f0;cursor:pointer;padding:2px 8px;font-family:inherit;">X</button>
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:4px;">> SET CASH</label>
            <input type="number" id="__dp_cash" style="background:#111;color:#0f0;border:1px solid #0f0;padding:4px 8px;width:100%;font-family:inherit;box-sizing:border-box;" value="${state.finances.cash}" />
            <button class="__dp_btn" data-action="set_cash" style="margin-top:4px;">EXECUTE</button>
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:4px;">> ADD CASH</label>
            <input type="number" id="__dp_addcash" style="background:#111;color:#0f0;border:1px solid #0f0;padding:4px 8px;width:100%;font-family:inherit;box-sizing:border-box;" value="100000000" />
            <button class="__dp_btn" data-action="add_cash" style="margin-top:4px;">EXECUTE</button>
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:4px;">> REPUTATION [${state.reputation}]</label>
            <input type="range" id="__dp_rep" min="0" max="100" value="${state.reputation}" style="width:100%;accent-color:#0f0;" />
            <span id="__dp_rep_val">${state.reputation}</span>
            <button class="__dp_btn" data-action="set_rep" style="margin-top:4px;">SET</button>
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:4px;">> INSTANT FLEET</label>
            <select id="__dp_actype" style="background:#111;color:#0f0;border:1px solid #0f0;padding:4px;width:100%;font-family:inherit;">
                ${(() => { const { AIRCRAFT_TYPES } = window.__acRef || {}; return (AIRCRAFT_TYPES || []).map(a => `<option value="${a.type}">${a.type} (${a.seats} seats)</option>`).join(''); })()}
            </select>
            <button class="__dp_btn" data-action="add_aircraft" style="margin-top:4px;">ADD TO FLEET</button>
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:4px;">> FAST FORWARD</label>
            <div style="display:flex;gap:8px;">
                <button class="__dp_btn" data-action="ff_1d">+1 DAY</button>
                <button class="__dp_btn" data-action="ff_7d">+1 WEEK</button>
                <button class="__dp_btn" data-action="ff_30d">+1 MONTH</button>
            </div>
        </div>
        <div style="margin-bottom:8px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="__dp_god" ${state.finances.godMode ? 'checked' : ''} style="accent-color:#0f0;" />
                GOD MODE (infinite cash)
            </label>
        </div>
    `;

    document.body.appendChild(panel);

    const btnStyle = 'background:#111;color:#0f0;border:1px solid #0f0;padding:4px 12px;cursor:pointer;font-family:inherit;font-size:12px;';
    panel.querySelectorAll('.__dp_btn').forEach(b => b.style.cssText = btnStyle);

    document.getElementById('__dp_close').addEventListener('click', () => panel.remove());
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape' && document.getElementById('__dp')) {
            panel.remove();
            document.removeEventListener('keydown', esc);
        }
    });

    document.getElementById('__dp_rep').addEventListener('input', (e) => {
        document.getElementById('__dp_rep_val').textContent = e.target.value;
    });

    panel.querySelectorAll('.__dp_btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const st = getState();
            switch(action) {
                case 'set_cash':
                    st.finances.cash = parseFloat(document.getElementById('__dp_cash').value) || 0;
                    break;
                case 'add_cash':
                    st.finances.cash += parseFloat(document.getElementById('__dp_addcash').value) || 0;
                    break;
                case 'set_rep':
                    st.reputation = parseInt(document.getElementById('__dp_rep').value) || 50;
                    break;
                case 'add_aircraft': {
                    const type = document.getElementById('__dp_actype').value;
                    const { getAircraftByType: gat } = window.__acRef || {};
                    if (gat) {
                        const acData = gat(type);
                        if (acData) {
                            st.fleet.push({
                                id: st.nextFleetId++,
                                type: acData.type,
                                ownership: 'OWNED',
                                purchasePrice: 0,
                                purchaseDate: st.clock.totalMinutes,
                                totalFlightHours: 0,
                                status: 'available',
                                registration: `${st.config.iataCode}-${String(st.nextFleetId - 1).padStart(3, '0')}`,
                                currentLocation: st.config.hubAirport
                            });
                        }
                    }
                    break;
                }
                case 'ff_1d':
                    st.clock.totalMinutes += MINUTES_PER_DAY;
                    break;
                case 'ff_7d':
                    st.clock.totalMinutes += MINUTES_PER_WEEK;
                    break;
                case 'ff_30d':
                    st.clock.totalMinutes += MINUTES_PER_MONTH;
                    break;
            }
            updateHUD();
        });
    });

    document.getElementById('__dp_god').addEventListener('change', (e) => {
        getState().finances.godMode = e.target.checked;
    });
}

import { AIRCRAFT_TYPES, getAircraftByType } from './data/aircraft.js';
window.__acRef = { AIRCRAFT_TYPES, getAircraftByType };

document.addEventListener('DOMContentLoaded', boot);
