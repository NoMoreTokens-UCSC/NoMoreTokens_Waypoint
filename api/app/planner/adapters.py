"""DB <-> planner dataclass adapters."""
from __future__ import annotations

import datetime as dt

from sqlalchemy.orm import Session

from app.models.deferral import Deferral
from app.models.plan import Plan, Stop, StopOrder, Trip
from app.models.reference import CalendarDay, Outlet, Vehicle, VehicleWeeklyFuel
from app.models.order import Order
from app.planner.types import (
    PlannerContext,
    PlannerDeferral,
    PlannerOrder,
    PlannerOutlet,
    PlannerPlan,
    PlannerStop,
    PlannerTrip,
    PlannerVehicle,
)


def build_context(db: Session, delivery_date: dt.date) -> PlannerContext:
    """Convert DB rows into a PlannerContext for the given delivery date."""
    cal = db.get(CalendarDay, delivery_date)

    outlets_db = db.query(Outlet).all()
    vehicles_db = db.query(Vehicle).all()
    orders_db = (
        db.query(Order)
        .filter(Order.delivery_date == delivery_date, Order.status.in_(["QUEUED", "CONFIRMED"]))
        .all()
    )

    # Fuel usage for the current iso week
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

    outlets = {
        o.outlet_id: PlannerOutlet(
            outlet_id=o.outlet_id,
            brand=o.brand,
            district=o.district,
            depot_code=o.depot_code,
            van_only=o.van_only,
            is_mall=o.is_mall,
            mall_window_open=o.mall_window_open,
            mall_window_close=o.mall_window_close,
            window_open_time=o.window_open_time,
            window_close_time=o.window_close_time,
            lat=o.lat or 0.0,
            lng=o.lng or 0.0,
            dock_type=o.dock_type,
        )
        for o in outlets_db
    }

    vehicles = {
        v.vehicle_id: PlannerVehicle(
            vehicle_id=v.vehicle_id,
            type=v.type,
            is_refrigerated=v.is_refrigerated,
            weight_cap_kg=v.weight_cap_kg,
            volume_cap_m3=v.volume_cap_m3,
            km_per_l=v.km_per_l,
            weekly_fuel_quota_l=v.weekly_fuel_quota_l,
            fuel_used_this_week=fuel_by_vehicle.get(v.vehicle_id, 0.0),
            depot_code=v.depot_code,
            lat=0.0,  # depot coords — set from geo.py in full implementation
            lng=0.0,
        )
        for v in vehicles_db
    }

    orders = [
        PlannerOrder(
            order_id=o.id,
            outlet_id=o.outlet_id,
            brand=o.brand,
            temperature_class=o.temperature_class,
            total_weight=o.total_weight,
            total_volume=o.total_volume,
            priority=o.priority,
        )
        for o in orders_db
    ]

    return PlannerContext(
        delivery_date=delivery_date,
        outlets=outlets,
        vehicles=vehicles,
        orders=orders,
        is_monsoon=cal.monsoon if cal else False,
    )


def persist_plan(db: Session, planner_plan: PlannerPlan, created_by: int | None = None) -> Plan:
    """Persist a PlannerPlan to the DB and return the saved Plan model."""
    plan = Plan(
        delivery_date=planner_plan.delivery_date,
        status="DRAFT",
        created_by=created_by,
    )
    db.add(plan)
    db.flush()

    for pt in planner_plan.trips:
        trip = Trip(
            plan_id=plan.id,
            vehicle_id=pt.vehicle_id,
            trip_number=pt.trip_number,
            planned_distance=pt.planned_distance,
            planned_fuel=pt.planned_fuel,
            planned_depart=pt.planned_depart,
            planned_return=pt.planned_return,
            status="PLANNED",
        )
        db.add(trip)
        db.flush()

        for ps in pt.stops:
            stop = Stop(
                trip_id=trip.id,
                outlet_id=ps.outlet_id,
                sequence=ps.sequence,
                planned_eta=ps.planned_eta,
                status="PENDING",
            )
            db.add(stop)
            db.flush()

            for order_id in ps.order_ids:
                db.add(StopOrder(stop_id=stop.id, order_id=order_id))

    for pd in planner_plan.deferrals:
        db.add(Deferral(
            plan_id=plan.id,
            order_id=pd.order_id,
            reason_code=pd.reason_code,
            explanation=pd.explanation,
            consecutive_count=pd.consecutive_count,
            decided_by=pd.decided_by,
        ))

    db.flush()
    return plan
