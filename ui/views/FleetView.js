import { getState, formatMoney, MINUTES_PER_DAY } from '../../engine/state.js';
import { AIRCRAFT_TYPES, getAircraftByType, LEASE_DEPOSIT_MONTHS } from '../../data/aircraft.js';
import { getDistanceBetweenAirports } from '../../data/airports.js';
import { purchaseAircraft, leaseAircraft, sellAircraft, returnLeasedAircraft, startMaintenance, purchaseUsedAircraft, leaseUsedAircraft } from '../../engine/fleetManager.js';
import { getSchedulesByAircraft } from '../../engine/scheduler.js';
import { updateHUD } from '../hud.js';
import { formatLocation } from '../services/uiState.js';
import { showConfirm, showModal, closeModal } from '../components/Modal.js';

export function renderFleetPanel(container) {
    const state = getState();

    container.innerHTML = `
        <div class="panel-header">
            <h2>Fleet Management</h2>
            <div>
                <button class="btn-sm" id="fleet-used-btn" style="margin-right:6px;">Used Market</button>
                <button class="btn-accent" id="fleet-buy-btn">New Aircraft</button>
            </div>
        </div>
        <div id="fleet-used-market" class="fleet-shop hidden"></div>
        <div id="fleet-shop" class="fleet-shop hidden"></div>
        <div id="fleet-list" class="fleet-list"></div>
    `;

    renderFleetList();

    document.getElementById('fleet-buy-btn').addEventListener('click', () => {
        const shop = document.getElementById('fleet-shop');
        const used = document.getElementById('fleet-used-market');
        used.classList.add('hidden');
        shop.classList.toggle('hidden');
        if (!shop.classList.contains('hidden')) renderFleetShop();
    });

    document.getElementById('fleet-used-btn').addEventListener('click', () => {
        const shop = document.getElementById('fleet-shop');
        const used = document.getElementById('fleet-used-market');
        shop.classList.add('hidden');
        used.classList.toggle('hidden');
        if (!used.classList.contains('hidden')) renderUsedMarket();
    });
}

function renderFleetList() {
    const state = getState();
    const listDiv = document.getElementById('fleet-list');
    if (!listDiv) return;

    if (state.fleet.length === 0) {
        listDiv.innerHTML = '<div class="empty-state">No aircraft in fleet. Purchase or lease your first aircraft.</div>';
        return;
    }

    listDiv.innerHTML = state.fleet.map(ac => {
        const acData = getAircraftByType(ac.type);
        const schedules = getSchedulesByAircraft(ac.id);
        return `
            <div class="fleet-card">
                <div class="fleet-card-header">
                    <span class="fleet-reg" data-reg-display="${ac.id}">${ac.registration}</span>
                    <button class="fleet-rename-btn" data-rename="${ac.id}" title="Rename tail number">\u270E</button>
                    <span class="fleet-type">${ac.type}</span>
                    <span class="fleet-status status-${ac.status}">${
                        ac.status === 'in_flight' ? 'BUSY' :
                        ac.status === 'maintenance_due' ? 'AVAILABLE' :
                        ac.status.toUpperCase()
                    }</span>
                    <span class="fleet-location">${formatLocation(ac)}</span>
                </div>
                <div class="fleet-card-details">
                    <span>${acData ? acData.seats + ' seats' : ''}</span>
                    <span>${acData ? acData.rangeKm.toLocaleString() + ' km range' : ''}</span>
                    <span>${ac.ownership}</span>
                    <span>${Math.round(ac.totalFlightHours)} flight hrs</span>
                    <span>${schedules.length} schedule(s)</span>
                </div>
                ${ac.status === 'maintenance_due' ? 
                    `<div class="fleet-maintenance-warning" style="color: #ff9800; font-weight: bold; margin-bottom: 8px;">
                        ${ac.pendingCheckType || 'Unknown'}-Check Due \u2013 ${Math.ceil(ac.graceHoursRemaining || 0)}h Grace Remaining
                    </div>` : ''}
                ${ac.status === 'maintenance' ? 
                    `<div class="fleet-maintenance-critical" style="color: #f44336; font-weight: bold; margin-bottom: 8px;">
                        Under Maintenance${ac.maintenanceReleaseTime ? ' \u2013 ' + Math.ceil((ac.maintenanceReleaseTime - state.clock.totalMinutes) / 60) + 'h remaining' : ''}
                    </div>` : ''}
                <div class="fleet-card-actions">
                    ${ac.status === 'maintenance_due' ? 
                        `<button class="btn-sm btn-accent" data-start-maint="${ac.id}">Perform Maintenance</button>` : ''}
                    ${ac.ownership === 'OWNED'
                        ? `<button class="btn-sm btn-danger" data-sell="${ac.id}">Sell</button>`
                        : `<button class="btn-sm btn-danger" data-return="${ac.id}">Return Lease</button>`
                    }
                </div>
            </div>
        `;
    }).join('');

    listDiv.querySelectorAll('[data-rename]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.rename);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            const regSpan = listDiv.querySelector(`[data-reg-display="${id}"]`);
            if (!regSpan) return;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'fleet-rename-input';
            input.value = aircraft.registration;
            input.maxLength = 8;

            regSpan.replaceWith(input);
            input.focus();
            input.select();
            btn.style.display = 'none';

            function commitRename() {
                const newReg = input.value.trim().toUpperCase();
                if (newReg && newReg.length <= 8) {
                    aircraft.registration = newReg;
                }
                renderFleetList();
            }

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') renderFleetList();
            });
            input.addEventListener('blur', commitRename);
        });
    });

    listDiv.querySelectorAll('[data-sell]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.sell);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            showConfirm(
                'Sell Aircraft',
                `Sell <strong>${aircraft.type}</strong> (${aircraft.registration})?<br>You will receive the depreciated sale value.`,
                () => {
                    if (sellAircraft(id)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });

    listDiv.querySelectorAll('[data-start-maint]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.startMaint);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            
            showConfirm(
                'Start Maintenance',
                `Are you sure you want to perform the <strong>${aircraft.pendingCheckType}-Check</strong> for ${aircraft.registration}?<br>Active schedules will be unassigned.`,
                () => {
                    if (startMaintenance(id)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });

    listDiv.querySelectorAll('[data-return]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.return);
            const aircraft = state.fleet.find(f => f.id === id);
            if (!aircraft) return;
            showConfirm(
                'Return Leased Aircraft',
                `Return leased <strong>${aircraft.type}</strong> (${aircraft.registration})?<br>The deposit will not be refunded.`,
                () => {
                    if (returnLeasedAircraft(id)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });
}

function renderFleetShop() {
    const shopDiv = document.getElementById('fleet-shop');
    if (!shopDiv) return;

    shopDiv.innerHTML = `
        <h3>Aircraft Market</h3>
        <div class="shop-grid">
            ${AIRCRAFT_TYPES.map(ac => `
                <div class="shop-card">
                    <div class="shop-card-header">
                        <span class="shop-type">${ac.type}</span>
                        <span class="shop-category">${ac.category}</span>
                    </div>
                    <div class="shop-specs">
                        <div><span>Seats:</span> ${ac.seats}</div>
                        <div><span>Range:</span> ${ac.rangeKm.toLocaleString()} km</div>
                        <div><span>Speed:</span> ${ac.cruiseSpeedKmh} km/h</div>
                        <div><span>Fuel/hr:</span> ${ac.fuelBurnPerHour} kg</div>
                    </div>
                    <div class="shop-prices">
                        <div>Buy: $${formatMoney(ac.purchasePrice)}</div>
                        <div>Lease: $${formatMoney(ac.leaseCostPerMonth)}/mo</div>
                    </div>
                    <div class="shop-actions">
                        <button class="btn-sm btn-accent" data-buy="${ac.type}">Buy</button>
                        <button class="btn-sm btn-secondary" data-lease="${ac.type}">Lease</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    shopDiv.querySelectorAll('[data-buy]').forEach(btn => {
        btn.addEventListener('click', () => {
            const acData = getAircraftByType(btn.dataset.buy);
            if (!acData) return;
            showConfirm(
                'Purchase Aircraft',
                `<strong>${acData.type}</strong> (${acData.category})<br>` +
                `${acData.seats} seats | ${acData.rangeKm.toLocaleString()} km range<br><br>` +
                `Price: <strong>$${formatMoney(acData.purchasePrice)}</strong>`,
                () => {
                    if (purchaseAircraft(btn.dataset.buy)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });

    shopDiv.querySelectorAll('[data-lease]').forEach(btn => {
        btn.addEventListener('click', () => {
            const acData = getAircraftByType(btn.dataset.lease);
            if (!acData) return;
            const deposit = acData.leaseCostPerMonth * LEASE_DEPOSIT_MONTHS;
            showConfirm(
                'Lease Aircraft',
                `<strong>${acData.type}</strong> (${acData.category})<br>` +
                `${acData.seats} seats | ${acData.rangeKm.toLocaleString()} km range<br><br>` +
                `Lease: <strong>$${formatMoney(acData.leaseCostPerMonth)}/month</strong><br>` +
                `Deposit (${LEASE_DEPOSIT_MONTHS} months): <strong>$${formatMoney(deposit)}</strong>`,
                () => {
                    if (leaseAircraft(btn.dataset.lease)) {
                        renderFleetList();
                        updateHUD();
                    }
                }
            );
        });
    });
}

function renderUsedMarket() {
    const state = getState();
    const usedDiv = document.getElementById('fleet-used-market');
    if (!usedDiv) return;

    const market = state.usedMarket;
    if (!market || market.listings.length === 0) {
        usedDiv.innerHTML = `
            <h3>Used Aircraft Market</h3>
            <div class="empty-state-sm">No used aircraft available. Market refreshes every 30 in-game days.</div>
        `;
        return;
    }

    const currentDay = Math.floor(state.clock.totalMinutes / MINUTES_PER_DAY);
    const daysUntilRefresh = Math.max(0, 30 - (currentDay - market.lastRefreshDay));

    usedDiv.innerHTML = `
        <h3>Used Aircraft Market</h3>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;font-family:var(--font-mono);">Refreshes in ${daysUntilRefresh} days | ${market.listings.length} aircraft available</div>
        <div class="shop-grid">
            ${market.listings.map(listing => {
                const condColor = listing.condition === 'Good' ? 'var(--accent-green)' : 'var(--accent-yellow)';
                return `
                    <div class="shop-card" ${listing.featured ? 'style="border-color:var(--accent-green);"' : ''}>
                        ${listing.featured ? '<div style="color:var(--accent-green);font-family:var(--font-mono);font-size:10px;text-transform:uppercase;margin-bottom:4px;">Featured Deal</div>' : ''}
                        <div class="shop-card-header">
                            <span class="shop-type">${listing.type}</span>
                            <span class="shop-category">${listing.category}</span>
                        </div>
                        <div class="shop-specs">
                            <div><span>Seats:</span> ${listing.seats}</div>
                            <div><span>Range:</span> ${listing.rangeKm.toLocaleString()} km</div>
                            <div><span>Age:</span> ${listing.ageYears} years</div>
                            <div><span>Hours:</span> ${listing.hoursFlown.toLocaleString()}</div>
                            <div><span>Condition:</span> <span style="color:${condColor}">${listing.condition}</span></div>
                        </div>
                        <div class="shop-prices">
                            <div>Buy: $${formatMoney(listing.price)}</div>
                            <div>Lease: $${formatMoney(listing.leasePrice)}/mo</div>
                            <div style="font-size:11px;color:var(--text-muted);">${Math.round(listing.priceMultiplier * 100)}% of new</div>
                        </div>
                        <div class="shop-actions">
                            <button class="btn-sm btn-accent" data-buy-used="${listing.id}">Buy</button>
                            <button class="btn-sm btn-secondary" data-lease-used="${listing.id}">Lease</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    usedDiv.querySelectorAll('[data-buy-used]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.buyUsed);
            const listing = market.listings.find(l => l.id === id);
            if (!listing) return;
            
            const state = getState();
            const processPurchase = (ferry) => {
                if (purchaseUsedAircraft(id, ferry)) {
                    renderUsedMarket();
                    renderFleetList();
                    updateHUD();
                }
            };

            const baseMsg = `<strong>${listing.type}</strong> (${listing.category})<br>` +
                            `${listing.seats} seats | ${listing.rangeKm.toLocaleString()} km range<br>` +
                            `${listing.ageYears} years old | ${listing.hoursFlown.toLocaleString()} hrs | ${listing.condition}<br><br>` +
                            `Price: <strong>$${formatMoney(listing.price)}</strong> (${Math.round(listing.priceMultiplier * 100)}% of new)<br>` +
                            `Location: <strong>${listing.location}</strong>`;

            if (listing.location === state.config.hubAirport) {
                showConfirm('Purchase Used Aircraft', baseMsg, () => processPurchase(false));
                return;
            }

            const distance = getDistanceBetweenAirports(listing.location, state.config.hubAirport);
            const ferryCost = Math.round(distance * 2.5);

            const modalBody = showModal('Purchase Used Aircraft', `
                <p>${baseMsg}</p>
                <div style="margin: 15px 0; padding: 10px; background: rgba(255,165,0,0.1); border-left: 3px solid var(--accent-yellow); border-radius: 4px;">
                    <strong>Location Requirement</strong><br>
                    This aircraft is located at <strong>${listing.location}</strong>. Your hub is <strong>${state.config.hubAirport}</strong> (${Math.round(distance)}km away).<br>
                    You can either keep it there and create a route from ${listing.location}, or ferry it back to your hub instantly for <strong>$${formatMoney(ferryCost)}</strong>.
                </div>
                <div class="modal-actions" style="flex-direction: column; gap: 8px;">
                    <button class="btn-accent modal-ferry-btn" style="width: 100%">Buy & Ferry to Hub (+$${formatMoney(ferryCost)})</button>
                    <button class="btn-secondary modal-keep-btn" style="width: 100%">Buy & Keep at ${listing.location}</button>
                    <button class="btn-secondary modal-cancel-btn" style="width: 100%; border-color: transparent;">Cancel</button>
                </div>
            `);
            
            modalBody.querySelector('.modal-ferry-btn').addEventListener('click', () => { closeModal(); processPurchase(true); });
            modalBody.querySelector('.modal-keep-btn').addEventListener('click', () => { closeModal(); processPurchase(false); });
            modalBody.querySelector('.modal-cancel-btn').addEventListener('click', () => closeModal());
        });
    });

    usedDiv.querySelectorAll('[data-lease-used]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.leaseUsed);
            const listing = market.listings.find(l => l.id === id);
            if (!listing) return;
            
            const state = getState();
            const deposit = listing.leasePrice * LEASE_DEPOSIT_MONTHS;
            const processLease = (ferry) => {
                if (leaseUsedAircraft(id, ferry)) {
                    renderUsedMarket();
                    renderFleetList();
                    updateHUD();
                }
            };

            const baseMsg = `<strong>${listing.type}</strong> (${listing.category})<br>` +
                            `${listing.seats} seats | ${listing.rangeKm.toLocaleString()} km range<br>` +
                            `${listing.ageYears} years old | ${listing.hoursFlown.toLocaleString()} hrs | ${listing.condition}<br><br>` +
                            `Lease: <strong>$${formatMoney(listing.leasePrice)}/month</strong><br>` +
                            `Deposit (${LEASE_DEPOSIT_MONTHS} months): <strong>$${formatMoney(deposit)}</strong><br>` +
                            `Location: <strong>${listing.location}</strong>`;

            if (listing.location === state.config.hubAirport) {
                showConfirm('Lease Used Aircraft', baseMsg, () => processLease(false));
                return;
            }

            const distance = getDistanceBetweenAirports(listing.location, state.config.hubAirport);
            const ferryCost = Math.round(distance * 2.5);

            const modalBody = showModal('Lease Used Aircraft', `
                <p>${baseMsg}</p>
                <div style="margin: 15px 0; padding: 10px; background: rgba(255,165,0,0.1); border-left: 3px solid var(--accent-yellow); border-radius: 4px;">
                    <strong>Location Requirement</strong><br>
                    This aircraft is located at <strong>${listing.location}</strong>. Your hub is <strong>${state.config.hubAirport}</strong> (${Math.round(distance)}km away).<br>
                    You can either keep it there and create a route from ${listing.location}, or ferry it back to your hub instantly for <strong>$${formatMoney(ferryCost)}</strong>.
                </div>
                <div class="modal-actions" style="flex-direction: column; gap: 8px;">
                    <button class="btn-accent modal-ferry-btn" style="width: 100%">Lease & Ferry to Hub (+$${formatMoney(ferryCost)})</button>
                    <button class="btn-secondary modal-keep-btn" style="width: 100%">Lease & Keep at ${listing.location}</button>
                    <button class="btn-secondary modal-cancel-btn" style="width: 100%; border-color: transparent;">Cancel</button>
                </div>
            `);
            
            modalBody.querySelector('.modal-ferry-btn').addEventListener('click', () => { closeModal(); processLease(true); });
            modalBody.querySelector('.modal-keep-btn').addEventListener('click', () => { closeModal(); processLease(false); });
            modalBody.querySelector('.modal-cancel-btn').addEventListener('click', () => closeModal());
        });
    });
}
