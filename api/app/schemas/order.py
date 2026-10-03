"""Order schemas."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from pydantic import BaseModel

from app.schemas.common import OrmModel


class OrderLineIn(BaseModel):
    sku: Optional[str] = None
    description: str
    quantity: int
    unit_weight: float = 0.0
    unit_volume: float = 0.0


class OrderCreate(BaseModel):
    outlet_id: str
    brand: str
    temperature_class: str
    delivery_date: dt.date
    total_weight: float
    total_volume: float
    total_cases: int = 0
    priority: bool = False
    notes: Optional[str] = None
    lines: list[OrderLineIn] = []


class OrderLineOut(OrmModel):
    id: int
    sku: Optional[str] = None
    description: str
    quantity: int
    unit_weight: float
    unit_volume: float


class OrderOut(OrmModel):
    id: int
    reference: str
    outlet_id: str
    brand: str
    temperature_class: str
    delivery_date: dt.date
    status: str
    total_weight: float
    total_volume: float
    total_cases: int
    priority: bool
    placed_at: dt.datetime
    cutoff_missed: bool
    notes: Optional[str] = None
    lines: list[OrderLineOut] = []


class ReceiptCreate(BaseModel):
    status: str = "FULL"


class IssueCreate(BaseModel):
    type: str
    description: Optional[str] = None


class DeferralHistoryOut(OrmModel):
    id: int
    plan_id: int
    reason_code: str
    explanation: Optional[str] = None
    consecutive_count: int
    decided_by: str
    decided_at: dt.datetime
    next_run_date: Optional[dt.date] = None
    is_override: bool
