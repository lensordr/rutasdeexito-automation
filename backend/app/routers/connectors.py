"""Connector status + configuration endpoints, and a GPS positions endpoint."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..connector_config import SCHEMAS, connector_config
from ..connectors.registry import registry

router = APIRouter(prefix="/api/connectors", tags=["connectors"])


class SaveValues(BaseModel):
    values: dict[str, str]


@router.get("")
def list_connectors() -> list[dict]:
    out = []
    for key in SCHEMAS:
        c = registry.get(key)
        out.append({"key": key, "label": c.label, **c.health_check().to_dict()})
    return out


@router.get("/{key}")
def get_connector(key: str) -> dict:
    if key not in SCHEMAS:
        raise HTTPException(404, "Unknown connector")
    return {
        "schema": connector_config.schema_dict(key),
        "values": connector_config.masked_values(key),
        "status": registry.get(key).health_check().to_dict(),
    }


@router.put("/{key}")
def save_connector(key: str, body: SaveValues) -> dict:
    if key not in SCHEMAS:
        raise HTTPException(404, "Unknown connector")
    connector_config.save_values(key, body.values)
    return {
        "saved": True,
        "values": connector_config.masked_values(key),
        "status": registry.get(key).health_check().to_dict(),
    }


@router.post("/{key}/test")
def test_connector(key: str) -> dict:
    if key not in SCHEMAS:
        raise HTTPException(404, "Unknown connector")
    return registry.get(key).test_connection().to_dict()
