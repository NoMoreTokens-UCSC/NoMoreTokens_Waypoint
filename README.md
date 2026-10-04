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

The walkthrough follows the order through the system. Use two browser windows or log out between roles.

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

## How the store manager's ordering follows the booklet

These are choices made against the challenge booklet, listed because they differ from a simple order form:

- **The receiving window belongs to the outlet** (`outlets.csv`), not to the order. Orders carry no window.
- **Stores enter units only.** Weight and volume come from the unit count using the per-unit figures in the
  training data (the system's capacity checks depend on them, so the server does not trust typed figures).
- **Late orders wait for the following run.** After the cutoff an order is accepted for the next operating
  day instead of being kept as a local draft.
- **Order numbers are references** (`ORD-<delivery date>-<number>`), as people read them out.
- **A store sees its vehicle and arrival time only once the plan is published,** not from the dispatcher's
  draft.
