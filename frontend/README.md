# WAYPOINT frontend

A responsive operations demo for Waypoint. Includes Dispatcher, Store Manager, Loader, Driver, Entry & Account, Administration, and Recovery. All workspaces share one persistent local dataset. Working on a role? Start with [docs/ROLE_MODULES.md](docs/ROLE_MODULES.md).

Loader uses depot-scoped API reads, vehicle/trip deep links, structured shortfalls,
revision acknowledgment and reviewed loading photographs. Dispatcher review and
publication now generate every allocated manifest. See
[Loader implementation and backend handoff](docs/LOADER_IMPLEMENTATION.md) for
contracts, local-only persistence and remaining server dependencies.

## Run locally

Use Node.js 22.12+ (or a newer supported LTS) and npm.

```powershell
cd C:\Users\abdul\Waypoint\frontend
npm ci
npm run dev
```

Open the address printed by Vite. To review the production PWA:

```powershell
npm run build
npm run preview -- --port 4173
```

Open `http://127.0.0.1:4173`. Serve `dist` with a static host that rewrites application routes to `index.html`. Use HTTPS for deployed PWA service workers; localhost is supported during development. Never put a Figma personal access token in Vite environment variables or frontend code.

## Verification commands

```powershell
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

On this machine the downloaded test browser is inside the project. Use this before browser tests:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\abdul\Waypoint\frontend\.playwright'
```

If npm cannot write its default cache, set `$env:npm_config_cache` to the project's `.npm-cache` directory. Both local caches are ignored by Git. The lockfile is included; use `npm ci` for repeatable installs. Generated production files, test reports, and uploaded photographs are not committed.

## Walk through the shared workflow

1. Open `/workspaces` to select a role, and `/demo` for cutoff/offline/sync scenarios. Demo controls are separate from product layouts.
2. Dispatcher: Start allocation, review allocation, publish the plan.
3. Loader: reconcile rear/front quantities, complete safety checks, select a real loading photo, review it and confirm completion.
4. Dispatcher: refresh readiness and dispatch VEH055 Trip 1.
5. Driver: check the load, start the route, arrive, confirm quantities, select/review a photo, acknowledge the receiver and submit. Optional drawn signatures are saved with the evidence.
6. Offline proof stays pending after reload. Recovery retries or simulates acceptance. A route change requires review before acceptance.
7. Store Manager: view accepted driver evidence and separately confirm receipt or report missing/damaged quantities.

The featured live handoff is VEH055 Trip 1. `/demo/map` exposes the Leaflet adapter on its own.

## Reset and persistence

Open `/demo`, select **Reset demo**, then confirm the reset. Reset clears this browser's demo changes, photographs, queue, drafts, and audit history and restores seed data. It does not reset other devices or origins.

Dexie stores snapshots, image blobs, and queue entries in IndexedDB. Evidence, its queued action, and the business state change are saved in one transaction. Failed/reviewed records keep their original evidence. An interrupted syncing record becomes retryable on startup. Accepted records remain available in Recovery. Changing browser, hostname, port, or profile uses a different local database.

## Offline and browser limits

- The production PWA caches its application shell, route modules, fonts, and bundled assets after an online visit. Vite's development server is not the offline test target.
- Forms and evidence saves use the local repository even when offline. Sync runs through Recovery or once when the browser reconnects; acceptance is simulated locally.
- Leaflet uses attributed OpenStreetMap tiles online. Saved stops and route lines remain available offline; an offline basemap is not provided.
- Camera capture uses the browser's file input with `capture="environment"`. Mobile browsers may open a camera; desktop and unsupported browsers use file selection. Only JPEG, PNG, and WebP images up to 10 MB are accepted; HEIC requires conversion.
- Browser storage can be cleared or evicted, and private mode/storage restrictions may prevent persistence. This demo does not provide backups or guaranteed retention. Do not treat it as a production evidence store.
- Receiver acknowledgment records a name or exception and an optional drawn signature. Location/ETA, cutoff time, replacement decisions, notifications, invitations, and sync acceptance are explicitly local demo behavior.
- Workspace switching is not authentication or authorization. No invitations, operational notifications, dispatch messages, or backend API calls are sent. The development map uses external OpenStreetMap tiles.

## Project documentation

- `docs/ROLE_MODULES.md`: module ownership, adding screens, the data contract and backend integration.
- `docs/ROLE_GUIDES.md`: current state, definition of done, and the to-do list for each role.
- `docs/ARCHITECTURE.md`: layers, transactions, backend integration seams.
- `docs/FIGMA_DEAD_CODE.md`: the unrouted Figma renderer and how to delete it.
- `docs/SCREEN_COVERAGE.md`, `docs/figma/`: records from the Figma-rendered build (historical).
- `docs/REFERENCES.md`: Guide, Personas, and AI Disclosure reference pages.
- `docs/VERIFICATION.md`: verification scope and limitations.

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui with Radix controls, TanStack Query, Dexie, vite-plugin-pwa, Leaflet, Framer Motion, Vitest, and Playwright. DM Sans fonts are bundled locally. Each route is loaded as its own chunk; the production service worker precaches them for offline navigation. Product pages reflow at 760px and 1100px.
