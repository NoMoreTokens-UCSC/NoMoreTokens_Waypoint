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
        options=[selectinload(Plan.trips).selectinload(Trip.stops).selectinload(Stop.outlet_rel)]
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
    q = db.query(Plan).options(selectinload(Plan.trips).selectinload(Trip.stops).selectinload(Stop.outlet_rel))
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

    # Check there are orders to plan; auto-confirm any PLACED orders first
    placed_orders = (
        db.query(Order)
        .filter(Order.delivery_date == delivery_date, Order.status == "PLACED")
        .all()
    )
    for po in placed_orders:
        transition_order(po, "CONFIRMED")
        transition_order(po, "QUEUED")
    if placed_orders:
        db.flush()

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


def _detach_order_from_plan(db, order_id: int, plan_id: int) -> None:
    """Remove an order from every stop on this plan, dropping stops left empty.

    Scoped to one plan: an order can appear on superseded plans too, and removing
    a row from one of those would leave the order in place on the plan being edited.
    """
    rows = (
        db.query(StopOrder)
        .join(Stop, Stop.id == StopOrder.stop_id)
        .join(Trip, Trip.id == Stop.trip_id)
        .filter(StopOrder.order_id == order_id, Trip.plan_id == plan_id)
        .all()
    )
    stop_ids = {row.stop_id for row in rows}
    for row in rows:
        db.delete(row)
    db.flush()
    for stop_id in stop_ids:
        stop = db.get(Stop, stop_id)
        if stop and db.query(StopOrder).filter(StopOrder.stop_id == stop_id).count() == 0:
            db.delete(stop)
    db.flush()


def _trip_violations(db, trip_id: int, ctx) -> list[str]:
    """Blocking rule messages for one trip as currently stored: capacity, temperature,
    van-only access, home depot. Window misses are warnings and do not appear here."""
    from app.planner.types import PlannerStop, PlannerTrip
    from app.planner.validate import validate_trip

    trip = db.get(Trip, trip_id)
    p_trip = PlannerTrip(vehicle_id=trip.vehicle_id, trip_number=trip.trip_number)
    for stop in db.query(Stop).filter(Stop.trip_id == trip_id).order_by(Stop.sequence).all():
        order_ids = [so.order_id for so in db.query(StopOrder).filter(StopOrder.stop_id == stop.id).all()]
        p_trip.stops.append(
            PlannerStop(
                outlet_id=stop.outlet_id,
                order_ids=order_ids,
                sequence=stop.sequence,
                planned_eta=stop.planned_eta,
            )
        )
    return [v.message for v in validate_trip(p_trip, ctx) if v.severity == "ERROR"]


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
    touched_trips: set[int] = set()

    for move in moves:
        order_id = move.get("order_id")
        to_trip_id = move.get("to_trip_id")
        new_sequence = move.get("sequence")

        if not order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_MOVE", "message": "Each move requires order_id."},
            )

        order = db.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order not found."})

        # Remove from its current stop on this plan
        _detach_order_from_plan(db, order_id, plan_id)

        # If to_trip_id is None, this is an unallocation move
        if to_trip_id is None:
            order.status = "QUEUED"
            continue

        target_trip = db.get(Trip, to_trip_id)
        if not target_trip or target_trip.plan_id != plan_id:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Trip not found."})
        touched_trips.add(target_trip.id)

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
        order.status = "PLANNED"

    for trip_id in touched_trips:
        messages = _trip_violations(db, trip_id, ctx)
        if messages:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "CONSTRAINT_VIOLATIONS", "message": messages[0]},
            )

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

    # Every deferral needs a reason, and a priority outlet cannot be left unserved.
    for d in plan.deferrals:
        if not d.reason_code:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "DEFERRAL_REASON_REQUIRED", "message": f"Order {d.order_id} needs a deferral reason."},
            )
        d_order = db.get(Order, d.order_id)
        if d_order and d_order.priority:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "PRIORITY_OUTLET_UNSERVED", "message": f"Order {d.order_id} is a priority order and must be served."},
            )

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

    # No order may be left unexplained: it is either on a stop or recorded as a deferral.
    planned_order_ids = {
        so.order_id
        for trip in plan.trips
        for stop in trip.stops
        for so in db.query(StopOrder).filter(StopOrder.stop_id == stop.id).all()
    }
    deferred_order_ids = {d.order_id for d in plan.deferrals}
    unexplained = (
        db.query(Order)
        .filter(
            Order.delivery_date == plan.delivery_date,
            Order.status.in_(["PLACED", "CONFIRMED", "QUEUED"]),
        )
        .all()
    )
    unexplained = [
        o for o in unexplained if o.id not in planned_order_ids and o.id not in deferred_order_ids
    ]
    if unexplained:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "ORDERS_UNRESOLVED",
                "message": (
                    f"{len(unexplained)} order(s) are neither allocated nor deferred. "
                    "Allocate them or record a deferral reason before publishing."
                ),
                "details": {"order_ids": [o.id for o in unexplained][:20]},
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
        trip.status = "PLANNED"
        for stop in trip.stops:
            for so in db.query(StopOrder).filter(StopOrder.stop_id == stop.id).all():
                all_stop_order_ids.add(so.order_id)

    orders_planned = 0
    for order_id in all_stop_order_ids:
        order = db.get(Order, order_id)
        if order and order.status in ("QUEUED", "CONFIRMED"):
            order.status = "PLANNED"
            orders_planned += 1

    # Also transition deferred orders on this plan to DEFERRED, unless they were later allocated to a stop.
    for d in plan.deferrals:
        d_order = db.get(Order, d.order_id)
        if d_order and d_order.id in all_stop_order_ids:
            continue
        if d_order and d_order.status != "DEFERRED":
            d_order.status = "DEFERRED"

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
