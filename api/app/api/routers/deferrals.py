"""Deferrals router — dispatcher views and manages deferrals."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbDep, require_role
from app.core import clock
from app.models.deferral import Deferral
from app.models.order import Order
from app.models.plan import Plan, Stop, StopOrder
from app.models.reference import CalendarDay
from app.schemas.order import DeferralCreate, DeferralHistoryOut
from app.schemas.plan import DeferralOut
from app.services.audit import log_action
from app.services.calendar import previous_operating_day
from app.services.state_machine import transition_order

router = APIRouter(prefix="/deferrals", tags=["deferrals"])

_DISPATCHER = require_role("DISPATCHER")


@router.post("", response_model=DeferralOut, status_code=status.HTTP_201_CREATED)
def create_deferral(
    body: DeferralCreate,
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
):
    order = db.get(Order, body.order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Order not found."},
        )

    # Find the active DRAFT or PUBLISHED plan for this order's delivery date
    plan = (
        db.query(Plan)
        .filter(Plan.delivery_date == order.delivery_date, Plan.status.in_(["DRAFT", "PUBLISHED"]))
        .order_by(Plan.id.desc())
        .first()
    )
    if not plan:
        plan = Plan(delivery_date=order.delivery_date, status="DRAFT", created_by=current_user.id)
        db.add(plan)
        db.flush()

    # Unallocate from any trip stop if previously assigned
    existing_so = db.query(StopOrder).filter(StopOrder.order_id == order.id).first()
    if existing_so:
        old_stop = db.get(Stop, existing_so.stop_id)
        db.delete(existing_so)
        db.flush()
        if old_stop and db.query(StopOrder).filter(StopOrder.stop_id == old_stop.id).count() == 0:
            db.delete(old_stop)
            db.flush()

    # Consecutive means the outlet was also deferred on the previous operating day.
    previous_day = previous_operating_day(db, order.delivery_date)
    last_deferral = (
        db.query(Deferral)
        .join(Order, Deferral.order_id == Order.id)
        .filter(Order.outlet_id == order.outlet_id, Order.delivery_date == previous_day)
        .order_by(Deferral.decided_at.desc())
        .first()
    ) if previous_day else None
    consec = (last_deferral.consecutive_count + 1) if last_deferral else 1

    # Check consecutive limit rule BR-07
    if consec >= 2 and not body.is_override:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "CONSECUTIVE_DEFERRAL_LIMIT",
                "message": f"Outlet {order.outlet_id} cannot be deferred 2 consecutive operating days without override.",
            },
        )

    next_day_row = (
        db.query(CalendarDay)
        .filter(CalendarDay.date > order.delivery_date, CalendarDay.is_operating == True)
        .order_by(CalendarDay.date.asc())
        .first()
    )
    next_date = next_day_row.date if next_day_row else (order.delivery_date + dt.timedelta(days=1))

    deferral = Deferral(
        plan_id=plan.id,
        order_id=order.id,
        reason_code=body.reason_code,
        explanation=body.explanation or f"Deferred by dispatcher: {body.reason_code}",
        consecutive_count=consec,
        decided_by=str(current_user.id),
        decided_at=clock.now(),
        next_run_date=next_date,
        is_override=body.is_override,
    )
    db.add(deferral)

    # Transition order to DEFERRED
    transition_order(order, "DEFERRED")

    log_action(
        db,
        "DEFER_ORDER",
        "Order",
        order.id,
        actor_user_id=current_user.id,
        after={"reason_code": body.reason_code, "consecutive_count": consec},
    )
    db.commit()
    db.refresh(deferral)
    return deferral


@router.get("", response_model=list[DeferralOut])
def list_deferrals(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    date: Optional[dt.date] = Query(None),
):
    q = db.query(Deferral)
    if date:
        # Filter by plan's delivery_date
        from app.models.plan import Plan
        q = q.join(Plan, Deferral.plan_id == Plan.id).filter(Plan.delivery_date == date)
    return q.order_by(Deferral.decided_at.desc()).all()


@router.get("/outlets/{outlet_id}/history", response_model=list[DeferralHistoryOut])
def outlet_deferral_history(
    outlet_id: str,
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
):
    """Returns the deferral history for a specific outlet (via its orders)."""
    return (
        db.query(Deferral)
        .join(Order, Deferral.order_id == Order.id)
        .filter(Order.outlet_id == outlet_id)
        .order_by(Deferral.decided_at.desc())
        .all()
    )
