"""Reset script — wipe all operational data and reseed. Development only."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from app.db.session import SessionLocal
from seed.run import main as seed_main

WIPE_ORDER = [
    "audit_log", "notifications", "issues", "receipts", "delivery_events",
    "load_checks", "deferrals", "stop_orders", "stops", "trips", "plans",
    "order_lines", "orders", "users",
    "vehicle_weekly_fuel", "calendar_days", "vehicles", "outlets", "depots",
]


def reset() -> None:
    print("⚠️  Wiping all data and reseeding…")
    db = SessionLocal()
    try:
        for table in WIPE_ORDER:
            db.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
        db.commit()
        print("✓ Tables wiped")
    finally:
        db.close()

    seed_main()
    print("✓ Reseed complete")


if __name__ == "__main__":
    reset()
