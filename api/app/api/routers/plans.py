"""Plans router — dispatcher creates and manages delivery plans."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbDep, require_role
from app.core import clock
from app.models.deferral import Deferral
from app.models.order import Order
from app.models.plan import Plan, Stop, Trip
from app.schemas.plan import DeferralOut, PlanOut

router = APIRouter(prefix="/plans", tags=["plans"])

_DISPATCHER = require_role("DISPATCHER")


@router.get("", response_model=list[PlanOut])
def list_plans(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    date: Optional[dt.date] = Query(None),
):
    q = db.query(Plan).options(selectinload(Plan.trips).selectinload(Trip.stops))
    if date:
        q = q.filter(Plan.delivery_date == date)
    return q.order_by(Plan.created_at.desc()).all()


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(
    plan_id: int,
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
):
    plan = db.get(
        Plan, plan_id,
        options=[selectinload(Plan.trips).selectinload(Trip.stops)]
    )
    if not plan:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Plan not found."})
    return plan


# ---------------------------------------------------------------------------
# Stubs — Phase 6 planner will implement these
# ---------------------------------------------------------------------------


@router.post("/auto-plan", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def auto_plan(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    date: Optional[dt.date] = Query(None),
):
    """
    **Stub** — Phase 6.
    Runs the constraint-satisfaction allocation algorithm and returns a DRAFT plan.
    Body: `{"delivery_date": "2024-04-10"}`
    Response: `PlanOut` (see schema).
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "NOT_IMPLEMENTED", "message": "Auto-plan algorithm not yet implemented (Phase 6)."},
    )


@router.post("/{plan_id}/validate", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def validate_plan(plan_id: int, db: DbDep, current_user: CurrentUser, _: None = _DISPATCHER):
    """
    **Stub** — Phase 6.
    Runs all constraint validators against a DRAFT plan and returns violations.
    Response: `{"violations": [...]}`.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "NOT_IMPLEMENTED", "message": "Plan validation not yet implemented (Phase 6)."},
    )


@router.patch("/{plan_id}", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def edit_plan(plan_id: int, db: DbDep, current_user: CurrentUser, _: None = _DISPATCHER):
    """
    **Stub** — Phase 6.
    Manual edits: move an order between trips, change stop sequence.
    Body: `{"move": [{"order_id": ..., "to_trip_id": ..., "sequence": ...}]}`.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "NOT_IMPLEMENTED", "message": "Manual plan editing not yet implemented (Phase 6)."},
    )


@router.post("/{plan_id}/publish", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def publish_plan(plan_id: int, db: DbDep, current_user: CurrentUser, _: None = _DISPATCHER):
    """
    **Stub** — Phase 6.
    Publishes a DRAFT plan: marks it PUBLISHED, supersedes any prior published plan,
    advances order statuses to PLANNED, and sends notifications.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "NOT_IMPLEMENTED", "message": "Plan publishing not yet implemented (Phase 6)."},
    )
