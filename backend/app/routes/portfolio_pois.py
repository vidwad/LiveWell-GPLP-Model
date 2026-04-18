"""
Portfolio POIs — nearby facilities for the LP mini-map.

Returns nearby treatment centers, universities, colleges, hospitals,
pharmacies, libraries, and senior-care facilities for a given lat/lng.
Results are cached per-process for 24 hours to limit Google Places API cost.
"""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import require_investor_or_above
from app.db.models import PlatformSetting, User
from app.db.session import get_db
from app.routes.manual_pois import manual_pois_for_area
from app.services.location_services import get_lp_relevant_pois

router = APIRouter()

_CACHE: dict[str, tuple[float, dict]] = {}
_TTL_SECONDS = 24 * 3600
# Bump when the bucket shape / probe set changes to invalidate stale entries
_CACHE_VERSION = 2


def _cache_key(lat: float, lng: float, radius: int) -> str:
    # Snap to 3 decimals (~110 m) so nearby requests share cache entries
    return f"v{_CACHE_VERSION}:{round(lat, 3)}:{round(lng, 3)}:{radius}"


@router.get("/portfolio/lp-pois")
def get_lp_pois(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: int = Query(2000, ge=200, le=10000),
    lp_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Return nearby facilities relevant to the LP verticals.

    Merges Google Places results (cached per coords/radius) with
    manually-curated POIs from the database (filtered by LP scope).
    """
    key = _cache_key(lat, lng, radius)
    now = time.time()

    # Google Places portion — cached
    hit = _CACHE.get(key)
    if hit and now - hit[0] < _TTL_SECONDS:
        google_pois = hit[1]
    else:
        gm = db.query(PlatformSetting).filter(PlatformSetting.key == "GOOGLE_MAPS_API_KEY").first()
        api_key = gm.value if gm and gm.value else None
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="GOOGLE_MAPS_API_KEY not configured. Set it in Platform Settings.",
            )
        google_pois = get_lp_relevant_pois(lat=lat, lng=lng, api_key=api_key, radius_m=radius)
        # Only cache when Places returned data — avoids pinning empty results
        # caused by REQUEST_DENIED / OVER_QUERY_LIMIT for 24h
        if any(google_pois.get(b) for b in google_pois):
            _CACHE[key] = (now, google_pois)

    # Manual POIs — never cached (cheap DB query; changes need to appear immediately)
    manual = manual_pois_for_area(db, lat=lat, lng=lng, radius_m=radius, lp_id=lp_id)

    # Merge: manual POIs prepend their category list so they render on top
    merged: dict[str, list] = {}
    for cat in set(list(google_pois.keys()) + list(manual.keys())):
        merged[cat] = (manual.get(cat) or []) + (google_pois.get(cat) or [])

    return {"cached": bool(hit), "pois": merged}
