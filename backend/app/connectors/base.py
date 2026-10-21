"""
Connector interface contracts for Dispatch.

External systems (Email inbox, GPS provider, TMS platform) are abstract
interfaces. The app depends only on these; stubs implement them now and real
integrations replace them later via the registry.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class ParsedEmailOrder:
    """A transport order parsed out of a client email."""

    client_email: str
    client_name: Optional[str]
    product: str
    tonnage: float
    volume_m3: Optional[float]
    pickup_location: str
    dropoff_location: str
    details: str
    source_ref: str  # e.g. email message id


@dataclass
class TruckPosition:
    gps_device_id: str
    lat: float
    lng: float
    speed_kmh: Optional[float] = None


class ConnectorStatus:
    def __init__(self, connected: bool, detail: str = "", is_stub: bool = True,
                 configured: bool = False):
        self.connected = connected
        self.detail = detail
        self.is_stub = is_stub
        self.configured = configured

    def to_dict(self) -> dict[str, Any]:
        return {
            "connected": self.connected,
            "detail": self.detail,
            "is_stub": self.is_stub,
            "configured": self.configured,
        }


class TestResult:
    def __init__(self, ok: bool, message: str):
        self.ok = ok
        self.message = message

    def to_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "message": self.message}


class BaseConnector(abc.ABC):
    key: str = "base"
    label: str = "Base Connector"

    def __init__(self, config: Optional[dict[str, Any]] = None):
        self.config = config or {}

    @abc.abstractmethod
    def health_check(self) -> ConnectorStatus: ...

    def test_connection(self) -> TestResult:
        status = self.health_check()
        if status.is_stub:
            if status.configured:
                return TestResult(
                    True,
                    "Configured. (Stub - no real call yet; a live check runs "
                    "once this integration is wired.)",
                )
            return TestResult(False, "Not configured. Enter the fields and save.")
        return TestResult(status.connected, status.detail)


class EmailConnector(BaseConnector):
    key = "email"
    label = "Email Intake"

    @abc.abstractmethod
    def fetch_new_orders(self, limit: int = 20) -> list[ParsedEmailOrder]:
        """Read the inbox and return parsed candidate orders."""


class GpsConnector(BaseConnector):
    key = "gps"
    label = "GPS Tracking"

    @abc.abstractmethod
    def get_positions(self, device_ids: list[str] | None = None) -> list[TruckPosition]:
        """Return current positions for the given devices (or all)."""


class TmsConnector(BaseConnector):
    key = "tms"
    label = "TMS Platform"

    @abc.abstractmethod
    def push_assignment(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Push a confirmed order/assignment into the external TMS."""
