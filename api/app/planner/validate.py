"""Constraint validators for the planner.

Each rule is a separate function; all return a list of Violation (empty = pass).
`validate_trip` and `validate_plan` aggregate them.
"""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

from app.planner.triptime import (
    FRESH_BUDGET_MIN,
    OTHER_BUDGET_MIN,
    budget_group,
    trip_minutes,
)
from app.planner.types import (
    PlannerContext,
    PlannerTrip,
    PlannerPlan,
    Violation,
)


_LOCAL_TZ = ZoneInfo("Asia/Colombo")


def _local_time(moment: dt.datetime) -> dt.time:
    """Outlet windows are in Sri Lanka time; stored ETAs are UTC when timezone-aware."""
    if moment.tzinfo is not None:
        moment = moment.astimezone(_LOCAL_TZ)
    return moment.time()

def _check_weight(trip: PlannerTrip, ctx: PlannerContext) -> list[Violation]:
    """WEIGHT: total order weight on trip must not exceed vehicle capacity."""
    vehicle = ctx.vehicles.get(trip.vehicle_id)
    if not vehicle:
        return []
    total_w = sum(
        o.total_weight
        for stop in trip.stops
        for oid in stop.order_ids
        for o in ctx.orders
        if o.order_id == oid
    )
    if total_w > vehicle.weight_cap_kg:
        return [Violation(
            rule="WEIGHT",
            trip_vehicle_id=trip.vehicle_id,
            stop_outlet_id=None,
            order_id=None,
            message=f"Trip {trip.vehicle_id}#{trip.trip_number}: weight {total_w:.0f} kg > cap {vehicle.weight_cap_kg:.0f} kg",
        )]
    return []


def _check_volume(trip: PlannerTrip, ctx: PlannerContext) -> list[Violation]:
    """VOLUME: total order volume on trip must not exceed vehicle capacity."""
    vehicle = ctx.vehicles.get(trip.vehicle_id)
    if not vehicle:
        return []
    total_v = sum(
        o.total_volume
        for stop in trip.stops
        for oid in stop.order_ids
        for o in ctx.orders
        if o.order_id == oid
    )
    if total_v > vehicle.volume_cap_m3:
        return [Violation(
            rule="VOLUME",
            trip_vehicle_id=trip.vehicle_id,
            stop_outlet_id=None,
            order_id=None,
            message=f"Trip {trip.vehicle_id}#{trip.trip_number}: volume {total_v:.2f} m³ > cap {vehicle.volume_cap_m3:.2f} m³",
        )]
    return []


def _check_temp(trip: PlannerTrip, ctx: PlannerContext) -> list[Violation]:
    """TEMP: chilled/frozen orders require a refrigerated vehicle."""
    vehicle = ctx.vehicles.get(trip.vehicle_id)
    if not vehicle:
        return []
    violations = []
    for stop in trip.stops:
        for oid in stop.order_ids:
            for o in ctx.orders:
                if o.order_id == oid and o.temperature_class in ("CHILLED", "FROZEN"):
                    if not vehicle.is_refrigerated:
                        violations.append(Violation(
                            rule="TEMP",
                            trip_vehicle_id=trip.vehicle_id,
                            stop_outlet_id=stop.outlet_id,
                            order_id=oid,
                            message=f"Chilled/frozen order {oid} assigned to non-refrigerated {trip.vehicle_id}",
                        ))
    return violations


def _check_van_only(trip: PlannerTrip, ctx: PlannerContext) -> list[Violation]:
    """VAN_ONLY: outlets with van_only=True must only be served by vans."""
    vehicle = ctx.vehicles.get(trip.vehicle_id)
    if not vehicle:
        return []
    violations = []
    for stop in trip.stops:
        outlet = ctx.outlets.get(stop.outlet_id)
        if outlet and outlet.van_only and vehicle.type != "van":
            violations.append(Violation(
                rule="VAN_ONLY",
                trip_vehicle_id=trip.vehicle_id,
                stop_outlet_id=stop.outlet_id,
                order_id=None,
                message=f"Van-only outlet {stop.outlet_id} assigned to truck {trip.vehicle_id}",
            ))
    return violations


def _check_depot(trip: PlannerTrip, ctx: PlannerContext) -> list[Violation]:
    """DEPOT: each outlet must be served by a vehicle from the same depot."""
    vehicle = ctx.vehicles.get(trip.vehicle_id)
    if not vehicle:
        return []
    violations = []
    for stop in trip.stops:
        outlet = ctx.outlets.get(stop.outlet_id)
        if outlet and outlet.depot_code != vehicle.depot_code:
            violations.append(Violation(
                rule="DEPOT",
                trip_vehicle_id=trip.vehicle_id,
                stop_outlet_id=stop.outlet_id,
                order_id=None,
                message=f"Outlet {stop.outlet_id} (depot {outlet.depot_code}) served by vehicle from {vehicle.depot_code}",
            ))
    return violations


def _check_window(trip: PlannerTrip, ctx: PlannerContext) -> list[Violation]:
    """WINDOW: planned ETA must fall within the outlet's delivery window."""
    violations = []
    for stop in trip.stops:
        outlet = ctx.outlets.get(stop.outlet_id)
        if not outlet or not stop.planned_eta:
            continue
        eta_time = _local_time(stop.planned_eta)
        if outlet.is_mall and outlet.mall_window_open and outlet.mall_window_close:
            if not (outlet.mall_window_open <= eta_time <= outlet.mall_window_close):
                violations.append(Violation(
                    rule="WINDOW",
                    trip_vehicle_id=trip.vehicle_id,
                    stop_outlet_id=stop.outlet_id,
                    order_id=None,
                    message=f"Mall outlet {stop.outlet_id}: ETA {eta_time} outside window {outlet.mall_window_open}-{outlet.mall_window_close}",
                    severity="WARNING",
                ))
        elif outlet.window_open_time and outlet.window_close_time:
            if not (outlet.window_open_time <= eta_time <= outlet.window_close_time):
                violations.append(Violation(
                    rule="WINDOW",
                    trip_vehicle_id=trip.vehicle_id,
                    stop_outlet_id=stop.outlet_id,
                    order_id=None,
                    message=f"Outlet {stop.outlet_id}: ETA {eta_time} outside window {outlet.window_open_time}-{outlet.window_close_time}",
                    severity="WARNING",
                ))
    return violations


def _check_max_trips(plan: PlannerPlan, ctx: PlannerContext) -> list[Violation]:
    """MAX_TRIPS: no vehicle may have more than 2 trips in a plan."""
    from collections import Counter
    trip_counts: Counter[str] = Counter()
    for trip in plan.trips:
        trip_counts[trip.vehicle_id] += 1
    violations = []
    for vehicle_id, count in trip_counts.items():
        if count > 2:
            violations.append(Violation(
                rule="MAX_TRIPS",
                trip_vehicle_id=vehicle_id,
                stop_outlet_id=None,
                order_id=None,
                message=f"Vehicle {vehicle_id} has {count} trips (max 2)",
            ))
    return violations


def _check_fuel(plan: PlannerPlan, ctx: PlannerContext) -> list[Violation]:
    """FUEL: estimated fuel use must not exceed remaining weekly quota."""
    violations = []
    for trip in plan.trips:
        vehicle = ctx.vehicles.get(trip.vehicle_id)
        if not vehicle:
            continue
        remaining = vehicle.weekly_fuel_quota_l - vehicle.fuel_used_this_week
        if trip.planned_fuel and trip.planned_fuel > remaining:
            violations.append(Violation(
                rule="FUEL",
                trip_vehicle_id=trip.vehicle_id,
                stop_outlet_id=None,
                order_id=None,
                message=f"Vehicle {trip.vehicle_id}: trip needs {trip.planned_fuel:.0f} L but only {remaining:.0f} L left this week",
            ))
    return violations


def _check_not_operating(plan: PlannerPlan, ctx: PlannerContext) -> list[Violation]:
    """NOT_OPERATING: delivery date must be an operating day."""
    # This is checked at the API level; stub here for completeness
    return []


# ── Public API ──────────────────────────────────────────────────────────────


def _check_brand_district(trip: PlannerTrip, ctx: PlannerContext) -> list[Violation]:
    """BRAND_DISTRICT: all orders on one vehicle and trip share a brand and a district."""
    order_brand = {o.order_id: o.brand for o in ctx.orders}
    brands: set[str] = set()
    districts: set[str] = set()
    for stop in trip.stops:
        outlet = ctx.outlets.get(stop.outlet_id)
        if outlet:
            districts.add(outlet.district)
        for order_id in stop.order_ids:
            brand = order_brand.get(order_id) or (outlet.brand if outlet else None)
            if brand:
                brands.add(brand)
    violations: list[Violation] = []
    if len(brands) > 1:
        violations.append(
            Violation(
                rule="BRAND_DISTRICT",
                trip_vehicle_id=trip.vehicle_id,
                stop_outlet_id=None,
                order_id=None,
                message=f"Trip {trip.vehicle_id}/{trip.trip_number} mixes brands: {', '.join(sorted(brands))}",
            )
        )
    if len(districts) > 1:
        violations.append(
            Violation(
                rule="BRAND_DISTRICT",
                trip_vehicle_id=trip.vehicle_id,
                stop_outlet_id=None,
                order_id=None,
                message=f"Trip {trip.vehicle_id}/{trip.trip_number} mixes districts: {', '.join(sorted(districts))}",
            )
        )
    return violations


def _check_whole_orders(plan: PlannerPlan, ctx: PlannerContext) -> list[Violation]:
    """WHOLE_ORDER: an order belongs to exactly one vehicle and trip; it is never split."""
    seen: dict[int, str] = {}
    violations: list[Violation] = []
    for trip in plan.trips:
        where = f"{trip.vehicle_id}/{trip.trip_number}"
        for stop in trip.stops:
            for order_id in stop.order_ids:
                if order_id in seen and seen[order_id] != where:
                    violations.append(
                        Violation(
                            rule="WHOLE_ORDER",
                            trip_vehicle_id=trip.vehicle_id,
                            stop_outlet_id=stop.outlet_id,
                            order_id=order_id,
                            message=f"Order {order_id} is split across {seen[order_id]} and {where}",
                        )
                    )
                else:
                    seen[order_id] = where
    return violations


def _check_trip_time(plan: PlannerPlan, ctx: PlannerContext) -> list[Violation]:
    """TRIP_TIME: a vehicle's daily minutes stay inside the budget for each brand group.

    Fresh has its own budget; Style and Tech share one. Skipped when the reference
    travel tables are not available.
    """
    if not ctx.district_travel:
        return []
    order_brand = {o.order_id: o.brand for o in ctx.orders}
    # (vehicle_id, budget group) -> minutes used
    used: dict[tuple[str, str], float] = {}
    for trip in plan.trips:
        vehicle = ctx.vehicles.get(trip.vehicle_id)
        if not vehicle:
            continue
        outlet_ids = [stop.outlet_id for stop in trip.stops for _ in stop.order_ids]
        if not outlet_ids:
            continue
        first_outlet = ctx.outlets.get(trip.stops[0].outlet_id)
        district = first_outlet.district if first_outlet else None
        brand = next(
            (order_brand[oid] for stop in trip.stops for oid in stop.order_ids if oid in order_brand),
            first_outlet.brand if first_outlet else None,
        )
        minutes = trip_minutes(ctx, vehicle.depot_code, district, brand, outlet_ids)
        key = (trip.vehicle_id, budget_group(brand))
        used[key] = used.get(key, 0.0) + minutes

    violations: list[Violation] = []
    for (vehicle_id, group), minutes in sorted(used.items()):
        budget = FRESH_BUDGET_MIN if group == "Fresh" else OTHER_BUDGET_MIN
        if minutes > budget:
            violations.append(
                Violation(
                    rule="TRIP_TIME",
                    trip_vehicle_id=vehicle_id,
                    stop_outlet_id=None,
                    order_id=None,
                    message=(
                        f"Vehicle {vehicle_id} uses {minutes:.0f} of {budget:.0f} "
                        f"{group} minutes for the day"
                    ),
                )
            )
    return violations


def validate_trip(trip: PlannerTrip, ctx: PlannerContext) -> list[Violation]:
    violations: list[Violation] = []
    violations.extend(_check_weight(trip, ctx))
    violations.extend(_check_volume(trip, ctx))
    violations.extend(_check_temp(trip, ctx))
    violations.extend(_check_van_only(trip, ctx))
    violations.extend(_check_depot(trip, ctx))
    violations.extend(_check_window(trip, ctx))
    violations.extend(_check_brand_district(trip, ctx))
    return violations


def validate_plan(plan: PlannerPlan, ctx: PlannerContext) -> list[Violation]:
    violations: list[Violation] = []
    violations.extend(_check_max_trips(plan, ctx))
    violations.extend(_check_whole_orders(plan, ctx))
    violations.extend(_check_trip_time(plan, ctx))
    violations.extend(_check_fuel(plan, ctx))
    violations.extend(_check_not_operating(plan, ctx))
    for trip in plan.trips:
        violations.extend(validate_trip(trip, ctx))
    return violations
