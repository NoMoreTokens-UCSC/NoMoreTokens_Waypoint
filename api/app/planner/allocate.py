"""Allocation stub — Phase 6 will implement the algorithm."""
from __future__ import annotations

from app.planner.types import PlannerContext, PlannerPlan


def allocate(ctx: PlannerContext) -> PlannerPlan:
    """
    STUB — Phase 6.

    Allocates orders to vehicle trips, generating a PlannerPlan.

    The implementation will:
    1. Sort orders by priority, consecutive_deferrals, and distance from depot.
    2. For each vehicle (respecting depot, van_only, refrigerated constraints):
       a. Fill trips greedily until weight/volume capacity is reached.
       b. Check all constraint rules via validate.validate_trip().
       c. If no vehicle can fit an order, create a Deferral.
    3. Return the complete Plan with all trips and deferrals.

    Arguments:
        ctx: PlannerContext — all reference data and confirmed orders for the day.

    Returns:
        PlannerPlan — trips, stops, and deferrals (not yet persisted).
    """
    raise NotImplementedError("Allocate algorithm not yet implemented — Phase 6 TODO.")
