"""User model."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

ROLES = ("DISPATCHER", "LOADER", "DRIVER", "STORE_MANAGER")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('DISPATCHER','LOADER','DRIVER','STORE_MANAGER')",
            name="role",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(200), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Role-specific links (nullable)
    outlet_id: Mapped[Optional[str]] = mapped_column(
        String(20), ForeignKey("outlets.outlet_id"), nullable=True, index=True
    )
    vehicle_id: Mapped[Optional[str]] = mapped_column(
        String(20), ForeignKey("vehicles.vehicle_id"), nullable=True, index=True
    )
    depot_id: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("depots.code"), nullable=True, index=True
    )

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
