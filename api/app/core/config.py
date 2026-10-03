from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg://waypoint:waypoint@localhost:5432/waypoint"

    # JWT
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_expire_minutes: int = 480
    jwt_algorithm: str = "HS256"

    # CORS — comma-separated origins stored as a string, parsed into a list
    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # File uploads
    upload_dir: str = "/uploads"

    # Data directory (CSV source files)
    data_dir: str = "/data/General Data"

    # Seeding
    seed_on_start: bool = False

    # Business clock (demo)
    # "Today" for the demo: if not set, defaults to one day before demo_delivery_date
    business_date: str | None = None
    demo_delivery_date: str = "2024-04-10"

    # App timezone
    app_timezone: str = "Asia/Colombo"


@lru_cache
def get_settings() -> Settings:
    return Settings()


SettingsDep = Annotated[Settings, None]
