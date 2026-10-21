"""
Connector configuration service (Email / GPS / TMS).

Persists user-entered credentials to a gitignored per-machine JSON file
(``backend/data/connector_config.json``) and masks secrets before returning
them to the browser. Same pattern used across Rutas de Éxito apps.
"""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from .config import settings


@dataclass
class ConnectorField:
    key: str
    label: str
    secret: bool = False
    required: bool = True
    placeholder: str = ""
    help: str = ""

    def to_schema(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "secret": self.secret,
            "required": self.required,
            "placeholder": self.placeholder,
            "help": self.help,
        }


@dataclass
class ConnectorSchema:
    key: str
    label: str
    description: str
    fields: list[ConnectorField] = field(default_factory=list)


SCHEMAS: dict[str, ConnectorSchema] = {
    "email": ConnectorSchema(
        key="email",
        label="Email Intake (Outlook / Gmail / IMAP)",
        description="Read client order emails from an inbox.",
        fields=[
            ConnectorField("provider", "Provider", secret=False,
                           placeholder="outlook | gmail | imap"),
            ConnectorField("email_address", "Email address", secret=False,
                           placeholder="dispatch@yourcompany.com"),
            ConnectorField("imap_host", "IMAP host", secret=False, required=False,
                           placeholder="imap.gmail.com (for generic IMAP)"),
            ConnectorField("username", "Username", secret=False, required=False),
            ConnectorField("password", "Password / App password", secret=True,
                           required=False,
                           help="Use an app password for Gmail/Outlook."),
            ConnectorField("oauth_client_id", "OAuth Client ID", secret=False,
                           required=False,
                           help="For Microsoft 365 / Gmail OAuth later."),
            ConnectorField("oauth_client_secret", "OAuth Client Secret",
                           secret=True, required=False),
        ],
    ),
    "gps": ConnectorSchema(
        key="gps",
        label="GPS Tracking (third-party API)",
        description="Live truck positions from your GPS provider.",
        fields=[
            ConnectorField("provider", "Provider name", secret=False,
                           required=False, placeholder="e.g. Webfleet, Wialon"),
            ConnectorField("base_url", "API base URL", secret=False,
                           required=False, placeholder="https://api.provider.com"),
            ConnectorField("api_key", "API Key / Token", secret=True,
                           placeholder="..."),
            ConnectorField("account_id", "Account / Fleet ID", secret=False,
                           required=False),
        ],
    ),
    "tms": ConnectorSchema(
        key="tms",
        label="TMS Platform (your system)",
        description="Push confirmed orders/assignments into your platform.",
        fields=[
            ConnectorField("base_url", "Platform API base URL", secret=False,
                           placeholder="https://your-tms.com/api"),
            ConnectorField("api_key", "API Key / Token", secret=True),
        ],
    ),
}

MASK = "••••••••"


class ConnectorConfigService:
    def __init__(self, path: Optional[Path] = None):
        self._path = path or (settings.data_dir / "connector_config.json")
        self._lock = threading.RLock()
        self._data: dict[str, dict[str, str]] = {}
        self._load()

    def _load(self) -> None:
        if self._path.exists():
            try:
                self._data = json.loads(self._path.read_text(encoding="utf-8"))
            except Exception:
                self._data = {}

    def _save(self) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
        tmp.replace(self._path)

    def raw_values(self, key: str) -> dict[str, str]:
        return dict(self._data.get(key, {}))

    def get_value(self, key: str, field_key: str) -> Optional[str]:
        return self._data.get(key, {}).get(field_key)

    def masked_values(self, key: str) -> dict[str, Any]:
        schema = SCHEMAS.get(key)
        stored = self._data.get(key, {})
        out: dict[str, Any] = {}
        if not schema:
            return out
        for f in schema.fields:
            val = stored.get(f.key, "")
            has = bool(val)
            if f.secret:
                out[f.key] = {"has_value": has, "display": MASK if has else ""}
            else:
                out[f.key] = {"has_value": has, "display": val}
        return out

    def is_configured(self, key: str) -> bool:
        schema = SCHEMAS.get(key)
        if not schema:
            return False
        stored = self._data.get(key, {})
        required = [f for f in schema.fields if f.required]
        if not required:
            return bool(stored)
        return all(stored.get(f.key) for f in required)

    def save_values(self, key: str, values: dict[str, str]) -> None:
        schema = SCHEMAS.get(key)
        if not schema:
            raise KeyError(f"Unknown connector: {key}")
        with self._lock:
            current = self._data.get(key, {})
            for f in schema.fields:
                if f.key not in values:
                    continue
                incoming = (values[f.key] or "").strip()
                if f.secret and incoming == MASK:
                    continue
                if incoming == "":
                    current.pop(f.key, None)
                else:
                    current[f.key] = incoming
            self._data[key] = current
            self._save()

    def schema_dict(self, key: str) -> dict[str, Any]:
        s = SCHEMAS[key]
        return {
            "key": s.key,
            "label": s.label,
            "description": s.description,
            "fields": [f.to_schema() for f in s.fields],
        }


connector_config = ConnectorConfigService()
