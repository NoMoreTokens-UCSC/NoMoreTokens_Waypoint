"""Administrator role and a phone number on users.

Revision ID: 0003_admin_role
Revises: 0002_vehicle_positions

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_admin_role"
down_revision: Union[str, None] = "0002_vehicle_positions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('DISPATCHER','LOADER','DRIVER','STORE_MANAGER','ADMIN')",
    )
    op.add_column("users", sa.Column("phone", sa.String(30), nullable=True))
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.add_column("outlets", sa.Column("name", sa.String(100), nullable=True))
    op.add_column("vehicles", sa.Column("registration", sa.String(20), nullable=True))
    op.create_unique_constraint("uq_vehicles_registration", "vehicles", ["registration"])


def downgrade() -> None:
    op.drop_constraint("uq_vehicles_registration", "vehicles", type_="unique")
    op.drop_column("vehicles", "registration")
    op.drop_column("outlets", "name")
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.drop_column("users", "phone")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('DISPATCHER','LOADER','DRIVER','STORE_MANAGER')",
    )
