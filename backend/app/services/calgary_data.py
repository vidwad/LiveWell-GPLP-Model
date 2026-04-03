"""
Calgary Authoritative Data Sources
===================================
Fetches real data from City of Calgary Open Data, CMHC, and StatsCan
for area research reports.

Data Sources:
- City of Calgary Open Data (data.calgary.ca) — Socrata SODA API
  - Development Permits (6933-unw5)
  - Building Permits (c2es-76ed)
  - Land Use Designation Codes (svbi-k49z)
  - Civic Census by Community (s7f7-3gjj)
  - Census by Community 2019 (rkfr-buzb)
- CMHC Rental Market Survey — via targeted web search
- CREB Sales/Listings — via targeted web search
"""

import json
import logging
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────

CALGARY_OPEN_DATA = "https://data.calgary.ca/resource"

# Dataset IDs
DEVELOPMENT_PERMITS = "6933-unw5"
BUILDING_PERMITS = "c2es-76ed"
LAND_USE_CODES = "svbi-k49z"
CIVIC_CENSUS = "s7f7-3gjj"
CENSUS_2019 = "rkfr-buzb"

# 1 mile ≈ 1609 meters
MILES_TO_METERS = 1609.34

# Request timeout in seconds
API_TIMEOUT = 15


# ── Low-level fetch ─────────────────────────────────────────────────────

def _socrata_get(dataset_id: str, params: dict, limit: int = 50) -> list[dict]:
    """Query a Socrata dataset and return parsed JSON rows."""
    params["$limit"] = str(limit)
    qs = urllib.parse.urlencode(params)
    url = f"{CALGARY_OPEN_DATA}/{dataset_id}.json?{qs}"
    logger.info("Calgary Open Data query: %s", url)
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
            data = json.loads(resp.read().decode())
        # Filter out empty rows (Socrata sometimes returns {})
        return [r for r in data if r]
    except Exception as e:
        logger.warning("Calgary Open Data query failed (%s): %s", dataset_id, e)
        return []


# ── Development Permits ─────────────────────────────────────────────────

def get_development_permits(
    lat: float, lng: float, radius_miles: float = 2.0, limit: int = 20
) -> list[dict]:
    """Fetch recent development permits near a location.

    Returns permits from the last 2 years within the given radius.
    """
    radius_m = radius_miles * MILES_TO_METERS
    since = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%dT00:00:00")

    rows = _socrata_get(DEVELOPMENT_PERMITS, {
        "$where": (
            f"within_circle(point, {lat}, {lng}, {radius_m}) "
            f"AND applieddate > '{since}'"
        ),
        "$order": "applieddate DESC",
    }, limit=limit)

    results = []
    for r in rows:
        results.append({
            "permit_number": r.get("permitnum", ""),
            "address": r.get("address", ""),
            "category": r.get("category", ""),
            "description": r.get("description", ""),
            "land_use_district": r.get("landusedistrict", ""),
            "land_use_description": r.get("landusedistrictdescription", ""),
            "status": r.get("statuscurrent", ""),
            "applied_date": r.get("applieddate", ""),
            "permitted_discretionary": r.get("permitteddiscretionary", ""),
            "community_name": r.get("communityname", ""),
            "community_code": r.get("communitycode", ""),
            "latitude": _safe_float(r.get("latitude")),
            "longitude": _safe_float(r.get("longitude")),
        })
    return results


# ── Building Permits ────────────────────────────────────────────────────

def get_building_permits(
    lat: float, lng: float, radius_miles: float = 2.0, limit: int = 20
) -> list[dict]:
    """Fetch recent building permits near a location.

    Returns permits from the last 2 years with construction cost and sqft.
    """
    radius_m = radius_miles * MILES_TO_METERS
    since = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%dT00:00:00")

    rows = _socrata_get(BUILDING_PERMITS, {
        "$where": (
            f"within_circle(point, {lat}, {lng}, {radius_m}) "
            f"AND applieddate > '{since}'"
        ),
        "$order": "applieddate DESC",
    }, limit=limit)

    results = []
    for r in rows:
        results.append({
            "permit_number": r.get("permitnum", ""),
            "address": r.get("originaladdress", ""),
            "status": r.get("statuscurrent", ""),
            "permit_type": r.get("permittype", ""),
            "permit_class": r.get("permitclass", ""),
            "permit_class_group": r.get("permitclassgroup", ""),
            "work_class": r.get("workclassmapped", ""),
            "description": r.get("description", ""),
            "housing_units": _safe_int(r.get("housingunits")),
            "est_project_cost": _safe_float(r.get("estprojectcost")),
            "total_sqft": _safe_float(r.get("totalsqft")),
            "applied_date": r.get("applieddate", ""),
            "issued_date": r.get("issueddate", ""),
            "community_name": r.get("communityname", ""),
            "community_code": r.get("communitycode", ""),
            "latitude": _safe_float(r.get("latitude")),
            "longitude": _safe_float(r.get("longitude")),
        })
    return results


# ── Land Use / Zoning ───────────────────────────────────────────────────

def get_land_use_info(zoning_code: str) -> Optional[dict]:
    """Fetch the official description and rules for a Calgary land use district."""
    if not zoning_code:
        return None

    # Normalize code (e.g. "R-CG" or "R-C1")
    code = zoning_code.strip().upper()

    rows = _socrata_get(LAND_USE_CODES, {
        "$where": f"upper(lud_code) = '{code}'",
    }, limit=1)

    if not rows:
        # Try partial match
        rows = _socrata_get(LAND_USE_CODES, {
            "$where": f"upper(lud_code) like '%{code}%'",
        }, limit=3)

    if not rows:
        return None

    r = rows[0]
    # bylaw_url may come as {"url": "..."} object or plain string
    raw_url = r.get("lud_url", "")
    if isinstance(raw_url, dict):
        raw_url = raw_url.get("url", "")
    return {
        "code": r.get("lud_code", code),
        "name": r.get("lud_name", ""),
        "description": r.get("lud_description", ""),
        "district_type": r.get("lud_district", ""),
        "bylaw_url": raw_url,
    }


# ── Community Demographics ──────────────────────────────────────────────

def get_community_demographics(community_code: str) -> Optional[dict]:
    """Fetch civic census + detailed census data for a Calgary community."""
    if not community_code:
        return None

    code = community_code.strip().upper()

    # Civic Census — population, dwellings, vacancies
    civic = _socrata_get(CIVIC_CENSUS, {
        "$where": f"upper(code) = '{code}'",
        "$order": "census_year DESC",
    }, limit=3)

    # Detailed Census 2019 — demographics, housing types
    detailed = _socrata_get(CENSUS_2019, {
        "$where": f"upper(comm_code) = '{code}'",
        "$order": "cnss_yr DESC",
    }, limit=1)

    result: dict = {"community_code": code, "source": "City of Calgary Civic Census"}

    if civic:
        latest = civic[0]
        result["census_year"] = latest.get("census_year", "")
        result["population"] = _safe_int(latest.get("resident_cnt"))
        result["dwelling_count"] = _safe_int(latest.get("dwelling_cnt"))
        result["occupied_dwellings"] = _safe_int(latest.get("ocpd_dwelling_cnt"))
        result["vacant_dwellings"] = _safe_int(latest.get("vacant_dwelling_cnt"))
        result["ownership_count"] = _safe_int(latest.get("ocpd_ownership_cnt"))
        result["under_construction"] = _safe_int(latest.get("under_const_dwelling_cnt"))

        # Calculate vacancy rate
        total = result["dwelling_count"]
        vacant = result["vacant_dwellings"]
        if total and total > 0:
            result["vacancy_rate_pct"] = round(vacant / total * 100, 1)

        # Population trend from multiple years
        if len(civic) >= 2:
            prev = civic[1]
            prev_pop = _safe_int(prev.get("resident_cnt"))
            if prev_pop and result["population"]:
                growth = (result["population"] - prev_pop) / prev_pop * 100
                result["population_growth_pct"] = round(growth, 1)

    if detailed:
        d = detailed[0]
        result["community_name"] = d.get("name", "")
        result["community_class"] = d.get("class", "")
        result["sector"] = d.get("sector", "")

        # Housing mix
        result["housing_mix"] = {
            "single_family": _safe_int(d.get("sing_famly")),
            "duplex": _safe_int(d.get("duplex")),
            "multiplex": _safe_int(d.get("multi_plex")),
            "apartment": _safe_int(d.get("apartment")),
            "townhouse": _safe_int(d.get("town_house")),
        }

        # Gender breakdown
        result["male_count"] = _safe_int(d.get("male_cnt"))
        result["female_count"] = _safe_int(d.get("female_cnt"))

        # Employed count
        result["employed_count"] = _safe_int(d.get("emplyd_cnt"))

    return result


# ── Detect Community from Coordinates ───────────────────────────────────

def get_community_from_coords(lat: float, lng: float) -> Optional[dict]:
    """Determine the Calgary community a property is in using nearby permits."""
    # Use the closest development permit to identify the community
    rows = _socrata_get(DEVELOPMENT_PERMITS, {
        "$where": f"within_circle(point, {lat}, {lng}, 500)",
        "$order": "applieddate DESC",
    }, limit=1)

    if not rows:
        # Wider search
        rows = _socrata_get(DEVELOPMENT_PERMITS, {
            "$where": f"within_circle(point, {lat}, {lng}, 2000)",
            "$order": "applieddate DESC",
        }, limit=1)

    if rows:
        return {
            "community_name": rows[0].get("communityname", ""),
            "community_code": rows[0].get("communitycode", ""),
        }
    return None


# ── Aggregate: All Calgary data for an area ─────────────────────────────

def fetch_all_calgary_data(
    lat: float,
    lng: float,
    radius_miles: float = 2.0,
    zoning_code: Optional[str] = None,
) -> dict:
    """Fetch all available Calgary Open Data for an area.

    Returns a dict with keys: community, demographics, zoning,
    development_permits, building_permits.
    """
    data: dict = {
        "source": "City of Calgary Open Data (data.calgary.ca)",
        "fetched_at": datetime.now().isoformat(),
        "coordinates": {"lat": lat, "lng": lng},
        "radius_miles": radius_miles,
    }

    # 1. Identify community
    community = get_community_from_coords(lat, lng)
    data["community"] = community

    # 2. Demographics (if community found)
    if community and community.get("community_code"):
        data["demographics"] = get_community_demographics(community["community_code"])
    else:
        data["demographics"] = None

    # 3. Zoning info
    if zoning_code:
        data["zoning"] = get_land_use_info(zoning_code)
    else:
        # Try to get zoning from nearest dev permit
        if community:
            nearby = _socrata_get(DEVELOPMENT_PERMITS, {
                "$where": f"within_circle(point, {lat}, {lng}, 500)",
                "$order": "applieddate DESC",
            }, limit=1)
            if nearby and nearby[0].get("landusedistrict"):
                data["zoning"] = get_land_use_info(nearby[0]["landusedistrict"])
                data["detected_zoning_code"] = nearby[0]["landusedistrict"]
            else:
                data["zoning"] = None
        else:
            data["zoning"] = None

    # 4. Development permits (rezoning, new construction indicators)
    data["development_permits"] = get_development_permits(lat, lng, radius_miles)

    # 5. Building permits (construction activity, property values)
    data["building_permits"] = get_building_permits(lat, lng, radius_miles)

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
