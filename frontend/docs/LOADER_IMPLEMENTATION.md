# Loader implementation and backend handoff

The native Loader now reads through `LoadingApi` and selects a load using
`/loader/loading/:loadId` or `/loader/proof/:loadId`. The old bare URLs return to
the shift queue. Queue and workspace reads are scoped to `useSession().depot`.

## Workflow

Dispatcher confirms allocation review, then publishes. Publication produces a
manifest and distinct delivery stops for every allocated vehicle/trip. Existing
load identities are preserved; quantities come from the published orders.
Departure times and depot assignments are local demo data, not live scheduling.
Generated loads inherit the demo shift departure time; an unassigned bay is
explicitly displayed. Real planning must supply each trip's schedule and depot.

Loader reconciles delivery stops in reverse order, confirms the three safety
checks, reviews and saves a photograph, then completes loading. Missing/damaged
reports retain the outlet, affected cases and description without reducing
expected demand. Dispatcher can approve replacement on Departure readiness;
this increments the revision, resets counts/checks/current proof/completion,
and records changed instructions. Loader must acknowledge that revision before
continuing. Previous photographs remain stored for audit. Dispatcher alone has
the departure action in the UI.

## Contract additions

- `loading.listLoads({ depot })`: depot-filtered queue.
- `loading.getWorkspace(loadId, depot)`: selected manifest, published state,
  vehicle/capacity, scoped stops, weight and volume. Missing or out-of-depot loads
  return `undefined` in the local adapter.
- `loading.acknowledgeRevision(loadId, expectedRevision)`: persisted acknowledgment.
- Loader mutations pass `expectedRevision`; stale changes fail atomically. It is
  optional only for compatibility with existing callers. Require it on HTTP writes.
- `reportIssue` accepts `LoadIssueInput` (Missing/Damaged, outlet, affectedCases,
  description); the legacy string summary remains available to other roles.
- `delivery.getEvidence` provides evidence reads, including loading photographs.

## Backend requirements (not implemented)

The local session is demo identity, not authorization. A server must scope reads
and writes from authenticated depot assignments and enforce Loader vs Dispatcher
permissions, including issue resolution and departure. Never trust a client-supplied
depot as the authorization boundary.

Port published/unreleased/revision/acknowledgment/quantity/safety/held/proof guards
to the server. Bind accepted proof to its load and revision. Use an atomic expected
revision check for each mutation and the evidence attachment transaction; preserve
previous evidence. Replacement approval currently keeps expected quantities intact;
other Dispatcher decisions need an explicit revised-manifest contract.

All work and image blobs currently persist only in IndexedDB on this device.
Queries and mutations run while offline because the adapter is local. The UI says
local completion, not server acceptance. A future HTTP adapter needs an outbox,
idempotency keys, conflict/revision review, retry handling and accepted/pending
states before claiming synchronization. Do not enable real cross-device camera
handoff until there is authenticated remote storage and a secured handoff flow.
Native file capture cannot reliably distinguish cancellation from denied camera
permission; the fallback is explicit camera-help, retry and file selection.

## Verification

Unit tests cover multi-load publication, depot/manifest scoping, quantity and photo
validation, structured issues, revision acknowledgment, evidence retention and
released-load locking. Native Loader Playwright coverage exercises publishing,
loading, issues/revisions, photo preview/replacement, offline saves and departure
at mobile/tablet/desktop sizes. Historical Figma renderer tests remain excluded.

Changes to domain/API adapters, shared photo/hooks and the Dispatcher dependency
must be coordinated with their owners before integration. No real authentication,
remote sync, server endpoints or device handoff is included.
