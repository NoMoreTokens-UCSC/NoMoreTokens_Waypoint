"""Receipt model."""
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
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core import clock
from app.db.base import Base


class Receipt(Base):
    __tablename__ = "receipts"
    __table_args__ = (
        CheckConstraint("status IN ('FULL','PARTIAL','DISPUTED')", name="status"),
        Index("ix_receipts_order_id", "order_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"))
    confirmed_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=clock.now, server_default=func.now()
    )
    status: Mapped[str] = mapped_column(String(10), default="FULL")

    order_rel: Mapped["Order"] = relationship("Order", back_populates="receipts")  # type: ignore[name-defined]
