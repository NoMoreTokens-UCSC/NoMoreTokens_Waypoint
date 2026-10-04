"""Planner data types — pure Python, no DB or HTTP imports."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PlannerOutlet:
    outlet_id: str
    brand: str
    district: str
    depot_code: str
    van_only: bool
    is_mall: bool
    mall_window_open: Optional[dt.time]
    mall_window_close: Optional[dt.time]
    window_open_time: Optional[dt.time]
    window_close_time: Optional[dt.time]
    lat: float
    lng: float
    dock_type: str


@dataclass
class PlannerVehicle:
    vehicle_id: str
    type: str          # 'truck' | 'van'
    is_refrigerated: bool
    weight_cap_kg: float
    volume_cap_m3: float
    km_per_l: float
    weekly_fuel_quota_l: float
    fuel_used_this_week: float   # from vehicle_weekly_fuel
    depot_code: str
    lat: float
    lng: float


@dataclass
class PlannerOrder:
    order_id: int
    outlet_id: str
    brand: str
    temperature_class: str   # AMBIENT | CHILLED | FROZEN
    total_weight: float
    total_volume: float
    priority: bool
    consecutive_deferrals: int = 0


@dataclass
class PlannerStop:
    outlet_id: str
    order_ids: list[int] = field(default_factory=list)
    sequence: int = 0
    planned_eta: Optional[dt.datetime] = None


@dataclass
class PlannerTrip:
    vehicle_id: str
    trip_number: int   # 1 or 2
    stops: list[PlannerStop] = field(default_factory=list)
    planned_distance: float = 0.0
    planned_fuel: float = 0.0
    planned_depart: Optional[dt.datetime] = None
    planned_return: Optional[dt.datetime] = None


@dataclass
class PlannerPlan:
    delivery_date: dt.date
    trips: list[PlannerTrip] = field(default_factory=list)
    deferrals: list["PlannerDeferral"] = field(default_factory=list)


@dataclass
class PlannerDeferral:
    order_id: int
    reason_code: str
    explanation: str
    consecutive_count: int
    decided_by: str = "SYSTEM"


@dataclass
class Violation:
    rule: str          # e.g. 'WEIGHT', 'VOLUME', 'TEMP'
    trip_vehicle_id: Optional[str]
    stop_outlet_id: Optional[str]
    order_id: Optional[int]
    message: str
    severity: str = "ERROR"   # 'ERROR' | 'WARNING'


@dataclass
class PlannerContext:
    delivery_date: dt.date
    outlets: dict[str, PlannerOutlet]      # outlet_id -> outlet
    vehicles: dict[str, PlannerVehicle]    # vehicle_id -> vehicle
    orders: list[PlannerOrder]
    is_monsoon: bool = False
    avg_speed_kmh: float = 40.0            # default; overridden by district config
    road_factor: float = 1.3              # haversine to road distance factor
    # (district, depot) -> (depot_to_district_min, inter_stop_min), from district_travel.csv
    district_travel: dict[tuple[str, str], tuple[float, float]] = field(default_factory=dict)
    # (brand, dock_type) -> minutes, from service_allowance.csv
    service_allowance: dict[tuple[str, str], float] = field(default_factory=dict)
