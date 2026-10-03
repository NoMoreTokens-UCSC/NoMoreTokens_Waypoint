"""Deferral model."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import (
    Boolean,
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


class Deferral(Base):
    __tablename__ = "deferrals"
    __table_args__ = (
        Index("ix_deferrals_plan_id", "plan_id"),
        Index("ix_deferrals_order_id", "order_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("plans.id"))
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"))
    reason_code: Mapped[str] = mapped_column(String(30))
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    consecutive_count: Mapped[int] = mapped_column(Integer, default=1)
    decided_by: Mapped[str] = mapped_column(String(50))  # 'SYSTEM' or str(user_id)
    decided_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    next_run_date: Mapped[Optional[dt.date]] = mapped_column(nullable=True)
    is_override: Mapped[bool] = mapped_column(Boolean, default=False)

    plan_rel: Mapped["Plan"] = relationship("Plan", back_populates="deferrals")  # type: ignore[name-defined]
    order_rel: Mapped["Order"] = relationship("Order", back_populates="deferrals")  # type: ignore[name-defined]
