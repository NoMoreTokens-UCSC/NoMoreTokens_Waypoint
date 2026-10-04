"""Depot, brand and weekly demand history, plus a forecast for the test weeks.

Baseline method, kept simple so it can be explained to a dispatcher:
- History counts every order by the week it was requested, including deferred
  and never-dispatched orders, because they still represent demand.
- Forecast = mean of the last four historical weeks for the same depot and brand.
- In a week with a payday or festival, the forecast is scaled by the ratio of
  average event-week demand to average normal-week demand for that depot and brand.
- Chilled volume exists only for Fresh; Style and Tech are always zero.

Capacity: each depot's fleet is averaged by volume capacity. A vehicle makes at most
two trips a day (booklet rule) on the operating days in the week. Vehicles needed is the
forecast volume divided by that weekly capacity, rounded up. Chilled volume needs reefers.
"""
from __future__ import annotations

import csv
import datetime as dt
import math
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

METHOD = "Four-week average per depot and brand, adjusted for paydays and festivals. Chilled is Fresh only. Vehicles make two trips a day, with one driver per vehicle."
LOOKBACK_WEEKS = 4
TRIPS_PER_DAY = 2
DEFAULT_OPERATING_DAYS = 6


def _read_csv(path: Path):
    with path.open(newline="", encoding="utf-8") as handle:
        yield from csv.DictReader(handle)


def _event_weeks(calendar_path: Path) -> set[tuple[int, int]]:
    events: set[tuple[int, int]] = set()
    for row in _read_csv(calendar_path):
        if row["is_payday"] == "1" or row["festival"] or row["festival_ramp"] not in ("", "0", "0.0"):
            events.add((int(row["iso_year"]), int(row["iso_week"])))
    return events


def _operating_days(calendar_path: Path) -> dict[tuple[int, int], int]:
    days: dict[tuple[int, int], int] = defaultdict(int)
    for row in _read_csv(calendar_path):
        if row["is_operating"] == "1":
            days[(int(row["iso_year"]), int(row["iso_week"]))] += 1
    return days


def _fleet(vehicles_path: Path) -> dict[str, dict[str, float]]:
    """Per depot: vehicle count, average volume capacity, reefer count and average reefer capacity."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in _read_csv(vehicles_path):
        groups[row["depot"]].append(row)
    fleet = {}
    for depot, rows in groups.items():
        reefers = [r for r in rows if r["temp"] == "reefer"]
        fleet[depot] = {
            "vehicles": len(rows),
            "avg_volume": sum(float(r["volume_cap_m3"]) for r in rows) / len(rows),
            "reefers": len(reefers),
            "avg_reefer_volume": (
                sum(float(r["volume_cap_m3"]) for r in reefers) / len(reefers) if reefers else 0.0
            ),
        }
    return fleet


def _needed(volume: float, per_vehicle_week: float) -> int:
    if volume <= 0 or per_vehicle_week <= 0:
        return 0
    return math.ceil(volume / per_vehicle_week)


def _next_week(year: int, week: int) -> tuple[int, int]:
    monday = dt.date.fromisocalendar(year, week, 1) + dt.timedelta(days=7)
    y, w, _ = monday.isocalendar()
    return y, w


def _point_forecast(
    points: list[tuple[int, int, float, float]], events: set[tuple[int, int]], target: tuple[int, int]
) -> tuple[float, float]:
    """Forecast one week from the history that comes before it (points are sorted)."""
    recent = points[-LOOKBACK_WEEKS:]
    if not recent:
        return 0.0, 0.0
    base_total = sum(p[2] for p in recent) / len(recent)
    base_chilled = sum(p[3] for p in recent) / len(recent)
    factor = 1.0
    if target in events:
        event_totals = [p[2] for p in points if (p[0], p[1]) in events]
        normal_totals = [p[2] for p in points if (p[0], p[1]) not in events]
        if event_totals and normal_totals:
            normal_avg = sum(normal_totals) / len(normal_totals)
            if normal_avg > 0:
                factor = (sum(event_totals) / len(event_totals)) / normal_avg
    return base_total * factor, base_chilled * factor


def _backtest(series, events, weeks: int = 4) -> dict:
    """Hide the last known weeks, forecast them from earlier data, and measure the error."""
    all_weeks = sorted({(p[0], p[1]) for points in series.values() for p in points})
    held_out = set(all_weeks[-weeks:])
    abs_error = 0.0
    actual_sum = 0.0
    by_depot: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
    for (depot, brand), points in series.items():
        for year, week, actual, _ in points:
            if (year, week) not in held_out:
                continue
            earlier = [p for p in points if (p[0], p[1]) < (year, week)]
            predicted, _ = _point_forecast(earlier, events, (year, week))
            err = abs(predicted - actual)
            abs_error += err
            actual_sum += actual
            by_depot[depot][0] += err
            by_depot[depot][1] += actual
    def pct(err: float, actual: float) -> float | None:
        return round(100 * err / actual, 1) if actual > 0 else None
    return {
        "weeks": [f"{y}-W{w:02d}" for y, w in sorted(held_out)],
        "wape_percent": pct(abs_error, actual_sum),
        "by_depot": {depot: pct(v[0], v[1]) for depot, v in sorted(by_depot.items())},
    }


@lru_cache(maxsize=1)
def compute(data_root: str) -> dict:
    root = Path(data_root)
    events = _event_weeks(root / "General Data" / "calendar.csv")
    operating_days = _operating_days(root / "General Data" / "calendar.csv")
    fleet = _fleet(root / "General Data" / "vehicles.csv")
    outlet_depot: dict[str, str] = {}
    for row in _read_csv(root / "General Data" / "outlets.csv"):
        outlet_depot[row["outlet_id"]] = row["depot"]

    # volume[(depot, brand, year, week)] -> [total, chilled]
    volume: dict[tuple[str, str, int, int], list[float]] = defaultdict(lambda: [0.0, 0.0])
    for row in _read_csv(root / "Training Data" / "deliveries_train.csv"):
        year, week, _ = dt.date.fromisoformat(row["order_date"]).isocalendar()
        depot = row["depot"] or outlet_depot.get(row["outlet_id"], "")
        brand = row["brand"]
        cell = volume[(depot, brand, year, week)]
        cell[0] += float(row["order_volume_m3"])
        if brand == "Fresh" and row["temp_requirement"] == "chilled":
            cell[1] += float(row["order_volume_m3"])

    series: dict[tuple[str, str], list[tuple[int, int, float, float]]] = defaultdict(list)
    for (depot, brand, year, week), (total, chilled) in volume.items():
        series[(depot, brand)].append((year, week, total, chilled))
    for points in series.values():
        points.sort()

    history = [
        {
            "depot": depot,
            "brand": brand,
            "iso_year": year,
            "iso_week": week,
            "total_m3": round(total, 3),
            "chilled_m3": round(chilled, 3),
            "is_event_week": (year, week) in events,
        }
        for (depot, brand), points in sorted(series.items())
        for year, week, total, chilled in points
    ]

    test_rows = list(_read_csv(root / "Test Data" / "task2a_test_inputs.csv"))
    test_pairs = {
        (r["depot"], r["brand"], int(r["iso_year"]), int(r["iso_week"])): r["row_id"] for r in test_rows
    }
    last_known = max((p[0], p[1]) for points in series.values() for p in points)
    horizon_end = max((y, w) for _, _, y, w in test_pairs) if test_pairs else last_known

    # Forecast every week from the end of history to the end of the test horizon, so the
    # gap between them is filled. Test weeks are flagged so the submission rows can be found.
    target_weeks: list[tuple[int, int]] = []
    week = _next_week(*last_known)
    while week <= horizon_end:
        target_weeks.append(week)
        week = _next_week(*week)
    combos = set(series) | {(d, b) for d, b, _, _ in test_pairs}

    forecast = []
    for depot, brand in sorted(combos):
        points = series.get((depot, brand), [])
        for year, wk in target_weeks:
            earlier = [p for p in points if (p[0], p[1]) < (year, wk)]
            total, chilled = _point_forecast(earlier, events, (year, wk))
            forecast.append(
                {
                    "row_id": test_pairs.get((depot, brand, year, wk)),
                    "depot": depot,
                    "brand": brand,
                    "iso_year": year,
                    "iso_week": wk,
                    "total_m3": round(total, 3),
                    "chilled_m3": round(chilled, 3) if brand == "Fresh" else 0.0,
                    "is_event_week": (year, wk) in events,
                    "in_test_horizon": (depot, brand, year, wk) in test_pairs,
                }
            )

    grouped: dict[tuple[str, int, int], dict[str, float]] = defaultdict(
        lambda: {"total_m3": 0.0, "chilled_m3": 0.0}
    )
    for f in forecast:
        cell = grouped[(f["depot"], f["iso_year"], f["iso_week"])]
        cell["total_m3"] += f["total_m3"]
        cell["chilled_m3"] += f["chilled_m3"]
    capacity = []
    for (depot, year, week), cell in sorted(grouped.items()):
        fleet_row = fleet.get(depot, {"vehicles": 0, "avg_volume": 0.0, "reefers": 0, "avg_reefer_volume": 0.0})
        days = operating_days.get((year, week), DEFAULT_OPERATING_DAYS)
        per_vehicle = fleet_row["avg_volume"] * TRIPS_PER_DAY * days
        per_reefer = fleet_row["avg_reefer_volume"] * TRIPS_PER_DAY * days
        vehicles_needed = _needed(cell["total_m3"], per_vehicle)
        reefers_needed = _needed(cell["chilled_m3"], per_reefer)
        capacity.append(
            {
                "depot": depot,
                "iso_year": year,
                "iso_week": week,
                "total_m3": round(cell["total_m3"], 3),
                "chilled_m3": round(cell["chilled_m3"], 3),
                "operating_days": days,
                "vehicles_needed": vehicles_needed,
                "vehicles_available": int(fleet_row["vehicles"]),
                "reefers_needed": reefers_needed,
                "reefers_available": int(fleet_row["reefers"]),
                # Booklet: each vehicle has one driver, so drivers track vehicles one for one.
                "drivers_needed": vehicles_needed,
                "drivers_available": int(fleet_row["vehicles"]),
                "shortfall_drivers": max(0, vehicles_needed - int(fleet_row["vehicles"])),
                "shortfall_vehicles": max(0, vehicles_needed - int(fleet_row["vehicles"])),
                "shortfall_reefers": max(0, reefers_needed - int(fleet_row["reefers"])),
            }
        )

    return {
        "method": METHOD,
        "history": history,
        "forecast": forecast,
        "capacity": capacity,
        "backtest": _backtest(series, events),
    }
