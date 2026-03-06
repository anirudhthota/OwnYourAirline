export function StatCard(label, value, subtext = '', isNegative = false) {
    return `
        <div class="dash-card">
            <div class="dash-card-label">${label}</div>
            <div class="dash-card-value ${isNegative ? 'negative' : ''}">${value}</div>
            ${subtext ? `<div class="dash-card-sub">${subtext}</div>` : ''}
        </div>
    `;
}
