"""Stub connector implementations (Email / GPS / TMS)."""
from __future__ import annotations

import random
from typing import Any

from ..connector_config import connector_config
from .base import (
    ConnectorStatus,
    EmailConnector,
    GpsConnector,
    ParsedEmailOrder,
    TmsConnector,
    TruckPosition,
)


def _status(key: str, ok_detail: str, no_detail: str) -> ConnectorStatus:
    configured = connector_config.is_configured(key)
    return ConnectorStatus(
        connected=False,
        detail=ok_detail if configured else no_detail,
        is_stub=True,
        configured=configured,
    )


class StubEmail(EmailConnector):
    def health_check(self) -> ConnectorStatus:
        return _status(
            "email",
            "Mailbox configured (stub - not reading real email yet).",
            "Stub - set provider + email address to connect.",
        )

    def fetch_new_orders(self, limit: int = 20) -> list[ParsedEmailOrder]:
        products = [("grain", 24, 32), ("sand", 28, 18), ("gravel", 26, 16),
                    ("fuel", 30, 35), ("cement", 27, 20)]
        cities = [("Madrid", "Barcelona"), ("Sevilla", "Valencia"),
                  ("Bilbao", "Zaragoza"), ("Málaga", "Murcia")]
        out: list[ParsedEmailOrder] = []
        for i in range(min(limit, 3)):
            prod, ton, vol = random.choice(products)
            a, b = random.choice(cities)
            out.append(
                ParsedEmailOrder(
                    client_email=f"client{i}@example.com",
                    client_name=f"Client {i}",
                    product=prod,
                    tonnage=float(ton),
                    volume_m3=float(vol),
                    pickup_location=a,
                    dropoff_location=b,
                    details=f"Auto-parsed (stub) order for {prod}.",
                    source_ref=f"stub-msg-{random.randint(1000, 9999)}",
                )
            )
        return out


class StubGps(GpsConnector):
    def health_check(self) -> ConnectorStatus:
        return _status(
            "gps",
            "GPS API key saved (stub - returning simulated positions).",
            "Stub - add the GPS provider API key.",
        )

    def get_positions(self, device_ids: list[str] | None = None) -> list[TruckPosition]:
        # Simulated positions roughly around Spain.
        base = device_ids or [f"dev-{i}" for i in range(1, 6)]
        out = []
        for d in base:
            out.append(
                TruckPosition(
                    gps_device_id=d,
                    lat=round(random.uniform(36.5, 43.5), 5),
                    lng=round(random.uniform(-8.5, 2.5), 5),
                    speed_kmh=round(random.uniform(0, 90), 1),
                )
            )
        return out


class StubTms(TmsConnector):
    def health_check(self) -> ConnectorStatus:
        return _status(
            "tms",
            "TMS endpoint saved (stub - not pushing to real platform yet).",
            "Stub - add your TMS base URL + API key.",
        )

    def push_assignment(self, payload: dict[str, Any]) -> dict[str, Any]:
        # Pretend we pushed and got back an external reference.
        return {
            "ok": True,
            "external_ref": f"TMS-{random.randint(100000, 999999)}",
            "echo": payload,
            "note": "Stub push - no external call made.",
        }
