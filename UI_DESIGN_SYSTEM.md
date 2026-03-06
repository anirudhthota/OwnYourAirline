# OwnYourAirline: UI Design System

This document defines the official design language, component structure, and architectural rules for "OwnYourAirline" moving forward. It is based on industry practices from data-heavy simulation games (e.g., Football Manager, AirlineSim, OpenTTD, Cities Skylines) adapted for a modern, browser-first experience.

## 1. Design Philosophy

**"Modern Airline Operations Console"**

The interface must feel like professional aviation software, blending the density of enterprise dashboards with the engaging feedback of a tycoon game. 
- **Data Density:** Maximize screen real estate for tables and lists. Avoid forcing users to scroll excessively to see key metrics.
- **Clarity:** Ensure clear visual hierarchy. Actions should be distinct from data readouts.
- **Operational Control:** Minimize contextual friction. Every piece of data should ideally be clickable to reveal deeper insights or actions without navigating away from the current context.

## 2. Color System

Semantic colors dictate context and state. Do not use these colors arbitrarily.

*   **Background:** `#0f172a` (Slate 900) - Deep, immersive base.
*   **Panels/Cards:** `#1e293b` (Slate 800) - Elevated surfaces.
*   **Borders/Dividers:** `#334155` (Slate 700) - Subtle separation.
*   **Primary Accent:** `#38bdf8` (Sky 400) - Primary actions, active tabs, links.
*   **Success:** `#22c55e` (Green 500) - Profit, successful actions, "Available" status.
*   **Warning:** `#f59e0b` (Amber 500) - Maintenance due, delays, understaffed routes.
*   **Danger:** `#ef4444` (Red 500) - Grounded for maintenance, negative balance, destructive actions.
*   **Muted Text:** `#94a3b8` (Slate 400) - Secondary information, table headers, inactive states.

## 3. Typography

Fonts must support high legibility for dense data. Use modern sans-serif (e.g., Inter, Roboto).

*   **H1 (Page Titles):** 24px, Bold. Used strictly for the main active panel title (e.g., "Fleet Management").
*   **H2 (Section Headers):** 18px, Semi-Bold. Used for dividing panels (e.g., "Used Aircraft Market").
*   **H3 (Table/Card Titles):** 14px, Bold, Uppercase, Muted Text color. Used for table columns or specific widget titles.
*   **Body (Normal Text):** 14px, Regular. Standard reading text.
*   **Mono (Numeric Data):** 13px or 14px, Monospace (e.g., Fira Code, JetBrains Mono). Mandatory for all monetary values, times, distances, and capacities to ensure vertical alignment in tables.

## 4. Layout System

The game layout follows a fixed-shell application paradigm.

*   **Top Status Bar:** Fixed at the top. Houses high-level vital stats: Game Time (Y/M/W/D + Time), Total Cash, Daily Profit/Loss sparkline, and Global Controls (Pause/Play, Speed).
*   **Left Navigation Rail:** Fixed on the left. Primary navigation tabs (Dashboard, Fleet, Routes, Schedules, Finances). Highlights the active view.
*   **Main Content Area:** The scrollable canvas for the active panel. Utilizes a 12-column CSS Grid constraint for internal layout.
*   **Optional Right Inspector Panel:** (Future) A slide-out drawer that appears when an entity (like an Aircraft or Route) is clicked, showing deep details without leaving the current list view.

## 5. Component System

Standardized, reusable UI blocks.

*   **Stat Card:** Small widget displaying a label, large value, and optional subtext/sparkline (e.g., "Total Revenue: $1.2M"). Takes 2-4 columns.
*   **Data Table:** High-density grid for entities. (See Section 6).
*   **Toolbar:** Horizontal bar above Data Tables housing Search, Filter dropdowns, and primary "Create/Add" buttons.
*   **Action Button:** 
    *   *Primary:* Solid background (`#38bdf8`), white text. For main actions (Buy, Create).
    *   *Secondary:* Transparent background, `#38bdf8` border and text. For alternative actions.
    *   *Danger:* Solid background (`#ef4444`). For destructive actions (Delete).
    *   *Small (btn-sm):* Reduced padding for inline actions within tables.
*   **Badge:** Small, rounded pill for statuses (See Section 7).
*   **Modal:** Centered overlay with a dark scrim backing. Restricted to blocking decisions (Confirming a heavy purchase, deleting an active route).
*   **Alert Banner:** Full-width strip at the top of the Main Content Area for system-wide warnings (e.g., "BANKRUPTCY IMMINENT").
*   **Empty State:** Centered text + icon displayed when lists/tables are empty, detailing how to add the first item.

## 6. Data Tables

Moving from "Cards" to "Tables" is critical for late-game scalability.

*   **Columns:** Must be sortable (click header to toggle Ascending/Descending).
*   **Headers:** Sticky to the top of the container during scroll. Uses H3 typography.
*   **Row States:** 
    *   *Hover:* Slight background lighten to indicate interactivity.
    *   *Click:* Left-clicking a row opens the entity's deep dive (eventually via the Right Inspector Panel).
*   **Alignment:** Text left-aligned; Numeric/Monetary data strictly right-aligned; Badges center-aligned.
*   **Future Scope:** Virtualization (DOM recycling) for tables exceeding 100 rows to maintain minimum 60fps scrolling.

## 7. Status Badges

Standardized visual vocabulary for entity statuses.

*   **AVAILABLE:** Success color (`#22c55e`). Aircraft ready for scheduling.
*   **IN FLIGHT / ACTIVE:** Primary Accent color (`#38bdf8`). Normal operations.
*   **DELAYED:** Warning color (`#f59e0b`). Flight missed slot.
*   **MAINTENANCE DUE:** Warning color (`#f59e0b`). Grace period active.
*   **MAINTENANCE:** Danger color (`#ef4444`). Grounded/In shop.
*   **UNASSIGNED:** Muted Text color (`#94a3b8`) with border. Route has no aircraft.

## 8. Alerts

System messaging hierarchy.

*   **Toast:** Small sliding overlay (bottom right). Non-blocking. Use for standard notifications (e.g., "Flight 102 landed safely", "Transfer demand calculated"). Disappears after 3-5 seconds.
*   **Inline Warning:** Text block with Warning color background directly within a standard panel (e.g., "Understaffed - 2/3 aircraft assigned" inside a Route panel).
*   **Blocking Modal:** Requires explicit user intent (Cancel/Confirm) to dismiss. Use for high-stakes or destructive events.

## 9. Interaction Rules

*   **Left-Click:** Open entity details or trigger standard button action.
*   **Right-Click (Future):** Open contextual menu for quick actions (e.g., Right-click an aircraft -> "Send to Maintenance").
*   **Double-Click (Future):** Quick edit inline fields (e.g., double-click a fake route name to edit text).

## 10. Performance Rules

**Mandatory Architecture Shift:**
*   **Avoid Full DOM Wipes:** Erasing massive component trees via `container.innerHTML = ''` and rebuilding them from scratch destroys performance and user context (scroll, focus).
*   **Prefer Component Updates:** State changes must only trigger updates to granular elements.
    *   *Action:* Adopt a virtual DOM pattern, custom Web Components, or transition to a framework (Svelte/React/Vue) for Phase 3 to handle DOM diffing natively. Vanilla JS manipulation must transition to specifically targeted element updates (`document.getElementById('ac-status-12').innerText = 'MAINTENANCE'`) rather than repainting the entire Fleet panel.
