# Own Your Airline — Progress Tracker

## Status: Session D Complete

> **Merge instructions**: Branch `claude/airline-management-simulation-gZVoE` contains all Session C work. Merge into main when ready.

### Context Files

- **CONTEXT.md** — Project description, tech stack, design non-negotiables, locked decisions, phase roadmap, DEVMODE documentation. Written for AI audience.
- **ARCHITECTURE.md** — File tree, data flow, key data structures (exact shapes), module dependency map, rendering pipeline, map pipeline, inviolable rules.
- **PROGRESS.md** — This file. Current status, what's done, what's next, known issues, test checklist.

### Phase 1 (Complete)

- **Core Architecture** — 18 ES module files, vanilla JS, no frameworks, GitHub Pages compatible
- **Data Layer** — 300+ real airports, 14 aircraft types (ATR-72 to 777X), 150+ real AI airlines
- **Game State** — Central state object, save/load via localStorage, difficulty presets + sandbox
- **New Game Screen** — Airline name, IATA code, color picker, searchable hub selector, difficulty cards
- **Simulation Engine** — Tick-based (5 min per tick), multi-speed (1x/2x/4x/8x), pause/resume
- **Game Time System** — Year/Month/Week/Day format (Month = 4 weeks, Week = 7 days), totalMinutes counter
- **Fleet Management** — Purchase and lease aircraft, sell (with depreciation), return leases, monthly lease deductions
- **Confirmation Dialogs** — Confirm before purchase, lease, sell, return with details
- **Tail Number Rename** — Inline pencil-icon edit
- **Route Network** — Create/delete routes, Haversine distance, base fare tiers, demand model, load factor
- **Scheduling** — Custom (manual times) and Banked (connection wave) modes, block time calculation
- **Slot System** — Per-airport hourly slot limits
- **Flight Operations** — Departure matching, in-flight progress tracking, completion with revenue/cost
- **AI Airlines** — 150+ airlines with real hubs/alliances, regional route generation, monthly expansion
- **Economics** — Revenue per pax, fuel/crew/airport/maintenance costs, monthly P&L, bankruptcy warning
- **World Map** — Canvas Mercator projection, pan/zoom, grid overlay
- **Map Controls** — Toggles for player routes, AI routes, labels, flight dots, AI airline filter
- **HUD** — Airline name, IATA, game date/time, speed controls, stats, save button
- **Side Navigation** — 6 panels: Dashboard, Fleet, Routes, Schedule, Finances, Log
- **DEVMODE** — Hidden terminal: set/add cash, reputation slider, instant fleet, fast forward, god mode
- **Dark Theme** — Orbitron/Rajdhani/JetBrains Mono fonts, aviation dashboard aesthetic

### Phase 2 Session A (Patches)

- **Time System Refactor** — totalMinutes counter replaces Date objects
- **Map Fixes** — 14 detailed continent polygons, viewport culling, AI route cap (50), hub-distance priority, 0.08 opacity
- **Confirm Dialogs** — Added to all destructive fleet/route actions
- **PROGRESS.md** — Created as permanent tracker

### Phase 2 Session B (Complete)

- **Task 1: Directional Routes** — Each route is one-way (A→B and B→A are separate). "Also create return route" checkbox. Arc offset for bidirectional visualization. Direction-specific AI competitor query.

- **Task 2: Aircraft Status Badges** — All aircraft shown in schedule picker with status badges (Available/Busy/Maintenance). Busy aircraft show "Free at DX HH:MM" next-free time. Warning when selecting busy/maintenance aircraft. Simple/Ops mode toggle in Schedule panel.

- **Task 3: Turnaround Enforcement** — Minimum turnaround times by category (Regional 25m, Narrow 45m, Wide 90m, Super Heavy 120m). Schedule creation validates gap between departures. Turnaround shown in schedule cards and range check.

- **Task 4: Slot Model V1** — 5 slot control levels (Uncontrolled to Slot-Controlled). Level 5: LHR/JFK/NRT/CDG/HND. Level 4: DXB/SIN/FRA/AMS/IST. Level 3: DEL/BOM/DFW/LAX/ORD/ATL. Level 3+ enforces slots — unavailable slots delay flights (not skip). Delay cascade to next rotation. One-time slot fee on route creation. Player auto-holds hub slots. Airports sub-panel showing slot usage per airport. Level 4-5 show availability percentage.

- **Task 5: Daily P&L** — End-of-day notification slides in from right (auto-dismiss 8s). Shows flights operated, passengers carried, revenue/costs breakdown, net profit/loss, best/worst route. Finances panel enhanced with daily P&L canvas bar chart (last 30 days, green/red bars), running cash balance table, monthly summary preserved.

- **Task 6: Starter Fleet via Used Market** — Used Aircraft Market tab in Fleet panel. 3-5 random aircraft at game start, refreshes every 30 in-game days. Prices 60-80% of new. Each listing: type, age (2-10yr), hours flown, price, condition (Good/Fair). Buy or lease with confirm dialogs. Easy/Medium: A321neo pre-listed at 55% discount. Sandbox: free A321neo in fleet at start.

### Session C Part 1 (Complete)

- **Task 1: Map Complete Rewrite (Leaflet.js)** — Replaced canvas-based Mercator map with Leaflet + CartoDB Dark Matter tiles. Geodesic great-circle arcs (20 waypoints, spherical interpolation). Player routes: airline color, 80% opacity, 2.5px weight, glow underlayer (6px, 15% opacity). Bidirectional offset in pixel space. AI routes: 0.6px, 15% opacity, max 40 within 3000km of map center, hub-distance sorted. Hub: pulsing CSS animation ring, always visible and labeled. Player destinations: medium circles, labeled zoom 4+. AI hubs: tiny dots zoom 5+. Generic airports: small dots zoom 6+. Live flights: rotated plane character interpolated along geodesic arc with click popup (route, aircraft, dep/arr times, pax). Map controls panel preserved with z-index 1000. Leaflet CDN added to index.html.

- **Task 2: Multi-Aircraft Rotation** — Added `currentLocation` field to all aircraft (tracks physical position as IATA code or "airborne:ORIGIN→DEST"). All fleet creation functions (purchase, lease, used buy, used lease, free add) set currentLocation to hub. sim.js enforces location-based departure: aircraft must be at route origin to depart. On launch sets airborne, on arrival sets destination. Backward compatibility for older saves in init.js. Fleet panel shows location next to status. Route cards show assigned aircraft with locations, understaffed warning (min aircraft calculation), stranding warning when no return leg exists. Schedule creator shows minimum aircraft info and location warnings.

- **Task 3: Edit Schedule** — Edit button on each schedule card alongside Delete. Clicking Edit opens pre-populated form with current route, aircraft, mode (Custom/Banked), departure times, and bank assignment. Player can change any value. Save runs full validation via `validateScheduleParams()` which returns ALL errors simultaneously: range check, aircraft location, turnaround enforcement between departures, minimum aircraft for frequency. Errors displayed inline in the form — cannot save until resolved. Validate button checks without saving. `updateSchedule()` replaces existing schedule in place (no duplicate created), handles route reassignment if route changed. Panel refreshes immediately after save.

### Session C Part 2 (Complete)

- **Task 1: Swap Aircraft on a Route** — "Swap Aircraft" button on route cards opens modal showing all fleet with status badges (Available/Busy/Maintenance in green/amber/red), current location, next free time for busy aircraft, range info. Player selects replacement aircraft. `swapAircraftOnRoute()` in scheduler.js validates: range for route distance, location at departure airport, scheduling conflicts, turnaround feasibility. On valid swap: all affected schedules updated in place (aircraftId and blockTimeMinutes). Route stays active throughout — no schedule interruption. On invalid: specific error messages shown, modal stays open. Multi-aircraft routes: dropdown to select which aircraft to replace.

- **Task 2: Scheduling Validation Overhaul** — `createSchedule()` now delegates all validation to `validateScheduleParams()` before any state mutation. Returns `{ schedule, errors }` for proper UI error handling. `updateSchedule()` also validates before mutating. Added scheduling conflict detection: checks if aircraft already has overlapping time windows on other routes. `validateScheduleParams()` accepts optional `excludeScheduleId` so editing a schedule doesn't flag its own existing times as conflicts. Round trip duration included in min-aircraft warning. Schedule creator UI now has Validate button with inline error display matching the editor. All errors shown at once — form stays open until resolved.

- **Task 3: Event Log Auto-Update** — `addLogEntry()` in state.js now dispatches `window.dispatchEvent(new CustomEvent('gameEvent', { detail: entry }))` on every log entry. Log panel listens for events and prepends new entries without re-rendering the whole panel. Pause Log toggle freezes updates during review. Max 200 entries shown in panel. Left border color by log type: system=grey, route=blue, flight=green, finance=amber, slot=orange, ai=purple, bank=teal, error=red, schedule=teal, fleet=purple.

- **Task 4: Return Route UI** — Paired routes linked via `pairedRouteId` field on route objects. Routes created with "Also create return route" checkbox are automatically linked. Route cards show ↔ icon and "Paired" badge for linked routes. Delete paired route prompts: "Delete Both Routes", "Delete This Route Only", or "Cancel". Schedule panel groups paired route schedules together with outbound/return labels. Backward compatibility: `pairedRouteId` initialized to null for older saves in init.js.

### Session D (Complete)

- **Task 1: CLAUDE.md** — Created session-start instructions file for Claude Code. Read CONTEXT.md, ARCHITECTURE.md, PROGRESS.md first every session. Work rules, data flow rules, commit hygiene.

- **Task 2: Location Validator Bug Fix** — Fixed critical bug where `validateScheduleParams()` and `swapAircraftOnRoute()` checked `aircraft.currentLocation` (snapshot of current position) instead of projecting where the aircraft will be at the proposed departure time. Added `getProjectedLocation(aircraftId, proposedDepMinute, excludeScheduleId)` function that walks through an aircraft's active scheduled flights to determine its position at any given time within the daily cycle. UI warnings in schedule creator/editor changed from blocking "cannot depart" to advisory "currently at X, a prior flight must deliver it." This unblocks return leg creation — e.g., aircraft at HYD with 08:00 HYD→DEL can now schedule 14:00 DEL→HYD.

- **Task 3: Unified Route + Schedule Creation** — Replaced separate "create route" and "create schedule" flows with a single unified screen in the Routes panel. Five sections: (1) Route Setup — origin/dest search, return route checkbox, route info display; (2) Outbound Schedule — aircraft selection with status badges, mode toggle, departure times; (3) Return Schedule — same or different aircraft, mode, times; (4) Flight Numbers — auto-generated `{IATA}{number}` format (e.g., 6E101), editable, uniqueness enforced; (5) Validation Summary — all errors from both directions shown together. Rotation feasibility check validates return departures leave enough time after outbound arrivals + turnaround. "Route Only" button preserved for creating routes without schedules. Existing schedule creator in Schedule panel preserved for adding schedules to existing routes.

- **Task 4: Flight Number System** — Added `flightNumbers[]` array to schedule objects parallel to `departureTimes[]`. Format: `{IATA}{sequential}` starting at 101. `generateFlightNumbers(count)` auto-assigns next available numbers. `getAllUsedFlightNumbers()` checks uniqueness across all schedules. Flight numbers shown in schedule cards, flight objects, and map flight popups. Backward compatibility: older saves auto-get generated flight numbers in `initFromSave()`.

### Phase 2 Work Complete

All Phase 2 work across Sessions A, B, C1, and C2 is complete:
- Directional routes with return route creation
- Aircraft status tracking and location enforcement
- Turnaround and scheduling validation
- Slot system with per-airport control levels
- Daily P&L with notification and charts
- Used aircraft market for starter fleet
- Leaflet.js map with geodesic arcs and live flights
- Multi-aircraft rotation with physical location tracking
- Schedule editing with full validation
- Swap aircraft on routes
- Comprehensive scheduling validation with conflict detection
- Real-time event log with auto-update
- Paired route UI with grouping

### Session E (Engine Integrity & Features)

- **Task 1: Simulation Engine Integrity Fixes** — Fixed multiple critical simulation bugs: added explicitly delayed flights on aircraft unavailability to prevent silent cascades, fixed midnight wrap-around mathematical scheduling conflicts in \`scheduler.js\`, and fixed overnight P&L inaccuracies by syncing daily metric boundaries to flight \`arrivalTime\`. Fixed slot engine overconsumption during delays.
- **Task 2: Fleet Swap Expansion** — \`swapAircraftOnRoute\` in \`scheduler.js\` now completely analyzes an aircraft's entire daily multi-leg flight plan before confirming a swap, preventing range failures, stranded planes, or turnaround bottlenecks on inherited schedules.
- **Task 3: Used Aircraft Ferry System** — Used aircraft now spawn at random global airports globally. Purchasing or leasing them prompts a choice: "Ferry to Hub" or "Keep at Location". Ferrying instantly transports the plane to the hub but deducts a transparent distance-based cost ($2.50 per km) with no immediate slot or schedule requirements.
- **Task 4: Roadmap Planning & Phase 2 Stabilization** — Formal roadmap for Phases 3, 4, and 5 drafted, organizing Mechanics vs Scale and identifying critical engine dependencies. **Phase 2 is now officially fully stabilized.**

### Phase 3 (Maintenance V1 In Progress)

- **Task 1: Engine Data Expansion** — Implemented strict maintenance properties (`hoursSinceACheck`, `pendingCheckType`, `graceHoursRemaining`, etc.) across all new, leased, free, and used aircraft instantiations in `fleetManager.js`. Preserved save compatibility in `init.js` by aggressively patching uninitialized variables on older profiles.
- **Task 1b: Data Architecture Cleanup** — Extracted hardcoded maintenance interval thresholds into a centralized `MAINTENANCE_THRESHOLDS` export in `data/aircraft.js` to guarantee consistency across engine modules.
- **Task 7: Sidebar Icon Standardization** — Replaced all primitive Unicode sidebar icons iteratively with exact SVG geometry bindings maintaining a strict `.sidebar-icon` scaling dimension. Validated UI stroke interaction coloring mapped directly via css inheritance contextually.
- **Task 8: Scheduler Auto-Calculation** — Rebuilt `SchedulesView.js` dual-input flow supporting dynamic bi-directional pairings (`createSchedule` correctly forks 1x Origin schema and 1x Return schema instantly). Integrated a locking mechanism so users who type directly into opposite legs engage an interactive override toggle. Modulo bound mathematical rollover logic gracefully triggers `+1 Day` / `-1 Day` visual warnings.
- **Task 2: Simulation Tick Math** — Updated `sim.js` to natively inject flight-duration decrements and A/B/C threshold triggers at the precise moment a flight officially completes its arrival block (`processActiveFlights`), natively enforcing forced-grounding and explicit schedule unassignment without double counting ticks.
- **Task 3: UI Badging** — Overhauled `fleetManager` fleet card rendering inside `ui/panels.js` to explicitly expose `maintenance_due` grace hour warnings as amber badges, and red `maintenance` grounded states, displaying time-to-release when applicable. No engine logic explicitly touched.
- **Task 4: Maintenance Action** — Centralized `MAINTENANCE_RULES` containing abstract durations and costs inside `data/aircraft.js`. Expanded `fleetManager.js` with `startMaintenance()` API that logically overrides `state.js` negative balance restrictions, strips matching entries from `schedules`, resets appropriate nested threshold tiers, and triggers via the `Perform Maintenance` UI module within `panels.js`.
- **Task 5: Scheduler Collision (Final)** — Expanded validation schemas in `scheduler.js` to strictly enforce padding restrictions when analyzing overlap rules across entirely discrete routes. Blocked all assigning protocols if the aircraft's physical active grounding limit overlaps with requested flight departures, while dynamically surfacing exact abstract release chronologies in the schedule drop-down panels. Maintenance System V1 is structurally complete.

- **Task 6: Transfer Demand V1**
  - **Step 1:** Implemented core cache mapping loops inside `state.transfers` with strictly transient payloads via `localStorage` stripped handlers.
  - **Step 2:** Created `engine/transfers.js` containing the `recalculateTransferDemand` algorithm. Native daily engine hooks loop Hub-bound routes simultaneously, applying sequential timestamp verifications and mathematically restricting `competitor` direct-route cannibalization. Minimum Connection Times (MCT) and 1440-minute wraparound matrices strictly enforced prior to local boarding logic.
  - **Step 3:** Intercepted the simulation loop at the `launchFlight` function directly where local `loadFactor` math binds to available seating. Deducts physical seats mathematically across both Outbound and Inbound abstracted variables *simultaneously* via `Math.min`. Retains base Local-Passenger-First sequence requirements by boarding transfers strictly upon initial unbooked capacity blocks prior to calculating final load bounds.
  - **Step 4:** Embedded `transferPassengers` dynamically aggregated matrices inside `ui/panels.js`. Modified the Dashboard Summary payload natively via array reduction across `.flights.completed` for all-time stats, and appended the `24h Transfers` label precisely onto standard `route-card` outputs utilizing 1440-minute lookback checks independently of engine execution.

- **Task 9: Route Pricing / Yield System** — Implemented engine-native price elasticity parameters allowing precise (0.75 - 1.50) multi-tier ticket inflation controls. Mapped a strict 0.8x localized elasticity penalty alongside a sharper 1.2x global transfer elasticity damper dynamically processed directly inside the `sim.js` tick boarder. Added functional Data Strategy visualizer onto `RouteDetailView.js` reporting true projected drop-offs seamlessly whilst updating real-time Spill aggregations natively through the `NetworkView.js` array mapping loop.

### Session G (UI Modularity & Fleet Operations)

- **Task 4: Network Route Analytics** — Created `NetworkView.js` featuring a data-dense sortable table and summary KPIs tracking route performance via a strict 1440-minute lookback window across `state.flights.completed` and `state.schedules`. Surfaces derived 'Est. Spill' and exact load factors per route natively, bridging navigation flows seamlessly to `RouteDetailView`. All KPIs and Timeline render clean empty-states cleanly, natively resolving layout edges without mutating engine flow.
- **Task 5: Aircraft Detail View** — Created `AircraftDetailView.js` featuring a 1440-minute lookback for aircraft-specific analytics (Flights, Utilization, Revenue, Profit, Transfers), a robust Gantt-style 24-hour visual timeline matching Fleet structure but scaled for single focus, an aircraft-specific daily flight schedule assignment table, dynamic maintenance profile metrics mapping exact engine thresholds, and actionable header controls (`Sell Aircraft`, `Perform Maintenance`, `Back to Fleet`). Connected via `uiState.js` and Fleet Operations table row clicks natively using event delegation.
- **Task 6: Hub Operations View** — Created `HubOperationsView.js` offering a centralized dashboard for Primary Hub performance. Includes 1440-minute aggregation for Arrivals/Departures, a visually stacked 24-hour timeline revealing schedule banks/waves per hour block via `schedules` math computation, a data-dense Connection Performance Table iterating raw `state.transfers.flowRates`, and a dynamic Route Role logic classifier mapping hub-bound route efficiency based on transfer densities and capacities natively. Connected safely to `AppShell` and `uiState` navigation mapping.

### Session H (Scheduling UI Polish)

- **Task 1: Auto-Calculation Restoration** — Added UI state capability to restore "Auto" calculation mode on bidirectional returns once the user falls back into manual override mode inside `SchedulePanel.js`.
- **Task 2: Reverse Back-Calculation** — Enhanced return-first input handling to accurately back-calculate the outbound time natively supporting ±1 day rollovers recursively.
- **Task 3: Return-Leg Physical Validation** — Patched `validateScheduleParams` to accept an `assumedStartLocation` parameter natively allowing bidirectional validation to project aircraft location exactly at the outbound destination prior to return flight departure.
- **Task 4: Fare Slider Live Preview** — Wired the custom pricing slider tightly to engine elasticity algorithms projecting Ticket Price, Demand, Load Factor, and Revenue live without requiring route confirmation.

### Session I (Aircraft Rotation System V1)

- **Task 1: Core Rotation Engine** — Created `rotationEngine.js` to dynamically derive 24-hour multi-leg aircraft schedules (e.g. A→B→C) purely from existing states without a persistent database. Added `buildAircraftRotationChain` and `validateAircraftRotationChain`.
- **Task 2: Engine Integration** — Integrated `validateAircraftRotationChain` into `scheduler.js`'s `validateScheduleParams` and `swapAircraftOnRoute`. Ensures physical location continuity, turnaround limits, and maintenance constraints across discrete routed legs.
- **Task 3: UI Iteration** — Updated `FleetView.js` and `AircraftDetailView.js` to natively digest abstract rotation chains into 24-hour visual timelines reflecting continuous sequence operations. Updated `SchedulePanel.js` to evaluate schedule proposals explicitly against sequential aircraft locations dynamically.

### Stabilization Sprint (Post-Audit)

- **Fix 1: Maintenance Release Bug** — Added `processMaintenanceRelease()` to `sim.js` tick loop. Aircraft in `'maintenance'` status with expired `maintenanceReleaseTime` are now set back to `'available'`. Without this fix, aircraft were permanently grounded once entering maintenance.
- **Fix 2: Dashboard KPI Bug** — `DashboardView.js` filtered completed flights by `f.completionTime` which doesn't exist on flight objects. Changed to `f.arrivalTime`. All dashboard KPIs (passengers, revenue, load factor, etc.) were showing zero.
- **Fix 3: HubOps Block Time Bug** — `HubOperationsView.js` passed `acData.id` (undefined) to `calculateBlockTime()`. Changed to pass `ac.type`. Hub timeline activity chart was computing zero-duration flights.
- **Fix 4: Scheduler Import Regression** — `scheduler.js` imported non-existent `calculateMinAircraft` from `data/aircraft.js`. The function is defined locally in `scheduler.js`. Removed the dead import that caused `SyntaxError` and blank-screen crash on startup.

- **Fix 5: Fare Slider Live Preview** — `SchedulePanel.js` now re-calls `updateFarePreview` when departure times are added, so load factor and revenue update live. Also moved `fareMultiplier` state commit from slider drag to confirm click — cancelling no longer permanently changes fares.
- **Fix 6: fareMultiplier Save Migration** — `init.js` now patches `fareMultiplier = 1.0` on legacy routes that lack the field.
- **Fix 7: AircraftDetailView Grace Hours Field** — Changed `ac.maintenanceGraceHours` (non-existent) to `ac.graceHoursRemaining` (canonical field) with `.toFixed(1)` formatting.
- **Fix 8: Dashboard Delayed Flights** — Changed hardcoded `delayedFlights = 0` to `state.delayedFlights.length`.
- **Fix 9: Rotation Timeline Idle Gaps** — `rotationEngine.js` now fills gaps between flight/turnaround blocks with explicit `idle` blocks, giving full 24h coverage with tooltips.

### Phase 3 Roadmap

- **Maintenance System** — Aircraft need periodic maintenance, downtime, repair costs
- **Demand Model V2** — AI competition affects demand, seasonal variation, hub connectivity bonus
- **Codeshare / Alliances** — Partner with AI airlines for feed traffic
- **Aircraft Upgrades** — Cabin config (economy/business/first), Wi-Fi, seat pitch
- **Route Profitability Analysis** — Per-route P&L tracking, break-even analysis
- **Passenger Feedback** — On-time performance, delays affect reputation
- **Advanced Slot System** — Slot auctions, grandfather rights, use-it-or-lose-it
- **Fleet Planning** — Order backlog, delivery dates, pre-order discounts
- **Network Effects** — Connecting passengers via hub, transfer traffic
- **Achievements / Milestones** — Fleet size goals, revenue targets, route network coverage

### Decisions

1. **Game time over calendar time** — Abstract Year/Month/Week/Day instead of real calendar dates. Month = 4 weeks = 28 days. Year = 12 months = 336 days.
2. **totalMinutes counter** — Single integer counter for game clock. All timestamps stored as totalMinutes.
3. **No automation** — Player must manually create routes, assign aircraft, set schedules. No auto-assign. Core design philosophy.
4. **Custom + Banked scheduling** — Two distinct scheduling modes.
5. **Slot system is per-hour** — Each airport has slotsPerHour. Level 3+ airports enforce slots with delays.
6. **Depreciation on sell** — Annual depreciation rate plus 15% dealer margin.
7. **Lease deposits** — Upfront deposit, non-refundable on return.
8. **AI routes are visual-only** — AI airlines show routes on map but don't compete for slots (simplified for Phase 1-2).
9. **Map controls as overlay** — Toggles live in collapsible panel over the map.
10. **Directional routes** — Each route is one-way. A→B and B→A are independent route objects.
11. **Slot costs are origin-only** — Each direction pays slot fee for its origin airport only. Hub is free.
12. **Used market for starter fleet** — No free aircraft on Easy/Medium. Used market provides affordable entry point.
13. **Daily P&L is non-blocking** — Notification auto-dismisses, doesn't pause the game.
14. **Leaflet.js for map** — External dependency allowed for map rendering. CartoDB Dark Matter tiles. No other external libraries.
15. **Aircraft physical location tracking** — `currentLocation` field enforces realistic positioning. Aircraft must be at departure airport.
16. **Schedule edit replaces in place** — No delete+recreate. `updateSchedule()` modifies existing schedule object.
17. **Paired routes linked by ID** — `pairedRouteId` bidirectional link between outbound and return routes.
18. **createSchedule returns { schedule, errors }** — Structured return for proper UI error handling instead of null.
19. **Event-driven log updates** — CustomEvent dispatch avoids full panel re-render on every log entry.
20. **Forward-projected location validation** — Schedule validation projects where aircraft will be at departure time based on daily schedule, not current snapshot.
21. **Unified route + schedule creation** — Single form creates route(s) and schedule(s) atomically. Both directions handled together.
22. **Flight numbers per departure** — `flightNumbers[]` parallel array on schedule objects. Format `{IATA}{number}` starting at 101. Auto-generated, editable, unique.

### Known Issues

1. **AI competition is shallow** — `getAICompetitorsOnRoute` counts but doesn't meaningfully affect demand yet.
2. ~~**No maintenance system**~~ — **RESOLVED.** Maintenance V1 implemented with A/B/C checks, grace periods, forced grounding, and release timer.
3. **No touch support** — Leaflet handles touch for map, but other UI elements are mouse-only.
4. **Save compatibility** — Saves from Phase 1 may not load correctly. Start new game recommended. Phase 2 saves patched for currentLocation, pairedRouteId, and flightNumbers.
5. **Delay cascade limited** — Delays propagate to next rotation but don't cascade through full day's schedule.
6. **Used market RNG** — Market refresh is random, may occasionally offer no useful aircraft types.
7. **Daily P&L chart doesn't show on first day** — Need at least one full day of operations for data.
8. **Schedule editor reuses creator div** — Edit form takes over the `sched-creator` div; creating a new schedule while editing requires cancelling first.
9. **CONTEXT.md references canvas map** — Tech stack section still says "HTML5 Canvas (world map)" — should be updated to mention Leaflet.
10. **Log listener cleanup** — Log event listener is only cleaned up when log panel re-renders; switching panels leaves listener active (low impact — entries still accumulate in state).

### Test Checklist

- [ ] New game: create airline, verify game launches
- [ ] HUD: date/time displays correctly, speed controls work
- [ ] Month rollover: verify P&L entry created
- [ ] Fleet: purchase/lease/sell/return aircraft with confirm dialogs
- [ ] Fleet: rename tail number (pencil icon, Enter/Escape)
- [ ] Fleet: used market tab shows listings with age/hours/condition
- [ ] Fleet: buy/lease from used market
- [ ] Fleet: used market refreshes after 30 in-game days
- [ ] Fleet: Sandbox mode starts with free A321neo
- [ ] Fleet: Easy/Medium mode shows discounted A321neo in used market
- [ ] Fleet: location displayed next to status badge
- [ ] Routes: create route, verify one-way direction
- [ ] Routes: "Also create return route" checkbox creates both directions
- [ ] Routes: paired routes show ↔ icon and "Paired" badge
- [ ] Routes: delete paired route prompts: both, one, or cancel
- [ ] Routes: route info shows slot control level and cost
- [ ] Routes: slot fee deducted on creation (hub exempt)
- [ ] Routes: Airports sub-panel shows slot usage per airport
- [ ] Routes: route cards show assigned aircraft with locations
- [ ] Routes: understaffed warning when fewer aircraft than required
- [ ] Routes: stranding warning when no return leg exists
- [ ] Routes: swap aircraft button opens modal with fleet list
- [ ] Routes: swap validates range, location, conflicts, turnaround
- [ ] Routes: successful swap updates schedules in place
- [ ] Routes: delete route
- [ ] Schedule: create custom schedule with manual times
- [ ] Schedule: turnaround validation rejects too-close departures
- [ ] Schedule: range check shows block time + turnaround
- [ ] Schedule: aircraft picker shows status badges
- [ ] Schedule: busy aircraft show next-free time
- [ ] Schedule: scheduling conflict detection (overlapping time windows)
- [ ] Schedule: validate button in creator shows errors without saving
- [ ] Schedule: edit button opens pre-populated form
- [ ] Schedule: edit form shows current route, aircraft, mode, times
- [ ] Schedule: validate button shows all errors without saving
- [ ] Schedule: save validates and updates in place (no duplicate)
- [ ] Schedule: paired route schedules grouped together
- [ ] Schedule: panel refreshes after save
- [ ] Flights: launch at scheduled times, aircraft must be at origin
- [ ] Flights: aircraft location set to airborne during flight
- [ ] Flights: complete with revenue, aircraft location set to destination
- [ ] Flights: slot delay at Level 3+ airports logged as warning
- [ ] Flights: delayed flight retries next tick
- [ ] Map: Leaflet with CartoDB Dark Matter tiles loads
- [ ] Map: geodesic arcs for player routes with glow
- [ ] Map: bidirectional routes show offset arcs
- [ ] Map: AI routes capped at 40, within 3000km, 0.15 opacity
- [ ] Map: hub pulsing animation, always labeled
- [ ] Map: player destinations labeled zoom 4+, AI hubs zoom 5+
- [ ] Map: live flights as rotated plane with click popup
- [ ] Map controls: all toggles work including AI routes off
- [ ] Daily P&L: notification slides in at end of day
- [ ] Daily P&L: shows flights/pax/revenue/costs/net/best/worst
- [ ] Daily P&L: auto-dismisses after 8 seconds
- [ ] Finances: daily P&L bar chart renders (last 30 days)
- [ ] Finances: running cash balance table shows last 10 days
- [ ] Finances: monthly P&L table preserved
- [ ] Log: real-time updates prepend new entries
- [ ] Log: pause/resume toggle works
- [ ] Log: max 200 entries shown
- [ ] Log: left border colors match log type
- [ ] Save/Load: save game, refresh, continue works
- [ ] Save/Load: older saves get currentLocation, pairedRouteId, and flightNumbers patched
- [ ] Unified Creator: 5-section form opens from Routes panel "Create Route" button
- [ ] Unified Creator: origin/dest airport search works
- [ ] Unified Creator: route info shows distance, fare, competitors, slot levels
- [ ] Unified Creator: outbound schedule section with aircraft, mode, times
- [ ] Unified Creator: return schedule section toggles with "return route" checkbox
- [ ] Unified Creator: "Same aircraft" checkbox syncs return aircraft to outbound
- [ ] Unified Creator: flight numbers auto-generated in section 4
- [ ] Unified Creator: flight number inputs are editable
- [ ] Unified Creator: validation summary shows all errors at once
- [ ] Unified Creator: "Create Route & Schedule" creates routes + schedules atomically
- [ ] Unified Creator: "Route Only" creates routes without schedules
- [ ] Unified Creator: "Validate" button checks without creating
- [ ] Unified Creator: rotation feasibility check for same-aircraft round trips
- [ ] Flight Numbers: schedule cards show flight numbers next to departure times
- [ ] Flight Numbers: flight number uniqueness enforced
- [ ] Flight Numbers: map flight popup shows flight number
- [ ] Location Validator: return leg accepted when outbound delivers aircraft to destination
- [ ] Location Validator: projected location used instead of current snapshot
- [ ] DEVMODE: all commands work
