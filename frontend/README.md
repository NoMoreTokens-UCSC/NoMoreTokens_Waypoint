# WAYPOINT frontend

A responsive operations demo built from the Waypoint design reference. Includes Dispatcher, Store Manager, Loader, Driver, Entry & Account, Administration, and Recovery. All workspaces share one persistent local dataset.

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

The featured live handoff is VEH055 Trip 1. `/design` lists original source fixtures; `/demo/map` exposes the Leaflet adapter separately from the original Figma map compositions.

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

- `docs/ARCHITECTURE.md`: layers, transactions, backend integration seams.
- `docs/SCREEN_COVERAGE.md`: screen families, states, route coverage, and deliberate adaptations.
- `docs/figma/frame-index.md`: all 271 exported frame names and suggested screen families.
- `docs/figma/reference.json`: local REST-derived text, dimensions, and tokens.
- `docs/figma/SOURCE.md`: source provenance and how to refresh the copy through REST.
- `docs/REFERENCES.md`: Guide, Personas, and AI Disclosure reference pages.
- `docs/VERIFICATION.md`: verification scope and limitations.

## Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui with Radix controls, TanStack Query, Dexie, vite-plugin-pwa, Leaflet, Framer Motion, Vitest, and Playwright. DM Sans fonts are bundled locally. Screen modules and maps are loaded separately; the production service worker precaches them for offline navigation.

## Correction records and remaining acceptance

See `docs/figma/correction-status.md`, `inventory.json`, `pixel-comparisons.json`, `repaired-links.md` and `additional-flows.md`.

Node 438:154 is deferred at the user's request. Component hover/drag variants outside the page export and remaining screenshot differences require review. This is not a pixel-perfect completion claim. The production precache includes roughly 43 MB of source presentation data/assets; measure initial download and storage costs before deployment.

## Responsive correction reports

- [Issues, fixes and before/after images](docs/figma/responsive-issues.md)
- [Per-frame responsive coverage](docs/figma/responsive-coverage.md)
- [Verification record](docs/VERIFICATION.md)
- [Home alignment and motion](docs/figma/home-motion.md)

Product pages reflow at 768px and 1200px; pinned source frame URLs preserve their workflow step while selecting the current counterpart. `/design/:frameId` remains the fixed source inspector. `/demo/responsive/:frameId` is a development comparison scene, not product navigation.
