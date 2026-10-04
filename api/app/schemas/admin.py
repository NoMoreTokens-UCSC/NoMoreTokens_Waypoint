"""Administration schemas: people, outlets and vehicles."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from pydantic import BaseModel

from app.schemas.common import OrmModel


class AdminUserOut(OrmModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    is_active: bool
    outlet_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    depot_id: Optional[str] = None
    created_at: Optional[dt.datetime] = None


class AdminUserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    outlet_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    depot_id: Optional[str] = None


class AdminUserUpdate(BaseModel):
    """Only the fields that are sent change; null clears a link."""

    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    outlet_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    depot_id: Optional[str] = None
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    password: str


class OutletCreate(BaseModel):
    name: str
    brand: str
    district: str
    depot_code: str
    parking_constraint: Optional[str] = None
    window_open_time: dt.time
    window_close_time: dt.time


class VehicleCreate(BaseModel):
    brand: str
    type: str  # 'truck' | 'van'
    is_refrigerated: bool
    depot_code: str
    weight_cap_kg: float
    volume_cap_m3: float
    registration: Optional[str] = None


class AuditOut(BaseModel):
    id: int
    at: dt.datetime
    action: str
    entity_type: str
    entity_id: str
    actor: Optional[str] = None
    before: Optional[dict] = None
    after: Optional[dict] = None
