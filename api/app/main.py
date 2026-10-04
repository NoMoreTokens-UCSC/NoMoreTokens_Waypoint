"""Waypoint API — app factory."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.api.routers import auth, orders, plans, deferrals, loading, driver, reference, health, admin, analytics, people

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("waypoint")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Waypoint API",
        description="Delivery planning system for a Sri Lankan retail group.",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Standard error handler ---
    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."}},
        )

    # --- Routers ---
    prefix = "/api/v1"
    app.include_router(health.router)                           # /health (no prefix)
    app.include_router(auth.router, prefix=prefix)              # /api/v1/auth/...
    app.include_router(reference.router, prefix=prefix)         # /api/v1/reference/...
    app.include_router(orders.router, prefix=prefix)            # /api/v1/orders/...
    app.include_router(plans.router, prefix=prefix)             # /api/v1/plans/...
    app.include_router(deferrals.router, prefix=prefix)         # /api/v1/deferrals/...
    app.include_router(loading.router, prefix=prefix)           # /api/v1/loading/...
    app.include_router(driver.router, prefix=prefix)            # /api/v1/driver/...
    app.include_router(admin.router, prefix=prefix)             # /api/v1/admin/...
    app.include_router(people.router, prefix=prefix)            # /api/v1/admin/users, outlets, vehicles, audit
    app.include_router(analytics.router, prefix=prefix)         # /api/v1/analytics/...

    # --- Upload serving (dev only; use nginx in prod) ---
    import os
    os.makedirs(settings.upload_dir, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

    @app.on_event("startup")
    async def on_startup():
        logger.info("Waypoint API starting up…")
        if settings.seed_on_start:
            logger.info("SEED_ON_START=true — running seed…")
            try:
                from seed.run import main as seed_main
                seed_main()
                logger.info("Seed complete.")
            except Exception as e:
                logger.error("Seed failed: %s", e)

    return app


app = create_app()
