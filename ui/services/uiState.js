import { getState } from '../../engine/state.js';
import { renderDashboard } from '../views/DashboardView.js';
import { renderFleetPanel } from '../views/FleetView.js';
import { renderRoutesPanel } from '../views/RoutesView.js';
import { renderSchedulePanel } from '../views/SchedulesView.js';
import { renderFinancesPanel } from '../views/FinanceView.js';
import { renderLogPanel } from '../views/LogView.js';
import { renderRouteDetailView } from '../views/RouteDetailView.js';
import { renderNetworkView } from '../views/NetworkView.js';

export const uiState = {
    activeView: 'dashboard',
    activeRouteId: null
};

export function openRouteDetail(routeId) {
    uiState.activeRouteId = routeId;
    uiState.activeView = 'routeDetail';
    showPanel('routeDetail');
}

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
    uiState.activeView = panelId;
    if (panelId !== 'routeDetail') {
        uiState.activeRouteId = null;
    }

    const content = document.getElementById('panel-content');
    if (!content) return;

    // Deselect nav if coming from programmatic source
    const nav = document.getElementById('side-nav');
    if (nav) {
        nav.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.panel === panelId);
        });
    }

    switch (panelId) {
        case 'dashboard': renderDashboard(content); break;
        case 'network': renderNetworkView(content); break;
        case 'fleet': renderFleetPanel(content); break;
        case 'routes': renderRoutesPanel(content); break;
        case 'routeDetail': renderRouteDetailView(content); break;
        case 'schedule': renderSchedulePanel(content); break;
        case 'finances': renderFinancesPanel(content); break;
        case 'log': renderLogPanel(content); break;
    }
}
