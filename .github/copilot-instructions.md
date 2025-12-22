<!-- .github/copilot-instructions.md - guidance for AI coding agents working on IMD2 -->

# IMD2 — Copilot Instructions (concise)

Purpose: quickly orient an AI coding agent to the repository structure, runtime flow, key integration points, and local development commands so it can be productive immediately.

**Quick Start**
- **Install deps:** `npm install` (use project root `package.json`).
- **Run dev server:** `node server.js` — server binds to `0.0.0.0:3000` (important for external Unity connections).
- **Open app:** visit `http://localhost:3000` after starting the server. Use browser DevTools to view logs.

**Big-picture architecture**
- **Static front-end:** `public/` contains the client UI (HTML, CSS, JS, `assets/` SVGs). The Express app in `server.js` serves this folder via `express.static`.
- **Realtime bridge:** `server.js` runs a Socket.IO server. Clients emit `submit_flower` (from `public/script.js`) and the server rebroadcasts the payload as `to_unity`. Unity or other external consumers should connect to the same Socket.IO server and listen for `to_unity`.
- **Canvas & assets:** The UI uses Fabric.js (loaded in the client) to compose SVG pieces from `public/assets/*.svg`. The client colorizes, positions and serializes shapes before emitting.

**Key files to inspect or modify**
- `server.js` — Express + Socket.IO server and event mapping (`submit_flower` → `to_unity`). Keep `server.listen(3000, "0.0.0.0")` if Unity runs on another machine.
- `package.json` — dependencies: `express`, `cors`, `socket.io`.
- `public/script.js` — core client logic: `districtShapes` map, `colorizeSvgText`/`applyColorToSvg`, `generatePalette`, `addShapeAtPosition`, `sendFlower`. Most behavior is implemented here.
- `public/assets/` — SVG pieces referenced by `script.js` (loaded via `fabric.loadSVGFromURL`).
- `public/index.html` — entry page served by the server. Note: there is also a top-level `index.html` in repo root; the server serves `public/index.html`, so prefer editing files under `public/` when changing the running site.

**Project-specific conventions and patterns**
- **District-driven palettes:** `districtShapes` in `public/script.js` selects which SVG names to load for a given district code.
- **Drag/drop API:** palette buttons set `dataTransfer` JSON (`{ type, color, componentType }`) and the canvas `drop` handler reads that same JSON.
- **SVG color handling:** `colorizeSvgText` (string-level) and `applyColorToSvg` (fabric object-level) are both used to ensure fills/strokes get recolored. Prefer `applyColorToSvg` for runtime objects on the canvas.
- **Normalization:** `addShapeAtPosition` normalizes loaded SVG sizes to ~100px and animates scale. Changing sizing should be done in this function to avoid global layout regressions.
- **Single component type:** `assignComponentType` currently returns `"Flower"` for all pieces — changing this affects how pieces are serialized and may require server/Unity coordination.

**Integration notes & debugging tips**
- Socket events to watch: server logs `접속 ID:` when a client connects and `받은 꽃 데이터:` when a `submit_flower` arrives.
- Client-to-server payload example (see `sendFlower`): `socket.emit('submit_flower', flowerData)` where `flowerData` contains `userName`, `location`, and `shapes[]` with `type`, `color`, `x`, `y`, `scaleX`, `scaleY`, `rotation`, `layerOrder`, `componentType`.
- `public/script.js` includes `const SERVER_URL = "http://15.134.86.182:3000"` for production; for local development either change that to `http://localhost:3000` or replace the client socket call with `const socket = io();` so Socket.IO uses the same origin.
- To verify socket flow: start server, open browser console, drag/compose a flower and call `sendFlower()` or trigger UI; server console should show the received object.

**Safe edit recommendations**
- When editing client runtime behavior prefer touching `public/script.js` only; editing other files may not affect the served site because `public/` is what Express serves.
- Preserve `server.listen(..., "0.0.0.0")` if external clients (Unity) must access the server. If you must restrict to local-only development, change to `localhost` temporarily.
- When adding new SVG assets, place them under `public/assets/` and update `districtShapes` with the new filename (without path).

**What *not* to assume**
- The top-level `index.html` is not necessarily the running entrypoint — the server serves `public/index.html`. Always edit and test files in `public/` when validating changes via `node server.js`.

If any part is unclear or you want more detail (for example: Unity-side socket expectations, adding CI, or a migration of `SERVER_URL` to configs), tell me which area and I will expand the file accordingly.
