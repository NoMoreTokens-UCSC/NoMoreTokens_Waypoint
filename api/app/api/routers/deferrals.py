"""Deferrals router — dispatcher views and manages deferrals."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbDep, require_role
from app.models.deferral import Deferral
from app.models.order import Order
from app.schemas.plan import DeferralOut
from app.schemas.order import DeferralHistoryOut

router = APIRouter(prefix="/deferrals", tags=["deferrals"])

_DISPATCHER = require_role("DISPATCHER")


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
