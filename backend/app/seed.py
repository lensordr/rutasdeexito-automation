"""Seed the database with a default company and sample fleet/master data."""
from __future__ import annotations

from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal, init_db
from .models import (
    Client,
    Company,
    Driver,
    DriverStatus,
    Trailer,
    Truck,
    TruckStatus,
)


def seed() -> None:
    init_db()
    db: Session = SessionLocal()
    try:
        cid = settings.default_company_id
        if db.get(Company, cid):
            return  # already seeded

        db.add(Company(id=cid, name="Rutas de Éxito"))

        clients = [
            Client(company_id=cid, name="Agro Supplies SL", email="ops@agro.example"),
            Client(company_id=cid, name="BuildCo", email="logistics@buildco.example"),
        ]
        db.add_all(clients)

        trailers = [
            Trailer(company_id=cid, identifier="TR-100", trailer_type="tipper",
                    allowed_products="grain,sand,gravel,cement",
                    max_tonnage=30, max_volume_m3=40),
            Trailer(company_id=cid, identifier="TR-200", trailer_type="tanker",
                    allowed_products="fuel,water,milk",
                    max_tonnage=32, max_volume_m3=36),
            Trailer(company_id=cid, identifier="TR-300", trailer_type="curtain",
                    allowed_products="pallets,boxes,machinery",
                    max_tonnage=24, max_volume_m3=90),
        ]
        db.add_all(trailers)
        db.flush()  # get trailer ids

        trucks = [
            Truck(company_id=cid, plate="1234-ABC", label="Volvo FH #1",
                  status=TruckStatus.AVAILABLE, default_trailer_id=trailers[0].id,
                  home_lat=40.4168, home_lng=-3.7038, gps_device_id="dev-1"),  # Madrid
            Truck(company_id=cid, plate="5678-DEF", label="Scania R #2",
                  status=TruckStatus.AVAILABLE, default_trailer_id=trailers[1].id,
                  home_lat=41.3874, home_lng=2.1686, gps_device_id="dev-2"),  # Barcelona
            Truck(company_id=cid, plate="9012-GHI", label="MAN TGX #3",
                  status=TruckStatus.MAINTENANCE, default_trailer_id=trailers[2].id,
                  home_lat=37.3891, home_lng=-5.9845, gps_device_id="dev-3"),  # Sevilla
        ]
        db.add_all(trucks)
        db.flush()

        drivers = [
            Driver(company_id=cid, name="Carlos Ruiz", status=DriverStatus.AVAILABLE,
                   truck_id=trucks[0].id),
            Driver(company_id=cid, name="Miguel Torres", status=DriverStatus.AVAILABLE,
                   truck_id=trucks[1].id),
            Driver(company_id=cid, name="Javier Gómez", status=DriverStatus.OFF_DUTY,
                   truck_id=trucks[2].id),
        ]
        db.add_all(drivers)

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Seeded database.")
