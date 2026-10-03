"""Plan, Trip, Stop, StopOrder models."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = (
        CheckConstraint("status IN ('DRAFT','PUBLISHED','SUPERSEDED')", name="status"),
        Index("ix_plans_delivery_date", "delivery_date"),
        Index("ix_plans_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    delivery_date: Mapped[dt.date] = mapped_column()
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(15), default="DRAFT")
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    summary_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    trips: Mapped[list["Trip"]] = relationship("Trip", back_populates="plan_rel", cascade="all, delete-orphan")
    deferrals: Mapped[list["Deferral"]] = relationship("Deferral", back_populates="plan_rel")  # type: ignore[name-defined]


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PLANNED','LOADING','LOADED','IN_TRANSIT','COMPLETED','CANCELLED')",
            name="status",
        ),
        UniqueConstraint("plan_id", "vehicle_id", "trip_number", name="uq_trips_plan_vehicle_trip"),
        Index("ix_trips_plan_id", "plan_id"),
        Index("ix_trips_vehicle_id", "vehicle_id"),
        Index("ix_trips_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("plans.id"))
    vehicle_id: Mapped[str] = mapped_column(String(20), ForeignKey("vehicles.vehicle_id"))
    trip_number: Mapped[int] = mapped_column(Integer)   # 1 or 2
    planned_depart: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_return: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_distance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    planned_fuel: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(15), default="PLANNED")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    plan_rel: Mapped["Plan"] = relationship("Plan", back_populates="trips")
    vehicle_rel: Mapped["Vehicle"] = relationship("Vehicle", back_populates="trips")  # type: ignore[name-defined]
    stops: Mapped[list["Stop"]] = relationship("Stop", back_populates="trip_rel", cascade="all, delete-orphan")
    load_checks: Mapped[list["LoadCheck"]] = relationship("LoadCheck", back_populates="trip_rel")  # type: ignore[name-defined]

    @property
    def photo_path(self) -> Optional[str]:
        for check in reversed(self.load_checks or []):
            if check.photo_path:
                return check.photo_path
        return None


class Stop(Base):
    __tablename__ = "stops"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','ARRIVED','COMPLETED','PARTIAL','FAILED')",
            name="status",
        ),
        Index("ix_stops_trip_id", "trip_id"),
        Index("ix_stops_outlet_id", "outlet_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id"))
    outlet_id: Mapped[str] = mapped_column(String(20), ForeignKey("outlets.outlet_id"))
    sequence: Mapped[int] = mapped_column(Integer)
    planned_eta: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_arrival: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_departure: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(15), default="PENDING")

    trip_rel: Mapped["Trip"] = relationship("Trip", back_populates="stops")
    outlet_rel: Mapped["Outlet"] = relationship("Outlet", back_populates="stops")  # type: ignore[name-defined]
    stop_orders: Mapped[list["StopOrder"]] = relationship("StopOrder", back_populates="stop_rel", cascade="all, delete-orphan")
    delivery_events: Mapped[list["DeliveryEvent"]] = relationship("DeliveryEvent", back_populates="stop_rel")  # type: ignore[name-defined]
    issues: Mapped[list["Issue"]] = relationship("Issue", back_populates="stop_rel")  # type: ignore[name-defined]

    @property
    def district(self) -> Optional[str]:
        return self.outlet_rel.district if self.outlet_rel else None

    @property
    def lat(self) -> Optional[float]:
        return self.outlet_rel.lat if self.outlet_rel else None

    @property
    def lng(self) -> Optional[float]:
        return self.outlet_rel.lng if self.outlet_rel else None

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
    def order_ids(self) -> list[int]:
        return [so.order_id for so in (self.stop_orders or [])]

    @property
    def total_cases(self) -> int:
        return sum(so.order_rel.total_cases for so in (self.stop_orders or []) if so.order_rel)

    @property
    def proof_id(self) -> Optional[str]:
        for event in reversed(self.delivery_events or []):
            if event.pod_photo_path:
                return event.pod_photo_path
            if event.note:
                return event.note
        return None


class StopOrder(Base):
    """Links an order to the stop it is delivered on (one stop per order per plan)."""
    __tablename__ = "stop_orders"
    __table_args__ = (
        Index("ix_stop_orders_stop_id", "stop_id"),
        Index("ix_stop_orders_order_id", "order_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stop_id: Mapped[int] = mapped_column(Integer, ForeignKey("stops.id"))
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"))

    stop_rel: Mapped["Stop"] = relationship("Stop", back_populates="stop_orders")
    order_rel: Mapped["Order"] = relationship("Order", back_populates="stop_orders")  # type: ignore[name-defined]
