# Waypoint Delivery Planning System — API Documentation

This document describes all REST API endpoints available in the Waypoint FastAPI backend, grouped by **user role** and functional domain.

* **Base URL:** `http://localhost:8000` (or `http://localhost:8000/api/v1` for v1 endpoints)
* **Interactive Swagger UI:** `http://localhost:8000/docs`
* **ReDoc Documentation:** `http://localhost:8000/redoc`
* **Authentication:** JWT Bearer token in the `Authorization` header (`Bearer <access_token>`).

---

## Quick Reference: Role-Based Access Control (RBAC)

| Role | Primary Responsibilities | Default Demo Account |
|---|---|---|
| **PUBLIC / COMMON** | System health, authentication, reference datasets | Any authenticated user |
| **DISPATCHER** | Capacity planning, auto-allocation, plan publishing, deferrals, clock simulation | `dispatcher` / `demo-dispatch-1` |
| **LOADER** | Depot bay manifests, reverse-sequence loading, missing/damage flags, vehicle release | `loader` / `demo-loader-1` |
| **DRIVER** | Route stops, delivery events, Proof of Delivery (POD), offline sync | `driver` / `demo-driver-1` |
| **STORE_MANAGER** | Order placement, delivery receipt confirmation, discrepancy/issue logging | `store_manager` / `demo-store-1` |

---

## 1. Public & Common Endpoints

Endpoints accessible without credentials or shared across all authenticated roles.

### `GET /health`
* **Role:** Public (No auth required)
* **Description:** Liveness probe that returns service status.
* **Response (200 OK):**
  ```json
  {
    "status": "ok",
    "service": "waypoint-api"
  }
  ```

### `GET /health/db`
* **Role:** Public (No auth required)
* **Description:** Database readiness probe that tests live PostgreSQL connectivity (`SELECT 1`).
* **Response (200 OK):**
  ```json
  {
    "status": "ok",
    "db": "connected"
  }
  ```

### `POST /api/v1/auth/login`
* **Role:** Public (No auth required)
* **Description:** Authenticates a user using username and password. On success, issues a signed JWT Bearer access token valid for 8 hours.
* **Request Body:**
  ```json
  {
    "username": "dispatcher",
    "password": "demo-dispatch-1"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": 1,
      "username": "dispatcher",
      "full_name": "Dispatcher Colombo",
      "role": "DISPATCHER",
      "is_active": true,
      "outlet_id": null,
      "vehicle_id": null,
      "depot_id": null
    }
  }
  ```

### `GET /api/v1/auth/me`
* **Role:** Authenticated (Any active user)
* **Description:** Returns the authenticated user's profile, role, and current resource assignments (e.g. assigned vehicle for drivers, outlet for store managers, depot for loaders).
* **Response (200 OK):** `UserProfile` object.

### `GET /api/v1/reference/depots`
* **Role:** Authenticated (Any role)
* **Description:** Lists all network distribution depots (`Peliyagoda`, `Kandy`) with names and geographic coordinates.
* **Response (200 OK):** Array of `DepotOut`.

### `GET /api/v1/reference/outlets`
* **Role:** Authenticated (Any role)
* **Description:** Lists retail outlets with optional filters. Returns outlet constraints including dock type, van-only restrictions, mall opening/closing delivery windows, and coordinates.
* **Query Parameters:**
  * `depot` (optional string): Filter by assigned depot code (`Peliyagoda` or `Kandy`).
  * `brand` (optional string): Filter by retail brand (`Fresh`, `Style`, `Tech`).
  * `district` (optional string): Filter by administrative district.
* **Response (200 OK):** Array of `OutletOut`.

### `GET /api/v1/reference/outlets/{outlet_id}`
* **Role:** Authenticated (Any role)
* **Description:** Retrieves detailed profile and constraints for a specific retail outlet (e.g., `OUT001`).
* **Response (200 OK):** `OutletOut`.

### `GET /api/v1/reference/vehicles`
* **Role:** Authenticated (Any role)
* **Description:** Lists all fleet vehicles (trucks, vans) with optional filtering. Returns weight capacity ($kg$), volume capacity ($m^3$), refrigeration capability, km/L fuel efficiency, and weekly fuel quotas.
* **Query Parameters:**
  * `depot` (optional string): Filter by depot code.
  * `type` (optional string): Filter by vehicle type (`truck`, `van`).
  * `refrigerated` (optional boolean): Filter by temperature capability (`true`/`false`).
* **Response (200 OK):** Array of `VehicleOut`.

### `GET /api/v1/reference/vehicles/{vehicle_id}`
* **Role:** Authenticated (Any role)
* **Description:** Retrieves specifications for an individual vehicle (e.g., `VEH001`).
* **Response (200 OK):** `VehicleOut`.

### `GET /api/v1/reference/calendar`
* **Role:** Authenticated (Any role)
* **Description:** Lists calendar trading days including operating status, holiday markers, payday flags, monsoon season, and festival demand ramp factors.
* **Query Parameters:**
  * `from` (optional date): Start date (`YYYY-MM-DD`).
  * `to` (optional date): End date (`YYYY-MM-DD`).
  * `operating_only` (optional boolean): If `true`, returns only operating business days.
* **Response (200 OK):** Array of `CalendarDayOut`.

---

## 2. Dispatcher Endpoints

Endpoints designed for central logistics dispatchers to plan routes, allocate fleet capacity, evaluate deferrals, publish runs, and simulate operating time.

### `POST /api/v1/orders/close`
* **Role:** `DISPATCHER`
* **Description:** Closes order intake for the target delivery date at the 4:00 PM cutoff. Transitions all `CONFIRMED` orders to `QUEUED` so they become available for the automated planning engine.
* **Query Parameters:**
  * `date` (optional date): Delivery date to close intake for (defaults to tomorrow's delivery date).
* **Response (200 OK):**
  ```json
  {
    "closed": 42,
    "delivery_date": "2024-04-10"
  }
  ```

### `POST /api/v1/plans/auto-plan`
* **Role:** `DISPATCHER`
* **Description:** Executes the multi-pass greedy bin-packing planning algorithm for the given delivery date.
  1. Gathers confirmed orders, fleet vehicles, and outlet constraints.
  2. Prioritizes orders by consecutive deferrals, constraints, temperature class, and weight.
  3. Allocates orders into vehicle pools (Reefer Trucks, Reefer Vans, Ambient Trucks, Ambient Vans) up to 2 trips per vehicle while respecting weight, volume, and fuel quotas.
  4. Generates nearest-neighbor stop routes with travel and dock service allowance ETAs.
  5. Records unallocated orders as deferrals with specific reason codes.
  6. Creates and persists a `DRAFT` plan (superseding any previous draft for that date).
* **Query Parameters:**
  * `date` (optional date): Target delivery date (defaults to tomorrow's delivery date).
* **Response (201 Created):** `PlanOut` with trips, stops, and execution summary metrics.

### `GET /api/v1/plans`
* **Role:** `DISPATCHER`
* **Description:** Lists delivery plans ordered by creation date descending.
* **Query Parameters:**
  * `date` (optional date): Filter by delivery date.
  * `status` (optional string): Filter by plan status (`DRAFT`, `PUBLISHED`, `SUPERSEDED`, `CANCELLED`).
* **Response (200 OK):** Array of `PlanOut` with nested trips and stops.

### `GET /api/v1/plans/{plan_id}`
* **Role:** `DISPATCHER`
* **Description:** Fetches complete details of a specific plan, including assigned vehicles, trips, sequenced stops, planned distances, and estimated fuel consumption.
* **Response (200 OK):** `PlanOut`.

### `POST /api/v1/plans/{plan_id}/validate`
* **Role:** `DISPATCHER`
* **Description:** Runs constraint validation engines against the plan. Evaluates hard rules including vehicle weight limits, volume limits, temperature compatibility, van-only access, and mall delivery windows.
* **Response (200 OK):**
  ```json
  {
    "plan_id": 1,
    "valid": true,
    "violations": []
  }
  ```

### `PATCH /api/v1/plans/{plan_id}`
* **Role:** `DISPATCHER`
* **Description:** Performs manual plan adjustments. Allows dispatchers to move an order to a different vehicle trip and specify its stop sequence. Re-validates constraints post-move.
* **Request Body:**
  ```json
  {
    "moves": [
      {
        "order_id": 8,
        "to_trip_id": 2,
        "sequence": 3
      }
    ]
  }
  ```
* **Response (200 OK):** Updated `PlanOut`.

### `POST /api/v1/plans/{plan_id}/publish`
* **Role:** `DISPATCHER`
* **Description:** Publishes a `DRAFT` plan for warehouse execution:
  1. Validates plan (blocks publication if any `ERROR`-severity constraint violations exist).
  2. Updates status from `DRAFT` $\rightarrow$ `PUBLISHED`.
  3. Transitions all assigned orders to `PLANNED`.
  4. Sets trip statuses to `PLANNED`, exposing them to warehouse loaders.
  5. Broadcasts notification events to all loaders.
* **Response (200 OK):**
  ```json
  {
    "plan_id": 1,
    "status": "PUBLISHED",
    "published_at": "2024-04-09T16:15:00+05:30",
    "orders_planned": 58,
    "trips": 12
  }
  ```

### `GET /api/v1/deferrals`
* **Role:** `DISPATCHER`
* **Description:** Lists all deferred orders with reason codes (`CAPACITY`, `TEMP_MISMATCH`, `VAN_ONLY`, `CONSECUTIVE_3`, `FUEL_QUOTA`), explanations, and consecutive counts.
* **Query Parameters:**
  * `date` (optional date): Filter deferrals by plan delivery date.
* **Response (200 OK):** Array of `DeferralOut`.

### `GET /api/v1/deferrals/outlets/{outlet_id}/history`
* **Role:** `DISPATCHER`
* **Description:** Returns the deferral history for a specific outlet across all previous delivery runs to monitor consecutive unserved runs.
* **Response (200 OK):** Array of `DeferralHistoryOut`.

### `GET /api/v1/admin/capacity/forecast`
* **Role:** `DISPATCHER`
* **Description:** Calculates demand vs fleet capacity intelligence for a target date. Provides total and refrigerated weight/volume utilization percentages, fleet availability, and breakdown per depot.
* **Query Parameters:**
  * `date` (optional date): Target date (defaults to tomorrow's delivery date).
* **Response (200 OK):**
  ```json
  {
    "date": "2024-04-10",
    "calendar": { "is_operating": true, "festival_ramp": 0.15 },
    "demand": { "orders": 64, "total_weight_kg": 24500.0, "total_volume_m3": 78.5 },
    "fleet": { "total_weight_kg": 60000.0, "total_volume_m3": 180.0 },
    "utilisation": { "weight_pct": 40.8, "volume_pct": 43.6, "reefer_volume_pct": 68.2 },
    "depots": { "Peliyagoda": { ... }, "Kandy": { ... } }
  }
  ```

### `GET /api/v1/admin/events/poll`
* **Role:** `DISPATCHER`
* **Description:** Polling feed of operational audit logs for live dispatcher dashboards.
* **Query Parameters:**
  * `since` (optional ISO timestamp): Return events occurred after this timestamp.
  * `limit` (optional integer, max 200, default 50): Number of events to return.
* **Response (200 OK):** List of chronological event objects with entity types, actions, and before/after state payloads.

### `GET /api/v1/admin/analytics/daily`
* **Role:** `DISPATCHER`
* **Description:** Aggregates delivery performance KPIs for completed runs (trip completion rates, stop outcomes, delivery success rates).
* **Query Parameters:**
  * `date` (optional date): Delivery date to summarize.
* **Response (200 OK):** Key operational metrics.

### `GET /api/v1/admin/clock`
* **Role:** `DISPATCHER`
* **Description:** Returns the simulated business date, current time in `Asia/Colombo`, the active delivery planning date, and whether the 4:00 PM cutoff has passed.
* **Response (200 OK):**
  ```json
  {
    "business_date": "2024-04-09",
    "now": "2024-04-09T14:30:00+05:30",
    "delivery_date": "2024-04-10",
    "past_cutoff": false
  }
  ```

### `POST /api/v1/admin/clock`
* **Role:** `DISPATCHER`
* **Description:** Advances the system business date for demonstration and testing purposes.
* **Request Body:**
  ```json
  {
    "business_date": "2024-04-10"
  }
  ```
* **Response (200 OK):** Confirmation of updated clock state.

---

## 3. Warehouse Loader Endpoints

Endpoints for warehouse loading teams at distribution depots (Peliyagoda and Kandy) to inspect loading manifests, perform pre-dispatch inspections, and release vehicles.

### `GET /api/v1/loading/trips`
* **Role:** `LOADER`, `DISPATCHER`
* **Description:** Lists all planned trips for loading. Scoped automatically to the loader's assigned depot (`Peliyagoda` or `Kandy`).
* **Query Parameters:**
  * `date` (optional date): Filter by delivery date.
  * `depot` (optional string): Override depot filter (available to dispatchers).
* **Response (200 OK):** Array of `TripOut` with nested stop details.

### `GET /api/v1/loading/trips/{trip_id}`
* **Role:** `LOADER`, `DISPATCHER`
* **Description:** Retrieves the loading bay manifest for a specific vehicle trip. Stops are automatically returned in **reverse-sequence order (LIFO)** so that cargo for the final drop is loaded first into the nose of the truck.
* **Response (200 OK):** `TripOut`.

### `POST /api/v1/loading/trips/{trip_id}/flags`
* **Role:** `LOADER`, `DISPATCHER`
* **Description:** Records an inspection check or discrepancy on an order item before the truck leaves the loading bay.
* **Request Body:**
  ```json
  {
    "order_id": 14,
    "status": "DAMAGED",
    "note": "Outer carton torn, inner product intact"
  }
  ```
  *(Status options: `OK`, `MISSING`, `DAMAGED`)*
* **Response (201 Created):** `{"ok": true}`.

### `POST /api/v1/loading/trips/{trip_id}/start`
* **Role:** `LOADER`, `DISPATCHER`
* **Description:** Marks that physical loading has begun at the depot dock. Transitions trip status from `PLANNED` $\rightarrow$ `LOADING`.
* **Response (200 OK):**
  ```json
  {
    "ok": true,
    "status": "LOADING"
  }
  ```

### `POST /api/v1/loading/trips/{trip_id}/release`
* **Role:** `LOADER`, `DISPATCHER`
* **Description:** Confirms truck loading is complete and all security checks passed. Transitions trip status from `PLANNED` or `LOADING` $\rightarrow$ `LOADED`, and advances all orders on the trip to `LOADED`. Releases the vehicle for driver departure.
* **Response (200 OK):**
  ```json
  {
    "ok": true,
    "status": "LOADED"
  }
  ```

---

## 4. Driver Endpoints

Endpoints for drivers to view active delivery runs, record delivery events at customer stops, capture Proof of Delivery (POD), and synchronize offline records.

### `GET /api/v1/driver/trips/current`
* **Role:** `DRIVER`, `DISPATCHER`
* **Description:** Returns the active trip assigned to the authenticated driver's vehicle (`LOADING`, `LOADED`, or `IN_TRANSIT`), including route sequence, customer outlets, delivery windows, and ETAs.
* **Response (200 OK):** `TripOut` or `null` if no active trip.

### `POST /api/v1/driver/stops/{stop_id}/events`
* **Role:** `DRIVER`, `DISPATCHER`
* **Description:** Records a delivery event at an outlet stop. Supports idempotent execution using `client_op_id` to prevent duplicate writes during network retries. Automatically transitions stop status (`COMPLETED`, `PARTIAL`, or `FAILED`).
* **Request Body:**
  ```json
  {
    "order_id": 12,
    "outcome": "DELIVERED",
    "receiver_name": "Kamal Perera",
    "receiver_pin_ok": true,
    "note": "Received in good condition",
    "recorded_at": "2024-04-10T07:15:00+05:30",
    "client_op_id": "op-uuid-12345"
  }
  ```
  *(Outcome options: `DELIVERED`, `PARTIAL`, `REFUSED`, `CLOSED`, `FAILED`)*
* **Response (201 Created):**
  ```json
  {
    "ok": true,
    "idempotent": false
  }
  ```

### `POST /api/v1/driver/sync`
* **Role:** `DRIVER`, `DISPATCHER`
* **Description:** Batch synchronization endpoint for offline driver operations. Accepts an array of delivery events recorded while the mobile device was disconnected. Each item is evaluated with its `client_op_id`; previously received events are acknowledged without duplicating records.
* **Request Body:**
  ```json
  {
    "events": [
      {
        "stop_id": 5,
        "order_id": 12,
        "outcome": "DELIVERED",
        "receiver_name": "Kamal Perera",
        "receiver_pin_ok": true,
        "recorded_at": "2024-04-10T07:15:00+05:30",
        "client_op_id": "op-uuid-12345"
      }
    ]
  }
  ```
* **Response (200 OK):** Array of `DeliveryEventResult` with per-record acceptance status.

### `POST /api/v1/driver/uploads`
* **Role:** `DRIVER`, `DISPATCHER`
* **Description:** Multipart form upload endpoint for Proof of Delivery (POD) signature images or delivery site photographs.
* **Content-Type:** `multipart/form-data`
* **Request Body:** Form field `file` containing image binary (`.jpg`, `.png`, `.webp`).
* **Response (200 OK):**
  ```json
  {
    "path": "/uploads/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg"
  }
  ```

---

## 5. Store Manager Endpoints

Endpoints for retail store managers to place daily/weekly inventory orders, track incoming shipments, verify physical goods receipt, and dispute delivery issues.

### `POST /api/v1/orders`
* **Role:** `STORE_MANAGER`, `DISPATCHER`
* **Description:** Places a new retail order. Store managers are restricted to placing orders for their assigned `outlet_id`. Automatically generates reference numbers (`ORD-YYYYMMDD-NNNN`), denormalizes weight/volume, and flags `cutoff_missed: true` if submitted after 4:00 PM.
* **Request Body:**
  ```json
  {
    "outlet_id": "OUT001",
    "brand": "Fresh",
    "temperature_class": "CHILLED",
    "delivery_date": "2024-04-10",
    "total_weight": 280.0,
    "total_volume": 1.4,
    "total_cases": 25,
    "priority": 1,
    "notes": "Deliver through side loading dock",
    "lines": [
      {
        "sku": "SKU-0012",
        "description": "Fresh Milk 1L Pack",
        "cases": 15,
        "weight_kg": 180.0,
        "volume_m3": 0.8
      }
    ]
  }
  ```
* **Response (201 Created):** `OrderOut` with assigned `reference` and status `PLACED`.

### `GET /api/v1/orders`
* **Role:** Authenticated (Scoped by role)
* **Description:** Lists orders. Store managers can only view orders placed by their assigned outlet. Dispatchers can inspect all orders across the entire network.
* **Query Parameters:**
  * `date` (optional date): Filter by delivery date.
  * `status` (optional string): Filter by order status (`PLACED`, `CONFIRMED`, `QUEUED`, `PLANNED`, `LOADED`, `IN_TRANSIT`, `DELIVERED`, `PARTIAL`, `FAILED`, `DEFERRED`, `CANCELLED`).
  * `outlet_id` (optional string): Filter by specific outlet (dispatchers only).
* **Response (200 OK):** Array of `OrderOut`.

### `GET /api/v1/orders/{order_id}`
* **Role:** Authenticated (Scoped by role)
* **Description:** Returns full order details and item lines. Enforces outlet ownership if called by a store manager.
* **Response (200 OK):** `OrderOut`.

### `POST /api/v1/orders/{order_id}/receipt`
* **Role:** `STORE_MANAGER`
* **Description:** Confirms customer receipt of goods at the retail outlet. Enforces that the order belongs to the store manager's outlet.
* **Request Body:**
  ```json
  {
    "status": "FULL"
  }
  ```
  *(Status options: `FULL`, `PARTIAL`, `DISPUTED`)*
* **Response (201 Created):** `{"ok": true}`.

### `POST /api/v1/orders/{order_id}/issues`
* **Role:** `STORE_MANAGER`
* **Description:** Logs a delivery dispute or shipment discrepancy discovered upon receipt.
* **Request Body:**
  ```json
  {
    "type": "DAMAGED",
    "description": "2 crates of chilled yoghurt crushed during transit"
  }
  ```
  *(Type options: `SHORT`, `DAMAGED`, `WRONG_ITEM`, `OTHER`)*
* **Response (201 Created):** `{"ok": true}`.

---

## 6. Error Response Schema

All errors follow a standardized JSON envelope:

```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable explanation of what went wrong."
  }
}
```

### Common HTTP Status Codes
* **`400 Bad Request`**: Malformed payload, non-operating calendar day, or invalid date format.
* **`401 Unauthorized`**: Missing or expired JWT Bearer token.
* **`403 Forbidden`**: Authenticated user lacks required role or is attempting to access an unauthorized outlet/depot.
* **`404 Not Found`**: Entity (order, plan, trip, stop, vehicle, outlet) does not exist.
* **`409 Conflict`**: State machine conflict (e.g. attempting to modify an already published plan).
* **`422 Unprocessable Entity`**: Plan contains hard constraint violations that block publication.
* **`500 Internal Server Error`**: Unexpected server error.
