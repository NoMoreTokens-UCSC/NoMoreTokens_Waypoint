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
    brand: Optional[str] = None
    temperature_class: str
    delivery_date: Optional[dt.date] = None
    total_weight: Optional[float] = None
    total_volume: Optional[float] = None
    total_cases: int = 0
    cases: Optional[int] = None
    window_open: Optional[str] = None
    window_close: Optional[str] = None
    priority: bool = False
    notes: Optional[str] = None
    lines: list[OrderLineIn] = []


class OrderUpdate(BaseModel):
    cases: Optional[int] = None
    total_cases: Optional[int] = None
    total_weight: Optional[float] = None
    total_volume: Optional[float] = None
    window_open: Optional[str] = None
    window_close: Optional[str] = None
    notes: Optional[str] = None


class ReceiptReportOut(BaseModel):
    kind: str
    received: int
    affected: int
    description: str
    recorded_at: Optional[str] = None


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
    vehicle_id: Optional[str] = None
    trip: Optional[int] = None
    outlet_name: Optional[str] = None
    deferral_reason: Optional[str] = None
    window_open: Optional[str] = None
    window_close: Optional[str] = None
    receipt_status: Optional[str] = None
    receipt_report: Optional[ReceiptReportOut] = None
    delivered_at: Optional[dt.datetime] = None
    created_at: Optional[dt.datetime] = None
    updated_at: Optional[dt.datetime] = None


class DeferralCreate(BaseModel):
    order_id: int
    reason_code: str
    explanation: Optional[str] = None
    is_override: bool = False


class ReceiptCreate(BaseModel):
    status: Optional[str] = "FULL"
    outcome: Optional[str] = None
    received_qty: Optional[int] = None
    affected_qty: Optional[int] = None
    notes: Optional[str] = None


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
