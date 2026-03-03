import { getState } from '../engine/state.js';
import { getAirportByIata, AIRPORTS } from '../data/airports.js';

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

    centerOnHub();
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

    const { x, y } = geoToScreen(hub.lat, hub.lon);
    mapState.offsetX = mapState.width / 2 - x;
    mapState.offsetY = mapState.height / 2 - y;
    mapState.zoom = 2;
}

function geoToScreen(lat, lon) {
    const x = (lon + 180) / 360 * mapState.width * mapState.zoom;
    const latRad = lat * Math.PI / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y = (0.5 - mercN / (2 * Math.PI)) * mapState.height * mapState.zoom;
    return { x: x + mapState.offsetX, y: y + mapState.offsetY };
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

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawWorldOutline();
    drawAIRoutes();
    drawPlayerRoutes();
    drawAirports();
    drawActiveFlights();
    drawHub();
}

function drawWorldOutline() {
    ctx.strokeStyle = '#1a2040';
    ctx.lineWidth = 0.5;
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

    drawSimplifiedCoastlines();
}

function drawSimplifiedCoastlines() {
    ctx.fillStyle = '#111730';
    ctx.strokeStyle = '#1e2a4a';
    ctx.lineWidth = 0.7;

    const landmasses = [
        [[71,180],[71,-170],[65,-168],[60,-164],[57,-170],[55,-165],[55,-132],[60,-140],[60,-148],[70,-141],[72,-128],[68,-110],[63,-92],[58,-78],[52,-80],[48,-89],[44,-83],[42,-82],[30,-82],[26,-80],[25,-82],[30,-85],[30,-90],[29,-95],[26,-97],[28,-97],[26,-98],[23,-106],[20,-105],[15,-92],[15,-84],[10,-84],[10,-78],[8,-77]],
        [[72,-56],[82,-62],[83,40],[72,60],[65,42],[60,30],[56,30],[55,28],[50,26],[44,28],[43,32],[40,26],[36,28],[36,36],[36,45],[38,48],[35,51],[30,48],[26,50],[23,55],[13,44],[12,42],[0,42],[-5,42],[-10,40],[-16,36],[-22,36],[-26,33],[-28,32],[-34,26],[-35,20],[-34,18]],
        [[-8,110],[-6,106],[-1,105],[2,103],[6,102],[8,99],[1,104],[5,108],[5,115],[2,116],[1,110],[-2,114],[-7,114],[-8,115],[-9,120],[-15,125],[-20,130],[-25,135],[-30,137],[-35,140],[-38,146],[-39,148],[-33,152],[-28,154],[-24,151],[-20,149],[-15,145],[-13,136],[-12,132],[-15,130],[-13,127]],
        [[-55,-68],[-52,-70],[-47,-76],[-40,-74],[-35,-72],[-30,-52],[-25,-47],[-23,-43],[-15,-39],[-8,-35],[-5,-35],[0,-50],[5,-60],[6,-62],[8,-62],[10,-68],[12,-72],[12,-82],[8,-77],[5,-77]]
    ];

    for (const land of landmasses) {
        ctx.beginPath();
        for (let i = 0; i < land.length; i++) {
            const { x, y } = geoToScreen(land[i][0], land[i][1]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

function drawAIRoutes() {
    const state = getState();
    if (!state) return;

    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.08;

    for (const route of state.ai.routes) {
        const origin = getAirportByIata(route.origin);
        const dest = getAirportByIata(route.destination);
        if (!origin || !dest) continue;

        const airline = state.ai.airlines.find(a => a.iata === route.airlineIata);
        ctx.strokeStyle = airline ? airline.color : '#666';

        const p1 = geoToScreen(origin.lat, origin.lon);
        const p2 = geoToScreen(dest.lat, dest.lon);

        drawArc(p1, p2);
    }
    ctx.globalAlpha = 1;
}

function drawPlayerRoutes() {
    const state = getState();
    if (!state) return;

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = state.config.airlineColor;
    ctx.globalAlpha = 0.7;

    for (const route of state.routes) {
        if (!route.active) continue;
        const origin = getAirportByIata(route.origin);
        const dest = getAirportByIata(route.destination);
        if (!origin || !dest) continue;

        const p1 = geoToScreen(origin.lat, origin.lon);
        const p2 = geoToScreen(dest.lat, dest.lon);
        drawArc(p1, p2);
    }
    ctx.globalAlpha = 1;
}

function drawArc(p1, p2) {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const bulge = dist * 0.15;

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
        if (!showAll && !isRouted) continue;

        const { x, y } = geoToScreen(airport.lat, airport.lon);
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) continue;

        ctx.fillStyle = isRouted ? state.config.airlineColor : '#334';
        ctx.beginPath();
        ctx.arc(x, y, isRouted ? 3 : 1.5, 0, Math.PI * 2);
        ctx.fill();

        if (mapState.zoom >= 4 || isRouted) {
            ctx.fillStyle = isRouted ? '#fff' : '#667';
            ctx.font = `${Math.max(8, 10 * mapState.zoom / 4)}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(airport.iata, x, y - 6);
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
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = state.config.airlineColor;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(hub.iata, x, y - 14);
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
        const bulge = dist * 0.15;
        const cpX = midX - (dy / dist) * bulge;
        const cpY = midY + (dx / dist) * bulge;

        const t = flight.progress;
        const fx = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cpX + t * t * p2.x;
        const fy = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cpY + t * t * p2.y;

        ctx.fillStyle = state.config.airlineColor;
        ctx.shadowColor = state.config.airlineColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

export function getMapState() {
    return mapState;
}
