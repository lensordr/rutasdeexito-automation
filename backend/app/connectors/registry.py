"""Connector registry: resolves interface -> implementation (stubs today)."""
from __future__ import annotations

from typing import Any

from .base import BaseConnector, EmailConnector, GpsConnector, TmsConnector
from . import stubs

_IMPLEMENTATIONS: dict[str, type[BaseConnector]] = {
    "email": stubs.StubEmail,
    "gps": stubs.StubGps,
    "tms": stubs.StubTms,
}


class ConnectorRegistry:
    def _config(self, key: str) -> dict[str, Any]:
        try:
            from ..connector_config import connector_config

            return connector_config.raw_values(key)
        except Exception:
            return {}

    def get(self, key: str) -> BaseConnector:
        if key not in _IMPLEMENTATIONS:
            raise KeyError(f"Unknown connector: {key}")
        return _IMPLEMENTATIONS[key](self._config(key))

    def email(self) -> EmailConnector:
        return self.get("email")  # type: ignore[return-value]

    def gps(self) -> GpsConnector:
        return self.get("gps")  # type: ignore[return-value]

    def tms(self) -> TmsConnector:
        return self.get("tms")  # type: ignore[return-value]


registry = ConnectorRegistry()
