"""Geo helpers — district centroids and depot coordinates.

Coordinates are SYNTHETIC approximations derived from district names.
They are used only for haversine routing in the planner.
All outlets generated from these coordinates are marked synthetic in the README.
"""
from __future__ import annotations

import random

# Approximate centroid lat/lng for every district in outlets.csv.
# Verified against actual districts; if a new district appears, this will raise.
DISTRICT_CENTROIDS: dict[str, tuple[float, float]] = {
    "Colombo":      (6.9271, 79.8612),
    "Gampaha":      (7.0873, 79.9993),
    "Kalutara":     (6.5854, 79.9607),
    "Galle":        (6.0535, 80.2210),
    "Matara":       (5.9549, 80.5550),
    "Kurunegala":   (7.4863, 80.3647),
    "Puttalam":     (8.0408, 79.8394),
    "Kandy":        (7.2906, 80.6337),
    "Matale":       (7.4675, 80.6234),
    "Nuwara Eliya": (6.9497, 80.7891),
    "Badulla":      (6.9934, 81.0550),
    "Kegalle":      (7.2513, 80.3464),
}

DEPOT_COORDS: dict[str, tuple[float, float]] = {
    "Peliyagoda": (6.9576, 79.9051),   # Peliyagoda area, NW of Colombo
    "Kandy":      (7.2906, 80.6337),   # Kandy city centre
}

# Jitter radius ≈ ±4 km at Sri Lanka latitude: 1° lat ≈ 111 km, 1° lng ≈ 107 km
_LAT_JITTER = 4.0 / 111.0
_LNG_JITTER = 4.0 / 107.0


def outlet_coords(outlet_id: str, district: str) -> tuple[float, float]:
    """
    Return deterministic (lat, lng) for an outlet.
    Uses random.Random(outlet_id) for reproducibility — same seed always gives same point.
    Raises if the district has no centroid entry.
    """
    if district not in DISTRICT_CENTROIDS:
        raise ValueError(
            f"District {district!r} has no centroid entry in seed/geo.py. "
            "Add it before seeding."
        )
    clat, clng = DISTRICT_CENTROIDS[district]
    rng = random.Random(outlet_id)
    lat = clat + rng.uniform(-_LAT_JITTER, _LAT_JITTER)
    lng = clng + rng.uniform(-_LNG_JITTER, _LNG_JITTER)
    return round(lat, 6), round(lng, 6)


def depot_coords(depot_code: str) -> tuple[float, float]:
    if depot_code not in DEPOT_COORDS:
        raise ValueError(f"Depot {depot_code!r} has no coordinate entry in seed/geo.py.")
    return DEPOT_COORDS[depot_code]
