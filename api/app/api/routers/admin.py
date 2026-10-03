"""Admin router — clock control and capacity forecast stub."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbDep, require_role
from app.core import clock

router = APIRouter(prefix="/admin", tags=["admin"])

_DISPATCHER = require_role("DISPATCHER")


class ClockAdvanceRequest(BaseModel):
    business_date: str  # ISO date string: YYYY-MM-DD


@router.post("/clock", status_code=status.HTTP_200_OK)
def advance_clock(
    body: ClockAdvanceRequest,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
):
    """Advance the business date for demo purposes. Dispatcher only."""
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


# ---------------------------------------------------------------------------
# Events poll — dispatcher monitor
# ---------------------------------------------------------------------------


@router.get("/events/poll")
def poll_events(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    since: Optional[dt.datetime] = None,
):
    """
    Returns changes (new flags, deferrals, trip status changes) since `since`.
    Used by the dispatcher monitor to poll for live updates.
    """
    from app.models.audit import AuditLog

    q = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(50)
    if since:
        q = q.filter(AuditLog.created_at > since)
    entries = q.all()
    return {
        "events": [
            {
                "id": e.id,
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ]
    }


# ---------------------------------------------------------------------------
# Capacity forecast stub
# ---------------------------------------------------------------------------


@router.get("/capacity/forecast", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def capacity_forecast(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DISPATCHER,
    date: Optional[dt.date] = None,
):
    """
    **Stub** — Phase 6.
    Returns total fleet capacity vs total demand for the given date.
    Response: `{"date": "...", "total_weight_cap": ..., "total_demand_weight": ..., ...}`.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "NOT_IMPLEMENTED", "message": "Capacity forecast not yet implemented (Phase 6)."},
    )
