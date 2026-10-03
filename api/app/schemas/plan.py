"""Plan / Trip / Stop schemas."""
from __future__ import annotations

import datetime as dt
from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.common import OrmModel


class StopOut(OrmModel):
    id: int
    trip_id: int
    outlet_id: str
    sequence: int
    planned_eta: Optional[dt.datetime] = None
    actual_arrival: Optional[dt.datetime] = None
    actual_departure: Optional[dt.datetime] = None
    status: str


class TripOut(OrmModel):
    id: int
    plan_id: int
    vehicle_id: str
    trip_number: int
    planned_depart: Optional[dt.datetime] = None
    planned_return: Optional[dt.datetime] = None
    planned_distance: Optional[float] = None
    planned_fuel: Optional[float] = None
    status: str
    stops: list[StopOut] = []
    photo_path: Optional[str] = None


class PlanOut(OrmModel):
    id: int
    delivery_date: dt.date
    version: int
    status: str
    created_at: dt.datetime
    published_at: Optional[dt.datetime] = None
    summary_json: Optional[dict[str, Any]] = None
    trips: list[TripOut] = []


class DeferralOut(OrmModel):
    id: int
    plan_id: int
    order_id: int
    reason_code: str
    explanation: Optional[str] = None
    consecutive_count: int
    decided_by: str
    decided_at: dt.datetime
    next_run_date: Optional[dt.date] = None
    is_override: bool


class LoadFlagIn(BaseModel):
    order_id: Optional[int] = None
    status: str  # 'OK' | 'MISSING' | 'DAMAGED'
    note: Optional[str] = None
    photo_path: Optional[str] = None


class DeliveryEventIn(BaseModel):
    client_op_id: str
    stop_id: int
    order_id: Optional[int] = None
    outcome: str
    note: Optional[str] = None
    receiver_name: Optional[str] = None
    receiver_pin_ok: Optional[bool] = None
    recorded_at: Optional[dt.datetime] = None


class DeliveryEventResult(BaseModel):
    client_op_id: str
    accepted: bool
    message: Optional[str] = None


class SyncBatch(BaseModel):
    events: list[DeliveryEventIn]
