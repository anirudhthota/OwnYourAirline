import { getState, formatMoney } from '../../engine/state.js';

export function renderFinancesPanel(container) {
    const state = getState();

    const recentFlights = state.flights.completed.slice(-20).reverse();
    const pnlData = state.finances.monthlyPnL.slice(-12).reverse();
    const dailyData = state.finances.dailyPnL || [];

    container.innerHTML = `
        <div class="panel-header"><h2>Finances</h2></div>
        <div class="finance-summary">
            <div class="dash-card">
                <div class="dash-card-label">Cash</div>
                <div class="dash-card-value">$${formatMoney(state.finances.cash)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Total Revenue</div>
                <div class="dash-card-value">$${formatMoney(state.finances.totalRevenue)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Total Costs</div>
                <div class="dash-card-value">$${formatMoney(state.finances.totalCosts)}</div>
            </div>
            <div class="dash-card">
                <div class="dash-card-label">Net P&L</div>
                <div class="dash-card-value ${state.finances.totalRevenue - state.finances.totalCosts < 0 ? 'negative' : ''}">$${formatMoney(Math.abs(state.finances.totalRevenue - state.finances.totalCosts))}</div>
            </div>
        </div>

        <h3 class="section-title">Daily P&L (Last 30 Days)</h3>
        <div class="finance-chart-container">
            ${dailyData.length === 0 ? '<div class="empty-state-sm">No daily data yet. Complete a full day of operations.</div>' : `
                <canvas id="daily-pnl-chart" width="800" height="200"></canvas>
            `}
        </div>

        <h3 class="section-title">Running Cash Balance</h3>
        <div class="table-container" style="margin-bottom:16px;">
            ${dailyData.length === 0 ? '<div class="empty-state-sm">No daily data yet.</div>' : `
                <table class="data-table">
                    <thead><tr><th>Day</th><th>Revenue</th><th>Costs</th><th>Net</th><th>Cash</th></tr></thead>
                    <tbody>
                        ${dailyData.slice(-10).reverse().map(d => `
                            <tr>
                                <td>${d.dayLabel}</td>
                                <td>$${formatMoney(d.revenue)}</td>
                                <td>$${formatMoney(d.costs)}</td>
                                <td class="${d.profit >= 0 ? '' : 'negative'}">${d.profit >= 0 ? '+' : '-'}$${formatMoney(Math.abs(d.profit))}</td>
                                <td>$${formatMoney(d.cashBalance)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>

        <h3 class="section-title">Monthly P&L</h3>
        <div class="table-container">
            ${pnlData.length === 0 ? '<div class="empty-state-sm">No monthly data yet.</div>' : `
                <table class="data-table">
                    <thead><tr><th>Month</th><th>Revenue</th><th>Costs</th><th>Profit/Loss</th></tr></thead>
                    <tbody>
                        ${pnlData.map(p => {
                            return `<tr>
                                <td>Y${p.year} M${p.month}</td>
                                <td>$${formatMoney(p.revenue)}</td>
                                <td>$${formatMoney(p.costs)}</td>
                                <td class="${p.profit >= 0 ? '' : 'negative'}">$${formatMoney(Math.abs(p.profit))}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            `}
        </div>

        <h3 class="section-title">Recent Flights</h3>
        <div class="table-container">
            ${recentFlights.length === 0 ? '<div class="empty-state-sm">No completed flights yet.</div>' : `
                <table class="data-table">
                    <thead><tr><th>Route</th><th>Aircraft</th><th>Pax</th><th>LF</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead>
                    <tbody>
                        ${recentFlights.map(f => `
                            <tr>
                                <td>${f.origin}\u2192${f.destination}</td>
                                <td>${f.registration}</td>
                                <td>${f.passengers}</td>
                                <td>${(f.loadFactor * 100).toFixed(0)}%</td>
                                <td>$${formatMoney(f.revenue)}</td>
                                <td>$${formatMoney(f.cost)}</td>
                                <td class="${f.profit >= 0 ? '' : 'negative'}">$${formatMoney(Math.abs(f.profit))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;

    if (dailyData.length > 0) {
        renderDailyPnLChart(dailyData.slice(-30));
    }
}

function renderDailyPnLChart(data) {
    const canvas = document.getElementById('daily-pnl-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 28;
    canvas.height = 200;

    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 20, right: 10, bottom: 30, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.fillStyle = '#0d1120';
    ctx.fillRect(0, 0, w, h);

    if (data.length === 0) return;

    const profits = data.map(d => d.profit);
    const maxVal = Math.max(...profits.map(Math.abs), 1);

    const barWidth = Math.max(4, (chartW / data.length) - 2);
    const gap = (chartW - barWidth * data.length) / (data.length + 1);

    const zeroY = padding.top + chartH / 2;
    ctx.strokeStyle = '#2a3a5c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(w - padding.right, zeroY);
    ctx.stroke();

    ctx.fillStyle = '#556078';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+$' + formatMoney(maxVal), padding.left - 6, padding.top + 10);
    ctx.fillText('$0', padding.left - 6, zeroY + 4);
    ctx.fillText('-$' + formatMoney(maxVal), padding.left - 6, h - padding.bottom - 2);

    for (let i = 0; i < data.length; i++) {
        const x = padding.left + gap + i * (barWidth + gap);
        const profit = data[i].profit;
        const barH = (Math.abs(profit) / maxVal) * (chartH / 2);

        if (profit >= 0) {
            ctx.fillStyle = '#00e676';
            ctx.fillRect(x, zeroY - barH, barWidth, barH);
        } else {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(x, zeroY, barWidth, barH);
        }

        if (data.length <= 15 || i % Math.ceil(data.length / 10) === 0) {
            ctx.fillStyle = '#556078';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            const label = data[i].dayLabel.split(' ').pop();
            ctx.fillText(label, x + barWidth / 2, h - padding.bottom + 14);
        }
    }
}
