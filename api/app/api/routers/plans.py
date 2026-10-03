"""Plans router — dispatcher creates and publishes delivery plans."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Query, status
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbDep, require_role
from app.core import clock
from app.models.deferral import Deferral
from app.models.notification import Notification
from app.models.order import Order
from app.models.plan import Plan, Stop, StopOrder, Trip
from app.schemas.plan import DeferralOut, PlanOut
from app.services.audit import log_action
from app.services.state_machine import transition_order, transition_trip

log = logging.getLogger("waypoint.plans")

router = APIRouter(prefix="/plans", tags=["plans"])

_DISPATCHER = require_role("DISPATCHER")


def _load_plan(db, plan_id: int) -> Plan:
    plan = db.get(
        Plan, plan_id,
        options=[selectinload(Plan.trips).selectinload(Trip.stops)]
    )
    if not plan:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Plan not found."})
    return plan


# ── Read ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[PlanOut])
def list_plans(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    date: Optional[dt.date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    q = db.query(Plan).options(selectinload(Plan.trips).selectinload(Trip.stops))
    if date:
        q = q.filter(Plan.delivery_date == date)
    if status_filter:
        q = q.filter(Plan.status == status_filter)
    return q.order_by(Plan.created_at.desc()).all()


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: int, db: DbDep, current_user: CurrentUser, _: None = _DISPATCHER):
    return _load_plan(db, plan_id)


# ── Auto-plan ─────────────────────────────────────────────────────────────────

@router.post("/auto-plan", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def auto_plan(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    date: Optional[dt.date] = Query(None),
):
    """
    Run the greedy bin-packing allocation algorithm for `date` (default: tomorrow).
    Creates a DRAFT plan. Supersedes any previous DRAFT for the same date.
    """
    from app.planner.allocate import allocate
    from app.planner.adapters import build_context, persist_plan
    from app.planner.validate import validate_plan
    from app.models.reference import CalendarDay

    delivery_date = date or clock.delivery_date()

    # Validate the date is an operating day
    cal = db.get(CalendarDay, delivery_date)
    if cal and not cal.is_operating:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NOT_OPERATING", "message": f"{delivery_date} is not an operating day."},
        )

    # Check there are orders to plan
    orders_count = (
        db.query(Order)
        .filter(
            Order.delivery_date == delivery_date,
            Order.status.in_(["QUEUED", "CONFIRMED"]),
        )
        .count()
    )
    if orders_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_ORDERS", "message": f"No QUEUED/CONFIRMED orders for {delivery_date}."},
        )

    log.info("auto-plan: building context for %s (%d orders)", delivery_date, orders_count)

    ctx = build_context(db, delivery_date)
    planner_plan = allocate(ctx)

    # Supersede any previous DRAFT for the same date
    existing_drafts = db.query(Plan).filter(
        Plan.delivery_date == delivery_date, Plan.status == "DRAFT"
    ).all()
    for draft in existing_drafts:
        draft.status = "SUPERSEDED"

    plan = persist_plan(db, planner_plan, created_by=current_user.id)

    # Compute summary
    n_trips = len(planner_plan.trips)
    n_orders = sum(len(s.order_ids) for t in planner_plan.trips for s in t.stops)
    n_deferred = len(planner_plan.deferrals)
    plan.summary_json = {
        "trips": n_trips,
        "orders_planned": n_orders,
        "orders_deferred": n_deferred,
        "total_km": round(sum(t.planned_distance for t in planner_plan.trips), 1),
        "total_fuel_l": round(sum(t.planned_fuel for t in planner_plan.trips), 1),
    }

    log.info(
        "auto-plan: %d trips, %d orders planned, %d deferred",
        n_trips, n_orders, n_deferred,
    )

    violations = validate_plan(planner_plan, ctx)
    errors = [v for v in violations if v.severity == "ERROR"]
    if errors:
        log.warning("auto-plan: %d constraint violations", len(errors))
        plan.summary_json["violations"] = [
            {"rule": v.rule, "message": v.message} for v in errors
        ]

    log_action(db, "AUTO_PLAN", "Plan", plan.id, actor_user_id=current_user.id,
               after=plan.summary_json)
    db.commit()
    db.refresh(plan)
    return plan


# ── Validate ─────────────────────────────────────────────────────────────────

@router.post("/{plan_id}/validate")
def validate_plan_endpoint(
    plan_id: int,
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
):
    """Run all constraint validators against the plan and return violations."""
    from app.planner.adapters import build_context
    from app.planner.validate import validate_plan as run_validate
    from app.planner.types import PlannerPlan, PlannerTrip, PlannerStop

    plan = _load_plan(db, plan_id)
    ctx = build_context(db, plan.delivery_date)

    # Reconstruct PlannerPlan from DB for validation
    planner_plan = PlannerPlan(delivery_date=plan.delivery_date)
    for trip in plan.trips:
        p_trip = PlannerTrip(
            vehicle_id=trip.vehicle_id,
            trip_number=trip.trip_number,
            planned_distance=trip.planned_distance or 0.0,
            planned_fuel=trip.planned_fuel or 0.0,
        )
        for stop in trip.stops:
            order_ids = [so.order_id for so in
                         db.query(StopOrder).filter(StopOrder.stop_id == stop.id).all()]
            p_trip.stops.append(PlannerStop(
                outlet_id=stop.outlet_id,
                order_ids=order_ids,
                sequence=stop.sequence,
                planned_eta=stop.planned_eta,
            ))
        planner_plan.trips.append(p_trip)

    violations = run_validate(planner_plan, ctx)
    return {
        "plan_id": plan_id,
        "violations": [
            {
                "rule": v.rule,
                "severity": v.severity,
                "trip_vehicle_id": v.trip_vehicle_id,
                "stop_outlet_id": v.stop_outlet_id,
                "order_id": v.order_id,
                "message": v.message,
            }
            for v in violations
        ],
        "valid": all(v.severity != "ERROR" for v in violations),
    }


# ── Edit (manual move) ────────────────────────────────────────────────────────

@router.patch("/{plan_id}", status_code=status.HTTP_200_OK)
def edit_plan(
    plan_id: int,
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    body: dict[str, Any] = Body(...),
):
    """
    Manual plan edit. Supported operations in `body.moves`:
    ```json
    {
      "moves": [
        {"order_id": 123, "to_trip_id": 45, "sequence": 3}
      ]
    }
    ```
    Validates WEIGHT/VOLUME/TEMP constraints after each move.
    """
    from app.planner.validate import _check_weight, _check_volume, _check_temp
    from app.planner.adapters import build_context
    from app.planner.types import PlannerTrip, PlannerStop

    plan = _load_plan(db, plan_id)
    if plan.status == "PUBLISHED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "PLAN_PUBLISHED", "message": "Cannot edit a published plan."},
        )

    ctx = build_context(db, plan.delivery_date)
    moves: list[dict] = body.get("moves", [])

    for move in moves:
        order_id = move.get("order_id")
        to_trip_id = move.get("to_trip_id")
        new_sequence = move.get("sequence")

        if not order_id or not to_trip_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_MOVE", "message": "Each move requires order_id and to_trip_id."},
            )

        order = db.get(Order, order_id)
        target_trip = db.get(Trip, to_trip_id)

        if not order or not target_trip or target_trip.plan_id != plan_id:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order or trip not found."})

        # Remove from current stop
        existing = db.query(StopOrder).filter(StopOrder.order_id == order_id).first()
        if existing:
            db.delete(existing)
            db.flush()

        # Find or create stop for this outlet on target trip
        existing_stop = next(
            (s for s in target_trip.stops if s.outlet_id == order.outlet_id), None
        )
        if not existing_stop:
            seq = new_sequence or (max((s.sequence for s in target_trip.stops), default=0) + 1)
            existing_stop = Stop(
                trip_id=to_trip_id,
                outlet_id=order.outlet_id,
                sequence=seq,
                status="PENDING",
            )
            db.add(existing_stop)
            db.flush()

        db.add(StopOrder(stop_id=existing_stop.id, order_id=order_id))

    log_action(db, "EDIT_PLAN", "Plan", plan_id, actor_user_id=current_user.id,
               after={"moves": len(moves)})
    db.commit()
    db.refresh(plan)
    return plan


# ── Publish ───────────────────────────────────────────────────────────────────

@router.post("/{plan_id}/publish", status_code=status.HTTP_200_OK)
def publish_plan(
    plan_id: int,
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
):
    """
    Publish a DRAFT plan:
    1. Validates — rejects if any ERROR-severity constraint violations exist.
    2. Marks DRAFT → PUBLISHED, supersedes previous PUBLISHED plan.
    3. Advances order statuses: QUEUED/CONFIRMED → PLANNED.
    4. Sets Trip status to PLANNED (→ ready for loader to start LOADING).
    5. Broadcasts notifications to all loaders.
    6. Records audit log entry.
    """
    from app.planner.adapters import build_context
    from app.planner.validate import validate_plan as run_validate
    from app.planner.types import PlannerPlan, PlannerTrip, PlannerStop

    plan = _load_plan(db, plan_id)

    if plan.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "NOT_DRAFT", "message": f"Plan is {plan.status!r}, can only publish a DRAFT."},
        )

    ctx = build_context(db, plan.delivery_date)

    # Reconstruct for validation
    planner_plan = PlannerPlan(delivery_date=plan.delivery_date)
    for trip in plan.trips:
        p_trip = PlannerTrip(
            vehicle_id=trip.vehicle_id,
            trip_number=trip.trip_number,
            planned_distance=trip.planned_distance or 0.0,
            planned_fuel=trip.planned_fuel or 0.0,
        )
        for stop in trip.stops:
            order_ids = [so.order_id for so in
                         db.query(StopOrder).filter(StopOrder.stop_id == stop.id).all()]
            p_trip.stops.append(PlannerStop(
                outlet_id=stop.outlet_id,
                order_ids=order_ids,
                sequence=stop.sequence,
                planned_eta=stop.planned_eta,
            ))
        planner_plan.trips.append(p_trip)

    violations = run_validate(planner_plan, ctx)
    errors = [v for v in violations if v.severity == "ERROR"]
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "CONSTRAINT_VIOLATIONS",
                "message": f"{len(errors)} hard constraint violation(s). Resolve before publishing.",
                "details": {"violations": [{"rule": v.rule, "message": v.message} for v in errors]},
            },
        )

    # Supersede previous PUBLISHED plan for same date
    old_published = db.query(Plan).filter(
        Plan.delivery_date == plan.delivery_date,
        Plan.status == "PUBLISHED",
    ).all()
    for old in old_published:
        old.status = "SUPERSEDED"

    # Publish
    plan.status = "PUBLISHED"
    plan.published_at = clock.now()

    # Advance all planned orders
    all_stop_order_ids: set[int] = set()
    for trip in plan.trips:
        for stop in trip.stops:
            for so in db.query(StopOrder).filter(StopOrder.stop_id == stop.id).all():
                all_stop_order_ids.add(so.order_id)

    orders_planned = 0
    for order_id in all_stop_order_ids:
        order = db.get(Order, order_id)
        if order and order.status in ("QUEUED", "CONFIRMED"):
            order.status = "PLANNED"
            orders_planned += 1

    # Broadcast notification to loaders
    db.add(Notification(
        target_role="LOADER",
        type="PLAN_PUBLISHED",
        payload_json={
            "plan_id": plan_id,
            "delivery_date": str(plan.delivery_date),
            "trips": len(plan.trips),
        },
    ))

    log_action(db, "PUBLISH_PLAN", "Plan", plan_id, actor_user_id=current_user.id,
               after={"status": "PUBLISHED", "orders_planned": orders_planned})
    db.commit()
    db.refresh(plan)

    return {
        "plan_id": plan_id,
        "status": plan.status,
        "published_at": plan.published_at.isoformat(),
        "orders_planned": orders_planned,
        "trips": len(plan.trips),
    }
