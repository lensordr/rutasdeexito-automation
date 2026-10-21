"""Application configuration loaded from environment / .env."""
from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass


BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = Path(os.getenv("DISPATCH_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)


class Settings:
    app_name: str = "Rutas de Éxito — Dispatch"
    version: str = "0.1.0"

    data_dir: Path = DATA_DIR

    # Override to move to Postgres later, e.g. postgresql+psycopg://user:pw@host/db
    database_url: str = os.getenv("DISPATCH_DATABASE_URL", "")

    cors_origins: list[str] = [
        o.strip()
        for o in os.getenv(
            "DISPATCH_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
    ]

    host: str = os.getenv("DISPATCH_HOST", "127.0.0.1")
    port: int = int(os.getenv("DISPATCH_PORT", "8010"))

    # Single-company default for the local build.
    default_company_id: int = 1


settings = Settings()
