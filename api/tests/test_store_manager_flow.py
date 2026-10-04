"""Store Manager workflow tests."""
import datetime as dt
import pytest
from app.models.reference import Depot, Outlet
from app.models.order import Order
from app.models.plan import Plan, Trip, Stop, StopOrder
from app.models.delivery import DeliveryEvent


@pytest.fixture
def setup_store_context(db_session, store_manager_user):
    # Ensure depot and outlet OUT001 exist
    depot = db_session.query(Depot).filter(Depot.code == "DEPOT_COL").first()
    if not depot:
        depot = Depot(code="DEPOT_COL", name="Colombo Depot", lat=6.9271, lng=79.8612)
        db_session.add(depot)
        db_session.flush()

    outlet = db_session.query(Outlet).filter(Outlet.outlet_id == "OUT001").first()
    if not outlet:
        outlet = Outlet(
            outlet_id="OUT001",
            brand="Fresh",
            district="Colombo",
            depot_code=depot.code,
            dock_type="street",
            van_only=False,
            is_mall=False,
            window_open_time=dt.time(6, 0),
            window_close_time=dt.time(10, 0),
        )
        db_session.add(outlet)
        db_session.flush()

    other_outlet = db_session.query(Outlet).filter(Outlet.outlet_id == "OUT999").first()
    if not other_outlet:
        other_outlet = Outlet(
            outlet_id="OUT999",
            brand="Fresh",
            district="Kandy",
            depot_code=depot.code,
            dock_type="street",
            van_only=False,
            is_mall=False,
        )
        db_session.add(other_outlet)
        db_session.flush()

    db_session.commit()
    return outlet


from app.models.reference import Vehicle


def test_store_manager_place_order(client, store_manager_user, store_manager_token):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    outlet_id = store_manager_user.outlet_id
    payload = {
        "outlet_id": outlet_id,
        "temperature_class": "CHILLED",
        "cases": 25,
    }
    resp = client.post("/api/v1/orders", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["outlet_id"] == outlet_id
    assert data["brand"] == "Fresh"
    assert data["total_cases"] == 25
    # Weight and volume follow from the units (Fresh: 6.9 kg and 0.037 m3 a case).
    assert data["total_weight"] == 172.5
    assert data["total_volume"] == 0.925
    assert data["status"] == "PLACED"


def test_store_manager_cannot_place_for_other_outlet(client, store_manager_user, store_manager_token):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    payload = {
        "outlet_id": "OTHER_OUTLET_999",
        "temperature_class": "AMBIENT",
        "cases": 10,
    }
    resp = client.post("/api/v1/orders", json=payload, headers=headers)
    assert resp.status_code == 403


def test_store_manager_update_and_cancel_order(client, store_manager_user, store_manager_token):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    outlet_id = store_manager_user.outlet_id
    # Create order first
    resp = client.post(
        "/api/v1/orders",
        json={"outlet_id": outlet_id, "temperature_class": "AMBIENT", "cases": 15},
        headers=headers,
    )
    assert resp.status_code == 201
    order_id = resp.json()["id"]

    # Update order cases
    patch_resp = client.patch(
        f"/api/v1/orders/{order_id}",
        json={"cases": 30, "notes": "Increased cases"},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["total_cases"] == 30
    assert patch_resp.json()["notes"] == "Increased cases"

    # Cancel order
    cancel_resp = client.post(f"/api/v1/orders/{order_id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"


def test_store_manager_list_stops_and_confirm_receipt(client, store_manager_user, store_manager_token, db_session):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    outlet_id = store_manager_user.outlet_id

    # Ensure vehicle exists
    veh = db_session.get(Vehicle, "TEST_VAN_01")
    if not veh:
        veh = Vehicle(
            vehicle_id="TEST_VAN_01",
            depot_code="TEST_DEPOT2",
            type="van",
            is_refrigerated=True,
            temp="reefer",
            fuel_type="diesel",
            km_per_l=6.0,
            weekly_fuel_quota_l=250.0,
            weight_cap_kg=2000.0,
            volume_cap_m3=12.0,
        )
        db_session.add(veh)
        db_session.flush()

    # Create an order and stop for this outlet
    order = Order(
        reference="ORD-RECEIPT-001",
        outlet_id=outlet_id,
        brand="Fresh",
        temperature_class="AMBIENT",
        delivery_date=dt.date.today(),
        status="LOADED",
        total_weight=120.0,
        total_volume=0.4,
        total_cases=10,
    )
    db_session.add(order)
    db_session.flush()

    plan = Plan(delivery_date=dt.date.today(), version=1, status="PUBLISHED")
    db_session.add(plan)
    db_session.flush()

    trip = Trip(plan_id=plan.id, vehicle_id=veh.vehicle_id, trip_number=1, status="IN_TRANSIT")
    db_session.add(trip)
    db_session.flush()

    stop = Stop(trip_id=trip.id, outlet_id=outlet_id, sequence=1, status="ARRIVED")
    db_session.add(stop)
    db_session.flush()

    stop_order = StopOrder(stop_id=stop.id, order_id=order.id)
    db_session.add(stop_order)

    event = DeliveryEvent(
        stop_id=stop.id,
        order_id=order.id,
        outcome="DELIVERED",
        note="Delivered 10 cases",
        pod_photo_path="/uploads/pod_001.jpg",
        client_op_id="op-store-test-1",
    )
    db_session.add(event)
    db_session.commit()

    # Store manager fetches stops
    stops_resp = client.get("/api/v1/orders/stops", headers=headers)
    assert stops_resp.status_code == 200
    stops_data = stops_resp.json()
    assert len(stops_data) >= 1
    found_stop = next(s for s in stops_data if s["id"] == stop.id)
    assert found_stop["outlet_id"] == outlet_id
    assert found_stop["proof_id"] == "/uploads/pod_001.jpg"

    # Store manager reports short receipt
    receipt_resp = client.post(
        f"/api/v1/orders/{order.id}/receipt",
        json={"outcome": "SHORT", "received_qty": 8, "affected_qty": 2, "notes": "2 boxes missing"},
        headers=headers,
    )
    assert receipt_resp.status_code == 201
    assert receipt_resp.json()["receipt_status"] == "PARTIAL"

    # Verify order shows receipt status and issue report
    order_resp = client.get(f"/api/v1/orders/{order.id}", headers=headers)
    assert order_resp.status_code == 200
    ord_data = order_resp.json()
    assert ord_data["receipt_status"] == "PARTIAL"
    assert ord_data["receipt_report"]["kind"] == "Missing"
    assert ord_data["receipt_report"]["received"] == 8
    assert ord_data["receipt_report"]["affected"] == 2


def test_store_manager_cannot_place_duplicate_order_type(
    client, store_manager_user, store_manager_token
):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    outlet_id = store_manager_user.outlet_id
    payload = {"outlet_id": outlet_id, "temperature_class": "AMBIENT", "cases": 5}
    first = client.post("/api/v1/orders", json=payload, headers=headers)
    assert first.status_code == 201, first.text

    # A second dry order for the same delivery day is rejected and points at the first one.
    second = client.post("/api/v1/orders", json=payload, headers=headers)
    assert second.status_code == 409, second.text
    detail = second.json()["detail"]
    assert detail["code"] == "DUPLICATE_ORDER"
    assert detail["order_id"] == first.json()["id"]

    # The other type is still allowed, and a cancelled order frees its slot.
    chilled = client.post(
        "/api/v1/orders", json={**payload, "temperature_class": "CHILLED"}, headers=headers
    )
    assert chilled.status_code == 201, chilled.text
    client.post(f"/api/v1/orders/{first.json()['id']}/cancel", headers=headers)
    again = client.post("/api/v1/orders", json=payload, headers=headers)
    assert again.status_code == 201, again.text


def test_store_manager_cannot_set_order_weight_or_volume(
    client, store_manager_user, store_manager_token
):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    outlet_id = store_manager_user.outlet_id
    resp = client.post(
        "/api/v1/orders",
        json={
            "outlet_id": outlet_id,
            "temperature_class": "AMBIENT",
            "cases": 10,
            "total_weight": 1.0,
            "total_volume": 0.001,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    # The figures sent are ignored; the load is worked out from the 10 cases.
    assert data["total_weight"] == 69.0
    assert data["total_volume"] == 0.37

    # Changing the quantity recalculates it too.
    edit = client.patch(
        f"/api/v1/orders/{data['id']}",
        json={"cases": 20, "total_weight": 1.0},
        headers=headers,
    )
    assert edit.status_code == 200, edit.text
    assert edit.json()["total_weight"] == 138.0
    assert edit.json()["total_volume"] == 0.74


def test_style_outlet_has_one_order_a_day_sized_by_cartons(
    client, store_manager_user, store_manager_token
):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    payload = {
        "outlet_id": store_manager_user.outlet_id,
        "brand": "Style",
        "temperature_class": "AMBIENT",
        "cases": 10,
    }
    first = client.post("/api/v1/orders", json=payload, headers=headers)
    assert first.status_code == 201, first.text
    # Style garments are sized per carton (14.9 kg and 0.24 m3).
    assert first.json()["total_weight"] == 149.0
    assert first.json()["total_volume"] == 2.4

    second = client.post("/api/v1/orders", json=payload, headers=headers)
    assert second.status_code == 409, second.text
    assert second.json()["detail"]["order_id"] == first.json()["id"]


def test_order_rules_for_temperature_quantity_and_tech_weight(
    client, store_manager_user, store_manager_token
):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    outlet_id = store_manager_user.outlet_id
    post = lambda **body: client.post(  # noqa: E731
        "/api/v1/orders", json={"outlet_id": outlet_id, "cases": 5, **body}, headers=headers
    )

    # Only Fresh has chilled demand.
    bad = post(brand="Style", temperature_class="CHILLED")
    assert bad.status_code == 400 and bad.json()["detail"]["code"] == "INVALID_TEMPERATURE"
    assert post(temperature_class="FROZEN").status_code == 400

    # An order has at least one unit and no more than the brand's largest.
    assert post(temperature_class="AMBIENT", cases=0).json()["detail"]["code"] == "INVALID_QUANTITY"
    too_many = post(temperature_class="AMBIENT", cases=301)
    assert too_many.status_code == 400 and too_many.json()["detail"]["code"] == "INVALID_QUANTITY"
    assert post(brand="Tech", temperature_class="AMBIENT", cases=26).status_code == 400

    # A Tech store may state the weight of its items, within what Tech items weigh.
    heavy = post(brand="Tech", temperature_class="AMBIENT", cases=2, total_weight=600)
    assert heavy.status_code == 201, heavy.text
    assert heavy.json()["total_weight"] == 600
    assert heavy.json()["total_volume"] == 1.42  # still worked out: 2 items at 0.71 m3
    edit = client.patch(
        f"/api/v1/orders/{heavy.json()['id']}",
        json={"cases": 2, "total_weight": 5000},
        headers=headers,
    )
    assert edit.status_code == 400 and edit.json()["detail"]["code"] == "INVALID_WEIGHT"
    # Anyone else's stated weight is still ignored.
    fresh = post(temperature_class="AMBIENT", cases=10, total_weight=1)
    assert fresh.json()["total_weight"] == 69.0


def test_orders_after_the_cutoff_wait_for_the_next_operating_day(
    client, store_manager_user, store_manager_token, monkeypatch
):
    from app.core import clock

    headers = {"Authorization": f"Bearer {store_manager_token}"}
    payload = {"outlet_id": store_manager_user.outlet_id, "temperature_class": "AMBIENT", "cases": 8}

    # The cutoff depends on the time of day, so fix it for the test.
    monkeypatch.setattr(clock, "is_past_cutoff", lambda: False)
    before = client.get("/api/v1/orders/intake-status", headers=headers).json()
    assert before["cutoff_closed"] is False
    assert before["next_delivery_date"] == before["delivery_date"] == "2024-04-10"

    monkeypatch.setattr(clock, "is_past_cutoff", lambda: True)
    after = client.get("/api/v1/orders/intake-status", headers=headers).json()
    assert after["cutoff_closed"] is True
    assert after["delivery_date"] == "2024-04-10"
    assert after["next_delivery_date"] == "2024-04-11"  # Wednesday's intake is closed; Thursday

    late = client.post("/api/v1/orders", json=payload, headers=headers)
    assert late.status_code == 201, late.text
    assert late.json()["delivery_date"] == "2024-04-11"
    assert late.json()["cutoff_missed"] is True

    # Saturday's run is followed by Monday: Sundays are not delivery days.
    monkeypatch.setattr(clock, "delivery_date", lambda: __import__("datetime").date(2024, 4, 13))
    saturday = client.get("/api/v1/orders/intake-status", headers=headers).json()
    assert saturday["next_delivery_date"] == "2024-04-15"


def test_receipt_needs_a_delivered_order_and_stops_wait_for_publication(
    client, store_manager_user, store_manager_token, db_session
):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    outlet_id = store_manager_user.outlet_id

    # A freshly placed order cannot be received yet.
    placed = client.post(
        "/api/v1/orders",
        json={"outlet_id": outlet_id, "temperature_class": "AMBIENT", "cases": 4},
        headers=headers,
    )
    assert placed.status_code == 201, placed.text
    early = client.post(
        f"/api/v1/orders/{placed.json()['id']}/receipt", json={"outcome": "FULL"}, headers=headers
    )
    assert early.status_code == 400 and early.json()["detail"]["code"] == "INVALID_STATE"

    # A stop in a draft plan is not shown to the store; once the plan is published it is.
    veh = db_session.get(Vehicle, "TEST_VAN_DRAFT")
    if not veh:
        veh = Vehicle(
            vehicle_id="TEST_VAN_DRAFT", depot_code="TEST_DEPOT2", type="van",
            is_refrigerated=False, temp="ambient", fuel_type="diesel", km_per_l=6.0,
            weekly_fuel_quota_l=250.0, weight_cap_kg=2000.0, volume_cap_m3=12.0,
        )
        db_session.add(veh)
        db_session.flush()
    plan = Plan(delivery_date=dt.date(2024, 4, 10), version=1, status="DRAFT")
    db_session.add(plan)
    db_session.flush()
    trip = Trip(plan_id=plan.id, vehicle_id=veh.vehicle_id, trip_number=1, status="PLANNED")
    db_session.add(trip)
    db_session.flush()
    stop = Stop(trip_id=trip.id, outlet_id=outlet_id, sequence=1, status="PENDING")
    db_session.add(stop)
    db_session.commit()

    hidden = client.get("/api/v1/orders/stops", headers=headers).json()
    assert stop.id not in [s["id"] for s in hidden]

    plan.status = "PUBLISHED"
    db_session.commit()
    shown = client.get("/api/v1/orders/stops", headers=headers).json()
    assert stop.id in [s["id"] for s in shown]


def test_deferral_acknowledgement_is_kept_on_the_order(
    client, store_manager_user, store_manager_token
):
    headers = {"Authorization": f"Bearer {store_manager_token}"}
    placed = client.post(
        "/api/v1/orders",
        json={"outlet_id": store_manager_user.outlet_id, "temperature_class": "AMBIENT", "cases": 6},
        headers=headers,
    )
    order_id = placed.json()["id"]
    assert placed.json()["deferral_acknowledged_at"] is None

    note = client.post(
        f"/api/v1/orders/{order_id}/issues",
        json={"type": "OTHER", "description": "Deferral acknowledged by store manager."},
        headers=headers,
    )
    assert note.status_code == 201, note.text
    after = client.get(f"/api/v1/orders/{order_id}", headers=headers).json()
    assert after["deferral_acknowledged_at"] is not None
    # The note is not mistaken for a delivery problem report.
    assert after["receipt_report"] is None


def test_order_reports_when_it_was_scheduled_and_when_it_left(
    client, store_manager_user, store_manager_token, db_session
):
    from app.models.audit import AuditLog

    headers = {"Authorization": f"Bearer {store_manager_token}"}
    outlet_id = store_manager_user.outlet_id
    veh = db_session.get(Vehicle, "TEST_VAN_TIMES")
    if not veh:
        veh = Vehicle(
            vehicle_id="TEST_VAN_TIMES", depot_code="TEST_DEPOT2", type="van", is_refrigerated=False,
            temp="ambient", fuel_type="diesel", km_per_l=6.0, weekly_fuel_quota_l=250.0,
            weight_cap_kg=2000.0, volume_cap_m3=12.0,
        )
        db_session.add(veh)
        db_session.flush()
    order = Order(
        reference="ORD-TIMES-001", outlet_id=outlet_id, brand="Fresh", temperature_class="AMBIENT",
        delivery_date=dt.date(2024, 4, 10), status="IN_TRANSIT", total_weight=60.0, total_volume=0.2,
        total_cases=9,
    )
    db_session.add(order)
    db_session.flush()
    published = dt.datetime(2024, 4, 9, 15, 30, tzinfo=dt.timezone(dt.timedelta(hours=5, minutes=30)))
    plan = Plan(delivery_date=dt.date(2024, 4, 10), version=1, status="PUBLISHED", published_at=published)
    db_session.add(plan)
    db_session.flush()
    trip = Trip(plan_id=plan.id, vehicle_id=veh.vehicle_id, trip_number=1, status="IN_TRANSIT")
    db_session.add(trip)
    db_session.flush()
    stop = Stop(trip_id=trip.id, outlet_id=outlet_id, sequence=1, status="PENDING")
    db_session.add(stop)
    db_session.flush()
    db_session.add(StopOrder(stop_id=stop.id, order_id=order.id))
    left = published + dt.timedelta(hours=11)
    db_session.add(
        AuditLog(action="START_TRIP", entity_type="Trip", entity_id=str(trip.id), created_at=left)
    )
    db_session.commit()

    body = client.get(f"/api/v1/orders/{order.id}", headers=headers).json()
    assert dt.datetime.fromisoformat(body["scheduled_at"]) == published
    assert dt.datetime.fromisoformat(body["departed_at"]) == left
    listed = next(o for o in client.get("/api/v1/orders", headers=headers).json() if o["id"] == order.id)
    assert dt.datetime.fromisoformat(listed["departed_at"]) == left
