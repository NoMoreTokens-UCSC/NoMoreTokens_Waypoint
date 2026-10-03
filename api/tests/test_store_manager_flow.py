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
    assert data["total_weight"] == 25 * 12.0
    assert data["total_volume"] == round(25 * 0.04, 3)
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
