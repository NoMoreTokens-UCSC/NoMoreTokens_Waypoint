"""Tests: planner validators."""
from __future__ import annotations

import datetime as dt

import pytest

from app.planner.types import (
    PlannerContext,
    PlannerOrder,
    PlannerOutlet,
    PlannerPlan,
    PlannerStop,
    PlannerTrip,
    PlannerVehicle,
)
from app.planner.validate import (
    validate_plan,
    validate_trip,
    _check_weight,
    _check_volume,
    _check_temp,
    _check_van_only,
    _check_depot,
    _check_fuel,
)


def _make_ctx(**kwargs) -> PlannerContext:
    outlet = PlannerOutlet(
        outlet_id="OUT001", brand="Fresh", district="Colombo", depot_code="Peliyagoda",
        van_only=False, is_mall=False, mall_window_open=None, mall_window_close=None,
        window_open_time=dt.time(5, 0), window_close_time=dt.time(7, 30),
        lat=6.93, lng=79.86, dock_type="street",
    )
    vehicle = PlannerVehicle(
        vehicle_id="VEH001", type="truck", is_refrigerated=True,
        weight_cap_kg=5000, volume_cap_m3=25,
        km_per_l=5, weekly_fuel_quota_l=400, fuel_used_this_week=50,
        depot_code="Peliyagoda", lat=6.96, lng=79.90,
    )
    order = PlannerOrder(
        order_id=1, outlet_id="OUT001", brand="Fresh",
        temperature_class="CHILLED", total_weight=500, total_volume=3.0, priority=False,
    )
    defaults = {
        "delivery_date": dt.date(2024, 4, 10),
        "outlets": {"OUT001": outlet},
        "vehicles": {"VEH001": vehicle},
        "orders": [order],
    }
    defaults.update(kwargs)
    return PlannerContext(**defaults)


def _make_trip(vehicle_id="VEH001", **kwargs) -> PlannerTrip:
    return PlannerTrip(
        vehicle_id=vehicle_id,
        trip_number=1,
        stops=[PlannerStop(outlet_id="OUT001", order_ids=[1], sequence=1)],
        **kwargs,
    )


class TestWeightRule:
    def test_within_capacity_passes(self):
        ctx = _make_ctx()
        trip = _make_trip()
        assert _check_weight(trip, ctx) == []

    def test_over_capacity_fails(self):
        ctx = _make_ctx()
        ctx.orders[0].total_weight = 9999  # way over 5000 kg cap
        trip = _make_trip()
        violations = _check_weight(trip, ctx)
        assert len(violations) == 1
        assert violations[0].rule == "WEIGHT"


class TestVolumeRule:
    def test_within_capacity_passes(self):
        ctx = _make_ctx()
        trip = _make_trip()
        assert _check_volume(trip, ctx) == []

    def test_over_capacity_fails(self):
        ctx = _make_ctx()
        ctx.orders[0].total_volume = 999.0  # way over 25 m³
        trip = _make_trip()
        violations = _check_volume(trip, ctx)
        assert len(violations) == 1
        assert violations[0].rule == "VOLUME"


class TestTempRule:
    def test_chilled_on_reefer_passes(self):
        ctx = _make_ctx()
        trip = _make_trip()
        assert _check_temp(trip, ctx) == []

    def test_chilled_on_non_reefer_fails(self):
        ctx = _make_ctx()
        ctx.vehicles["VEH001"].is_refrigerated = False
        trip = _make_trip()
        violations = _check_temp(trip, ctx)
        assert len(violations) == 1
        assert violations[0].rule == "TEMP"


class TestVanOnlyRule:
    def test_non_van_only_outlet_on_truck_passes(self):
        ctx = _make_ctx()
        trip = _make_trip()
        assert _check_van_only(trip, ctx) == []

    def test_van_only_outlet_on_truck_fails(self):
        ctx = _make_ctx()
        ctx.outlets["OUT001"].van_only = True
        ctx.vehicles["VEH001"].type = "truck"
        trip = _make_trip()
        violations = _check_van_only(trip, ctx)
        assert len(violations) == 1
        assert violations[0].rule == "VAN_ONLY"

    def test_van_only_outlet_on_van_passes(self):
        ctx = _make_ctx()
        ctx.outlets["OUT001"].van_only = True
        ctx.vehicles["VEH001"].type = "van"
        trip = _make_trip()
        assert _check_van_only(trip, ctx) == []


class TestDepotRule:
    def test_same_depot_passes(self):
        ctx = _make_ctx()
        trip = _make_trip()
        assert _check_depot(trip, ctx) == []

    def test_different_depot_fails(self):
        ctx = _make_ctx()
        ctx.outlets["OUT001"].depot_code = "Kandy"
        # vehicle is Peliyagoda
        trip = _make_trip()
        violations = _check_depot(trip, ctx)
        assert len(violations) == 1
        assert violations[0].rule == "DEPOT"


class TestFuelRule:
    def test_within_quota_passes(self):
        ctx = _make_ctx()
        plan = PlannerPlan(delivery_date=dt.date(2024, 4, 10))
        trip = _make_trip()
        trip.planned_fuel = 50  # well within remaining 350 L
        plan.trips = [trip]
        from app.planner.validate import _check_fuel
        assert _check_fuel(plan, ctx) == []

    def test_exceeds_quota_fails(self):
        ctx = _make_ctx()
        plan = PlannerPlan(delivery_date=dt.date(2024, 4, 10))
        trip = _make_trip()
        trip.planned_fuel = 9999  # way over remaining quota
        plan.trips = [trip]
        from app.planner.validate import _check_fuel
        violations = _check_fuel(plan, ctx)
        assert len(violations) == 1
        assert violations[0].rule == "FUEL"
