"""
Database setup (SQLAlchemy + SQLite).

SQLite is used for the local single-machine build. The models and session
API are written so the same code moves to PostgreSQL later (for the
multi-company hosted version) by only changing the connection URL.
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

DB_PATH = settings.data_dir / "dispatch.db"
DATABASE_URL = settings.database_url or f"sqlite:///{DB_PATH}"

# check_same_thread=False: FastAPI serves requests on multiple threads.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables if they do not exist."""
    from . import models  # noqa: F401  (register models on Base)

    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
