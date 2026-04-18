"""
Manual POIs — admin-curated facilities that augment Google Places on the
LP mini-map (e.g., treatment centers that don't publish addresses publicly).
"""
from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import require_gp_admin, require_investor_or_above  # noqa
from app.db.models import ManualPoi, PlatformSetting, User
from app.db.session import get_db
from app.services.location_services import geocode_address

router = APIRouter()


VALID_CATEGORIES = {
    "treatment_centers",
    "universities",
    "colleges",
    "hospitals",
    "pharmacies",
    "libraries",
    "senior_care",
}


class ManualPoiIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    category: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    lp_id: Optional[int] = None  # null = global, visible on all LP maps


class ManualPoiOut(BaseModel):
    poi_id: int
    lp_id: Optional[int]
    category: str
    name: str
    address: Optional[str]
    latitude: float
    longitude: float
    phone: Optional[str]
    website: Optional[str]
    notes: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


def _get_maps_key(db: Session) -> Optional[str]:
    gm = db.query(PlatformSetting).filter(PlatformSetting.key == "GOOGLE_MAPS_API_KEY").first()
    return gm.value if gm and gm.value else None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@router.get("/portfolio/manual-pois", response_model=list[ManualPoiOut])
def list_manual_pois(
    lp_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    q = db.query(ManualPoi).filter(ManualPoi.is_active.is_(True))
    if lp_id is not None:
        # Return global (lp_id IS NULL) plus LP-specific
        q = q.filter((ManualPoi.lp_id == lp_id) | (ManualPoi.lp_id.is_(None)))
    rows = q.order_by(ManualPoi.category, ManualPoi.name).all()
    return rows


@router.post("/portfolio/manual-pois", response_model=ManualPoiOut)
def create_manual_poi(
    payload: ManualPoiIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {sorted(VALID_CATEGORIES)}")

    lat, lng = payload.latitude, payload.longitude
    if (lat is None or lng is None) and payload.address:
        api_key = _get_maps_key(db)
        if not api_key:
            raise HTTPException(status_code=400, detail="GOOGLE_MAPS_API_KEY not configured — cannot geocode. Provide explicit lat/lng.")
        glat, glng = geocode_address(payload.address, api_key)
        if glat is None:
            raise HTTPException(status_code=422, detail="Could not geocode address. Provide explicit lat/lng.")
        lat, lng = glat, glng

    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Either address or (latitude, longitude) is required.")

    row = ManualPoi(
        lp_id=payload.lp_id,
        category=payload.category,
        name=payload.name,
        address=payload.address,
        latitude=lat,
        longitude=lng,
        phone=payload.phone,
        website=payload.website,
        notes=payload.notes,
        created_by=current_user.user_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/portfolio/manual-pois/{poi_id}", response_model=ManualPoiOut)
def update_manual_poi(
    poi_id: int,
    payload: ManualPoiIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    row = db.query(ManualPoi).filter(ManualPoi.poi_id == poi_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="POI not found")
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {sorted(VALID_CATEGORIES)}")

    row.name = payload.name
    row.category = payload.category
    row.address = payload.address
    row.phone = payload.phone
    row.website = payload.website
    row.notes = payload.notes
    row.lp_id = payload.lp_id

    if payload.latitude is not None and payload.longitude is not None:
        row.latitude = payload.latitude
        row.longitude = payload.longitude
    elif payload.address:
        api_key = _get_maps_key(db)
        if api_key:
            glat, glng = geocode_address(payload.address, api_key)
            if glat is not None:
                row.latitude, row.longitude = glat, glng

    db.commit()
    db.refresh(row)
    return row


@router.delete("/portfolio/manual-pois/{poi_id}")
def delete_manual_poi(
    poi_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    row = db.query(ManualPoi).filter(ManualPoi.poi_id == poi_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="POI not found")
    row.is_active = False
    db.commit()
    return {"deleted": True, "poi_id": poi_id}


def manual_pois_for_area(
    db: Session,
    lat: float,
    lng: float,
    radius_m: int,
    lp_id: Optional[int] = None,
) -> dict[str, list[dict]]:
    """Internal helper: return active manual POIs within radius, bucketed
    by category, in the same shape as Google Places results. Includes a
    `manual: True` flag for the frontend to style distinctly."""
    q = db.query(ManualPoi).filter(ManualPoi.is_active.is_(True))
    if lp_id is not None:
        q = q.filter((ManualPoi.lp_id == lp_id) | (ManualPoi.lp_id.is_(None)))
    rows = q.all()
    radius_km = radius_m / 1000.0
    buckets: dict[str, list[dict]] = {}
    for r in rows:
        rlat, rlng = float(r.latitude), float(r.longitude)
        if _haversine_km(lat, lng, rlat, rlng) > radius_km:
            continue
        buckets.setdefault(r.category, []).append({
            "place_id": f"manual-{r.poi_id}",
            "name": r.name,
            "address": r.address,
            "rating": None,
            "user_ratings_total": None,
            "lat": rlat,
            "lng": rlng,
            "manual": True,
            "phone": r.phone,
            "website": r.website,
            "notes": r.notes,
        })
    return buckets
