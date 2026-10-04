"""Issue model."""
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


class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (
        CheckConstraint(
            "type IN ('SHORT','DAMAGED','WRONG_ITEM','OTHER')",
            name="type",
        ),
        CheckConstraint("status IN ('OPEN','RESOLVED')", name="status"),
        Index("ix_issues_order_id", "order_id"),
        Index("ix_issues_stop_id", "stop_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("orders.id"), nullable=True)
    stop_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("stops.id"), nullable=True)
    reported_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(15))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_path: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="OPEN")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order_rel: Mapped["Order"] = relationship("Order", back_populates="issues")  # type: ignore[name-defined]
    stop_rel: Mapped["Stop"] = relationship("Stop", back_populates="issues")  # type: ignore[name-defined]
