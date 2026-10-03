"""Driver router — current trip, stop events, offline sync, photo upload."""
from __future__ import annotations

import os
import uuid
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbDep, require_role
from app.core.config import get_settings
from app.models.delivery import DeliveryEvent
from app.models.plan import Stop, Trip, Plan
from app.schemas.plan import DeliveryEventIn, DeliveryEventResult, StopOut, SyncBatch, TripOut
from app.services.audit import log_action
from app.services.state_machine import transition_stop, transition_trip

router = APIRouter(prefix="/driver", tags=["driver"])

_DRIVER = require_role("DRIVER", "DISPATCHER")  # dispatcher can also call for demo


@router.get("/trips/current", response_model=Optional[TripOut])
def current_trip(db: DbDep, current_user: CurrentUser, _: None = _DRIVER):
    """Return the driver's active trip (LOADING, LOADED, or IN_TRANSIT)."""
    q = (
        db.query(Trip)
        .options(selectinload(Trip.stops))
        .filter(Trip.status.in_(["LOADING", "LOADED", "IN_TRANSIT"]))
    )
    if current_user.vehicle_id:
        q = q.filter(Trip.vehicle_id == current_user.vehicle_id)
    trip = q.order_by(Trip.planned_depart).first()
    return trip


@router.post("/stops/{stop_id}/events", status_code=status.HTTP_201_CREATED)
def record_stop_event(
    stop_id: int,
    body: DeliveryEventIn,
    db: DbDep,
    current_user: CurrentUser,
    _: None = _DRIVER,
):
    """Record a delivery event at a stop (arrive/deliver/fail)."""
    stop = db.get(Stop, stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Stop not found."})

    # Check idempotency
    existing = (
        db.query(DeliveryEvent)
        .filter(DeliveryEvent.client_op_id == body.client_op_id)
        .first()
    )
    if existing:
        return {"ok": True, "idempotent": True}

    event = DeliveryEvent(
        stop_id=stop_id,
        order_id=body.order_id,
        outcome=body.outcome,
        note=body.note,
        receiver_name=body.receiver_name,
        receiver_pin_ok=body.receiver_pin_ok,
        recorded_at=body.recorded_at,
        client_op_id=body.client_op_id,
        recorded_by=current_user.id,
    )
    db.add(event)

    # Transition stop status based on outcome
    outcome_to_stop = {
        "DELIVERED": "COMPLETED",
        "PARTIAL": "PARTIAL",
        "REFUSED": "FAILED",
        "CLOSED": "FAILED",
        "FAILED": "FAILED",
    }
    new_stop_status = outcome_to_stop.get(body.outcome)
    if new_stop_status and stop.status in ("PENDING", "ARRIVED"):
        try:
            if stop.status == "PENDING":
                transition_stop(stop, "ARRIVED")
            transition_stop(stop, new_stop_status)
        except HTTPException:
            pass  # Already in that state — idempotent

    log_action(db, "DELIVERY_EVENT", "Stop", stop_id, actor_user_id=current_user.id,
               after={"outcome": body.outcome, "client_op_id": body.client_op_id})
    db.commit()
    return {"ok": True}


@router.post("/sync", response_model=list[DeliveryEventResult])
def sync_events(body: SyncBatch, db: DbDep, current_user: CurrentUser, _: None = _DRIVER):
    """
    Idempotent batch sync — accepts a list of delivery events with client_op_id.
    Already-seen client_op_ids are silently accepted.
    """
    results: list[DeliveryEventResult] = []
    for event_in in body.events:
        existing = (
            db.query(DeliveryEvent)
            .filter(DeliveryEvent.client_op_id == event_in.client_op_id)
            .first()
        )
        if existing:
            results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=True, message="duplicate"))
            continue
        try:
            stop = db.get(Stop, event_in.stop_id)
            if not stop:
                results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=False, message="stop_not_found"))
                continue
            event = DeliveryEvent(
                stop_id=event_in.stop_id,
                order_id=event_in.order_id,
                outcome=event_in.outcome,
                note=event_in.note,
                receiver_name=event_in.receiver_name,
                receiver_pin_ok=event_in.receiver_pin_ok,
                recorded_at=event_in.recorded_at,
                client_op_id=event_in.client_op_id,
                recorded_by=current_user.id,
            )
            db.add(event)
            db.flush()
            results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=True))
        except IntegrityError:
            db.rollback()
            results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=True, message="duplicate"))
    db.commit()
    return results


@router.post("/uploads")
async def upload_pod(
    file: UploadFile,
    current_user: CurrentUser,
    _: None = _DRIVER,
):
    """Upload a POD photo. Returns the server-side path."""
    settings = get_settings()
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    dest = os.path.join(settings.upload_dir, filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    return {"path": f"/uploads/{filename}"}
