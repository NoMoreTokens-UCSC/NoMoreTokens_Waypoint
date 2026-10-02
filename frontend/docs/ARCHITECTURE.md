# Architecture

## Dependencies and folders

| Layer          | Location             | Responsibility                                                                                                         |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Domain         | `src/domain`         | Typed orders, vehicles, trips, loads, stops, evidence, users and queued actions; pure rules; repository/sync contracts |
| Application    | `src/application`    | Allocation, deferral, publication, loading, departure, proof, sync recovery, store receipt and team workflows          |
| Infrastructure | `src/infrastructure` | Seed factory, Dexie tables/transactions and simulated sync gateway                                                     |
| Presentation   | `src/presentation`   | Role sections, forms, maps, shared UI, local query/mutation hooks                                                      |
| App            | `src/app`            | Routing, query providers, repository injection and startup                                                             |

Domain and application import no React, Dexie, Leaflet, or UI code. Infrastructure implements inward-facing domain ports. Presentation calls application workflows through injected services. Only app wiring chooses concrete adapters. Trips are derived from order allocations using `tripsFromOrders`, avoiding competing mutable allocation records.

## Atomic design

`presentation/shared/atoms` contains generated shadcn buttons, inputs, checkboxes, switches, badges, textareas, and dialogs. Molecules include labeled fields, capacity bars, search, notices, and metrics. Organisms include evidence capture/viewing, maps, and the demo panel. The workspace template supplies desktop/sidebar and compact mobile navigation. Role-specific pages and organisms stay within their section; shared behavior stays under shared.

The seven presentation sections are dispatcher, store-manager, loader, driver, entry-account, administration, and recovery. Contextual details, invitations, order review, receipt confirmation, workspace switching, and revised-route review are dialog states rather than additional URLs.

## Persistent shared state

`WaypointDatabase` holds `snapshots`, `evidence`, and `queue`. The persisted snapshot excludes queue entries; the repository composes a consistent view from the tables. Changes run in transactions. Saving a delivery or attempt inserts its photo blob, queue record, and stop state together; a failure rolls all three back. A route acknowledgment changes the queued action's effective revision while the original evidence revision remains immutable.

TanStack Query loads local state and controls mutations with `networkMode: always`. Dexie live queries invalidate shared snapshots after database changes; mutation completion also refreshes cross-workspace screens. Evidence blobs get object URLs with cleanup. UI errors report validation/storage failures without marking an operation successful.

Publication projects VEH055 Trip 1's manifest and stops from its actual allocations, replacing seed counts and preserving known outlet coordinates. The demo's Loader and Driver represent that featured operator; the 60-vehicle fleet is an overview dataset. New demo outlet coordinates are illustrative, not geocoded addresses.

## Workflow rules

- Allocation enforces cumulative volume/weight, chilled compatibility, demand brand, and trips 1–2.
- Publication requires closed intake, accounted demand, recorded deferral reasons, priority restoration and valid assignments. The Review screen exposes those checks.
- Loading requires every expected case, three safety checks, no unresolved shortfall, and a photo. Revised replacement instructions invalidate old completion and require fresh checks/photo.
- Release additionally requires publication and loading completion.
- Driver proof validates quantity, receiver acknowledgment/exception, photo type/size, and duplicate pending records. Saving makes the stop Proof pending.
- Simulated acceptance makes delivery Delivered. Attempt acceptance preserves Cannot deliver. Route changes require review; retry retains the photo.
- Store receipt confirmation/reporting is independent and requires accepted delivery proof.
- An active driver's immediate suspension is blocked. Scheduled suspension applies after the trip completes.

## Backend integration seams

| Seam                   | Production work                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `OperationsRepository` | Replace seeded snapshot access with authenticated queries/commands; keep local evidence/outbox persistence where required           |
| `SyncGateway`          | Upload images and submit an idempotent evidence command; validate server revisions; translate acceptance, retry and review outcomes |
| Queue action UUID      | Use as idempotency key; persist confirmed server acknowledgments before advancing local delivery                                    |
| Auth/role wiring       | Add real sign-in, access enforcement and per-user/workspace data partitioning; current role switching grants no security            |
| Allocation/publication | Validate concurrency and capacity on server, generate manifests for all assigned operators, persist immutable published revisions   |
| Cutoff/time            | Replace scenario switch/fixed sample date with authoritative timezone-aware business deadlines                                      |
| Maps/telemetry         | Add GPS, geocoding, ETA/routing service and stale-location rules; current coordinates are seeded                                    |
| Team/notifications     | Replace local invitations/status/audit changes with audited server APIs and real notification delivery                              |
| Proof retention        | Define upload retry/backoff, storage quotas, backup/retention and permissions; browser IndexedDB alone is insufficient              |
| Analytics              | Add historical aggregates and forecasting; current charts derive from a single local run                                            |

No backend URL, secret, real authentication, or production permissions are embedded in the frontend. The Figma REST exporter is a separate local tool and never bundled into the browser.

## Source presentation renderer

`presentation/design` holds typed frame, layer, asset and transition manifests. `DesignFrameView` renders native text, surfaces, controls and original static assets; screen PNGs are never used as UI. Section controllers bind these elements to application use cases. `SourceOverlay` supplies focus trapping and keyboard dismissal without extra visible controls. Explicit Loader counterparts are in `presentationManifest.ts`.

Source fixtures at `/design/:frameId` are comparison views. Live routes bind changing local data. A rendered fixture does not mean every prototype action has passed a workflow test. The legacy workspace template remains for the deferred revised-route review simulation.

## Responsive product presentation

Product routes use `ProductFrameView`, separate from the fixed `/design/:frameId` inspector. `responsiveLayout.ts` derives flex flow from the exported layout metadata and applies explicit rules for workspace shells, card grids, forms, readable tables, map annotations and dialogs. It preserves asset dimensions instead of scaling the whole scene. Sources without counterparts use adjacent responsive patterns.

`presentationManifest.ts` holds screen families and resolves pinned frame IDs to the current responsive counterpart. Breakpoints are below 768px, 768–1199px, and 1200px upward. Controllers own edits, photographs, selected records and workflow state; viewport changes do not remount controllers or update the database.

`SourceOverlay` separates source content panels from full scene canvases. It provides trigger-relative menus, edge drawers, centered dialogs, focus trapping, Escape/outside dismissal, focus restoration, scroll locking and viewport-constrained internal scrolling.

`/demo/responsive/:frameId` exposes deterministic product layout fixtures. Add `?overlay=1` to inspect overlay content with its real dialog geometry. These fixtures do not run domain workflows. Full-inventory geometry reports and live browser workflow tests serve different purposes.

`presentation/design/motion.tsx` supplies Framer Motion reveals for the live Welcome controller and popup panels. It changes opacity and local translation only, adds no layout wrappers to home sections, and honors reduced-motion preferences. Source overlays animate an inner content wrapper so centering, anchoring and focus management remain independent. Domain and application workflows have no animation dependencies.
