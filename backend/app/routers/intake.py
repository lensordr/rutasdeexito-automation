"""
Public client intake endpoint — no authentication required.
Protected by a shared token embedded in the URL.

GET  /api/intake/{token}/meta             → trailer types list
GET  /api/intake/{token}/lookup/{nif_cif} → find client by NIF/CIF
POST /api/intake/{token}                  → create order
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Client, Order, OrderStatus

router = APIRouter(prefix="/api/intake", tags=["intake"])
CID = settings.default_company_id


def _check_token(token: str) -> None:
    if token != settings.public_intake_token:
        raise HTTPException(403, "Invalid intake token")


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(r * 2 * math.asin(math.sqrt(a)), 1)


def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


# ── Meta (trailer types) ─────────────────────────────────────────────────── #
class IntakeMeta(BaseModel):
    trailer_types: list[str]


@router.get("/{token}/meta", response_model=IntakeMeta)
def get_meta(token: str):
    _check_token(token)
    return IntakeMeta(
        trailer_types=["curtainsider", "flatbed", "aluminium", "low-loader", "tanker", "tipper"],
    )


# ── NIF/CIF lookup ───────────────────────────────────────────────────────── #
class ClientLookup(BaseModel):
    found: bool
    client_id: Optional[int] = None
    name: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


@router.get("/{token}/lookup/{nif_cif}", response_model=ClientLookup)
def lookup_client(token: str, nif_cif: str, db: Session = Depends(get_db)):
    _check_token(token)
    client = (
        db.query(Client)
        .filter(Client.company_id == CID, Client.nif_cif == nif_cif.strip().upper())
        .first()
    )
    if not client:
        return ClientLookup(found=False)
    return ClientLookup(
        found=True,
        client_id=client.id,
        name=client.name,
        address=client.address,
        postal_code=client.postal_code,
        city=client.city,
        region=client.region,
        country=client.country,
        phone=client.phone,
        email=client.email,
    )


# ── Submit order ──────────────────────────────────────────────────────────── #
class PublicOrderCreate(BaseModel):
    # Pickup — identified by NIF/CIF
    nif_cif: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    # Cargo
    product: str
    tonnage: float = 0.0

    # Dropoff — free text (postal code + company name)
    dropoff_postal_code: str
    dropoff_company_name: str

    # Logistics
    pickup_date: Optional[str] = None
    route_type: str = "local"
    notes: Optional[str] = None


class PublicOrderResponse(BaseModel):
    order_id: int
    message: str
    pickup_location: str
    dropoff_location: str
    distance_km: Optional[float] = None


@router.post("/{token}", response_model=PublicOrderResponse)
def submit_order(token: str, body: PublicOrderCreate, db: Session = Depends(get_db)):
    _check_token(token)

    # Resolve pickup client by NIF/CIF
    client = (
        db.query(Client)
        .filter(Client.company_id == CID, Client.nif_cif == body.nif_cif.strip().upper())
        .first()
    )
    if not client:
        raise HTTPException(
            400,
            f"No se encontró ningún cliente con NIF/CIF '{body.nif_cif}'. "
            "Contacta con nosotros para registrarte.",
        )

    # Build location strings
    pickup_str = f"{client.name}"
    if client.postal_code:
        pickup_str += f" — CP {client.postal_code}"
    if client.city:
        pickup_str += f", {client.city}"

    dropoff_str = f"{body.dropoff_company_name} — CP {body.dropoff_postal_code}"

    order = Order(
        company_id=CID,
        client_id=client.id,
        product=body.product,
        tonnage=body.tonnage,
        pickup_location=pickup_str,
        dropoff_location=dropoff_str,
        pickup_date=_parse_date(body.pickup_date),
        route_type=body.route_type,
        details=(
            f"Contacto: {body.contact_name or '—'} · {body.contact_phone or '—'}"
            + (f"\nNotas: {body.notes}" if body.notes else "")
        ),
        source="client_form",
        status=OrderStatus.NEW,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return PublicOrderResponse(
        order_id=order.id,
        message="Pedido recibido correctamente. Nos pondremos en contacto con usted.",
        pickup_location=pickup_str,
        dropoff_location=dropoff_str,
    )
