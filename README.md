# Waypoint

Delivery planning for a three-brand retail network (Fresh, Style, Tech): store managers place orders, the
dispatcher plans and publishes the day, the loader packs each vehicle, the driver delivers (offline-capable),
and the store confirms receipt.

| Part | Stack |
|---|---|
| `api/` | FastAPI, PostgreSQL 16, SQLAlchemy 2 + Alembic, JWT auth with role checks, a multi-pass planner |
| `frontend/` | React 19 + TypeScript, Vite, Tailwind, TanStack Query, Dexie (offline queue), Leaflet |
| `data/` | The shared CSV datasets the database is seeded from |
| `docs/` | Data model (ER diagram) and design notes |

## Live deployment

- App: <https://waypoint-w7kt.onrender.com>
- API docs: <https://waypoint-api-p2lj.onrender.com/docs>

Sign in with the seeded accounts below. If the first load is slow, wait a moment and refresh.

## Run it

```bash
cp .env.example .env
docker compose up --build
```

- App: <http://localhost:5173>
- API: <http://localhost:8000> (interactive docs at `/docs`, health check at `/health`)

The database is migrated and seeded on start. The API only accepts browser requests from the origins in
`CORS_ORIGINS` (`http://localhost:5173` by default), so open the app at `localhost`, not `127.0.0.1`.

The API container reloads on code changes only some of the time on Windows bind mounts. After editing
backend code, run `docker compose restart api`.

To start again from clean data: `docker compose down -v && docker compose up --build`.

## Seeded accounts

Sign in at <http://localhost:5173/login> with the username and password. Use **Log out** at the bottom of the
sidebar to switch to another account.

| Role | Username | Password | Works on |
|---|---|---|---|
| Dispatcher | `dispatcher` | `demo-dispatch-1` | Whole network |
| Loader | `loader` | `demo-loader-1` | Peliyagoda depot |
| Driver | `driver` | `demo-driver-1` | VEH001 |
| Store manager | `store_manager` | `demo-store-1` | OUT001, a Fresh outlet in Colombo |
| Driver | `driver2` | `demo-driver-2` | VEH004 |
| Driver | `driver_kandy` | `demo-driver-kandy` | First Kandy truck |
| Store manager | `store_manager2` | `demo-store-2` | OUT020, a Style outlet in Colombo |
| Loader | `loader_kandy` | `demo-loader-kandy` | Kandy depot |

Each role only sees its own workspace; the API refuses other roles' endpoints.

## The seeded delivery day

The system runs on a fixed business date so the seeded data lines up whenever you run it.

- **Business date:** 9 April 2024. Orders placed now are delivered on **Wednesday 10 April 2024**
  (`DEMO_DELIVERY_DATE`).
- **Time of day:** the real time of day in Sri Lanka. The order cutoff is **4:00 PM**; the cutoff countdown
  on the store manager's Overview follows the real clock. After 4:00 PM the 10 April run is locked and new
  orders are for the following operating day.
- **Seeded demand:** about 160 orders from the 120 outlets for 10 April, more than the fleet can carry, so
  the planner defers some. The 60 vehicles and 120 outlets come from `data/General Data`.
- Set `BUSINESS_DATE` in `.env` to move the business date. Put the demo day on an operating day with
  seed data (see `data/General Data/calendar.csv`).

## Judge walkthrough

The walkthrough follows an order through the system in five parts. Use **Log out** at the bottom of the
sidebar to move between roles. The loader and the driver are built for phones: for those two parts open the
browser's device toolbar (F12, then the phone icon) at 390 px wide.

The 4:00 PM cutoff follows the real clock, and the walkthrough works either side of it:

- **Before 4:00 PM** the dispatcher starts by closing intake (part 2, step 1).
- **After 4:00 PM** intake is already closed. The store manager's new orders in part 1 are for the following
  operating day, and the dispatcher plans the 10 April orders that were seeded.

### Store manager: place tomorrow's orders

1. Open <http://localhost:5173/login> and sign in as `store_manager` (password `demo-store-1`).
2. The **Overview** shows the cutoff countdown ("minutes to place tomorrow's orders", cutoff 4:00 PM), the
   delivery day (Wednesday, 10 April) and this outlet's two Fresh orders:
   - **Fresh · Chilled** has no order yet.
   - **Fresh · Dry** already has the seeded order `ORD-20240410-0001`, 39 cases.
3. Choose **Create orders**. A Fresh outlet can have one dry and one chilled order per delivery day, so the
   page has a card for each.
   - Enter the number of **cases** with the stepper or by typing. Weight and volume are not entered: the
     server works them out from the cases (6.9 kg and 0.037 m³ a case for Fresh) and the page shows the
     estimated load.
   - The **receiving window** is fixed for the outlet (OUT001: 5:00 AM – 7:30 AM). It is outlet data, so it
     is shown, not chosen.
   - The dry card says **Replaces ORD-20240410-0001**: confirming edits that order, it does not add a second.
4. Try **chilled 6 cases** and **dry 20 cases**, then choose **Review 2 orders**.
5. **Review & confirm** lists both orders. Choose **Confirm 2 orders**.
6. **Orders confirmed** shows each order with its reference (for example `ORD-20240410-0001`).
7. **Orders** lists every order for the outlet, newest day first. Open one for its detail, status and the
   **Edit order** and cancel actions, which stay available until the cutoff.

Rules the system enforces (each returns a clear message):

- One dry and one chilled order per outlet per delivery day (a Style outlet: one a day).
- Only Fresh can order chilled goods.
- 1 to 300 cases (Fresh), 150 cartons (Style) or 25 items (Tech) per order.
- **After the 4:00 PM cutoff** the day being planned is locked. The page says so, and orders placed now
  are for the following operating day (Monday to Saturday, skipping holidays).

### Dispatcher: close intake, plan, defer and publish

1. Sign in as `dispatcher` (password `demo-dispatch-1`). The **Orders** page shows the day being planned
   (Wednesday, 10 April), the number of confirmed orders, how many need a trip and how many are chilled. A
   badge reads **Accepting orders** or **Intake closed**. Before 4:00 PM choose **Close intake**; after 4:00 PM
   it is already closed.
2. The step bar along the top follows the workflow: Order queue, Allocation, Deferrals, Review, Release, Live.
   Choose **Start allocation**, then **Propose allocations**. The planner assigns orders to vehicles and trips
   within weight, volume, temperature, outlet access and the two-trip limit, and reports how many were
   allocated and how many deferred (for example "159 allocated · 4 deferred").
3. Each vehicle panel shows its trips with their weight and volume use. Use **Remove** to take an order off a
   trip; an unassigned order can be assigned again, and an assignment that breaks a rule is refused with the
   reason (for example chilled goods on an ambient vehicle).
4. Open **Deferrals**. Each order the planner could not fit is listed with its reason, such as "Insufficient
   Weight Capacity". These orders get priority on the next run.
5. Choose **Review allocation**. The page checks that intake is closed, vehicle constraints hold, no vehicle
   has more than two trips and every deferral has a reason. Choose **Confirm allocation review**, then
   **Review publication**, then **Publish revision**. Publishing shares the plan with the loaders, drivers and
   stores.
6. The **Release** page lists each published load. Pick a load in the **Select a load** menu to see its loading
   record. Departure is authorised only after the loader has finished.
7. **Fleet**, **Live tracking** and **Analytics** show the fleet, vehicle positions on the map and a demand
   outlook.

### Loader: load a vehicle to the stop sequence

Use a phone-sized window. Sign in as `loader` (password `demo-loader-1`, Peliyagoda depot).

1. The **Shift dashboard** lists the loads for the depot with the cases still to load.
2. Open `VEH001 · Trip 1` (the load the demo driver will take); if it is not easy to find in the list, open
   `/loader/loading/1`. The load workspace lists the stops from the rear of the truck to the front.
3. For each stop choose **Confirm N** once the counted cases match. The counter at the top shows
   "N / total cases loaded".
4. Tick the three safety checks: refrigeration, goods condition, and restraints with stop order.
5. Photo capture unlocks once the checks are done. Choose **Choose photo** (or **Take photo**), pick an image
   and choose **Save photograph**.
6. Choose **Confirm loading complete**. The page reads "Loading complete on this device. Await Dispatcher
   release." Use **Report an issue** instead if goods are missing or damaged; the shortfall must be resolved
   before the vehicle can leave.

### Driver: start the route and record a delivery

Use a phone-sized window. Sign in as `driver` (password `demo-driver-1`, vehicle VEH001).

1. **Home** shows the assigned trip (`VEH001 · Trip 1`, its stops and cases) and "Loaded and cleared" once the
   loader has finished.
2. Choose **Before-you-leave check**, tick the vehicle check and choose **Confirm and start route**.
3. **Current route** shows the map, the next stop and its delivery window. If the window has already passed
   the app says so and offers **Report a delay or delivery issue**.
4. At the stop choose **Mark Arrival at Stop**. The page reads "Arrived and safely parked".
5. Choose **Capture delivery photo**, then **Capture photo** (or **Choose an existing photograph**) and
   **Use this photo**.
6. Choose **Manager signs on this device**. Check the received quantities, enter the store manager's name and
   remarks, tick the confirmation, draw a signature and choose **Continue to submission review**.
7. Choose **Submit delivery proof**, then **Confirm submission**. The delivery is recorded and the order shows
   as delivered. **Saved records** lists proofs that are waiting to sync; when the connection drops, the
   photograph and signature are kept on the device and sent when it returns.

### Store manager: follow the delivery and confirm receipt

The last steps of the walkthrough, after the dispatcher has published the plan and the driver has delivered.

1. Sign in as `store_manager` and open **Deliveries**. Before the plan is published the order shows
   "Awaiting allocation". Once it is published the page shows the assigned vehicle on the map with the depot
   and the outlet. The timeline fills in as the order moves: placed, scheduled, en route, delivered.
2. When the driver records the delivery, the page changes to **Delivered · Confirm receipt**.
3. Choose **Confirm receipt**, check the count, and confirm. **Receipt confirmed** appears, and the
   order shows as received. To report a shortfall or damaged goods instead, choose **Report missing or
   damaged items** on the same screen. The report appears under **Notifications** as an issue.
4. If the dispatcher defers an order (no capacity), the store sees a deferral notice with the reason on
   **Alerts** and on the order, and acknowledges it there.

## Configuration

Everything is set in `.env` (copy from `.env.example`):

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET`, `JWT_EXPIRE_MINUTES` | Token signing and lifetime |
| `CORS_ORIGINS` | Browser origins allowed to call the API (comma separated) |
| `UPLOAD_DIR` | Where delivery and loading photographs are stored |
| `SEED_ON_START` | Seed the database when the API starts |
| `DATA_DIR` | Where the CSV datasets are |
| `DEMO_DELIVERY_DATE`, `BUSINESS_DATE` | The business clock described above |

The frontend reads `VITE_API_URL` (default `http://localhost:8000/api/v1`). When it is set the app always
uses the server: it starts with no local sample data, signed-out visitors go to the login page, and the
`/demo` pages are not available. Without it the app runs on built-in demo data for offline development.

## Tests

```bash
cd frontend && npm run test       # unit tests
cd frontend && npm run test:e2e   # browser tests
docker compose exec db psql -U waypoint -d postgres -c "CREATE DATABASE waypoint_test"
docker compose exec -e TEST_DATABASE_URL=postgresql+psycopg://waypoint:waypoint@db:5432/waypoint_test api pytest
```

## Departures from the Figma design

Where the built screens differ from the Figma designs we submitted, and why.

### Overall Platform
- **Authentication:** The Figma design included a "Switch workspace" button in the sidebar. Because we implemented real role-based authentication where each account belongs exclusively to one role, this was replaced with a functional "Log out" button.

### Store manager

- **Order History:** Added an order history section to the orders page, which was completely absent in the original Figma design.
- **Automated Order Computation:** The Figma design featured editable weight and volume fields during order creation. We changed this approach so managers only enter case counts, while weight and volume are automatically computed by the system.

### Dispatcher

- **Analytics:** Added a "Capacity outlook" page with a 10-week demand forecast and weekly volume bar charts. This helps the dispatcher reserve compatible vehicles and plan capacity ahead of peak weeks.

### Loader

- **Mobile-First Approach:** The original design included large desktop-style screens and complex modals. We completely rebuilt the UI into a streamlined, mobile-first web app optimized for handset use on the depot floor.
- **Sequential Loading Workflow:** Replaced the scattered modal interactions with a strict step-by-step UI. Loaders must explicitly reconcile item counts and tick off mandatory safety checks (refrigeration, condition, restraints) before the camera unlocks for proof capture.
- **Issue Resolution UI:** Added a dedicated shortfall reporting flow that automatically halts departure readiness and prompts the Dispatcher, replacing the static error screens from the design.

### Driver

- **Proof of Delivery:** Changed the verification approach from a simple photo upload to requiring a mandatory digital e-signature drawn directly on the device.
- **Offline Sync:** Upgraded from a static offline concept screen to a fully working UI that queues evidence locally and automatically syncs when online.
- **Route Map:** Replaced the static map illustration with a live, interactive map displaying real GPS positioning and the day's route lines.

### Admin

- **Entity Management:** Added functional pages for adding new vehicles and outlets to the system, which were not included in the original Figma designs.

## More documentation

- `docs/architecture.md`: components, how an order moves through them, and the main design decisions.
- `docs/data-model.md`: tables, relationships and the ER diagram.
- `docs/ai-tool-disclosure.md`: which work was AI-assisted and how the tools were used.
- `frontend/docs/`: role guides and the frontend architecture notes.
