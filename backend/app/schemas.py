"""Pydantic schemas for the API (request bodies and responses)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from .models import (
    AssignmentStatus,
    DriverStatus,
    OrderStatus,
    TruckStatus,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------- Client ----------------------------------- #
class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class ClientRead(ORMModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    notes: Optional[str]


# ------------------------------ Trailer ------------------------------------ #
class TrailerCreate(BaseModel):
    identifier: str
    trailer_type: str
    allowed_products: str = ""      # comma-separated
    max_tonnage: float = 0.0
    max_volume_m3: float = 0.0
    active: bool = True


class TrailerRead(ORMModel):
    id: int
    identifier: str
    trailer_type: str
    allowed_products: str
    max_tonnage: float
    max_volume_m3: float
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


class TruckRead(ORMModel):
    id: int
    plate: str
    label: Optional[str]
    status: TruckStatus
    default_trailer_id: Optional[int]
    home_lat: Optional[float]
    home_lng: Optional[float]
    gps_device_id: Optional[str]


# ------------------------------- Driver ------------------------------------ #
class DriverCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    status: DriverStatus = DriverStatus.AVAILABLE
    truck_id: Optional[int] = None


class DriverRead(ORMModel):
    id: int
    name: str
    phone: Optional[str]
    status: DriverStatus
    truck_id: Optional[int]


# ------------------------------- Order ------------------------------------- #
class OrderCreate(BaseModel):
    client_id: Optional[int] = None
    product: str
    tonnage: float = 0.0
    volume_m3: Optional[float] = None
    pickup_location: str = ""
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_location: str = ""
    pickup_date: Optional[datetime] = None
    details: Optional[str] = None
    source: str = "manual"
    source_ref: Optional[str] = None


class OrderUpdate(BaseModel):
    client_id: Optional[int] = None
    product: Optional[str] = None
    tonnage: Optional[float] = None
    volume_m3: Optional[float] = None
    pickup_location: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_location: Optional[str] = None
    pickup_date: Optional[datetime] = None
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
    pickup_lat: Optional[float]
    pickup_lng: Optional[float]
    dropoff_location: str
    pickup_date: Optional[datetime]
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
