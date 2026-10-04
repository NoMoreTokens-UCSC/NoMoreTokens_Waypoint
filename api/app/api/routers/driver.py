"""Driver router — current trip, stop events, offline sync, photo upload."""
from __future__ import annotations

import datetime as dt
import os
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.position import VehiclePosition
from app.schemas.position import PositionIn, PositionOut
from app.api.deps import CurrentUser, DbDep, require_role
from app.core.config import get_settings
from app.models.delivery import DeliveryEvent
from app.models.order import Order
from app.models.plan import Stop, StopOrder, Trip, Plan
from app.schemas.plan import DeliveryEventIn, DeliveryEventResult, StopOut, SyncBatch, TripOut
from app.services.audit import log_action
from app.services.state_machine import transition_order, transition_stop, transition_trip

router = APIRouter(prefix="/driver", tags=["driver"])

_DRIVER = require_role("DRIVER", "DISPATCHER")  # dispatcher can also call for demo
_UPLOAD_ROLES = require_role("DRIVER", "DISPATCHER", "LOADER")


@router.get("/trips/current", response_model=Optional[TripOut])
def current_trip(db: DbDep, current_user: CurrentUser, _: None = _DRIVER):
    """Return the driver's active trip (LOADING, LOADED, or IN_TRANSIT)."""
    q = (
        db.query(Trip)
        .options(
            selectinload(Trip.stops).selectinload(Stop.outlet_rel),
            selectinload(Trip.stops).selectinload(Stop.stop_orders).selectinload(StopOrder.order_rel),
            selectinload(Trip.stops).selectinload(Stop.delivery_events),
            selectinload(Trip.load_checks),
        )
        .filter(Trip.status.in_(["LOADING", "LOADED", "IN_TRANSIT"]))
    )
    if current_user.vehicle_id:
        q = q.filter(Trip.vehicle_id == current_user.vehicle_id)
    trip = q.order_by(Trip.planned_depart).first()
    return trip


def _orders_in_transit(db: DbDep, trip: Trip) -> None:
    """Orders on a trip that has left the depot are in transit, so stores can see them en route."""
    stop_ids = [stop.id for stop in trip.stops]
    if not stop_ids:
        return
    for link in db.query(StopOrder).filter(StopOrder.stop_id.in_(stop_ids)).all():
        order = db.get(Order, link.order_id)
        if order and order.status == "LOADED":
            transition_order(order, "IN_TRANSIT")


@router.post("/trips/start", status_code=status.HTTP_200_OK)
def start_driver_trip(db: DbDep, current_user: CurrentUser, _: None = _DRIVER):
    """Mark the driver's current trip as IN_TRANSIT (LOADED -> IN_TRANSIT)."""
    q = (
        db.query(Trip)
        .options(selectinload(Trip.stops))
        .filter(Trip.status == "LOADED")
    )
    if current_user.vehicle_id:
        q = q.filter(Trip.vehicle_id == current_user.vehicle_id)
    trip = q.first()
    if not trip:
        trip_in_transit = db.query(Trip).filter(Trip.status == "IN_TRANSIT")
        if current_user.vehicle_id:
            trip_in_transit = trip_in_transit.filter(Trip.vehicle_id == current_user.vehicle_id)
        if trip_in_transit.first():
            return {"ok": True, "status": "IN_TRANSIT"}
        raise HTTPException(
            status_code=400,
            detail={"code": "NO_LOADED_TRIP", "message": "No loaded trip ready for departure."},
        )

    transition_trip(trip, "IN_TRANSIT")
    _orders_in_transit(db, trip)
    log_action(db, "START_TRIP", "Trip", trip.id, actor_user_id=current_user.id,
               before={"status": "LOADED"}, after={"status": "IN_TRANSIT"})
    db.commit()
    return {"ok": True, "status": trip.status}


def _process_delivery_event(db: DbDep, stop: Stop, event_in: DeliveryEventIn, user_id: Optional[int]):
    outcome_to_stop = {
        "ARRIVED": "ARRIVED",
        "DELIVERED": "COMPLETED",
        "PARTIAL": "PARTIAL",
        "REFUSED": "FAILED",
        "CLOSED": "FAILED",
        "FAILED": "FAILED",
    }
    outcome_to_order = {
        "DELIVERED": "DELIVERED",
        "PARTIAL": "PARTIAL",
        "REFUSED": "FAILED",
        "CLOSED": "FAILED",
        "FAILED": "FAILED",
    }

    if event_in.outcome == "ARRIVED":
        if stop.status == "PENDING":
            try:
                transition_stop(stop, "ARRIVED")
            except HTTPException:
                pass
        stop.actual_arrival = dt.datetime.now(dt.timezone.utc)
        trip = db.get(Trip, stop.trip_id)
        if trip and trip.status == "LOADED":
            try:
                transition_trip(trip, "IN_TRANSIT")
                _orders_in_transit(db, trip)
            except HTTPException:
                pass

    elif event_in.outcome in outcome_to_stop:
        new_stop_status = outcome_to_stop[event_in.outcome]
        if stop.status == "PENDING":
            try:
                transition_stop(stop, "ARRIVED")
            except HTTPException:
                pass
        if stop.status != new_stop_status:
            try:
                transition_stop(stop, new_stop_status)
            except HTTPException:
                pass
        stop.actual_departure = dt.datetime.now(dt.timezone.utc)

    # Transition orders on this stop
    new_order_status = outcome_to_order.get(event_in.outcome)
    if new_order_status:
        order_ids = [event_in.order_id] if event_in.order_id else [
            so.order_id for so in db.query(StopOrder).filter(StopOrder.stop_id == stop.id).all()
        ]
        for oid in order_ids:
            order = db.get(Order, oid)
            if order and order.status != new_order_status:
                try:
                    transition_order(order, new_order_status)
                except HTTPException:
                    pass

    # Check if all stops on this trip are completed
    trip = db.get(Trip, stop.trip_id, options=[selectinload(Trip.stops)])
    if trip and trip.status in ("LOADED", "IN_TRANSIT"):
        all_done = all(s.status in ("COMPLETED", "PARTIAL", "FAILED") for s in trip.stops)
        if all_done:
            try:
                transition_trip(trip, "COMPLETED")
            except HTTPException:
                pass


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

    if body.outcome in ("DELIVERED", "PARTIAL", "REFUSED", "CLOSED", "FAILED"):
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
            pod_photo_path=body.pod_photo_path,
            pod_signature_path=body.pod_signature_path,
            receiver_name=body.receiver_name,
            receiver_pin_ok=body.receiver_pin_ok,
            recorded_at=body.recorded_at,
            client_op_id=body.client_op_id,
            recorded_by=current_user.id,
        )
        db.add(event)

    _process_delivery_event(db, stop, body, current_user.id)

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
        if event_in.outcome in ("DELIVERED", "PARTIAL", "REFUSED", "CLOSED", "FAILED"):
            existing = (
                db.query(DeliveryEvent)
                .filter(DeliveryEvent.client_op_id == event_in.client_op_id)
                .first()
            )
            if existing:
                results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=True, message="duplicate"))
                continue
            try:
                with db.begin_nested():
                    stop = db.get(Stop, event_in.stop_id)
                    if not stop:
                        results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=False, message="stop_not_found"))
                        continue
                    event = DeliveryEvent(
                        stop_id=event_in.stop_id,
                        order_id=event_in.order_id,
                        outcome=event_in.outcome,
                        note=event_in.note,
                        pod_photo_path=event_in.pod_photo_path,
                        pod_signature_path=event_in.pod_signature_path,
                        receiver_name=event_in.receiver_name,
                        receiver_pin_ok=event_in.receiver_pin_ok,
                        recorded_at=event_in.recorded_at,
                        client_op_id=event_in.client_op_id,
                        recorded_by=current_user.id,
                    )
                    db.add(event)
                    _process_delivery_event(db, stop, event_in, current_user.id)
                    db.flush()
                    results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=True))
            except IntegrityError:
                results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=True, message="duplicate"))
            except Exception as exc:
                results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=False, message=str(exc)))
        else:
            try:
                with db.begin_nested():
                    stop = db.get(Stop, event_in.stop_id)
                    if not stop:
                        results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=False, message="stop_not_found"))
                        continue
                    _process_delivery_event(db, stop, event_in, current_user.id)
                    db.flush()
                    results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=True))
            except Exception as exc:
                results.append(DeliveryEventResult(client_op_id=event_in.client_op_id, accepted=False, message=str(exc)))
    db.commit()
    return results


@router.post("/uploads")
async def upload_pod(
    file: UploadFile,
    stop_id: Optional[str] = Form(None),
    current_user: CurrentUser = None,
    _: None = _UPLOAD_ROLES,
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


# ── Live location ─────────────────────────────────────────────────────────────

@router.post("/positions", status_code=status.HTTP_201_CREATED)
def record_position(body: PositionIn, db: DbDep, current_user: CurrentUser, _: None = _DRIVER):
    """Store one GPS fix from the driver's device for the vehicle they are assigned to."""
    if current_user.vehicle_id and body.vehicle_id != current_user.vehicle_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "You can only report your assigned vehicle."},
        )
    if not (-90 <= body.lat <= 90 and -180 <= body.lng <= 180) or body.accuracy < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "BAD_POSITION", "message": "The GPS position is invalid."},
        )
    db.add(
        VehiclePosition(
            vehicle_id=body.vehicle_id,
            user_id=current_user.id,
            lat=body.lat,
            lng=body.lng,
            accuracy=body.accuracy,
            recorded_at=body.recorded_at,
        )
    )
    db.commit()
    return {"ok": True}


@router.get("/positions/latest", response_model=list[PositionOut])
def latest_positions(db: DbDep, current_user: CurrentUser, _: None = _DRIVER):
    """The most recent fix for each vehicle that has reported one."""
    rows = (
        db.query(VehiclePosition)
        .distinct(VehiclePosition.vehicle_id)
        .order_by(VehiclePosition.vehicle_id, VehiclePosition.recorded_at.desc())
        .all()
    )
    return rows
