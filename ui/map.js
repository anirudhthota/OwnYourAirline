import { getState } from '../engine/state.js';
import { getAirportByIata, AIRPORTS, getDistanceBetweenAirports } from '../data/airports.js';

let canvas = null;
let ctx = null;
let mapState = {
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    width: 0,
    height: 0
};

let mapToggles = {
    showPlayerRoutes: true,
    showAIRoutes: true,
    showLabels: true,
    showFlights: true,
    aiAirlineFilter: ''
};

const MAX_AI_ROUTES_RENDERED = 50;

export function initMap() {
    canvas = document.getElementById('map-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    createMapControls();
    centerOnHub();
}

function createMapControls() {
    const container = document.getElementById('map-container');
    if (!container) return;

    const panel = document.createElement('div');
    panel.className = 'map-controls';
    panel.innerHTML = `
        <div class="map-controls-header">
            <span class="map-controls-title">Map</span>
            <button class="map-controls-toggle" id="mc-toggle">\u25BC</button>
        </div>
        <div class="map-controls-body" id="mc-body">
            <label class="mc-option">
                <input type="checkbox" id="mc-player-routes" checked />
                <span>Player routes</span>
            </label>
            <label class="mc-option">
                <input type="checkbox" id="mc-ai-routes" checked />
                <span>AI routes</span>
            </label>
            <label class="mc-option">
                <input type="checkbox" id="mc-labels" checked />
                <span>Airport labels</span>
            </label>
            <label class="mc-option">
                <input type="checkbox" id="mc-flights" checked />
                <span>Flight dots</span>
            </label>
            <div class="mc-divider"></div>
            <label class="mc-option-label">Filter AI airline</label>
            <select id="mc-airline-filter" class="mc-select">
                <option value="">All airlines</option>
            </select>
        </div>
    `;

    container.appendChild(panel);

    const toggleBtn = panel.querySelector('#mc-toggle');
    const body = panel.querySelector('#mc-body');
    toggleBtn.addEventListener('click', () => {
        body.classList.toggle('collapsed');
        toggleBtn.textContent = body.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
    });

    panel.querySelector('#mc-player-routes').addEventListener('change', (e) => {
        mapToggles.showPlayerRoutes = e.target.checked;
        renderMap();
    });
    panel.querySelector('#mc-ai-routes').addEventListener('change', (e) => {
        mapToggles.showAIRoutes = e.target.checked;
        renderMap();
    });
    panel.querySelector('#mc-labels').addEventListener('change', (e) => {
        mapToggles.showLabels = e.target.checked;
        renderMap();
    });
    panel.querySelector('#mc-flights').addEventListener('change', (e) => {
        mapToggles.showFlights = e.target.checked;
        renderMap();
    });

    const filterSelect = panel.querySelector('#mc-airline-filter');
    filterSelect.addEventListener('change', (e) => {
        mapToggles.aiAirlineFilter = e.target.value;
        renderMap();
    });

    populateAirlineFilter();
}

function populateAirlineFilter() {
    const state = getState();
    if (!state) return;
    const filterSelect = document.getElementById('mc-airline-filter');
    if (!filterSelect) return;

    filterSelect.innerHTML = '<option value="">All airlines</option>';
    const sorted = [...state.ai.airlines].sort((a, b) => a.name.localeCompare(b.name));
    for (const airline of sorted) {
        const opt = document.createElement('option');
        opt.value = airline.iata;
        opt.textContent = `${airline.iata} \u2014 ${airline.name}`;
        filterSelect.appendChild(opt);
    }
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    mapState.width = canvas.width;
    mapState.height = canvas.height;
    renderMap();
}

function centerOnHub() {
    const state = getState();
    if (!state) return;
    const hub = getAirportByIata(state.config.hubAirport);
    if (!hub) return;

    mapState.zoom = 2;
    const { x, y } = geoToScreen(hub.lat, hub.lon);
    mapState.offsetX += mapState.width / 2 - x;
    mapState.offsetY += mapState.height / 2 - y;
}

function geoToScreen(lat, lon) {
    const x = (lon + 180) / 360 * mapState.width * mapState.zoom;
    const latRad = lat * Math.PI / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y = (0.5 - mercN / (2 * Math.PI)) * mapState.height * mapState.zoom;
    return { x: x + mapState.offsetX, y: y + mapState.offsetY };
}

function isInViewport(x, y, margin) {
    return x >= -margin && x <= canvas.width + margin && y >= -margin && y <= canvas.height + margin;
}

function onMouseDown(e) {
    mapState.isDragging = true;
    mapState.dragStartX = e.clientX - mapState.offsetX;
    mapState.dragStartY = e.clientY - mapState.offsetY;
    canvas.style.cursor = 'grabbing';
}

function onMouseMove(e) {
    if (!mapState.isDragging) return;
    mapState.offsetX = e.clientX - mapState.dragStartX;
    mapState.offsetY = e.clientY - mapState.dragStartY;
    renderMap();
}

function onMouseUp() {
    mapState.isDragging = false;
    canvas.style.cursor = 'grab';
}

function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const prevZoom = mapState.zoom;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    mapState.zoom = Math.max(0.5, Math.min(20, mapState.zoom * delta));

    const ratio = mapState.zoom / prevZoom;
    mapState.offsetX = mouseX - (mouseX - mapState.offsetX) * ratio;
    mapState.offsetY = mouseY - (mouseY - mapState.offsetY) * ratio;

    renderMap();
}

export function renderMap() {
    if (!ctx || !canvas) return;
    const state = getState();
    if (!state) return;

    ctx.fillStyle = '#06091a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGridLines();
    drawContinents();

    if (mapToggles.showAIRoutes) drawAIRoutes();
    if (mapToggles.showPlayerRoutes) drawPlayerRoutes();

    drawAirports();

    if (mapToggles.showFlights) drawActiveFlights();

    drawHub();
}

function drawGridLines() {
    ctx.strokeStyle = '#0e1428';
    ctx.lineWidth = 0.3;
    ctx.beginPath();

    for (let lon = -180; lon <= 180; lon += 30) {
        const start = geoToScreen(85, lon);
        const end = geoToScreen(-85, lon);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
    }
    for (let lat = -60; lat <= 80; lat += 20) {
        const start = geoToScreen(lat, -180);
        const end = geoToScreen(lat, 180);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();
}

function drawContinentPoly(points) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
        const { x, y } = geoToScreen(points[i][0], points[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#141e38';
    ctx.fill();
    ctx.strokeStyle = '#283860';
    ctx.lineWidth = 0.8;
    ctx.stroke();
}

function drawContinents() {
    // North America
    drawContinentPoly([
        [72,-168],[70,-162],[67,-164],[64,-153],[60,-140],[58,-137],[55,-132],
        [52,-128],[49,-126],[46,-124],[43,-125],[40,-124],[37,-123],[35,-121],
        [33,-118],[31,-117],[28,-114],[25,-109],[22,-106],[20,-105],[18,-103],
        [16,-96],[15,-88],[14,-84],[10,-83],[9,-79],[8,-77],
        [10,-76],[15,-84],[16,-88],[18,-96],[20,-105],[23,-106],
        [26,-98],[27,-97],[29,-93],[30,-90],[29,-88],[27,-85],[25,-83],
        [25,-80],[27,-80],[30,-81],[33,-79],[36,-76],[39,-76],[43,-82],
        [45,-83],[48,-88],[52,-79],[55,-77],[58,-78],[60,-85],
        [63,-95],[68,-105],[72,-112],[74,-120],[72,-128],
        [69,-135],[67,-140],[60,-148],[59,-150],[60,-155],
        [63,-160],[67,-164],[70,-162],[72,-168]
    ]);

    // Central America + Caribbean bridge
    drawContinentPoly([
        [20,-105],[18,-103],[17,-100],[16,-96],[15,-92],[15,-88],
        [14,-84],[10,-84],[9,-79],[8,-77],[7,-78],[8,-82],[9,-84],
        [10,-84],[14,-88],[15,-92],[16,-96],[17,-100],[18,-103],[20,-105]
    ]);

    // South America
    drawContinentPoly([
        [12,-72],[10,-68],[8,-63],[7,-60],[5,-58],[4,-52],[2,-50],[0,-50],
        [-2,-44],[-3,-41],[-5,-35],[-8,-35],[-10,-37],[-13,-39],[-16,-40],
        [-20,-41],[-23,-43],[-25,-47],[-28,-49],[-30,-51],[-33,-52],
        [-38,-57],[-41,-62],[-46,-67],[-50,-68],[-52,-69],[-55,-68],
        [-54,-65],[-52,-70],[-47,-76],[-40,-74],[-35,-72],
        [-30,-52],[-25,-47],[-23,-43],[-20,-40],[-16,-40],[-13,-38],
        [-10,-36],[-8,-35],[-5,-35],[-3,-40],[-2,-44],[0,-50],
        [0,-51],[2,-50],[4,-52],[5,-58],[7,-60],[8,-63],
        [10,-68],[12,-72]
    ]);

    // Europe
    drawContinentPoly([
        [36,-10],[37,-9],[39,-9],[43,-9],[44,-2],[46,1],[48,-1],[49,-5],
        [50,-5],[52,-5],[54,-3],[55,0],[54,6],[55,8],[57,8],[58,10],
        [56,12],[55,14],[54,10],[53,6],[52,5],[51,4],[51,7],[53,14],
        [55,15],[57,16],[59,18],[60,20],[62,24],[64,28],[66,26],[68,23],
        [70,28],[71,28],[72,30],[70,32],[68,38],[65,42],[62,42],[59,38],
        [56,38],[55,42],[52,42],[50,40],[48,38],[44,42],[42,44],
        [40,28],[39,26],[38,24],[36,22],[35,24],[36,28],[38,26],
        [40,26],[41,28],[40,30],[38,30],[37,28],[36,26],
        [36,14],[38,13],[40,14],[42,14],[44,12],[46,12],[46,14],
        [43,18],[42,14],[40,14],[38,12],[36,12],
        [36,0],[36,-6],[36,-10]
    ]);

    // British Isles
    drawContinentPoly([
        [50,-6],[51,-5],[52,-5],[53,-3],[54,-3],[55,-1],[56,-3],[57,-5],
        [58,-5],[59,-3],[58,-3],[57,-2],[56,0],[55,0],[54,1],[53,1],
        [52,1],[51,1],[50,0],[50,-4],[50,-6]
    ]);

    // Africa
    drawContinentPoly([
        [37,10],[35,0],[35,-6],[35,-10],[34,-12],[33,-16],[30,-10],
        [26,-16],[22,-16],[18,-16],[15,-17],[13,-16],[10,-14],[7,-11],
        [5,-10],[5,-4],[4,-2],[5,2],[6,2],[5,8],[4,10],[3,10],
        [2,10],[0,10],[-1,12],[-4,12],[-6,12],[-8,14],[-10,15],
        [-14,18],[-18,22],[-22,26],[-26,30],[-28,32],
        [-30,31],[-34,26],[-34,18],[-30,17],[-26,15],
        [-22,14],[-18,12],[-14,11],[-10,10],[-6,12],[-2,10],
        [0,10],[2,10],[4,10],[5,8],[6,2],[5,2],[4,-2],
        [4,8],[6,10],[8,14],[10,14],[12,16],[14,16],[16,16],
        [18,18],[20,18],[22,20],[24,20],[26,22],
        [28,34],[30,32],[32,32],[33,34],[35,36],[37,36],[37,10]
    ]);

    // Middle East + Arabian Peninsula
    drawContinentPoly([
        [37,36],[35,36],[33,34],[32,36],[30,35],[28,34],[26,36],
        [24,38],[22,40],[20,42],[18,44],[15,46],[13,44],[12,44],
        [13,48],[16,52],[20,56],[22,58],[24,58],[26,56],[28,50],
        [30,48],[32,48],[32,40],[30,38],[32,36],[35,36],[37,36]
    ]);

    // India + South Asia
    drawContinentPoly([
        [35,68],[32,70],[30,68],[28,66],[24,62],[20,58],[18,56],
        [14,54],[10,56],[8,58],[6,62],[7,68],[8,76],[10,78],
        [14,80],[18,82],[22,84],[26,82],[28,80],[30,78],[32,76],
        [34,74],[35,72],[35,68]
    ]);

    // East Asia + Russia Far East
    drawContinentPoly([
        [65,42],[68,50],[72,60],[76,65],[78,70],[76,80],[74,85],
        [72,90],[70,90],[68,86],[65,75],[62,68],[60,60],
        [58,58],[55,56],[55,50],[52,52],[50,54],[48,52],[46,50],
        [44,50],[42,48],[40,44],[38,48],[36,42],[35,36],
        [37,36],[37,40],[38,44],[40,44],[42,44],[44,42],
        [48,38],[50,40],[52,42],[55,42],[56,38],[59,38],[62,42],[65,42]
    ]);

    // Southeast and East Asia coastline
    drawContinentPoly([
        [40,105],[38,104],[36,100],[34,95],[32,96],[30,96],
        [28,98],[26,100],[24,104],[22,107],[20,106],[18,106],
        [16,104],[14,103],[12,102],[10,100],[8,100],[6,104],
        [4,104],[2,102],[1,100],[-1,100],[-3,98],[-6,95],
        [-6,92],[-4,90],[-2,85],[0,80],[2,72],[4,68],[6,66],
        [8,64],[10,62],[12,62],[15,62],[18,60],[20,58],
        [22,60],[24,62],[26,64],[28,66],[30,68],[32,70],
        [34,74],[35,72],[35,68],[36,74],[38,76],[40,80],
        [42,86],[44,88],[46,90],[48,92],[50,95],[52,100],
        [50,104],[48,106],[46,108],[44,110],[42,112],[44,118],
        [48,122],[52,128],[56,134],[60,140],[62,140],
        [64,142],[64,136],[60,130],[56,126],[52,120],
        [48,116],[44,110],[42,108],[40,105]
    ]);

    // Australia
    drawContinentPoly([
        [-12,130],[-12,132],[-14,136],[-14,132],[-16,130],
        [-20,128],[-24,124],[-28,118],[-32,114],[-34,115],
        [-35,118],[-36,122],[-38,140],[-39,146],[-38,147],
        [-34,150],[-33,152],[-28,154],[-24,152],[-20,149],
        [-16,146],[-13,142],[-11,138],[-12,137],
        [-14,137],[-14,134],[-12,132],[-12,130]
    ]);

    // Japan
    drawContinentPoly([
        [31,131],[33,132],[35,133],[36,136],[38,139],
        [40,140],[43,142],[45,142],[44,144],[42,143],
        [40,140],[38,139],[36,137],[34,134],[33,132],[31,131]
    ]);

    // Indonesia / Malay Peninsula
    drawContinentPoly([
        [6,100],[4,102],[2,104],[1,104],[0,104],[-1,106],
        [-2,108],[-3,110],[-5,112],[-6,114],[-8,115],
        [-8,118],[-7,120],[-6,118],[-5,114],[-3,112],
        [-1,108],[0,106],[2,106],[4,104],[6,102],[6,100]
    ]);

    // New Zealand
    drawContinentPoly([
        [-35,174],[-37,176],[-39,178],[-41,176],[-43,172],
        [-45,168],[-46,167],[-46,169],[-44,172],[-42,174],
        [-40,177],[-38,178],[-36,175],[-35,174]
    ]);

    // Iceland
    drawContinentPoly([
        [64,-22],[65,-18],[66,-16],[66,-14],[65,-14],
        [64,-18],[63,-20],[64,-22]
    ]);

    // Scandinavia peninsula (separate for clarity)
    drawContinentPoly([
        [56,12],[58,10],[59,12],[60,14],[62,12],[64,14],
        [66,16],[68,16],[70,20],[71,26],[70,28],[68,23],
        [66,16],[64,14],[62,12],[60,14],[59,12],[58,10],[56,12]
    ]);
}

function drawAIRoutes() {
    const state = getState();
    if (!state || !state.ai || !state.ai.routes) return;

    const filter = mapToggles.aiAirlineFilter;
    const hubIata = state.config.hubAirport;

    const candidates = [];

    for (const route of state.ai.routes) {
        if (filter && route.airlineIata !== filter) continue;

        const origin = getAirportByIata(route.origin);
        const dest = getAirportByIata(route.destination);
        if (!origin || !dest) continue;

        const p1 = geoToScreen(origin.lat, origin.lon);
        const p2 = geoToScreen(dest.lat, dest.lon);

        const margin = 100;
        const inView = isInViewport(p1.x, p1.y, margin) || isInViewport(p2.x, p2.y, margin);
        if (!inView) continue;

        let distToHub = Infinity;
        if (hubIata) {
            const d1 = getDistanceBetweenAirports(route.origin, hubIata);
            const d2 = getDistanceBetweenAirports(route.destination, hubIata);
            if (d1 && d2) distToHub = Math.min(d1, d2);
            else if (d1) distToHub = d1;
            else if (d2) distToHub = d2;
        }

        const airline = state.ai.airlines.find(a => a.iata === route.airlineIata);

        candidates.push({ p1, p2, distToHub, airline });
    }

    candidates.sort((a, b) => a.distToHub - b.distToHub);

    const limit = filter ? candidates.length : Math.min(MAX_AI_ROUTES_RENDERED, candidates.length);

    for (let i = 0; i < limit; i++) {
        const { p1, p2, airline } = candidates[i];
        ctx.strokeStyle = airline ? airline.color : '#555';

        if (filter) {
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1.0;
        } else {
            ctx.globalAlpha = 0.08;
            ctx.lineWidth = 0.4;
        }

        drawArc(p1, p2);
    }

    ctx.globalAlpha = 1;
}

function drawPlayerRoutes() {
    const state = getState();
    if (!state) return;

    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;

    const pairsSeen = new Set();

    for (const route of state.routes) {
        if (!route.active) continue;
        const origin = getAirportByIata(route.origin);
        const dest = getAirportByIata(route.destination);
        if (!origin || !dest) continue;

        const pairKey = [route.origin, route.destination].sort().join('-');
        const hasReverse = state.routes.some(r =>
            r.active && r.origin === route.destination && r.destination === route.origin
        );

        let offsetDir = 0;
        if (hasReverse) {
            if (pairsSeen.has(pairKey)) {
                offsetDir = -1;
            } else {
                offsetDir = 1;
                pairsSeen.add(pairKey);
            }
        }

        ctx.strokeStyle = state.config.airlineColor;
        ctx.shadowColor = state.config.airlineColor;
        ctx.shadowBlur = 4;

        const p1 = geoToScreen(origin.lat, origin.lon);
        const p2 = geoToScreen(dest.lat, dest.lon);
        drawArcOffset(p1, p2, offsetDir);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function drawArc(p1, p2) {
    drawArcOffset(p1, p2, 0);
}

function drawArcOffset(p1, p2, offsetDir) {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const baseBulge = dist * 0.15;
    const offsetAmount = offsetDir * dist * 0.06;
    const bulge = baseBulge + offsetAmount;

    const cpX = midX - (dy / dist) * bulge;
    const cpY = midY + (dx / dist) * bulge;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(cpX, cpY, p2.x, p2.y);
    ctx.stroke();
}

function drawAirports() {
    const state = getState();
    if (!state) return;

    const routeAirports = new Set();
    for (const route of state.routes) {
        routeAirports.add(route.origin);
        routeAirports.add(route.destination);
    }

    const showAll = mapState.zoom >= 3;

    for (const airport of AIRPORTS) {
        const isRouted = routeAirports.has(airport.iata);
        const isHub = airport.iata === state.config.hubAirport;
        if (!showAll && !isRouted && !isHub) continue;

        const { x, y } = geoToScreen(airport.lat, airport.lon);
        if (!isInViewport(x, y, 50)) continue;

        if (isRouted) {
            ctx.fillStyle = state.config.airlineColor;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#2a3050';
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (mapToggles.showLabels && (mapState.zoom >= 4 || isRouted)) {
            ctx.fillStyle = isRouted ? '#dde4f0' : '#556';
            const fontSize = isRouted
                ? Math.max(9, 11 * mapState.zoom / 4)
                : Math.max(7, 9 * mapState.zoom / 4);
            ctx.font = `${isRouted ? 'bold ' : ''}${fontSize}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(airport.iata, x, y - (isRouted ? 8 : 5));
        }
    }
}

function drawHub() {
    const state = getState();
    if (!state) return;

    const hub = getAirportByIata(state.config.hubAirport);
    if (!hub) return;

    const { x, y } = geoToScreen(hub.lat, hub.lon);

    ctx.strokeStyle = state.config.airlineColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = state.config.airlineColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = state.config.airlineColor;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(hub.iata, x, y - 16);
    ctx.shadowBlur = 0;
}

function drawActiveFlights() {
    const state = getState();
    if (!state) return;

    for (const flight of state.flights.active) {
        const origin = getAirportByIata(flight.origin);
        const dest = getAirportByIata(flight.destination);
        if (!origin || !dest) continue;

        const p1 = geoToScreen(origin.lat, origin.lon);
        const p2 = geoToScreen(dest.lat, dest.lon);

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) continue;
        const bulge = dist * 0.15;
        const cpX = midX - (dy / dist) * bulge;
        const cpY = midY + (dx / dist) * bulge;

        const t = flight.progress;
        const fx = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cpX + t * t * p2.x;
        const fy = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cpY + t * t * p2.y;

        ctx.fillStyle = '#fff';
        ctx.shadowColor = state.config.airlineColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = state.config.airlineColor;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(fx, fy, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function getMapState() {
    return mapState;
}
