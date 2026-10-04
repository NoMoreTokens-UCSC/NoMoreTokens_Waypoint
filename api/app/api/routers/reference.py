"""Reference data router: outlets, vehicles, depots, calendar."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbDep, require_role
from app.models.reference import CalendarDay, Depot, Outlet, Vehicle
from app.models.user import User
from app.schemas.reference import CalendarDayOut, DepotOut, OutletOut, VehicleOut

router = APIRouter(prefix="/reference", tags=["reference"])


@router.get("/depots", response_model=list[DepotOut])
def list_depots(db: DbDep, _: CurrentUser):
    return db.query(Depot).all()


@router.get("/outlets", response_model=list[OutletOut])
def list_outlets(
    db: DbDep,
    _: CurrentUser,
    depot: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
):
    q = db.query(Outlet)
    if depot:
        q = q.filter(Outlet.depot_code == depot)
    if brand:
        q = q.filter(Outlet.brand == brand)
    if district:
        q = q.filter(Outlet.district == district)
    return q.all()


@router.get("/outlets/{outlet_id}", response_model=OutletOut)
def get_outlet(outlet_id: str, db: DbDep, _: CurrentUser):
    outlet = db.get(Outlet, outlet_id)
    if not outlet:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Outlet not found."})
    return outlet


@router.get("/store-managers")
def list_store_managers(db: DbDep, _: object = require_role("DISPATCHER", "DRIVER", "LOADER")):
    """Who receives at each outlet, so a driver or dispatcher can call ahead. Names and phones only."""
    managers = (
        db.query(User)
        .filter(User.role == "STORE_MANAGER", User.is_active.is_(True), User.outlet_id.isnot(None))
        .all()
    )
    return [
        {"id": m.id, "full_name": m.full_name, "phone": m.phone, "outlet_id": m.outlet_id}
        for m in managers
    ]


@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(
    db: DbDep,
    _: CurrentUser,
    depot: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    refrigerated: Optional[bool] = Query(None),
):
    q = db.query(Vehicle)
    if depot:
        q = q.filter(Vehicle.depot_code == depot)
    if type:
        q = q.filter(Vehicle.type == type)
    if refrigerated is not None:
        q = q.filter(Vehicle.is_refrigerated == refrigerated)
    return q.all()


@router.get("/vehicles/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: str, db: DbDep, _: CurrentUser):
    vehicle = db.get(Vehicle, vehicle_id)
    if not vehicle:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Vehicle not found."})
    return vehicle


@router.get("/calendar", response_model=list[CalendarDayOut])
def list_calendar(
    db: DbDep,
    _: CurrentUser,
    from_: Optional[dt.date] = Query(None, alias="from"),
    to: Optional[dt.date] = Query(None),
    operating_only: bool = Query(False),
):
    q = db.query(CalendarDay)
    if from_:
        q = q.filter(CalendarDay.date >= from_)
    if to:
        q = q.filter(CalendarDay.date <= to)
    if operating_only:
        q = q.filter(CalendarDay.is_operating.is_(True))
    return q.order_by(CalendarDay.date).all()
