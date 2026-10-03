"""Pytest configuration and shared fixtures.

Design:
- All heavy imports (FastAPI app, SQLAlchemy) are deferred inside fixtures.
- test_planner.py (pure Python, no DB) can collect and run with no DB or pydantic-settings.
- API tests need a live PostgreSQL via TEST_DATABASE_URL.
"""
from __future__ import annotations

import os
import pytest

# ── Environment must be set BEFORE any app import ───────────────────────────
TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://waypoint:waypoint@localhost:5432/waypoint_test",
)
os.environ.setdefault("DATABASE_URL", TEST_DB_URL)
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")
os.environ.setdefault("DEMO_DELIVERY_DATE", "2024-04-10")


# ── DB fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def engine():
    from sqlalchemy import create_engine
    import app.db.all_models  # noqa: F401 — register all models
    from app.db.base import Base

    eng = create_engine(TEST_DB_URL, pool_pre_ping=True)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture(scope="function")
def db_session(engine):
    from sqlalchemy.orm import sessionmaker

    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.db.session import get_db

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── User helpers ─────────────────────────────────────────────────────────────

def _make_user(db, role: str, username: str, **kwargs):
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


@pytest.fixture
def dispatcher_user(db_session):
    return _make_user(db_session, "DISPATCHER", "test_dispatcher")


@pytest.fixture
def loader_user(db_session):
    from app.models.reference import Depot

    depot = Depot(code="TEST_DEPOT", name="Test Depot", lat=6.9, lng=79.9)
    db_session.add(depot)
    db_session.flush()
    return _make_user(db_session, "LOADER", "test_loader", depot_id="TEST_DEPOT")


@pytest.fixture
def driver_user(db_session):
    return _make_user(db_session, "DRIVER", "test_driver")


@pytest.fixture
def store_manager_user(db_session):
    from app.models.reference import Depot, Outlet

    depot = db_session.get(Depot, "TEST_DEPOT2")
    if not depot:
        depot = Depot(code="TEST_DEPOT2", name="Test Depot 2", lat=7.0, lng=80.0)
        db_session.add(depot)
        db_session.flush()
    outlet = Outlet(
        outlet_id="TEST001",
        brand="Fresh",
        district="Colombo",
        depot_code="TEST_DEPOT2",
        dock_type="street",
        van_only=False,
        is_mall=False,
        lat=6.93,
        lng=79.86,
    )
    db_session.add(outlet)
    db_session.flush()
    return _make_user(db_session, "STORE_MANAGER", "test_store_mgr", outlet_id="TEST001")


# ── Token helpers ─────────────────────────────────────────────────────────────

def _login(client, username: str, password: str = "testpass") -> str:
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def dispatcher_token(client, dispatcher_user):
    return _login(client, "test_dispatcher")


@pytest.fixture
def loader_token(client, loader_user):
    return _login(client, "test_loader")


@pytest.fixture
def driver_token(client, driver_user):
    return _login(client, "test_driver")


@pytest.fixture
def store_manager_token(client, store_manager_user):
    return _login(client, "test_store_mgr")
