# Own Your Airline — Progress Tracker

## Status: Phase 1 Complete + Patch 1 Applied

### Done

- **Core Architecture** — 18 ES module files, vanilla JS, no frameworks, GitHub Pages compatible
- **Data Layer** — 300+ real airports, 14 aircraft types (ATR-72 to 777X), 150+ real AI airlines
- **Game State** — Central state object, save/load via localStorage, difficulty presets + sandbox
- **New Game Screen** — Airline name, IATA code, color picker, searchable hub selector, difficulty cards
- **Simulation Engine** — Tick-based (5 min per tick), multi-speed (1x/2x/4x/8x), pause/resume
- **Game Time System** — Year/Month/Week/Day format (Month = 4 weeks, Week = 7 days), totalMinutes counter replaces calendar Date. Display: "Year 1, Month 3, Week 2, Day 4 — 14:35"
- **Fleet Management** — Purchase and lease aircraft, sell (with depreciation), return leases, monthly lease deductions, registration generation
- **Confirmation Dialogs** — Confirm before purchase, lease, sell, and return lease with details (price, specs, deposit)
- **Tail Number Rename** — Inline pencil-icon edit, max 8 chars, auto-uppercase, Enter/blur to save, Escape to cancel
- **Route Network** — Create/delete routes, Haversine distance, base fare tiers, demand model, load factor, duplicate detection
- **Scheduling** — Custom (manual departure times) and Banked (connection wave) modes, block time calculation
- **Slot System** — Per-airport hourly slot limits, slot exhaustion warnings
- **Flight Operations** — Departure matching, in-flight progress tracking, completion with revenue/cost, aircraft status cycling
- **AI Airlines** — 150+ airlines with real hubs/alliances, regional route generation, monthly expansion
- **Economics** — Revenue per pax, fuel/crew/airport/maintenance costs, monthly P&L, bankruptcy warning
- **World Map** — Canvas Mercator projection, pan/zoom, coastlines, grid overlay
- **Map Controls Panel** — Top-right toggleable panel with: player routes, AI routes, airport labels, flight dots toggles, AI airline filter dropdown
- **Map Visual Improvements** — Filled landmasses, player routes with glow (2px, 0.85 alpha), AI routes at 0.15 alpha, hub with glow ring, flight dots with white halo, routed airports larger (4px), bold labels
- **HUD** — Airline name, IATA, game date/time, speed controls, cash/fleet/flights/routes stats, save button
- **Side Navigation** — 6 panels: Dashboard, Fleet, Routes, Schedule, Finances, Log
- **Dashboard** — Overview cards for all key metrics
- **Finances Panel** — Cash summary, monthly P&L table (Y/M format), recent flights table
- **Log Panel** — Timestamped event log with color-coded types (info, finance, warning, error, route, fleet, schedule, system)
- **Modals** — Generic modal + confirm dialog system
- **DEVMODE** — Hidden terminal (type DEVMODE): set/add cash, reputation slider, instant fleet add, fast forward (+1 day/week/month), god mode
- **Dark Theme** — Full CSS with Orbitron/Rajdhani/JetBrains Mono fonts, aviation dashboard aesthetic, responsive

### In Progress

- Nothing currently in progress

### Next

- Event system (random events: mechanical issues, strikes, weather delays, demand surges)
- More detailed aircraft stats panel (utilization, cycle count, next maintenance)
- Route profitability breakdown per route
- AI airline competition effects on pricing/demand
- Alliance system for player
- Achievements/milestones
- Sound effects (optional)
- Tutorial/onboarding flow

### Decisions

1. **Game time over calendar time** — Game uses abstract Year/Month/Week/Day instead of real calendar dates. Month = exactly 4 weeks = 28 days. Year = 12 months = 336 days. This avoids real-world date complexity and makes P&L/depreciation calculations clean.
2. **totalMinutes counter** — Single integer counter for game clock (minutes since game start). All timestamps (purchase dates, log entries, flights) stored as totalMinutes values. No Date objects in game state.
3. **No automation** — Player must manually create routes, assign aircraft, set schedules. No auto-assign. This is the core design philosophy.
4. **Custom + Banked scheduling** — Two distinct scheduling modes. Custom = player picks exact times. Banked = connection wave windows with auto-generated departure times.
5. **Slot system is per-hour** — Each airport has slotsPerHour. Slots reset each hour. Flights that can't get a slot are skipped (warning logged).
6. **Depreciation on sell** — Aircraft lose value annually (DEPRECIATION_RATE_ANNUAL) plus a 15% dealer margin on sale.
7. **Lease deposits** — Leasing requires upfront deposit (LEASE_DEPOSIT_MONTHS × monthly cost), non-refundable on return.
8. **AI routes are visual-only** — AI airlines show routes on map but don't directly compete for slots or affect load factors (simplified for Phase 1).
9. **Map controls as overlay** — Map toggles live in a semi-transparent collapsible panel over the canvas, not in the side panel, to keep the map as the primary view.

### Known Issues

1. **AI competition is shallow** — `getAICompetitorsOnRoute` counts overlapping AI routes but doesn't meaningfully reduce player demand/fare yet.
2. **No schedule conflict detection** — Nothing prevents scheduling the same aircraft on overlapping routes/times. Aircraft just stays "in_flight" and additional departures are skipped.
3. **Flight dots may overlap** — Multiple flights on the same route show overlapping dots with no offset.
4. **No maintenance system** — Aircraft never need maintenance, no downtime beyond flight status.
5. **Simplified coastlines** — Map landmasses are very rough approximations (4 polygons).
6. **No touch support** — Map pan/zoom is mouse-only (no touch events for mobile).
7. **Save compatibility** — Old saves (with Date objects) won't load correctly after the time system refactor. Players need to start a new game.
8. **P&L month labels** — Monthly P&L shows "Y1 M1" format which is compact but less intuitive than month names. This matches the game time system by design.

### Test Checklist

- [ ] New game: create airline with all fields, verify game launches
- [ ] HUD: date shows "Year 1, Month 1, Week 1, Day 1", time shows "06:00"
- [ ] Speed controls: pause, 1x, 2x, 4x, 8x all work, time advances
- [ ] Month rollover: run to end of Month 1, verify P&L entry created
- [ ] Fleet: purchase aircraft via shop, confirm dialog appears with price
- [ ] Fleet: lease aircraft via shop, confirm dialog shows deposit amount
- [ ] Fleet: sell aircraft, confirm dialog appears
- [ ] Fleet: return leased aircraft, confirm dialog appears
- [ ] Fleet: rename tail number — click pencil, type new name, press Enter
- [ ] Fleet: rename cancel — click pencil, press Escape, name unchanged
- [ ] Routes: create route, verify map shows arc and airports
- [ ] Routes: delete route, verify map updates
- [ ] Schedule: create custom schedule with manual times
- [ ] Schedule: create banked schedule with connection bank
- [ ] Flights: verify flights launch at scheduled times
- [ ] Flights: verify flight dots move on map
- [ ] Flights: verify flights complete, revenue added, aircraft freed
- [ ] Map: pan and zoom work smoothly
- [ ] Map controls: toggle player routes off, arcs disappear
- [ ] Map controls: toggle AI routes off, AI arcs disappear
- [ ] Map controls: toggle labels off, IATA codes hidden
- [ ] Map controls: toggle flight dots off, dots hidden
- [ ] Map controls: filter single AI airline, only that airline's routes highlighted
- [ ] Map controls: collapse/expand panel
- [ ] Finances: monthly P&L table shows Y/M format
- [ ] Log: events show timestamps in "Y1 M1 W1 D1 HH:MM" format
- [ ] Save/Load: save game, refresh page, continue game loads correctly
- [ ] DEVMODE: type DEVMODE, terminal appears, all commands work
- [ ] DEVMODE: fast forward +1 day/week/month advances time correctly
