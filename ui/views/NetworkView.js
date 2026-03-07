import { getState, formatMoney, MINUTES_PER_DAY } from '../../engine/state.js';
import { getAircraftByType } from '../../data/aircraft.js';
import { getDistanceBetweenAirports } from '../../data/airports.js';
import { getSchedulesByRoute } from '../../engine/scheduler.js';
import { DataTable } from '../components/DataTable.js';
import { StatCard } from '../components/StatCard.js';
import { Toolbar } from '../components/Toolbar.js';
import { openRouteDetail } from '../services/uiState.js';

let currentSort = 'profit'; // profit, load, pax, spill
let sortDesc = true;

export function renderNetworkView(container) {
    const state = getState();

    container.innerHTML = `
        <div class="panel-header">
            <h2>Network Analytics</h2>
        </div>
        <div id="network-kpi-grid" class="stats-grid" style="margin-bottom: 20px;"></div>
        <div id="network-toolbar"></div>
        <div id="network-table-container" style="overflow-x: auto;"></div>
    `;

    renderNetworkContent();
}

function renderNetworkContent() {
    const state = getState();
    const kpiGrid = document.getElementById('network-kpi-grid');
    const tableContainer = document.getElementById('network-table-container');
    const toolbarContainer = document.getElementById('network-toolbar');

    if (!kpiGrid || !tableContainer || !toolbarContainer) return;

    if (state.routes.length === 0) {
        kpiGrid.innerHTML = `
            ${StatCard('Total Routes', '0')}
            ${StatCard('Profitable', '0')}
            ${StatCard('Loss Making', '0')}
            ${StatCard('Avg Load Factor', '0%')}
            ${StatCard('Total Spill', '0')}
        `;
        tableContainer.innerHTML = DataTable(
            ['Route', 'Distance', 'Aircraft', 'Flights', 'Pax', 'Load', 'Revenue', 'Costs', 'Profit', 'Spill', 'Transfers', 'Status'],
            '',
            '<div class="empty-state" style="padding: 40px; text-align: center;">No active routes in network. Create your first route!</div>'
        );
        return;
    }

    const currentMinute = state.clock.totalMinutes;
    // VERY STRICT LAST 1440 MINUTE WINDOW
    const recentFlights = state.flights.completed.filter(f => (currentMinute - f.arrivalTime) <= 1440);

    let totalProfitable = 0;
    let totalLossMaking = 0;
    let totalPaxSum = 0;
    let totalCapacitySum = 0;
    let networkSpill = 0;

    const routeMetrics = state.routes.map(route => {
        const flights = recentFlights.filter(f => f.routeId === route.id);
        const schedules = getSchedulesByRoute(route.id);

        // Aggregate Aircraft Types & Flights Today strictly from completed 1440 window
        // But also check schedules to show what's operating
        let flightsToday = flights.length;
        let acTypes = new Set();
        let totalDailyCapacity = 0;

        schedules.forEach(s => {
            const ac = state.fleet.find(f => f.id === s.aircraftId);
            if (ac) {
                acTypes.add(ac.type);
                const acData = getAircraftByType(ac.type);
                if (acData) {
                    totalDailyCapacity += (acData.seats * s.departureTimes.length);
                }
            }
        });

        const acString = Array.from(acTypes).join(', ') || 'None';

        let rPax = 0;
        let rCapacity = 0;
        let rRev = 0;
        let rCost = 0;
        let rTransfers = 0;

        flights.forEach(f => {
            rPax += (f.passengers || 0);
            rRev += (f.revenue || 0);
            rCost += (f.cost || 0);
            rTransfers += (f.transferPassengers || 0);

            // Find capacity of the explicitly flown historical aircraft
            const fAc = state.fleet.find(a => a.id === f.aircraftId);
            if (fAc) {
                const fAcData = getAircraftByType(fAc.type);
                if (fAcData) rCapacity += fAcData.seats;
            }
        });

        const rProfit = rRev - rCost;
        if (rProfit > 0) totalProfitable++;
        else if (rProfit < 0) totalLossMaking++;

        let rLoadFactor = 0;
        if (rCapacity > 0) {
            rLoadFactor = (rPax / rCapacity) * 100;
        }

        totalPaxSum += rPax;
        totalCapacitySum += rCapacity;

        // Spill
        // Demand is daily pax. capacity is what's scheduled. or what's flown.
        // Let's use strict daily demand minus what we were physically able to schedule/fly.
        let rSpill = Math.max(0, route.demand - rPax);
        networkSpill += rSpill;

        let statusText = 'OK';
        let statusColor = 'var(--color-success)';
        if (!route.active) {
            statusText = 'INACTIVE';
            statusColor = 'var(--text-muted)';
        } else if (acTypes.size === 0) {
            statusText = 'NO AIRCRAFT';
            statusColor = 'var(--color-danger)';
        } else if (rLoadFactor < 40 && flightsToday > 0) {
            statusText = 'LOW LOAD';
            statusColor = 'var(--color-warning)';
        } else if (rSpill > (route.demand * 0.3) && totalDailyCapacity > 0) {
            statusText = 'HIGH SPILL';
            statusColor = 'var(--color-warning)';
        }

        return {
            id: route.id,
            origin: route.origin,
            dest: route.destination,
            distance: route.distance,
            aircraft: acString,
            flights: flightsToday,
            pax: rPax,
            loadFactor: rLoadFactor,
            rev: rRev,
            cost: rCost,
            profit: rProfit,
            spill: rSpill,
            transfers: rTransfers,
            status: statusText,
            color: statusColor
        };
    });

    const netLoadFactor = totalCapacitySum > 0 ? (totalPaxSum / totalCapacitySum * 100) : 0;

    kpiGrid.innerHTML = `
        ${StatCard('Total Routes', state.routes.length)}
        ${StatCard('Profitable', totalProfitable)}
        ${StatCard('Loss Making', totalLossMaking)}
        ${StatCard('Avg Load Factor', netLoadFactor.toFixed(1) + '%')}
        ${StatCard('Total Spill', networkSpill.toLocaleString() + ' pax')}
    `;

    // SORTING
    routeMetrics.sort((a, b) => {
        let valA, valB;
        switch (currentSort) {
            case 'profit': valA = a.profit; valB = b.profit; break;
            case 'load': valA = a.loadFactor; valB = b.loadFactor; break;
            case 'pax': valA = a.pax; valB = b.pax; break;
            case 'spill': valA = a.spill; valB = b.spill; break;
            default: valA = a.profit; valB = b.profit;
        }
        return sortDesc ? (valB - valA) : (valA - valB);
    });

    const rowsHtml = routeMetrics.map(r => {
        const profitColor = r.profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
        return `
            <tr class="route-analytics-row" data-route-id="${r.id}" style="cursor: pointer;">
                <td><strong>${r.origin} \u2192 ${r.dest}</strong></td>
                <td>${r.distance} km</td>
                <td style="font-size:11px;">${r.aircraft}</td>
                <td>${r.flights}</td>
                <td>${r.pax.toLocaleString()}</td>
                <td>
                    <div style="font-size:12px; margin-bottom:2px;">${r.loadFactor.toFixed(1)}%</div>
                    <div style="width:100%; height:4px; background:var(--bg-surface-highlight); border-radius:2px;">
                        <div style="width:${r.loadFactor}%; height:100%; background:var(--accent-color); border-radius:2px;"></div>
                    </div>
                </td>
                <td style="font-family:var(--font-mono); color:var(--text-muted);">$${formatMoney(r.rev)}</td>
                <td style="font-family:var(--font-mono); color:var(--text-muted);">$${formatMoney(r.cost)}</td>
                <td style="font-family:var(--font-mono); color:${profitColor}; font-weight:bold;">$${formatMoney(r.profit)}</td>
                <td style="color:${r.spill > 0 ? 'var(--color-warning)' : 'inherit'};">${r.spill}</td>
                <td style="color:var(--color-info);">${r.transfers}</td>
                <td><span class="badge" style="background:${r.color}; color:#fff;">${r.status}</span></td>
            </tr>
        `;
    }).join('');

    toolbarContainer.innerHTML = Toolbar([
        { id: 'sort-profit', label: 'Sort by Profit', active: currentSort === 'profit', action: () => setSort('profit') },
        { id: 'sort-load', label: 'Sort by Load', active: currentSort === 'load', action: () => setSort('load') },
        { id: 'sort-pax', label: 'Sort by Pax', active: currentSort === 'pax', action: () => setSort('pax') },
        { id: 'sort-spill', label: 'Sort by Spill', active: currentSort === 'spill', action: () => setSort('spill') },
        { id: 'sort-dir', label: sortDesc ? '↓ Descending' : '↑ Ascending', action: () => toggleSortDir() }
    ]);

    tableContainer.innerHTML = DataTable(
        ['Route', 'Distance', 'Aircraft', 'Flights Today', 'Pax', 'Load Factor', 'Revenue', 'Costs', 'Profit', 'Spill', 'Transfers', 'Status'],
        rowsHtml
    );

    // Wire up row delegation
    tableContainer.querySelectorAll('.route-analytics-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const rId = parseInt(row.dataset.routeId);
            openRouteDetail(rId);
        });
    });
}

function setSort(key) {
    if (currentSort === key) {
        sortDesc = !sortDesc;
    } else {
        currentSort = key;
        sortDesc = true;
    }
    renderNetworkContent();
}

function toggleSortDir() {
    sortDesc = !sortDesc;
    renderNetworkContent();
}
