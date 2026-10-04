"""Order and order line models."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

ORDER_STATUSES = (
    "PLACED", "CONFIRMED", "QUEUED", "PLANNED", "LOADED",
    "IN_TRANSIT", "DELIVERED", "PARTIAL", "FAILED", "DEFERRED", "CANCELLED",
)

TEMP_CLASSES = ("AMBIENT", "CHILLED", "FROZEN")


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PLACED','CONFIRMED','QUEUED','PLANNED','LOADED',"
            "'IN_TRANSIT','DELIVERED','PARTIAL','FAILED','DEFERRED','CANCELLED')",
            name="status",
        ),
        CheckConstraint("brand IN ('Fresh','Style','Tech')", name="brand"),
        CheckConstraint("temperature_class IN ('AMBIENT','CHILLED','FROZEN')", name="temperature_class"),
        Index("ix_orders_outlet_id", "outlet_id"),
        Index("ix_orders_delivery_date", "delivery_date"),
        Index("ix_orders_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Human-readable reference like "ORD-20240410-0001"
    reference: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    outlet_id: Mapped[str] = mapped_column(String(20), ForeignKey("outlets.outlet_id"))
    brand: Mapped[str] = mapped_column(String(10))
    temperature_class: Mapped[str] = mapped_column(String(10))
    delivery_date: Mapped[dt.date] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="PLACED")
    total_weight: Mapped[float] = mapped_column(Float, default=0.0)
    total_volume: Mapped[float] = mapped_column(Float, default=0.0)
    total_cases: Mapped[int] = mapped_column(Integer, default=0)
    priority: Mapped[bool] = mapped_column(Boolean, default=False)
    placed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cutoff_missed: Mapped[bool] = mapped_column(Boolean, default=False)
    placed_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    outlet_rel: Mapped["Outlet"] = relationship("Outlet", back_populates="orders")  # type: ignore[name-defined]
    lines: Mapped[list["OrderLine"]] = relationship("OrderLine", back_populates="order", cascade="all, delete-orphan")
    stop_orders: Mapped[list["StopOrder"]] = relationship("StopOrder", back_populates="order_rel")  # type: ignore[name-defined]
    delivery_events: Mapped[list["DeliveryEvent"]] = relationship("DeliveryEvent", back_populates="order_rel")  # type: ignore[name-defined]
    receipts: Mapped[list["Receipt"]] = relationship("Receipt", back_populates="order_rel")  # type: ignore[name-defined]
    issues: Mapped[list["Issue"]] = relationship("Issue", back_populates="order_rel")  # type: ignore[name-defined]
    deferrals: Mapped[list["Deferral"]] = relationship("Deferral", back_populates="order_rel")  # type: ignore[name-defined]

    @property
    def window_open(self) -> Optional[str]:
        if self.outlet_rel and self.outlet_rel.window_open_time:
            return self.outlet_rel.window_open_time.strftime("%H:%M")
        return None

    @property
    def window_close(self) -> Optional[str]:
        if self.outlet_rel and self.outlet_rel.window_close_time:
            return self.outlet_rel.window_close_time.strftime("%H:%M")
        return None

    @property
    def _current_trip(self):
        """The trip on the newest plan that holds this order.

        An order can still sit on the stops of superseded plans. Only a live plan
        counts, so an order removed from the plan being worked on reports no vehicle,
        rather than one left over from an earlier plan.
        """
        live = []
        for so in self.stop_orders or []:
            trip = so.stop_rel.trip_rel if so.stop_rel else None
            if not trip:
                continue
            plan = trip.plan_rel
            if plan and plan.status in ("DRAFT", "PUBLISHED"):
                live.append(trip)
        return max(live, key=lambda t: t.plan_id) if live else None

    @property
    def vehicle_id(self) -> Optional[str]:
        trip = self._current_trip
        return trip.vehicle_id if trip else None

    @property
    def trip(self) -> Optional[int]:
        trip = self._current_trip
        return trip.trip_number if trip else None

    @property
    def deferral_reason(self) -> Optional[str]:
        if self.deferrals:
            return self.deferrals[-1].reason_code
        return None

    @property
    def outlet_name(self) -> Optional[str]:
        if self.outlet_rel:
            return f"{self.outlet_rel.brand} {self.outlet_rel.district}"
        return None

    @property
    def receipt_status(self) -> Optional[str]:
        if self.receipts:
            return self.receipts[-1].status
        return None

    @property
    def receipt_report(self) -> Optional[dict]:
        import json
        for iss in reversed(self.issues or []):
            if iss.type in ("SHORT", "DAMAGED") or (iss.description and "{" in iss.description):
                try:
                    data = json.loads(iss.description or "{}")
                    return {
                        "kind": "Missing" if iss.type == "SHORT" else "Damaged",
                        "received": data.get("received", 0),
                        "affected": data.get("affected", 0),
                        "description": data.get("notes", iss.description or ""),
                        "recorded_at": iss.created_at.isoformat() if iss.created_at else None,
                    }
                except Exception:
                    return {
                        "kind": "Missing" if iss.type == "SHORT" else "Damaged",
                        "received": self.total_cases,
                        "affected": 0,
                        "description": iss.description or "",
                        "recorded_at": iss.created_at.isoformat() if iss.created_at else None,
                    }
        return None

    @property
    def delivered_at(self) -> Optional[dt.datetime]:
        for event in reversed(self.delivery_events or []):
            if event.outcome in ("DELIVERED", "PARTIAL") and event.received_at:
                return event.received_at
        for so in self.stop_orders or []:
            if so.stop_rel and so.stop_rel.actual_arrival:
                return so.stop_rel.actual_arrival
        return None


class OrderLine(Base):
    __tablename__ = "order_lines"
    __table_args__ = (Index("ix_order_lines_order_id", "order_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"))
    sku: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_weight: Mapped[float] = mapped_column(Float, default=0.0)
    unit_volume: Mapped[float] = mapped_column(Float, default=0.0)

    order: Mapped["Order"] = relationship("Order", back_populates="lines")
