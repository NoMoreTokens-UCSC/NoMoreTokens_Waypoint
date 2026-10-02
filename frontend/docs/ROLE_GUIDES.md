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

**Pages** (`sections/store-manager/pages/StorePages.tsx`): `StoreOrdersPage` (overview and orders),
`StoreDeliveriesPage`, `StoreAlertsPage`. Exported Figma images are in `Figma Store manager/` (outside
the repo).

**API to use:** `apis.orders` (`listOrders({ outletId })`, `getIntakeStatus`, `placeOrders`,
`editOrder`, `saveDrafts`, `listDrafts`, `confirmReceipt`, `reportReceiptIssue`, `acknowledgeDeferral`),
`apis.delivery.listStops({ outletId })` (ETA, proof), `apis.delivery.getEvidence` (delivery photo).

**Change**

- `'OUT001'` appears 8 times and the map filters `'VEH055'`: use `useSession().outletId` and the stop's
  vehicle.
- Use `placeOrders` (chilled and dry confirmed together, as Figma "Create separate orders → Review →
  Orders confirmed"), not one `createOrder` per record.
- Use `saveDrafts` for "Cutoff passed → Draft saved for next run".
- Use `reportReceiptIssue({ kind, received, affected, description })` for missing/damaged reports
  (Figma: "Report missing items", "Report damaged items"). The page currently sends free text through
  `confirmReceipt`, which loses the counts.
- ETA "05:40" and window "05:30–07:30" are fixed text: read them from the stop.
- The window picker offers 08:30 and 10:00. Fresh deliveries must arrive before 8 AM (outlet windows
  can differ): offer the outlet's window from data.
- Deferral notice needs the acknowledgment gate (Figma: "Acknowledgment required" → "selected" →
  "acknowledged").
- Offline: orders and receipts made without a connection are not queued yet. Agree the approach with
  the backend developers (same pattern as driver proof).
- Note: the local adapter accepts outlet `OUT001` only, because the seed data models one store.

**Figma:** 20 screens (order placement, create/review/confirm, cutoff passed, draft saved, scheduled
delivery, live tracking, delivered/receipt pending, confirm receipt, missing/damaged reports and
submitted states, deferral acknowledgment, delivery photograph, navigation).

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
