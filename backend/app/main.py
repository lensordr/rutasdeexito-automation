"""
Rutas de Éxito — Dispatch, FastAPI entry point.

Run (from backend/):
    uvicorn app.main:app --reload --port 8010
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import connectors, gps, master_data, orders
from .seed import seed

app = FastAPI(title=settings.app_name, version=settings.version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(master_data.router)
app.include_router(orders.router)
app.include_router(gps.router)
app.include_router(connectors.router)


@app.on_event("startup")
def _startup() -> None:
    # Create tables and seed the default company + sample fleet on first run.
    seed()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "version": settings.version}
