"""Administration tests: people, outlets, vehicles and the audit trail."""
import pytest

from tests.conftest import _login, _make_user


@pytest.fixture
def admin_headers(client, db_session):
    from app.models.reference import Depot

    if not db_session.get(Depot, "ADM_DEPOT"):
        db_session.add(Depot(code="ADM_DEPOT", name="Admin Depot", lat=6.9, lng=79.9))
        db_session.flush()
    _make_user(db_session, "ADMIN", "test_admin")
    return {"Authorization": f"Bearer {_login(client, 'test_admin')}"}


def _new_user(**over):
    body = {
        "username": "new.loader",
        "password": "temp-pass-1",
        "full_name": "New Loader",
        "email": "new.loader@example.com",
        "phone": "0771234567",
        "role": "LOADER",
        "depot_id": "ADM_DEPOT",
    }
    body.update(over)
    return body


def test_only_admin_can_use_admin_endpoints(client, dispatcher_token):
    headers = {"Authorization": f"Bearer {dispatcher_token}"}
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
    assert client.post("/api/v1/admin/users", json=_new_user(), headers=headers).status_code == 403


def test_create_user_who_can_sign_in(client, admin_headers):
    resp = client.post("/api/v1/admin/users", json=_new_user(), headers=admin_headers)
    assert resp.status_code == 201, resp.text
    assert "password" not in resp.text
    assert _login(client, "new.loader", "temp-pass-1")


def test_duplicate_username_and_missing_links_are_refused(client, admin_headers):
    assert client.post("/api/v1/admin/users", json=_new_user(), headers=admin_headers).status_code == 201
    dup = client.post("/api/v1/admin/users", json=_new_user(email="other@example.com", phone=None), headers=admin_headers)
    assert dup.status_code == 409
    no_outlet = client.post(
        "/api/v1/admin/users",
        json=_new_user(username="sm", email="sm@example.com", phone=None, role="STORE_MANAGER", depot_id=None),
        headers=admin_headers,
    )
    assert no_outlet.status_code == 422


def test_suspend_blocks_sign_in_and_is_audited(client, admin_headers):
    created = client.post("/api/v1/admin/users", json=_new_user(), headers=admin_headers).json()
    resp = client.patch(f"/api/v1/admin/users/{created['id']}", json={"is_active": False}, headers=admin_headers)
    assert resp.status_code == 200 and resp.json()["is_active"] is False
    login = client.post("/api/v1/auth/login", json={"username": "new.loader", "password": "temp-pass-1"})
    assert login.status_code == 403
    actions = [row["action"] for row in client.get("/api/v1/admin/audit", headers=admin_headers).json()]
    assert "USER_SUSPENDED" in actions and "USER_CREATED" in actions


def test_admin_cannot_suspend_self(client, admin_headers):
    me = client.get("/api/v1/auth/me", headers=admin_headers).json()
    resp = client.patch(f"/api/v1/admin/users/{me['id']}", json={"is_active": False}, headers=admin_headers)
    assert resp.status_code == 422


def test_reset_password(client, admin_headers):
    created = client.post("/api/v1/admin/users", json=_new_user(), headers=admin_headers).json()
    resp = client.post(
        f"/api/v1/admin/users/{created['id']}/reset-password", json={"password": "another-pass-2"}, headers=admin_headers
    )
    assert resp.status_code == 204
    assert _login(client, "new.loader", "another-pass-2")


def test_create_outlet_and_vehicle(client, admin_headers):
    outlet = client.post(
        "/api/v1/admin/outlets",
        json={
            "name": "Fresh Test", "brand": "Fresh", "district": "Colombo", "depot_code": "ADM_DEPOT",
            "window_open_time": "05:00:00", "window_close_time": "08:00:00",
        },
        headers=admin_headers,
    )
    assert outlet.status_code == 201, outlet.text
    assert outlet.json()["outlet_id"].startswith("OUT") and outlet.json()["name"] == "Fresh Test"
    short = client.post(
        "/api/v1/admin/outlets",
        json={
            "name": "Too short", "brand": "Fresh", "district": "Colombo", "depot_code": "ADM_DEPOT",
            "window_open_time": "05:00:00", "window_close_time": "05:30:00",
        },
        headers=admin_headers,
    )
    assert short.status_code == 422

    vehicle = {
        "brand": "Fresh", "type": "van", "is_refrigerated": True, "depot_code": "ADM_DEPOT",
        "weight_cap_kg": 800, "volume_cap_m3": 4, "registration": "wp-1234",
    }
    created = client.post("/api/v1/admin/vehicles", json=vehicle, headers=admin_headers)
    assert created.status_code == 201, created.text
    assert created.json()["registration"] == "WP-1234" and created.json()["is_refrigerated"] is True
    assert client.post("/api/v1/admin/vehicles", json=vehicle, headers=admin_headers).status_code == 409
    style_reefer = client.post(
        "/api/v1/admin/vehicles", json={**vehicle, "brand": "Style", "registration": None}, headers=admin_headers
    )
    assert style_reefer.status_code == 422


def test_on_route_reassign_and_reason(client, admin_headers, db_session):
    from app.models.plan import Plan, Trip
    from app.models.reference import Vehicle

    for vid in ("TVEH1", "TVEH2"):
        db_session.add(Vehicle(
            vehicle_id=vid, type="van", temp="ambient", is_refrigerated=False, weight_cap_kg=800,
            volume_cap_m3=4, fuel_type="diesel", km_per_l=9, weekly_fuel_quota_l=250, depot_code="ADM_DEPOT",
        ))
    db_session.flush()
    base = {"role": "DRIVER", "depot_id": None, "password": "temp-pass-1", "phone": None}
    first = client.post("/api/v1/admin/users", json={**base, "username": "d1", "full_name": "D One", "email": "d1@example.com", "vehicle_id": "TVEH1"}, headers=admin_headers).json()
    second = client.post("/api/v1/admin/users", json={**base, "username": "d2", "full_name": "D Two", "email": "d2@example.com", "vehicle_id": "TVEH2"}, headers=admin_headers).json()
    assert first["on_route"] is False

    plan = Plan(delivery_date=__import__("datetime").date(2024, 4, 10), status="PUBLISHED")
    db_session.add(plan)
    db_session.flush()
    db_session.add(Trip(plan_id=plan.id, vehicle_id="TVEH1", trip_number=1, status="IN_TRANSIT"))
    db_session.flush()
    people = {u["username"]: u for u in client.get("/api/v1/admin/users", headers=admin_headers).json()}
    assert people["d1"]["on_route"] is True and people["d1"]["trip_number"] == 1
    assert people["d2"]["on_route"] is False

    busy = client.post(f"/api/v1/admin/users/{second['id']}/reassign-trip", json={"to_user_id": first["id"]}, headers=admin_headers)
    assert busy.status_code == 422
    ok = client.post(f"/api/v1/admin/users/{first['id']}/reassign-trip", json={"to_user_id": second["id"]}, headers=admin_headers)
    assert ok.status_code == 204
    people = {u["username"]: u for u in client.get("/api/v1/admin/users", headers=admin_headers).json()}
    assert people["d2"]["on_route"] is True and people["d1"]["on_route"] is False

    resp = client.patch(f"/api/v1/admin/users/{people['d2']['id']}", json={"is_active": False, "reason": "left the company"}, headers=admin_headers)
    assert resp.status_code == 200
    audit = client.get("/api/v1/admin/audit", headers=admin_headers).json()
    assert any(row["action"] == "USER_SUSPENDED" and (row["after"] or {}).get("reason") == "left the company" for row in audit)


def test_user_updates_own_contact(client, dispatcher_user):
    token = _login(client, "test_dispatcher")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.patch("/api/v1/auth/me", json={"full_name": "New Name", "phone": "0770000001"}, headers=headers)
    assert resp.status_code == 200 and resp.json()["full_name"] == "New Name"


def test_driver_can_read_store_manager_contacts_but_not_users(client, driver_user, store_manager_user, db_session):
    store_manager_user.phone = "+94 77 000 0009"
    db_session.flush()
    headers = {"Authorization": f"Bearer {_login(client, 'test_driver')}"}
    managers = client.get("/api/v1/reference/store-managers", headers=headers)
    assert managers.status_code == 200
    assert {"full_name": store_manager_user.full_name, "phone": "+94 77 000 0009"}.items() <= next(
        m for m in managers.json() if m["outlet_id"] == store_manager_user.outlet_id
    ).items()
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
