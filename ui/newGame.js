import { AIRPORTS } from '../data/airports.js';
import { DIFFICULTY } from '../engine/state.js';

export function showNewGameScreen(onStart) {
    const container = document.getElementById('app');
    container.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'new-game-screen';
    screen.innerHTML = `
        <div class="new-game-container">
            <div class="new-game-header">
                <h1>OWN YOUR AIRLINE</h1>
                <p class="subtitle">Realistic Airline Management Simulation</p>
            </div>
            <div class="new-game-form">
                <div class="form-section">
                    <h2>AIRLINE IDENTITY</h2>
                    <div class="form-row">
                        <label>Airline Name</label>
                        <input type="text" id="ng-airline-name" placeholder="Enter airline name" maxlength="40" />
                    </div>
                    <div class="form-row">
                        <label>IATA Code</label>
                        <input type="text" id="ng-iata-code" placeholder="2-3 characters" maxlength="3" style="text-transform:uppercase" />
                    </div>
                    <div class="form-row">
                        <label>Airline Color</label>
                        <div class="color-picker-wrap">
                            <input type="color" id="ng-airline-color" value="#00AAFF" />
                            <span class="color-preview" id="ng-color-label">#00AAFF</span>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h2>HUB AIRPORT</h2>
                    <div class="form-row">
                        <label>Search Airport</label>
                        <input type="text" id="ng-hub-search" placeholder="Search by name, city, or IATA code..." autocomplete="off" />
                    </div>
                    <div id="ng-hub-results" class="hub-search-results"></div>
                    <div id="ng-hub-selected" class="hub-selected hidden">
                        <span id="ng-hub-display"></span>
                        <button id="ng-hub-clear" class="btn-sm">Change</button>
                    </div>
                </div>

                <div class="form-section">
                    <h2>DIFFICULTY</h2>
                    <div class="difficulty-grid" id="ng-difficulty-grid"></div>
                    <div id="ng-sandbox-cash-row" class="form-row hidden">
                        <label>Starting Capital ($)</label>
                        <input type="number" id="ng-sandbox-cash" placeholder="Enter amount" min="1000000" step="1000000" value="500000000" />
                    </div>
                </div>

                <div class="form-section form-actions">
                    <div id="ng-error" class="form-error hidden"></div>
                    <button id="ng-start-btn" class="btn-primary btn-large">LAUNCH AIRLINE</button>
                </div>
            </div>
        </div>
    `;

    container.appendChild(screen);

    initColorPicker();
    initHubSearch();
    initDifficultySelector();
    initStartButton(onStart);
}

function initColorPicker() {
    const colorInput = document.getElementById('ng-airline-color');
    const colorLabel = document.getElementById('ng-color-label');
    colorInput.addEventListener('input', () => {
        colorLabel.textContent = colorInput.value.toUpperCase();
        colorLabel.style.color = colorInput.value;
    });
}

let selectedHub = null;

function initHubSearch() {
    const searchInput = document.getElementById('ng-hub-search');
    const resultsDiv = document.getElementById('ng-hub-results');
    const selectedDiv = document.getElementById('ng-hub-selected');
    const displaySpan = document.getElementById('ng-hub-display');
    const clearBtn = document.getElementById('ng-hub-clear');

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        resultsDiv.innerHTML = '';

        if (query.length < 2) {
            resultsDiv.classList.remove('visible');
            return;
        }

        const matches = AIRPORTS.filter(ap =>
            ap.iata.toLowerCase().includes(query) ||
            ap.city.toLowerCase().includes(query) ||
            ap.name.toLowerCase().includes(query) ||
            ap.country.toLowerCase().includes(query)
        ).slice(0, 12);

        if (matches.length === 0) {
            resultsDiv.innerHTML = '<div class="hub-result-item no-results">No airports found</div>';
            resultsDiv.classList.add('visible');
            return;
        }

        for (const ap of matches) {
            const item = document.createElement('div');
            item.className = 'hub-result-item';
            item.innerHTML = `
                <span class="hub-iata">${ap.iata}</span>
                <span class="hub-info">${ap.city}, ${ap.country}</span>
                <span class="hub-region">${ap.region}</span>
            `;
            item.addEventListener('click', () => selectHub(ap));
            resultsDiv.appendChild(item);
        }
        resultsDiv.classList.add('visible');
    });

    clearBtn.addEventListener('click', () => {
        selectedHub = null;
        selectedDiv.classList.add('hidden');
        searchInput.classList.remove('hidden');
        searchInput.value = '';
        searchInput.focus();
    });

    function selectHub(airport) {
        selectedHub = airport.iata;
        displaySpan.innerHTML = `<span class="hub-iata">${airport.iata}</span> ${airport.name} — ${airport.city}, ${airport.country}`;
        selectedDiv.classList.remove('hidden');
        searchInput.classList.add('hidden');
        resultsDiv.innerHTML = '';
        resultsDiv.classList.remove('visible');
    }
}

let selectedDifficulty = 'MEDIUM';

function initDifficultySelector() {
    const grid = document.getElementById('ng-difficulty-grid');
    const sandboxRow = document.getElementById('ng-sandbox-cash-row');

    for (const [key, diff] of Object.entries(DIFFICULTY)) {
        const card = document.createElement('div');
        card.className = `difficulty-card ${key === selectedDifficulty ? 'selected' : ''}`;
        card.dataset.key = key;
        card.innerHTML = `
            <div class="diff-label">${diff.label}</div>
            <div class="diff-desc">${diff.description}</div>
        `;
        card.addEventListener('click', () => {
            document.querySelectorAll('.difficulty-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedDifficulty = key;
            if (key === 'SANDBOX') {
                sandboxRow.classList.remove('hidden');
            } else {
                sandboxRow.classList.add('hidden');
            }
        });
        grid.appendChild(card);
    }
}

function initStartButton(onStart) {
    const btn = document.getElementById('ng-start-btn');
    const errDiv = document.getElementById('ng-error');

    btn.addEventListener('click', () => {
        errDiv.classList.add('hidden');

        const airlineName = document.getElementById('ng-airline-name').value.trim();
        const iataCode = document.getElementById('ng-iata-code').value.trim().toUpperCase();
        const airlineColor = document.getElementById('ng-airline-color').value;
        const sandboxCash = parseInt(document.getElementById('ng-sandbox-cash').value) || 500000000;

        const errors = [];
        if (!airlineName) errors.push('Airline name is required');
        if (iataCode.length < 2 || iataCode.length > 3) errors.push('IATA code must be 2-3 characters');
        if (!selectedHub) errors.push('Select a hub airport');
        if (selectedDifficulty === 'SANDBOX' && sandboxCash < 1000000) errors.push('Sandbox capital must be at least $1M');

        if (errors.length > 0) {
            errDiv.textContent = errors.join(' • ');
            errDiv.classList.remove('hidden');
            return;
        }

        onStart({
            airlineName,
            iataCode,
            airlineColor,
            hubAirport: selectedHub,
            difficulty: selectedDifficulty,
            sandboxCash: selectedDifficulty === 'SANDBOX' ? sandboxCash : null
        });
    });
}
