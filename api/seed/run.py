"""Main seed script.

Usage:
    python -m seed.run                   # seed everything
    python -m seed.run --with-sample-plan  # also insert a published plan for demos
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import logging
import os
import random
import sys
from pathlib import Path

# Allow running from api/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.audit import AuditLog
from app.models.deferral import Deferral
from app.models.order import Order, OrderLine
from app.models.plan import Plan, Stop, StopOrder, Trip
from app.models.receipt import Receipt
from app.models.reference import CalendarDay, Depot, Outlet, Vehicle, VehicleWeeklyFuel
from app.models.user import User
from seed.geo import depot_coords, outlet_coords

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("seed")

# ── Demo credentials ────────────────────────────────────────────────────────
DEMO_USERS = [
    {
        "username": "dispatcher",
        "password": "demo-dispatch-1",
        "full_name": "Sanjaya Perera",
        "role": "DISPATCHER",
        "outlet_id": None,
        "vehicle_id": None,
        "depot_id": None,
    },
    {
        "username": "loader",
        "password": "demo-loader-1",
        "full_name": "Ruwan Jayasinghe",
        "role": "LOADER",
        "outlet_id": None,
        "vehicle_id": None,
        "depot_id": "Peliyagoda",
    },
    # driver linked to VEH001 (first refrigerated truck - Peliyagoda)
    {
        "username": "driver",
        "password": "demo-driver-1",
        "full_name": "Nimal Kumara",
        "role": "DRIVER",
        "outlet_id": None,
        "vehicle_id": "VEH001",
        "depot_id": None,
    },
    # store manager linked to OUT001 (Fresh, Colombo, van_only)
    {
        "username": "store_manager",
        "password": "demo-store-1",
        "full_name": "Dilani Silva",
        "role": "STORE_MANAGER",
        "outlet_id": "OUT001",
        "vehicle_id": None,
        "depot_id": None,
    },
    # Extra drivers and store managers for more realistic demos
    {
        "username": "driver2",
        "password": "demo-driver-2",
        "full_name": "Kasun Fernando",
        "role": "DRIVER",
        "outlet_id": None,
        "vehicle_id": "VEH004",
        "depot_id": None,
    },
    {
        "username": "driver_kandy",
        "password": "demo-driver-kandy",
        "full_name": "Priya Bandara",
        "role": "DRIVER",
        "outlet_id": None,
        "vehicle_id": None,  # will be filled with first Kandy vehicle
        "depot_id": None,
    },
    {
        "username": "store_manager2",
        "password": "demo-store-2",
        "full_name": "Chamari Wickrama",
        "role": "STORE_MANAGER",
        "outlet_id": "OUT020",
        "vehicle_id": None,
        "depot_id": None,
    },
    {
        "username": "loader_kandy",
        "password": "demo-loader-kandy",
        "full_name": "Anura Rathnayake",
        "role": "LOADER",
        "outlet_id": None,
        "vehicle_id": None,
        "depot_id": "Kandy",
    },
]


def _read_csv(filename: str) -> list[dict]:
    settings = get_settings()
    path = Path(settings.data_dir) / filename
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _upsert_depot(db, row: dict) -> None:
    lat, lng = depot_coords(row["code"])
    stmt = (
        pg_insert(Depot)
        .values(code=row["code"], name=row["name"], lat=lat, lng=lng)
        .on_conflict_do_update(
            index_elements=["code"],
            set_={"name": row["name"], "lat": lat, "lng": lng},
        )
    )
    db.execute(stmt)


def seed_depots(db) -> None:
    log.info("Seeding depots…")
    depots = [
        {"code": "Peliyagoda", "name": "Peliyagoda Distribution Centre"},
        {"code": "Kandy", "name": "Kandy Distribution Centre"},
    ]
    for d in depots:
        _upsert_depot(db, d)
    db.flush()
    log.info("  ✓ %d depots", len(depots))


def seed_outlets(db) -> None:
    log.info("Seeding outlets…")
    rows = _read_csv("outlets.csv")
    if len(rows) != 120:
        log.warning("Expected 120 outlets, got %d", len(rows))

    for i, row in enumerate(rows, 1):
        outlet_id = row["outlet_id"].strip()
        brand = row["brand"].strip()
        district = row["district"].strip()
        depot = row["depot"].strip()
        dock_type = row["dock_type"].strip()
        parking = row["parking_constraint"].strip() or None
        mall_window = row["mall_window"].strip() or None
        win_open = row["window_open_time"].strip() or None
        win_close = row["window_close_time"].strip() or None

        # Validate
        if brand not in ("Fresh", "Style", "Tech"):
            raise ValueError(f"Row {i}: unknown brand {brand!r}")
        if depot not in ("Peliyagoda", "Kandy"):
            raise ValueError(f"Row {i}: unknown depot {depot!r}")

        van_only = parking == "van_only"
        is_mall = bool(mall_window)

        # Parse mall window "HH:MM-HH:MM"
        mall_open = mall_close = None
        if mall_window:
            parts = mall_window.split("-")
            if len(parts) == 2:
                mall_open = dt.time.fromisoformat(parts[0].strip())
                mall_close = dt.time.fromisoformat(parts[1].strip())

        lat, lng = outlet_coords(outlet_id, district)

        stmt = (
            pg_insert(Outlet)
            .values(
                outlet_id=outlet_id,
                brand=brand,
                district=district,
                depot_code=depot,
                dock_type=dock_type,
                parking_constraint=parking,
                van_only=van_only,
                is_mall=is_mall,
                mall_window_open=mall_open,
                mall_window_close=mall_close,
                window_open_time=dt.time.fromisoformat(win_open) if win_open else None,
                window_close_time=dt.time.fromisoformat(win_close) if win_close else None,
                lat=lat,
                lng=lng,
            )
            .on_conflict_do_update(
                index_elements=["outlet_id"],
                set_={
                    "brand": brand, "district": district, "depot_code": depot,
                    "dock_type": dock_type, "parking_constraint": parking,
                    "van_only": van_only, "is_mall": is_mall,
                    "mall_window_open": mall_open, "mall_window_close": mall_close,
                    "window_open_time": dt.time.fromisoformat(win_open) if win_open else None,
                    "window_close_time": dt.time.fromisoformat(win_close) if win_close else None,
                    "lat": lat, "lng": lng,
                },
            )
        )
        db.execute(stmt)

    db.flush()
    log.info("  ✓ %d outlets", len(rows))

    # Check van_only outlets have a refrigerated van at their depot
    van_only_rows = [r for r in rows if r["parking_constraint"].strip() == "van_only"]
    vehicle_rows = _read_csv("vehicles.csv")
    for row in van_only_rows:
        depot = row["depot"].strip()
        has_ref_van = any(
            v["depot"].strip() == depot and v["type"].strip() == "van" and v["temp"].strip() == "reefer"
            for v in vehicle_rows
        )
        if not has_ref_van:
            log.warning(
                "WARNING: van_only outlet %s (depot %s) has no refrigerated van at that depot!",
                row["outlet_id"], depot,
            )


def seed_vehicles(db) -> None:
    log.info("Seeding vehicles…")
    rows = _read_csv("vehicles.csv")
    if len(rows) != 60:
        log.warning("Expected 60 vehicles, got %d", len(rows))

    for i, row in enumerate(rows, 1):
        vehicle_id = row["vehicle_id"].strip()
        vtype = row["type"].strip()
        temp = row["temp"].strip()
        depot = row["depot"].strip()
        fuel_type = row["fuel_type"].strip()

        if vtype not in ("truck", "van"):
            raise ValueError(f"Row {i}: unknown vehicle type {vtype!r}")
        if temp not in ("reefer", "ambient"):
            raise ValueError(f"Row {i}: unknown temp {temp!r}")
        if depot not in ("Peliyagoda", "Kandy"):
            raise ValueError(f"Row {i}: unknown depot {depot!r}")

        is_ref = temp == "reefer"

        try:
            weight = float(row["weight_cap_kg"])
            volume = float(row["volume_cap_m3"])
            km_per_l = float(row["km_per_l"])
            quota = float(row["weekly_fuel_quota_l"])
        except (ValueError, KeyError) as e:
            raise ValueError(f"Row {i}: numeric parse error: {e}") from e

        stmt = (
            pg_insert(Vehicle)
            .values(
                vehicle_id=vehicle_id,
                type=vtype,
                temp=temp,
                is_refrigerated=is_ref,
                weight_cap_kg=weight,
                volume_cap_m3=volume,
                fuel_type=fuel_type,
                km_per_l=km_per_l,
                weekly_fuel_quota_l=quota,
                depot_code=depot,
            )
            .on_conflict_do_update(
                index_elements=["vehicle_id"],
                set_={
                    "type": vtype, "temp": temp, "is_refrigerated": is_ref,
                    "weight_cap_kg": weight, "volume_cap_m3": volume,
                    "fuel_type": fuel_type, "km_per_l": km_per_l,
                    "weekly_fuel_quota_l": quota, "depot_code": depot,
                },
            )
        )
        db.execute(stmt)

    db.flush()
    log.info("  ✓ %d vehicles", len(rows))

    # Counts by type/temp
    trucks = [r for r in rows if r["type"].strip() == "truck"]
    vans = [r for r in rows if r["type"].strip() == "van"]
    ref_trucks = [r for r in trucks if r["temp"].strip() == "reefer"]
    dry_trucks = [r for r in trucks if r["temp"].strip() == "ambient"]
    ref_vans = [r for r in vans if r["temp"].strip() == "reefer"]
    log.info(
        "  Breakdown: %d trucks (%d reefer, %d dry), %d vans (%d reefer, %d ambient)",
        len(trucks), len(ref_trucks), len(dry_trucks),
        len(vans), len(ref_vans), len(vans) - len(ref_vans),
    )


def seed_calendar(db) -> None:
    log.info("Seeding calendar…")
    rows = _read_csv("calendar.csv")

    for i, row in enumerate(rows, 1):
        try:
            date = dt.date.fromisoformat(row["date"].strip())
            dow = int(row["dow"].strip())
            dow_name = row["dow_name"].strip()
            is_weekend = bool(int(row["is_weekend"].strip()))
            iso_year = int(row["iso_year"].strip())
            iso_week = int(row["iso_week"].strip())
            is_payday = bool(int(row["is_payday"].strip()))
            festival = row["festival"].strip() or None
            festival_ramp = float(row["festival_ramp"].strip())
            is_holiday = bool(int(row["is_holiday"].strip()))
            monsoon = bool(int(row["monsoon"].strip()))
            is_operating = bool(int(row["is_operating"].strip()))
        except (ValueError, KeyError) as e:
            raise ValueError(f"calendar.csv row {i}: parse error: {e}") from e

        stmt = (
            pg_insert(CalendarDay)
            .values(
                date=date, dow=dow, dow_name=dow_name, is_weekend=is_weekend,
                iso_year=iso_year, iso_week=iso_week, is_payday=is_payday,
                festival=festival, festival_ramp=festival_ramp,
                is_holiday=is_holiday, monsoon=monsoon, is_operating=is_operating,
            )
            .on_conflict_do_update(
                index_elements=["date"],
                set_={
                    "dow": dow, "dow_name": dow_name, "is_weekend": is_weekend,
                    "iso_year": iso_year, "iso_week": iso_week, "is_payday": is_payday,
                    "festival": festival, "festival_ramp": festival_ramp,
                    "is_holiday": is_holiday, "monsoon": monsoon, "is_operating": is_operating,
                },
            )
        )
        db.execute(stmt)

    db.flush()
    log.info("  ✓ %d calendar days (%s → %s)", len(rows), rows[0]["date"], rows[-1]["date"])


def seed_users(db) -> None:
    log.info("Seeding demo users…")
    # Find a Kandy vehicle for driver_kandy
    kandy_vehicle = db.query(Vehicle).filter(
        Vehicle.depot_code == "Kandy",
        Vehicle.type == "truck",
    ).first()

    for spec in DEMO_USERS:
        vehicle_id = spec["vehicle_id"]
        if spec["username"] == "driver_kandy" and kandy_vehicle:
            vehicle_id = kandy_vehicle.vehicle_id

        existing = db.query(User).filter(User.username == spec["username"]).first()
        if existing:
            # Update fields but keep existing password
            existing.full_name = spec["full_name"]
            existing.role = spec["role"]
            existing.outlet_id = spec["outlet_id"]
            existing.vehicle_id = vehicle_id
            existing.depot_id = spec["depot_id"]
        else:
            user = User(
                username=spec["username"],
                password_hash=hash_password(spec["password"]),
                full_name=spec["full_name"],
                role=spec["role"],
                outlet_id=spec["outlet_id"],
                vehicle_id=vehicle_id,
                depot_id=spec["depot_id"],
                is_active=True,
            )
            db.add(user)

    db.flush()
    log.info("  ✓ %d demo users", len(DEMO_USERS))


def _next_demo_delivery_date(db) -> dt.date:
    """Return DEMO_DELIVERY_DATE from settings if it's a valid operating day."""
    from app.core.config import get_settings
    settings = get_settings()
    delivery = dt.date.fromisoformat(settings.demo_delivery_date)
    cal = db.get(CalendarDay, delivery)
    if cal is None or not cal.is_operating:
        # Find first operating non-holiday weekday after 2024-04-01
        cal = (
            db.query(CalendarDay)
            .filter(
                CalendarDay.date >= dt.date(2024, 4, 1),
                CalendarDay.is_operating.is_(True),
                CalendarDay.is_holiday.is_(False),
                CalendarDay.is_weekend.is_(False),
            )
            .order_by(CalendarDay.festival_ramp.desc(), CalendarDay.date)
            .first()
        )
        delivery = cal.date
        log.info("  Using auto-selected delivery date: %s", delivery)
    return delivery


def seed_demo_orders(db) -> dt.date:
    """Seed a realistic overloaded delivery day. Returns the delivery date."""
    log.info("Seeding demo orders…")
    delivery_date = _next_demo_delivery_date(db)
    cal = db.get(CalendarDay, delivery_date)
    log.info("  Delivery date: %s (payday=%s, festival=%s, ramp=%.2f, monsoon=%s)",
             delivery_date, cal.is_payday, cal.festival, cal.festival_ramp, cal.monsoon)

    # Demand multiplier
    multiplier = 1.0 + 0.25 * int(cal.is_payday) + cal.festival_ramp
    log.info("  Demand multiplier: %.2f", multiplier)

    # Load all outlets
    outlets = db.query(Outlet).all()
    # Load all vehicles for capacity check
    vehicles = db.query(Vehicle).all()

    # RNG with fixed seed for reproducibility
    rng = random.Random(42)

    # Find a dispatcher user to set as placed_by
    dispatcher = db.query(User).filter(User.role == "DISPATCHER").first()
    placed_by = dispatcher.id if dispatcher else None

    # Business clock (placed a day before delivery)
    business_day = delivery_date - dt.timedelta(days=1)
    tz = dt.timezone(dt.timedelta(hours=5, minutes=30))

    def _placed_at(after_cutoff: bool = False) -> dt.datetime:
        hour = rng.randint(16, 18) if after_cutoff else rng.randint(8, 15)
        minute = rng.randint(0, 59)
        return dt.datetime(business_day.year, business_day.month, business_day.day,
                           hour, minute, tzinfo=tz)

    # Get next reference counter
    existing_count = db.query(Order).filter(Order.delivery_date == delivery_date).count()
    counter = existing_count

    def _new_ref() -> str:
        nonlocal counter
        counter += 1
        return f"ORD-{delivery_date.strftime('%Y%m%d')}-{counter:04d}"

    orders_created = 0

    for outlet in outlets:
        brand = outlet.brand
        # Calculate base weight/volume per order depending on brand
        if brand == "Fresh":
            base_weight = rng.uniform(200, 800) * multiplier
            base_volume = rng.uniform(1.0, 4.5) * multiplier
            temp_class = "AMBIENT"
            cases = max(1, int(base_weight / 25))
        elif brand == "Style":
            # Style: volume-heavy, lighter
            base_weight = rng.uniform(150, 600) * multiplier
            base_volume = rng.uniform(3.0, 10.0) * multiplier  # volume-heavy
            temp_class = "AMBIENT"
            cases = max(1, int(base_volume * 4))
        else:  # Tech
            # Tech: weight-heavy
            base_weight = rng.uniform(300, 1200) * multiplier  # weight-heavy
            base_volume = rng.uniform(0.5, 3.0) * multiplier
            temp_class = "AMBIENT"
            cases = max(1, int(base_weight / 40))

        after_cutoff = rng.random() < 0.05  # ~5% orders after cutoff
        placed = _placed_at(after_cutoff)

        # Check if order already exists for this outlet/date
        existing = db.query(Order).filter(
            Order.outlet_id == outlet.outlet_id,
            Order.delivery_date == delivery_date,
            Order.brand == brand,
            Order.temperature_class == temp_class,
        ).first()
        if not existing:
            order = Order(
                reference=_new_ref(),
                outlet_id=outlet.outlet_id,
                brand=brand,
                temperature_class=temp_class,
                delivery_date=delivery_date,
                status="CONFIRMED",
                total_weight=round(base_weight, 1),
                total_volume=round(base_volume, 3),
                total_cases=cases,
                priority=outlet.is_mall,
                placed_at=placed,
                cutoff_missed=after_cutoff,
                placed_by_user_id=placed_by,
            )
            db.add(order)
            orders_created += 1

        # Fresh outlets: also add chilled order for ~40% of Fresh outlets
        if brand == "Fresh" and rng.random() < 0.40:
            chilled_weight = rng.uniform(50, 300) * multiplier
            chilled_volume = rng.uniform(0.3, 2.0) * multiplier
            existing_ch = db.query(Order).filter(
                Order.outlet_id == outlet.outlet_id,
                Order.delivery_date == delivery_date,
                Order.brand == brand,
                Order.temperature_class == "CHILLED",
            ).first()
            if not existing_ch:
                order_ch = Order(
                    reference=_new_ref(),
                    outlet_id=outlet.outlet_id,
                    brand=brand,
                    temperature_class="CHILLED",
                    delivery_date=delivery_date,
                    status="CONFIRMED",
                    total_weight=round(chilled_weight, 1),
                    total_volume=round(chilled_volume, 3),
                    total_cases=max(1, int(chilled_weight / 15)),
                    priority=outlet.van_only,  # van_only chilled gets priority flag
                    placed_at=_placed_at(),
                    cutoff_missed=False,
                    placed_by_user_id=placed_by,
                )
                db.add(order_ch)
                orders_created += 1

    db.flush()

    # Capacity sanity check
    all_orders = db.query(Order).filter(Order.delivery_date == delivery_date).all()
    total_w = sum(o.total_weight for o in all_orders)
    total_v = sum(o.total_volume for o in all_orders)
    chilled_w = sum(o.total_weight for o in all_orders if o.temperature_class == "CHILLED")
    chilled_v = sum(o.total_volume for o in all_orders if o.temperature_class == "CHILLED")

    fleet_w = sum(v.weight_cap_kg * 2 for v in vehicles)  # 2 trips max
    fleet_v = sum(v.volume_cap_m3 * 2 for v in vehicles)
    ref_w = sum(v.weight_cap_kg * 2 for v in vehicles if v.is_refrigerated)
    ref_v = sum(v.volume_cap_m3 * 2 for v in vehicles if v.is_refrigerated)

    log.info("  ── Capacity sanity check ──")
    log.info("  Orders: %d (newly created: %d)", len(all_orders), orders_created)
    log.info("  Total demand: %.0f kg / %.1f m³", total_w, total_v)
    log.info("  Fleet capacity (2 trips): %.0f kg / %.1f m³", fleet_w, fleet_v)
    log.info("  Demand/fleet: %.1f%% weight, %.1f%% volume",
             100 * total_w / fleet_w, 100 * total_v / fleet_v)
    log.info("  Chilled demand: %.0f kg / %.1f m³", chilled_w, chilled_v)
    log.info("  Reefer fleet cap: %.0f kg / %.1f m³", ref_w, ref_v)
    if chilled_w > 0 and ref_w > 0:
        log.info("  Chilled/reefer: %.1f%% weight, %.1f%% volume",
                 100 * chilled_w / ref_w, 100 * chilled_v / ref_v)

    if total_w < fleet_w * 1.10:
        log.warning("Total demand is NOT 15-30%% above capacity — seed may need tuning")

    return delivery_date


def seed_history_deferrals(db, delivery_date: dt.date) -> None:
    """Seed a previous day's deferrals so consecutive_count=1 for 3-5 outlets."""
    log.info("Seeding deferral history…")
    tz = dt.timezone(dt.timedelta(hours=5, minutes=30))

    # Find an operating day before delivery_date
    prev_day = (
        db.query(CalendarDay)
        .filter(
            CalendarDay.date < delivery_date,
            CalendarDay.is_operating.is_(True),
            CalendarDay.is_holiday.is_(False),
        )
        .order_by(CalendarDay.date.desc())
        .first()
    )
    if not prev_day:
        log.warning("  No previous operating day found, skipping deferral history")
        return

    prev_date = prev_day.date
    rng = random.Random(99)

    # Pick 4 outlets to have been deferred previously
    outlets = db.query(Outlet).filter(Outlet.brand == "Fresh").all()
    rng.shuffle(outlets)
    deferred_outlets = outlets[:4]

    # Create a historical plan
    existing_plan = db.query(Plan).filter(Plan.delivery_date == prev_date).first()
    if not existing_plan:
        hist_plan = Plan(
            delivery_date=prev_date,
            version=1,
            status="PUBLISHED",
            created_at=dt.datetime(prev_date.year, prev_date.month, prev_date.day, 18, 0, tzinfo=tz),
            published_at=dt.datetime(prev_date.year, prev_date.month, prev_date.day, 18, 30, tzinfo=tz),
            summary_json={"note": "historical demo plan"},
        )
        db.add(hist_plan)
        db.flush()
        plan_id = hist_plan.id
    else:
        plan_id = existing_plan.id

    dispatcher = db.query(User).filter(User.role == "DISPATCHER").first()
    placed_by = dispatcher.id if dispatcher else None

    for outlet in deferred_outlets:
        # Create a historical order for that outlet
        hist_ref = f"ORD-{prev_date.strftime('%Y%m%d')}-HIST-{outlet.outlet_id}"
        existing_order = db.query(Order).filter(Order.reference == hist_ref).first()
        if not existing_order:
            hist_order = Order(
                reference=hist_ref,
                outlet_id=outlet.outlet_id,
                brand=outlet.brand,
                temperature_class="AMBIENT",
                delivery_date=prev_date,
                status="DEFERRED",
                total_weight=rng.uniform(200, 600),
                total_volume=rng.uniform(1.0, 4.0),
                total_cases=10,
                placed_at=dt.datetime(prev_date.year, prev_date.month, prev_date.day, 10, 0, tzinfo=tz),
                placed_by_user_id=placed_by,
            )
            db.add(hist_order)
            db.flush()
            order_id = hist_order.id
        else:
            order_id = existing_order.id

        existing_def = db.query(Deferral).filter(
            Deferral.plan_id == plan_id,
            Deferral.order_id == order_id,
        ).first()
        if not existing_def:
            deferral = Deferral(
                plan_id=plan_id,
                order_id=order_id,
                reason_code="CAPACITY",
                explanation="Fleet capacity exceeded on previous run",
                consecutive_count=1,
                decided_by="SYSTEM",
                next_run_date=delivery_date,
            )
            db.add(deferral)

    db.flush()
    log.info("  ✓ Deferred %d outlets on %s", len(deferred_outlets), prev_date)


def seed_vehicle_fuel(db, delivery_date: dt.date) -> None:
    """Seed vehicle_weekly_fuel so ~5 vehicles are close to their weekly quota."""
    log.info("Seeding vehicle weekly fuel…")
    cal = db.get(CalendarDay, delivery_date)
    if not cal:
        log.warning("  Calendar day not found, skipping fuel seed")
        return

    iso_year = cal.iso_year
    iso_week = cal.iso_week
    rng = random.Random(77)

    vehicles = db.query(Vehicle).all()
    rng.shuffle(vehicles)

    # ~5 vehicles at >80% of their quota
    near_limit = vehicles[:5]
    rest = vehicles[5:]

    for v in near_limit:
        litres = round(v.weekly_fuel_quota_l * rng.uniform(0.82, 0.95), 1)
        stmt = (
            pg_insert(VehicleWeeklyFuel)
            .values(vehicle_id=v.vehicle_id, iso_year=iso_year, iso_week=iso_week, litres_used=litres)
            .on_conflict_do_update(
                index_elements=["vehicle_id", "iso_year", "iso_week"],
                set_={"litres_used": litres},
            )
        )
        db.execute(stmt)

    for v in rest:
        litres = round(v.weekly_fuel_quota_l * rng.uniform(0.10, 0.50), 1)
        stmt = (
            pg_insert(VehicleWeeklyFuel)
            .values(vehicle_id=v.vehicle_id, iso_year=iso_year, iso_week=iso_week, litres_used=litres)
            .on_conflict_do_update(
                index_elements=["vehicle_id", "iso_year", "iso_week"],
                set_={"litres_used": litres},
            )
        )
        db.execute(stmt)

    db.flush()
    log.info("  ✓ %d vehicles seeded (5 near quota: %s)",
             len(vehicles), [v.vehicle_id for v in near_limit])


def seed_sample_plan(db, delivery_date: dt.date) -> None:
    """
    Insert a published plan for a second day (for quick loader/driver demo).
    This is triggered by --with-sample-plan flag.
    """
    log.info("Seeding sample plan (--with-sample-plan)…")
    tz = dt.timezone(dt.timedelta(hours=5, minutes=30))

    # Find a second operating day after delivery_date
    second_date_cal = (
        db.query(CalendarDay)
        .filter(
            CalendarDay.date > delivery_date,
            CalendarDay.is_operating.is_(True),
            CalendarDay.is_holiday.is_(False),
            CalendarDay.is_weekend.is_(False),
        )
        .order_by(CalendarDay.date)
        .first()
    )
    if not second_date_cal:
        log.warning("  No second operating day found, skipping sample plan")
        return

    plan_date = second_date_cal.date
    log.info("  Sample plan date: %s", plan_date)

    dispatcher = db.query(User).filter(User.role == "DISPATCHER").first()

    existing_plan = db.query(Plan).filter(
        Plan.delivery_date == plan_date, Plan.status == "PUBLISHED"
    ).first()
    if existing_plan:
        log.info("  Sample plan already exists, skipping")
        return

    plan = Plan(
        delivery_date=plan_date,
        version=1,
        status="PUBLISHED",
        created_by=dispatcher.id if dispatcher else None,
        created_at=dt.datetime(plan_date.year, plan_date.month, plan_date.day, 18, 0, tzinfo=tz),
        published_at=dt.datetime(plan_date.year, plan_date.month, plan_date.day, 18, 30, tzinfo=tz),
        summary_json={"note": "demo plan for loader/driver screens"},
    )
    db.add(plan)
    db.flush()

    # Add one trip per depot with a few stops each
    peliyagoda_truck = db.query(Vehicle).filter(
        Vehicle.depot_code == "Peliyagoda", Vehicle.type == "truck", Vehicle.is_refrigerated.is_(True)
    ).first()

    if peliyagoda_truck:
        trip = Trip(
            plan_id=plan.id,
            vehicle_id=peliyagoda_truck.vehicle_id,
            trip_number=1,
            planned_depart=dt.datetime(plan_date.year, plan_date.month, plan_date.day, 5, 0, tzinfo=tz),
            planned_return=dt.datetime(plan_date.year, plan_date.month, plan_date.day, 14, 0, tzinfo=tz),
            planned_distance=150.0,
            planned_fuel=150.0 / peliyagoda_truck.km_per_l,
            status="LOADING",
        )
        db.add(trip)
        db.flush()

        # Add 3 stops
        colombo_outlets = db.query(Outlet).filter(
            Outlet.depot_code == "Peliyagoda", Outlet.brand == "Fresh"
        ).limit(3).all()

        for seq, outlet in enumerate(colombo_outlets, 1):
            stop = Stop(
                trip_id=trip.id,
                outlet_id=outlet.outlet_id,
                sequence=seq,
                planned_eta=dt.datetime(
                    plan_date.year, plan_date.month, plan_date.day,
                    5 + seq, 30, tzinfo=tz
                ),
                status="PENDING",
            )
            db.add(stop)

    db.flush()
    log.info("  ✓ Sample plan created for %s", plan_date)


def main(with_sample_plan: bool = False) -> None:
    log.info("═══ Waypoint seed starting ═══")
    db = SessionLocal()
    try:
        seed_depots(db)
        db.commit()

        seed_outlets(db)
        db.commit()

        seed_vehicles(db)
        db.commit()

        seed_calendar(db)
        db.commit()

        seed_users(db)
        db.commit()

        delivery_date = seed_demo_orders(db)
        db.commit()

        seed_history_deferrals(db, delivery_date)
        db.commit()

        seed_vehicle_fuel(db, delivery_date)
        db.commit()

        if with_sample_plan:
            seed_sample_plan(db, delivery_date)
            db.commit()

        log.info("═══ Seed complete ═══")
        log.info("")
        log.info("Demo credentials:")
        for u in DEMO_USERS:
            log.info("  %-20s  password: %s  role: %s", u["username"], u["password"], u["role"])

    except Exception as e:
        db.rollback()
        log.error("Seed FAILED: %s", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Waypoint seed script")
    parser.add_argument("--with-sample-plan", action="store_true",
                        help="Also insert a published plan for the next operating day")
    args = parser.parse_args()
    main(with_sample_plan=args.with_sample_plan)
