"""Delivery event model (POD, offline-sync idempotency)."""
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
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DeliveryEvent(Base):
    __tablename__ = "delivery_events"
    __table_args__ = (
        CheckConstraint(
            "outcome IN ('DELIVERED','PARTIAL','REFUSED','CLOSED','FAILED')",
            name="outcome",
        ),
        UniqueConstraint("client_op_id", name="uq_delivery_events_client_op_id"),
        Index("ix_delivery_events_stop_id", "stop_id"),
        Index("ix_delivery_events_order_id", "order_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stop_id: Mapped[int] = mapped_column(Integer, ForeignKey("stops.id"))
    order_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("orders.id"), nullable=True)
    outcome: Mapped[str] = mapped_column(String(15))
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pod_photo_path: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    pod_signature_path: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    receiver_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    receiver_pin_ok: Mapped[Optional[bool]] = mapped_column(nullable=True)
    # Device time (sent by driver app)
    recorded_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Server time (when received)
    received_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Idempotency key for offline sync
    client_op_id: Mapped[str] = mapped_column(String(100))
    recorded_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    stop_rel: Mapped["Stop"] = relationship("Stop", back_populates="delivery_events")  # type: ignore[name-defined]
    order_rel: Mapped["Order"] = relationship("Order", back_populates="delivery_events")  # type: ignore[name-defined]
