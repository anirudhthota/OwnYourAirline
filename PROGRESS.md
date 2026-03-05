# Own Your Airline — Progress Tracker

## Status: Session C Part 1 Complete

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

### In Progress

- Nothing currently in progress

### Session C Part 2 Will Cover

- Swap aircraft on existing schedule
- Scheduling validation overhaul
- Event log auto-update
- Return route UI improvements

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

### Known Issues

1. **AI competition is shallow** — `getAICompetitorsOnRoute` counts but doesn't meaningfully affect demand yet.
2. **No maintenance system** — Aircraft never need maintenance, no downtime.
3. **No touch support** — Leaflet handles touch for map, but other UI elements are mouse-only.
4. **Save compatibility** — Saves from Phase 1 may not load correctly. Start new game recommended. Phase 2 saves patched for currentLocation.
5. **Delay cascade limited** — Delays propagate to next rotation but don't cascade through full day's schedule.
6. **Used market RNG** — Market refresh is random, may occasionally offer no useful aircraft types.
7. **Daily P&L chart doesn't show on first day** — Need at least one full day of operations for data.
8. **Schedule editor reuses creator div** — Edit form takes over the `sched-creator` div; creating a new schedule while editing requires cancelling first.
9. **CONTEXT.md references canvas map** — Tech stack section still says "HTML5 Canvas (world map)" — should be updated to mention Leaflet.

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
- [ ] Routes: route info shows slot control level and cost
- [ ] Routes: slot fee deducted on creation (hub exempt)
- [ ] Routes: Airports sub-panel shows slot usage per airport
- [ ] Routes: route cards show assigned aircraft with locations
- [ ] Routes: understaffed warning when fewer aircraft than required
- [ ] Routes: stranding warning when no return leg exists
- [ ] Routes: delete route
- [ ] Schedule: create custom schedule with manual times
- [ ] Schedule: turnaround validation rejects too-close departures
- [ ] Schedule: range check shows block time + turnaround
- [ ] Schedule: aircraft picker shows status badges
- [ ] Schedule: busy aircraft show next-free time
- [ ] Schedule: edit button opens pre-populated form
- [ ] Schedule: edit form shows current route, aircraft, mode, times
- [ ] Schedule: validate button shows all errors without saving
- [ ] Schedule: save validates and updates in place (no duplicate)
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
- [ ] Save/Load: save game, refresh, continue works
- [ ] Save/Load: older saves get currentLocation patched
- [ ] DEVMODE: all commands work
