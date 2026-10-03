"""Loading router — loader views trips and flags/releases them."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbDep, require_role
from app.models.loading import LoadCheck
from app.models.order import Order
from app.models.plan import Plan, Stop, StopOrder, Trip
from app.models.reference import Vehicle
from app.schemas.plan import LoadFlagIn, TripOut
from app.services.audit import log_action
from app.services.state_machine import transition_trip

router = APIRouter(prefix="/loading", tags=["loading"])

_LOADER = require_role("LOADER", "DISPATCHER")


@router.get("/trips", response_model=list[TripOut])
def list_loading_trips(
    db: DbDep,
    current_user: CurrentUser,
    _: None = _LOADER,
    date: Optional[dt.date] = Query(None),
    depot: Optional[str] = Query(None),
):
    q = (
        db.query(Trip)
        .join(Plan, Trip.plan_id == Plan.id)
        .options(selectinload(Trip.stops))
    )
    if date:
        q = q.filter(Plan.delivery_date == date)

    # Loaders see only their depot's trips
    if current_user.role == "LOADER" and current_user.depot_id:
        q = q.join(Vehicle, Trip.vehicle_id == Vehicle.vehicle_id).filter(
            Vehicle.depot_code == current_user.depot_id
        )
    elif depot:
        q = q.join(Vehicle, Trip.vehicle_id == Vehicle.vehicle_id).filter(
            Vehicle.depot_code == depot
        )

    return q.order_by(Trip.planned_depart).all()



@router.get("/trips/{trip_id}", response_model=TripOut)
def get_loading_trip(trip_id: int, db: DbDep, current_user: CurrentUser, _: None = _LOADER):
    trip = db.get(Trip, trip_id, options=[selectinload(Trip.stops)])
    if not trip:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Trip not found."})
    # Stops come in reverse-sequence order for loading (last stop loaded first)
    trip.stops.sort(key=lambda s: s.sequence, reverse=True)
    return trip


@router.post("/trips/{trip_id}/flags", status_code=status.HTTP_201_CREATED)
def flag_load(
    trip_id: int,
    body: LoadFlagIn,
    db: DbDep,
    current_user: CurrentUser,
    _: None = _LOADER,
):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Trip not found."})
    check = LoadCheck(
        trip_id=trip_id,
        order_id=body.order_id,
        status=body.status,
        note=body.note,
        flagged_by=current_user.id,
    )
    db.add(check)
    log_action(db, "LOAD_FLAG", "Trip", trip_id, actor_user_id=current_user.id,
               after={"status": body.status, "order_id": body.order_id})
    db.commit()
    return {"ok": True}


@router.post("/trips/{trip_id}/start", status_code=status.HTTP_200_OK)
def start_loading_trip(trip_id: int, db: DbDep, current_user: CurrentUser, _: None = _LOADER):
    """Mark that vehicle loading has physically started at the bay (PLANNED -> LOADING)."""
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Trip not found."})
    before = {"status": trip.status}
    transition_trip(trip, "LOADING")
    log_action(db, "START_LOADING_TRIP", "Trip", trip_id, actor_user_id=current_user.id,
               before=before, after={"status": trip.status})
    db.commit()
    return {"ok": True, "status": trip.status}


@router.post("/trips/{trip_id}/release", status_code=status.HTTP_200_OK)
def release_trip(trip_id: int, db: DbDep, current_user: CurrentUser, _: None = _LOADER):
    """Release vehicle after loading is complete (PLANNED/LOADING -> LOADED)."""
    trip = db.get(Trip, trip_id, options=[selectinload(Trip.stops)])
    if not trip:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Trip not found."})
    before = {"status": trip.status}
    transition_trip(trip, "LOADED")

    # Advance all orders on this trip to LOADED
    for stop in trip.stops:
        for so in db.query(StopOrder).filter(StopOrder.stop_id == stop.id).all():
            order = db.get(Order, so.order_id)
            if order and order.status == "PLANNED":
                order.status = "LOADED"

    log_action(db, "RELEASE_TRIP", "Trip", trip_id, actor_user_id=current_user.id,
               before=before, after={"status": trip.status})
    db.commit()
    return {"ok": True, "status": trip.status}
