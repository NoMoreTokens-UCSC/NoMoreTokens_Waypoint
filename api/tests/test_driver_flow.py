"""Test driver operational endpoints: current trip, start trip, arrive, upload POD, and deliver."""
import io
import datetime as dt
from app.models.plan import Plan, Trip, Stop, StopOrder
from app.models.order import Order
from app.models.reference import Vehicle, Depot, Outlet
from app.services.state_machine import transition_trip


def test_driver_operational_endpoints(client, db_session, driver_user, driver_token):
    # Set vehicle_id on driver_user
    vehicle = db_session.get(Vehicle, "TEST_VEH_DRV")
    if not vehicle:
        depot = db_session.get(Depot, "TEST_DEPOT")
        if not depot:
            depot = Depot(code="TEST_DEPOT", name="Test Depot", lat=7.0, lng=80.0)
            db_session.add(depot)
            db_session.flush()
        vehicle = Vehicle(
            vehicle_id="TEST_VEH_DRV",
            depot_code="TEST_DEPOT",
            type="TRUCK",
            temp="reefer",
            is_refrigerated=True,
            weight_cap_kg=5000,
            volume_cap_m3=25,
            fuel_type="diesel",
            km_per_l=6.0,
            weekly_fuel_quota_l=250.0,
        )
        db_session.add(vehicle)
        db_session.flush()

    driver_user.vehicle_id = "TEST_VEH_DRV"
    db_session.commit()

    # Create outlet
    outlet = db_session.get(Outlet, "OUT_DRV_01")
    if not outlet:
        outlet = Outlet(
            outlet_id="OUT_DRV_01",
            brand="Fresh",
            district="Colombo 03",
            depot_code="TEST_DEPOT",
            dock_type="street",
            lat=6.91,
            lng=79.85,
        )
        db_session.add(outlet)
        db_session.flush()

    # Create plan, trip, stop, order
    plan = Plan(delivery_date=dt.date(2024, 4, 10), version=1, status="PUBLISHED")
    db_session.add(plan)
    db_session.flush()

    trip = Trip(
        plan_id=plan.id,
        vehicle_id="TEST_VEH_DRV",
        trip_number=1,
        status="LOADED",
        planned_depart=dt.datetime(2024, 4, 10, 6, 0, tzinfo=dt.timezone.utc),
    )
    db_session.add(trip)
    db_session.flush()

    stop = Stop(
        trip_id=trip.id,
        outlet_id="OUT_DRV_01",
        sequence=1,
        status="PENDING",
    )
    db_session.add(stop)
    db_session.flush()

    order = Order(
        reference="ORD-DRV-TEST-001",
        outlet_id="OUT_DRV_01",
        brand="Fresh",
        temperature_class="AMBIENT",
        delivery_date=dt.date(2024, 4, 10),
        status="LOADED",
        total_cases=12,
        total_weight=150.0,
        total_volume=1.2,
    )
    db_session.add(order)
    db_session.flush()

    so = StopOrder(stop_id=stop.id, order_id=order.id)
    db_session.add(so)
    db_session.commit()

    headers = {"Authorization": f"Bearer {driver_token}"}

    # 1. Driver gets current trip
    resp = client.get("/api/v1/driver/trips/current", headers=headers)
    assert resp.status_code == 200, resp.text
    cur_trip = resp.json()
    assert cur_trip["id"] == trip.id
    assert cur_trip["vehicle_id"] == "TEST_VEH_DRV"
    assert cur_trip["status"] == "LOADED"
    assert len(cur_trip["stops"]) == 1
    assert cur_trip["stops"][0]["district"] == "Colombo 03"
    assert cur_trip["stops"][0]["lat"] == 6.91
    assert cur_trip["stops"][0]["total_cases"] == 12

    # 2. Driver starts trip
    start_resp = client.post("/api/v1/driver/trips/start", headers=headers)
    assert start_resp.status_code == 200, start_resp.text
    assert start_resp.json()["status"] == "IN_TRANSIT"
    # Orders on the trip are in transit once it leaves, so the store sees them en route.
    db_session.expire_all()
    assert db_session.get(Order, order.id).status == "IN_TRANSIT"

    # 3. Driver marks arrival at stop
    arr_resp = client.post(
        f"/api/v1/driver/stops/{stop.id}/events",
        headers=headers,
        json={
            "client_op_id": "op-arr-001",
            "stop_id": stop.id,
            "outcome": "ARRIVED",
            "note": "Arrived at store",
        },
    )
    assert arr_resp.status_code == 201

    # 4. Upload POD photo
    photo_file = io.BytesIO(b"fake jpeg image data")
    upload_resp = client.post(
        "/api/v1/driver/uploads",
        headers=headers,
        files={"file": ("pod.jpg", photo_file, "image/jpeg")},
    )
    assert upload_resp.status_code == 200
    photo_path = upload_resp.json()["path"]
    assert photo_path.startswith("/uploads/")

    # 5. Complete delivery
    deliv_resp = client.post(
        f"/api/v1/driver/stops/{stop.id}/events",
        headers=headers,
        json={
            "client_op_id": "op-deliv-001",
            "stop_id": stop.id,
            "outcome": "DELIVERED",
            "note": photo_path,
            "receiver_name": "Nimal Fernando",
            "receiver_pin_ok": True,
        },
    )
    assert deliv_resp.status_code == 201

    # 6. Verify database records
    db_session.expire_all()
    updated_stop = db_session.get(Stop, stop.id)
    assert updated_stop.status == "COMPLETED"
    assert updated_stop.actual_departure is not None

    updated_order = db_session.get(Order, order.id)
    assert updated_order.status == "DELIVERED"

    updated_trip = db_session.get(Trip, trip.id)
    assert updated_trip.status == "COMPLETED"

    # Everything people read as a time is on the business clock (9 April), like when orders are placed,
    # so a delivery is never reported hours late because of a different calendar date.
    from app.models.audit import AuditLog
    from app.models.delivery import DeliveryEvent

    business_day = dt.date(2024, 4, 9)
    assert updated_stop.actual_departure.date() == business_day
    assert updated_order.delivered_at.date() == business_day
    started = db_session.query(AuditLog).filter(
        AuditLog.action == "START_TRIP", AuditLog.entity_id == str(trip.id)
    ).one()
    assert started.created_at.date() == business_day
    event = db_session.query(DeliveryEvent).filter(DeliveryEvent.stop_id == stop.id).first()
    assert event.received_at.date() == business_day

