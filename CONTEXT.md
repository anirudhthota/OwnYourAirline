# CONTEXT.md — AI Context File for Own Your Airline

## Project

**Own Your Airline** is a realistic web-based airline management simulation where the player builds and operates an airline from scratch. The player chooses a hub airport, purchases or leases aircraft, creates route networks, sets departure schedules, manages finances, and competes against 150+ AI airlines. The game runs entirely in the browser with no backend.

## Tech Stack

- **Language:** Vanilla JavaScript ES modules (`import`/`export`), no TypeScript
- **Framework:** None — no React, no Vue, no Angular, no build step
- **Rendering:** HTML5 Canvas (world map), DOM (UI panels)
- **Hosting:** GitHub Pages (static files only)
- **Fonts:** Orbitron (display), Rajdhani (body), JetBrains Mono (monospace)
- **Storage:** `localStorage` for save games (single profile per browser)
- **Entry point:** `index.html` loads `main.js` as ES module

## Design Non-Negotiables

1. **Player agency is everything.** The player must manually create routes, assign aircraft, set schedules, choose aircraft, and decide when to expand. No auto-assign, no auto-optimize, no "recommended" buttons.

2. **No hidden automation.** Every action the game takes must be visible and explainable. If a flight is delayed, the reason is logged. If a slot is unavailable, the player sees why.

3. **No magic defaults.** The game does not pick aircraft for the player, does not suggest routes, does not auto-schedule. The player must learn and decide.

4. **Full financial transparency.** Every cost and revenue event is logged with exact amounts. The player sees what they pay for and what they earn from.

5. **Realistic complexity, accessible interface.** The simulation models real aviation concepts (turnaround times, slot control, load factors, block times) but the UI keeps things clear with cards, tables, and charts — not spreadsheets.

6. **No external dependencies.** No CDN libraries, no npm packages, no build tools. Everything is vanilla JS that runs directly in the browser.

7. **Full file content on every edit.** When modifying files, always write complete file contents. No partial diffs, no placeholders, no "..." truncation.

## Locked Decisions

These decisions have been made and must not be changed:

- **Directional routes:** A→B and B→A are separate route objects. Each direction has its own schedule, demand, and slot cost.
- **Game time system:** Year/Month/Week/Day. Month = 4 weeks = 28 days. Year = 12 months = 336 days. Clock uses a single `totalMinutes` integer counter.
- **Tick-based simulation:** 5 minutes per tick. Multi-speed: 1x, 2x, 4x, 8x.
- **Used market for starter fleet:** No free aircraft on Easy/Medium. Used market provides affordable entry. Sandbox gets free A321neo.
- **Local profiles:** Save games stored in `localStorage`. No backend, no cloud sync.
- **Slot control levels 1-5:** Uncontrolled → Voluntary → Coordinated → Fully Coordinated → Slot-Controlled. Level 3+ enforces with delays, not silent skips.
- **Player auto-holds hub slots:** No fee, no enforcement at hub airport.
- **Slot costs are origin-only per direction.** Each route pays its origin airport's slot fee.
- **Daily P&L notification is non-blocking.** It auto-dismisses, does not pause the game.
- **AI routes are visual-only (Phase 1-2).** AI airlines have routes on the map but don't compete for slots or meaningfully affect demand yet.
- **Canvas-only charts.** No external charting libraries. All graphs drawn directly on `<canvas>`.
- **Aircraft Physical Location & Ferrying:** Aircraft strictly track their physical location (hub, foreign airports, or airborne). Players must ferry used aircraft to the hub paying distance-based costs if they intend to mobilize them from the hub.
- **Engine Simulation Strictness:** The engine mathematically and strictly enforces slot capacity, prevents schedule wrap-around interval overlaps, mandates strict turnaround limits, and prevents silent cascading cancellations via an active `delayedFlights` queue.
- **Schedule Auto-Calculation:** Bi-directional paired routes automatically project departure times backward and forward using canonical block and turnaround times (outbound-first auto-fill or return-first backward calculation). The UI inherently captures day rollovers (`+1 Day`/`-1 Day`) dynamically via modulo boundaries. End-user manual overrides gracefully break UI execution locks, and single unpaired routes organically suppress paired return input visuals.
- **Route Pricing Elasticity:** Demand elasticity scales dynamically derived from a player-defined `fareMultiplier` mapping (0.75x - 1.50x). Revenue math and load factor suppressions are completely isolated within Engine components (`routeEngine.js` & `sim.js`), preventing fragile UI duplications. Local demand enforces an 0.8x dropoff, and transfers face a sharper 1.2x sensitivity limit clamped safely.
- **One airline per game.** No multi-airline or subsidiary model.

## What This Game Is NOT

- **Not a casual tycoon.** There is no "click to earn" mechanic. The player must think about network design, fleet planning, and scheduling.
- **Not auto-optimized.** The game never tells the player "you should fly this route" or "this aircraft is best." The player must analyze and decide.
- **Not arcade.** There are no minigames, no real-time crisis management, no QTEs. It's a management simulation.
- **Not multiplayer.** Single-player only. AI airlines provide competition.

## Phase Roadmap

**Phase 1 (Complete):** Core loop — fleet management, route creation, scheduling, flight operations, basic AI, world map, financial tracking, save/load, dark theme UI, DEVMODE console.

**Phase 2 (Sessions A-H Complete):** Directional routes, aircraft status badges, turnaround enforcement, slot model V1 (5 levels), daily P&L with canvas bar chart, used aircraft market, starter fleet injection, route-range enforcement, fleet-wide maintenance schedules natively integrated, Schedule Auto-Calculation, Fleet Operations UI (Data-dense operations table with 24-hour graphical timeline for selected aircraft), Network Analytics UI (Sortable route KPI performance table with 24-hour metrics), Aircraft Detail View (Deep dive operational control panel for individual aircraft), Hub Operations View (Transfer analytics and bank visualization).

**Phase 3 (Planned):** Event system (random events), alliance system, aircraft maintenance model, route profitability breakdown, AI competition effects on demand, passenger class model, codeshare agreements.

**Phase 4 (Planned):** Airport infrastructure (gates, lounges, cargo), seasonal demand variation, fuel price fluctuation, regulatory environment, fleet modernization incentives.

**Phase 5 (Planned):** Advanced financials (loans, bonds, IPO), reputation system effects, full AI competition with slot contention, historical data export, achievement system.

## Hidden DEVMODE Console

A hidden developer console exists in the game. It is activated by typing "DEVMODE" on the keyboard while not focused on any input field. It must NEVER be exposed in the UI, documentation, or any player-facing element.

Features: set/add cash, reputation slider, instant fleet add (any aircraft type, free), fast forward (+1 day/week/month), god mode (infinite cash). The console is styled as a retro green-on-black terminal overlay.

Implementation: `main.js` captures keyboard input into a buffer, compares against "DEVMODE", and calls `toggleSecretPanel()`. The panel DOM is created dynamically with id `__dp`. Aircraft types are exposed via `window.__acRef` for the dropdown.
