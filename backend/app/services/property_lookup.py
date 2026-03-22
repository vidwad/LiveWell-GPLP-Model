"""
Property Data Lookup Service
==============================
Multi-source property data fetching for auto-populating property records.

Sources (checked in order of availability):
1. Municipal Open Data (Calgary, Edmonton) — free, no key required
2. Repliers API — Canadian MLS/IDX data (requires API key)
3. AI Enrichment — Claude-powered estimation when APIs unavailable

Each source populates what it can; results are merged with later sources
filling in gaps left by earlier ones.
"""
import json
import logging
from decimal import Decimal
from typing import Optional

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

# Timeout for external API calls
_TIMEOUT = 15


# ── Result Schema ────────────────────────────────────────────────────────

def _empty_result(address: str, city: str) -> dict:
    return {
        "address": address,
        "city": city,
        "province": "Alberta",
        "sources_used": [],
        # Property fields
        "assessed_value": None,
        "current_market_value": None,
        "lot_size": None,
        "zoning": None,
        "max_buildable_area": None,
        "floor_area_ratio": None,
        "year_built": None,
        "property_type": None,
        "building_sqft": None,
        "bedrooms": None,
        "bathrooms": None,
        "legal_description": None,
        "neighbourhood": None,
        "ward": None,
        # MLS / listing data
        "mls_number": None,
        "list_price": None,
        "last_sold_price": None,
        "last_sold_date": None,
        "days_on_market": None,
        "listing_status": None,
        "listing_url": None,
        # Tax & assessment
        "tax_amount": None,
        "tax_year": None,
        # Rental estimates
        "estimated_monthly_rent": None,
        "estimated_rent_per_bed": None,
        # Location
        "latitude": None,
        "longitude": None,
        # Raw data from each source (for debugging / reference)
        "raw_sources": {},
    }


# ── Calgary Open Data ────────────────────────────────────────────────────

CALGARY_ASSESSMENT_URL = "https://data.calgary.ca/resource/6zp6-pxei.json"
CALGARY_LANDUSE_URL = "https://data.calgary.ca/resource/rkfr-buzb.json"


def _fetch_calgary_assessment(address: str) -> Optional[dict]:
    """Fetch property assessment data from City of Calgary Open Data."""
    try:
        # Calgary's dataset uses uppercase addresses
        addr_upper = address.upper().strip()
        params = {
            "$where": f"address LIKE '%{addr_upper}%'",
            "$limit": 5,
        }
        resp = requests.get(CALGARY_ASSESSMENT_URL, params=params, timeout=_TIMEOUT)
        if resp.status_code != 200:
            logger.warning("Calgary assessment API returned %d", resp.status_code)
            return None

        data = resp.json()
        if not data:
            return None

        # Take first match
        rec = data[0]
        return {
            "assessed_value": _to_decimal(rec.get("current_value") or rec.get("assessed_value")),
            "lot_size": _to_decimal(rec.get("lot_size")),
            "year_built": rec.get("year_built"),
            "property_type": rec.get("property_type") or rec.get("building_type"),
            "building_sqft": _to_decimal(rec.get("total_living_area") or rec.get("building_size")),
            "neighbourhood": rec.get("community_name") or rec.get("comm_name"),
            "ward": rec.get("ward"),
            "legal_description": rec.get("legal_description"),
            "latitude": _to_float(rec.get("latitude")),
            "longitude": _to_float(rec.get("longitude")),
            "tax_amount": _to_decimal(rec.get("current_tax") or rec.get("tax_amount")),
            "tax_year": rec.get("tax_year") or rec.get("roll_year"),
            "_source": "calgary_opendata",
            "_raw": rec,
        }
    except Exception as e:
        logger.warning("Calgary assessment lookup failed: %s", e)
        return None


def _fetch_calgary_landuse(address: str) -> Optional[dict]:
    """Fetch zoning/land use data from City of Calgary."""
    try:
        addr_upper = address.upper().strip()
        params = {
            "$where": f"address LIKE '%{addr_upper}%'",
            "$limit": 3,
        }
        resp = requests.get(CALGARY_LANDUSE_URL, params=params, timeout=_TIMEOUT)
        if resp.status_code != 200:
            return None

        data = resp.json()
        if not data:
            return None

        rec = data[0]
        return {
            "zoning": rec.get("land_use_designation") or rec.get("lu_designation"),
            "max_buildable_area": _to_decimal(rec.get("max_buildable_area")),
            "floor_area_ratio": _to_float(rec.get("floor_area_ratio")),
            "_source": "calgary_landuse",
            "_raw": rec,
        }
    except Exception as e:
        logger.warning("Calgary land use lookup failed: %s", e)
        return None


# ── Edmonton Open Data ───────────────────────────────────────────────────

EDMONTON_ASSESSMENT_URL = "https://data.edmonton.ca/resource/q7d6-ambg.json"


def _fetch_edmonton_assessment(address: str) -> Optional[dict]:
    """Fetch property assessment from City of Edmonton Open Data."""
    try:
        addr_upper = address.upper().strip()
        params = {
            "$where": f"street_name LIKE '%{addr_upper}%' OR suite LIKE '%{addr_upper}%'",
            "$limit": 5,
        }
        resp = requests.get(EDMONTON_ASSESSMENT_URL, params=params, timeout=_TIMEOUT)
        if resp.status_code != 200:
            return None

        data = resp.json()
        if not data:
            # Try simpler search
            parts = addr_upper.split()
            if len(parts) >= 2:
                house_num = parts[0]
                street = " ".join(parts[1:])
                params = {
                    "$where": f"house_number='{house_num}' AND street_name LIKE '%{street}%'",
                    "$limit": 5,
                }
                resp = requests.get(EDMONTON_ASSESSMENT_URL, params=params, timeout=_TIMEOUT)
                if resp.status_code == 200:
                    data = resp.json()

        if not data:
            return None

        rec = data[0]
        return {
            "assessed_value": _to_decimal(rec.get("assessed_value")),
            "lot_size": _to_decimal(rec.get("lot_size")),
            "year_built": rec.get("year_built"),
            "neighbourhood": rec.get("neighbourhood"),
            "ward": rec.get("ward"),
            "zoning": rec.get("zoning"),
            "latitude": _to_float(rec.get("latitude")),
            "longitude": _to_float(rec.get("longitude")),
            "tax_amount": _to_decimal(rec.get("tax_levy")),
            "_source": "edmonton_opendata",
            "_raw": rec,
        }
    except Exception as e:
        logger.warning("Edmonton assessment lookup failed: %s", e)
        return None


# ── Repliers API (Canadian MLS) ──────────────────────────────────────────

def _fetch_repliers_listing(address: str, city: str, api_key: str) -> Optional[dict]:
    """Fetch MLS listing data from Repliers API."""
    try:
        headers = {"Authorization": f"Bearer {api_key}"}
        params = {
            "address": address,
            "city": city,
            "province": "Alberta",
            "resultsPerPage": 5,
        }
        resp = requests.get(
            "https://api.repliers.io/listings",
            headers=headers,
            params=params,
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            logger.warning("Repliers API returned %d", resp.status_code)
            return None

        data = resp.json()
        listings = data.get("listings", [])
        if not listings:
            return None

        listing = listings[0]
        address_data = listing.get("address", {})
        details = listing.get("details", {})
        lot = listing.get("lot", {})

        return {
            "mls_number": listing.get("mlsNumber"),
            "list_price": _to_decimal(listing.get("listPrice")),
            "last_sold_price": _to_decimal(listing.get("soldPrice")),
            "last_sold_date": listing.get("soldDate"),
            "days_on_market": listing.get("daysOnMarket"),
            "listing_status": listing.get("status"),
            "listing_url": listing.get("url"),
            "property_type": details.get("propertyType"),
            "bedrooms": _to_int(details.get("numBedrooms")),
            "bathrooms": _to_int(details.get("numBathrooms")),
            "building_sqft": _to_decimal(details.get("sqft")),
            "lot_size": _to_decimal(lot.get("size")),
            "year_built": details.get("yearBuilt"),
            "current_market_value": _to_decimal(listing.get("listPrice")),
            "latitude": _to_float(address_data.get("latitude")),
            "longitude": _to_float(address_data.get("longitude")),
            "neighbourhood": address_data.get("neighbourhood"),
            "_source": "repliers",
            "_raw": listing,
        }
    except Exception as e:
        logger.warning("Repliers API lookup failed: %s", e)
        return None


# ── AI Enrichment (Claude) ───────────────────────────────────────────────

def _ai_enrich_property(
    address: str, city: str, existing_data: dict,
) -> Optional[dict]:
    """Use Claude to estimate missing property data fields."""
    from app.services.ai import _call_claude_json, _HAS_CLAUDE

    if not _HAS_CLAUDE:
        return None

    # Only ask for fields that are still missing
    missing = [k for k in [
        "assessed_value", "current_market_value", "lot_size", "zoning",
        "year_built", "property_type", "bedrooms", "neighbourhood",
        "estimated_monthly_rent", "estimated_rent_per_bed",
    ] if not existing_data.get(k)]

    if not missing:
        return None  # All fields already populated

    prompt = f"""Given this property in {city}, Alberta, Canada:
Address: {address}

Known data:
{json.dumps({k: v for k, v in existing_data.items() if v is not None and not k.startswith('_') and k != 'raw_sources' and k != 'sources_used'}, indent=2, default=str)}

Estimate the following missing fields based on your knowledge of {city} real estate:
{json.dumps(missing)}

Return JSON with ONLY these keys (use null if you cannot estimate):
{', '.join(missing)}

Use realistic values for the specific neighbourhood and property type.
For rent estimates, consider the Living Well Communities bed-level rental model ($800-$1800/bed/month).
All dollar amounts in CAD. lot_size in sqft."""

    result = _call_claude_json(prompt, max_tokens=1024)
    if result:
        result["_source"] = "ai_estimate"
        return result
    return None


# ── Helpers ──────────────────────────────────────────────────────────────

def _to_decimal(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _to_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _to_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _merge_data(base: dict, update: dict) -> dict:
    """Merge update into base, only filling in None/missing values."""
    for key, val in update.items():
        if key.startswith("_"):
            continue
        if val is not None and base.get(key) is None:
            base[key] = val
    return base


# ── Main Lookup Function ────────────────────────────────────────────────

def lookup_property(
    address: str,
    city: str,
    province: str = "Alberta",
    repliers_api_key: Optional[str] = None,
) -> dict:
    """Look up property data from all available sources.

    Tries municipal open data first (free), then paid APIs if keys are
    configured, then AI enrichment for any remaining gaps.
    """
    result = _empty_result(address, city)
    result["province"] = province

    city_lower = city.lower().strip()

    # 1. Municipal Open Data (free)
    if "calgary" in city_lower:
        assessment = _fetch_calgary_assessment(address)
        if assessment:
            result["raw_sources"]["calgary_assessment"] = assessment.get("_raw", {})
            _merge_data(result, assessment)
            result["sources_used"].append("City of Calgary Assessment")

        landuse = _fetch_calgary_landuse(address)
        if landuse:
            result["raw_sources"]["calgary_landuse"] = landuse.get("_raw", {})
            _merge_data(result, landuse)
            if "City of Calgary Assessment" not in result["sources_used"]:
                result["sources_used"].append("City of Calgary Land Use")
            else:
                result["sources_used"].append("City of Calgary Zoning")

    elif "edmonton" in city_lower:
        assessment = _fetch_edmonton_assessment(address)
        if assessment:
            result["raw_sources"]["edmonton_assessment"] = assessment.get("_raw", {})
            _merge_data(result, assessment)
            result["sources_used"].append("City of Edmonton Assessment")

    # 2. Repliers API (MLS data — requires paid API key)
    if repliers_api_key:
        mls_data = _fetch_repliers_listing(address, city, repliers_api_key)
        if mls_data:
            result["raw_sources"]["repliers"] = mls_data.get("_raw", {})
            _merge_data(result, mls_data)
            result["sources_used"].append("MLS (Repliers)")

    # 3. AI Enrichment (fill remaining gaps)
    ai_data = _ai_enrich_property(address, city, result)
    if ai_data:
        _merge_data(result, ai_data)
        result["sources_used"].append("AI Estimate (Claude)")

    # Clean up raw_sources for response
    if not result["raw_sources"]:
        del result["raw_sources"]

    return result
