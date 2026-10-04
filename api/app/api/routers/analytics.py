"""Analytics router — dispatchers see depot demand history and the forecast."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, require_role
from app.core.config import get_settings
from app.services.demand_forecast import compute

router = APIRouter(prefix="/analytics", tags=["analytics"])

_DISPATCHER = require_role("DISPATCHER")


@router.get("/demand-forecast")
def demand_forecast(current_user: CurrentUser, _: None = _DISPATCHER):
    data_root = get_settings().data_dir.rsplit("/General Data", 1)[0]
    try:
        return compute(data_root)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DATA_MISSING", "message": f"Demand data not found: {exc.filename}"},
        ) from exc
