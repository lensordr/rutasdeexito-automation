"""GPS positions endpoint (reads from the GPS connector)."""
from __future__ import annotations

from fastapi import APIRouter

from ..connectors.registry import registry

router = APIRouter(prefix="/api/gps", tags=["gps"])


@router.get("/positions")
def positions() -> list[dict]:
    return [
        {
            "gps_device_id": p.gps_device_id,
            "lat": p.lat,
            "lng": p.lng,
            "speed_kmh": p.speed_kmh,
        }
        for p in registry.gps().get_positions()
    ]
