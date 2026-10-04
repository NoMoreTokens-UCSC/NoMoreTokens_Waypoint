"""Order state machine — centralised transition table."""
from __future__ import annotations

from fastapi import HTTPException, status

# Allowed transitions: {current_status: set_of_allowed_next_statuses}
ORDER_TRANSITIONS: dict[str, set[str]] = {
    "PLACED":    {"CONFIRMED", "QUEUED", "CANCELLED"},
    "CONFIRMED": {"QUEUED", "CANCELLED", "DEFERRED", "PLANNED"},
    "QUEUED":    {"PLANNED", "CANCELLED", "DEFERRED"},
    "PLANNED":   {"LOADED", "DEFERRED", "CANCELLED", "QUEUED"},
    "LOADED":    {"IN_TRANSIT", "DELIVERED", "PARTIAL", "FAILED", "CANCELLED"},
    "IN_TRANSIT":{"DELIVERED", "PARTIAL", "FAILED", "DEFERRED"},
    "DELIVERED": {"PARTIAL"},          # receipt dispute
    "PARTIAL":   set(),
    "FAILED":    {"DEFERRED", "CANCELLED"},
    "DEFERRED":  {"QUEUED", "CONFIRMED", "CANCELLED"},
    "CANCELLED": set(),
}

TRIP_TRANSITIONS: dict[str, set[str]] = {
    "PLANNED":    {"LOADING", "LOADED", "CANCELLED"},
    "LOADING":    {"LOADED", "CANCELLED"},
    "LOADED":     {"IN_TRANSIT", "COMPLETED", "CANCELLED"},
    "IN_TRANSIT": {"COMPLETED", "CANCELLED"},
    "COMPLETED":  set(),
    "CANCELLED":  set(),
}

STOP_TRANSITIONS: dict[str, set[str]] = {
    "PENDING":   {"ARRIVED"},
    "ARRIVED":   {"COMPLETED", "PARTIAL", "FAILED"},
    "COMPLETED": set(),
    "PARTIAL":   set(),
    "FAILED":    {"PENDING"},  # retry
}


def transition_order(order, new_status: str) -> None:
    allowed = ORDER_TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_TRANSITION",
                "message": f"Cannot move order from {order.status!r} to {new_status!r}.",
                "details": {"current": order.status, "attempted": new_status, "allowed": list(allowed)},
            },
        )
    order.status = new_status


def transition_trip(trip, new_status: str) -> None:
    allowed = TRIP_TRANSITIONS.get(trip.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_TRANSITION",
                "message": f"Cannot move trip from {trip.status!r} to {new_status!r}.",
                "details": {"current": trip.status, "attempted": new_status, "allowed": list(allowed)},
            },
        )
    trip.status = new_status


def transition_stop(stop, new_status: str) -> None:
    allowed = STOP_TRANSITIONS.get(stop.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_TRANSITION",
                "message": f"Cannot move stop from {stop.status!r} to {new_status!r}.",
                "details": {"current": stop.status, "attempted": new_status, "allowed": list(allowed)},
            },
        )
    stop.status = new_status
