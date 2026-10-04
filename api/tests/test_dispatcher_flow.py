"""Dispatcher operational flow tests."""
from __future__ import annotations

import datetime as dt
import pytest
from fastapi.testclient import TestClient

from app.models.order import Order, OrderLine
from app.models.reference import CalendarDay, Depot, Outlet, Vehicle


@pytest.fixture
def dispatcher_setup(db_session, store_manager_user):
    delivery_date = dt.date(2024, 4, 10)

    # 1. Operating calendar day
    cal = db_session.get(CalendarDay, delivery_date)
    if not cal:
        cal = CalendarDay(
            date=delivery_date,
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
    depot = db_session.get(Depot, "DISP_DEPOT")
    if not depot:
        depot = Depot(code="DISP_DEPOT", name="Dispatcher Depot", lat=6.96, lng=79.90)
        db_session.add(depot)

    # 3. Outlets
    for i in range(1, 4):
        oid = f"DISP_OUT00{i}"
        if not db_session.get(Outlet, oid):
            db_session.add(Outlet(
                outlet_id=oid,
                brand="Fresh",
                district="Colombo",
                depot_code="DISP_DEPOT",
                dock_type="street",
                van_only=False,
                is_mall=False,
                window_open_time=dt.time(5, 0),
                window_close_time=dt.time(11, 0),
                lat=6.92 + (i * 0.01),
                lng=79.86 + (i * 0.01),
            ))

    # 4. Vehicles
    for i in range(1, 3):
        vid = f"DISP_VEH00{i}"
        db_session.add(Vehicle(
            vehicle_id=vid,
            type="van",
            temp="CHILLED",
            is_refrigerated=True,
            weight_cap_kg=1200.0,
            volume_cap_m3=8.0,
            fuel_type="DIESEL",
            km_per_l=7.0,
            weekly_fuel_quota_l=250.0,
            depot_code="DISP_DEPOT",
        ))

    # 5. Orders
    for i in range(1, 4):
        oid = f"DISP_OUT00{i}"
        order = Order(
            reference=f"ORD-DISP-00{i}",
            outlet_id=oid,
            brand="Fresh",
            temperature_class="CHILLED",
            delivery_date=delivery_date,
            status="PLACED",
            total_weight=50.0 * i,
            total_volume=0.2 * i,
            total_cases=10 * i,
            priority=False,
            placed_at=dt.datetime(2024, 4, 9, 14, 0, tzinfo=dt.timezone(dt.timedelta(hours=5, minutes=30))),
            cutoff_missed=False,
            placed_by_user_id=store_manager_user.id,
        )
        db_session.add(order)
        db_session.flush()
        db_session.add(OrderLine(
            order_id=order.id,
            description="Fresh Produce",
            quantity=10 * i,
            unit_weight=5.0,
            unit_volume=0.02,
        ))

    db_session.commit()
    return {"delivery_date": delivery_date}


def test_dispatcher_complete_flow(client: TestClient, dispatcher_token: str, dispatcher_setup):
    headers = {"Authorization": f"Bearer {dispatcher_token}"}
    delivery_date = str(dispatcher_setup["delivery_date"])

    # 1. Check intake status
    res = client.get("/api/v1/orders/intake-status", headers=headers)
    assert res.status_code == 200
    intake = res.json()
    assert "cutoff_closed" in intake
    assert "published" in intake

    # 2. Close intake
    res = client.post(f"/api/v1/orders/close?date={delivery_date}", headers=headers)
    assert res.status_code == 200
    assert "closed" in res.json()

    # Verify intake status reflects closed
    res = client.get("/api/v1/orders/intake-status", headers=headers)
    assert res.status_code == 200
    assert res.json()["cutoff_closed"] is True

    # 3. List orders for delivery date
    res = client.get(f"/api/v1/orders?date={delivery_date}", headers=headers)
    assert res.status_code == 200
    orders = res.json()
    assert len(orders) >= 3
    first_order = orders[0]
    assert "outlet_id" in first_order
    assert "outlet_name" in first_order

    # 4. Trigger auto-plan
    res = client.post(f"/api/v1/plans/auto-plan?date={delivery_date}", headers=headers)
    assert res.status_code == 201
    plan = res.json()
    assert plan["status"] == "DRAFT"
    assert len(plan["trips"]) > 0
    plan_id = plan["id"]

    first_trip = plan["trips"][0]
    assert "planned_weight" in first_trip
    assert "planned_volume" in first_trip

    # 5. Test manual move between trips (if multiple trips exist)
    if len(plan["trips"]) >= 2:
        source_trip = plan["trips"][0]
        target_trip = plan["trips"][1]
        if source_trip["stops"]:
            order_to_move = source_trip["stops"][0]["order_ids"][0]
            move_res = client.patch(
                f"/api/v1/plans/{plan_id}",
                headers=headers,
                json={"moves": [{"order_id": order_to_move, "to_trip_id": target_trip["id"]}]},
            )
            assert move_res.status_code == 200

            # Test unallocation
            unalloc_res = client.patch(
                f"/api/v1/plans/{plan_id}",
                headers=headers,
                json={"moves": [{"order_id": order_to_move, "to_trip_id": None}]},
            )
            assert unalloc_res.status_code == 200

    # 6. Test deferral creation
    order_to_defer = orders[-1]["id"]
    defer_res = client.post(
        "/api/v1/deferrals",
        headers=headers,
        json={"order_id": order_to_defer, "reason_code": "CAPACITY", "explanation": "Capacity limit reached"},
    )
    assert defer_res.status_code == 201
    deferral = defer_res.json()
    assert deferral["reason_code"] == "CAPACITY"
    assert deferral["order_id"] == order_to_defer

    # List deferrals
    def_list_res = client.get(f"/api/v1/deferrals?date={delivery_date}", headers=headers)
    assert def_list_res.status_code == 200
    assert any(d["order_id"] == order_to_defer for d in def_list_res.json())

    # 7. Publish the plan
    pub_res = client.post(f"/api/v1/plans/{plan_id}/publish", headers=headers)
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["status"] == "PUBLISHED"

    # Verify intake-status shows published = True
    status_res = client.get("/api/v1/orders/intake-status", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["published"] is True
