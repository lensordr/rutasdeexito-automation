"""Orders: CRUD, email intake, assignment suggestions, confirm, lifecycle."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..assignment_engine import suggest_assignments
from ..config import settings
from ..connectors.registry import registry
from ..db import get_db
from ..models import (
    Assignment,
    AssignmentStatus,
    Client,
    Driver,
    Order,
    OrderStatus,
    Trailer,
    Truck,
    TruckStatus,
    DriverStatus,
)
from ..schemas import (
    AssignmentRead,
    ConfirmAssignment,
    OrderCreate,
    OrderRead,
    OrderUpdate,
    SuggestionItem,
)

router = APIRouter(prefix="/api", tags=["orders"])
CID = settings.default_company_id


# -------------------------------- CRUD ------------------------------------- #
@router.get("/orders", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db)):
    return (
        db.query(Order)
        .filter(Order.company_id == CID)
        .order_by(Order.created_at.desc())
        .all()
    )


@router.post("/orders", response_model=OrderRead)
def create_order(body: OrderCreate, db: Session = Depends(get_db)):
    obj = Order(company_id=CID, **body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/orders/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db)):
    obj = db.get(Order, order_id)
    if not obj:
        raise HTTPException(404, "Order not found")
    return obj


@router.patch("/orders/{order_id}", response_model=OrderRead)
def update_order(order_id: int, body: OrderUpdate, db: Session = Depends(get_db)):
    obj = db.get(Order, order_id)
    if not obj:
        raise HTTPException(404, "Order not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


# ---------------------------- Email intake --------------------------------- #
@router.post("/orders/intake-email", response_model=list[OrderRead])
def intake_email(db: Session = Depends(get_db)):
    """Pull parsed orders from the email connector and create NEW orders.

    Human-in-the-loop: these land as status=NEW for the dispatcher to review,
    get suggestions, and confirm - nothing is auto-assigned.
    """
    parsed = registry.email().fetch_new_orders(limit=20)
    created: list[Order] = []
    for p in parsed:
        # Match or create the client by email.
        client = None
        if p.client_email:
            client = (
                db.query(Client)
                .filter(Client.company_id == CID, Client.email == p.client_email)
                .first()
            )
            if not client:
                client = Client(company_id=CID, name=p.client_name or p.client_email,
                                email=p.client_email)
                db.add(client)
                db.flush()
        order = Order(
            company_id=CID,
            client_id=client.id if client else None,
            product=p.product,
            tonnage=p.tonnage,
            volume_m3=p.volume_m3,
            pickup_location=p.pickup_location,
            dropoff_location=p.dropoff_location,
            details=p.details,
            source="email",
            source_ref=p.source_ref,
            status=OrderStatus.NEW,
        )
        db.add(order)
        created.append(order)
    db.commit()
    for o in created:
        db.refresh(o)
    return created


# -------------------------- Suggestions / confirm -------------------------- #
@router.get("/orders/{order_id}/suggestions", response_model=list[SuggestionItem])
def get_suggestions(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    cands = suggest_assignments(db, order, CID, top_n=5)

    # Mark the order as having suggestions (non-destructive).
    if order.status == OrderStatus.NEW:
        order.status = OrderStatus.SUGGESTED
        db.commit()

    return [
        SuggestionItem(
            truck_id=c.truck.id,
            truck_plate=c.truck.plate,
            trailer_id=c.trailer.id if c.trailer else None,
            trailer_identifier=c.trailer.identifier if c.trailer else None,
            driver_id=c.driver.id if c.driver else None,
            driver_name=c.driver.name if c.driver else None,
            score=c.score,
            distance_km=c.distance_km,
            reason=c.reason,
        )
        for c in cands
    ]


@router.post("/orders/{order_id}/confirm", response_model=AssignmentRead)
def confirm_assignment(
    order_id: int, body: ConfirmAssignment, db: Session = Depends(get_db)
):
    """Dispatcher confirms a chosen combo. Creates the assignment, flips
    statuses, and (later) pushes to the external TMS."""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    truck = db.get(Truck, body.truck_id)
    if not truck:
        raise HTTPException(400, "Truck not found")

    assignment = Assignment(
        company_id=CID,
        order_id=order.id,
        truck_id=body.truck_id,
        trailer_id=body.trailer_id,
        driver_id=body.driver_id,
        status=AssignmentStatus.CONFIRMED,
    )
    db.add(assignment)

    order.status = OrderStatus.ASSIGNED
    truck.status = TruckStatus.ON_TRIP
    if body.driver_id:
        driver = db.get(Driver, body.driver_id)
        if driver:
            driver.status = DriverStatus.DRIVING

    db.commit()
    db.refresh(assignment)

    # Push to TMS (stub for now).
    try:
        registry.tms().push_assignment(
            {"order_id": order.id, "truck_id": truck.id,
             "trailer_id": body.trailer_id, "driver_id": body.driver_id}
        )
    except Exception:
        pass

    return assignment


@router.post("/orders/{order_id}/status/{new_status}", response_model=OrderRead)
def set_status(order_id: int, new_status: OrderStatus, db: Session = Depends(get_db)):
    """Mark an order delivered / cancelled, releasing truck+driver."""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = new_status

    if new_status in (OrderStatus.DELIVERED, OrderStatus.CANCELLED):
        for a in order.assignments:
            a.status = (
                AssignmentStatus.DELIVERED
                if new_status == OrderStatus.DELIVERED
                else AssignmentStatus.CANCELLED
            )
            truck = db.get(Truck, a.truck_id)
            if truck:
                truck.status = TruckStatus.AVAILABLE
            if a.driver_id:
                driver = db.get(Driver, a.driver_id)
                if driver:
                    driver.status = DriverStatus.AVAILABLE
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders/{order_id}/assignments", response_model=list[AssignmentRead])
def list_order_assignments(order_id: int, db: Session = Depends(get_db)):
    return db.query(Assignment).filter(Assignment.order_id == order_id).all()
