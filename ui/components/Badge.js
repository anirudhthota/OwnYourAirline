export function Badge(label, statusMapKey) {
    return `<span class="fleet-status status-${statusMapKey}">${label}</span>`;
}
