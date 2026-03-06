export function DataTable(headers, rowsHtml, emptyStateHtml = '<div class="empty-state">No data available.</div>') {
    if (!rowsHtml || rowsHtml.trim() === '') {
        return emptyStateHtml;
    }
    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}
