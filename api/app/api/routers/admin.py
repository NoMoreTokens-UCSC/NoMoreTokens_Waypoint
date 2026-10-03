"""Admin router — clock control, events poll, capacity forecast, analytics."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func

from app.api.deps import CurrentUser, DbDep, require_role
from app.core import clock
from app.models.audit import AuditLog
from app.models.deferral import Deferral
from app.models.order import Order
from app.models.plan import Plan, Trip
from app.models.reference import CalendarDay, Vehicle, VehicleWeeklyFuel

router = APIRouter(prefix="/admin", tags=["admin"])

_DISPATCHER = require_role("DISPATCHER")


class ClockAdvanceRequest(BaseModel):
    business_date: str  # ISO date string: YYYY-MM-DD


# ── Clock ────────────────────────────────────────────────────────────────────

@router.post("/clock", status_code=status.HTTP_200_OK)
def advance_clock(body: ClockAdvanceRequest, current_user: CurrentUser, _: None = _DISPATCHER):
    """Advance the business date for demo purposes."""
    try:
        dt.date.fromisoformat(body.business_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DATE", "message": "business_date must be YYYY-MM-DD."},
        )
    clock.advance_business_date(body.business_date)
    return {"business_date": body.business_date, "now": clock.now().isoformat()}


@router.get("/clock")
def get_clock(current_user: CurrentUser, _: None = _DISPATCHER):
    return {
        "business_date": str(clock.today()),
        "now": clock.now().isoformat(),
        "delivery_date": str(clock.delivery_date()),
        "past_cutoff": clock.is_past_cutoff(),
    }


# ── Events poll ───────────────────────────────────────────────────────────────

@router.get("/events/poll")
def poll_events(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    since: Optional[dt.datetime] = Query(None),
    limit: int = Query(50, le=200),
):
    """Returns recent audit events. Used by the dispatcher monitor for live updates."""
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if since:
        q = db.query(AuditLog).filter(AuditLog.created_at > since).order_by(AuditLog.created_at.desc()).limit(limit)
    entries = q.all()
    return {
        "events": [
            {
                "id": e.id,
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "after": e.after_json,
                "created_at": e.created_at.isoformat(),
            }
            for e in reversed(entries)   # chronological order
        ],
        "count": len(entries),
    }


# ── Capacity forecast ─────────────────────────────────────────────────────────

@router.get("/capacity/forecast")
def capacity_forecast(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    date: Optional[dt.date] = Query(None),
):
    """
    Demand vs fleet capacity summary for the given date.
    Breakdown by depot, temperature class, and vehicle type.
    """
    target_date = date or clock.delivery_date()
    cal = db.get(CalendarDay, target_date)

    # Fleet capacity
    vehicles = db.query(Vehicle).all()

    # Weekly fuel used this week
    if cal:
        fuel_rows = (
            db.query(VehicleWeeklyFuel)
            .filter(
                VehicleWeeklyFuel.iso_year == cal.iso_year,
                VehicleWeeklyFuel.iso_week == cal.iso_week,
            )
            .all()
        )
        fuel_by_vehicle = {r.vehicle_id: r.litres_used for r in fuel_rows}
    else:
        fuel_by_vehicle = {}

    # Per-depot capacity (2 trips max per vehicle, but penalise near-quota vehicles)
    depot_caps: dict[str, dict] = {}
    for v in vehicles:
        d = v.depot_code
        if d not in depot_caps:
            depot_caps[d] = {
                "weight_kg": 0.0, "volume_m3": 0.0,
                "reefer_weight_kg": 0.0, "reefer_volume_m3": 0.0,
                "vehicles_total": 0, "vehicles_fuel_ok": 0,
            }
        remaining_fuel = (v.weekly_fuel_quota_l - fuel_by_vehicle.get(v.vehicle_id, 0.0)) * 0.95
        # rough km range: remaining_fuel * km_per_l
        km_range = remaining_fuel * v.km_per_l
        # if range < 100 km, only allow 1 trip; otherwise allow 2
        trips = 2 if km_range >= 100 else 1
        depot_caps[d]["weight_kg"] += v.weight_cap_kg * trips
        depot_caps[d]["volume_m3"] += v.volume_cap_m3 * trips
        depot_caps[d]["vehicles_total"] += 1
        if remaining_fuel > 50:
            depot_caps[d]["vehicles_fuel_ok"] += 1
        if v.is_refrigerated:
            depot_caps[d]["reefer_weight_kg"] += v.weight_cap_kg * trips
            depot_caps[d]["reefer_volume_m3"] += v.volume_cap_m3 * trips

    # Demand for the date
    orders = (
        db.query(Order)
        .filter(
            Order.delivery_date == target_date,
            Order.status.in_(["QUEUED", "CONFIRMED", "PLANNED"]),
        )
        .all()
    )

    total_demand_w = sum(o.total_weight for o in orders)
    total_demand_v = sum(o.total_volume for o in orders)
    chilled_demand_w = sum(o.total_weight for o in orders if o.temperature_class in ("CHILLED", "FROZEN"))
    chilled_demand_v = sum(o.total_volume for o in orders if o.temperature_class in ("CHILLED", "FROZEN"))

    total_fleet_w = sum(c["weight_kg"] for c in depot_caps.values())
    total_fleet_v = sum(c["volume_m3"] for c in depot_caps.values())
    total_reefer_w = sum(c["reefer_weight_kg"] for c in depot_caps.values())
    total_reefer_v = sum(c["reefer_volume_m3"] for c in depot_caps.values())

    # Deferral count for the date
    deferred_count = (
        db.query(func.count(Deferral.id))
        .join(Plan, Deferral.plan_id == Plan.id)
        .filter(Plan.delivery_date == target_date)
        .scalar() or 0
    )

    def _pct(num: float, den: float) -> Optional[float]:
        return round(100 * num / den, 1) if den > 0 else None

    return {
        "date": str(target_date),
        "calendar": {
            "is_operating": cal.is_operating if cal else None,
            "is_payday": cal.is_payday if cal else None,
            "festival": cal.festival if cal else None,
            "festival_ramp": cal.festival_ramp if cal else None,
            "is_monsoon": cal.monsoon if cal else None,
        },
        "demand": {
            "orders": len(orders),
            "total_weight_kg": round(total_demand_w, 1),
            "total_volume_m3": round(total_demand_v, 2),
            "chilled_weight_kg": round(chilled_demand_w, 1),
            "chilled_volume_m3": round(chilled_demand_v, 2),
            "orders_deferred": deferred_count,
        },
        "fleet": {
            "total_weight_kg": round(total_fleet_w, 1),
            "total_volume_m3": round(total_fleet_v, 2),
            "reefer_weight_kg": round(total_reefer_w, 1),
            "reefer_volume_m3": round(total_reefer_v, 2),
        },
        "utilisation": {
            "weight_pct": _pct(total_demand_w, total_fleet_w),
            "volume_pct": _pct(total_demand_v, total_fleet_v),
            "reefer_weight_pct": _pct(chilled_demand_w, total_reefer_w),
            "reefer_volume_pct": _pct(chilled_demand_v, total_reefer_v),
        },
        "depots": {
            depot: {
                "capacity_weight_kg": round(cap["weight_kg"], 1),
                "capacity_volume_m3": round(cap["volume_m3"], 2),
                "reefer_weight_kg": round(cap["reefer_weight_kg"], 1),
                "reefer_volume_m3": round(cap["reefer_volume_m3"], 2),
                "vehicles_total": cap["vehicles_total"],
                "vehicles_fuel_ok": cap["vehicles_fuel_ok"],
            }
            for depot, cap in depot_caps.items()
        },
    }


# ── Analytics: daily summary ──────────────────────────────────────────────────

@router.get("/analytics/daily")
def daily_summary(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    date: Optional[dt.date] = Query(None),
):
    """Summary of delivery performance for a completed day."""
    target_date = date or clock.today()

    from app.models.delivery import DeliveryEvent
    from app.models.plan import Stop

    # Order status breakdown
    orders = db.query(Order).filter(Order.delivery_date == target_date).all()
    status_counts: dict[str, int] = {}
    for o in orders:
        status_counts[o.status] = status_counts.get(o.status, 0) + 1

    # Trip completion
    trips = (
        db.query(Trip)
        .join(Plan, Trip.plan_id == Plan.id)
        .filter(Plan.delivery_date == target_date)
        .all()
    )
    trip_status: dict[str, int] = {}
    for t in trips:
        trip_status[t.status] = trip_status.get(t.status, 0) + 1

    # Stop outcomes
    stops_q = (
        db.query(Stop)
        .join(Trip, Stop.trip_id == Trip.id)
        .join(Plan, Trip.plan_id == Plan.id)
        .filter(Plan.delivery_date == target_date)
        .all()
    )
    stop_status: dict[str, int] = {}
    for s in stops_q:
        stop_status[s.status] = stop_status.get(s.status, 0) + 1

    return {
        "date": str(target_date),
        "orders": {
            "total": len(orders),
            "by_status": status_counts,
            "delivered": status_counts.get("DELIVERED", 0) + status_counts.get("PARTIAL", 0),
            "failed": status_counts.get("FAILED", 0),
            "deferred": status_counts.get("DEFERRED", 0),
        },
        "trips": {
            "total": len(trips),
            "by_status": trip_status,
            "completed": trip_status.get("COMPLETED", 0),
        },
        "stops": {
            "total": len(stops_q),
            "by_status": stop_status,
        },
    }


# ── Analytics: weekly fuel ────────────────────────────────────────────────────

@router.get("/analytics/fuel")
def fuel_summary(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    iso_year: Optional[int] = Query(None),
    iso_week: Optional[int] = Query(None),
):
    """Per-vehicle fuel usage vs quota for the specified ISO week."""
    cal = db.get(CalendarDay, clock.today())
    year = iso_year or (cal.iso_year if cal else dt.date.today().isocalendar()[0])
    week = iso_week or (cal.iso_week if cal else dt.date.today().isocalendar()[1])

    fuel_rows = (
        db.query(VehicleWeeklyFuel)
        .filter(VehicleWeeklyFuel.iso_year == year, VehicleWeeklyFuel.iso_week == week)
        .all()
    )
    fuel_by_v = {r.vehicle_id: r.litres_used for r in fuel_rows}

    vehicles = db.query(Vehicle).all()
    result = []
    for v in sorted(vehicles, key=lambda x: x.vehicle_id):
        used = fuel_by_v.get(v.vehicle_id, 0.0)
        result.append({
            "vehicle_id": v.vehicle_id,
            "depot_code": v.depot_code,
            "type": v.type,
            "is_refrigerated": v.is_refrigerated,
            "quota_l": v.weekly_fuel_quota_l,
            "used_l": round(used, 1),
            "remaining_l": round(v.weekly_fuel_quota_l - used, 1),
            "pct_used": round(100 * used / v.weekly_fuel_quota_l, 1) if v.weekly_fuel_quota_l else 0,
            "near_limit": used >= v.weekly_fuel_quota_l * 0.80,
        })

    return {"iso_year": year, "iso_week": week, "vehicles": result}
