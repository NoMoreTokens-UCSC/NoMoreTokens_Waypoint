from __future__ import annotations

import datetime as dt
import os

from app.core.config import get_settings

# ---------------------------------------------------------------------------
# Business clock — single source of truth for "now" in the demo.
# Override by setting BUSINESS_DATE env var or calling the /admin/clock endpoint.
# ---------------------------------------------------------------------------


def _parse_date(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def now() -> dt.datetime:
    """Return the current business datetime (Asia/Colombo, UTC-aware)."""
    settings = get_settings()
    tz = dt.timezone(dt.timedelta(hours=5, minutes=30))  # Asia/Colombo = UTC+5:30
    if settings.business_date:
        base = _parse_date(settings.business_date)
    else:
        delivery = _parse_date(settings.demo_delivery_date)
        base = delivery - dt.timedelta(days=1)
    # Use actual wall-clock time-of-day but override the date
    wall = dt.datetime.now(tz)
    return dt.datetime(base.year, base.month, base.day, wall.hour, wall.minute, wall.second, tzinfo=tz)


def today() -> dt.date:
    return now().date()


def delivery_date() -> dt.date:
    return _parse_date(get_settings().demo_delivery_date)


def cutoff_datetime() -> dt.datetime:
    """4 PM business today (Asia/Colombo)."""
    tz = dt.timezone(dt.timedelta(hours=5, minutes=30))
    t = today()
    return dt.datetime(t.year, t.month, t.day, 16, 0, 0, tzinfo=tz)


def is_past_cutoff() -> bool:
    return now() >= cutoff_datetime()


def advance_business_date(new_date: str) -> None:
    """Advance the business date (admin only). Writes to env so it persists for the process."""
    os.environ["BUSINESS_DATE"] = new_date
    # Clear the settings cache so the new value is picked up
    get_settings.cache_clear()
