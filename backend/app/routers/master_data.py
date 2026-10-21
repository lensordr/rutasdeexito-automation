"""CRUD routers for master data: clients, trailers, trucks, drivers."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Client, Driver, Trailer, Truck
from ..schemas import (
    ClientCreate,
    ClientRead,
    DriverCreate,
    DriverRead,
    TrailerCreate,
    TrailerRead,
    TruckCreate,
    TruckRead,
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
