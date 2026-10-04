"""Delivery planning allocation engine.

Algorithm — greedy two-pass bin-packing:

Pass 1 — Order prioritisation:
  Sort all orders by:
    1. Consecutive deferrals DESC  (overdue orders first — escalation rule)
    2. priority DESC               (mall / van_only flags)
    3. temperature_class           (FROZEN > CHILLED > AMBIENT — temp-compatible first)
    4. total_weight DESC           (fill heavy items early; reduces fragmentation)

Pass 2 — Per-depot vehicle assignment:
  For each depot independently:
    a. Separate eligible vehicles into refrigerated and ambient pools.
    b. For each order (already sorted):
         i.  Determine required pool (CHILLED/FROZEN → reefer, van_only outlet → van pool)
         ii. Try to fit the order into an existing trip (trip 1 or trip 2) of any
             eligible vehicle, checking WEIGHT + VOLUME + FUEL constraints.
         iii.If no existing trip can fit, open a new trip (trip 2) for vehicles that
             only have trip 1 so far.
         iv. If no vehicle can take the order at all → Deferral.

Pass 3 — Route sequencing:
  Within each trip, order stops by nearest-neighbour from the depot position.

Pass 4 — ETA estimation:
  Walk the stop sequence, accumulating travel time (haversine × road_factor / speed)
  + service_time per stop (dock_type average from the service_allowance CSV, defaulting
  to 20 min).  All times in Asia/Colombo.

Deferral reasons:
  - CAPACITY        : total demand exceeds all fleet capacity
  - TEMP_MISMATCH   : no refrigerated vehicle available at the depot
  - VAN_ONLY        : no van available at the depot
  - CONSECUTIVE_3   : 3rd consecutive deferral → raised for dispatcher override
  - FUEL_QUOTA      : all vehicles near weekly fuel limit
"""
from __future__ import annotations

import datetime as dt
import math
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

from app.planner.distance import haversine_km, road_distance_km, travel_minutes
from app.planner.triptime import budget_group, budget_minutes, trip_minutes
from app.planner.types import (
    PlannerContext,
    PlannerDeferral,
    PlannerOrder,
    PlannerOutlet,
    PlannerPlan,
    PlannerStop,
    PlannerTrip,
    PlannerVehicle,
)

# ── Constants ────────────────────────────────────────────────────────────────

# Average service time per dock type (minutes).  Source: service_allowance.csv averages.
_SERVICE_MINUTES: dict[str, float] = {
    "rear_dock":  18.0,
    "mall_bay":   45.0,   # includes wait for mall security + unloading
    "street":     25.0,
    "default":    20.0,
}

# Asia/Colombo offset
_TZ = dt.timezone(dt.timedelta(hours=5, minutes=30))

# Depart time from depot (05:00 local)
_DEPART_HOUR = 5

# Fresh runs inside the 03:30-08:00 window (booklet); other brands run the trading day.
_FRESH_DEPART = (3, 30)
_FRESH_TRIP2_DEPART = (5, 45)

# Maximum consecutive deferrals before a CONSECUTIVE_3 reason is raised
_MAX_CONSECUTIVE = 3

# Fuel headroom: only use 95% of remaining quota to leave room for unplanned detours
_FUEL_HEADROOM = 0.95


# ── Internal trip state ──────────────────────────────────────────────────────

@dataclass
class _TripState:
    vehicle_id: str
    trip_number: int
    weight_used: float = 0.0
    volume_used: float = 0.0
    fuel_used: float = 0.0            # estimated fuel used so far on THIS trip
    stops: dict[str, _StopState] = field(default_factory=dict)  # outlet_id → stop
    # Set by the first order on the trip; every later order must match both.
    brand: Optional[str] = None
    district: Optional[str] = None


@dataclass
class _StopState:
    outlet_id: str
    order_ids: list[int] = field(default_factory=list)


def _service_minutes(outlet: PlannerOutlet) -> float:
    return _SERVICE_MINUTES.get(outlet.dock_type, _SERVICE_MINUTES["default"])


def _can_fit(
    state: _TripState,
    vehicle: PlannerVehicle,
    order: PlannerOrder,
    extra_fuel: float,
    outlet: PlannerOutlet,
) -> bool:
    """Return True if the order fits the trip: same brand and district, and within capacity."""
    if state.brand is not None and state.brand != order.brand:
        return False
    if state.district is not None and state.district != outlet.district:
        return False
    if state.weight_used + order.total_weight > vehicle.weight_cap_kg:
        return False
    if state.volume_used + order.total_volume > vehicle.volume_cap_m3:
        return False
    remaining_quota = (vehicle.weekly_fuel_quota_l - vehicle.fuel_used_this_week) * _FUEL_HEADROOM
    if state.fuel_used + extra_fuel > remaining_quota:
        return False
    return True


def _order_outlet_ids(state: _TripState) -> list[str]:
    """One entry per order on the trip, as the booklet's time model counts them."""
    return [stop.outlet_id for stop in state.stops.values() for _ in stop.order_ids]


def _within_time_budget(
    vehicle_trips: dict[int, "_TripState"],
    candidate: "_TripState",
    order: PlannerOrder,
    outlet: PlannerOutlet,
    ctx: PlannerContext,
    depot_code: str,
) -> bool:
    """True when adding the order keeps the vehicle's day inside the budget for that brand."""
    if not ctx.district_travel:
        return True  # reference tables are not mounted; skip the check rather than guess
    group = budget_group(order.brand)
    used = 0.0
    for trip_num, state in vehicle_trips.items():
        if state is candidate or budget_group(state.brand) != group:
            continue
        used += trip_minutes(ctx, depot_code, state.district, state.brand, _order_outlet_ids(state))
    outlet_ids = _order_outlet_ids(candidate) + [outlet.outlet_id]
    district = candidate.district or outlet.district
    brand = candidate.brand or order.brand
    return used + trip_minutes(ctx, depot_code, district, brand, outlet_ids) <= budget_minutes(brand)


def _add_order_to_trip(
    state: _TripState, order: PlannerOrder, extra_fuel: float, outlet: PlannerOutlet
) -> None:
    if state.brand is None:
        state.brand = order.brand
    if state.district is None:
        state.district = outlet.district
    state.weight_used += order.total_weight
    state.volume_used += order.total_volume
    state.fuel_used += extra_fuel
    if order.outlet_id not in state.stops:
        state.stops[order.outlet_id] = _StopState(outlet_id=order.outlet_id)
    state.stops[order.outlet_id].order_ids.append(order.order_id)


def _estimate_fuel(distance_km: float, km_per_l: float) -> float:
    if km_per_l <= 0:
        return 0.0
    return distance_km / km_per_l


def _depot_position(depot_code: str) -> tuple[float, float]:
    """Approximate depot coordinates. These match seed/geo.py DEPOT_COORDS."""
    coords = {
        "Peliyagoda": (6.9576, 79.9051),
        "Kandy":      (7.2906, 80.6337),
    }
    return coords.get(depot_code, (7.0, 80.0))


# ── Nearest-neighbour route sequencer ────────────────────────────────────────

def _sequence_stops(
    depot_lat: float,
    depot_lng: float,
    outlet_ids: list[str],
    outlets: dict[str, PlannerOutlet],
) -> list[str]:
    """
    Earliest delivery deadline first, with the nearer outlet breaking a tie.
    Visiting by distance alone misses windows that close early.
    """
    def deadline(oid: str) -> dt.time:
        outlet = outlets[oid]
        close = outlet.mall_window_close if outlet.is_mall else outlet.window_close_time
        return close or dt.time(23, 59)

    remaining = list(outlet_ids)
    route: list[str] = []
    cur_lat, cur_lng = depot_lat, depot_lng

    while remaining:
        best_id = min(
            remaining,
            key=lambda oid: (deadline(oid),
                             haversine_km(cur_lat, cur_lng,
                                          outlets[oid].lat, outlets[oid].lng)),
        )
        route.append(best_id)
        remaining.remove(best_id)
        cur_lat, cur_lng = outlets[best_id].lat, outlets[best_id].lng

    return route


# ── ETA calculation ───────────────────────────────────────────────────────────

def _compute_etas(
    depot_lat: float,
    depot_lng: float,
    ordered_outlets: list[str],
    outlets: dict[str, PlannerOutlet],
    delivery_date: dt.date,
    avg_speed_kmh: float,
    road_factor: float,
    is_monsoon: bool,
    depart_time: dt.datetime,
) -> tuple[list[dt.datetime], float]:
    """
    Returns (list_of_etas, total_road_km), starting from the trip's departure time.
    A vehicle arriving before an outlet's window opens waits for it.
    Monsoon reduces effective speed by 20%.
    """
    speed = avg_speed_kmh * (0.80 if is_monsoon else 1.0)
    cur_time = depart_time
    cur_lat, cur_lng = depot_lat, depot_lng
    etas: list[dt.datetime] = []
    total_km = 0.0

    for outlet_id in ordered_outlets:
        outlet = outlets[outlet_id]
        dist_km = road_distance_km(cur_lat, cur_lng, outlet.lat, outlet.lng, road_factor)
        travel_min = travel_minutes(dist_km, speed)
        cur_time += dt.timedelta(minutes=travel_min)
        opens = outlet.mall_window_open if outlet.is_mall else outlet.window_open_time
        if opens and cur_time.timetz().replace(tzinfo=_TZ) < opens.replace(tzinfo=_TZ):
            cur_time = cur_time.replace(hour=opens.hour, minute=opens.minute, second=0, microsecond=0)
        etas.append(cur_time)
        total_km += dist_km
        # Service time
        cur_time += dt.timedelta(minutes=_service_minutes(outlet))
        cur_lat, cur_lng = outlet.lat, outlet.lng

    # Return to depot
    dist_back = road_distance_km(cur_lat, cur_lng, depot_lat, depot_lng, road_factor)
    total_km += dist_back

    return etas, total_km


# ── Main allocator ────────────────────────────────────────────────────────────

def _temperature_priority(order: PlannerOrder) -> int:
    """Lower = process earlier (frozen before chilled before ambient)."""
    return {"FROZEN": 0, "CHILLED": 1, "AMBIENT": 2}.get(order.temperature_class, 2)


def _sort_orders(orders: list[PlannerOrder]) -> list[PlannerOrder]:
    return sorted(
        orders,
        key=lambda o: (
            -(o.consecutive_deferrals),    # most-deferred first
            -int(o.priority),              # priority flag
            _temperature_priority(o),      # frozen → chilled → ambient
            -o.total_weight,               # heavy first
        ),
    )


def allocate(ctx: PlannerContext) -> PlannerPlan:
    """
    Greedy two-pass bin-packing allocator.
    Returns a PlannerPlan (not yet persisted).
    """
    plan = PlannerPlan(delivery_date=ctx.delivery_date)

    # Group vehicles and orders by depot
    vehicles_by_depot: dict[str, list[PlannerVehicle]] = defaultdict(list)
    for v in ctx.vehicles.values():
        vehicles_by_depot[v.depot_code].append(v)

    outlets_by_depot: dict[str, set[str]] = defaultdict(set)
    for outlet_id, outlet in ctx.outlets.items():
        outlets_by_depot[outlet.depot_code].add(outlet_id)

    orders_by_depot: dict[str, list[PlannerOrder]] = defaultdict(list)
    for order in ctx.orders:
        outlet = ctx.outlets.get(order.outlet_id)
        if outlet:
            orders_by_depot[outlet.depot_code].append(order)

    # --- Per-depot allocation ---
    for depot_code, depot_orders in orders_by_depot.items():
        vehicles = vehicles_by_depot.get(depot_code, [])
        if not vehicles:
            for order in depot_orders:
                plan.deferrals.append(PlannerDeferral(
                    order_id=order.order_id,
                    reason_code="NO_VEHICLE",
                    explanation=f"No vehicle available at depot {depot_code}",
                    consecutive_count=order.consecutive_deferrals + 1,
                ))
            continue

        depot_lat, depot_lng = _depot_position(depot_code)

        # Categorise vehicles
        reefer_trucks = [v for v in vehicles if v.is_refrigerated and v.type == "truck"]
        reefer_vans   = [v for v in vehicles if v.is_refrigerated and v.type == "van"]
        ambient_trucks = [v for v in vehicles if not v.is_refrigerated and v.type == "truck"]
        ambient_vans   = [v for v in vehicles if not v.is_refrigerated and v.type == "van"]

        # Trip states: vehicle_id -> {1: _TripState, 2: _TripState}
        trip_states: dict[str, dict[int, _TripState]] = {
            v.vehicle_id: {} for v in vehicles
        }

        sorted_orders = _sort_orders(depot_orders)

        for order in sorted_orders:
            outlet = ctx.outlets.get(order.outlet_id)
            if not outlet:
                continue

            needs_reefer = order.temperature_class in ("CHILLED", "FROZEN")
            needs_van    = outlet.van_only

            # Build eligible vehicle pool
            if needs_van and needs_reefer:
                pool = reefer_vans
            elif needs_van:
                pool = reefer_vans + ambient_vans
            elif needs_reefer:
                pool = reefer_trucks + reefer_vans
            else:
                pool = reefer_trucks + ambient_trucks + reefer_vans + ambient_vans

            # Check for escalation
            if order.consecutive_deferrals >= _MAX_CONSECUTIVE:
                plan.deferrals.append(PlannerDeferral(
                    order_id=order.order_id,
                    reason_code="CONSECUTIVE_3",
                    explanation=(
                        f"Order deferred {order.consecutive_deferrals} consecutive times. "
                        "Dispatcher override required."
                    ),
                    consecutive_count=order.consecutive_deferrals + 1,
                ))
                continue

            if not pool:
                reason = "TEMP_MISMATCH" if needs_reefer else ("VAN_ONLY" if needs_van else "NO_VEHICLE")
                plan.deferrals.append(PlannerDeferral(
                    order_id=order.order_id,
                    reason_code=reason,
                    explanation=f"No eligible vehicle at depot {depot_code} (needs_reefer={needs_reefer}, needs_van={needs_van})",
                    consecutive_count=order.consecutive_deferrals + 1,
                ))
                continue

            placed = False

            # Estimate marginal fuel for a new stop at this outlet from some rough depot distance
            approx_dist = road_distance_km(
                depot_lat, depot_lng,
                outlet.lat, outlet.lng,
                ctx.road_factor,
            ) * 2  # round trip approximation for marginal fuel estimate

            # Try existing trips (trip 1 first, then trip 2) for each vehicle in pool
            for vehicle in pool:
                for trip_num in (1, 2):
                    if trip_num not in trip_states[vehicle.vehicle_id]:
                        continue
                    state = trip_states[vehicle.vehicle_id][trip_num]
                    extra_fuel = _estimate_fuel(approx_dist, vehicle.km_per_l)
                    if _can_fit(state, vehicle, order, extra_fuel, outlet) and _within_time_budget(
                        trip_states[vehicle.vehicle_id], state, order, outlet, ctx, depot_code
                    ):
                        _add_order_to_trip(state, order, extra_fuel, outlet)
                        placed = True
                        break
                if placed:
                    break

            if not placed:
                # Open a new trip for vehicles that only have trip 1 (can take trip 2)
                for vehicle in pool:
                    trips_used = len(trip_states[vehicle.vehicle_id])
                    if trips_used == 0:
                        # Open trip 1
                        new_state = _TripState(vehicle_id=vehicle.vehicle_id, trip_number=1)
                        extra_fuel = _estimate_fuel(approx_dist, vehicle.km_per_l)
                        if _can_fit(new_state, vehicle, order, extra_fuel, outlet) and _within_time_budget(
                            trip_states[vehicle.vehicle_id], new_state, order, outlet, ctx, depot_code
                        ):
                            _add_order_to_trip(new_state, order, extra_fuel, outlet)
                            trip_states[vehicle.vehicle_id][1] = new_state
                            placed = True
                            break
                    elif trips_used == 1:
                        # Open trip 2
                        new_state = _TripState(vehicle_id=vehicle.vehicle_id, trip_number=2)
                        extra_fuel = _estimate_fuel(approx_dist, vehicle.km_per_l)
                        if _can_fit(new_state, vehicle, order, extra_fuel, outlet) and _within_time_budget(
                            trip_states[vehicle.vehicle_id], new_state, order, outlet, ctx, depot_code
                        ):
                            _add_order_to_trip(new_state, order, extra_fuel, outlet)
                            trip_states[vehicle.vehicle_id][2] = new_state
                            placed = True
                            break

            if not placed:
                plan.deferrals.append(PlannerDeferral(
                    order_id=order.order_id,
                    reason_code="CAPACITY",
                    explanation=f"All eligible vehicles at {depot_code} are at capacity",
                    consecutive_count=order.consecutive_deferrals + 1,
                ))

        # --- Build PlannerTrips from _TripStates ---
        for vehicle in vehicles:
            for trip_num, state in trip_states[vehicle.vehicle_id].items():
                if not state.stops:
                    continue

                # Sequence the stops
                ordered_outlet_ids = _sequence_stops(
                    depot_lat, depot_lng,
                    list(state.stops.keys()),
                    ctx.outlets,
                )

                # Compute ETAs and distance
                # Trip 2 departs after estimated return of trip 1 + 30-min turnaround
                if state.brand == "Fresh":
                    hour, minute = _FRESH_DEPART if trip_num == 1 else _FRESH_TRIP2_DEPART
                elif trip_num == 1:
                    hour, minute = _DEPART_HOUR, 0
                else:
                    hour, minute = _DEPART_HOUR + 4, 30
                depart_time = dt.datetime(
                    ctx.delivery_date.year, ctx.delivery_date.month, ctx.delivery_date.day,
                    hour, minute, 0, tzinfo=_TZ,
                )

                etas, total_km = _compute_etas(
                    depot_lat, depot_lng,
                    ordered_outlet_ids,
                    ctx.outlets,
                    ctx.delivery_date,
                    avg_speed_kmh=ctx.avg_speed_kmh,
                    road_factor=ctx.road_factor,
                    is_monsoon=ctx.is_monsoon,
                    depart_time=depart_time,
                )

                fuel_l = _estimate_fuel(total_km, vehicle.km_per_l)
                return_time = etas[-1] + dt.timedelta(
                    minutes=travel_minutes(
                        road_distance_km(
                            ctx.outlets[ordered_outlet_ids[-1]].lat,
                            ctx.outlets[ordered_outlet_ids[-1]].lng,
                            depot_lat, depot_lng,
                            ctx.road_factor,
                        ),
                        ctx.avg_speed_kmh,
                    )
                ) if ordered_outlet_ids else depart_time

                planner_stops = []
                for seq, (outlet_id, eta) in enumerate(zip(ordered_outlet_ids, etas), start=1):
                    stop_state = state.stops[outlet_id]
                    planner_stops.append(PlannerStop(
                        outlet_id=outlet_id,
                        order_ids=stop_state.order_ids,
                        sequence=seq,
                        planned_eta=eta,
                    ))

                plan.trips.append(PlannerTrip(
                    vehicle_id=vehicle.vehicle_id,
                    trip_number=trip_num,
                    stops=planner_stops,
                    planned_distance=round(total_km, 1),
                    planned_fuel=round(fuel_l, 1),
                    planned_depart=depart_time,
                    planned_return=return_time,
                ))

    return plan
