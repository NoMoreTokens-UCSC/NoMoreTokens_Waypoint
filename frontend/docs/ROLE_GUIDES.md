# Role guides

What each role developer needs to do so their pages are robust, match the design, and can be switched to
a backend without being rewritten. Read [ROLE_MODULES.md](ROLE_MODULES.md) first for how modules,
routes and the shared shell work.

## Where things stand

| Area                                                   | State                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Routing, module registry, shared shell                 | Done. Every route opens a native page.                                                                           |
| Entry pages (welcome, how it works, login, workspaces) | Done, rebuilt from the Figma frames. Login is a demo (any filled-in credentials).                                |
| Data contract `src/domain/api` + local adapter         | Done and unit-tested.                                                                                            |
| Role pages                                             | Work, but are the first native drafts: they do not match Figma and use the old data access.                      |
| Pages using `useApis()`                                | **None yet.** Until a page moves over, a backend adapter does not reach it.                                      |
| Full order-to-receipt flow in the browser              | **Blocked** at dispatcher publish (see Dispatcher, issue 1).                                                     |
| End-to-end workflow tests                              | Only the route smoke test and the entry walkthrough. The old workflow specs drove Figma screens and are skipped. |

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

1. **Publish always fails (blocks every other role).** `ReviewPage` never calls
   `reviewAllocation()`, but `publish()` requires it ("Complete the allocation review before
   publishing"). Add the review step (Figma: "Allocation review" → "Publish · Final review") that calls
   `apis.planning.reviewAllocation()` before Publish is enabled.
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
- Release uses `loads[0]`; list every load ready for release.

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

**Pages** (`sections/driver/pages/DriverPages.tsx`): `DriverHomePage`, `DriverRoutePage`,
`DriverDeliveryPage`, `DriverIssuesPage`. Molecule: `ReceiverSignaturePad`. Sync and review live in
the shared Recovery page.

**API to use:** `apis.delivery` (`getRoute`, `listStops`, `startRoute`, `arrive`, `saveProof`,
`reportIssue`, `saveAttemptProof`, `retryStop`, `listQueue`, `sync`), `apis.loading.getLoad` (load check).

**Change**

- Uses `loads[0]`, `stops[0]`, `'STOP001'` and "VEH055": use `useSession().vehicleId`, the route's
  stops, and the stop ID from the URL (e.g. `/driver/delivery/:stopId`).
- Fixed times "05:12", "05:30", "05:40": read from the stop.
- Proof is already saved on the phone first and synced later. Keep that: never show "Delivered" until
  sync accepts it, and keep the "Saved on this phone", "Upload interrupted", "Plan changed while
  offline" states.
- `reportIssue` (delivery problem without proof) exists in the API but no page uses it (Figma: "Report
  delivery issue", "Report delay").
- Partial acceptance and receiver-cannot-sign states from Figma.
- Design for use while safely stopped: large targets, one primary action per screen, phone first.

**Figma:** 51 frames (home, load check, route, stop detail, arrival, quantity check, camera, photo
review, receiver sign-off, can't deliver, partial acceptance, offline and sync states, trip complete,
profile).

## Administration

**Pages** (`sections/administration/pages/AdminPages.tsx`): `TeamPage`, `RolesPage`,
`AssignmentsPage`, `AuditPage`.

**API to use:** `apis.team` (`listMembers`, `listAudit`, `invite`, `inviteByMobile`,
`completeInvitation`, `resetAccess`, `requestAccountChange`, `changeAssignment`, `reassignTrip`,
`updateRole`, `suspend`).

**Change**

- The page only uses `invite`, `updateMember` and `suspend`. Figma also has invite by mobile, user
  detail, assignment changes and trip reassignment: all are in the API.
- "Suspend blocked · driver on route": offer scheduled suspension or trip reassignment.
- Fixed "Peliyagoda", "VEH055", "Sanjeewa" copy: use the member records.
- Roles list comes from the registry (`roleModules`); keep it that way.

**Figma:** 7 frames (team & access, add user, invite sent, user detail, roles & access, suspend
blocked, audit log).

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
