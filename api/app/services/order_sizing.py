"""How big an order is, from the number of units.

The training data shows weight and volume follow the unit count closely for each brand (Fresh dry and
chilled alike), so the system works them out and does not rely on what a store types.
"""
from __future__ import annotations

# (kg, m3) per unit: a case for Fresh, a carton for Style, an item for Tech.
PER_UNIT: dict[str, tuple[float, float]] = {
    "Fresh": (6.9, 0.037),
    "Style": (14.9, 0.24),
    "Tech": (214.0, 0.71),
}


# The most units one order carries (the largest seen in the training data, rounded up).
MAX_UNITS: dict[str, int] = {"Fresh": 300, "Style": 150, "Tech": 25}

# Tech appliances vary a lot (58 to 470 kg an item in the data), so a store may state the weight.
TECH_ITEM_KG: tuple[float, float] = (50.0, 500.0)


def estimate_load(brand: str, units: int) -> tuple[float, float]:
    """Weight in kg and volume in m3 for `units` of a brand's goods."""
    kg, m3 = PER_UNIT.get(brand, PER_UNIT["Fresh"])
    return round(units * kg, 1), round(units * m3, 3)
