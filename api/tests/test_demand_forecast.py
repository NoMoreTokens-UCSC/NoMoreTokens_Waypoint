"""Demand forecast service — checks the rules on small fixtures, and the real data."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SERVICE = Path(__file__).resolve().parents[1] / "app" / "services" / "demand_forecast.py"
REAL_DATA = Path("/data")


def _load():
    spec = importlib.util.spec_from_file_location("demand_forecast", SERVICE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _write(path: Path, header: str, rows: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join([header, *rows]) + "\n", encoding="utf-8")


@pytest.fixture
def small_data(tmp_path: Path) -> Path:
    general = tmp_path / "General Data"
    # Two weeks of 2024: week 1 is a payday week, week 2 is normal.
    _write(
        general / "calendar.csv",
        "date,dow,dow_name,is_weekend,iso_year,iso_week,is_payday,festival,festival_ramp,is_holiday,monsoon,is_operating",
        [
            "2024-01-01,0,Mon,0,2024,1,1,,0.0,0,0,1",
            "2024-01-08,0,Mon,0,2024,2,0,,0.0,0,0,1",
            "2024-01-09,1,Tue,0,2024,2,0,,0.0,0,0,1",
            "2024-01-15,0,Mon,0,2024,3,0,,0.0,0,0,1",
        ],
    )
    _write(
        general / "outlets.csv",
        "outlet_id,brand,district,depot,dock_type,parking_constraint,mall_window,window_open_time,window_close_time",
        ["OUT001,Fresh,Colombo,Peliyagoda,street,,,05:00,07:30"],
    )
    _write(
        general / "vehicles.csv",
        "vehicle_id,type,temp,weight_cap_kg,volume_cap_m3,fuel_type,km_per_l,weekly_fuel_quota_l,depot",
        [
            "VEH001,van,ambient,1000,10.0,diesel,7,100,Peliyagoda",
            "VEH002,truck,reefer,1000,20.0,diesel,7,100,Peliyagoda",
        ],
    )
    training = tmp_path / "Training Data"
    header = (
        "delivery_id,order_date,dispatch_date,dispatch_status,outlet_id,brand,district,depot,"
        "temp_requirement,order_units,order_weight_kg,order_volume_m3,route_id,seq_in_route,"
        "vehicle_id,vehicle_type,vehicle_temp,planned_arrival_time,window_open_time,window_close_time"
    )

    def order(i: int, date: str, brand: str, temp: str, volume: float, status: str = "deferred") -> str:
        return (
            f"ORD{i},{date},{date},{status},OUT001,{brand},Colombo,Peliyagoda,{temp},1,1,{volume},,,,,,,,"
        )

    _write(
        training / "deliveries_train.csv",
        header,
        [
            order(1, "2024-01-01", "Fresh", "chilled", 4.0),
            order(2, "2024-01-02", "Fresh", "ambient", 2.0, status="not_run"),
            order(3, "2024-01-08", "Fresh", "chilled", 6.0),
            order(4, "2024-01-09", "Style", "ambient", 3.0),
        ],
    )
    test = tmp_path / "Test Data"
    _write(
        test / "task2a_test_inputs.csv",
        "row_id,depot,brand,iso_year,iso_week",
        ["W1,Peliyagoda,Fresh,2024,3", "W2,Peliyagoda,Style,2024,3"],
    )
    return tmp_path


def test_history_counts_deferred_and_not_run_orders(small_data):
    result = _load().compute(str(small_data))
    week1 = next(
        h for h in result["history"] if h["brand"] == "Fresh" and (h["iso_year"], h["iso_week"]) == (2024, 1)
    )
    assert week1["total_m3"] == pytest.approx(6.0)  # 4.0 deferred + 2.0 not run
    assert week1["chilled_m3"] == pytest.approx(4.0)


def test_chilled_volume_is_fresh_only(small_data):
    result = _load().compute(str(small_data))
    style = next(f for f in result["forecast"] if f["brand"] == "Style" and f["row_id"] == "W2")
    assert style["chilled_m3"] == 0.0


def test_forecast_is_the_recent_average_adjusted_for_events(small_data):
    result = _load().compute(str(small_data))
    fresh = next(f for f in result["forecast"] if f["row_id"] == "W1")
    # Fresh history: week 1 = 6.0 total / 4.0 chilled, week 2 = 6.0 total / 6.0 chilled.
    # Week 3 is not an event week, so the plain average is applied: 6.0 total, 5.0 chilled.
    assert fresh["total_m3"] == pytest.approx(6.0)
    assert fresh["chilled_m3"] == pytest.approx(5.0)


def test_gap_weeks_are_filled_and_test_weeks_flagged(small_data):
    result = _load().compute(str(small_data))
    weeks = sorted({(f["iso_year"], f["iso_week"]) for f in result["forecast"]})
    assert weeks == [(2024, 3)]
    assert sum(1 for f in result["forecast"] if f["in_test_horizon"]) == 2


def test_capacity_uses_two_trips_per_day(small_data):
    result = _load().compute(str(small_data))
    cap = next(c for c in result["capacity"] if c["depot"] == "Peliyagoda")
    # Fleet: one van at 10 m³ and one reefer at 20 m³; 6 operating days default; 2 trips a day.
    assert cap["vehicles_available"] == 2
    assert cap["reefers_available"] == 1
    assert cap["vehicles_needed"] == 1


def test_backtest_reports_error_on_known_weeks(small_data):
    result = _load().compute(str(small_data))
    assert result["backtest"]["weeks"]
    assert result["backtest"]["wape_percent"] is not None


@pytest.mark.skipif(not (REAL_DATA / "Test Data" / "task2a_test_inputs.csv").exists(), reason="data not mounted")
def test_real_data_covers_every_test_row():
    result = _load().compute(str(REAL_DATA))
    matched = [f for f in result["forecast"] if f["row_id"]]
    assert len(matched) == 60
    assert all(f["total_m3"] >= 0 for f in result["forecast"])
    assert result["backtest"]["wape_percent"] is not None
