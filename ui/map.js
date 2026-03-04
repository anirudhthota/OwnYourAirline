import { getState } from '../engine/state.js';
import { getAirportByIata, AIRPORTS, getDistanceBetweenAirports } from '../data/airports.js';
import { formatGameTimestamp } from '../engine/state.js';

let map = null;
let layerGroups = {
    playerRoutes: null,
    aiRoutes: null,
    airports: null,
    flights: null,
    hub: null
};

let mapToggles = {
    showPlayerRoutes: true,
    showAIRoutes: true,
    showLabels: true,
    showFlights: true,
    aiAirlineFilter: ''
};

const MAX_AI_ROUTES = 40;
const AI_ROUTE_RADIUS_KM = 3000;

export function initMap() {
    const container = document.getElementById('map-container');
    if (!container) return;

    // Remove old canvas if present
    const oldCanvas = container.querySelector('canvas');
    if (oldCanvas) oldCanvas.remove();

    // Create map div
    let mapDiv = container.querySelector('#leaflet-map');
    if (!mapDiv) {
        mapDiv = document.createElement('div');
        mapDiv.id = 'leaflet-map';
        mapDiv.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;z-index:1;';
        container.appendChild(mapDiv);
    }

    const state = getState();
    const hub = getAirportByIata(state.config.hubAirport);
    const startLat = hub ? hub.lat : 20;
    const startLon = hub ? hub.lon : 0;

    map = L.map('leaflet-map', {
        center: [startLat, startLon],
        zoom: 4,
        minZoom: 2,
        maxZoom: 14,
        worldCopyJump: true,
        zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Add zoom control to bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create layer groups
    layerGroups.aiRoutes = L.layerGroup().addTo(map);
    layerGroups.playerRoutes = L.layerGroup().addTo(map);
    layerGroups.airports = L.layerGroup().addTo(map);
    layerGroups.flights = L.layerGroup().addTo(map);
    layerGroups.hub = L.layerGroup().addTo(map);

    // Listen for zoom/move changes to update airports and AI routes
    map.on('zoomend', () => {
        drawAirports();
        if (mapToggles.showAIRoutes) drawAIRoutes();
    });
    map.on('moveend', () => {
        if (mapToggles.showAIRoutes) drawAIRoutes();
    });

    createMapControls();
    renderMap();
}

function createMapControls() {
    const container = document.getElementById('map-container');
    if (!container) return;

    // Remove old controls if present
    const existing = container.querySelector('.map-controls');
    if (existing) existing.remove();

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
                <span>Live flights</span>
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
        if (!e.target.checked) layerGroups.playerRoutes.clearLayers();
        else drawPlayerRoutes();
    });
    panel.querySelector('#mc-ai-routes').addEventListener('change', (e) => {
        mapToggles.showAIRoutes = e.target.checked;
        if (!e.target.checked) layerGroups.aiRoutes.clearLayers();
        else drawAIRoutes();
    });
    panel.querySelector('#mc-labels').addEventListener('change', (e) => {
        mapToggles.showLabels = e.target.checked;
        drawAirports();
    });
    panel.querySelector('#mc-flights').addEventListener('change', (e) => {
        mapToggles.showFlights = e.target.checked;
        if (!e.target.checked) layerGroups.flights.clearLayers();
        else drawActiveFlights();
    });

    const filterSelect = panel.querySelector('#mc-airline-filter');
    filterSelect.addEventListener('change', (e) => {
        mapToggles.aiAirlineFilter = e.target.value;
        drawAIRoutes();
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

// ===== Geodesic arc helper =====
function computeGeodesicArc(lat1, lon1, lat2, lon2, numPoints) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    const phi1 = lat1 * toRad;
    const phi2 = lat2 * toRad;
    const lam1 = lon1 * toRad;
    const lam2 = lon2 * toRad;

    const d = 2 * Math.asin(Math.sqrt(
        Math.pow(Math.sin((phi2 - phi1) / 2), 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.pow(Math.sin((lam2 - lam1) / 2), 2)
    ));

    if (d < 1e-10) return [[lat1, lon1], [lat2, lon2]];

    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const f = i / numPoints;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(phi1) * Math.cos(lam1) + B * Math.cos(phi2) * Math.cos(lam2);
        const y = A * Math.cos(phi1) * Math.sin(lam1) + B * Math.cos(phi2) * Math.sin(lam2);
        const z = A * Math.sin(phi1) + B * Math.sin(phi2);
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * toDeg;
        const lon = Math.atan2(y, x) * toDeg;
        points.push([lat, lon]);
    }
    return points;
}

function offsetArc(points, offsetPixels) {
    if (!map || points.length < 2) return points;

    const result = [];
    for (let i = 0; i < points.length; i++) {
        const pt = map.latLngToContainerPoint(L.latLng(points[i][0], points[i][1]));

        let dx, dy;
        if (i === 0) {
            const next = map.latLngToContainerPoint(L.latLng(points[i + 1][0], points[i + 1][1]));
            dx = next.x - pt.x;
            dy = next.y - pt.y;
        } else if (i === points.length - 1) {
            const prev = map.latLngToContainerPoint(L.latLng(points[i - 1][0], points[i - 1][1]));
            dx = pt.x - prev.x;
            dy = pt.y - prev.y;
        } else {
            const prev = map.latLngToContainerPoint(L.latLng(points[i - 1][0], points[i - 1][1]));
            const next = map.latLngToContainerPoint(L.latLng(points[i + 1][0], points[i + 1][1]));
            dx = next.x - prev.x;
            dy = next.y - prev.y;
        }

        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.01) {
            result.push(points[i]);
            continue;
        }

        // Perpendicular offset
        const nx = -dy / len * offsetPixels;
        const ny = dx / len * offsetPixels;

        const offsetPt = map.containerPointToLatLng(L.point(pt.x + nx, pt.y + ny));
        result.push([offsetPt.lat, offsetPt.lng]);
    }
    return result;
}

// ===== Render functions =====

export function renderMap() {
    if (!map) return;
    const state = getState();
    if (!state) return;

    if (mapToggles.showAIRoutes) drawAIRoutes();
    else layerGroups.aiRoutes.clearLayers();

    if (mapToggles.showPlayerRoutes) drawPlayerRoutes();
    else layerGroups.playerRoutes.clearLayers();

    drawAirports();

    if (mapToggles.showFlights) drawActiveFlights();
    else layerGroups.flights.clearLayers();

    drawHub();
}

function drawAIRoutes() {
    const state = getState();
    if (!state || !state.ai || !state.ai.routes) return;

    layerGroups.aiRoutes.clearLayers();

    const filter = mapToggles.aiAirlineFilter;
    const center = map.getCenter();
    const centerLat = center.lat;
    const centerLon = center.lng;

    const candidates = [];

    for (const route of state.ai.routes) {
        if (filter && route.airlineIata !== filter) continue;

        const origin = getAirportByIata(route.origin);
        const dest = getAirportByIata(route.destination);
        if (!origin || !dest) continue;

        // Distance from map center
        const d1 = haversineKm(centerLat, centerLon, origin.lat, origin.lon);
        const d2 = haversineKm(centerLat, centerLon, dest.lat, dest.lon);
        const minDist = Math.min(d1, d2);

        if (!filter && minDist > AI_ROUTE_RADIUS_KM) continue;

        const airline = state.ai.airlines.find(a => a.iata === route.airlineIata);
        candidates.push({ route, origin, dest, minDist, airline });
    }

    candidates.sort((a, b) => a.minDist - b.minDist);

    const limit = filter ? candidates.length : Math.min(MAX_AI_ROUTES, candidates.length);

    for (let i = 0; i < limit; i++) {
        const { origin, dest, airline } = candidates[i];
        const color = airline ? airline.color : '#555';
        const opacity = filter ? 0.5 : 0.15;
        const weight = filter ? 1.0 : 0.6;

        const arcPoints = computeGeodesicArc(origin.lat, origin.lon, dest.lat, dest.lon, 20);
        L.polyline(arcPoints, {
            color,
            weight,
            opacity,
            interactive: false
        }).addTo(layerGroups.aiRoutes);
    }
}

function drawPlayerRoutes() {
    const state = getState();
    if (!state) return;

    layerGroups.playerRoutes.clearLayers();

    const color = state.config.airlineColor;
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

        const arcPoints = computeGeodesicArc(origin.lat, origin.lon, dest.lat, dest.lon, 20);

        let displayPoints;
        if (offsetDir !== 0) {
            displayPoints = offsetArc(arcPoints, offsetDir * 4);
        } else {
            displayPoints = arcPoints;
        }

        // Wider transparent glow line underneath
        L.polyline(displayPoints, {
            color,
            weight: 6,
            opacity: 0.15,
            interactive: false
        }).addTo(layerGroups.playerRoutes);

        // Main route line
        L.polyline(displayPoints, {
            color,
            weight: 2.5,
            opacity: 0.8,
            interactive: false
        }).addTo(layerGroups.playerRoutes);
    }
}

function drawAirports() {
    const state = getState();
    if (!state) return;

    layerGroups.airports.clearLayers();

    const zoom = map.getZoom();
    const routeAirports = new Set();
    for (const route of state.routes) {
        if (route.active) {
            routeAirports.add(route.origin);
            routeAirports.add(route.destination);
        }
    }

    const aiHubs = new Set();
    for (const airline of state.ai.airlines) {
        aiHubs.add(airline.hub);
    }

    const color = state.config.airlineColor;

    // Only show airports in viewport bounds with a buffer
    const bounds = map.getBounds().pad(0.2);

    for (const airport of AIRPORTS) {
        if (airport.iata === state.config.hubAirport) continue; // hub drawn separately

        const latLng = L.latLng(airport.lat, airport.lon);
        if (!bounds.contains(latLng)) continue;

        const isPlayerDest = routeAirports.has(airport.iata);
        const isAIHub = aiHubs.has(airport.iata);

        if (isPlayerDest) {
            // Medium circle, labeled at zoom 4+
            const marker = L.circleMarker(latLng, {
                radius: 5,
                fillColor: color,
                fillOpacity: 0.9,
                color: color,
                weight: 1,
                opacity: 0.6
            });

            if (mapToggles.showLabels && zoom >= 4) {
                marker.bindTooltip(airport.iata, {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -6],
                    className: 'airport-label player-dest'
                });
            }

            marker.addTo(layerGroups.airports);
        } else if (isAIHub && zoom >= 5) {
            // Tiny dot, no label unless zoomed
            const marker = L.circleMarker(latLng, {
                radius: 2,
                fillColor: '#556',
                fillOpacity: 0.6,
                color: '#556',
                weight: 0
            });

            if (mapToggles.showLabels && zoom >= 7) {
                marker.bindTooltip(airport.iata, {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -4],
                    className: 'airport-label ai-hub'
                });
            }

            marker.addTo(layerGroups.airports);
        } else if (zoom >= 6) {
            // Small dot, labeled at zoom 6+
            const marker = L.circleMarker(latLng, {
                radius: 1.5,
                fillColor: '#2a3050',
                fillOpacity: 0.5,
                color: '#2a3050',
                weight: 0
            });

            if (mapToggles.showLabels) {
                marker.bindTooltip(airport.iata, {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -3],
                    className: 'airport-label generic'
                });
            }

            marker.addTo(layerGroups.airports);
        }
    }
}

function drawHub() {
    const state = getState();
    if (!state) return;

    layerGroups.hub.clearLayers();

    const hub = getAirportByIata(state.config.hubAirport);
    if (!hub) return;

    const color = state.config.airlineColor;
    const latLng = L.latLng(hub.lat, hub.lon);

    // Pulsing outer ring (CSS animation)
    const pulseIcon = L.divIcon({
        className: 'hub-pulse-icon',
        html: `<div class="hub-pulse-ring" style="border-color:${color};box-shadow:0 0 12px ${color};"></div>
               <div class="hub-dot" style="background:${color};"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    L.marker(latLng, { icon: pulseIcon, interactive: false, zIndexOffset: 1000 })
        .addTo(layerGroups.hub);

    // Always-visible label
    L.marker(latLng, {
        icon: L.divIcon({
            className: 'hub-label-icon',
            html: `<span class="hub-label" style="color:${color};">${hub.iata}</span>`,
            iconSize: [50, 20],
            iconAnchor: [25, -10]
        }),
        interactive: false,
        zIndexOffset: 1001
    }).addTo(layerGroups.hub);
}

function drawActiveFlights() {
    const state = getState();
    if (!state) return;

    layerGroups.flights.clearLayers();

    for (const flight of state.flights.active) {
        const origin = getAirportByIata(flight.origin);
        const dest = getAirportByIata(flight.destination);
        if (!origin || !dest) continue;

        const arcPoints = computeGeodesicArc(origin.lat, origin.lon, dest.lat, dest.lon, 20);

        // Interpolate position along the arc
        const t = flight.progress;
        const totalSegments = arcPoints.length - 1;
        const exactIdx = t * totalSegments;
        const idx = Math.min(Math.floor(exactIdx), totalSegments - 1);
        const frac = exactIdx - idx;

        const lat = arcPoints[idx][0] + frac * (arcPoints[idx + 1][0] - arcPoints[idx][0]);
        const lon = arcPoints[idx][1] + frac * (arcPoints[idx + 1][1] - arcPoints[idx][1]);

        // Calculate rotation angle from direction of travel
        let angle = 0;
        if (idx < totalSegments) {
            const p1 = map.latLngToContainerPoint(L.latLng(arcPoints[idx][0], arcPoints[idx][1]));
            const nextIdx = Math.min(idx + 1, totalSegments);
            const p2 = map.latLngToContainerPoint(L.latLng(arcPoints[nextIdx][0], arcPoints[nextIdx][1]));
            angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
        }

        const flightIcon = L.divIcon({
            className: 'flight-icon',
            html: `<span class="flight-plane" style="transform:rotate(${angle}deg);">&#9992;</span>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const depTime = formatGameTimestamp(flight.departureTime);
        const arrTime = formatGameTimestamp(flight.arrivalTime);
        const tooltipHtml = `
            <div class="flight-tip-content">
                <strong>${flight.origin} \u2192 ${flight.destination}</strong><br>
                ${flight.aircraftType} (${flight.registration})<br>
                Dep: ${depTime}<br>
                Arr: ${arrTime}<br>
                Pax: ${flight.passengers}
            </div>
        `;

        const marker = L.marker([lat, lon], { icon: flightIcon, zIndexOffset: 2000 });
        marker.bindPopup(tooltipHtml, { className: 'flight-tooltip', offset: [0, -5] });
        marker.addTo(layerGroups.flights);
    }
}

// ===== Utility =====

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getMapState() {
    if (!map) return { zoom: 1 };
    return { zoom: map.getZoom(), center: map.getCenter() };
}
