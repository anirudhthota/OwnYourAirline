import { getState, formatMoney, MINUTES_PER_DAY } from '../../engine/state.js';
import { getAirportByIata } from '../../data/airports.js';
import { getAircraftByType } from '../../data/aircraft.js';
import { calculateBlockTime, getRouteById } from '../../engine/routeEngine.js';
import { StatCard } from '../components/StatCard.js';
import { DataTable } from '../components/DataTable.js';
import { showPanel, openRouteDetail } from '../services/uiState.js';

export function renderHubOperationsView(container) {
    const state = getState();
    const hubCode = state.config.hubAirport;
    const hubAirport = getAirportByIata(hubCode);
    const hubName = hubAirport ? hubAirport.name : 'Unknown Airport';

    // --- Data Derivation (Last 1440 mins) ---
    const currentTime = state.clock.totalMinutes;
    const lookback = 1440;

    let arrivalsToday = 0;
    let departuresToday = 0;
    let transfersSum = 0;

    // Route Metrics Dictionary
    const routeMetrics = {};
    state.routes.forEach(r => {
        routeMetrics[r.id] = { pax: 0, transfers: 0, capacity: 0, count: 0 };
    });

    state.flights.completed.forEach(f => {
        const arrTimeDiff = currentTime - f.arrivalTime;
        const depTimeDiff = currentTime - f.departureTime;

        if (f.destination === hubCode && arrTimeDiff >= 0 && arrTimeDiff <= lookback) {
            arrivalsToday++;
        }
        if (f.origin === hubCode && Math.max(0, depTimeDiff) <= lookback) {
            departuresToday++;
            transfersSum += (f.transferPassengers || 0);
        }

        if ((f.destination === hubCode && arrTimeDiff >= 0 && arrTimeDiff <= lookback) ||
            (f.origin === hubCode && Math.max(0, depTimeDiff) <= lookback)) {
            if (routeMetrics[f.routeId]) {
                routeMetrics[f.routeId].pax += (f.passengers || 0);
                routeMetrics[f.routeId].transfers += (f.transferPassengers || 0);
                const acData = getAircraftByType(f.aircraftType);
                routeMetrics[f.routeId].capacity += (acData ? acData.seats : 0);
                routeMetrics[f.routeId].count++;
            }
        }
    });

    const inboundRoutes = state.routes.filter(r => r.active && r.destination === hubCode);
    const outboundRoutes = state.routes.filter(r => r.active && r.origin === hubCode);
    const totalActiveHubRoutes = inboundRoutes.length + outboundRoutes.length;

    // --- Timeline & Congestion Data Derivation ---
    const hourlyBuckets = Array(24).fill(0).map(() => ({ arr: 0, dep: 0, txPoints: 0 }));
    let minuteGroundCount = Array(1440).fill(0);

    state.schedules.forEach(s => {
        const route = getRouteById(s.routeId);
        if (!route) return;

        let acData = null;
        if (s.aircraftId) {
            const ac = state.fleet.find(f => f.id === s.aircraftId);
            if (ac) acData = getAircraftByType(ac.type);
        }
        const blockTime = acData ? calculateBlockTime(route.distance, acData.id) : calculateBlockTime(route.distance, 'A320'); // fallback
        const turnaround = s.turnaroundMinutes;

        s.departureTimes.forEach(t => {
            const depMins = t.hour * 60 + t.minute;
            const arrMins = depMins + blockTime;

            if (route.origin === hubCode) {
                // Outbound from Hub
                const hour = Math.floor(depMins / 60) % 24;
                hourlyBuckets[hour].dep++;
                // Ground time before departure
                const turnStart = (depMins - turnaround + 1440) % 1440;
                for (let i = 0; i < turnaround; i++) {
                    minuteGroundCount[(turnStart + i) % 1440]++;
                }
            } else if (route.destination === hubCode) {
                // Inbound to Hub
                const arrHour = Math.floor(arrMins / 60) % 24;
                hourlyBuckets[arrHour].arr++;
                // Ground time after arrival
                const arrMod = arrMins % 1440;
                for (let i = 0; i < turnaround; i++) {
                    minuteGroundCount[(arrMod + i) % 1440]++;
                }
            }
        });
    });

    const peakGroundAircraft = Math.max(...minuteGroundCount, 0);

    // --- Header ---
    window._hubOpsBack = () => { showPanel('dashboard'); };
    window._hubOpsRefresh = () => { renderHubOperationsView(container); };

    const headerHtml = `
        <div class="panel-header" style="align-items: flex-start;">
            <div>
                <h2 style="margin-bottom: 4px; display: flex; align-items: center; gap: 12px;">
                    ${hubCode} Operations Center
                    <span class="badge" style="background:var(--color-info,#3b82f6);">PRIMARY HUB</span>
                </h2>
                <div style="font-size: 14px; color: var(--text-muted); display: flex; gap: 16px;">
                    <span><strong>Airport:</strong> ${hubName}</span>
                    <span><strong>Active Routes:</strong> ${totalActiveHubRoutes}</span>
                    <span><strong>Inbound:</strong> ${inboundRoutes.length} | <strong>Outbound:</strong> ${outboundRoutes.length}</span>
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-sm btn-accent" onclick="window._hubOpsRefresh()">Refresh View</button>
                <button class="btn-sm" onclick="window._hubOpsBack()">Back to Dashboard</button>
            </div>
        </div>
    `;

    // --- KPI Strip ---
    const kpiHtml = `
        <div class="dashboard-grid" style="margin-bottom: 24px; display:grid; grid-template-columns: repeat(6, 1fr) !important;">
            ${StatCard('Arrivals Today', arrivalsToday)}
            ${StatCard('Departures Today', departuresToday)}
            ${StatCard('Transfers Today', transfersSum)}
            ${StatCard('Avg Connection Time', 'Est. 85m')}
            ${StatCard('Missed Connections', 'Est. 0 (V1)')}
            ${StatCard('Hub Congestion', peakGroundAircraft > 15 ? 'High' : (peakGroundAircraft > 5 ? 'Moderate' : 'Low'))}
        </div>
    `;

    // --- Activity Timeline ---
    let timelineBlocksHtml = '';
    let maxActivity = 1;
    hourlyBuckets.forEach(b => {
        if (b.arr + b.dep > maxActivity) maxActivity = b.arr + b.dep;
    });

    const isTimelineEmpty = hourlyBuckets.every(b => b.arr === 0 && b.dep === 0);

    if (isTimelineEmpty) {
        timelineBlocksHtml = '<div class="empty-state" style="width:100%; text-align:center; padding: 20px 0;">No scheduled hub activity in the next 24 hours.</div>';
    } else {
        hourlyBuckets.forEach((b, i) => {
            const arrPct = (b.arr / maxActivity) * 100;
            const depPct = (b.dep / maxActivity) * 100;

            const labelDep = b.dep > 0 ? `Departures: ${b.dep}` : '';
            const labelArr = b.arr > 0 ? `Arrivals: ${b.arr}` : '';
            const tooltipStr = `Hour ${String(i).padStart(2, '0')}:00\n${labelArr}\n${labelDep}`.trim();

            timelineBlocksHtml += `
                <div title="${tooltipStr}" style="flex: 1; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:2px; height:100%; position:relative; cursor:default;">
                    <div style="width: 60%; height: ${depPct}%; background: var(--color-success,#22c55e); border-radius:2px 2px 0 0; min-height: ${b.dep > 0 ? '4px' : '0'};"></div>
                    <div style="width: 60%; height: ${arrPct}%; background: var(--color-info,#3b82f6); border-radius: ${b.dep === 0 ? '2px 2px 0 0' : '0'}; min-height: ${b.arr > 0 ? '4px' : '0'};"></div>
                    <div style="position:absolute; bottom:-20px; font-size:9px; color:var(--text-muted); font-family:var(--font-mono);">${String(i).padStart(2, '0')}:00</div>
                </div>
            `;
        });
    }

    const timelineHtml = `
        <h2 class="uc-section-title">24-Hour Hub Activity (Arrivals vs Departures)</h2>
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; padding:20px; margin-bottom: 24px;">
            <div style="display:flex; justify-content:flex-end; gap:15px; margin-bottom:10px; font-size:12px;">
                <div style="display:flex; align-items:center; gap:6px;"><div style="width:12px; height:12px; background:var(--color-info,#3b82f6); border-radius:2px;"></div> Arrivals</div>
                <div style="display:flex; align-items:center; gap:6px;"><div style="width:12px; height:12px; background:var(--color-success,#22c55e); border-radius:2px;"></div> Departures</div>
            </div>
            <div style="display:flex; width:100%; height:120px; align-items:${isTimelineEmpty ? 'center' : 'flex-end'}; gap:4px; padding-bottom: 25px; border-bottom: ${isTimelineEmpty ? '0' : '2px solid var(--border-color)'};">
                ${timelineBlocksHtml}
            </div>
        </div>
    `;

    // --- Connection Performance Table ---
    let connRowsHtml = '';
    const flowRates = state.transfers.flowRates || {};
    const flowKeys = Object.keys(flowRates);

    if (flowKeys.length === 0) {
        connRowsHtml = '';
    } else {
        flowKeys.forEach(key => {
            const flow = flowRates[key];
            const [origin, dest] = key.split('-');

            // Generate a simple derived quality string
            const waitTime = flow.earliestValidConnection === null ? 'N/A' : 'Valid';
            let quality = '<span style="color:var(--text-muted);">Standard</span>';
            if (flow.potentialTransferDemand > 50) quality = '<span style="color:var(--color-success);">High Value</span>';

            connRowsHtml += `
                <tr>
                    <td><strong>${origin}</strong></td>
                    <td><strong>${dest}</strong></td>
                    <td>${hubCode}</td>
                    <td>~${flow.potentialTransferDemand} / day</td>
                    <td>Est. Proxy Valid</td>
                    <td>${quality}</td>
                    <td><span class="badge" style="background:var(--bg-surface-highlight);color:var(--text-muted);">Active (V1)</span></td>
                </tr>
            `;
        });
    }

    const connTableHtml = `
        <h2 class="uc-section-title">Connection Performance (Flow Matrices)</h2>
        <div style="margin-bottom: 24px;">
            ${DataTable(
        ['Origin', 'Destination', 'Connecting Via', 'Est. Daily Demand', 'Avg Connection Time', 'Connection Type', 'Status'],
        connRowsHtml,
        '<div class="empty-state" style="padding: 20px;">No transfer configurations established yet. Build intersecting routes through the Hub.</div>'
    )}
        </div>
    `;

    // --- Route Role Table ---
    let roleRowsHtml = '';
    const activeHubRoutes = state.routes.filter(r => r.active && (r.origin === hubCode || r.destination === hubCode));

    if (activeHubRoutes.length === 0) {
        roleRowsHtml = '';
    } else {
        activeHubRoutes.forEach(r => {
            const metrics = routeMetrics[r.id] || { pax: 0, transfers: 0, capacity: 0, count: 0 };

            let role = 'Standard Network';
            let badgeBg = 'var(--bg-surface-highlight)';
            let badgeText = 'var(--text-muted)';

            const paxRatio = metrics.capacity > 0 ? (metrics.pax / metrics.capacity) : 0;
            const transferRatio = metrics.pax > 0 ? (metrics.transfers / metrics.pax) : 0;

            if (transferRatio > 0.4 && metrics.capacity < 180) {
                role = 'Feeder';
                badgeBg = 'var(--color-info)';
                badgeText = '#fff';
            } else if (metrics.capacity >= 200 && paxRatio > 0.6) {
                role = 'Trunk';
                badgeBg = 'var(--color-success)';
                badgeText = '#fff';
            } else if (metrics.capacity > 0 && paxRatio < 0.4) {
                role = 'Thin Route';
                badgeBg = 'var(--color-warning)';
                badgeText = '#fff';
            } else if (transferRatio > 0.3) {
                role = 'Connector';
                badgeBg = 'var(--color-primary)';
                badgeText = '#fff';
            }

            const lfStr = metrics.capacity > 0 ? ((metrics.pax / metrics.capacity) * 100).toFixed(1) + '%' : '-';

            roleRowsHtml += `
                <tr>
                    <td><strong>${r.origin} \u2192 ${r.destination}</strong></td>
                    <td><span class="badge" style="background:${badgeBg}; color:${badgeText};">${role}</span></td>
                    <td>${metrics.pax}</td>
                    <td>${metrics.transfers}</td>
                    <td>${lfStr}</td>
                    <td><span class="badge" style="background:var(--bg-surface-highlight); color:var(--text-muted);">Active</span></td>
                </tr>
            `;
        });
    }

    const roleTableHtml = `
        <h2 class="uc-section-title">Route Role Classification</h2>
        <div style="margin-bottom: 24px;" id="hub-role-table-container">
            ${DataTable(
        ['Route', 'Role', 'Pax Today', 'Transfers Today', 'Load Factor', 'Status'],
        roleRowsHtml,
        '<div class="empty-state" style="padding: 20px;">No active routes through the Hub today.</div>'
    )}
        </div>
    `;

    // --- Congestion / Future Sections ---
    const bottomSectionsHtml = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px;">
            <div>
                <h2 class="uc-section-title">Congestion Summary</h2>
                <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; padding:20px;">
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color);">
                        <span style="color:var(--text-muted);">Peak Aircraft on Ground (Est.)</span>
                        <strong>${peakGroundAircraft}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color);">
                        <span style="color:var(--text-muted);">Maintenance Impact on Gates</span>
                        <strong>Minor (V1)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:8px 0;">
                        <span style="color:var(--text-muted);">Hub Idle Gaps</span>
                        <strong>${hourlyBuckets.filter(b => b.arr === 0 && b.dep === 0).length} Hours</strong>
                    </div>
                </div>
            </div>
            <div>
                <h2 class="uc-section-title">Future Hub Capabilities</h2>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background:var(--bg-surface-highlight); border:1px dashed var(--border-color); border-radius:8px; padding:15px; text-align:center; color:var(--text-muted);">
                        <h4 style="margin:0 0 5px 0; font-size:13px;">Gate Management</h4>
                        <div style="font-size:11px;">Coming soon</div>
                    </div>
                    <div style="background:var(--bg-surface-highlight); border:1px dashed var(--border-color); border-radius:8px; padding:15px; text-align:center; color:var(--text-muted);">
                        <h4 style="margin:0 0 5px 0; font-size:13px;">Connection Tuner</h4>
                        <div style="font-size:11px;">Coming soon</div>
                    </div>
                    <div style="background:var(--bg-surface-highlight); border:1px dashed var(--border-color); border-radius:8px; padding:15px; text-align:center; color:var(--text-muted);">
                        <h4 style="margin:0 0 5px 0; font-size:13px;">Slot Pressure Maps</h4>
                        <div style="font-size:11px;">Coming soon</div>
                    </div>
                    <div style="background:var(--bg-surface-highlight); border:1px dashed var(--border-color); border-radius:8px; padding:15px; text-align:center; color:var(--text-muted);">
                        <h4 style="margin:0 0 5px 0; font-size:13px;">True Missed KPIs</h4>
                        <div style="font-size:11px;">Coming soon</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = `
        ${headerHtml}
        ${kpiHtml}
        ${timelineHtml}
        ${connTableHtml}
        ${roleTableHtml}
        ${bottomSectionsHtml}
    `;

    // Wire up row clicks to Route Detail View protecting sort buttons
    const roleTable = container.querySelector('#hub-role-table-container');
    if (roleTable) {
        roleTable.querySelectorAll('.hub-route-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // let sorting or internal buttons work unaffected
                if (e.target.closest('th')) return; // ignore header clicks for sorting
                const routeId = parseInt(row.dataset.routeId);
                openRouteDetail(routeId);
            });
        });
    }
}
