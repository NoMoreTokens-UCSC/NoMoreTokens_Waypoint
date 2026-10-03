# Driver implementation and verification

Driver uses 19 native React pages registered in `src/presentation/sections/driver/index.ts`.
All reads and writes go through the existing API contract and session. The feature reuses the
shared shell, controls, tokens, dialogs and breadcrumb system. It requests no Figma runtime JSON.

## Component structure

Paths below are relative to `src/presentation/sections/driver/`.

| Layer                    | Responsibility                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `atoms/DriverButton.tsx` | Shared Button with touch-sized height and wrapping labels, including dialog portals                                              |
| `molecules/`             | Router links, responsive action groups, photo input/validation and photo preview                                                 |
| `organisms/`             | Home overview, next-stop card, Leaflet route map, shared manager handoff, issue forms, route sequence/timeline and queue records |
| `templates/`             | Screen loading/error/retry presentation and stop, parking and draft guards                                                       |
| `pages/`                 | One lazy-loaded module per route, composing the journey and recovery screens                                                     |
| `hooks/`                 | API reads, evidence lookup, automatic sync, form state, durable proof transitions and object URL lifetime                        |
| `data/`                  | Explicitly illustrative navigation instructions                                                                                  |

Driver layout, spacing, typography, breakpoints and controls use Tailwind utilities with the
existing theme. There is no Driver stylesheet. The few important utilities bridge the shared
shell's existing unlayered CSS and Leaflet's third-party CSS. Mobile action groups stack below
761 px, route columns collapse below 901 px, and narrow forms remain capped at 760 px.
Mobile retains the shared header/menu; desktop retains the sidebar. The next-outlet ETA and task controls precede the map on phones. GPS/install support sits after the task content so it does not push the handoff off-screen.

## Shared map

`organisms/DriverRouteMap.tsx` lazy-loads `shared/organisms/OperationsMap.tsx`, the same
React Leaflet/Leaflet adapter used by Dispatcher tracking. No map dependency was added.
It receives all assigned stops and the session vehicle from `apis.fleet`, highlights the
selected stop, and provides functional zoom and route recentering. The shared
`RouteMapViewport` fits saved coordinates and responds to container resizing; ordinary query
refreshes preserve user zoom. Driver's explanatory caption sits below the map so it does not
cover OpenStreetMap attribution. Dispatcher retains its existing default presentation.

OpenStreetMap tiles are loaded online. Offline mode retains route lines and stop/vehicle
locations, with a visible basemap-unavailable message. Tiles are not prefetched or promised
for offline use. Lines connect the saved stop sequence; they are not road-routing results.
The vehicle initially has a labelled demo position. Starting location updates explicitly requests
browser GPS and replaces it with timestamped device coordinates and accuracy. GPS stays active across
Driver pages, stops on workspace exit or route completion, and persists the latest fix offline.
Remote position sharing and road-routing/traffic ETA require the backend. Navigation instructions
remain a labelled fixed demonstration.

## Route and state map

All paths have the `/driver` prefix. Stop links retain `?stop=<id>`. History links also retain
`&record=<id>` to show the original evidence even after that stop is retried.

| Path                        | Page                          | Behavior                                                                         |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| `/home`                     | `DriverHomePage`              | Assignment, load clearance, next outlet, saved records and trip completion       |
| `/pre-departure`            | `DriverPreDeparturePage`      | Loader checks, Dispatcher release and explicit vehicle check before starting     |
| `/route`                    | `DriverCurrentRoutePage`      | Next outlet, progress, saved route map and manifest links                        |
| `/route/details`            | `DriverRouteDetailsPage`      | Published stop sequence, order manifest and selected-stop handoff                |
| `/navigation`               | `DriverNavigationPage`        | Leaflet map, illustrative instructions and explicit parked confirmation          |
| `/arrival`                  | `DriverArrivalPage`           | Parked handoff and proof entry                                                   |
| `/delivery`                 | `DriverDeliveryPage`          | Resume captured/attached proof, current submission or accepted attempt           |
| `/proof/capture`            | `DriverProofCapturePage`      | Browser camera/file input and durable photo capture                              |
| `/proof/camera-unavailable` | `DriverCameraUnavailablePage` | Camera permission guidance and file-selection fallback                           |
| `/proof/review`             | `DriverProofReviewPage`       | Saved image preview, retake and attachment                                       |
| `/proof/attached`           | `DriverProofAttachedPage`     | Manager confirmation waiting state and on-device signed fallback                 |
| `/proof/submit`             | `DriverProofSubmitPage`       | Handoff summary and confirmation dialog                                          |
| `/sync`                     | `DriverSyncPage`              | Pending, uploading, interrupted, route review and accepted records               |
| `/delivered`                | `DriverDeliveredPage`         | Accepted proof and next-stop/trip-complete action                                |
| `/offline`                  | `DriverOfflinePage`           | Saved route, queued records and unfinished photo drafts                          |
| `/route/revision`           | `DriverRouteRevisionPage`     | Revised manifest review with original evidence retained                          |
| `/history`                  | `DriverRouteHistoryPage`      | Daily timestamped loading, departure, arrival, proof, delay and outcome timeline |
| `/sync/history`             | `DriverSyncHistoryPage`       | Saved delivery/attempt records and upload counts                                 |
| `/issues`                   | `DriverIssuePage`             | Delay, partial acceptance, unsuccessful attempts and explicit retry              |

## Flow guarantees

- Departure resolves the active Driver’s assigned truck instead of trusting the first load. It checks
  published allocations, reconciled case counts, all three Loader safety checks, loading proof, explicit
  Loader completion and Dispatcher release. The start control appears only when these checks pass;
  the Driver must also confirm the vehicle check. Unknown, unassigned or mismatched outlet/order IDs
  cannot be used for arrival or proof. A second arrival is blocked while another outlet’s handoff is open.
- Delivery proof navigation is disabled until an assigned outlet is marked Arrived, and remains available
  for pending proof. Related arrival/photo/review screens highlight the same navigation item. A compact
  progress indicator shows assigned outlet, arrival, proof/manager review and accepted delivery. Offline
  capture stays available after arrival; internet loss must not remove the offline handoff path.
- Arrival is the Driver’s explicit declaration of reaching the outlet and parking, not a GPS geofence.
  The frontend cannot authenticate physical presence or manager identity; those checks belong on the server.
- Captured/attached drafts live in IndexedDB. Retaking keeps the previous photo until its
  replacement is saved. Submission atomically saves evidence, queues it and removes the draft.
- Normal receiving confirmation is in `/store-manager/deliveries/confirm?stop=<id>`, linked from the
  manager’s Deliveries screen once the Driver attaches a photo after arrival. The manager reviews quantities,
  remarks and signature, then confirms receipt once. Driver’s attached-photo screen waits for that confirmation;
  it offers “Manager signs on this device” when the manager’s own screen or connection is unavailable. The
  signature form, pad and validation hook are shared. Signed completion removes the duplicate store receipt
  action. Legacy unsigned delivered orders retain their older receipt action.
- Delivery completion requires a Store Manager name, remarks, checked unloading quantities for every
  order, a nonblank e-signature, and matching accepted delivery evidence and queue entry. Quantity
  differences additionally require an exception. The signed handoff records receipt: full quantities
  become Confirmed, shortfalls become Issue reported. An unavailable manager requires an unsuccessful
  attempt and leaves the delivery open.
- The photo digest, signed order manifest, original route revision and handoff details are retained.
  Editing quantities, remarks, receiver or unloading confirmation clears the signature. Photo
  replacement and invalid signature metadata are rejected on submission and sync. These checks
  detect accidental stale evidence; they do not authenticate a manager or prevent a malicious client
  from editing local storage. Server validation and identity are required in production.
- Legacy unsigned proofs and proofs whose order manifest changed can be reopened with Add manager sign-off. An atomic transaction retains
  the original history/photo, marks the old queue entry superseded and restores an attached draft. A changed per-order
  quantity requires re-signing even if the total case count is unchanged.
  Superseded history is excluded from pending counts and does not block replacement proof.
- `useDriverAction` navigates only after a successful write and query refresh, preventing stale
  route guards from sending an attached photo back to review. The route card resumes the saved
  proof stage instead of opening a new capture flow.
- Pending proof resumes online. Failed uploads require explicit retry. A record needing route
  review does not hide retry controls for other pending/failed records. Revision review retains
  each record's original photo and capture revision.
- Accepted unsuccessful attempts must be reopened before another issue is recorded. History
  opens the original attempt's image and note even after a later successful delivery.
- Driver contacts are behind a Contact outlet manager button. The dialog provides only the active,
  assigned manager’s call/SMS links, returns focus on dismissal, and fits narrow and landscape screens.
  Contact is for delays, receiving access and offline coordination; it does not replace confirmation.
- The route shows ordered outlets and estimated arrival times. A Driver can enter a revised ETA with a delay
  or vehicle breakdown report. It is labelled Driver estimate, preserves the original ETA and receiving window,
  and triggers the existing late-window warning. It does not recalculate later stop ETAs or extend the 08:00 limit.
- “Delays & issues” covers delays, vehicle breakdowns, partial receipt and unsuccessful attempts. Reports
  retain the open delivery and an outlet alert/history entry. The Driver contacts dispatch and the manager if
  08:00 will be missed; dispatch decides replacement vehicles, rescheduling or cancellation. There is no
  automatic cancellation or completed delivery from an incident report.
- “Saved records & sync” replaces the Recovery label. It handles durable drafts, interrupted uploads and
  revised manifests. It is separate from roadside incidents and accessible from the offline banner.
- Route history persists timestamped events in `Snapshot.routeEvents`, scoped to the assigned truck and
  grouped by the Colombo route-start day. Loader and release events use their actual local day. Existing
  history is not fabricated. Device clock timestamps await authoritative backend event times.
- Delay notes survive reload without changing delivery status or removing an existing draft.
  Completing every stop shows Trip complete and no longer offers the final stop as next.
- Photo object URLs are allocated on subscription and revoked on cleanup, including React
  Strict Mode's development mount/cleanup/remount cycle. Unsynced drafts and submitted records
  retain the shared shell's sign-out protection.

## Verification

Use the pinned Node 22.23.3 runtime (`nvm use` in `frontend`). Checks include ESLint, the unit
suite, the TypeScript/production build, and Playwright with installed Chrome. Browser tests
start from a cleared Loader/Dispatcher handoff fixture; upstream planning/release behavior is
outside this Driver audit.

`e2e/driver.spec.ts` covers mobile/desktop delivery, offline refresh/reconnect, interrupted
upload/retry, revision review, camera fallback/retake, partial acceptance, attempts, delay
notes, guarded deep links, saved-draft resumption, historical evidence, map controls and full
trip completion. The Driver browser suites check layouts at 320, 360, 390, 834 and 1440 px, including 667 × 375 landscape, dialog focus/cancellation,
image loading and sign-out protection. Browser suites stub public tiles for determinism and
to avoid external coordinate requests. The live tile service is outside automated validation.

`e2e/routes.spec.ts` renders every registered Driver screen and the other roles at 390, 834
and 1440 px, checking runtime errors, missing screens and horizontal overflow. Production
builds retain the existing shared-bundle size warning.

## Completed checks

- ESLint and the TypeScript/Vite production build pass; 70 unit tests pass.
- The full 30-check Chrome run passed 29 checks; the remaining check still expected manager contact
  links inline. It was updated to open the new Contact dialog. All 10 affected browser checks pass on
  the final build after the mobile content ordering change, covering every current browser check across
  the runs. The three route smoke checks render all registered pages at 390, 834 and 1440 px. Driver
  interaction checks additionally cover 320/360 px and landscape. Three focused Vite development-server
  checks pass under React Strict Mode, including manager-side confirmation and re-signing after edits.
- Formatting passes for source, tests, configuration and the changed documentation; `git diff --check`
  passes. The global `npm run format:check` additionally reports 13 pre-existing generated Figma
  audit/reference files in `docs/figma`; those unrelated reference artifacts were left unchanged.
- The build retains the existing shared-bundle size warning. Browser verification uses mocked public
  map tiles, GPS and notification permission, and does not send real messages or request real GPS.

`e2e/driver-refinements.spec.ts` adds mobile navigation/progress and touch-target checks,
manager-side signed confirmation, revised breakdown ETA/daily history, and contact-dialog checks.
The same-browser local demo demonstrates the complete manager/Driver transition; it does not provide
cross-device data transfer without the backend.

## Requirement audit

| Requirement                    | Frontend implementation                                                                                                                                              | Backend dependency                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Update delivery outcomes       | Parked arrival, delay, partial delivery, unsuccessful attempt, signed completion and retry                                                                           | Authenticated status updates/acknowledgements                                           |
| Proof and manager verification | Photo + mandatory manager e-signature, remarks, per-order quantities and unloading confirmation; durable preview/history                                             | Manager identity, durable server evidence and validation                                |
| PWA / signal loss              | Install control, production service-worker cache, IndexedDB drafts/photos/signatures/outbox, reload/reconnect recovery                                               | Idempotent sync and storage retention                                                   |
| Live location                  | Explicit permission, GPS watcher across Driver pages, timestamp/accuracy/stale state, latest offline fix                                                             | Fleet realtime transport and location ingestion                                         |
| Store notifications            | Outlet inbox with acknowledgement; persistent departure/arrival/delay/issue/completion/deadline alerts; optional local system notifications and worker push receiver | Cross-device event delivery, Web Push subscription registration and SMS service         |
| Offline notification fallback  | Assigned-manager tel link and prefilled SMS composer; visible local delivery state                                                                                   | Cellular connectivity; automated SMS requires a server/provider                         |
| Fresh food by 08:00            | Fresh intake/allocation validation, window-end cap, Colombo clock, approaching/missed/late-ETA warnings and deduplicated alerts                                      | Authoritative operating date/time and routing ETA                                       |
| OTP or server-token QR         | E-signature implements the requested verification alternative. No insecure local OTP/QR is presented as valid.                                                       | Add authenticated, expiring, single-use tokens if another verification method is chosen |

Published legacy routes are never silently replanned. Late stops remain visible with warnings.
Updated seed plans schedule Fresh stops before 08:00. Normal development uses labelled demo
acknowledgements; no server has been added as requested.

## Backend handoff

Connect remote transports in `src/app/apis.ts`, keeping the presentation API contracts and local-first
repository/outbox behavior. A direct HTTP-only adapter must not replace durable offline saving:

- `DeliveryApi.listRouteHistory` returns persisted `RouteEvent` records (UUID, timestamp, route day,
  vehicle/trip/revision, event kind, outlet/stop and detail). Replace device times and the demo Trip 1
  assignment with authoritative daily route IDs and event timestamps; keep offline events durable.
- `DeliveryApi.reportDelay(stopId, note, revisedEta?, kind?)` retains delay/breakdown detail and an
  optional Driver estimate. Broadcast it to dispatch and the receiving outlet; route replanning and
  any cancellation approval remain server/dispatch responsibilities.
- `DeliveryApi.confirmManagerHandoff(outletId, stopId, proof)` uses the same signed proof payload
  as Driver fallback submission. The server must authenticate the manager, authorize their outlet,
  match the arrived delivery/photo/manifest revision, and atomically record receipt once. The frontend
  checks the demo outlet assignment; it is not a substitute for server authentication. Expose arrived
  deliveries and photos cross-device in the manager’s Deliveries screen.
- `DeliveryApi.saveProof`: photo, signature PNG and `ManagerSignOff` metadata include manager name,
  required remarks, received/expected quantity per order, unloading confirmation, normalized strokes,
  signed time, photo SHA-256, canonical handoff binding, and original capture revision. Upload both
  blobs and metadata durably. Verify assignments, manifest, revision, digest, identity and receipt
  on the server. Use the queued action UUID for idempotency. Only a real accepted acknowledgement
  may mark Delivered in production. Route review keeps the original evidence revision.
- `DriverSignalsApi.recordPosition`: vehicle ID, latitude, longitude, accuracy and recordedAt. The
  local adapter coalesces the latest fix per vehicle in `pendingPositions`; it never clears these
  as remotely delivered. Provide authenticated ingestion and fleet realtime reads. Browser GPS
  works while the page runs; tracking while closed/backgrounded needs platform support.
- `DriverSignalsApi.listNotices/acknowledgeNotice`: scope by authenticated outlet. Local notices
  remain `delivery: local`; future transports can report queued/sent. Provide departure/arrival,
  delay/outcome, fresh deadline and ETA events. The frontend worker accepts `{ id, title, message }`
  push payloads and opens `/store-manager/alerts`. Connect authenticated Web Push subscription
  registration and a server delivery service before enabling remote push. Optionally configure
  `VITE_WEB_PUSH_PUBLIC_KEY` (public VAPID key) to expose Prepare remote push subscription. The
  browser creates a subscription only after an explicit click; `registerPushSubscription` saves
  endpoint/keys locally in `pendingPushSubscriptions`. Replace this adapter with authenticated
  registration before release. The private VAPID key belongs only on the server.
- Provide an authoritative delivery date, timezone, clock, route revisions and real ETA. The current
  deadline display uses the device clock in Asia/Colombo and the active day's saved route.
  Arrival time is persisted; once at the outlet, the deadline is checked against that arrival
  rather than a later signature/upload time. Late arrivals remain visible after completion.
- `useSession` currently uses demo roles. Replace it with authenticated identity and authorized
  vehicle/outlet assignments. Local signature integrity checks are not manager authentication.

System alerts depend on browser permission and an active production service worker. The persisted
in-app inbox remains available when permission is denied. No automated call/SMS or remote event
has been sent. Tel/SMS links open the user's phone controls; they do not contact anyone automatically.
