"""Haversine distance helpers and ETA estimation."""
from __future__ import annotations

import math


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def road_distance_km(lat1: float, lng1: float, lat2: float, lng2: float,
                     road_factor: float = 1.3) -> float:
    """Estimated road distance = haversine × road_factor."""
    return haversine_km(lat1, lng1, lat2, lng2) * road_factor


def build_distance_matrix(
    points: list[tuple[str, float, float]],
    road_factor: float = 1.3,
) -> dict[tuple[str, str], float]:
    """
    Build a full O(n²) distance matrix.
    `points` is a list of (id, lat, lng).
    Returns {(id_a, id_b): km}.
    """
    matrix: dict[tuple[str, str], float] = {}
    for i, (id_a, lat_a, lng_a) in enumerate(points):
        for id_b, lat_b, lng_b in points:
            if id_a == id_b:
                matrix[(id_a, id_b)] = 0.0
            else:
                matrix[(id_a, id_b)] = road_distance_km(lat_a, lng_a, lat_b, lng_b, road_factor)
    return matrix


def travel_minutes(dist_km: float, speed_kmh: float) -> float:
    """Convert distance to travel time in minutes."""
    if speed_kmh <= 0:
        return float("inf")
    return (dist_km / speed_kmh) * 60.0
