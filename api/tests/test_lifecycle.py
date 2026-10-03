"""End-to-End Operational Lifecycle Integration Test.

Tests the full business workflow across all roles:
1. Store Manager: Places an order before cutoff (POST /orders -> PLACED)
2. Dispatcher: Closes intake at 4:00 PM cutoff (POST /orders/close -> QUEUED)
3. Dispatcher: Runs automated allocation (POST /plans/auto-plan -> DRAFT plan)
4. Dispatcher: Validates & publishes plan (POST /plans/{id}/publish -> PUBLISHED, orders -> PLANNED)
5. Loader: Inspects manifest & releases vehicle (POST /loading/trips/{id}/release -> LOADED, orders -> LOADED)
6. Driver: Views active route & records delivery event (POST /driver/stops/{id}/events -> stop COMPLETED, order DELIVERED)
7. Store Manager: Inspects delivery & confirms receipt with dispute (POST /orders/{id}/issues, /receipt)
8. Dispatcher: Verifies audit trail & analytics (GET /admin/events/poll, /admin/capacity/forecast)
"""
from __future__ import annotations

import datetime as dt
import pytest

from app.models.reference import CalendarDay, Depot, Outlet, Vehicle


@pytest.fixture
def lifecycle_setup(db_session):
    """Seed reference data needed for a realistic delivery day."""
    # 1. Operating calendar day
    cal = db_session.get(CalendarDay, dt.date(2024, 4, 10))
    if not cal:
        cal = CalendarDay(
            date=dt.date(2024, 4, 10),
            dow=3,
            dow_name="Wed",
            is_weekend=False,
            iso_year=2024,
            iso_week=15,
            is_payday=False,
            festival=None,
            festival_ramp=0.0,
            is_holiday=False,
            monsoon=False,
            is_operating=True,
        )
        db_session.add(cal)

    # 2. Depot
    depot = db_session.get(Depot, "LC_DEPOT")
    if not depot:
        depot = Depot(code="LC_DEPOT", name="Lifecycle Depot", lat=6.96, lng=79.90)
        db_session.add(depot)

    # 3. Outlet
    outlet = db_session.get(Outlet, "LC_OUT001")
    if not outlet:
        outlet = Outlet(
            outlet_id="LC_OUT001",
            brand="Fresh",
            district="Colombo",
            depot_code="LC_DEPOT",
            dock_type="street",
            van_only=False,
            is_mall=False,
            window_open_time=dt.time(5, 0),
            window_close_time=dt.time(8, 0),
            lat=6.93,
            lng=79.86,
        )
        db_session.add(outlet)

    # 4. Vehicle
    vehicle = db_session.get(Vehicle, "LC_VEH001")
    if not vehicle:
        vehicle = Vehicle(
            vehicle_id="LC_VEH001",
            type="truck",
            temp="reefer",
            is_refrigerated=True,
            weight_cap_kg=5000.0,
            volume_cap_m3=25.0,
            fuel_type="diesel",
            km_per_l=5.0,
            weekly_fuel_quota_l=400.0,
            depot_code="LC_DEPOT",
        )
        db_session.add(vehicle)

    db_session.flush()

    # Create users with role-specific assignments
    def _make_local_user(db, role: str, username: str, **kwargs):
        from app.core.security import hash_password
        from app.models.user import User

        user = User(
            username=username,
            password_hash=hash_password("testpass"),
            full_name=f"Test {role}",
            role=role,
            is_active=True,
            **kwargs,
        )
        db.add(user)
        db.flush()
        return user

    sm = _make_local_user(db_session, "STORE_MANAGER", "lc_store_mgr", outlet_id="LC_OUT001")
    disp = _make_local_user(db_session, "DISPATCHER", "lc_dispatcher")
    ldr = _make_local_user(db_session, "LOADER", "lc_loader", depot_id="LC_DEPOT")
    drv = _make_local_user(db_session, "DRIVER", "lc_driver", vehicle_id="LC_VEH001")

    db_session.flush()
    return {
        "store_mgr": sm,
        "dispatcher": disp,
        "loader": ldr,
        "driver": drv,
        "date": "2024-04-10",
    }


def _token(client, username: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": "testpass"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_complete_operational_lifecycle(client, lifecycle_setup):
    """Execute the full end-to-end operational flow through HTTP endpoints."""
    date_str = lifecycle_setup["date"]

    # Acquire tokens for each persona
    sm_token = _token(client, "lc_store_mgr")
    disp_token = _token(client, "lc_dispatcher")
    ldr_token = _token(client, "lc_loader")
    drv_token = _token(client, "lc_driver")

    sm_headers = {"Authorization": f"Bearer {sm_token}"}
    disp_headers = {"Authorization": f"Bearer {disp_token}"}
    ldr_headers = {"Authorization": f"Bearer {ldr_token}"}
    drv_headers = {"Authorization": f"Bearer {drv_token}"}

    # ── Step 1: Store Manager places an order ──────────────────────────────────
    order_payload = {
        "outlet_id": "LC_OUT001",
        "brand": "Fresh",
        "temperature_class": "CHILLED",
        "delivery_date": date_str,
        "total_weight": 450.0,
        "total_volume": 2.5,
        "total_cases": 30,
        "priority": 1,
        "notes": "Side ramp delivery",
        "lines": [
            {
                "sku": "SKU-FRESH-01",
                "description": "Chilled Fresh Milk 1L",
                "quantity": 20,
                "unit_weight": 15.0,
                "unit_volume": 0.075,
            },
            {
                "sku": "SKU-FRESH-02",
                "description": "Yogurt Cups 100g",
                "quantity": 10,
                "unit_weight": 15.0,
                "unit_volume": 0.1,
            },
        ],
    }
    resp = client.post("/api/v1/orders", json=order_payload, headers=sm_headers)
    assert resp.status_code == 201, resp.text
    order_data = resp.json()
    order_id = order_data["id"]
    assert order_data["status"] == "PLACED"
    assert order_data["outlet_id"] == "LC_OUT001"
    assert order_data["reference"].startswith("ORD-20240410-")

    # ── Step 2: Dispatcher closes intake at 4 PM cutoff ────────────────────────
    resp = client.post(f"/api/v1/orders/close?date={date_str}", headers=disp_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["closed"] >= 1

    # Verify order transitioned to QUEUED
    resp = client.get(f"/api/v1/orders/{order_id}", headers=disp_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "QUEUED"

    # ── Step 3: Dispatcher runs automated allocation ───────────────────────────
    resp = client.post(f"/api/v1/plans/auto-plan?date={date_str}", headers=disp_headers)
    assert resp.status_code == 201, resp.text
    plan_data = resp.json()
    plan_id = plan_data["id"]
    assert plan_data["status"] == "DRAFT"
    assert len(plan_data["trips"]) >= 1

    # Find the trip and stop containing our order
    trip = plan_data["trips"][0]
    trip_id = trip["id"]
    stop = trip["stops"][0]
    stop_id = stop["id"]
    assert stop["outlet_id"] == "LC_OUT001"

    # ── Step 4: Dispatcher validates & publishes the plan ───────────────────────
    # Validation check
    val_resp = client.post(f"/api/v1/plans/{plan_id}/validate", headers=disp_headers)
    assert val_resp.status_code == 200, val_resp.text
    assert val_resp.json()["valid"] is True

    # Publish
    pub_resp = client.post(f"/api/v1/plans/{plan_id}/publish", headers=disp_headers)
    assert pub_resp.status_code == 200, pub_resp.text
    assert pub_resp.json()["status"] == "PUBLISHED"

    # Verify order transitioned from QUEUED -> PLANNED
    resp = client.get(f"/api/v1/orders/{order_id}", headers=disp_headers)
    assert resp.json()["status"] == "PLANNED"

    # ── Step 5: Warehouse Loader inspects & releases the vehicle ───────────────
    # Loader checks depot trips
    resp = client.get(f"/api/v1/loading/trips?date={date_str}", headers=ldr_headers)
    assert resp.status_code == 200
    trips = resp.json()
    assert any(t["id"] == trip_id for t in trips)

    # Loader flags item as OK
    flag_resp = client.post(
        f"/api/v1/loading/trips/{trip_id}/flags",
        json={"order_id": order_id, "status": "OK", "note": "Checked and loaded"},
        headers=ldr_headers,
    )
    assert flag_resp.status_code == 201

    # Loader releases truck (PLANNED -> LOADED)
    rel_resp = client.post(f"/api/v1/loading/trips/{trip_id}/release", headers=ldr_headers)
    assert rel_resp.status_code == 200, rel_resp.text
    assert rel_resp.json()["status"] == "LOADED"

    # Verify orders on this trip advanced to LOADED
    resp = client.get(f"/api/v1/orders/{order_id}", headers=disp_headers)
    assert resp.json()["status"] == "LOADED"

    # ── Step 6: Driver views active trip & records delivery event ──────────────
    # Driver queries current trip
    resp = client.get("/api/v1/driver/trips/current", headers=drv_headers)
    assert resp.status_code == 200, resp.text
    cur_trip = resp.json()
    assert cur_trip is not None
    assert cur_trip["id"] == trip_id

    # Driver completes delivery at Stop
    event_payload = {
        "stop_id": stop_id,
        "order_id": order_id,
        "outcome": "DELIVERED",
        "receiver_name": "Kasun Silva",
        "receiver_pin_ok": True,
        "note": "Delivered to cold room",
        "recorded_at": "2024-04-10T06:30:00Z",
        "client_op_id": "op-lifecycle-test-001",
    }
    event_resp = client.post(f"/api/v1/driver/stops/{stop_id}/events", json=event_payload, headers=drv_headers)
    assert event_resp.status_code == 201, event_resp.text

    # Verify order transitioned to DELIVERED
    resp = client.get(f"/api/v1/orders/{order_id}", headers=disp_headers)
    assert resp.json()["status"] == "DELIVERED"

    # ── Step 7: Store Manager confirms receipt & logs issue ────────────────────
    # Store manager checks delivered order
    resp = client.get(f"/api/v1/orders/{order_id}", headers=sm_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "DELIVERED"

    # Store manager reports a damaged crate issue
    issue_payload = {
        "type": "DAMAGED",
        "description": "1 crate of milk carton corners crushed during transport",
    }
    issue_resp = client.post(f"/api/v1/orders/{order_id}/issues", json=issue_payload, headers=sm_headers)
    assert issue_resp.status_code == 201

    # Store manager confirms receipt as DISPUTED
    receipt_payload = {"status": "DISPUTED"}
    rcpt_resp = client.post(f"/api/v1/orders/{order_id}/receipt", json=receipt_payload, headers=sm_headers)
    assert rcpt_resp.status_code == 201

    # ── Step 8: Dispatcher verifies live audit trail & capacity ─────────────────
    poll_resp = client.get("/api/v1/admin/events/poll", headers=disp_headers)
    assert poll_resp.status_code == 200
    actions = [e["action"] for e in poll_resp.json()["events"]]

    # Verify all major lifecycle milestones appear in the audit trail
    assert "CREATE_ORDER" in actions
    assert "CLOSE_INTAKE" in actions
    assert "AUTO_PLAN" in actions
    assert "PUBLISH_PLAN" in actions
    assert "RELEASE_TRIP" in actions
    assert "DELIVERY_EVENT" in actions
    assert "REPORT_ISSUE" in actions
    assert "CONFIRM_RECEIPT" in actions

    # Verify capacity forecast calculation
    fc_resp = client.get(f"/api/v1/admin/capacity/forecast?date={date_str}", headers=disp_headers)
    assert fc_resp.status_code == 200
    fc_data = fc_resp.json()
    assert fc_data["demand"]["orders"] >= 1
    assert fc_data["utilisation"]["weight_pct"] is not None
