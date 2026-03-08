import { getState, formatMoney, MINUTES_PER_DAY } from '../../engine/state.js';
import { getAircraftByType, MAINTENANCE_RULES } from '../../data/aircraft.js';
import { getSchedulesByAircraft } from '../../engine/scheduler.js';
import { calculateBlockTime, getRouteById } from '../../engine/routeEngine.js';
import { StatCard } from '../components/StatCard.js';
import { DataTable } from '../components/DataTable.js';
import { formatLocation, uiState, showPanel } from '../services/uiState.js';
import { sellAircraft, startMaintenance } from '../../engine/fleetManager.js';
import { getAircraftRotationTimelineBlocks, buildAircraftRotationChain } from '../../engine/rotationEngine.js';
import { showConfirm } from '../components/Modal.js';
import { updateHUD } from '../hud.js';

export function renderAircraftDetailView(container) {
    const state = getState();
    const ac = state.fleet.find(f => f.id === uiState.activeAircraftId);

    if (!ac) {
        container.innerHTML = `
            <div class="panel-header">
                <h2>Aircraft Details</h2>
                <button class="btn-sm" onclick="document.getElementById('side-fleet').click()">Back to Fleet</button>
            </div>
            <div class="empty-state">Aircraft not found. It may have been sold or returned.</div>
        `;
        return;
    }

    const acData = getAircraftByType(ac.type);
    const schedules = getSchedulesByAircraft(ac.id);

    // --- Data Derivation for Last 1440 mins ---
    const recentFlights = state.flights.completed.filter(
        f => f.aircraftId === ac.id && (state.clock.totalMinutes - f.arrivalTime) <= 1440
    );

    let flightsTodayCount = 0;
    let revenueToday = 0;
    let costToday = 0;
    let profitToday = 0;
    let transfersToday = 0;
    let totalPax = 0;
    let totalCap = 0;

    recentFlights.forEach(f => {
        flightsTodayCount++;
        const rev = f.revenue || 0;
        const cst = f.cost || 0;
        revenueToday += rev;
        costToday += cst;
        profitToday += (rev - cst);
        transfersToday += (f.transferPassengers || 0);
        totalPax += (f.passengers || 0);
        totalCap += (acData ? acData.seats : 0);
    });

    const avgLoadFactor = totalCap > 0 ? (totalPax / totalCap) * 100 : 0;
    const profitPerFlight = flightsTodayCount > 0 ? profitToday / flightsTodayCount : 0;

    let activeMinutes = 0;
    let scheduledFlightsToday = 0;
    schedules.forEach(s => {
        const route = getRouteById(s.routeId);
        if (!route) return;
        const blockTime = acData ? calculateBlockTime(route.distance, ac.type) : 0;
        scheduledFlightsToday += s.departureTimes.length;
        activeMinutes += (blockTime + s.turnaroundMinutes) * s.departureTimes.length;
    });
    const utilPercent = Math.min(100, (activeMinutes / 1440) * 100);

    // --- Header Badges & Actions ---
    let badgeHtml = '<span class="badge" style="background:var(--color-success,#22c55e);">AVAILABLE</span>';
    if (ac.status === 'in_flight') badgeHtml = '<span class="badge" style="background:var(--color-info,#3b82f6);">IN FLIGHT</span>';
    if (ac.status === 'maintenance') badgeHtml = '<span class="badge" style="background:var(--color-danger,#ef4444);">MAINTENANCE</span>';
    if (ac.status === 'maintenance_due') badgeHtml = '<span class="badge" style="background:var(--color-warning,#f59e0b); color:#fff;">MAINT DUE</span>';

    const ownershipStr = ac.ownership === 'OWNED' ? 'Owned' : 'Leased';

    // Actions
    window._acDetailBack = () => { showPanel('fleet'); };
    window._acDetailSell = () => {
        if (ac.ownership === 'OWNED') {
            showConfirm('Sell Aircraft', `Sell <strong>${ac.type}</strong> (${ac.registration})?`, () => {
                if (sellAircraft(ac.id)) { updateHUD(); showPanel('fleet'); }
            });
        }
    };
    window._acDetailMaint = () => {
        showConfirm('Start Maintenance', `Start <strong>${ac.pendingCheckType}-Check</strong> for ${ac.registration}? Schedules will be unassigned.`, () => {
            if (startMaintenance(ac.id)) { updateHUD(); renderAircraftDetailView(container); }
        });
    };

    let maintBtnHtml = '';
    if (ac.status === 'maintenance_due' || ac.status === 'idle' || ac.status === 'available') {
        const cType = ac.pendingCheckType || 'A';
        maintBtnHtml = `<button class="btn-sm btn-accent" onclick="window._acDetailMaint()">Perform ${cType}-Check</button>`;
    }

    const headerHtml = `
        <div class="panel-header" style="align-items: flex-start;">
            <div>
                <h2 style="margin-bottom: 4px; display: flex; align-items: center; gap: 12px;">
                    ${ac.registration} 
                    ${badgeHtml}
                </h2>
                <div style="font-size: 14px; color: var(--text-muted); display: flex; gap: 16px;">
                    <span><strong>Type:</strong> ${ac.type}</span>
                    <span><strong>Status:</strong> ${ownershipStr}</span>
                    <span><strong>Location:</strong> ${formatLocation(ac)}</span>
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                ${maintBtnHtml}
                ${ac.ownership === 'OWNED' ? `<button class="btn-sm btn-danger" onclick="window._acDetailSell()">Sell Aircraft</button>` : ''}
                <button class="btn-sm" onclick="window._acDetailBack()">Back to Fleet</button>
            </div>
        </div>
    `;

    // --- Maintenance Logic ---
    let maintenanceStatus = 'OK';
    let hrsToNext = Infinity;
    let nextCheckType = 'A';

    if (ac.hoursSinceACheck !== undefined) {
        const aDiff = MAINTENANCE_RULES.A.threshold - ac.hoursSinceACheck;
        const bDiff = MAINTENANCE_RULES.B.threshold - ac.hoursSinceBCheck;
        const cDiff = MAINTENANCE_RULES.C.threshold - ac.hoursSinceCCheck;

        hrsToNext = Math.min(aDiff, bDiff, cDiff);
        if (hrsToNext === aDiff) nextCheckType = 'A';
        if (hrsToNext === bDiff) nextCheckType = 'B';
        if (hrsToNext === cDiff) nextCheckType = 'C';
    }

    if (ac.status === 'maintenance') {
        maintenanceStatus = 'In Maintenance';
    } else if (ac.status === 'maintenance_due') {
        maintenanceStatus = `${ac.pendingCheckType}-Check Due`;
    } else {
        maintenanceStatus = `${Math.max(0, Math.floor(hrsToNext))}h to ${nextCheckType}-Check`;
    }

    // --- Health Strip (StatCards) ---
    const healthStripHtml = `
        <div class="dashboard-grid" style="margin-bottom: 24px; display:grid; grid-template-columns: repeat(6, 1fr) !important;">
            ${StatCard('Flights Today', scheduledFlightsToday)}
            ${StatCard('Utilization', utilPercent.toFixed(1) + '%')}
            ${StatCard('Revenue (24h)', '$' + formatMoney(revenueToday))}
            ${StatCard('Profit (24h)', '$' + formatMoney(profitToday))}
            ${StatCard('Transfers (24h)', transfersToday)}
            ${StatCard('Maint State', maintenanceStatus)}
        </div>
    `;

    // --- 24-Hour Timeline ---
    let blocksHtml = '';
    const timelineBlocks = getAircraftRotationTimelineBlocks(ac.id);

    timelineBlocks.forEach(b => {
        const clampedStart = Math.max(0, b.start);
        const clampedEnd = Math.min(1440, b.end);
        const widthPct = ((clampedEnd - clampedStart) / 1440) * 100;
        const leftPct = (clampedStart / 1440) * 100;

        if (widthPct <= 0) return;

        const textColor = b.type === 'idle' ? 'var(--text-muted)' : '#fff';
        const showLabel = widthPct > 10 ? b.label : '';

        blocksHtml += `<div title="${b.label} (${Math.floor(clampedStart / 60)}:${String(clampedStart % 60).padStart(2, '0')} - ${Math.floor(clampedEnd / 60)}:${String(clampedEnd % 60).padStart(2, '0')})" style="position:absolute; left:${leftPct}%; width:${widthPct}%; height:100%; background:${b.color}; display:flex; align-items:center; justify-content:center; color:${textColor}; font-size:9px; overflow:hidden; white-space:nowrap; text-shadow: ${b.type === 'idle' ? 'none' : '0 1px 2px rgba(0,0,0,0.5)'}; border-right: 1px solid rgba(0,0,0,0.2); font-weight:bold;">${showLabel}</div>`;
    });

    const timelineHtml = `
        <h2 class="uc-section-title">24-Hour Timeline</h2>
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; padding:20px; margin-bottom: 24px;">
            <div style="display:flex; gap:15px; margin-bottom:15px; font-size:12px;">
                <div style="display:flex; align-items:center; gap:6px;"><div style="width:14px; height:14px; background:var(--color-info,#3b82f6); border-radius:3px;"></div> Flight</div>
                <div style="display:flex; align-items:center; gap:6px;"><div style="width:14px; height:14px; background:var(--color-warning,#f59e0b); border-radius:3px;"></div> Turnaround</div>
                <div style="display:flex; align-items:center; gap:6px;"><div style="width:14px; height:14px; background:var(--color-danger,#ef4444); border-radius:3px;"></div> Maintenance</div>
                <div style="display:flex; align-items:center; gap:6px;"><div style="width:14px; height:14px; background:var(--bg-surface-highlight); border-radius:3px; border: 1px solid var(--border-color);"></div> Idle</div>
            </div>
            <div style="position:relative; width:100%; height:48px; background:var(--bg-surface-highlight); border-radius:6px; overflow:hidden; border:1px solid var(--border-color);">
                ${blocksHtml}
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; font-size:11px; color:var(--text-muted); margin-top:8px; font-family:var(--font-mono);">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
            </div>
        </div>
    `;

    // --- Today's Flight Assignment Table ---
    const tableHeaders = ['Flight', 'Route', 'Departure', 'Arrival', 'Passengers', 'Transfers', 'Load Factor', 'Revenue', 'Profit', 'Status'];
    let assignmentRowsHtml = '';

    const rotationChain = buildAircraftRotationChain(ac.id);

    if (rotationChain.length === 0) {
        assignmentRowsHtml = '';
    } else {
        rotationChain.forEach((leg, i) => {
            const flightNumber = leg.flightNumber || `${state.config.iataCode}${leg.scheduleId}x${i}`;
            const depH = Math.floor(leg.depMinute / 60) % 24;
            const depM = leg.depMinute % 60;
            const arrH = Math.floor(leg.arrMinute / 60) % 24;
            const arrM = leg.arrMinute % 60;
            const depStr = `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`;
            const arrStr = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;

            const recentF = recentFlights.find(f => f.flightNumber === flightNumber);

            let paxStr = '-';
            let txStr = '-';
            let lfStr = '-';
            let revStr = '-';
            let profStr = '-';
            let profColor = 'inherit';
            let statusBadge = '<span class="badge" style="background:var(--bg-surface-highlight);color:var(--text-muted)">Scheduled</span>';

            const currentMinuteOfDay = state.clock.totalMinutes % MINUTES_PER_DAY;
            if (recentF) {
                paxStr = recentF.passengers || 0;
                txStr = recentF.transferPassengers || 0;
                lfStr = ((recentF.loadFactor || 0) * 100).toFixed(0) + '%';
                revStr = '$' + formatMoney(recentF.revenue || 0);
                const pr = (recentF.revenue || 0) - (recentF.cost || 0);
                profStr = '$' + formatMoney(pr);
                if (pr > 0) profColor = 'var(--color-success)';
                else if (pr < 0) profColor = 'var(--color-danger)';
                statusBadge = '<span class="badge" style="background:var(--color-success,#22c55e);">Completed</span>';
            } else if (ac.status === 'in_flight') {
                // Simplified active flight check
            }

            assignmentRowsHtml += `
                <tr>
                    <td><strong>${flightNumber}</strong></td>
                    <td>${leg.origin} \u2192 ${leg.destination}</td>
                    <td>${depStr}</td>
                    <td>${arrStr}</td>
                    <td>${paxStr}</td>
                    <td>${txStr}</td>
                    <td>${lfStr}</td>
                    <td>${revStr}</td>
                    <td style="color:${profColor}; font-family:var(--font-mono);">${profStr}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
    }

    const flightTableHtml = `
        <h2 class="uc-section-title">Today's Flight Assignments</h2>
        <div style="margin-bottom: 24px;">
            ${DataTable(
        tableHeaders,
        assignmentRowsHtml,
        '<div class="empty-state" style="padding: 20px;">No schedules assigned to this aircraft.</div>'
    )}
        </div>
    `;

    // --- Maintenance Section ---
    let maintReleaseStr = 'N/A';
    if (ac.status === 'maintenance') {
        const d = Math.floor(ac.maintenanceReleaseTime / MINUTES_PER_DAY) + 1;
        const h = Math.floor((ac.maintenanceReleaseTime % 1440) / 60);
        const m = ac.maintenanceReleaseTime % 60;
        maintReleaseStr = `Day ${d}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const maintSecHtml = `
        <h2 class="uc-section-title">Maintenance Profile</h2>
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; padding:20px; margin-bottom: 24px;">
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                <div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Current State</div><div style="font-weight:600; font-size:14px;">${maintenanceStatus}</div></div>
                <div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Pending Check</div><div style="font-weight:600; font-size:14px;">${ac.pendingCheckType || 'None'}</div></div>
                <div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Grace Hours</div><div style="font-weight:600; font-size:14px;">${ac.maintenanceGraceHours > 0 ? ac.maintenanceGraceHours : '0'}h</div></div>
                <div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Release Time</div><div style="font-weight:600; font-size:14px;">${maintReleaseStr}</div></div>
            </div>
            <hr style="border:0; border-top:1px solid var(--border-color); margin: 16px 0;">
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                <div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Since A-Check (Limit: ${MAINTENANCE_RULES.A.threshold}h)</div><div style="font-weight:600; font-size:14px; font-family:var(--font-mono);">${ac.hoursSinceACheck?.toFixed(1) || 0}h</div></div>
                <div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Since B-Check (Limit: ${MAINTENANCE_RULES.B.threshold}h)</div><div style="font-weight:600; font-size:14px; font-family:var(--font-mono);">${ac.hoursSinceBCheck?.toFixed(1) || 0}h</div></div>
                <div><div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Since C-Check (Limit: ${MAINTENANCE_RULES.C.threshold}h)</div><div style="font-weight:600; font-size:14px; font-family:var(--font-mono);">${ac.hoursSinceCCheck?.toFixed(1) || 0}h</div></div>
            </div>
        </div>
    `;

    // --- Economics Section ---
    const economicsHtml = `
        <h2 class="uc-section-title">Aircraft Economics (Last 24h)</h2>
        ${recentFlights.length === 0 ?
            '<div class="empty-state" style="margin-bottom: 24px; text-align: left; padding: 20px;">No completed flights in the last 24 hours.</div>'
            : `
        <div class="dashboard-grid" style="margin-bottom: 24px;">
            ${StatCard('Revenue Today', '$' + formatMoney(revenueToday))}
            ${StatCard('Cost Today', '$' + formatMoney(costToday))}
            ${StatCard('Profit Today', '$' + formatMoney(profitToday))}
            ${StatCard('Profit / Flight', '$' + formatMoney(profitPerFlight))}
            ${StatCard('Avg Load Factor', avgLoadFactor.toFixed(1) + '%')}
        </div>
        `}
    `;

    // --- Future Placeholder Section ---
    const futureHtml = `
        <h2 class="uc-section-title">Additional Capabilities</h2>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
            <div style="background:var(--bg-surface-highlight); border:1px dashed var(--border-color); border-radius:8px; padding:20px; text-align:center; color:var(--text-muted);">
                <h4 style="margin:0 0 8px 0;">Cabin Configuration</h4>
                <div style="font-size:12px;">Coming soon</div>
            </div>
            <div style="background:var(--bg-surface-highlight); border:1px dashed var(--border-color); border-radius:8px; padding:20px; text-align:center; color:var(--text-muted);">
                <h4 style="margin:0 0 8px 0;">Lease Details</h4>
                <div style="font-size:12px;">Coming soon</div>
            </div>
            <div style="background:var(--bg-surface-highlight); border:1px dashed var(--border-color); border-radius:8px; padding:20px; text-align:center; color:var(--text-muted);">
                <h4 style="margin:0 0 8px 0;">Refurbishment</h4>
                <div style="font-size:12px;">Coming soon</div>
            </div>
        </div>
        <br><br>
    `;

    container.innerHTML = `
        ${headerHtml}
        ${healthStripHtml}
        ${timelineHtml}
        ${flightTableHtml}
        ${maintSecHtml}
        ${economicsHtml}
        ${futureHtml}
    `;
}
