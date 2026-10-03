# Role guides

What each role developer needs to do so their pages are robust, match the design, and can be switched to
a backend without being rewritten. Read [ROLE_MODULES.md](ROLE_MODULES.md) first for how modules,
routes and the shared shell work.

## Where things stand

| Area                                                   | State                                                                                                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing, module registry, shared shell                 | Done. Every route opens a native page.                                                                                                                                                                         |
| Entry pages (welcome, how it works, login, workspaces) | Done, rebuilt from the Figma frames. Login is a demo (any filled-in credentials).                                                                                                                              |
| Data contract `src/domain/api` + local adapter         | Done and unit-tested.                                                                                                                                                                                          |
| Role pages                                             | Work, but are the first native drafts: they do not match Figma and use the old data access.                                                                                                                    |
| Pages using `useApis()`                                | **Driver pages use the API contract.** Loader reads/writes now use the API boundary. Dispatcher review, publication, issue resolution and release writes also use APIs. Other role pages still need migration. |
| Full order-to-receipt flow in the browser              | Dispatcher publication is unblocked. The native Loader-to-release flow has dedicated browser coverage, and Driver route execution can proceed after release.                                                   |
| End-to-end workflow tests                              | Native Driver journeys (including recovery/map/layout checks), route smoke tests, the entry walkthrough, and native Loader workflow specs. Legacy Figma specs remain skipped.                                  |

## Definition of done for any page

A page is done when all of these hold. Reviewers check this list.

**Data and backend readiness**

- [ ] Reads use `useApiQuery(key, (apis) => ...)`; writes use `useAction().run(() => apis.<area>.<method>(...), 'Message')`.
- [ ] No `useOperations()`, `useServices()` or `service.repository` in the page. Lint already blocks
      importing `src/infrastructure`.
- [ ] No filtering of the whole dataset in the page (`data.orders.filter(o => o.outlet === ...)`). Ask
      the API for what the screen needs (`apis.orders.listOrders({ outletId })`). A server will only
      send the user's slice.
- [ ] Missing API method? Add it to the interface in `src/domain/api`, implement it in
      `src/infrastructure/local/localApis.ts`, add a test in `localApis.test.ts`, and push that as its own
      small shared commit. Tell the backend developers: every method is an endpoint they must build.
- [ ] Business rules (cutoff, capacity, refrigeration, case limits) stay in `src/domain` /
      `src/application`. The page may pre-check for a better message, but the rule must also be enforced
      behind the API, because a server will be the authority.

**Identity and hardcoding**

- [ ] Who and where come from `useSession()` (`outletId`, `vehicleId`, `depot`, `name`), never literals
      such as `'OUT001'`, `'VEH055'`, `'STOP001'`, `'USR001'`.
- [ ] No `loads[0]`, `stops[0]` or "the demo vehicle". Select the record from the session or the URL.
- [ ] No fixed dates or clock times in copy ("Saturday, 26 September", "15:42", "ETA 05:40"). Show
      values from the data and format them with `formatTime` (`shared/lib/utils`).
- [ ] Records that deserve a link get a route parameter (e.g. `/store-manager/deliveries/:orderId`) so
      a page can be refreshed or shared. Route paths in your `index.ts` may use `:params`.
      Detail pages set their breadcrumb with `useBreadcrumb` (see ROLE_MODULES.md).

**States**

- [ ] Loading, empty, error and offline states are designed, not left blank (`EmptyState`, `Notice`).
- [ ] Every write shows success or a clear error (`useAction` toasts the error message from the rules).
- [ ] Buttons are disabled while a write is pending and when the action is not allowed, with a reason
      nearby.
- [ ] Offline: anything a field role does away from a connection is saved locally and synced later
      (see Driver, which already does this). Never show work as "done" before the server accepted it.

**Layout and quality**

- [ ] Matches the Figma screens for desktop (1440), tablet (834) and mobile (390). Loader and driver
      are judged on phones.
- [ ] No horizontal scrolling at 390 px. Touch targets at least 44 px.
- [ ] Uses the shared UI kit (`shared/molecules/Common.tsx`, `shared/atoms`, `shared/organisms`).
      Role-specific styles go in a CSS file inside your module (see `sections/entry-account/entry.css`),
      not in the shared `styles.css`.
- [ ] Labels for every input, headings in order, dialogs from the shared `Modal`.
- [ ] An e2e spec for the role's main flow in `e2e/<role>.spec.ts`; new routes added to
      `e2e/routes.spec.ts`.
- [ ] `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e` pass.

## Viewing the original Figma screens

The design reference is the Figma file. The store manager screens are also exported as images. To see
any role's screens as they were rendered before the switch to native pages, run the last Figma build in
a separate folder (it does not touch your branch):

```powershell
git worktree add ..\waypoint-figma 37b6fea
cd ..\waypoint-figma\frontend
npm ci; npm run build; npm run preview -- --port 4174
```

Open `http://127.0.0.1:4174/design` for the list of every frame. `docs/figma/frame-index.md` maps frame
IDs to screens. Remove the folder afterwards with `git worktree remove ..\waypoint-figma`.

---

## Dispatcher

**Pages** (`sections/dispatcher/pages`): `OrderQueuePage.tsx` (orders), `PlanningPages.tsx`
(`AllocationPage`, `DeferralsPage`, `ReviewPage`, `ReleasePage`), `FleetPages.tsx` (`FleetPage` for fleet
and live tracking, `AnalyticsPage`). Organisms: `OrderTable`, `PlanningSteps`.

**API to use:** `apis.planning` (`getPlan`, `allocate`, `unallocate`, `autoAllocate`, `defer`,
`reviewAllocation`, `publish`, `release`), `apis.orders.listOrders`, `apis.fleet`, `apis.loading.listLoads`
(release readiness), `apis.delivery.listStops` (tracking).

**Fix first**

1. **Publication prerequisite completed.** `ReviewPage` now requires explicit
   `apis.planning.reviewAllocation()` before publication. Publication generates all allocated
   vehicle/trip manifests. Remaining Dispatcher data-access migration is separate work.
2. `OrderQueuePage` refreshes with `service.repository.getSnapshot()`. Use a query refetch instead.

**Then**

- `PlanningPages` defaults to `'VEH055'` and mentions `OUT001`/`OUT008`; pick vehicles from
  `apis.fleet.listVehicles()` and the plan.
- Remove fixed "16:00", "15:42" and date strings; show cutoff state from `apis.orders.getIntakeStatus()`.
- `unallocate` exists in the API but no page offers it (Figma: "Undo assignment").
- Show why an allocation is blocked (Figma: Volume / Weight / Temperature blocked, Two-trip limit) using
  the messages the rules return.
- Deferrals must record a reason and protect outlets skipped on the previous run (Figma: Priority
  restored, Explain deferrals). The booklet scores this.
- Live tracking states from Figma: Delivery window delay, Vehicle offline.
- Analytics / Capacity outlook needs forecast data that no API provides yet: propose an `AnalyticsApi`.
- Release now selects a vehicle/trip using `?loadId=...`; its reads still need API migration.

**Figma:** 59 frames (order queue and sorting, planning & allocation, deferrals, review & publish,
release, fleet filters and drawers, live map, capacity outlook).

## Store manager

**Status: built to the Figma frames** (all 18 desktop states, plus tablet and phone). It is the worked
example for the other roles: copy its structure, not its content.

**Where things are** (`sections/store-manager`):

| Folder        | Contains                                                                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/`      | one file per screen: overview, orders (history), order detail, create orders (and cutoff passed), review, confirmed, draft saved, tracking, receipt, receipt confirmed, issue, issue submitted, alerts                                                     |
| `components/` | `StoreKit` (page, callout, pill, tile, buttons, field), `StoreIcons`, `RouteMap`, `ProofPhoto`                                                                                                                                                             |
| `lib/`        | `orderView` (labels, windows, status), `orderForm` (form state that survives navigation), `useStore` (outlet-scoped data), `useStoreAction` (do work, wait for refresh, then navigate), `useProof`, `receiptRoutes`, `receiptIssue` (validation), `cutoff` |
| `store.css`   | all styles, prefixed `sm-`, with desktop / tablet / phone rules                                                                                                                                                                                            |
| `assets/`     | the route map artwork and the delivery-photo placeholder, copied from the design                                                                                                                                                                           |

**Patterns worth copying**

- `'OUT001'` appears 8 times and the map filters `'VEH055'`: use `useSession().outletId` and the stop's
  vehicle.
- Use `placeOrders` (chilled and dry confirmed together, as Figma "Create separate orders → Review →
  Orders confirmed"), not one `createOrder` per record.
- Use `saveDrafts` for "Cutoff passed → Draft saved for next run".
- Use `reportReceiptIssue({ kind, received, affected, description })` for missing/damaged reports
  (Figma: "Report missing items", "Report damaged items"). The page currently sends free text through
  `confirmReceipt`, which loses the counts.
- ETA "05:40" and window "05:30–07:30" are fixed text: read them from the stop.
- Fresh window options now stop before 08:00, and intake/allocation validation enforces that deadline.
  The backend should provide the outlet receiving window and authoritative delivery date.
- Deferral notice needs the acknowledgment gate (Figma: "Acknowledgment required" → "selected" →
  "acknowledged").
- Offline: signed manager handoffs use the delivery evidence outbox. Other order/legacy-receipt writes are local snapshot changes and still need remote transport. Agree that transport with
  the backend developers (same pattern as driver proof).
- Note: the local adapter accepts outlet `OUT001` only, because the seed data models one store.

- Data only through `useApis()` and outlet-scoped hooks; an empty outlet requests nothing (an empty
  filter would return every outlet's orders).
- `useStoreAction().runThen(work, next)`: waits for every screen's data to refresh before navigating.
  Without it the next screen briefly sees stale data and its guard sends the person away.
- Result screens are guarded so a finished receipt always lands on its result (`receiptRoutes`).
- Breadcrumbs: route `title` in `index.ts`; detail pages override with `useBreadcrumb`.
- Shell options in `index.ts` (`shell: { compactBelow: 1200, compactNav: 'menu', ... }`), custom nav icons
  (`renderIcon`), header search scoped to the outlet, header bell count from unacknowledged deferrals.
- Event times (`placedAt`, `scheduledAt`, `departedAt`, `deliveredAt`, `deferredAt`,
  `deferralAcknowledgedAt`, `receiptAt`) and `windowEnd` are optional fields on `Order`, set by the
  workflow; the backend must supply them. Dates come from `domain/calendar` (Sri Lanka time, Mon-Sat).
- Tests: `e2e/store-manager.spec.ts` covers ordering, cutoff, deferral, tracking, receipt and issues.
  Later delivery states are loaded with the **Store orders** control in the demo panel (`/demo`), because
  the dispatcher, loader and driver steps are other roles' work. It sets sample states (scheduled, en
  route, delivered, receipt confirmed, issue reported) for the store's orders only; **Reset demo**
  restores everything. The states live in `application/storeDemoStates.ts`.

**Checked against the challenge booklet**

| Booklet says                                                                      | In the store module                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Place and confirm the order before the 4 PM cutoff; later orders wait (l.90, 214) | Cutoff countdown, cutoff-passed screen, draft for the next run                                               |
| Fresh orders dry every operating day, chilled on several days a week (l.88)       | Each order has an Ordering switch; a dry-only day is one order (the service accepts one or two)              |
| Fresh must arrive before the stores open at 08:00 (l.62, 136)                     | The window picker offers only valid times: start 4-7 AM, end by 8 AM, at least an hour (`lib/windows.ts`)    |
| Stores place orders by phone with no confirmation (l.188)                         | Order references and a status on every order (awaiting allocation, scheduled, en route, delivered, deferred) |
| Needs an expected arrival time to staff the dock (l.194)                          | Planned/expected arrival, receiving window and "Ready by" on tracking                                        |
| Clear notice of a deferral (l.196)                                                | Alert with reason, next run and an acknowledgment step; bell count                                           |
| Confirm receipt and report issues (l.196, 219)                                    | Confirm receipt, missing/damaged report with counts, issue reference                                         |
| Work away from the depot must remain usable offline (l.154)                       | Orders are saved on the device and an offline notice says what that means; the map keeps the route offline   |

Making ordering friendlier: cases use a stepper, and weight and volume follow the number of cases
(`estimateLoad`) until they are edited; windows are chosen from From/To lists in 12-hour form (AM/PM), never typed.

**Still to do**

- Offline sending: changes made offline (confirming orders, confirming receipt, reporting an issue,
  acknowledging a deferral) go into an outbox on the device (`lib/outbox.ts`, localStorage) and show as
  "Waiting to send"; the screens treat them as made (`applyOutbox`). `components/SyncStatus.tsx`
  sends them in order through the same `OrdersApi` calls when the connection returns (`lib/outboxSend.ts`),
  reports failures with Try again / Dismiss, and keeps an order that arrives after the cutoff as a draft.
  With a backend, nothing here changes except that the API calls reach a server; a server-side
  idempotency key per outbox item (`OutboxItem.id`) is advisable so a retry cannot place an order twice.
- Style and Tech outlets: `useStoreProfile()` (in `lib/useStore.ts`) reads the outlet's brand, schedule
  and receiving limits (`domain/outlets.ts`, `OrdersApi.getOutletProfile`; a backend serves them from
  `outlets.csv`: brand, `parking_constraint`, `mall_window`). A Style or Tech outlet gets
  `pages/BrandOrderPage.tsx` instead of the Fresh form: one order (Style weekly, in cartons, inside the
  mall's access window; Tech as needed, in items, with an inspect-and-sign confirmation). Weight and
  volume are estimated per unit. Open the workspace as another outlet with the demo panel's "Store
  manager signed in as". After the cutoff a Style or Tech
  order is kept as a draft (drafts are scoped by outlet). The "Store orders" demo control and the issue
  form follow the signed-in outlet (cartons, items). A Tech outlet can have
  several orders for a delivery: confirming adds a new order, or changes one picked from the list
  (`StoreOrderInput.orderId`, `?order=` on the create page); Style has one weekly order, which a new
  confirmation replaces. Not built: the dispatcher and loader screens treating mall windows.
- Selecting the vehicle on the tracking map opens a small panel at the map's top right with its kind
  (`FleetApi.getVehicle`: van or truck, refrigerated or not), the driver's name (from the team list), the
  trip, the depot and the planned or expected arrival (`components/VehiclePanel.tsx`). Phone numbers and
  live telemetry are left out on purpose; the vehicle's position is still an illustration.
- Confirming again replaces the outlet's live order (Fresh: per kind; Style: the weekly order). Every
  create form, the review and the Style form say so with a "Replaces ORD…" tag showing what the order is
  now (`ReplaceNotice`); a Tech outlet sees "Changing ORD…" when editing one order or "New order" when
  adding another.
- An order the dispatcher has already allocated (status `Allocated`, plan not yet published) shows an
  "Already planned" tag on the create form, the review, the order detail and the cancel confirmation:
  changing or cancelling it is allowed until the cutoff, but it goes back to be planned again. The vehicle
  stays hidden from the store. The demo panel's "Planned by the dispatcher" state shows it.
- Cancelling: a waiting order can be cancelled from its detail page until the cutoff
  (`OrdersApi.cancelOrder`, also queued offline); after that it is locked. The order leaves the live
  list and is kept in the history with `cancelledAt`, shown as "Cancelled" (filter and detail page).
- Late arrival: a dispatched order whose stop `eta` is after the window end shows "Running late" on
  the overview, tracking, order detail and notifications, and counts on the bell (`lib/lateness.ts`). The
  demo panel's "En route · running late" state shows it. A backend can also send a lateness probability.
- Orders (`/store-manager/orders`, with search, filters and paging) and Order detail
  (`/orders/:orderId`) are not in the Figma frames; they follow the same look. The create form is at
  `/store-manager/orders/new`. Past orders come from `OrdersApi.listHistory({ outletId })`
  (`Snapshot.orderHistory`, demo data in `infrastructure/demo/orderHistory.ts`); the backend must return
  earlier orders with `deliveryDate` and their event times, and should page and search on the server.
- The store has its own Notifications (`/store-manager/notifications`: what needs action, running-late
  deliveries, issues reported and where they stand, and an activity feed built from each order's event
  times in `lib/notifications.ts`), Profile and Preferences. On the profile the manager edits their own
  name, phone and email (`TeamApi.updateContact`, queued offline like other changes); role, outlet and
  depot are read-only and changed by asking an administrator (`TeamApi.requestAccountChange`). A role points the shell's bell and account
  menu at its own pages with `shell.accountPaths` in `index.ts`; the shared `/account/*` pages stay for
  roles that do not. A backend can serve the feed from a notifications endpoint, and issue outcomes from
  the issue record: today every reported issue reads "Open · Awaiting review" because nothing resolves
  them yet.
- "Repeat last order" on the Fresh create form copies the most recent earlier day's quantities and
  windows (`lastOrders` in `lib/orderList.ts`). Not built: the dispatcher, loader and driver screens
  acting specially on the store's cancellations, mall windows and Style/Tech orders.
- The business clock is fixed on Friday 25 September, 15:42 (`session/useBusinessClock`); with a backend
  it returns server time and the real cutoff.
- The route map is a real Leaflet map (OpenStreetMap tiles, muted to the design's grey) showing this
  outlet, its depot and the vehicle. There is no telemetry yet, so the vehicle is drawn on the route as
  an illustration while en route; "Refresh" only reloads data. Live position, ETA updates and "minutes
  away" need telemetry from the backend.
- The local adapter accepts outlet `OUT001` only for writes (the seed models one store).
- Compare against Figma again after the dispatcher publish bug is fixed, using real flow data.

## Loader

Implemented native workflow and backend handoff: [LOADER_IMPLEMENTATION.md](LOADER_IMPLEMENTATION.md).
The checklist below is retained as the design acceptance reference; ID selection, data access,
shortfall/revision handling and photo recovery are implemented. Real backend synchronization,
authorization and cross-device handoff remain external dependencies.

**Pages** (`sections/loader/pages/LoaderPages.tsx`): `LoaderQueuePage` (shift dashboard),
`LoaderWorkspacePage` (load workspace and, with `proofOnly`, loading proof).

**API to use:** `apis.loading` (`listLoads`, `getLoad`, `setLoaded`, `setCheck`, `reportIssue`,
`resolveIssue`, `attachPhoto`, `complete`), `apis.delivery.listStops` (stop sequence).

**Change**

- The workspace always uses `loads[0]` (the VEH055 demo load). Choose the load from the shift queue and
  put its ID in the URL (e.g. `/loader/loading/:loadId`).
- Remove fixed "VEH055", "Peliyagoda", "05:00" copy; use the load, depot (`useSession().depot`) and data.
- Loading order follows the stop sequence in reverse (last stop loaded first). Keep it data-driven.
- Revisions: when the dispatcher changes a load, earlier checks and the photo are invalidated (the
  rules already do this). Show the "Review changed instructions" flow from Figma.
- Shortfalls must be reportable before departure (missing / damaged item, "Load held", "Dispatcher
  decision").
- Camera: "Camera access needed", "Camera unavailable" and "No camera handoff" states from Figma.
- Judged on phones and shared tablets: design for 390 px and 834 px first.

**Figma:** 64 frames (shift dashboard, loading sequence, case counts, safety checks, shortfall reports,
held loads, revisions 03/04, photo capture and review, loading complete).

## Driver

Driver is implemented as 19 separate routed pages in `sections/driver/pages/`, with atoms, molecules,
organisms, templates and hooks in the same feature. Layout uses Tailwind and existing tokens. See [DRIVER_IMPLEMENTATION.md](DRIVER_IMPLEMENTATION.md) for
the route map, state model, complete file inventory, validation and mock integration limits.

Reads and writes use the delivery, loading, orders, fleet and account APIs and the existing session.
Driver reuses the Dispatcher React Leaflet map with assigned stops, zoom, recentering and offline
location overlays. Fixed navigation instructions remain explicitly illustrative. Stop
links retain `?stop=<id>`. Captured and attached photo drafts are durable. Confirmed submission replaces
the draft with queued proof atomically. Only matching accepted delivery evidence and acknowledgement
can show Delivered. Manager remarks, per-order quantities, unloading confirmation and a mandatory
e-signature record the store receipt; edits require re-signing and shortfalls record an issue.

The feature includes load check, manifest, illustrative navigation, parked arrival, camera recovery,
review/retake, per-order quantities, manager remarks/signature, explicit submission, offline records, interrupted upload,
revision review, history, issue/attempt retry and unfinished-draft sign-out protection. Pending proof
resumes online; failed proof requires an explicit retry. Mobile uses the existing header/menu without
bottom tabs; desktop uses the existing sidebar.

**Backend integration:** `DeliveryApi` includes durable drafts, signed proof metadata and legacy-proof
recovery. `DriverSignalsApi` exposes timestamped GPS fixes, the outlet alert inbox and deadline checks.
GPS is opt-in and offline fixes persist. Calls/SMS are manual phone fallbacks. Provide authenticated
proof upload, realtime positions, authoritative ETA/date, and remote push/SMS event delivery. The
current gateway and alert transport remain explicitly local; see the Driver report for payloads.

## Administration

**Status: built to the Figma frames** (desktop and phone): Team & access, Add user, Invite sent, User
detail, Suspend blocked, Roles & access and Audit log. Assignments has no frame; it follows the same
look. The old renderer file `pages/FigmaAdminPage.tsx` is dead code and the first native version
(`AdminPages.tsx`) was removed.

**Where things are** (`sections/administration`): `pages/` (one file per screen: `TeamPage`,
`AddUserPage`, `InvitedPage`, `UserDetailPage` with its role, reset and suspend dialogs, `RolesPage`,
`AssignmentsPage`, `AuditPage`), `components/AdminKit.tsx` (page, intro, card, pill, buttons, field),
`lib/team.ts` (role order and labels, the capability matrix, the "will / will not" lists, data hooks,
`useCompactLayout`), `admin.css` (styles prefixed `ad-`, desktop table and phone cards).

**API used:** `apis.team` (`listMembers`, `getSummary`, `listActivity`, `listAudit`, `createUser`,
`resetAccess`, `updateRole`, `changeAssignment`, `reassignTrip`, `suspend`), `apis.fleet.listVehicles` for
the free vehicles and `apis.delivery` for the driver's stops and unsynced records.

**Behaviour worth knowing**

- Totals come from `getSummary` (48 people, 41 active, 5 invited, 2 suspended; 214 audit events): the
  list shows the people the demo holds, the totals include the rest. A backend returns real counts and
  pages the list and the log on the server.
- Add user: pick the role, the form adapts (vehicle for a driver, dock bay for a loader, outlet for a
  store manager). On a phone it is two steps. The administrator also sets a **username** (suggested from
  the name, unique) and a **temporary password** (generated, or typed: 8+ characters with letters and
  numbers). `createUser` creates the account as "Invited"; the next screen shows the username and
  password once, with copy buttons, for the administrator to give to the person **outside this system**.
  Nothing is sent. The password is never stored by the demo (not in the team record, the audit log or
  the browser data) and is wiped from the browser history, so a reload does not bring it back. A backend
  should hash it, flag it for change at first sign-in, and return nothing but success.
- Reset access works the same way: a new temporary password is generated (or typed) and shown once to
  hand over. The login page still accepts any credentials in the demo.
- Suspending a driver who is on route is blocked: reassign the trip, schedule the suspension after the
  trip, or suspend now with a reason (the dispatcher is alerted). `suspend(memberId, scheduled?,
reason?)` enforces this behind the API. The demo panel's "Driver on route" switch shows it.
- Audit log: search, filter by action and time, and Export CSV of what is shown.
- Outlets (`/administration/outlets`): every store in the system with its brand, district, depot,
  delivery window, access (any vehicle, vans only, mall window) and store manager. **Add outlet**
  (`OutletsApi.createOutlet`) takes the brand, name, district, depot, access and the delivery hours; the
  system assigns the next id (OUT058 and so on) and builds the outlet's receiving limits from what was
  entered. The store module reads the same list (`OrdersApi.getOutletProfile`), so a new outlet can order
  straight away and can be opened from the demo panel's "Store manager signed in as". The demo seeds the
  outlets the sample orders mention; a backend serves `outlets.csv`. Not built: editing or retiring an
  outlet.
- Vehicles (`/administration/vehicles`): the fleet with brand, type (dry-box or refrigerated truck, van or
  refrigerated van), depot, capacity, status and driver; search plus brand, type and depot filters.
  **Add vehicle** (`FleetApi.createVehicle`) takes the brand, type and refrigeration, depot, weight and volume
  capacity (defaults: van 800 kg / 4 m³, truck 2,400 kg / 12 m³) and an optional registration; the system
  assigns the next id after the highest (VEH088 here, as the sample fleet runs to VEH087) and the vehicle is
  Available at its depot, so the dispatcher can allocate to it at once. Only a Fresh vehicle can be
  refrigerated. The sample fleet has no depot field, so `vehicleDepot()` (in `domain/fleet.ts`) reads a
  Kandy location as the Kandy depot and everything else as Peliyagoda; the driver forms list only unassigned
  vehicles of the chosen depot. A vehicle's page has an **Add driver** shortcut that starts the form on that
  vehicle. Not built: editing, retiring or taking a vehicle offline.
- Add user for a **store manager** picks the outlet from this list (only outlets without a manager), and the
  depot follows the outlet. An outlet's page has an **Add store manager** shortcut that starts the form on
  that outlet. `createUser` refuses an unknown outlet or one that already has a manager.
- Roles & access is a fixed reference table in `lib/team.ts`; real permissions are enforced by the
  backend.
- Dialogs close after their action, so toasts are shown from inside the action (a message passed to
  `useAction().run` is lost when the component that called it unmounts).

**Not built:** per-person offline-sync detail beyond the count, bulk invite, and server-side paging.

## Shared: entry, account, recovery

Owned by the team; change in small commits and announce.

- **Profile shows the driver for every role.** `ProfilePage` reads one global `settings.profileName`
  and hardcodes "Driver · Peliyagoda". Use `useSession()` (member name, role, assignment). Saving needs
  a per-member profile method in `AccountApi` (today `updateSettings` stores one shared profile).
- **Login is a demo.** Real sign-in replaces `signIn()` in `LoginPage.tsx` and the member lookup in
  `useSession()`. Seeded accounts (one per role) are a Hackathon requirement.
- **Recovery** syncs and reviews saved driver records (`apis.delivery.sync`, `listQueue`,
  `reviewQueuedRecord`). If store actions become offline-capable, their records appear here too.

## For backend developers

- The contract is `src/domain/api` (one file per area). Each method is one endpoint; parameters and
  return types are the request and response shapes. Types come from `src/domain/models.ts`.
- Implement `Http<Area>Api` classes in `src/infrastructure/http/` and switch them on in
  `src/app/apis.ts`, one area at a time. The local adapter is the reference behaviour and
  `localApis.test.ts` shows the expected results.
- Scope every list by the signed-in user (outlet, vehicle, depot); pages pass the filters from
  `useSession()`.
- Port the rules in `src/domain` and `src/application/OperationsService.ts` to the server (they import
  no React or browser storage) so the server enforces cutoff, capacity, refrigeration, access and trip
  limits.
- Driver proof uses an outbox: the queued action's UUID is the idempotency key (see
  `docs/ARCHITECTURE.md`, Backend integration seams).
- Replace `useApiQuery`'s refresh-everything invalidation with per-area query keys once data comes from
  the network.

## Driver workflow clarification

- Start route appears only after the assigned truck has reconciled counts, Loader safety checks and
  photo, Loader completion, and Dispatcher release. Complete the Driver vehicle check before departure.
- Follow Current route’s ordered outlets and saved arrival estimates. Delivery proof opens after
  arrival and parking at an assigned outlet; related proof screens share the navigation highlight.
- The Store Manager normally checks quantities, adds remarks and signs from Deliveries. Driver
  captures the photo and has no separate order drop-off/receipt action. Use Manager signs on this
  device for an offline or unavailable manager screen. One signed receipt completes the handoff
  after upload acknowledgement. The local demo shares data only within this browser.
- Contact outlet manager opens call and SMS controls when coordination is needed; nothing is sent
  automatically. The manager’s confirmation does not remove the need for contact before arrival.
- Delays & issues records delays, breakdowns and unsuccessful attempts. Add a revised arrival
  estimate when known. If Fresh delivery will miss 08:00, contact dispatch and the manager; dispatch
  must resolve replacement transport or rescheduling. Reporting cannot cancel or complete delivery.
- Route history shows daily timestamps and retained incident details. Saved records & sync handles
  interrupted uploads and route revisions; the former Recovery label referred to data recovery.
