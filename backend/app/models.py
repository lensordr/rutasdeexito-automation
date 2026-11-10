"""
ORM models for Rutas de Éxito — Dispatch.

Multi-tenant: every business entity carries a ``company_id`` so the same
database can serve multiple onboarded companies later. Today a single
seeded company is used.

Core domain:
    Company    - a tenant (transport business)
    Client     - who sends transport orders; doubles as pickup/dropoff location registry
    Truck      - a tractor unit (has GPS, a home base, a status)
    Trailer    - what actually carries product; defines capability+capacity
    Driver     - assigned to a truck for an order (in-house or contractor)
    Order      - a transport request (product, tonnage, volume, pickup/dropoff)
    Assignment - links an Order to a Truck+Trailer+Driver, with a lifecycle
    GpsPing    - latest/also historical positions for a truck
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #
class TruckStatus(str, enum.Enum):
    AVAILABLE   = "available"
    ON_TRIP     = "on_trip"
    MAINTENANCE = "maintenance"
    OFFLINE     = "offline"


class DriverStatus(str, enum.Enum):
    AVAILABLE = "available"
    DRIVING   = "driving"
    OFF_DUTY  = "off_duty"


class DriverType(str, enum.Enum):
    IN_HOUSE   = "in_house"
    CONTRACTOR = "contractor"


class RouteType(str, enum.Enum):
    LOCAL         = "local"
    INTERNATIONAL = "international"
    BOTH          = "both"


class OrderStatus(str, enum.Enum):
    NEW       = "new"        # created, not yet assigned
    SUGGESTED = "suggested"  # engine produced suggestions
    ASSIGNED  = "assigned"   # confirmed by dispatcher
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class AssignmentStatus(str, enum.Enum):
    PROPOSED  = "proposed"
    CONFIRMED = "confirmed"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


# --------------------------------------------------------------------------- #
# Tenant
# --------------------------------------------------------------------------- #
class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# --------------------------------------------------------------------------- #
# Master data — Client / Location merged
# --------------------------------------------------------------------------- #
# A Client is also a Location (pickup/dropoff facility). All location fields
# live on the same row so there is a single master-data list for clients,
# origins and destinations.
class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)

    # Identification
    name: Mapped[str] = mapped_column(String(200))
    nif_cif: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Location / facility
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), index=True, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="ES")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Trailer(Base):
    """What a truck pulls. Defines what product types it can carry and capacity."""

    __tablename__ = "trailers"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)

    identifier: Mapped[str] = mapped_column(String(50), index=True)
    trailer_type: Mapped[str] = mapped_column(String(80))

    allowed_products: Mapped[str] = mapped_column(Text, default="")

    max_tonnage: Mapped[float] = mapped_column(Float, default=0.0)
    max_volume_m3: Mapped[float] = mapped_column(Float, default=0.0)

    piston_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    itv_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    def allowed_list(self) -> list[str]:
        return [p.strip().lower() for p in (self.allowed_products or "").split(",") if p.strip()]


class Truck(Base):
    __tablename__ = "trucks"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)

    plate: Mapped[str] = mapped_column(String(50), index=True)
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)

    status: Mapped[TruckStatus] = mapped_column(Enum(TruckStatus), default=TruckStatus.AVAILABLE)

    default_trailer_id: Mapped[int | None] = mapped_column(ForeignKey("trailers.id"), nullable=True)

    home_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    gps_device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    itv_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    default_trailer: Mapped["Trailer | None"] = relationship()


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)

    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dni_nie: Mapped[str | None] = mapped_column(String(20), nullable=True)

    status: Mapped[DriverStatus] = mapped_column(Enum(DriverStatus), default=DriverStatus.AVAILABLE)

    # In-house employee or external contractor
    driver_type: Mapped[DriverType] = mapped_column(Enum(DriverType), default=DriverType.IN_HOUSE)

    # If contractor: name of the transport company they belong to
    contractor_company: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # What kind of routes this driver covers
    route_type: Mapped[RouteType] = mapped_column(Enum(RouteType), default=RouteType.BOTH)

    # Comma-separated trailer types this driver is qualified for
    # e.g. "curtainsider,flatbed,aluminium,low-loader"
    preferred_trailer_types: Mapped[str] = mapped_column(Text, default="")

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional preferred/assigned truck
    truck_id: Mapped[int | None] = mapped_column(ForeignKey("trucks.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    def trailer_type_list(self) -> list[str]:
        return [t.strip().lower() for t in (self.preferred_trailer_types or "").split(",") if t.strip()]


# --------------------------------------------------------------------------- #
# Orders & assignments
# --------------------------------------------------------------------------- #
class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)

    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.NEW, index=True)

    product: Mapped[str] = mapped_column(String(120))
    tonnage: Mapped[float] = mapped_column(Float, default=0.0)
    volume_m3: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Legacy free-text fields (kept for backwards compat + email intake)
    pickup_location: Mapped[str] = mapped_column(String(300), default="")
    pickup_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    pickup_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    dropoff_location: Mapped[str] = mapped_column(String(300), default="")

    # Structured client/location registry references (clients table doubles as location registry)
    pickup_location_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    dropoff_location_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)

    pickup_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    dropoff_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Transport requirements
    trailer_type_required: Mapped[str | None] = mapped_column(String(80), nullable=True)
    route_type: Mapped[str | None] = mapped_column(String(20), nullable=True, default="local")
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    unloading_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    source: Mapped[str] = mapped_column(String(50), default="manual")
    source_ref: Mapped[str | None] = mapped_column(String(300), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    client: Mapped["Client | None"] = relationship(foreign_keys=[client_id])
    pickup_loc: Mapped["Client | None"] = relationship("Client", foreign_keys=[pickup_location_id])
    dropoff_loc: Mapped["Client | None"] = relationship("Client", foreign_keys=[dropoff_location_id])
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)

    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"))
    trailer_id: Mapped[int | None] = mapped_column(ForeignKey("trailers.id"), nullable=True)
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("drivers.id"), nullable=True)

    status: Mapped[AssignmentStatus] = mapped_column(Enum(AssignmentStatus), default=AssignmentStatus.PROPOSED)

    score: Mapped[float] = mapped_column(Float, default=0.0)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing
    price_per_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    dispatcher_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    order: Mapped["Order"] = relationship(back_populates="assignments")
    truck: Mapped["Truck"] = relationship()
    trailer: Mapped["Trailer | None"] = relationship()
    driver: Mapped["Driver | None"] = relationship()


class GpsPing(Base):
    __tablename__ = "gps_pings"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), index=True)

    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)
