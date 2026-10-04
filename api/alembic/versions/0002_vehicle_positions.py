"""Device GPS fixes for live vehicle location.

Revision ID: 0002_vehicle_positions
Revises: 0001_initial

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_vehicle_positions"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vehicle_positions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.String(20), sa.ForeignKey("vehicles.vehicle_id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_vehicle_positions_vehicle_recorded", "vehicle_positions", ["vehicle_id", "recorded_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_vehicle_positions_vehicle_recorded", table_name="vehicle_positions")
    op.drop_table("vehicle_positions")
