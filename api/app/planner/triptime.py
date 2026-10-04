"""Trip duration and daily budgets, following the booklet's model.

trip_minutes = outbound travel + inter-stop travel + total handling

Budgets per vehicle per day:
  Fresh                 270 minutes (the 03:30-08:00 window)
  Style and Tech        480 minutes combined (the trading day)
"""
from __future__ import annotations

from app.planner.types import PlannerContext

FRESH_BUDGET_MIN = 270.0
OTHER_BUDGET_MIN = 480.0
DEFAULT_HANDLING_MIN = 20.0


def budget_group(brand: str | None) -> str:
    """Fresh has its own budget; Style and Tech share one."""
    return "Fresh" if brand == "Fresh" else "Other"


def budget_minutes(brand: str | None) -> float:
    return FRESH_BUDGET_MIN if budget_group(brand) == "Fresh" else OTHER_BUDGET_MIN


def trip_minutes(
    ctx: PlannerContext,
    depot_code: str,
    district: str | None,
    brand: str | None,
    outlet_ids: list[str],
) -> float:
    """`outlet_ids` holds one entry per order, so an outlet with two orders appears twice."""
    if not outlet_ids or district is None:
        return 0.0
    outbound, inter_stop = ctx.district_travel.get((district, depot_code), (0.0, 0.0))
    handling = 0.0
    for outlet_id in outlet_ids:
        outlet = ctx.outlets.get(outlet_id)
        dock_type = outlet.dock_type if outlet else "street"
        handling += ctx.service_allowance.get((brand or "", dock_type), DEFAULT_HANDLING_MIN)
    return outbound + inter_stop * (len(outlet_ids) - 1) + handling
