"""Initial schema — all tables.

Revision ID: 0001_initial
Revises:
Create Date: 2024-04-10 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- depots ---
    op.create_table(
        "depots",
        sa.Column("code", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("lat", sa.Float, nullable=True),
        sa.Column("lng", sa.Float, nullable=True),
    )

    # --- outlets ---
    op.create_table(
        "outlets",
        sa.Column("outlet_id", sa.String(20), primary_key=True),
        sa.Column("brand", sa.String(10), nullable=False),
        sa.Column("district", sa.String(50), nullable=False),
        sa.Column("depot_code", sa.String(50), sa.ForeignKey("depots.code"), nullable=False),
        sa.Column("dock_type", sa.String(30), nullable=False),
        sa.Column("parking_constraint", sa.String(30), nullable=True),
        sa.Column("van_only", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_mall", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("mall_window_open", sa.Time, nullable=True),
        sa.Column("mall_window_close", sa.Time, nullable=True),
        sa.Column("window_open_time", sa.Time, nullable=True),
        sa.Column("window_close_time", sa.Time, nullable=True),
        sa.Column("lat", sa.Float, nullable=True),
        sa.Column("lng", sa.Float, nullable=True),
        sa.CheckConstraint("brand IN ('Fresh','Style','Tech')", name="ck_outlets_brand"),
    )
    op.create_index("ix_outlets_depot_code", "outlets", ["depot_code"])
    op.create_index("ix_outlets_brand", "outlets", ["brand"])

    # --- vehicles ---
    op.create_table(
        "vehicles",
        sa.Column("vehicle_id", sa.String(20), primary_key=True),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("temp", sa.String(20), nullable=False),
        sa.Column("is_refrigerated", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("weight_cap_kg", sa.Float, nullable=False),
        sa.Column("volume_cap_m3", sa.Float, nullable=False),
        sa.Column("fuel_type", sa.String(20), nullable=False),
        sa.Column("km_per_l", sa.Float, nullable=False),
        sa.Column("weekly_fuel_quota_l", sa.Float, nullable=False),
        sa.Column("depot_code", sa.String(50), sa.ForeignKey("depots.code"), nullable=False),
    )
    op.create_index("ix_vehicles_depot_code", "vehicles", ["depot_code"])
    op.create_index("ix_vehicles_type", "vehicles", ["type"])

    # --- calendar_days ---
    op.create_table(
        "calendar_days",
        sa.Column("date", sa.Date, primary_key=True),
        sa.Column("dow", sa.Integer, nullable=False),
        sa.Column("dow_name", sa.String(3), nullable=False),
        sa.Column("is_weekend", sa.Boolean, nullable=False),
        sa.Column("iso_year", sa.Integer, nullable=False),
        sa.Column("iso_week", sa.Integer, nullable=False),
        sa.Column("is_payday", sa.Boolean, nullable=False),
        sa.Column("festival", sa.String(50), nullable=True),
        sa.Column("festival_ramp", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("is_holiday", sa.Boolean, nullable=False),
        sa.Column("monsoon", sa.Boolean, nullable=False),
        sa.Column("is_operating", sa.Boolean, nullable=False),
    )

    # --- vehicle_weekly_fuel ---
    op.create_table(
        "vehicle_weekly_fuel",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("vehicle_id", sa.String(20), sa.ForeignKey("vehicles.vehicle_id"), nullable=False),
        sa.Column("iso_year", sa.Integer, nullable=False),
        sa.Column("iso_week", sa.Integer, nullable=False),
        sa.Column("litres_used", sa.Float, nullable=False, server_default="0.0"),
        sa.UniqueConstraint("vehicle_id", "iso_year", "iso_week", name="uq_vehicle_weekly_fuel"),
    )

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False),
        sa.Column("email", sa.String(200), unique=True, nullable=True),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("outlet_id", sa.String(20), sa.ForeignKey("outlets.outlet_id"), nullable=True),
        sa.Column("vehicle_id", sa.String(20), sa.ForeignKey("vehicles.vehicle_id"), nullable=True),
        sa.Column("depot_id", sa.String(50), sa.ForeignKey("depots.code"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "role IN ('DISPATCHER','LOADER','DRIVER','STORE_MANAGER')",
            name="ck_users_role",
        ),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_outlet_id", "users", ["outlet_id"])
    op.create_index("ix_users_vehicle_id", "users", ["vehicle_id"])
    op.create_index("ix_users_depot_id", "users", ["depot_id"])

    # --- orders ---
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("reference", sa.String(40), unique=True, nullable=False),
        sa.Column("outlet_id", sa.String(20), sa.ForeignKey("outlets.outlet_id"), nullable=False),
        sa.Column("brand", sa.String(10), nullable=False),
        sa.Column("temperature_class", sa.String(10), nullable=False),
        sa.Column("delivery_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PLACED"),
        sa.Column("total_weight", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_volume", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_cases", sa.Integer, nullable=False, server_default="0"),
        sa.Column("priority", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("placed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("cutoff_missed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("placed_by_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('PLACED','CONFIRMED','QUEUED','PLANNED','LOADED','IN_TRANSIT','DELIVERED','PARTIAL','FAILED','DEFERRED','CANCELLED')",
            name="ck_orders_status",
        ),
        sa.CheckConstraint("brand IN ('Fresh','Style','Tech')", name="ck_orders_brand"),
        sa.CheckConstraint("temperature_class IN ('AMBIENT','CHILLED','FROZEN')", name="ck_orders_temperature_class"),
    )
    op.create_index("ix_orders_outlet_id", "orders", ["outlet_id"])
    op.create_index("ix_orders_delivery_date", "orders", ["delivery_date"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_reference", "orders", ["reference"], unique=True)

    # --- order_lines ---
    op.create_table(
        "order_lines",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("sku", sa.String(50), nullable=True),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_weight", sa.Float, nullable=False, server_default="0"),
        sa.Column("unit_volume", sa.Float, nullable=False, server_default="0"),
    )
    op.create_index("ix_order_lines_order_id", "order_lines", ["order_id"])

    # --- plans ---
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("delivery_date", sa.Date, nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.String(15), nullable=False, server_default="DRAFT"),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("summary_json", sa.JSON, nullable=True),
        sa.CheckConstraint("status IN ('DRAFT','PUBLISHED','SUPERSEDED')", name="ck_plans_status"),
    )
    op.create_index("ix_plans_delivery_date", "plans", ["delivery_date"])
    op.create_index("ix_plans_status", "plans", ["status"])

    # --- trips ---
    op.create_table(
        "trips",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("vehicle_id", sa.String(20), sa.ForeignKey("vehicles.vehicle_id"), nullable=False),
        sa.Column("trip_number", sa.Integer, nullable=False),
        sa.Column("planned_depart", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_return", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_distance", sa.Float, nullable=True),
        sa.Column("planned_fuel", sa.Float, nullable=True),
        sa.Column("status", sa.String(15), nullable=False, server_default="PLANNED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('PLANNED','LOADING','LOADED','IN_TRANSIT','COMPLETED','CANCELLED')",
            name="ck_trips_status",
        ),
        sa.UniqueConstraint("plan_id", "vehicle_id", "trip_number", name="uq_trips_plan_vehicle_trip"),
    )
    op.create_index("ix_trips_plan_id", "trips", ["plan_id"])
    op.create_index("ix_trips_vehicle_id", "trips", ["vehicle_id"])
    op.create_index("ix_trips_status", "trips", ["status"])

    # --- stops ---
    op.create_table(
        "stops",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("trip_id", sa.Integer, sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("outlet_id", sa.String(20), sa.ForeignKey("outlets.outlet_id"), nullable=False),
        sa.Column("sequence", sa.Integer, nullable=False),
        sa.Column("planned_eta", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_departure", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(15), nullable=False, server_default="PENDING"),
        sa.CheckConstraint(
            "status IN ('PENDING','ARRIVED','COMPLETED','PARTIAL','FAILED')",
            name="ck_stops_status",
        ),
    )
    op.create_index("ix_stops_trip_id", "stops", ["trip_id"])
    op.create_index("ix_stops_outlet_id", "stops", ["outlet_id"])

    # --- stop_orders ---
    op.create_table(
        "stop_orders",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("stop_id", sa.Integer, sa.ForeignKey("stops.id"), nullable=False),
        sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id"), nullable=False),
    )
    op.create_index("ix_stop_orders_stop_id", "stop_orders", ["stop_id"])
    op.create_index("ix_stop_orders_order_id", "stop_orders", ["order_id"])

    # --- deferrals ---
    op.create_table(
        "deferrals",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("reason_code", sa.String(30), nullable=False),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("consecutive_count", sa.Integer, nullable=False, server_default="1"),
        sa.Column("decided_by", sa.String(50), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("next_run_date", sa.Date, nullable=True),
        sa.Column("is_override", sa.Boolean, nullable=False, server_default="false"),
    )
    op.create_index("ix_deferrals_plan_id", "deferrals", ["plan_id"])
    op.create_index("ix_deferrals_order_id", "deferrals", ["order_id"])

    # --- load_checks ---
    op.create_table(
        "load_checks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("trip_id", sa.Integer, sa.ForeignKey("trips.id"), nullable=False),
        sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="OK"),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("photo_path", sa.String(300), nullable=True),
        sa.Column("flagged_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("flagged_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('OK','MISSING','DAMAGED')", name="ck_load_checks_status"),
    )
    op.create_index("ix_load_checks_trip_id", "load_checks", ["trip_id"])
    op.create_index("ix_load_checks_order_id", "load_checks", ["order_id"])

    # --- delivery_events ---
    op.create_table(
        "delivery_events",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("stop_id", sa.Integer, sa.ForeignKey("stops.id"), nullable=False),
        sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("outcome", sa.String(15), nullable=False),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("pod_photo_path", sa.String(300), nullable=True),
        sa.Column("pod_signature_path", sa.String(300), nullable=True),
        sa.Column("receiver_name", sa.String(200), nullable=True),
        sa.Column("receiver_pin_ok", sa.Boolean, nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("client_op_id", sa.String(100), nullable=False),
        sa.Column("recorded_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.CheckConstraint(
            "outcome IN ('DELIVERED','PARTIAL','REFUSED','CLOSED','FAILED')",
            name="ck_delivery_events_outcome",
        ),
        sa.UniqueConstraint("client_op_id", name="uq_delivery_events_client_op_id"),
    )
    op.create_index("ix_delivery_events_stop_id", "delivery_events", ["stop_id"])
    op.create_index("ix_delivery_events_order_id", "delivery_events", ["order_id"])

    # --- receipts ---
    op.create_table(
        "receipts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("confirmed_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", sa.String(10), nullable=False, server_default="FULL"),
        sa.CheckConstraint("status IN ('FULL','PARTIAL','DISPUTED')", name="ck_receipts_status"),
    )
    op.create_index("ix_receipts_order_id", "receipts", ["order_id"])

    # --- issues ---
    op.create_table(
        "issues",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer, sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("stop_id", sa.Integer, sa.ForeignKey("stops.id"), nullable=True),
        sa.Column("reported_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("type", sa.String(15), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("photo_path", sa.String(300), nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="OPEN"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "type IN ('SHORT','DAMAGED','WRONG_ITEM','OTHER')",
            name="ck_issues_type",
        ),
        sa.CheckConstraint("status IN ('OPEN','RESOLVED')", name="ck_issues_status"),
    )
    op.create_index("ix_issues_order_id", "issues", ["order_id"])
    op.create_index("ix_issues_stop_id", "issues", ["stop_id"])

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("target_role", sa.String(20), nullable=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("payload_json", sa.JSON, nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # --- audit_log ---
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("actor_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(50), nullable=False),
        sa.Column("before_json", sa.JSON, nullable=True),
        sa.Column("after_json", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_log_actor_user_id", "audit_log", ["actor_user_id"])
    op.create_index("ix_audit_log_entity", "audit_log", ["entity_type", "entity_id"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("notifications")
    op.drop_table("issues")
    op.drop_table("receipts")
    op.drop_table("delivery_events")
    op.drop_table("load_checks")
    op.drop_table("deferrals")
    op.drop_table("stop_orders")
    op.drop_table("stops")
    op.drop_table("trips")
    op.drop_table("plans")
    op.drop_table("order_lines")
    op.drop_table("orders")
    op.drop_table("users")
    op.drop_table("vehicle_weekly_fuel")
    op.drop_table("calendar_days")
    op.drop_table("vehicles")
    op.drop_table("outlets")
    op.drop_table("depots")
