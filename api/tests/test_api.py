"""Tests: auth, RBAC, and state machine."""
from __future__ import annotations

import pytest


class TestAuth:
    def test_login_dispatcher(self, client, dispatcher_user):
        resp = client.post("/api/v1/auth/login", json={"username": "test_dispatcher", "password": "testpass"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"] == "DISPATCHER"

    def test_login_invalid_password(self, client, dispatcher_user):
        resp = client.post("/api/v1/auth/login", json={"username": "test_dispatcher", "password": "wrong"})
        assert resp.status_code == 401

    def test_me_requires_auth(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_returns_profile(self, client, dispatcher_token):
        resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {dispatcher_token}"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "DISPATCHER"

    def test_login_store_manager(self, client, store_manager_user):
        resp = client.post("/api/v1/auth/login", json={"username": "test_store_mgr", "password": "testpass"})
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "STORE_MANAGER"

    def test_login_driver(self, client, driver_user):
        resp = client.post("/api/v1/auth/login", json={"username": "test_driver", "password": "testpass"})
        assert resp.status_code == 200

    def test_login_loader(self, client, loader_user):
        resp = client.post("/api/v1/auth/login", json={"username": "test_loader", "password": "testpass"})
        assert resp.status_code == 200


class TestRBAC:
    def test_driver_cannot_call_plans(self, client, driver_token):
        resp = client.get("/api/v1/plans", headers={"Authorization": f"Bearer {driver_token}"})
        assert resp.status_code == 403

    def test_store_manager_cannot_close_intake(self, client, store_manager_token):
        resp = client.post("/api/v1/orders/close", headers={"Authorization": f"Bearer {store_manager_token}"})
        assert resp.status_code == 403

    def test_store_manager_cannot_read_another_outlet_orders(
        self, client, store_manager_token, db_session
    ):
        # The store manager is linked to TEST001; trying to filter by another outlet should still
        # only return their own orders (RBAC enforced in query)
        resp = client.get(
            "/api/v1/orders?outlet_id=OUT999",
            headers={"Authorization": f"Bearer {store_manager_token}"},
        )
        # Should succeed but return empty list (RBAC forces own outlet)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_dispatcher_can_list_orders(self, client, dispatcher_token):
        resp = client.get("/api/v1/orders", headers={"Authorization": f"Bearer {dispatcher_token}"})
        assert resp.status_code == 200


class TestStateMachine:
    def test_illegal_order_transition_returns_409(self, client, dispatcher_token, db_session):
        from app.models.order import Order
        from app.models.reference import Depot, Outlet
        import datetime as dt

        # Create a depot and outlet first
        depot = Depot(code="SM_DEPOT", name="SM Depot", lat=6.9, lng=79.9)
        db_session.add(depot)
        db_session.flush()
        outlet = Outlet(
            outlet_id="SM001",
            brand="Fresh",
            district="Colombo",
            depot_code="SM_DEPOT",
            dock_type="street",
            van_only=False,
            is_mall=False,
        )
        db_session.add(outlet)
        db_session.flush()

        order = Order(
            reference="ORD-TEST-001",
            outlet_id="SM001",
            brand="Fresh",
            temperature_class="AMBIENT",
            delivery_date=dt.date(2024, 4, 10),
            status="DELIVERED",  # already delivered
            total_weight=100.0,
            total_volume=1.0,
        )
        db_session.add(order)
        db_session.flush()

        # Cannot move DELIVERED -> QUEUED (illegal)
        from app.services.state_machine import transition_order
        with pytest.raises(Exception):  # HTTPException 409
            transition_order(order, "QUEUED")

    def test_valid_order_transition(self, client, db_session):
        from app.models.order import Order
        from app.services.state_machine import transition_order
        from app.models.reference import Depot, Outlet
        import datetime as dt

        depot = db_session.get(Depot, "SM_DEPOT")
        if not depot:
            depot = Depot(code="SM_DEPOT", name="SM Depot", lat=6.9, lng=79.9)
            db_session.add(depot)
            db_session.flush()
        outlet = db_session.get(Outlet, "SM001")
        if not outlet:
            outlet = Outlet(
                outlet_id="SM001", brand="Fresh", district="Colombo",
                depot_code="SM_DEPOT", dock_type="street", van_only=False, is_mall=False,
            )
            db_session.add(outlet)
            db_session.flush()

        order = Order(
            reference="ORD-TEST-002",
            outlet_id="SM001",
            brand="Fresh",
            temperature_class="AMBIENT",
            delivery_date=dt.date(2024, 4, 10),
            status="PLACED",
            total_weight=100.0,
            total_volume=1.0,
        )
        db_session.add(order)
        db_session.flush()
        transition_order(order, "CONFIRMED")
        assert order.status == "CONFIRMED"


class TestDriverSync:
    def test_sync_idempotent(self, client, driver_token, db_session):
        from app.models.plan import Plan, Trip, Stop
        from app.models.reference import Depot, Outlet, Vehicle
        import datetime as dt

        # Minimal setup
        depot = Depot(code="IDM_DEPOT", name="Idm Depot", lat=7.0, lng=80.0)
        db_session.add(depot)
        db_session.flush()

        outlet = Outlet(
            outlet_id="IDM001", brand="Fresh", district="Colombo",
            depot_code="IDM_DEPOT", dock_type="street", van_only=False, is_mall=False,
        )
        db_session.add(outlet)

        vehicle = Vehicle(
            vehicle_id="VIDM001", type="van", temp="ambient",
            is_refrigerated=False, weight_cap_kg=1000, volume_cap_m3=5,
            fuel_type="diesel", km_per_l=10, weekly_fuel_quota_l=200,
            depot_code="IDM_DEPOT",
        )
        db_session.add(vehicle)
        db_session.flush()

        plan = Plan(delivery_date=dt.date(2024, 4, 10), status="PUBLISHED")
        db_session.add(plan)
        db_session.flush()

        trip = Trip(plan_id=plan.id, vehicle_id="VIDM001", trip_number=1, status="IN_TRANSIT")
        db_session.add(trip)
        db_session.flush()

        stop = Stop(trip_id=trip.id, outlet_id="IDM001", sequence=1, status="ARRIVED")
        db_session.add(stop)
        db_session.flush()

        batch = {
            "events": [
                {
                    "client_op_id": "unique-op-123",
                    "stop_id": stop.id,
                    "outcome": "DELIVERED",
                    "receiver_name": "Test User",
                }
            ]
        }
        headers = {"Authorization": f"Bearer {driver_token}"}

        # First call
        resp1 = client.post("/api/v1/driver/sync", json=batch, headers=headers)
        assert resp1.status_code == 200
        assert resp1.json()[0]["accepted"] is True

        # Second call — same client_op_id, must still be accepted (idempotent)
        resp2 = client.post("/api/v1/driver/sync", json=batch, headers=headers)
        assert resp2.status_code == 200
        assert resp2.json()[0]["accepted"] is True
        assert resp2.json()[0].get("message") == "duplicate"


class TestHealth:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
