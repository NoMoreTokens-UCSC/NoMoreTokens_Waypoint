"""Reference data models: depots, outlets, vehicles, calendar, fuel tracking."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Depot(Base):
    __tablename__ = "depots"

    # PK is the code exactly as it appears in the CSV (e.g. 'Peliyagoda', 'Kandy')
    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    outlets: Mapped[list["Outlet"]] = relationship("Outlet", back_populates="depot_rel")
    vehicles: Mapped[list["Vehicle"]] = relationship("Vehicle", back_populates="depot_rel")


class Outlet(Base):
    __tablename__ = "outlets"
    __table_args__ = (
        CheckConstraint("brand IN ('Fresh','Style','Tech')", name="brand"),
        Index("ix_outlets_depot_code", "depot_code"),
        Index("ix_outlets_brand", "brand"),
    )

    # PK is the outlet_id string from CSV (e.g. 'OUT001')
    outlet_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    brand: Mapped[str] = mapped_column(String(10))
    district: Mapped[str] = mapped_column(String(50))
    depot_code: Mapped[str] = mapped_column(String(50), ForeignKey("depots.code"))
    dock_type: Mapped[str] = mapped_column(String(30))
    parking_constraint: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Derived flags
    van_only: Mapped[bool] = mapped_column(Boolean, default=False)
    is_mall: Mapped[bool] = mapped_column(Boolean, default=False)

    # Mall access window (nullable; set only when is_mall=True)
    mall_window_open: Mapped[Optional[dt.time]] = mapped_column(Time, nullable=True)
    mall_window_close: Mapped[Optional[dt.time]] = mapped_column(Time, nullable=True)

    # Delivery window from CSV
    window_open_time: Mapped[Optional[dt.time]] = mapped_column(Time, nullable=True)
    window_close_time: Mapped[Optional[dt.time]] = mapped_column(Time, nullable=True)

    # Coordinates — synthetic (jittered from district centroid); marked synthetic
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    depot_rel: Mapped["Depot"] = relationship("Depot", back_populates="outlets")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="outlet_rel")  # type: ignore[name-defined]
    stops: Mapped[list["Stop"]] = relationship("Stop", back_populates="outlet_rel")  # type: ignore[name-defined]


class Vehicle(Base):
    __tablename__ = "vehicles"
    __table_args__ = (
        Index("ix_vehicles_depot_code", "depot_code"),
        Index("ix_vehicles_type", "type"),
    )

    vehicle_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    type: Mapped[str] = mapped_column(String(10))          # 'truck' | 'van'
    temp: Mapped[str] = mapped_column(String(20))          # raw CSV value: 'reefer' | 'ambient'
    is_refrigerated: Mapped[bool] = mapped_column(Boolean, default=False)  # derived from temp

    weight_cap_kg: Mapped[float] = mapped_column(Float)
    volume_cap_m3: Mapped[float] = mapped_column(Float)
    fuel_type: Mapped[str] = mapped_column(String(20))
    km_per_l: Mapped[float] = mapped_column(Float)
    weekly_fuel_quota_l: Mapped[float] = mapped_column(Float)

    depot_code: Mapped[str] = mapped_column(String(50), ForeignKey("depots.code"))

    depot_rel: Mapped["Depot"] = relationship("Depot", back_populates="vehicles")
    trips: Mapped[list["Trip"]] = relationship("Trip", back_populates="vehicle_rel")  # type: ignore[name-defined]
    weekly_fuel: Mapped[list["VehicleWeeklyFuel"]] = relationship("VehicleWeeklyFuel", back_populates="vehicle_rel")


class CalendarDay(Base):
    __tablename__ = "calendar_days"

    date: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    dow: Mapped[int] = mapped_column(Integer)          # 0=Mon … 6=Sun
    dow_name: Mapped[str] = mapped_column(String(3))   # 'Mon', 'Tue', …
    is_weekend: Mapped[bool] = mapped_column(Boolean)
    iso_year: Mapped[int] = mapped_column(Integer)
    iso_week: Mapped[int] = mapped_column(Integer)
    is_payday: Mapped[bool] = mapped_column(Boolean)
    festival: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    festival_ramp: Mapped[float] = mapped_column(Float, default=0.0)
    is_holiday: Mapped[bool] = mapped_column(Boolean)
    monsoon: Mapped[bool] = mapped_column(Boolean)
    is_operating: Mapped[bool] = mapped_column(Boolean)


class VehicleWeeklyFuel(Base):
    __tablename__ = "vehicle_weekly_fuel"
    __table_args__ = (
        UniqueConstraint("vehicle_id", "iso_year", "iso_week", name="uq_vehicle_weekly_fuel"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[str] = mapped_column(String(20), ForeignKey("vehicles.vehicle_id"))
    iso_year: Mapped[int] = mapped_column(Integer)
    iso_week: Mapped[int] = mapped_column(Integer)
    litres_used: Mapped[float] = mapped_column(Float, default=0.0)

    vehicle_rel: Mapped["Vehicle"] = relationship("Vehicle", back_populates="weekly_fuel")
