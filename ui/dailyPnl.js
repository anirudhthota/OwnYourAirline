import { formatMoney } from '../engine/state.js';

let activeNotification = null;

export function showDailyPnLNotification(record) {
    if (activeNotification) {
        activeNotification.remove();
        activeNotification = null;
    }

    const panel = document.createElement('div');
    panel.className = 'daily-pnl-notification';

    const profitClass = record.profit >= 0 ? 'positive' : 'negative';
    const profitSign = record.profit >= 0 ? '+' : '-';
    const bestHtml = record.bestRoute
        ? `<div class="dpnl-row"><span class="dpnl-label">Best route:</span><span class="dpnl-value positive">${record.bestRoute.route} (+$${formatMoney(Math.abs(record.bestRoute.profit))})</span></div>`
        : '';
    const worstHtml = record.worstRoute && record.worstRoute.route !== (record.bestRoute ? record.bestRoute.route : '')
        ? `<div class="dpnl-row"><span class="dpnl-label">Worst route:</span><span class="dpnl-value negative">${record.worstRoute.route} (${record.worstRoute.profit >= 0 ? '+' : '-'}$${formatMoney(Math.abs(record.worstRoute.profit))})</span></div>`
        : '';

    panel.innerHTML = `
        <div class="dpnl-header">
            <span class="dpnl-title">Daily P&L</span>
            <span class="dpnl-day">${record.dayLabel}</span>
            <button class="dpnl-close">&times;</button>
        </div>
        <div class="dpnl-body">
            <div class="dpnl-row"><span class="dpnl-label">Flights:</span><span class="dpnl-value">${record.flights}</span></div>
            <div class="dpnl-row"><span class="dpnl-label">Passengers:</span><span class="dpnl-value">${record.passengers.toLocaleString()}</span></div>
            <div class="dpnl-divider"></div>
            <div class="dpnl-row"><span class="dpnl-label">Revenue:</span><span class="dpnl-value positive">+$${formatMoney(record.revenue)}</span></div>
            <div class="dpnl-row"><span class="dpnl-label">Costs:</span><span class="dpnl-value negative">-$${formatMoney(record.costs)}</span></div>
            <div class="dpnl-divider"></div>
            <div class="dpnl-row dpnl-total"><span class="dpnl-label">Net:</span><span class="dpnl-value ${profitClass}">${profitSign}$${formatMoney(Math.abs(record.profit))}</span></div>
            ${bestHtml}
            ${worstHtml}
        </div>
    `;

    document.body.appendChild(panel);
    activeNotification = panel;

    // Trigger slide-in animation
    requestAnimationFrame(() => {
        panel.classList.add('visible');
    });

    panel.querySelector('.dpnl-close').addEventListener('click', () => {
        panel.classList.remove('visible');
        setTimeout(() => {
            if (panel.parentNode) panel.remove();
            if (activeNotification === panel) activeNotification = null;
        }, 300);
    });

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        if (panel.parentNode && panel.classList.contains('visible')) {
            panel.classList.remove('visible');
            setTimeout(() => {
                if (panel.parentNode) panel.remove();
                if (activeNotification === panel) activeNotification = null;
            }, 300);
        }
    }, 8000);
}
