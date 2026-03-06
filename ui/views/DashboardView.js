import { getState, formatMoney } from '../../engine/state.js';
import { getAirportByIata } from '../../data/airports.js';
import { StatCard } from '../components/StatCard.js';

export function renderDashboard(container) {
    const state = getState();
    const hub = getAirportByIata(state.config.hubAirport);

    container.innerHTML = `
        <div class="panel-header"><h2>Dashboard</h2></div>
        <div class="dashboard-grid">
            ${StatCard('Hub', state.config.hubAirport, hub ? hub.city + ', ' + hub.country : '')}
            ${StatCard('Cash Balance', '$' + formatMoney(state.finances.cash), '', state.finances.cash < 0)}
            ${StatCard('Fleet Size', state.fleet.length)}
            ${StatCard('Active Routes', state.routes.filter(r => r.active).length)}
            ${StatCard('Active Flights', state.flights.active.length)}
            ${StatCard('Completed Flights', state.flights.completed.length)}
            ${StatCard('Transfers Carried', state.flights.completed.reduce((a, b) => a + (b.transferPassengers || 0), 0).toLocaleString())}
            ${StatCard('Total Revenue', '$' + formatMoney(state.finances.totalRevenue))}
            ${StatCard('Total Costs', '$' + formatMoney(state.finances.totalCosts))}
            ${StatCard('Reputation', state.reputation + '/100')}
            ${StatCard('Difficulty', state.config.difficulty)}
            ${StatCard('AI Airlines', state.ai.airlines.length)}
            ${StatCard('AI Routes', state.ai.routes.length)}
        </div>
    `;
}
