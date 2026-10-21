"""
ORM models for Rutas de Éxito — Dispatch.

Multi-tenant: every business entity carries a ``company_id`` so the same
database can serve multiple onboarded companies later. Today a single
seeded company is used.

Core domain:
    Company   - a tenant (transport business)
    Client    - who sends transport orders
    Truck      - a tractor unit (has GPS, a home base, a status)
    Trailer    - what actually carries product; defines capability+capacity
    Driver     - assigned to a truck for an order
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
    Integer,
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
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"


class DriverStatus(str, enum.Enum):
    AVAILABLE = "available"
    DRIVING = "driving"
    OFF_DUTY = "off_duty"


class OrderStatus(str, enum.Enum):
    NEW = "new"              # parsed from email / created, not yet assigned
    SUGGESTED = "suggested"  # engine produced suggestions, awaiting confirm
    ASSIGNED = "assigned"    # confirmed by dispatcher
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class AssignmentStatus(str, enum.Enum):
    PROPOSED = "proposed"
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
# Master data
# --------------------------------------------------------------------------- #
class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)

    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Trailer(Base):
    """What a truck pulls. Defines what product types it can carry and capacity."""

    __tablename__ = "trailers"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)

    identifier: Mapped[str] = mapped_column(String(50), index=True)  # plate / ID number
    trailer_type: Mapped[str] = mapped_column(String(80))  # e.g. tipper, tanker, curtain

    # Comma-separated product types this trailer CAN carry (e.g. "grain,sand,gravel").
    # Kept as text for the skeleton; normalize to a join table later.
    allowed_products: Mapped[str] = mapped_column(Text, default="")

    max_tonnage: Mapped[float] = mapped_column(Float, default=0.0)   # tonnes
    max_volume_m3: Mapped[float] = mapped_column(Float, default=0.0)  # cubic metres

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

    # A truck may have a default/attached trailer, but assignment can override.
    default_trailer_id: Mapped[int | None] = mapped_column(
        ForeignKey("trailers.id"), nullable=True
    )

    # Home base coordinates (fallback when no GPS ping yet).
    home_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    # GPS provider's device/asset id for this truck.
    gps_device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    default_trailer: Mapped["Trailer | None"] = relationship()


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)

    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[DriverStatus] = mapped_column(
        Enum(DriverStatus), default=DriverStatus.AVAILABLE
    )
    # Optional preferred/assigned truck.
    truck_id: Mapped[int | None] = mapped_column(ForeignKey("trucks.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# --------------------------------------------------------------------------- #
# Orders & assignments
# --------------------------------------------------------------------------- #
class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)

    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.NEW, index=True
    )

    # Product details.
    product: Mapped[str] = mapped_column(String(120))
    tonnage: Mapped[float] = mapped_column(Float, default=0.0)
    volume_m3: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Pickup / dropoff.
    pickup_location: Mapped[str] = mapped_column(String(300), default="")
    pickup_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    pickup_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    dropoff_location: Mapped[str] = mapped_column(String(300), default="")
    pickup_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Provenance - where this order came from (email message id, manual, etc.).
    source: Mapped[str] = mapped_column(String(50), default="manual")
    source_ref: Mapped[str | None] = mapped_column(String(300), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    client: Mapped["Client | None"] = relationship()
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

    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(AssignmentStatus), default=AssignmentStatus.PROPOSED
    )

    # Engine scoring snapshot (why this combo was suggested).
    score: Mapped[float] = mapped_column(Float, default=0.0)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

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
