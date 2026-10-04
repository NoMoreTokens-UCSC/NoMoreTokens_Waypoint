# Waypoint API

FastAPI + PostgreSQL backend for the Waypoint delivery planning system.

## Quick Start (Docker)

```bash
# From the repo root
cp .env.example .env          # edit if needed
docker compose up --build
```

The API will be available at `http://localhost:8000` with Swagger docs at `/docs`.

## Quick Start (local dev)

```bash
cd api
pip install -r requirements.txt
cp ../.env.example .env       # edit DATABASE_URL to point to a local PG
alembic upgrade head
python -m seed.run
uvicorn app.main:app --reload
```

## Demo Credentials

| Username | Password | Role | Notes |
|---|---|---|---|
| `dispatcher` | `demo-dispatch-1` | DISPATCHER | Full planner access |
| `loader` | `demo-loader-1` | LOADER | Peliyagoda depot |
| `driver` | `demo-driver-1` | DRIVER | VEH001 (reefer truck) |
| `store_manager` | `demo-store-1` | STORE_MANAGER | OUT001 (Fresh, Colombo) |
| `driver2` | `demo-driver-2` | DRIVER | VEH004 |
| `driver_kandy` | `demo-driver-kandy` | DRIVER | First Kandy truck |
| `store_manager2` | `demo-store-2` | STORE_MANAGER | OUT020 |
| `loader_kandy` | `demo-loader-kandy` | LOADER | Kandy depot |

## Commands

```bash
make up              # docker compose up --build
make down            # docker compose down
make migrate         # alembic upgrade head
make seed            # python -m seed.run
make seed-with-plan  # seed + sample plan for loader/driver demo
make reset           # truncate all tables and reseed (dev only)
make test            # pytest -v
make lint            # ruff check .
make docs            # write docs/openapi.json
```

## Environment Variables

See `/.env.example` at the repo root for all variables with descriptions.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://waypoint:waypoint@db:5432/waypoint` | PostgreSQL DSN |
| `JWT_SECRET` | *(change in prod)* | HMAC secret for JWTs |
| `JWT_EXPIRE_MINUTES` | `480` | Token lifetime (8 hours) |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `UPLOAD_DIR` | `/uploads` | Server-side photo storage |
| `DATA_DIR` | `/data/General Data` | Directory containing the CSV files |
| `SEED_ON_START` | `false` | Run seed before uvicorn starts |
| `DEMO_DELIVERY_DATE` | `2024-04-10` | The day to be planned in the demo |
| `BUSINESS_DATE` | *(derived)* | "Today" for the demo; defaults to delivery date − 1 |

## Assumptions

1. **Primary keys**: String PKs for depots (depot code), outlets (`outlet_id`), vehicles (`vehicle_id`); integer auto-increment for all operational tables. This matches the CSV natural keys and avoids UUID generation overhead.

2. **Depot codes**: Exactly as in the CSV — `Peliyagoda` and `Kandy` (capitalised, no abbreviations). All FK references use these strings.

3. **van_only derived**: Outlet is `van_only = True` when `parking_constraint == 'van_only'`.

4. **is_mall derived**: Outlet is `is_mall = True` when `mall_window` column is non-empty.

5. **is_refrigerated derived**: Vehicle is `is_refrigerated = True` when `temp == 'reefer'`.

6. **Coordinates — SYNTHETIC**: The CSV has no lat/lng. We assign approximate district centroid coordinates (from `seed/geo.py`) with deterministic ±4 km jitter seeded from `outlet_id`. All depot coordinates are also synthetic approximations. Do not use these for navigation.

7. **Business date**: The "today" of the demo is always `DEMO_DELIVERY_DATE − 1 day`. The 4 PM cutoff is evaluated against this date at 16:00 Asia/Colombo. Advance via `POST /api/v1/admin/clock`.

8. **Timezone**: All timestamps stored as timezone-aware UTC. The app timezone is Asia/Colombo (UTC+5:30). The clock helper converts all display times to Colombo time.

9. **Order reference format**: `ORD-YYYYMMDD-NNNN` (e.g. `ORD-20240410-0001`), unique per delivery date.

10. **Fuel**: `planned_fuel = planned_km / km_per_l` (litres). Weekly tracking keyed by `(iso_year, iso_week)` from the calendar table.

11. **Temperature classes**: The frontend uses `'Ambient'` and `'Chilled'`; the backend uses `AMBIENT`, `CHILLED`, `FROZEN`. The API layer maps these.

12. **Demo day selection**: `DEMO_DELIVERY_DATE=2024-04-10`. If this date is not is_operating in the CSV, the seed picks the first operating weekday with `festival_ramp > 0` near 2024-04-01.

13. **Brand constraint**: `CHECK brand IN ('Fresh','Style','Tech')` — confirmed from CSV distinct values.

14. **mall_window format**: `"HH:MM-HH:MM"` (e.g. `"09:00-11:00"`). Parsed into `mall_window_open` and `mall_window_close` time columns.

15. **Order totals**: `total_weight` and `total_volume` are denormalised on the Order for fast capacity calculations. OrderLines store per-SKU breakdown.
