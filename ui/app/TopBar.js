// Directly wraps existing UI HUD functionality inside the new architectural layout
export function TopBar() {
    return `<div id="hud" class="hud"></div>`;
}

export { createHUD as initTopBar, updateHUD } from '../hud.js';
