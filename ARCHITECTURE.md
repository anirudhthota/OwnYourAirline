# ARCHITECTURE.md — Technical Architecture for Own Your Airline

## File Tree

```
OwnYourAirline/
├── index.html              — Entry point. Loads fonts, style.css, main.js as ES module
├── main.js                 — Boot sequence, game launch, tick/month/day callbacks, DEVMODE console
├── style.css               — All CSS. Dark theme, responsive, component styles (~1500 lines)
├── CONTEXT.md              — Project context for AI tools
├── ARCHITECTURE.md         — This file
├── PROGRESS.md             — Progress tracker, decisions, known issues, test checklist
├── README.md               — Basic readme
│
├── data/                   — Static data (no state mutation)
│   ├── aircraft.js         — 14 aircraft types with specs, cost constants, turnaround times, maintenance thresholds
│   ├── airlines.js         — 150+ real AI airlines with hubs, alliances, fleet preferences
│   └── airports.js         — 300+ real airports with coords/slots, slot control levels, distance calc
│
├── engine/                 — Game logic (reads and mutates state)
│   ├── state.js            — Central game state, create/get/set, cash operations, time utilities, save/load
│   ├── sim.js              — Tick loop, flight departures, active flight processing, slots, day/month end
│   ├── init.js             — New game initialization, save loading, simulation startup
│   ├── routeEngine.js      — Route CRUD, block time, fare/demand/cost/revenue calculations
│   ├── scheduler.js        — Schedule CRUD, turnaround validation, banked departures, min aircraft calc
│   ├── fleetManager.js     — Fleet CRUD (buy/sell/lease/return), used market, fleet summary
│   └── aiEngine.js         — AI airline initialization, route generation, monthly expansion
│
└── ui/                     — UI rendering (reads state, manipulates DOM)
    ├── app/                — AppShell and main panel routing
    ├── components/         — Reusable UI components (DataTable, StatCard, Toolbar, Modal)
    ├── services/           — UI-only state (uiState.js)
    ├── views/              — Modular view panels (DashboardView, FleetView, RoutesView, etc.)
    ├── map.js              — Canvas/Leaflet world map
    ├── hud.js              — Top HUD bar
    ├── newGame.js          — New game setup screen
    └── dailyPnl.js         — Daily P&L slide-in notification
```

## Data Flow

```
state.js (single source of truth)
    ↑ write                    ↑ read
    |                          |
engine/ files              ui/ files
(routeEngine, scheduler,   (panels, map, hud,
 fleetManager, sim,         newGame, modals,
 aiEngine, init)            dailyPnl)
```

**Rule:** Only engine files mutate `gameState`. UI files read state via `getState()` and render. UI files call engine functions (e.g., `createRoute()`, `purchaseAircraft()`) which internally mutate state, then UI re-renders.

**Exception:** `state.ui` (selected panel, map center/zoom) is mutated by UI code since it's UI-only state.

**Ferry to Hub System Data Flow:** When purchasing/leasing used aircraft located at foreign airports, the UI (`ui/panels.js`) prompts a modal and passes a `ferryToHub` boolean to `engine/fleetManager.js`. The engine atomically deducts the aircraft price and the distance-based ferry costs simultaneously, then initializes `currentLocation` to the hub. If the user declines the ferry, the aircraft `currentLocation` is explicitly initialized and stays at the foreign airport.

## Key Data Structures

### gameState (the root object)

```javascript
{
    config: {
        airlineName: "string",
        iataCode: "XX",
        airlineColor: "#00AAFF",
        hubAirport: "HYD",
        difficulty: "MEDIUM",       // EASY | MEDIUM | HARD | SANDBOX
        sandboxCash: null           // number if SANDBOX
    },
    clock: {
        totalMinutes: 360,          // integer, minutes since game start (starts at 6:00 = 360)
        speed: 1,                   // 0=paused, 1/2/4/8
        tickInterval: null,         // setInterval ID
        totalTicks: 0
    },
    finances: {
        cash: 500000000,
        totalRevenue: 0,
        totalCosts: 0,
        monthlyRevenue: 0,          // resets each month
        monthlyCosts: 0,
        monthlyPnL: [],             // array of { month, year, revenue, costs, profit }
        dailyRevenue: 0,            // resets each day
        dailyCosts: 0,
        dailyPnL: [],               // array of dailyRecord objects (last 90)
        dailyFlights: 0,
        dailyPassengers: 0,
        godMode: false
    },
    fleet: [],                      // array of aircraft objects
    nextFleetId: 1,
    routes: [],                     // array of route objects
    nextRouteId: 1,
    schedules: [],                  // array of schedule objects
    nextScheduleId: 1,
    flights: {
        active: [],                 // in-flight
        completed: [],              // historical (capped at 1000)
        nextFlightId: 1
    },
    slots: {},                      // { "IATA_hour": count }
    delayedFlights: [],             // flights waiting for slots or aircraft availability (prevents silent cascades)
    transfers: {
        flowRates: {},              // [TRANSIENT CACHE] O->D demand throughput cache for "A-B" keys. Stripped during saves.
        lastCalculatedDay: -1       // Tracks the last recalculation loop to save performance
    },
    usedMarket: {
        listings: [],               // used aircraft for sale
        lastRefreshDay: 0,
        nextListingId: 1
    },
    banks: [],                      // connection banks
    nextBankId: 1,
    ai: {
        airlines: [],               // AI airline objects
        routes: [],                 // AI route objects
        difficulty: 0.5
    },
    reputation: 50,
    log: [],                        // event log (capped at 500)
    ui: {
        selectedPanel: "dashboard",
        mapCenter: { lat: 0, lon: 0 },
        mapZoom: 1
    }
}
```

### Route Object

```javascript
{
    id: 1,
    origin: "HYD",                  // IATA code
    destination: "LHR",             // IATA code
    distance: 7842,                 // km (Haversine)
    active: true,
    assignedAircraft: [],           // legacy, not actively used
    schedules: [1, 2],              // schedule IDs
    demand: 150,                    // pax/day
    baseFare: 580,                  // $ per pax
    createdDate: 360,               // totalMinutes
    slotCostPaid: 500000            // one-time fee paid
}
```

### `MAINTENANCE_RULES` constants
Exported from `data/aircraft.js`:
```javascript
{
    A: { threshold: 500, cost: 25000, durationMinutes: 720 },
    B: { threshold: 3000, cost: 150000, durationMinutes: 4320 },
    C: { threshold: 10000, cost: 750000, durationMinutes: 20160 }
}
```

### Aircraft Object (fleet item)

```javascript
{
    id: 1,
    type: "A321neo",
    ownership: "OWNED",             // OWNED | LEASED
    purchasePrice: 129000000,       // 0 if free (Sandbox starter)
    purchaseDate: 360,
    totalFlightHours: 0,
    status: "available",            // available | in_flight | maintenance
    registration: "XX-001",
    // Leased only:
    leaseCostPerMonth: 850000,
    leaseStartDate: 360,
    depositPaid: 2550000,
    // Used market purchases:
    usedAge: 5,                     // years (if bought used)
    condition: "Good",              // Good | Fair (if bought used)
    // Maintenance V1 tracking:
    hoursSinceACheck: 495,
    hoursSinceBCheck: 495,
    hoursSinceCCheck: 495,
    pendingCheckType: null,         // "A" | "B" | "C" (null if not due)
    graceHoursRemaining: 0,
    maintenanceReleaseTime: null
}
```

### Schedule Object

*(Note: Scheduler validation strictly checks full daily flight plans projecting ahead multiple legs across an aircraft's inherited schedule. It prevents wrap-around midnight schedule overlaps, strict turnaround limits, and global capacity limits.)*

```javascript
{
    id: 1,
    routeId: 1,
    aircraftId: 1,
    mode: "CUSTOM",                 // CUSTOM | BANKED
    bankId: null,
    departureTimes: [
        { hour: 8, minute: 0 },
        { hour: 16, minute: 30 }
    ],
    blockTimeMinutes: 620,
    active: true,
    createdDate: 360
}
```

### Flight Object (active or completed)

```javascript
{
    id: 1,
    routeId: 1,
    scheduleId: 1,
    aircraftId: 1,
    aircraftType: "A321neo",
    registration: "XX-001",
    origin: "HYD",
    destination: "LHR",
    departureTime: 840,             // totalMinutes
    arrivalTime: 1460,
    distance: 7842,
    passengers: 180,
    transferPassengers: 25,         // Portion of total passengers connecting via hub
    loadFactor: 0.82,
    revenue: 104400,
    cost: 85000,
    profit: 19400,
    status: "in_flight",            // in_flight | completed
    progress: 0.45,                 // 0-1
    delayMinutes: 0
}
```

### AI Airline Object

```javascript
{
    iata: "BA",
    name: "British Airways",
    hub: "LHR",
    color: "#002B5C",
    alliance: "Oneworld",
    fleetPreference: ["777-300ER", "A350-900", "A321neo"],
    routeCount: 15,
    region: "Europe"
}
```

### Daily P&L Record

```javascript
{
    dayLabel: "Y1 M1 W1 D1",
    totalMinutes: 360,
    flights: 12,
    passengers: 2400,
    revenue: 1200000,
    costs: 950000,
    profit: 250000,
    bestRoute: { route: "HYD→LHR", profit: 80000 },
    worstRoute: { route: "HYD→BOM", profit: -5000 },
    cashBalance: 499250000
}
```

## Module Dependency Map

```
main.js
├── ui/newGame.js ← data/airports.js, engine/state.js
├── engine/init.js ← engine/state.js, engine/aiEngine.js, engine/fleetManager.js, engine/sim.js
├── engine/sim.js ← engine/state.js, data/aircraft.js, data/airports.js, engine/routeEngine.js, engine/fleetManager.js, engine/aiEngine.js
├── ui/hud.js ← engine/state.js, engine/sim.js
├── ui/map.js ← engine/state.js, data/airports.js
├── ui/panels.js ← engine/state.js, data/aircraft.js, data/airports.js, engine/fleetManager.js, engine/routeEngine.js, engine/scheduler.js, engine/aiEngine.js, engine/sim.js, ui/hud.js, ui/map.js, ui/modals.js
├── ui/dailyPnl.js ← engine/state.js
└── data/aircraft.js (also exposed via window.__acRef for DEVMODE)
```

## Rendering Pipeline (Game Loop)

```
setInterval (speed-dependent: 50ms to 1000ms)
    → tick() in sim.js
        → state.clock.totalMinutes += 5
        → processDelayedFlights()     — retry delayed flights
        → processFlightDepartures()   — match schedules to current time, check slots, launch flights
        → processActiveFlights()      — update progress, complete arrivals, add revenue
        → processSlotUsage()          — clean expired slot hour entries
        → processDayEnd()             — if day rolled over: record daily P&L, check market refresh
        → processMonthEnd()           — if month rolled over: lease costs, AI expansion, monthly P&L
        → tickCallback()              — main.js onTick:
            → updateHUD()
            → renderMap() (every 3 ticks)
            → showPanel() refresh (every 10 ticks if on dashboard)
```

## Map Rendering Pipeline

```
renderMap() in map.js
    → clear canvas (#06091a)
    → drawGridLines() — lat/lon lines
    → drawContinents() — 14 polygon shapes filled #141e38
    → drawAIRoutes() — viewport culled, hub-distance sorted, capped at 50, 0.08 opacity
    → drawPlayerRoutes() — airline color, glow, offset for bidirectional pairs
    → drawAirports() — dots for routed airports, small dots for all at zoom ≥ 3
    → drawActiveFlights() — white/color dots along quadratic Bézier arc
    → drawHub() — glow ring + label
```

## Rules That Must Never Be Violated

1. **No direct DOM manipulation outside `ui/` files.** Engine files never touch the DOM.
2. **No state mutation outside `engine/` files.** UI files read state, call engine functions, then re-render. (Exception: `state.ui` for panel/map state.)
3. **Full file content on every edit.** When modifying a file, write the complete file. No partial diffs.
4. **No external libraries.** Everything is vanilla JS. No npm, no CDN imports.
5. **No build step.** All files are directly loadable by the browser via `<script type="module">`.
6. **Commit each task separately.** Each logical unit of work gets its own commit.
7. **DEVMODE must stay hidden.** Never reference it in user-facing UI or documentation.
