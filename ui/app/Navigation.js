import { showPanel } from '../services/uiState.js';

export function Navigation() {
    return `
        <nav id="side-nav" class="side-nav"></nav>
    `;
}

export function initNavigation() {
    const nav = document.getElementById('side-nav');
    if (!nav) return;

    const panels = [
        { id: 'dashboard', label: 'Dashboard', icon: '◈' },
        { id: 'fleet', label: 'Fleet', icon: '✈' },
        { id: 'routes', label: 'Routes', icon: '⟿' },
        { id: 'schedule', label: 'Schedule', icon: '◷' },
        { id: 'finances', label: 'Finances', icon: '$' },
        { id: 'log', label: 'Log', icon: '☰' }
    ];

    nav.innerHTML = panels.map(p => `
        <button class="nav-btn ${p.id === 'dashboard' ? 'active' : ''}" data-panel="${p.id}">
            <span class="nav-icon">${p.icon}</span>
            <span class="nav-label">${p.label}</span>
        </button>
    `).join('');

    nav.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showPanel(btn.dataset.panel);
        });
    });
}
