"""CRUD routers for master data: clients, trailers, trucks, drivers."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Client, Driver, Trailer, Truck
from ..schemas import (
    ClientCreate,
    ClientRead,
    ClientUpdate,
    DriverCreate,
    DriverRead,
    DriverUpdate,
    TrailerCreate,
    TrailerRead,
    TrailerUpdate,
    TruckCreate,
    TruckRead,
    TruckUpdate,
)

router = APIRouter(prefix="/api", tags=["master-data"])
CID = settings.default_company_id


# ------------------------------- Clients ---------------------------------- #
@router.get("/clients", response_model=list[ClientRead])
def list_clients(db: Session = Depends(get_db)):
    return db.query(Client).filter(Client.company_id == CID).all()


@router.post("/clients", response_model=ClientRead)
def create_client(body: ClientCreate, db: Session = Depends(get_db)):
    obj = Client(company_id=CID, **body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    obj = db.get(Client, client_id)
    if not obj:
        raise HTTPException(404, "Client not found")
    db.delete(obj)
    db.commit()
    return {"deleted": client_id}


@router.patch("/clients/{client_id}", response_model=ClientRead)
def update_client(client_id: int, body: ClientUpdate, db: Session = Depends(get_db)):
    obj = db.get(Client, client_id)
    if not obj:
        raise HTTPException(404, "Client not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


# ------------------------------- Trailers ---------------------------------- #
@router.get("/trailers", response_model=list[TrailerRead])
def list_trailers(db: Session = Depends(get_db)):
    return db.query(Trailer).filter(Trailer.company_id == CID).all()


@router.post("/trailers", response_model=TrailerRead)
def create_trailer(body: TrailerCreate, db: Session = Depends(get_db)):
    obj = Trailer(company_id=CID, **body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/trailers/{trailer_id}")
def delete_trailer(trailer_id: int, db: Session = Depends(get_db)):
    obj = db.get(Trailer, trailer_id)
    if not obj:
        raise HTTPException(404, "Trailer not found")
    db.delete(obj)
    db.commit()
    return {"deleted": trailer_id}


@router.patch("/trailers/{trailer_id}", response_model=TrailerRead)
def update_trailer(trailer_id: int, body: TrailerUpdate, db: Session = Depends(get_db)):
    obj = db.get(Trailer, trailer_id)
    if not obj:
        raise HTTPException(404, "Trailer not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


# -------------------------------- Trucks ----------------------------------- #
@router.get("/trucks", response_model=list[TruckRead])
def list_trucks(db: Session = Depends(get_db)):
    return db.query(Truck).filter(Truck.company_id == CID).all()


@router.post("/trucks", response_model=TruckRead)
def create_truck(body: TruckCreate, db: Session = Depends(get_db)):
    obj = Truck(company_id=CID, **body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/trucks/{truck_id}")
def delete_truck(truck_id: int, db: Session = Depends(get_db)):
    obj = db.get(Truck, truck_id)
    if not obj:
        raise HTTPException(404, "Truck not found")
    db.delete(obj)
    db.commit()
    return {"deleted": truck_id}


@router.patch("/trucks/{truck_id}", response_model=TruckRead)
def update_truck(truck_id: int, body: TruckUpdate, db: Session = Depends(get_db)):
    obj = db.get(Truck, truck_id)
    if not obj:
        raise HTTPException(404, "Truck not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


# -------------------------------- Drivers ---------------------------------- #
@router.get("/drivers", response_model=list[DriverRead])
def list_drivers(db: Session = Depends(get_db)):
    return db.query(Driver).filter(Driver.company_id == CID).all()


@router.post("/drivers", response_model=DriverRead)
def create_driver(body: DriverCreate, db: Session = Depends(get_db)):
    obj = Driver(company_id=CID, **body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/drivers/{driver_id}")
def delete_driver(driver_id: int, db: Session = Depends(get_db)):
    obj = db.get(Driver, driver_id)
    if not obj:
        raise HTTPException(404, "Driver not found")
    db.delete(obj)
    db.commit()
    return {"deleted": driver_id}


@router.patch("/drivers/{driver_id}", response_model=DriverRead)
def update_driver(driver_id: int, body: DriverUpdate, db: Session = Depends(get_db)):
    obj = db.get(Driver, driver_id)
    if not obj:
        raise HTTPException(404, "Driver not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


# -------------------------- Distance utility ------------------------------ #
import math


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance between two lat/lng points in kilometres."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(r * 2 * math.asin(math.sqrt(a)), 1)


@router.get("/clients/distance")
def calc_client_distance(
    from_id: int = Query(..., description="Origin client id"),
    to_id: int = Query(..., description="Destination client id"),
    db: Session = Depends(get_db),
):
    """Return straight-line distance in km between two clients.
    Returns null if either client has no coordinates."""
    origin = db.get(Client, from_id)
    dest = db.get(Client, to_id)
    if not origin or not dest:
        raise HTTPException(404, "One or both clients not found")

    if None in (origin.lat, origin.lng, dest.lat, dest.lng):
        return {"from_id": from_id, "to_id": to_id, "distance_km": None,
                "note": "One or both clients have no coordinates set"}

    km = _haversine_km(origin.lat, origin.lng, dest.lat, dest.lng)
    return {
        "from_id": from_id,
        "from_name": origin.name,
        "to_id": to_id,
        "to_name": dest.name,
        "distance_km": km,
    }
