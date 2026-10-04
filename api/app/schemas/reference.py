"""Reference data schemas."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from app.schemas.common import OrmModel


class DepotOut(OrmModel):
    code: str
    name: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class OutletOut(OrmModel):
    outlet_id: str
    name: Optional[str] = None
    brand: str
    district: str
    depot_code: str
    dock_type: str
    parking_constraint: Optional[str] = None
    van_only: bool
    is_mall: bool
    mall_window_open: Optional[dt.time] = None
    mall_window_close: Optional[dt.time] = None
    window_open_time: Optional[dt.time] = None
    window_close_time: Optional[dt.time] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class VehicleOut(OrmModel):
    vehicle_id: str
    type: str
    temp: str
    is_refrigerated: bool
    registration: Optional[str] = None
    weight_cap_kg: float
    volume_cap_m3: float
    fuel_type: str
    km_per_l: float
    weekly_fuel_quota_l: float
    depot_code: str


class CalendarDayOut(OrmModel):
    date: dt.date
    dow: int
    dow_name: str
    is_weekend: bool
    iso_year: int
    iso_week: int
    is_payday: bool
    festival: Optional[str] = None
    festival_ramp: float
    is_holiday: bool
    monsoon: bool
    is_operating: bool
