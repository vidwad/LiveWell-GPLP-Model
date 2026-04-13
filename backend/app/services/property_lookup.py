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
        "property_style": None,
        "building_sqft": None,
        "bedrooms": None,
        "bathrooms": None,
        "garage": None,
        "legal_description": None,
        "neighbourhood": None,
        "ward": None,
        "roll_number": None,
        "assessment_class": None,
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
        # Development plan suggestions (from AI suggest-defaults)
        "recommended_units": None,
        "estimated_cost_per_sqft": None,
        "development_reasoning": None,
        # Extended fields from AI deep search
        "property_flags": None,        # e.g. ["former grow operation"]
        "renovation_year": None,
        "previous_mls_numbers": None,  # e.g. ["A1098998"]
        "basement_type": None,
        "neighbourhood_trend": None,
        "assessed_value_year": None,
        # Raw data from each source (for debugging / reference)
        "raw_sources": {},
    }


# ── Calgary Open Data ────────────────────────────────────────────────────

# Current Year dataset (replaces historical 6zp6-pxei which ended at 2022)
CALGARY_ASSESSMENT_URL = "https://data.calgary.ca/resource/4bsw-nn7w.json"
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

        # Extract lat/lng from multipolygon geometry if present
        lat = _to_float(rec.get("latitude"))
        lng = _to_float(rec.get("longitude"))
        if not lat or not lng:
            mp = rec.get("multipolygon")
            if mp and isinstance(mp, dict):
                coords = mp.get("coordinates")
                if coords:
                    # multipolygon: [[[[lng, lat], ...]]] — average all points for centroid
                    try:
                        all_pts = []
                        for poly in (coords if isinstance(coords[0][0][0], list) else [coords]):
                            for ring in poly:
                                for pt in ring:
                                    all_pts.append(pt)
                        if all_pts:
                            lng = sum(p[0] for p in all_pts) / len(all_pts)
                            lat = sum(p[1] for p in all_pts) / len(all_pts)
                    except Exception:
                        pass

        # Fallback: geocode via Calgary's free municipal geocoder
        if not lat or not lng:
            try:
                geo_resp = requests.get(
                    "https://gis.calgary.ca/arcgis/rest/services/pub_Locator_Pro/"
                    "CalgaryUniversalLocator/GeocodeServer/findAddressCandidates",
                    params={"SingleLine": addr_upper, "outSR": "4326", "f": "json", "maxLocations": 1},
                    timeout=_TIMEOUT,
                )
                candidates = geo_resp.json().get("candidates", [])
                if candidates:
                    loc = candidates[0].get("location", {})
                    lng = loc.get("x")
                    lat = loc.get("y")
            except Exception:
                pass

        return {
            "assessed_value": _to_decimal(rec.get("current_value") or rec.get("assessed_value")),
            "lot_size": _to_decimal(rec.get("lot_size") or rec.get("land_size") or rec.get("land_size_sf")),
            "year_built": rec.get("year_built") or rec.get("year_of_construction"),
            "property_type": rec.get("property_type") or rec.get("building_type"),
            "building_sqft": _to_decimal(rec.get("total_living_area") or rec.get("building_size")),
            "neighbourhood": rec.get("community_name") or rec.get("comm_name"),
            "ward": rec.get("ward"),
            "legal_description": rec.get("legal_description"),
            "latitude": lat,
            "longitude": lng,
            "tax_amount": _to_decimal(rec.get("current_tax") or rec.get("tax_amount")),
            "tax_year": rec.get("tax_year") or rec.get("roll_year"),
            "roll_number": rec.get("roll_number"),
            "assessment_class": rec.get("assessment_class") or rec.get("assessment_class_description"),
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
        # Parse house number and street from address like "10623 75 AV NW"
        parts = addr_upper.split()
        data = None

        if len(parts) >= 2:
            house_num = parts[0]
            street_rest = " ".join(parts[1:])
            # Expand common abbreviations so LIKE matches Edmonton's full names
            # "AV" → "AVE", "ST" → "ST" (already matches), "DR" → "DR", etc.
            street_expanded = street_rest
            for abbr, full in [("AV ", "AVE"), ("AV\t", "AVE"), (" AV", " AVENUE")]:
                street_expanded = street_expanded.replace(abbr, full)
            # Also try without directional suffix for broader match
            street_core = street_rest
            for suffix in (" NW", " NE", " SW", " SE"):
                street_core = street_core.replace(suffix, "")

            # Try exact house_number + street LIKE (most precise)
            for street_query in [street_rest, street_expanded, street_core]:
                params = {
                    "$where": f"house_number='{house_num}' AND street_name LIKE '%{street_query}%'",
                    "$limit": 5,
                }
                resp = requests.get(EDMONTON_ASSESSMENT_URL, params=params, timeout=_TIMEOUT)
                if resp.status_code == 200:
                    data = resp.json()
                    if data:
                        break

        # Fallback: full address search
        if not data:
            params = {
                "$where": f"street_name LIKE '%{addr_upper}%'",
                "$limit": 5,
            }
            resp = requests.get(EDMONTON_ASSESSMENT_URL, params=params, timeout=_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()

        if not data:
            return None

        rec = data[0]

        # Extract lat/lng — Edmonton may have point geometry or explicit fields
        lat = _to_float(rec.get("latitude"))
        lng = _to_float(rec.get("longitude"))
        if not lat or not lng:
            pt = rec.get("point") or rec.get("location") or rec.get("geom")
            if pt and isinstance(pt, dict):
                coords = pt.get("coordinates")
                if coords and len(coords) >= 2:
                    lng, lat = coords[0], coords[1]

        # Fallback: geocode via Nominatim (free, no API key)
        if not lat or not lng:
            try:
                geo_resp = requests.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": f"{addr_upper}, Edmonton, AB, Canada", "format": "json", "limit": 1},
                    headers={"User-Agent": "LivingWell-GPLP/1.0"},
                    timeout=_TIMEOUT,
                )
                geo_data = geo_resp.json()
                if geo_data:
                    lat = _to_float(geo_data[0].get("lat"))
                    lng = _to_float(geo_data[0].get("lon"))
            except Exception:
                pass

        return {
            "assessed_value": _to_decimal(rec.get("assessed_value")),
            "lot_size": _to_decimal(rec.get("lot_size")),
            "year_built": rec.get("year_built"),
            "neighbourhood": rec.get("neighbourhood"),
            "ward": rec.get("ward"),
            "zoning": rec.get("zoning"),
            "latitude": lat,
            "longitude": lng,
            "tax_amount": _to_decimal(rec.get("tax_levy")),
            "roll_number": rec.get("account_number"),
            "assessment_class": rec.get("assessment_class_1") or rec.get("tax_class"),
            "garage": rec.get("garage"),
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
        headers = {"REPLIERS-API-KEY": api_key}
        params = {
            "address": address,
            "city": city,
            "province": "Alberta",
            "resultsPerPage": 5,
        }
        resp = requests.get(
            "https://csr-api.repliers.io/listings",
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

        map_data = listing.get("map", {})
        return {
            "mls_number": listing.get("mlsNumber"),
            "list_price": _to_decimal(listing.get("listPrice")),
            "last_sold_price": _to_decimal(listing.get("soldPrice")),
            "last_sold_date": listing.get("soldDate"),
            "days_on_market": listing.get("daysOnMarket"),
            "listing_status": listing.get("status"),
            "listing_url": listing.get("url"),
            "property_type": details.get("propertyType"),
            "property_style": details.get("style"),
            "bedrooms": _to_int(details.get("numBedrooms")),
            "bathrooms": _to_int(details.get("numBathrooms")),
            "building_sqft": _to_decimal(details.get("sqft")),
            "lot_size": _to_decimal(lot.get("size")),
            "year_built": details.get("yearBuilt"),
            "garage": details.get("garage"),
            "current_market_value": _to_decimal(listing.get("listPrice")),
            "latitude": _to_float(map_data.get("lat") or address_data.get("latitude")),
            "longitude": _to_float(map_data.get("long") or address_data.get("longitude")),
            "neighbourhood": address_data.get("neighbourhood"),
            "_source": "repliers",
            "_raw": listing,
        }
    except Exception as e:
        logger.warning("Repliers API lookup failed: %s", e)
        return None


# ── OpenAI Web Search Enrichment ──────────────────────────────────────────

def _fetch_openai_web_search(address: str, city: str, province: str = "AB") -> Optional[dict]:
    """Use OpenAI with web search to find real listing data for a property.

    OpenAI's models can browse the web to find current MLS listings,
    sale history, property flags, and neighbourhood data that the Claude
    API (without web search) cannot access.
    """
    try:
        from openai import OpenAI

        # Try settings DB first, then env var
        api_key = None
        try:
            from app.db.session import SessionLocal
            from app.db.models import PlatformSetting
            db = SessionLocal()
            setting = db.query(PlatformSetting).filter(
                PlatformSetting.key == "OPENAI_API_KEY"
            ).first()
            if setting and setting.value:
                api_key = setting.value
            db.close()
        except Exception:
            pass

        if not api_key:
            api_key = settings.OPENAI_API_KEY

        if not api_key:
            logger.info("OpenAI API key not configured, skipping web search")
            return None

        client = OpenAI(api_key=api_key)

        prompt = f"""Search the web and find ALL available information about this Canadian property:

Address: {address}
City: {city}, {province}, Canada

Search Realtor.ca, HouseCreep, municipal assessment databases, and any other real estate sources.

Return a JSON object with these fields (use null if not found):
{{
    "mls_number": "current or most recent MLS listing number",
    "list_price": current listing price as number (CAD),
    "last_sold_price": last sale price as number (CAD),
    "last_sold_date": "YYYY-MM-DD",
    "previous_mls_numbers": ["array of historical MLS numbers"],
    "bedrooms": number,
    "bathrooms": number,
    "building_sqft": number,
    "lot_size": number in sqft,
    "year_built": number,
    "property_type": "e.g. Single Family Detached",
    "property_style": "e.g. Bungalow, 2 Storey",
    "garage": "e.g. Double Detached",
    "zoning": "current zoning designation",
    "assessed_value": municipal assessment value as number (CAD),
    "assessed_value_year": assessment year,
    "neighbourhood": "neighbourhood name",
    "property_flags": ["array of warnings e.g. former grow operation, heritage site"],
    "renovation_year": most recent major renovation year,
    "basement_type": "e.g. Finished with illegal suite",
    "listing_url": "URL to current listing",
    "neighbourhood_trend": "brief market trend description",
    "days_on_market": number,
    "listing_status": "Active, Sold, etc.",
    "latitude": number,
    "longitude": number,
    "tax_amount": annual property tax as number,
    "estimated_monthly_rent": estimated monthly rent as number (CAD),
    "current_market_value": estimated market value as number (CAD)
}}

IMPORTANT: Only include data you actually found from web sources. Use null for fields you cannot verify. Include the listing URL if you find one."""

        response = client.responses.create(
            model="gpt-5.4-mini",
            tools=[{"type": "web_search_preview"}],
            input=prompt,
        )

        # Extract text from response
        text = ""
        for item in response.output:
            if hasattr(item, "content"):
                for block in item.content:
                    if hasattr(block, "text"):
                        text += block.text

        if not text:
            return None

        # Parse JSON from response (may be wrapped in markdown code blocks)
        import re
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if json_match:
            text = json_match.group(1)
        else:
            # Try to find raw JSON object
            json_match = re.search(r"\{[\s\S]*\}", text)
            if json_match:
                text = json_match.group(0)

        data = json.loads(text)
        data["_source"] = "openai_web_search"
        return data

    except ImportError:
        logger.info("OpenAI package not installed, skipping web search")
        return None
    except json.JSONDecodeError as e:
        logger.warning("OpenAI web search returned invalid JSON: %s", e)
        return None
    except Exception as e:
        logger.warning("OpenAI web search failed: %s", e)
        return None


# ── Realtor.ca Public API ─────────────────────────────────────────────────

REALTOR_CA_API_URL = "https://api2.realtor.ca/Listing.svc/PropertySearch_Post"

def _fetch_realtor_ca(address: str, city: str, province: str = "Alberta") -> Optional[dict]:
    """Fetch listing data from Realtor.ca's public API.

    Uses the same API the Realtor.ca website calls from the browser.
    Returns the best matching listing if found.
    """
    try:
        # Province code mapping
        province_codes = {
            "AB": "Alberta", "BC": "British Columbia", "ON": "Ontario",
            "QC": "Quebec", "MB": "Manitoba", "SK": "Saskatchewan",
            "NS": "Nova Scotia", "NB": "New Brunswick", "NL": "Newfoundland and Labrador",
            "PE": "Prince Edward Island", "NT": "Northwest Territories",
            "YT": "Yukon", "NU": "Nunavut",
        }
        prov_full = province_codes.get(province.upper(), province) if len(province) <= 2 else province

        # Build search query
        query = f"{address}, {city}, {prov_full}"

        payload = {
            "CultureId": 1,
            "ApplicationId": 37,
            "PropertySearchTypeId": 1,  # Residential
            "HashCode": 0,
            "Version": "7.0",
            "RecordsPerPage": 5,
            "CurrentPage": 1,
            "ZoomLevel": 15,
            "LatitudeMax": 52.0,
            "LatitudeMin": 50.5,
            "LongitudeMax": -113.5,
            "LongitudeMin": -114.5,
            "Keywords": query,
            "Sort": "6-D",  # Sort by price descending
        }

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://www.realtor.ca",
            "Referer": "https://www.realtor.ca/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }

        resp = requests.post(
            REALTOR_CA_API_URL,
            data=payload,
            headers=headers,
            timeout=_TIMEOUT,
        )

        if resp.status_code != 200:
            logger.warning("Realtor.ca API returned %d", resp.status_code)
            return None

        data = resp.json()
        results = data.get("Results", [])
        if not results:
            logger.info("Realtor.ca: no results for %s", query)
            return None

        # Find the best match by checking address similarity
        addr_upper = address.upper().strip()
        best = None
        for r in results:
            prop_addr = (r.get("Property", {}).get("Address", {}).get("AddressText", "") or "").upper()
            if addr_upper.split()[0] in prop_addr:  # Match house number
                best = r
                break
        if not best:
            best = results[0]  # Fall back to first result

        prop = best.get("Property", {})
        building = best.get("Building", {})
        land = best.get("Land", {})
        addr_info = prop.get("Address", {})

        # Extract price
        price_str = prop.get("Price", "")
        price_val = None
        if price_str:
            price_clean = price_str.replace("$", "").replace(",", "").strip()
            try:
                price_val = float(price_clean)
            except ValueError:
                pass

        # Extract bedrooms/bathrooms
        bedrooms = None
        bathrooms = None
        if building.get("Bedrooms"):
            bedrooms = _to_int(building["Bedrooms"])
        if building.get("BathroomTotal"):
            bathrooms = _to_int(building["BathroomTotal"])

        # Extract sqft
        sqft = None
        size_interior = building.get("SizeInterior", "")
        if size_interior and "sqft" in size_interior.lower():
            sqft_str = size_interior.lower().replace("sqft", "").replace(",", "").strip().split("-")
            try:
                sqft = float(sqft_str[-1].strip())  # Take upper range
            except ValueError:
                pass

        # Extract lot size
        lot_size = None
        lot_str = land.get("SizeTotal", "")
        if lot_str:
            lot_clean = lot_str.lower()
            if "sqft" in lot_clean:
                try:
                    lot_size = float(lot_clean.replace("sqft", "").replace(",", "").strip().split("-")[-1].strip())
                except ValueError:
                    pass
            elif "acre" in lot_clean:
                try:
                    acres = float(lot_clean.replace("acres", "").replace("acre", "").replace(",", "").strip())
                    lot_size = acres * 43560
                except ValueError:
                    pass

        mls_number = best.get("MlsNumber") or best.get("Id")
        rel_url = best.get("RelativeDetailsURL", "")
        listing_url = f"https://www.realtor.ca{rel_url}" if rel_url else None

        return {
            "mls_number": str(mls_number) if mls_number else None,
            "list_price": price_val,
            "current_market_value": price_val,
            "listing_status": prop.get("Type", ""),
            "listing_url": listing_url,
            "property_type": building.get("Type", ""),
            "property_style": building.get("ArchitecturalStyle", ""),
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "building_sqft": sqft,
            "lot_size": lot_size,
            "year_built": building.get("ConstructedDate") or building.get("YearBuilt"),
            "garage": building.get("Parking", [{}])[0].get("Name") if building.get("Parking") else None,
            "neighbourhood": addr_info.get("CommunityName"),
            "latitude": _to_float(prop.get("Address", {}).get("Latitude")),
            "longitude": _to_float(prop.get("Address", {}).get("Longitude")),
            "days_on_market": _to_int(building.get("DaysOnMarket")),
            "_source": "realtor_ca",
            "_raw": best,
        }
    except Exception as e:
        logger.warning("Realtor.ca lookup failed: %s", e)
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

    prompt = f"""You are a Canadian real estate data specialist with deep knowledge of Alberta property markets.

Find ALL information you can about this specific property:
Address: {address}
City: {city}, Alberta, Canada

Search your training data for:
- MLS listings (current and historical) — include MLS numbers (e.g. A2282727, A1098998)
- Previous sale prices and dates
- Property assessment values from City of {city}
- Zoning designation (note: Calgary rezoned to R-CG citywide in Aug 2024)
- Any stigmatized property flags (grow ops, crime, etc.)
- Renovation history
- Neighbourhood context and market trends

Already known data:
{json.dumps({k: v for k, v in existing_data.items() if v is not None and not k.startswith('_') and k != 'raw_sources' and k != 'sources_used'}, indent=2, default=str)}

Return a JSON object with ALL of these fields (use null only if you truly have no information):

REQUIRED FIELDS: {json.dumps(missing)}

ADDITIONAL FIELDS (include if you have data):
- mls_number: current/most recent MLS listing number
- list_price: current or most recent listing price in CAD
- last_sold_price: last sale price in CAD
- last_sold_date: date of last sale (YYYY-MM-DD)
- bathrooms: number of bathrooms
- building_sqft: total living area in sqft
- garage: garage description (e.g. "Double Detached")
- legal_description: legal land description
- property_flags: array of any flags/warnings (e.g. "former grow operation", "heritage designation")
- renovation_year: year of most recent major renovation
- previous_mls_numbers: array of historical MLS numbers
- basement_type: e.g. "Finished with illegal suite"
- neighbourhood_trend: brief market trend for this neighbourhood
- assessed_value_year: assessment year

IMPORTANT RULES:
- Provide ACTUAL data from your knowledge, not generic estimates
- If you know specific MLS numbers, listing prices, or sale history, include them
- For estimated fields, note them with realistic values for this specific neighbourhood
- All dollar amounts in CAD
- lot_size in sqft
- For rent estimates, use Living Well Communities bed-level model ($800-$1800/bed/month)
- Include any warnings about the property (stigma, zoning issues, structural concerns)"""

    result = _call_claude_json(prompt, max_tokens=2048)
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

    # 3. OpenAI Web Search (real-time web browsing for listing data)
    openai_data = _fetch_openai_web_search(address, city, province or "AB")
    if openai_data:
        result["raw_sources"]["openai_web_search"] = {k: v for k, v in openai_data.items() if not k.startswith("_")}
        _merge_data(result, openai_data)
        result["sources_used"].append("OpenAI Web Search")

    # 4. Claude AI Enrichment (fill remaining gaps with knowledge-based estimates)
    ai_data = _ai_enrich_property(address, city, result)
    if ai_data:
        _merge_data(result, ai_data)
        result["sources_used"].append("AI Estimate (Claude)")

    # 4. Development plan suggestions (if zoning is available)
    if result.get("zoning"):
        try:
            from app.services.ai import suggest_property_defaults

            dev_plan = suggest_property_defaults(
                address=address,
                zoning=result["zoning"],
                city=city,
            )
            if dev_plan:
                result["recommended_units"] = dev_plan.get("recommended_units")
                result["estimated_cost_per_sqft"] = dev_plan.get("estimated_cost_per_sqft")
                result["development_reasoning"] = dev_plan.get("reasoning")
                # Also fill in lot_size/max_buildable_area from dev plan if still missing
                if result["lot_size"] is None and dev_plan.get("estimated_lot_size"):
                    result["lot_size"] = dev_plan["estimated_lot_size"]
                if result["max_buildable_area"] is None and dev_plan.get("max_buildable_area"):
                    result["max_buildable_area"] = dev_plan["max_buildable_area"]
        except Exception as e:
            logger.warning("Development plan suggestions failed: %s", e)

    # Clean up raw_sources for response
    if not result["raw_sources"]:
        del result["raw_sources"]

    return result
