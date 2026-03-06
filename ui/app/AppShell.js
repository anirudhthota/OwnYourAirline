import { TopBar, initTopBar } from './TopBar.js';
import { Navigation, initNavigation } from './Navigation.js';

export function AppShell(container) {
    container.innerHTML = `
        ${TopBar()}
        <div id="game-body" class="game-body">
            ${Navigation()}
            <div id="main-area" class="main-area">
                <div id="map-container" class="map-container"></div>
                <div id="panel-content" class="panel-content"></div>
            </div>
        </div>
    `;

    // Initialize logic handlers
    initTopBar();
    initNavigation();
}
