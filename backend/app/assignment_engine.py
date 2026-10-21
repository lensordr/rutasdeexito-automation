"""
Assignment engine.

Given an Order, produce a ranked list of candidate (truck, trailer, driver)
combinations. Scoring combines four factors:

    1. Capability  - the trailer CAN carry the order's product type.  (hard gate)
    2. Capacity    - tonnage and volume fit within the trailer.        (hard gate)
    3. Proximity   - truck's last-known GPS position vs pickup point.  (soft score)
    4. Availability- truck + driver statuses.                          (soft score)

Hard gates eliminate impossible combos; soft factors rank the rest.
The final score is 0..1 (higher is better). All of this is deterministic and
easy to tune - the weights live in ``WEIGHTS``.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from .connectors.registry import registry
from .models import (
    Driver,
    DriverStatus,
    Order,
    Trailer,
    Truck,
    TruckStatus,
)

# Tunable weights for the soft factors (must sum to 1.0).
WEIGHTS = {
    "proximity": 0.6,
    "availability": 0.4,
}

# Distance (km) beyond which proximity score is ~0. Tune per operating region.
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
    """Great-circle distance between two lat/lng points in kilometres."""
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
        return False, (
            f"tonnage {order.tonnage}t exceeds trailer max {trailer.max_tonnage}t"
        )
    if (
        trailer.max_volume_m3
        and order.volume_m3
        and order.volume_m3 > trailer.max_volume_m3
    ):
        return False, (
            f"volume {order.volume_m3}m³ exceeds trailer max {trailer.max_volume_m3}m³"
        )
    return True, "ok"


def _availability_score(truck: Truck, driver: Optional[Driver]) -> float:
    score = 1.0 if truck.status == TruckStatus.AVAILABLE else 0.0
    if driver is not None:
        score = score * (1.0 if driver.status == DriverStatus.AVAILABLE else 0.3)
    else:
        score *= 0.5  # no driver chosen yet - penalize mildly
    return score


def _proximity_score(distance_km: Optional[float]) -> float:
    if distance_km is None:
        return 0.3  # unknown position - neutral-ish
    if distance_km >= MAX_USEFUL_DISTANCE_KM:
        return 0.0
    return 1.0 - (distance_km / MAX_USEFUL_DISTANCE_KM)


def _truck_position(truck: Truck, positions: dict[str, tuple[float, float]]):
    """Resolve a truck's current (lat,lng) from GPS, falling back to home base."""
    if truck.gps_device_id and truck.gps_device_id in positions:
        return positions[truck.gps_device_id]
    if truck.home_lat is not None and truck.home_lng is not None:
        return (truck.home_lat, truck.home_lng)
    return None


def suggest_assignments(
    db: Session, order: Order, company_id: int, top_n: int = 5
) -> list[Candidate]:
    """Return the top-N ranked candidate assignments for an order."""
    trucks = db.query(Truck).filter(Truck.company_id == company_id).all()
    trailers = {
        t.id: t
        for t in db.query(Trailer).filter(Trailer.company_id == company_id).all()
    }
    drivers = db.query(Driver).filter(Driver.company_id == company_id).all()
    driver_by_truck: dict[int, Driver] = {
        d.truck_id: d for d in drivers if d.truck_id is not None
    }

    # Pull live GPS positions once (stub for now) keyed by device id.
    positions: dict[str, tuple[float, float]] = {}
    try:
        for p in registry.gps().get_positions():
            positions[p.gps_device_id] = (p.lat, p.lng)
    except Exception:
        pass

    candidates: list[Candidate] = []
    for truck in trucks:
        # Choose the trailer: truck's default if set, else any active trailer
        # that can carry the order (pick the best-fitting).
        trailer_options: list[Trailer]
        if truck.default_trailer_id and truck.default_trailer_id in trailers:
            trailer_options = [trailers[truck.default_trailer_id]]
        else:
            trailer_options = [t for t in trailers.values() if t.active]

        best_for_truck: Optional[Candidate] = None
        for trailer in trailer_options:
            ok, why = _trailer_can_carry(trailer, order)
            if not ok:
                continue

            # Distance from truck position to pickup.
            distance_km = None
            pos = _truck_position(truck, positions)
            if pos and order.pickup_lat is not None and order.pickup_lng is not None:
                distance_km = round(
                    haversine_km(pos[0], pos[1], order.pickup_lat, order.pickup_lng), 1
                )

            driver = driver_by_truck.get(truck.id)
            prox = _proximity_score(distance_km)
            avail = _availability_score(truck, driver)
            score = round(
                WEIGHTS["proximity"] * prox + WEIGHTS["availability"] * avail, 4
            )

            reason = (
                f"{trailer.trailer_type} trailer {trailer.identifier} can carry "
                f"'{order.product}'; "
                + (f"{distance_km} km from pickup; " if distance_km is not None
                   else "distance unknown; ")
                + f"truck {truck.status.value}"
                + (f", driver {driver.status.value}" if driver else ", no driver set")
            )

            cand = Candidate(
                truck=truck,
                trailer=trailer,
                driver=driver,
                score=score,
                distance_km=distance_km,
                reason=reason,
            )
            if best_for_truck is None or cand.score > best_for_truck.score:
                best_for_truck = cand

        if best_for_truck:
            candidates.append(best_for_truck)

    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates[:top_n]
