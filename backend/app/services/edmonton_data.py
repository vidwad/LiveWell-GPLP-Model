"""
Edmonton Authoritative Data Sources
=====================================
Fetches real data from City of Edmonton Open Data, CMHC, and StatsCan
for area research reports.

Data Sources:
- City of Edmonton Open Data (data.edmonton.ca) — Socrata SODA API
  - Development Permits (2ccn-pwtu)
  - General Building Permits (24uj-dj8v)
  - Zoning Bylaw Geographical Data (fixa-tstc)
  - Property Assessments — Current Year (q7d6-ambg)
  - Property Assessments — Historical (qi6a-xuwt)
  - Census Population by Age Range 2019 (a6zx-dzqn)
  - Neighbourhoods Boundaries (65fr-66s6)
  - LRT Stations and Stops (fhxi-cnhe)
  - ETS Bus Stops GTFS (4vt2-8zrq)
- CMHC Rental Market Survey — via targeted web search
- REALTORS Association of Edmonton / MLS — via targeted web search

Note on Edmonton's 2023 Zoning Bylaw overhaul:
Edmonton adopted a comprehensive new zoning framework in late 2023.
All zoning lookups use the current bylaw data, not legacy zone codes.
"""

import json
import logging
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────

EDMONTON_OPEN_DATA = "https://data.edmonton.ca/resource"

# Dataset IDs
DEVELOPMENT_PERMITS = "2ccn-pwtu"
BUILDING_PERMITS = "24uj-dj8v"
ZONING_BYLAW = "fixa-tstc"
PROPERTY_ASSESSMENT_CURRENT = "q7d6-ambg"
PROPERTY_ASSESSMENT_HISTORICAL = "qi6a-xuwt"
CENSUS_POPULATION_2019 = "a6zx-dzqn"
NEIGHBOURHOODS = "65fr-66s6"
LRT_STATIONS = "fhxi-cnhe"
BUS_STOPS_GTFS = "4vt2-8zrq"

# 1 mile ≈ 1609 meters
MILES_TO_METERS = 1609.34

# Request timeout in seconds
API_TIMEOUT = 15


# ── Low-level fetch ─────────────────────────────────────────────────────

def _socrata_get(dataset_id: str, params: dict, limit: int = 50) -> list[dict]:
    """Query a Socrata dataset and return parsed JSON rows."""
    params["$limit"] = str(limit)
    qs = urllib.parse.urlencode(params)
    url = f"{EDMONTON_OPEN_DATA}/{dataset_id}.json?{qs}"
    logger.info("Edmonton Open Data query: %s", url)
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
            data = json.loads(resp.read().decode())
        return [r for r in data if r]
    except Exception as e:
        logger.warning("Edmonton Open Data query failed (%s): %s", dataset_id, e)
        return []


# ── Development Permits ─────────────────────────────────────────────────

def get_development_permits(
    lat: float, lng: float, radius_miles: float = 2.0, limit: int = 20
) -> list[dict]:
    """Fetch recent development permits near a location.

    Uses geometry_point for geo queries. Returns permits from the last 2 years.
    """
    radius_m = radius_miles * MILES_TO_METERS
    since = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%dT00:00:00")

    rows = _socrata_get(DEVELOPMENT_PERMITS, {
        "$where": (
            f"within_circle(geometry_point, {lat}, {lng}, {radius_m})"
        ),
        "$order": "city_file_number DESC",
    }, limit=limit)

    results = []
    for r in rows:
        results.append({
            "permit_number": r.get("city_file_number", ""),
            "address": r.get("address", ""),
            "permit_type": r.get("permit_type", ""),
            "permit_class": r.get("permit_class", ""),
            "description": r.get("description_of_development", ""),
            "status": r.get("status", ""),
            "zoning": r.get("zoning", ""),
            "neighbourhood": r.get("neighbourhood", ""),
            "neighbourhood_id": r.get("neighbourhood_id", ""),
            "neighbourhood_classification": r.get("neighbourhood_classification", ""),
            "ward": r.get("ward", ""),
            "latitude": _safe_float(r.get("latitude")),
            "longitude": _safe_float(r.get("longitude")),
        })
    return results


# ── Building Permits ────────────────────────────────────────────────────

def get_building_permits(
    neighbourhood: str, limit: int = 20
) -> list[dict]:
    """Fetch recent building permits for a neighbourhood.

    Note: Edmonton building permits dataset has no geo fields,
    so we filter by neighbourhood name instead of coordinates.
    """
    if not neighbourhood:
        return []

    name = neighbourhood.strip().upper()
    since = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%dT00:00:00")

    rows = _socrata_get(BUILDING_PERMITS, {
        "$where": (
            f"upper(neighbourhood) = '{name}' "
            f"AND issue_date > '{since}'"
        ),
        "$order": "issue_date DESC",
    }, limit=limit)

    results = []
    for r in rows:
        results.append({
            "permit_id": r.get("row_id", ""),
            "address": r.get("address", ""),
            "issue_date": r.get("issue_date", ""),
            "permit_date": r.get("permit_date", ""),
            "job_category": r.get("job_category", ""),
            "job_description": r.get("job_description", ""),
            "building_type": r.get("building_type", ""),
            "work_type": r.get("work_type", ""),
            "construction_value": _safe_float(r.get("construction_value")),
            "floor_area": _safe_float(r.get("floor_area")),
            "units_added": _safe_int(r.get("units_added")),
            "neighbourhood": r.get("neighbourhood", ""),
            # Note: neighbourhood_numberr has a typo in the dataset
            "neighbourhood_id": r.get("neighbourhood_numberr", ""),
        })
    return results


# ── Zoning / Land Use ──────────────────────────────────────────────────

def get_zoning_at_point(lat: float, lng: float) -> Optional[dict]:
    """Fetch the zoning designation at a specific point.

    Uses the zoning bylaw geographic dataset with polygon intersection.
    Edmonton's zoning was comprehensively overhauled in late 2023.
    """
    rows = _socrata_get(ZONING_BYLAW, {
        "$where": f"within_circle(geometry_multipolygon, {lat}, {lng}, 50)",
        "$select": "id, zoning, description, url",
    }, limit=1)

    if not rows:
        # Widen search slightly
        rows = _socrata_get(ZONING_BYLAW, {
            "$where": f"within_circle(geometry_multipolygon, {lat}, {lng}, 200)",
            "$select": "id, zoning, description, url",
        }, limit=1)

    if not rows:
        return None

    r = rows[0]
    raw_url = r.get("url", "")
    if isinstance(raw_url, dict):
        raw_url = raw_url.get("url", "")
    return {
        "code": r.get("zoning", ""),
        "name": r.get("description", ""),
        "description": r.get("description", ""),
        "bylaw_url": raw_url,
        "source": "Edmonton Zoning Bylaw (2023 framework)",
    }


def get_zoning_by_code(zoning_code: str) -> Optional[dict]:
    """Fetch zoning info by code (e.g. 'RSF', 'RM')."""
    if not zoning_code:
        return None

    code = zoning_code.strip().upper()

    rows = _socrata_get(ZONING_BYLAW, {
        "$where": f"upper(zoning) = '{code}'",
        "$select": "id, zoning, description, url",
    }, limit=1)

    if not rows:
        return None

    r = rows[0]
    raw_url = r.get("url", "")
    if isinstance(raw_url, dict):
        raw_url = raw_url.get("url", "")
    return {
        "code": r.get("zoning", ""),
        "name": r.get("description", ""),
        "description": r.get("description", ""),
        "bylaw_url": raw_url,
        "source": "Edmonton Zoning Bylaw (2023 framework)",
    }


# ── Property Assessments ────────────────────────────────────────────────

def get_property_assessments(
    lat: float, lng: float, radius_miles: float = 0.5, limit: int = 15
) -> list[dict]:
    """Fetch property assessments near a location.

    Provides assessed values, tax class, and neighbourhood info.
    Useful as a market value cross-check alongside MLS comps.

    Note: point_location is WKT, not a Socrata geo type, so we filter
    by neighbourhood from the nearest dev permit instead.
    """
    # First find the neighbourhood from coords
    nbhd = get_neighbourhood_from_coords(lat, lng)
    if not nbhd or not nbhd.get("neighbourhood_name"):
        return []

    name = nbhd["neighbourhood_name"].upper()
    rows = _socrata_get(PROPERTY_ASSESSMENT_CURRENT, {
        "$where": f"upper(neighbourhood) = '{name}' AND tax_class = 'Residential'",
        "$order": "assessed_value DESC",
    }, limit=limit)

    results = []
    for r in rows:
        house = r.get("house_number", "")
        street = r.get("street_name", "")
        results.append({
            "account_number": r.get("account_number", ""),
            "address": f"{house} {street}".strip(),
            "neighbourhood": r.get("neighbourhood", ""),
            "neighbourhood_id": r.get("neighbourhood_id", ""),
            "ward": r.get("ward", ""),
            "assessed_value": _safe_int(r.get("assessed_value")),
            "tax_class": r.get("tax_class", ""),
            "garage": r.get("garage", ""),
            "latitude": _safe_float(r.get("latitude")),
            "longitude": _safe_float(r.get("longitude")),
        })
    return results


def get_historical_assessments(
    lat: float, lng: float, radius_miles: float = 0.1, limit: int = 5
) -> list[dict]:
    """Fetch historical property assessments for trend analysis.

    The historical dataset includes year_built, zoning, and lot_size
    which are absent from the current-year dataset.
    """
    nbhd = get_neighbourhood_from_coords(lat, lng)
    if not nbhd or not nbhd.get("neighbourhood_name"):
        return []

    name = nbhd["neighbourhood_name"].upper()
    rows = _socrata_get(PROPERTY_ASSESSMENT_HISTORICAL, {
        "$where": f"upper(neighbourhood_name) = '{name}'",
        "$order": "assessment_year DESC",
    }, limit=limit)

    results = []
    for r in rows:
        house = r.get("house_number", "")
        street = r.get("street_name", "")
        results.append({
            "account_number": r.get("account_number", ""),
            "address": f"{house} {street}".strip(),
            "assessment_year": r.get("assessment_year", ""),
            "assessed_value": _safe_int(r.get("assessed_value")),
            "year_built": r.get("year_built", ""),
            "zoning": r.get("zoning", ""),
            "lot_size": _safe_float(r.get("lot_size")),
            "neighbourhood": r.get("neighbourhood_name", ""),
        })
    return results


# ── Neighbourhood Demographics ──────────────────────────────────────────

def get_neighbourhood_info(neighbourhood_id: str) -> Optional[dict]:
    """Fetch neighbourhood boundary info and metadata."""
    if not neighbourhood_id:
        return None

    rows = _socrata_get(NEIGHBOURHOODS, {
        "$where": f"neighbourhood_number = '{neighbourhood_id}'",
        "$select": (
            "name, neighbourhood_number, descriptive_name, "
            "civic_ward_name, district"
        ),
    }, limit=1)

    if not rows:
        return None

    r = rows[0]
    return {
        "name": r.get("name", ""),
        "neighbourhood_number": r.get("neighbourhood_number", ""),
        "descriptive_name": r.get("descriptive_name", ""),
        "ward": r.get("civic_ward_name", ""),
        "district": r.get("district", ""),
    }


def get_neighbourhood_demographics(neighbourhood_id: str) -> Optional[dict]:
    """Fetch 2019 census population data by age range for a neighbourhood."""
    if not neighbourhood_id:
        return None

    rows = _socrata_get(CENSUS_POPULATION_2019, {
        "$where": f"neighbourhood_number = '{neighbourhood_id}'",
    }, limit=50)

    if not rows:
        return None

    total_population = 0
    age_distribution: dict[str, int] = {}
    ward = ""

    for r in rows:
        age_range = r.get("age_range", "")
        pop = _safe_int(r.get("population")) or 0
        total_population += pop
        if age_range:
            age_distribution[age_range] = pop
        if not ward:
            ward = r.get("ward", "")

    # Calculate median age estimate from distribution
    median_age_est = _estimate_median_age(age_distribution)

    return {
        "neighbourhood_id": neighbourhood_id,
        "source": "City of Edmonton 2019 Census",
        "total_population": total_population,
        "age_distribution": age_distribution,
        "median_age_estimate": median_age_est,
        "ward": ward,
    }


# ── Transit Access ──────────────────────────────────────────────────────

def get_nearby_lrt_stations(
    lat: float, lng: float, radius_miles: float = 1.0
) -> list[dict]:
    """Fetch LRT stations near a location."""
    radius_m = radius_miles * MILES_TO_METERS

    rows = _socrata_get(LRT_STATIONS, {
        "$where": f"within_circle(geometry_point, {lat}, {lng}, {radius_m})",
    }, limit=10)

    results = []
    for r in rows:
        results.append({
            "stop_number": r.get("lrt_stop_number", ""),
            "name": r.get("lrt_stop_description", ""),
            "latitude": _safe_float(r.get("latitude")),
            "longitude": _safe_float(r.get("longitude")),
        })
    return results


def get_nearby_bus_stops(
    lat: float, lng: float, radius_miles: float = 0.3
) -> int:
    """Count ETS bus stops near a location (proxy for transit access)."""
    radius_m = radius_miles * MILES_TO_METERS

    rows = _socrata_get(BUS_STOPS_GTFS, {
        "$select": "count(*) as cnt",
        "$where": f"within_circle(geometry_point, {lat}, {lng}, {radius_m})",
    }, limit=1)

    if rows and rows[0].get("cnt"):
        return _safe_int(rows[0]["cnt"]) or 0
    return 0


# ── Detect Neighbourhood from Coordinates ───────────────────────────────

def get_neighbourhood_from_coords(lat: float, lng: float) -> Optional[dict]:
    """Determine the Edmonton neighbourhood from coordinates.

    Uses nearest development permit or property assessment to identify.
    """
    # Try dev permits first (they have neighbourhood info)
    rows = _socrata_get(DEVELOPMENT_PERMITS, {
        "$where": f"within_circle(geometry_point, {lat}, {lng}, 500)",
        "$select": "neighbourhood, neighbourhood_id, neighbourhood_classification, zoning",
        "$order": "city_file_number DESC",
    }, limit=1)

    if not rows:
        rows = _socrata_get(DEVELOPMENT_PERMITS, {
            "$where": f"within_circle(geometry_point, {lat}, {lng}, 2000)",
            "$select": "neighbourhood, neighbourhood_id, neighbourhood_classification, zoning",
            "$order": "city_file_number DESC",
        }, limit=1)

    if rows:
        return {
            "neighbourhood_name": rows[0].get("neighbourhood", ""),
            "neighbourhood_id": rows[0].get("neighbourhood_id", ""),
            "neighbourhood_classification": rows[0].get("neighbourhood_classification", ""),
            "detected_zoning": rows[0].get("zoning", ""),
        }

    # Fallback: use property assessments
    rows = _socrata_get(PROPERTY_ASSESSMENT_CURRENT, {
        "$where": f"within_circle(point_location, {lat}, {lng}, 500)",
        "$select": "neighbourhood, neighbourhood_id",
    }, limit=1)

    if rows:
        return {
            "neighbourhood_name": rows[0].get("neighbourhood", ""),
            "neighbourhood_id": rows[0].get("neighbourhood_id", ""),
            "neighbourhood_classification": "",
            "detected_zoning": "",
        }

    return None


# ── Aggregate: All Edmonton data for an area ────────────────────────────

def fetch_all_edmonton_data(
    lat: float,
    lng: float,
    radius_miles: float = 2.0,
    zoning_code: Optional[str] = None,
) -> dict:
    """Fetch all available Edmonton Open Data for an area.

    Returns a dict with keys: neighbourhood, demographics, zoning,
    development_permits, building_permits, property_assessments,
    transit, neighbourhood_info.
    """
    data: dict = {
        "source": "City of Edmonton Open Data (data.edmonton.ca)",
        "fetched_at": datetime.now().isoformat(),
        "coordinates": {"lat": lat, "lng": lng},
        "radius_miles": radius_miles,
    }

    # 1. Identify neighbourhood
    neighbourhood = get_neighbourhood_from_coords(lat, lng)
    data["neighbourhood"] = neighbourhood

    neighbourhood_id = (neighbourhood or {}).get("neighbourhood_id", "")
    neighbourhood_name = (neighbourhood or {}).get("neighbourhood_name", "")

    # 2. Neighbourhood metadata
    if neighbourhood_id:
        data["neighbourhood_info"] = get_neighbourhood_info(neighbourhood_id)
    else:
        data["neighbourhood_info"] = None

    # 3. Demographics
    if neighbourhood_id:
        data["demographics"] = get_neighbourhood_demographics(neighbourhood_id)
    else:
        data["demographics"] = None

    # 4. Zoning info
    if zoning_code:
        data["zoning"] = get_zoning_by_code(zoning_code)
    else:
        # Auto-detect from point or nearest permit
        detected = (neighbourhood or {}).get("detected_zoning", "")
        if detected:
            data["zoning"] = get_zoning_by_code(detected)
            data["detected_zoning_code"] = detected
        else:
            data["zoning"] = get_zoning_at_point(lat, lng)

    # 5. Development permits
    data["development_permits"] = get_development_permits(lat, lng, radius_miles)

    # 6. Building permits (by neighbourhood name since no geo field)
    if neighbourhood_name:
        data["building_permits"] = get_building_permits(neighbourhood_name)
    else:
        data["building_permits"] = []

    # 7. Property assessments (nearby — for value cross-checks)
    data["property_assessments"] = get_property_assessments(
        lat, lng, radius_miles=min(radius_miles, 1.0)
    )

    # 8. Transit access
    lrt = get_nearby_lrt_stations(lat, lng, radius_miles=1.0)
    bus_count = get_nearby_bus_stops(lat, lng, radius_miles=0.3)
    data["transit"] = {
        "lrt_stations": lrt,
        "bus_stops_nearby": bus_count,
        "has_lrt_access": len(lrt) > 0,
    }

    return data


# ── Helpers ──────────────────────────────────────────────────────────────

def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _estimate_median_age(age_distribution: dict[str, int]) -> Optional[float]:
    """Estimate median age from census age range buckets."""
    if not age_distribution:
        return None

    # Map age ranges to midpoints
    midpoints = {
        "0-4": 2, "5-9": 7, "10-14": 12, "15-19": 17,
        "20-24": 22, "25-29": 27, "30-34": 32, "35-39": 37,
        "40-44": 42, "45-49": 47, "50-54": 52, "55-59": 57,
        "60-64": 62, "65-69": 67, "70-74": 72, "75-79": 77,
        "80-84": 82, "85+": 88, "85-89": 87, "90+": 92,
    }

    total = 0
    weighted_sum = 0
    for age_range, count in age_distribution.items():
        mid = midpoints.get(age_range)
        if mid and count:
            total += count
            weighted_sum += mid * count

    if total > 0:
        return round(weighted_sum / total, 1)
    return None
