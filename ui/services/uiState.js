import { getState } from '../../engine/state.js';
import { renderDashboard } from '../views/DashboardView.js';
import { renderFleetPanel } from '../views/FleetView.js';
import { renderRoutesPanel } from '../views/RoutesView.js';
import { renderSchedulePanel } from '../views/SchedulesView.js';
import { renderFinancesPanel } from '../views/FinanceView.js';
import { renderLogPanel } from '../views/LogView.js';

export function formatLocation(ac) {
    if (!ac.currentLocation) return '';
    if (ac.currentLocation.startsWith('airborne:')) {
        return `Airborne: ${ac.currentLocation.slice(9)}`;
    }
    return `At ${ac.currentLocation}`;
}

export function showPanel(panelId) {
    const state = getState();
    if (state) state.ui.selectedPanel = panelId;

    const content = document.getElementById('panel-content');
    if (!content) return;

    switch (panelId) {
        case 'dashboard': renderDashboard(content); break;
        case 'fleet': renderFleetPanel(content); break;
        case 'routes': renderRoutesPanel(content); break;
        case 'schedule': renderSchedulePanel(content); break;
        case 'finances': renderFinancesPanel(content); break;
        case 'log': renderLogPanel(content); break;
    }
}
