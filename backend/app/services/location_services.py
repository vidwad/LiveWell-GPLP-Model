"""Location data services — Walk Score, Google Places, Calgary Assessment."""

from __future__ import annotations
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)


def get_walk_score(address: str, lat: float, lng: float, api_key: str) -> dict:
    """Get Walk Score, Transit Score, and Bike Score for an address."""
    try:
        resp = requests.get(
            "https://api.walkscore.com/score",
            params={
                "format": "json",
                "address": address,
                "lat": lat,
                "lon": lng,
                "transit": 1,
                "bike": 1,
                "wsapikey": api_key,
            },
            timeout=10,
        )
        data = resp.json()
        return {
            "walk_score": data.get("walkscore"),
            "walk_description": data.get("description"),
            "transit_score": data.get("transit", {}).get("score") if data.get("transit") else None,
            "transit_description": data.get("transit", {}).get("description") if data.get("transit") else None,
            "bike_score": data.get("bike", {}).get("score") if data.get("bike") else None,
            "bike_description": data.get("bike", {}).get("description") if data.get("bike") else None,
        }
    except Exception as e:
        logger.warning("Walk Score API failed: %s", e)
        return {}


def get_nearby_places(lat: float, lng: float, api_key: str, radius_m: int = 1000) -> dict:
    """Get nearby amenities using Google Places API."""
    categories = {
        "grocery": "grocery_or_supermarket",
        "schools": "school",
        "transit": "transit_station",
        "hospitals": "hospital",
        "restaurants": "restaurant",
        "parks": "park",
        "pharmacies": "pharmacy",
    }

    results = {}
    for label, place_type in categories.items():
        try:
            resp = requests.get(
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                params={
                    "location": f"{lat},{lng}",
                    "radius": radius_m,
                    "type": place_type,
                    "key": api_key,
                },
                timeout=10,
            )
            data = resp.json()
            places = []
            for p in (data.get("results") or [])[:5]:
                loc = p.get("geometry", {}).get("location", {})
                places.append({
                    "name": p.get("name"),
                    "address": p.get("vicinity"),
                    "rating": p.get("rating"),
                    "lat": loc.get("lat"),
                    "lng": loc.get("lng"),
                })
            results[label] = places
        except Exception as e:
            logger.warning("Google Places failed for %s: %s", label, e)
            results[label] = []

    return results


def get_lp_relevant_pois(lat: float, lng: float, api_key: str, radius_m: int = 2000) -> dict:
    """POIs useful to the LP verticals (recovery/student/senior housing).

    Returns buckets:
      - treatment_centers: rehab / addiction / detox / mental-health clinics (RecoverWell)
      - universities: post-secondary institutions (StudyWell)
      - colleges: community colleges / technical institutes (StudyWell)
      - hospitals: acute care hospitals
      - pharmacies: retail pharmacies
      - libraries: public libraries
      - senior_care: nursing homes / retirement residences / assisted living (RetireWell)

    Each bucket can issue multiple Nearby Search queries (Places API `keyword`
    does NOT support OR-syntax — it matches the literal phrase). Results are
    de-duplicated globally by place_id so a place only appears under one bucket.
    """
    # bucket -> list of (place_type, keyword) probes
    buckets: dict[str, list[tuple[str | None, str | None]]] = {
        "treatment_centers": [
            (None, "addiction treatment center"),
            (None, "drug rehab"),
            (None, "detox"),
            (None, "recovery center"),
            (None, "sober living"),
            (None, "mental health clinic"),
        ],
        "universities": [("university", None)],
        "colleges": [
            (None, "college"),
            (None, "polytechnic"),
            (None, "technical institute"),
        ],
        "hospitals": [("hospital", None)],
        "pharmacies": [("pharmacy", None)],
        "libraries": [("library", None)],
        "senior_care": [
            (None, "nursing home"),
            (None, "retirement residence"),
            (None, "assisted living"),
            (None, "senior living"),
        ],
    }

    results: dict[str, list[dict]] = {}
    seen_place_ids: set[str] = set()

    for label, probes in buckets.items():
        collected: list[dict] = []
        for place_type, keyword in probes:
            try:
                params: dict = {
                    "location": f"{lat},{lng}",
                    "radius": radius_m,
                    "key": api_key,
                }
                if place_type:
                    params["type"] = place_type
                if keyword:
                    params["keyword"] = keyword
                resp = requests.get(
                    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                    params=params,
                    timeout=10,
                )
                data = resp.json()
                status = data.get("status")
                if status not in ("OK", "ZERO_RESULTS"):
                    logger.warning(
                        "Places API %s returned status=%s error=%s",
                        label, status, data.get("error_message"),
                    )
                for p in data.get("results") or []:
                    pid = p.get("place_id")
                    if pid and pid in seen_place_ids:
                        continue
                    if pid:
                        seen_place_ids.add(pid)
                    loc = p.get("geometry", {}).get("location", {})
                    collected.append({
                        "place_id": pid,
                        "name": p.get("name"),
                        "address": p.get("vicinity"),
                        "rating": p.get("rating"),
                        "user_ratings_total": p.get("user_ratings_total"),
                        "lat": loc.get("lat"),
                        "lng": loc.get("lng"),
                    })
            except Exception as e:
                logger.warning("LP POI lookup failed for %s (%s/%s): %s", label, place_type, keyword, e)

        # Cap bucket size after merging all probes; higher user_ratings_total wins
        collected.sort(key=lambda x: (x.get("user_ratings_total") or 0), reverse=True)
        results[label] = collected[:12]

    return results


def get_calgary_assessment(address: str) -> dict:
    """Look up property assessment from City of Calgary Open Data."""
    try:
        # Calgary property assessment dataset
        resp = requests.get(
            "https://data.calgary.ca/resource/6zp6-pxei.json",
            params={
                "$where": f"upper(address) like upper('%{address.split()[0]}%')",
                "$limit": 5,
                "$order": "roll_year DESC",
            },
            timeout=10,
        )
        data = resp.json()
        if data:
            return {
                "assessments": [
                    {
                        "address": r.get("address"),
                        "assessed_value": r.get("assessed_value"),
                        "roll_year": r.get("roll_year"),
                        "assessment_class": r.get("assessment_class"),
                    }
                    for r in data[:3]
                ]
            }
    except Exception as e:
        logger.warning("Calgary assessment lookup failed: %s", e)
    return {}
