"""Load check model."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LoadCheck(Base):
    __tablename__ = "load_checks"
    __table_args__ = (
        CheckConstraint("status IN ('OK','MISSING','DAMAGED')", name="status"),
        Index("ix_load_checks_trip_id", "trip_id"),
        Index("ix_load_checks_order_id", "order_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id"))
    order_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("orders.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="OK")
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_path: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    flagged_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    flagged_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip_rel: Mapped["Trip"] = relationship("Trip", back_populates="load_checks")  # type: ignore[name-defined]
