# CLAUDE.md — Session Start Instructions

## Before Writing Any Code

1. **Read these files first, every session:**
   - `CONTEXT.md` — Project description, design rules, locked decisions
   - `ARCHITECTURE.md` — File tree, data structures, module dependencies, rendering pipeline
   - `PROGRESS.md` — Current status, what's done, known issues, test checklist

2. **Understand the codebase constraints:**
   - Vanilla JavaScript ES modules, no frameworks, no build step
   - No external dependencies except Leaflet.js for the map
   - GitHub Pages static hosting only
   - Full file content on every edit — no partial diffs, no placeholders, no "..." truncation
   - Commit each task separately

3. **Data flow rule:**
   - Only `engine/` files mutate `gameState`
   - Only `ui/` files touch the DOM
   - UI reads state via `getState()`, calls engine functions, then re-renders
   - Exception: `state.ui` (panel/map state) can be mutated by UI code

4. **DEVMODE is secret.** Never reference it in user-facing UI or documentation.

## Work Rules

- Read before writing. Understand the existing code before modifying it.
- No auto-assign, no auto-optimize, no "recommended" buttons. Player agency is sacred.
- Test each change mentally against the test checklist in PROGRESS.md.
- Keep commits atomic — one logical change per commit.
- Update PROGRESS.md as the final action of every session.
