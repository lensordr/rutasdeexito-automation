"""Pydantic schemas for the API (request bodies and responses)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from .models import (
    AssignmentStatus,
    DriverStatus,
    DriverType,
    OrderStatus,
    RouteType,
    TruckStatus,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------ Client (merged with Location) -------------- #
class ClientCreate(BaseModel):
    name: str
    nif_cif: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "ES"
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None
    active: bool = True


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    nif_cif: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class ClientRead(ORMModel):
    id: int
    name: str
    nif_cif: Optional[str]
    contact_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    address: Optional[str]
    postal_code: Optional[str]
    city: Optional[str]
    region: Optional[str]
    country: str
    lat: Optional[float]
    lng: Optional[float]
    notes: Optional[str]
    active: bool
    created_at: datetime


# ------------------------------ Trailer ------------------------------------ #
class TrailerCreate(BaseModel):
    identifier: str
    trailer_type: str
    allowed_products: str = ""      # comma-separated
    max_tonnage: float = 0.0
    max_volume_m3: float = 0.0
    piston_type: Optional[str] = None
    itv_expiry: Optional[datetime] = None
    active: bool = True


class TrailerUpdate(BaseModel):
    identifier: Optional[str] = None
    trailer_type: Optional[str] = None
    allowed_products: Optional[str] = None
    max_tonnage: Optional[float] = None
    max_volume_m3: Optional[float] = None
    piston_type: Optional[str] = None
    itv_expiry: Optional[datetime] = None
    active: Optional[bool] = None


class TrailerRead(ORMModel):
    id: int
    identifier: str
    trailer_type: str
    allowed_products: str
    max_tonnage: float
    max_volume_m3: float
    piston_type: Optional[str]
    itv_expiry: Optional[datetime]
    active: bool


# ------------------------------- Truck ------------------------------------- #
class TruckCreate(BaseModel):
    plate: str
    label: Optional[str] = None
    status: TruckStatus = TruckStatus.AVAILABLE
    default_trailer_id: Optional[int] = None
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    gps_device_id: Optional[str] = None
    itv_expiry: Optional[datetime] = None


class TruckUpdate(BaseModel):
    plate: Optional[str] = None
    label: Optional[str] = None
    status: Optional[TruckStatus] = None
    default_trailer_id: Optional[int] = None
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    gps_device_id: Optional[str] = None
    itv_expiry: Optional[datetime] = None


class TruckRead(ORMModel):
    id: int
    plate: str
    label: Optional[str]
    status: TruckStatus
    default_trailer_id: Optional[int]
    home_lat: Optional[float]
    home_lng: Optional[float]
    gps_device_id: Optional[str]
    itv_expiry: Optional[datetime]


# ------------------------------- Driver ------------------------------------ #
class DriverCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    dni_nie: Optional[str] = None
    status: DriverStatus = DriverStatus.AVAILABLE
    driver_type: DriverType = DriverType.IN_HOUSE
    contractor_company: Optional[str] = None
    route_type: RouteType = RouteType.BOTH
    preferred_trailer_types: str = ""
    notes: Optional[str] = None
    truck_id: Optional[int] = None


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    dni_nie: Optional[str] = None
    status: Optional[DriverStatus] = None
    driver_type: Optional[DriverType] = None
    contractor_company: Optional[str] = None
    route_type: Optional[RouteType] = None
    preferred_trailer_types: Optional[str] = None
    notes: Optional[str] = None
    truck_id: Optional[int] = None


class DriverRead(ORMModel):
    id: int
    name: str
    phone: Optional[str]
    email: Optional[str]
    dni_nie: Optional[str]
    status: DriverStatus
    driver_type: DriverType
    contractor_company: Optional[str]
    route_type: RouteType
    preferred_trailer_types: str
    notes: Optional[str]
    truck_id: Optional[int]


# ------------------------------- Order ------------------------------------- #
class OrderCreate(BaseModel):
    client_id: Optional[int] = None
    product: str
    tonnage: float = 0.0
    volume_m3: Optional[float] = None
    # Free-text fallback (email intake, legacy)
    pickup_location: str = ""
    dropoff_location: str = ""
    # Structured location registry
    pickup_location_id: Optional[int] = None
    dropoff_location_id: Optional[int] = None
    pickup_date: Optional[datetime] = None
    dropoff_date: Optional[datetime] = None
    trailer_type_required: Optional[str] = None
    route_type: Optional[str] = "local"
    distance_km: Optional[float] = None
    unloading_confirmed: bool = False
    details: Optional[str] = None
    source: str = "manual"
    source_ref: Optional[str] = None


class OrderUpdate(BaseModel):
    client_id: Optional[int] = None
    product: Optional[str] = None
    tonnage: Optional[float] = None
    volume_m3: Optional[float] = None
    pickup_location: Optional[str] = None
    dropoff_location: Optional[str] = None
    pickup_location_id: Optional[int] = None
    dropoff_location_id: Optional[int] = None
    pickup_date: Optional[datetime] = None
    dropoff_date: Optional[datetime] = None
    trailer_type_required: Optional[str] = None
    route_type: Optional[str] = None
    distance_km: Optional[float] = None
    unloading_confirmed: Optional[bool] = None
    details: Optional[str] = None
    status: Optional[OrderStatus] = None


class OrderRead(ORMModel):
    id: int
    client_id: Optional[int]
    status: OrderStatus
    product: str
    tonnage: float
    volume_m3: Optional[float]
    pickup_location: str
    dropoff_location: str
    pickup_location_id: Optional[int]
    dropoff_location_id: Optional[int]
    pickup_date: Optional[datetime]
    dropoff_date: Optional[datetime]
    trailer_type_required: Optional[str]
    route_type: Optional[str]
    distance_km: Optional[float]
    unloading_confirmed: bool
    details: Optional[str]
    source: str
    source_ref: Optional[str]
    created_at: datetime


# ----------------------------- Assignment ---------------------------------- #
class AssignmentRead(ORMModel):
    id: int
    order_id: int
    truck_id: int
    trailer_id: Optional[int]
    driver_id: Optional[int]
    status: AssignmentStatus
    score: float
    distance_km: Optional[float]
    reason: Optional[str]
    price_per_km: Optional[float]
    price_total: Optional[float]
    dispatcher_notes: Optional[str]


class SuggestionItem(BaseModel):
    """A ranked candidate produced by the assignment engine (not yet saved)."""

    truck_id: int
    truck_plate: str
    trailer_id: Optional[int]
    trailer_identifier: Optional[str]
    driver_id: Optional[int]
    driver_name: Optional[str]
    score: float
    distance_km: Optional[float]
    reason: str


class ConfirmAssignment(BaseModel):
    truck_id: int
    trailer_id: Optional[int] = None
    driver_id: Optional[int] = None
    price_per_km: Optional[float] = None
    price_total: Optional[float] = None
    dispatcher_notes: Optional[str] = None
