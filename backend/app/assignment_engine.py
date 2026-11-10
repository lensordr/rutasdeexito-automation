"""
Assignment engine.

Given an Order, produce a ranked list of candidate (truck, trailer, driver)
combinations. Scoring combines four factors:

    1. Capability      - trailer CAN carry the product type.        (hard gate)
    2. Capacity        - tonnage/volume fit the trailer.            (hard gate)
    3. Trailer type    - trailer type matches order requirement.    (hard gate)
    4. Proximity       - truck distance to pickup point.            (soft score)
    5. Availability    - truck + driver status.                     (soft score)
    6. Qualification   - driver route type + trailer type match.   (score penalty)
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from .connectors.registry import registry
from .models import (
    Client,
    Driver,
    DriverStatus,
    Order,
    Trailer,
    Truck,
    TruckStatus,
)

WEIGHTS = {
    "proximity": 0.6,
    "availability": 0.4,
}

MAX_USEFUL_DISTANCE_KM = 800.0


@dataclass
class Candidate:
    truck: Truck
    trailer: Optional[Trailer]
    driver: Optional[Driver]
    score: float
    distance_km: Optional[float]
    reason: str


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def _trailer_can_carry(trailer: Trailer, order: Order) -> tuple[bool, str]:
    """Hard gates: product capability + capacity."""
    product = (order.product or "").strip().lower()
    allowed = trailer.allowed_list()
    if allowed and product and product not in allowed:
        return False, f"trailer {trailer.identifier} cannot carry '{product}'"
    if trailer.max_tonnage and order.tonnage and order.tonnage > trailer.max_tonnage:
        return False, f"tonnage {order.tonnage}t exceeds trailer max {trailer.max_tonnage}t"
    if trailer.max_volume_m3 and order.volume_m3 and order.volume_m3 > trailer.max_volume_m3:
        return False, f"volume {order.volume_m3}m³ exceeds trailer max {trailer.max_volume_m3}m³"
    return True, "ok"


def _trailer_matches_type(trailer: Trailer, order: Order) -> tuple[bool, str]:
    """Hard gate: trailer type must match what the order requires."""
    required = (order.trailer_type_required or "").strip().lower()
    if not required:
        return True, "no trailer type required"
    trailer_t = (trailer.trailer_type or "").strip().lower()
    piston_t = (trailer.piston_type or "").strip().lower()
    if required in trailer_t or required in piston_t:
        return True, "trailer type matches"
    return False, f"order requires '{required}' but trailer is '{trailer_t}'"


def _driver_matches_route(driver: Optional[Driver], order: Order) -> bool:
    if driver is None:
        return True
    order_route = (order.route_type or "local").strip().lower()
    if driver.route_type.value == "both":
        return True
    return driver.route_type.value == order_route


def _driver_matches_trailer(driver: Optional[Driver], trailer: Optional[Trailer]) -> bool:
    if driver is None or trailer is None:
        return True
    preferred = driver.trailer_type_list()
    if not preferred:
        return True
    trailer_t = (trailer.trailer_type or "").strip().lower()
    return any(p in trailer_t or trailer_t in p for p in preferred)


def _availability_score(truck: Truck, driver: Optional[Driver]) -> float:
    score = 1.0 if truck.status == TruckStatus.AVAILABLE else 0.0
    if driver is not None:
        score = score * (1.0 if driver.status == DriverStatus.AVAILABLE else 0.3)
    else:
        score *= 0.5
    return score


def _proximity_score(distance_km: Optional[float]) -> float:
    if distance_km is None:
        return 0.3
    if distance_km >= MAX_USEFUL_DISTANCE_KM:
        return 0.0
    return 1.0 - (distance_km / MAX_USEFUL_DISTANCE_KM)


def _truck_position(truck: Truck, positions: dict[str, tuple[float, float]]):
    if truck.gps_device_id and truck.gps_device_id in positions:
        return positions[truck.gps_device_id]
    if truck.home_lat is not None and truck.home_lng is not None:
        return (truck.home_lat, truck.home_lng)
    return None


def suggest_assignments(
    db: Session, order: Order, company_id: int, top_n: int = 5
) -> list[Candidate]:
    trucks = db.query(Truck).filter(Truck.company_id == company_id).all()
    trailers = {
        t.id: t
        for t in db.query(Trailer).filter(Trailer.company_id == company_id).all()
    }
    drivers = db.query(Driver).filter(Driver.company_id == company_id).all()
    driver_by_truck: dict[int, Driver] = {
        d.truck_id: d for d in drivers if d.truck_id is not None
    }

    # Live GPS positions (stub returns random coords — falls back to home base)
    positions: dict[str, tuple[float, float]] = {}
    try:
        for p in registry.gps().get_positions():
            positions[p.gps_device_id] = (p.lat, p.lng)
    except Exception:
        pass

    # Resolve pickup coordinates from client/location registry if available
    pickup_lat: Optional[float] = order.pickup_lat
    pickup_lng: Optional[float] = order.pickup_lng
    if order.pickup_location_id and pickup_lat is None:
        loc = db.get(Client, order.pickup_location_id)
        if loc:
            pickup_lat = loc.lat
            pickup_lng = loc.lng

    candidates: list[Candidate] = []

    for truck in trucks:
        trailer_options: list[Trailer]
        if truck.default_trailer_id and truck.default_trailer_id in trailers:
            trailer_options = [trailers[truck.default_trailer_id]]
        else:
            trailer_options = [t for t in trailers.values() if t.active]

        best_for_truck: Optional[Candidate] = None

        for trailer in trailer_options:
            # Hard gate 1: product capability + capacity
            ok, why = _trailer_can_carry(trailer, order)
            if not ok:
                continue

            # Hard gate 2: trailer type required by order
            ok_type, why_type = _trailer_matches_type(trailer, order)
            if not ok_type:
                continue

            # Distance from truck to pickup
            distance_km = None
            pos = _truck_position(truck, positions)
            if pos and pickup_lat is not None and pickup_lng is not None:
                distance_km = round(haversine_km(pos[0], pos[1], pickup_lat, pickup_lng), 1)

            driver = driver_by_truck.get(truck.id)

            # Soft qualification penalties
            route_match = _driver_matches_route(driver, order)
            trailer_match = _driver_matches_trailer(driver, trailer)
            qualification_factor = 1.0
            if not route_match:
                qualification_factor *= 0.5
            if not trailer_match:
                qualification_factor *= 0.7

            prox = _proximity_score(distance_km)
            avail = _availability_score(truck, driver)
            score = round(
                (WEIGHTS["proximity"] * prox + WEIGHTS["availability"] * avail) * qualification_factor,
                4,
            )

            notes = []
            if not route_match and driver:
                notes.append(f"⚠ conductor ruta {driver.route_type.value} vs pedido {order.route_type}")
            if not trailer_match and driver:
                notes.append(f"⚠ conductor no habilitado para {trailer.trailer_type}")

            reason = (
                f"{trailer.trailer_type} {trailer.identifier} · '{order.product}'"
                + (f" · {distance_km} km" if distance_km is not None else " · distancia desconocida")
                + f" · camión {truck.status.value}"
                + (f" · conductor {driver.status.value}" if driver else " · sin conductor")
                + ((" · " + "; ".join(notes)) if notes else "")
            )

            cand = Candidate(
                truck=truck, trailer=trailer, driver=driver,
                score=score, distance_km=distance_km, reason=reason,
            )
            if best_for_truck is None or cand.score > best_for_truck.score:
                best_for_truck = cand

        if best_for_truck:
            candidates.append(best_for_truck)

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates[:top_n]
