"""
Valuation Report Service
=========================
AI-assisted Management Appraisal Report pipeline.

Architecture:
- Two-pass workflow:
  A. Public research pass — o3-deep-research in background mode (web_search_preview)
  B. Private synthesis pass — gpt-5.4 with file_search against a per-property vector store
- Deterministic subject package built from the DB; the model is told to treat
  it as the source of truth for valuation math.
- Per-property OpenAI vector store created/refreshed for file_search.
- All API tracking (response ids, vector store id, artifact paths) persisted on
  ValuationReportJob.
- PDF rendered server-side via reportlab; emailed via Resend.

Runs in a background thread spawned at job-start time.
"""
from __future__ import annotations

import json
import logging
import threading
import traceback
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import (
    ValuationReportJob, Property, AcquisitionBaseline, ExitForecast,
    DevelopmentPlan, DebtFacility, Unit, Bed, AncillaryRevenueStream,
    OperatingExpenseLineItem, PropertyDocument, User,
)
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


# ── Configuration ────────────────────────────────────────────────────────────

ARTIFACT_ROOT = Path("uploads/valuation_reports")
ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)

import os
# Models can be overridden via env vars without code changes — useful as
# OpenAI's model lineup evolves. Defaults are conservative IDs known to work
# with the Responses API; the user can switch to deep-research / GPT-5 once
# they have access.
RESEARCH_MODEL = os.environ.get("OPENAI_RESEARCH_MODEL", "o3-deep-research-2025-06-26")
SYNTHESIS_MODEL = os.environ.get("OPENAI_SYNTHESIS_MODEL", "gpt-5.4")
# Fallbacks if the primary model fails (e.g. account doesn't have access).
RESEARCH_MODEL_FALLBACK = os.environ.get("OPENAI_RESEARCH_MODEL_FALLBACK", "gpt-5.4")
SYNTHESIS_MODEL_FALLBACK = os.environ.get("OPENAI_SYNTHESIS_MODEL_FALLBACK", "gpt-5.4-mini")

# Fallback / mock mode if no OpenAI API key is configured, OR if explicitly
# forced via env var. The pipeline always produces a renderable PDF in mock
# mode so the UI flow can be exercised offline.
MOCK_MODE = (not bool(settings.OPENAI_API_KEY)) or os.environ.get("VALUATION_REPORT_MOCK", "").lower() in ("1", "true", "yes")


def _get_openai_client():
    """Lazy import so the module loads even when openai isn't installed."""
    from openai import OpenAI
    return OpenAI(api_key=settings.OPENAI_API_KEY)


# ── Stage 0: subject package builder ─────────────────────────────────────────

def build_subject_package(db: Session, property_id: int, effective_date: date | None = None) -> dict[str, Any]:
    """Build a deterministic JSON packet from the database for the subject property."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise ValueError(f"Property {property_id} not found")

    baseline = db.query(AcquisitionBaseline).filter(AcquisitionBaseline.property_id == property_id).first()
    forecast = db.query(ExitForecast).filter(ExitForecast.property_id == property_id).first()
    plans = db.query(DevelopmentPlan).filter(DevelopmentPlan.property_id == property_id).all()
    debts = db.query(DebtFacility).filter(DebtFacility.property_id == property_id).all()
    units = db.query(Unit).filter(Unit.property_id == property_id).all()

    rent_roll = []
    for u in units:
        beds = db.query(Bed).filter(Bed.unit_id == u.unit_id).all()
        rent_roll.append({
            "unit_id": u.unit_id,
            "unit_number": u.unit_number,
            "unit_type": u.unit_type,
            "bedroom_count": u.bedroom_count,
            "sqft": float(u.sqft) if u.sqft else None,
            "renovation_phase": u.renovation_phase.value if hasattr(u.renovation_phase, "value") else str(u.renovation_phase or ""),
            "development_plan_id": u.development_plan_id,
            "beds": [
                {
                    "bed_label": b.bed_label,
                    "monthly_rent": float(b.monthly_rent or 0),
                    "is_post_renovation": bool(b.is_post_renovation),
                    "status": b.status,
                }
                for b in beds
            ],
        })

    ancillary = db.query(AncillaryRevenueStream).filter(AncillaryRevenueStream.property_id == property_id).all()
    expenses = db.query(OperatingExpenseLineItem).filter(OperatingExpenseLineItem.property_id == property_id).all()

    # Deterministic valuation outputs from existing endpoints (best-effort import)
    deterministic_valuation: dict[str, Any] = {}
    try:
        from app.routes.portfolio_performance import get_lifetime_cashflow
        # Pretend a system user for the call (require_investor_or_above accepts any User)
        sys_user = db.query(User).first()
        if sys_user:
            lcf = get_lifetime_cashflow(property_id=property_id, db=db, current_user=sys_user)
            deterministic_valuation = {
                "lifetime_cashflow_summary": {
                    "hold_years": lcf.get("hold_years"),
                    "assumptions": lcf.get("assumptions"),
                    "returns": lcf.get("returns"),
                    "disposition": lcf.get("disposition"),
                },
                "period_count": len(lcf.get("periods", [])),
            }
    except Exception as e:
        logger.warning("Could not load deterministic valuation for subject package: %s", e)

    return {
        "report_type": "Management Appraisal Report (AI-assisted draft)",
        "rights_appraised": "Fee Simple (subject to existing tenancies)",
        "effective_date": str(effective_date or date.today()),
        "valuation_date": str(effective_date or date.today()),
        "jurisdiction": prop.province or getattr(prop, "state", None) or "Unknown",
        "intended_use": "Internal portfolio management; not for lender, court, or regulatory use",
        "intended_users": "Living Well Communities GP/LP management",
        "subject": {
            "property_id": prop.property_id,
            "address": prop.address,
            "city": prop.city,
            "province": prop.province,
            "country": getattr(prop, "country", None),
            "postal_code": prop.postal_code,
            "latitude": float(prop.latitude) if prop.latitude else None,
            "longitude": float(prop.longitude) if prop.longitude else None,
            "year_built": prop.year_built,
            "building_sqft": float(prop.building_sqft) if prop.building_sqft else None,
            "lot_size": float(prop.lot_size) if prop.lot_size else None,
            "bedrooms": prop.bedrooms,
            "bathrooms": float(prop.bathrooms) if prop.bathrooms else None,
            "purchase_price": float(prop.purchase_price) if prop.purchase_price else None,
            "purchase_date": str(prop.purchase_date) if prop.purchase_date else None,
            "current_market_value": float(prop.current_market_value) if prop.current_market_value else None,
            "assessed_value": float(prop.assessed_value) if prop.assessed_value else None,
            "zoning": getattr(prop, "zoning", None),
        },
        "acquisition_baseline": {
            "purchase_price": float(baseline.purchase_price) if baseline and baseline.purchase_price else None,
            "closing_costs": float(baseline.closing_costs) if baseline and baseline.closing_costs else None,
            "initial_equity": float(baseline.initial_equity) if baseline and baseline.initial_equity else None,
            "initial_debt": float(baseline.initial_debt) if baseline and baseline.initial_debt else None,
            "target_hold_years": baseline.target_hold_years if baseline else None,
            "original_exit_cap_rate": float(baseline.original_exit_cap_rate) if baseline and baseline.original_exit_cap_rate else None,
            "original_selling_cost_pct": float(baseline.original_selling_cost_pct) if baseline and baseline.original_selling_cost_pct else None,
        } if baseline else None,
        "exit_forecast": {
            "forecast_sale_year": forecast.forecast_sale_year if forecast else None,
            "forecast_exit_cap_rate": float(forecast.forecast_exit_cap_rate) if forecast and forecast.forecast_exit_cap_rate else None,
            "forecast_sale_price": float(forecast.forecast_sale_price) if forecast and forecast.forecast_sale_price else None,
            "sale_status": forecast.sale_status if forecast else None,
        } if forecast else None,
        "development_plans": [
            {
                "plan_id": p.plan_id,
                "name": p.plan_name,
                "status": p.status.value if hasattr(p.status, "value") else str(p.status or ""),
                "planned_units": p.planned_units,
                "planned_beds": p.planned_beds,
                "estimated_construction_cost": float(p.estimated_construction_cost or 0),
                "development_start_date": str(p.development_start_date) if p.development_start_date else None,
                "estimated_completion_date": str(p.estimated_completion_date) if p.estimated_completion_date else None,
                "estimated_stabilization_date": str(p.estimated_stabilization_date) if p.estimated_stabilization_date else None,
                "lease_up_months": p.lease_up_months,
                "occupancy_during_construction": bool(getattr(p, "occupancy_during_construction", False)),
                "during_construction_revenue_pct": float(getattr(p, "during_construction_revenue_pct", 0) or 0) or None,
            }
            for p in plans
        ],
        "debt_facilities": [
            {
                "debt_id": d.debt_id,
                "lender_name": d.lender_name,
                "debt_type": d.debt_type.value if hasattr(d.debt_type, "value") else str(d.debt_type or ""),
                "debt_purpose": d.debt_purpose,
                "commitment": float(d.commitment_amount or 0),
                "outstanding": float(d.outstanding_balance or 0),
                "interest_rate": float(d.interest_rate or 0),
                "term_months": d.term_months,
                "amortization_months": d.amortization_months,
                "io_period_months": d.io_period_months,
                "interest_reserve": float(getattr(d, "interest_reserve_amount", 0) or 0),
                "origination_date": str(d.origination_date) if d.origination_date else None,
                "maturity_date": str(d.maturity_date) if d.maturity_date else None,
                "replaces_debt_id": d.replaces_debt_id,
                "development_plan_id": d.development_plan_id,
            }
            for d in debts
        ],
        "rent_roll": rent_roll,
        "ancillary_revenue": [
            {
                "type": getattr(s, "stream_type", None),
                "description": getattr(s, "description", None),
                "monthly_rate": float(s.monthly_rate or 0),
                "total_count": s.total_count,
                "utilization_pct": float(s.utilization_pct or 100),
                "development_plan_id": s.development_plan_id,
            }
            for s in ancillary
        ],
        "operating_expenses": [
            {
                "category": e.category,
                "description": e.description,
                "calc_method": e.calc_method.value if hasattr(e.calc_method, "value") else str(e.calc_method or ""),
                "base_amount": float(e.base_amount or 0),
                "annual_escalation_pct": float(e.annual_escalation_pct or 0),
                "development_plan_id": e.development_plan_id,
            }
            for e in expenses
        ],
        "deterministic_valuation": deterministic_valuation,
        "reviewer_constraints": {
            "report_classification": "INTERNAL DRAFT — AI-assisted; NOT a licensed/certified appraisal",
            "must_preserve_deterministic_math": True,
        },
    }


# ── Stage 1: vector store sync ───────────────────────────────────────────────

def sync_property_vector_store(db: Session, job: ValuationReportJob) -> str | None:
    """Create/refresh an OpenAI vector store for this property's documents."""
    if MOCK_MODE:
        return "vs_mock_property_" + str(job.property_id)

    client = _get_openai_client()

    docs = db.query(PropertyDocument).filter(PropertyDocument.property_id == job.property_id).all()
    if not docs:
        logger.info("No property documents to sync for property %s", job.property_id)
        return None

    # Create a fresh vector store per job (simplest approach; safest for reproducibility)
    try:
        vs = client.vector_stores.create(name=f"property-{job.property_id}-job-{job.id}")
    except Exception as e:
        logger.warning("Vector store create failed: %s", e)
        return None

    from app.services.storage import LocalStorageBackend
    storage = LocalStorageBackend()

    file_ids: list[str] = []
    for d in docs:
        try:
            file_path = storage.get_path(d.file_url)
            if not file_path.exists():
                continue
            with open(file_path, "rb") as fh:
                up = client.files.create(file=fh, purpose="assistants")
            file_ids.append(up.id)
        except Exception as e:
            logger.warning("File upload failed for doc %s: %s", d.document_id, e)

    if file_ids:
        try:
            client.vector_stores.file_batches.create(vector_store_id=vs.id, file_ids=file_ids)
        except Exception as e:
            logger.warning("Vector store batch attach failed: %s", e)

    return vs.id


# ── Stage 2: public research (deep-research, background mode) ────────────────

RESEARCH_SYSTEM_PROMPT = """You are a senior real estate research analyst preparing the EXTERNAL-MARKET RESEARCH DOSSIER that will support a comprehensive narrative valuation report (target length 80-150 pages of polished narrative when fully assembled).

Your job in this stage is ONLY to produce the external research and evidence package.
Do not produce the final valuation conclusion unless explicitly asked.
Do not invent facts, comparables, rents, cap rates, zoning status, permit status, taxes, or dates.
If evidence is weak, say so explicitly. Better to flag a gap than to fabricate.

================================================================
DEPTH AND COMPREHENSIVENESS REQUIREMENT (CRITICAL)
================================================================
This dossier feeds a long-form professional appraisal report. It must be EXHAUSTIVE — many pages of substantive content. Aim for the longest, most fact-dense response your context budget allows. The downstream synthesis stage will fail to produce a credible 80+ page report if the research dossier is thin.

Each section below requires multiple paragraphs of substantive narrative — typically 600-1500 words per section, more for comparables and economic analysis. Do not summarize when detail is available. Quote specific numbers, dates, addresses, agencies, and bylaw section numbers wherever possible.

================================================================
RESEARCH PRIORITIES (each must be a full section in your output)
================================================================

1. SUBJECT NEIGHBORHOOD / MARKET AREA — name, boundaries, history, character, predominant land uses, building stock vintage and condition, walkability, demographics deep-dive (population, households, median income, age cohorts, education, ethnic diversity, family composition, owner vs renter mix, dwelling type mix). Cite census/statistical sources by year. 800-1500 words.

2. MACRO AND LOCAL ECONOMIC CONDITIONS — provincial/state economy, metropolitan area GDP/employment growth, labour market (unemployment rate, participation, wage growth), key industries and employers, population growth and net migration, interest-rate and inflation environment as it affects RE, regional development outlook. 600-1200 words.

3. SUBMARKET DEMAND DRIVERS — proximity to employment nodes, post-secondary institutions, hospitals, transit hubs, retail amenities, parks, schools, cultural amenities. Quantify where possible (drive times, distances, ridership). 400-800 words.

4. ZONING / PLANNING / LAND-USE CONTROLS — exact zoning designation, full description of permitted uses, density limits, setbacks, height limits, parking requirements, FAR, lot coverage. Reference the actual municipal Land Use Bylaw section numbers. Identify any pending bylaw amendments, area redevelopment plans, secondary suite policies, or development permit areas affecting the site. Note variance precedents in the immediate area. 600-1200 words.

5. ASSESSMENT / TAXATION / PUBLIC REGISTRY — current municipal assessed value (most recent year), assessment history, mill rate, property tax estimate, tax classification, any LIEN/title encumbrance evidence available from public sources. 300-600 words.

6. ENVIRONMENTAL / LOCATIONAL RISK — flood mapping (overland flow, river flood, stormwater), wildfire interface, contaminated site registry, seismic, soil/grading concerns, traffic noise, adjacent uses with potential nuisance impact, climate-resilience considerations. Cite the actual mapping sources (e.g. provincial flood map portal). 400-800 words.

7. COMPARABLE SALES EVIDENCE — Identify a MINIMUM OF 5-8 specific comparable sale transactions in the past 24-36 months. For EACH comparable: address, sale date, sale price, buyer/seller if known, lot size, building size, year built, configuration (units/beds), price per unit and price per sqft, distance from subject, condition notes, broker/source URL. Then compare each to the subject and discuss how it informs subject value. Be exhaustive. 1500-3000 words.

8. CURRENT LISTINGS / MARKET DEPTH — relevant active listings, median list-to-sale ratios, days on market, absorption trends. 300-600 words.

9. COMPARABLE RENT EVIDENCE — Identify a MINIMUM OF 6-10 rent comparables in the immediate submarket for the subject property type and bed/unit configuration. For EACH: address, unit type, bedroom count, bed count if shared/rooming, asking rent, utilities included, source URL/date. Calculate rent per bed and rent per sqft where possible. Compare to subject's modeled rents and identify any market gap. 1200-2400 words.

10. VACANCY / ABSORPTION / CAP RATE / INVESTMENT MARKET EVIDENCE — current submarket vacancy rates from CMHC or equivalent, recent rent growth trends, absorption velocity for new product, current cap rates by asset class and tier (cite at least one institutional source like CBRE, Colliers, Avison Young, JLL, Altus, Cushman, or Newmark with their most recent quarterly cap rate guide). Discuss the spread between core and value-add. 800-1500 words.

11. COMPETING SUPPLY / DEVELOPMENT PIPELINE — active and proposed competing projects within ~2 km, unit counts, expected delivery dates, developer if known. 400-800 words.

12. HIGHEST AND BEST USE EVIDENCE — physical, legal, financial, and maximally productive considerations. Discuss alternative uses tested. 600-1200 words.

13. PROPERTY-TYPE-SPECIFIC MARKET DRIVERS — for shared-living/rooming-house/co-living: regulatory environment for SROs and rooming houses, licensing, fire code requirements, post-secondary student housing demand if relevant, professional or workforce shared-housing demand. 400-800 words.

================================================================
SOURCE HIERARCHY (prioritize in this order)
================================================================
1. Official government / municipal / provincial / regulatory / assessment sources (city open data portals, land use bylaws, tax authority, registries, statistical agencies)
2. Land title / registry / court sources where publicly accessible
3. Official statistical / economic sources (StatsCan, BLS, BEA, Bank of Canada, IMF, OECD)
4. Reputable brokerage and institutional market reports (CBRE, Colliers, Avison Young, JLL, Altus Group, Newmark, CMHC Market Reports)
5. Listing / sales / rental data sources (MLS aggregators, Zolo, Realtor.ca, PadMapper, Rentals.ca, Zumper)
6. Reputable news only for context

================================================================
RETURN FORMAT
================================================================
Long-form markdown research dossier with these sections (each with the depth specified above):

# Executive Research Summary
# 1. Subject Neighborhood / Market Area
# 2. Macro and Local Economic Conditions
# 3. Submarket Demand Drivers
# 4. Zoning / Planning / Land-Use Controls
# 5. Assessment / Taxation / Public Registry
# 6. Environmental / Locational Risk
# 7. Comparable Sales Evidence
# 8. Current Listings / Market Depth
# 9. Comparable Rent Evidence
# 10. Vacancy / Absorption / Cap Rate / Investment Market Evidence
# 11. Competing Supply / Development Pipeline
# 12. Highest and Best Use Evidence
# 13. Property-Type-Specific Market Drivers
# Evidence Gaps / Weak Points
# Full Source Log (numbered S1, S2, S3... with title, URL, date accessed, source type)

Every external factual statement MUST be cited inline using the bracketed source ID, e.g. "Median household income in Bowness was $72,000 in 2021 [S3]." Conflicting evidence must be explained and the more reliable source identified.

Aim for the maximum length your context budget allows. Verbose, fact-dense, and exhaustively cited beats short and tidy."""


def run_public_research(job: ValuationReportJob, subject_package: dict) -> tuple[str, str]:
    """Kick off the deep-research call. Returns (response_id, output_text)."""
    if MOCK_MODE:
        mock_text = (
            "# Public Research Dossier (MOCK)\n\n"
            "OpenAI API key not configured. This is a stub research dossier so the "
            "pipeline can be exercised end-to-end without external calls.\n\n"
            f"Subject: {subject_package['subject']['address']}, "
            f"{subject_package['subject']['city']}, {subject_package['subject']['province']}\n\n"
            "## Market area analysis\n[mock]\n\n## Comparable sales evidence\n[mock]\n\n"
            "## Source log\n_None — mock mode_\n"
        )
        return ("mock_research_response", mock_text)

    client = _get_openai_client()

    user_input = (
        "Subject packet (use only to understand WHAT to research; do not treat as "
        "external evidence):\n\n```json\n"
        + json.dumps(subject_package["subject"], indent=2)
        + "\n```\n\nValuation date: "
        + subject_package["valuation_date"]
        + "\nReport type: "
        + subject_package["report_type"]
        + "\n\nProduce the long-form research dossier per your instructions."
    )

    def _try_model(model_name: str, use_background: bool) -> tuple[str, str]:
        kwargs: dict = {
            "model": model_name,
            "input": [
                {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
            ],
            "tools": [{"type": "web_search_preview"}],
        }
        if use_background:
            kwargs["background"] = True
        resp = client.responses.create(**kwargs)

        if not use_background:
            return (resp.id, resp.output_text or "")

        import time
        response_id = resp.id
        for _ in range(180):  # ~30 min
            r = client.responses.retrieve(response_id)
            if r.status in ("completed", "failed", "cancelled", "incomplete"):
                break
            time.sleep(10)
        final = client.responses.retrieve(response_id)
        if final.status != "completed":
            err = getattr(final, "error", None) or getattr(final, "incomplete_details", None)
            err_msg = ""
            if err:
                err_msg = getattr(err, "message", None) or str(err)
            raise RuntimeError(f"status={final.status} {err_msg}".strip())
        return (final.id, final.output_text or "")

    # Try the configured deep-research model in background mode first.
    try:
        return _try_model(RESEARCH_MODEL, use_background=True)
    except Exception as primary_err:
        logger.warning("Primary research model %s failed: %s — falling back to %s",
                       RESEARCH_MODEL, primary_err, RESEARCH_MODEL_FALLBACK)
        try:
            return _try_model(RESEARCH_MODEL_FALLBACK, use_background=False)
        except Exception as fallback_err:
            raise RuntimeError(
                f"Research stage failed. Primary={RESEARCH_MODEL}: {primary_err}. "
                f"Fallback={RESEARCH_MODEL_FALLBACK}: {fallback_err}"
            )


# ── Stage 3: private synthesis (gpt-5.4 + file_search) ───────────────────────

SYNTHESIS_BASE_INSTRUCTIONS = """You are a senior real estate appraiser preparing a long-form, comprehensive narrative valuation report (target full length 80-150 pages of professional appraisal-grade prose). This is a PRIVATE SYNTHESIS stage — DO NOT browse the web. Work only from:
1. The deterministic subject package from the application (source of truth for facts and valuation math).
2. The public research dossier from the prior research stage.
3. (When available) internal documents accessible via file_search.

================================================================
NON-NEGOTIABLE RULES
================================================================
- DETERMINISTIC MATH IS SACRED. If the subject package contains valuation calculations, NOI, debt service, returns, equity multiples, IRR, exit values, or cash flows, you MUST quote them verbatim. Never silently substitute your own numbers. If you derive a number, show the formula and the inputs and label it "[derived]".
- Distinguish clearly between (a) internal factual data, (b) externally researched evidence, (c) modeled assumptions, (d) reviewer-confirmation-required items. Use these tags inline where appropriate.
- Cite every external factual statement using the source IDs from the research dossier source log (e.g. [S3]).
- Flag missing or conflicting evidence explicitly — do not paper over gaps.
- NEVER claim this is a licensed, certified, USPAP-compliant, AIC-compliant, or otherwise accredited appraisal. It is an AI-assisted internal management draft requiring human expert review.

================================================================
DEPTH AND LENGTH REQUIREMENT (CRITICAL)
================================================================
This is appraisal-grade work, not a memo. You will be writing one section group at a time. For your assigned sections, produce the LONGEST, MOST FACT-DENSE NARRATIVE your token budget allows.

- Each section in your assignment must be MULTIPLE PARAGRAPHS of substantive professional narrative.
- Aim for AT LEAST 800-2000 words per major section.
- Comparable sales and income approach sections should be 2000-4000 words each — they are the heart of the report.
- DO NOT summarize when you can elaborate. DO NOT bullet when you can narrate.
- Bullet lists are appropriate ONLY for: (a) enumerated source citations, (b) explicit numeric tables, (c) limiting conditions, (d) reviewer checklists. Everything else should be flowing professional prose.
- If you have less to say on a topic because the evidence is thin, say so explicitly in a "Note on evidence sufficiency" subsection — do not pad with empty text, but DO explain WHY the evidence is thin and what would be required to strengthen it.

================================================================
WRITING STYLE
================================================================
- Polished professional narrative in the third person.
- Neutral, analytical tone.
- Use technical appraisal vocabulary (e.g. "stabilized NOI", "going-in cap rate", "lease-up absorption", "loss-to-lease", "capital expenditure reserve", "highest and best use as if vacant vs as improved", "reconciliation of indications of value").
- Long-form markdown suitable for PDF rendering. Use ## for section headers and ### for subsections.
- Tables (markdown pipe-format) are encouraged for comparables, operating statements, adjustment grids, sensitivity tables, and rent rolls.
- Inline citations using [S#] for external sources, [INT#] for internal documents, and [DET] for deterministic subject-package values.

================================================================
OUTPUT
================================================================
Output ONLY the markdown for your assigned sections — no JSON wrapper, no preamble, no closing remarks. Begin directly with the first ## heading you have been assigned. Another stage will assemble the full report and produce the metadata."""


# ── Section group definitions for multi-call synthesis ──────────────────────
# Each group is one separate API call. The model writes only the listed
# sections in that call, with full narrative depth. Outputs are concatenated.

SECTION_GROUPS: list[dict] = [
    {
        "name": "front_matter",
        "title": "Front matter, scope, and property identification",
        "sections": """## 1. Report Identification
## 2. Executive Summary (write at least 600 words — synthesize the entire report's key findings, value conclusion, key risks, and recommendation. The reader should be able to make a decision from this section alone.)
## 3. Scope of Work, Intended Use, Intended Users, Effective Date, Report Date
## 4. Property Identification and Interest Appraised
## 5. Ownership and Transaction History
## 6. Site Description (lot, frontage, topography, access, services, easements, environmental notes — at least 800 words)
## 7. Improvements / Building Description (year built, gross/net area, configuration, condition, mechanical systems, finish quality, deferred maintenance, functional utility, remaining economic life — at least 1000 words)""",
        "min_words": 4000,
    },
    {
        "name": "market_analysis",
        "title": "Market, economic, zoning, and highest and best use",
        "sections": """## 8. Neighborhood and Market Area Analysis (boundaries, history, character, demographics deep-dive with multiple data points, growth trends, amenities, demand drivers — at least 1500 words)
## 9. Macro and Local Economic Analysis (provincial/metro economy, employment, wages, population growth, interest rates, inflation, capital markets context — at least 1000 words)
## 10. Zoning, Planning, and Land-Use Review (exact zoning, permitted uses, density, height, FAR, setbacks, parking, area redevelopment plans, conformity analysis, redevelopment potential — at least 1200 words)
## 11. Assessment and Taxation Overview (current and historical assessed value, mill rate, tax estimate, tax classification, lien/encumbrance notes — at least 500 words)
## 12. Highest and Best Use Analysis (4-test framework: legally permissible, physically possible, financially feasible, maximally productive — applied to BOTH "as if vacant" and "as improved", with explicit conclusion — at least 1200 words)""",
        "min_words": 6000,
    },
    {
        "name": "comparables",
        "title": "Comparable sales, rent comparables, and operating statement",
        "sections": """## 13. Comparable Sales Analysis — present at least 5-8 specific comparables drawn from the research dossier in a markdown adjustment grid. For each comparable, write a short narrative covering: address, sale date, sale price, lot size, building size, configuration, $/unit and $/sqft, distance from subject, condition relative to subject, and the qualitative or quantitative adjustments warranted to reconcile to the subject. After the grid, write a multi-paragraph reconciliation explaining the indicated value range from sales comparison. Total section length: at least 2500 words.
## 14. Comparable Rent / Income Evidence — present at least 6-10 specific rent comparables in a markdown table with address, unit type, bed count, asking rent, $/bed, $/sqft, source, and date. Write a multi-paragraph reconciliation establishing market rent for the subject in each phase of the development plan, with explicit comparison to the subject's modeled rents and any loss-to-lease or rent gap. Total section length: at least 2000 words.
## 15. Operating Statement Normalization — present a full reconstructed operating statement in a markdown table, line by line, for each phase (as-is, post-basement, stabilized post-full-development). Show: GPR, vacancy & collection loss, ancillary income, EGI, every operating expense line item from the deterministic package, total expenses, NOI, expense ratio. Discuss any expenses you would normalize or stabilize differently than the deterministic package and WHY (but do not change the deterministic numbers — just flag for reviewer). At least 1500 words plus the tables.""",
        "min_words": 8000,
    },
    {
        "name": "valuation_approaches",
        "title": "Valuation methodology and the three approaches",
        "sections": """## 16. Valuation Methodology and Assumptions (which approaches were applied and why, key valuation assumptions, growth and discount rate rationale — at least 800 words)
## 17. Sales Comparison Approach — apply the comparables from Section 13 with a quantitative adjustment grid (location, time, size, condition, etc.), derive $/unit and $/sqft indications, reconcile to a value range. At least 1500 words plus the grid.
## 18. Income Capitalization Approach — present the direct capitalization computation in detail. Use the deterministic NOI exactly as provided. Walk through: stabilized NOI, supported cap rate (with reference to research-dossier cap rate evidence and a rationale for the selected rate), gross value, less selling costs, less debt at takeover, equals net proceeds to equity. Show formula. Then run a sensitivity table varying NOI ±10% and cap rate ±50bps. Reconcile to value indication. At least 2000 words plus tables.
## 19. Discounted Cash Flow Approach — present the full multi-year cash flow forecast directly from the deterministic Lifetime Cash Flow (do not modify the numbers). Show year-by-year revenue, expenses, NOI, debt service, construction draws, net cash flow, and cumulative position. State the equity multiple, IRR/annualized ROI, and average cash-on-cash exactly as in the deterministic package. Discuss the reasonableness of the discount rate / IRR achievement relative to the research-dossier cap rate evidence. At least 1500 words plus the cash flow table.
## 20. Cost Approach — apply if relevant. For redevelopment scenarios, discuss replacement cost new less depreciation. Reference the construction budget from the deterministic subject package. At least 600 words.""",
        "min_words": 7000,
    },
    {
        "name": "conclusion",
        "title": "Reconciliation, assumptions, risks, and follow-up",
        "sections": """## 21. Reconciliation and Final Value Conclusion — explain the weight given to each approach, reconcile the indications, and state the final value conclusion as a point estimate AND a defensible range. Cross-check against the deterministic disposition value. At least 1000 words.
## 22. Extraordinary Assumptions and Limiting Conditions — comprehensive list including the AI-assisted nature of the draft, reliance on deterministic math, no site inspection, no certified appraisal status, etc. At least 600 words.
## 23. Key Risks to Value — comprehensive risk register: market risk, lease-up risk, development/entitlement risk, environmental risk, cost overrun risk, financing risk, regulatory risk, tenant credit risk, capital expenditure risk, exit risk. For each, describe the mechanism and the potential impact on value. At least 1200 words.
## 24. Reviewer Follow-Up Items — itemized checklist of every fact, assumption, or computation a human reviewer must validate before this draft can be relied upon. At least 500 words.
## 25. Appendices and Source Log — reproduce the FULL source log from the research dossier with the inline citation IDs preserved. List internal documents referenced. At least 300 words plus the table.""",
        "min_words": 4000,
    },
]


METADATA_SYSTEM_PROMPT = """You are a metadata extractor. Read the assembled valuation report draft below and extract a compact structured metadata package. Return ONLY valid JSON with this exact shape:

{
  "evidence_sufficiency": "strong|moderate|weak",
  "missing_evidence": ["..."],
  "reviewer_flags": ["..."],
  "value_conclusion_low": <number or null>,
  "value_conclusion_point": <number or null>,
  "value_conclusion_high": <number or null>,
  "value_conclusion_basis": "income_cap|sales_comparison|dcf|cost|reconciled",
  "extraordinary_assumptions": ["..."],
  "key_risks": ["..."],
  "source_log": [{"id": "S1", "title": "...", "url": "...", "type": "internal|public_web|registry|brokerage|other"}]
}"""


def run_private_synthesis(
    job: ValuationReportJob,
    subject_package: dict,
    research_dossier: str,
) -> tuple[str, str, dict]:
    """Run the synthesis pass via multi-section assembly.

    Each section group is a separate API call so we bypass single-call output
    token limits and can produce a true 80+ page narrative report. After all
    section groups are written, we make one final small call to extract
    structured metadata from the assembled draft.

    Returns (last_response_id, assembled_markdown_report, metadata_dict).
    """
    if MOCK_MODE:
        addr = subject_package["subject"]["address"]
        mock_sections = []
        for grp in SECTION_GROUPS:
            mock_sections.append(
                f"# {grp['title']}\n\n_Mock content for group `{grp['name']}`._\n\n"
                + grp["sections"]
            )
        mock_md = (
            f"# Management Appraisal Report — DRAFT (MOCK) — {addr}\n\n"
            "> AI-assisted draft. Not a licensed/certified appraisal. For internal management use only.\n\n"
            "**Evidence sufficiency:** weak (mock mode)\n\n"
            + "\n\n---\n\n".join(mock_sections)
        )
        mock_meta = {
            "evidence_sufficiency": "weak",
            "missing_evidence": ["mock mode active"],
            "reviewer_flags": ["full review required"],
            "value_conclusion_low": None,
            "value_conclusion_point": None,
            "value_conclusion_high": None,
            "value_conclusion_basis": "reconciled",
            "extraordinary_assumptions": [],
            "key_risks": [],
            "source_log": [],
        }
        return ("mock_synthesis_response", mock_md, mock_meta)

    client = _get_openai_client()

    tools: list[dict] = []
    if job.property_vector_store_id:
        tools.append({
            "type": "file_search",
            "vector_store_ids": [job.property_vector_store_id],
        })

    # Common context that every section-group call sees
    deterministic_block = (
        "DETERMINISTIC SUBJECT PACKAGE (source of truth — quote numbers verbatim, "
        "do not substitute):\n```json\n"
        + json.dumps(subject_package, indent=2, default=str)
        + "\n```"
    )
    research_block = "PUBLIC RESEARCH DOSSIER (cite inline using [S#] from its source log):\n\n" + research_dossier

    def _call_section_group(group: dict, prior_outline: str) -> tuple[str, str]:
        """Call the model for one section group. Returns (response_id, markdown)."""
        user_input = (
            f"{deterministic_block}\n\n{research_block}\n\n"
            f"PRIOR SECTIONS OUTLINE (for continuity — do not duplicate):\n{prior_outline}\n\n"
            f"YOUR ASSIGNED SECTIONS for this call ({group['title']}):\n\n{group['sections']}\n\n"
            f"Write ONLY these sections. Use the section numbering exactly as listed. "
            f"Aim for at least {group['min_words']} words of substantive professional narrative across these sections combined. "
            f"Begin your response directly with the first ## heading. Do not include preamble."
        )

        def _call(model_name: str):
            kwargs: dict = {
                "model": model_name,
                "input": [
                    {"role": "system", "content": SYNTHESIS_BASE_INSTRUCTIONS},
                    {"role": "user", "content": user_input},
                ],
                "max_output_tokens": 16000,
            }
            if tools:
                kwargs["tools"] = tools
            return client.responses.create(**kwargs)

        try:
            resp = _call(SYNTHESIS_MODEL)
        except Exception as primary_err:
            logger.warning(
                "Primary synthesis model %s failed on group %s: %s — falling back to %s",
                SYNTHESIS_MODEL, group["name"], primary_err, SYNTHESIS_MODEL_FALLBACK,
            )
            resp = _call(SYNTHESIS_MODEL_FALLBACK)

        return (resp.id, resp.output_text or "")

    # Walk each section group sequentially, building up the assembled report
    assembled_parts: list[str] = []
    last_response_id = ""
    prior_outline_lines: list[str] = []

    for i, group in enumerate(SECTION_GROUPS, start=1):
        logger.info("Synthesis group %d/%d: %s", i, len(SECTION_GROUPS), group["name"])
        prior_outline = "\n".join(prior_outline_lines) if prior_outline_lines else "(none — this is the first group)"
        rid, section_md = _call_section_group(group, prior_outline)
        last_response_id = rid
        if section_md.strip():
            assembled_parts.append(section_md.strip())
            # Update outline with this group's section headers for continuity
            for ln in section_md.splitlines():
                if ln.startswith("## "):
                    prior_outline_lines.append(ln.strip())

    # Front-matter heading
    addr = subject_package["subject"].get("address") or f"Property {subject_package['subject'].get('property_id')}"
    title_block = (
        f"# Management Appraisal Report — {addr}\n"
        f"### AI-assisted Draft — Internal Management Use Only\n"
        f"_Effective Date: {subject_package.get('effective_date')}_\n\n"
        "> ⚠ This is an AI-assisted internal draft. It is NOT a licensed, certified, USPAP-compliant, "
        "or AIC-compliant appraisal. All deterministic valuation math has been preserved verbatim from the "
        "subject package. A qualified human reviewer must validate every fact, assumption, and computation "
        "before any conclusion is acted upon.\n\n---\n\n"
    )
    assembled_markdown = title_block + "\n\n".join(assembled_parts)

    # Final pass: extract metadata from the assembled draft
    metadata: dict = {}
    try:
        meta_resp = client.responses.create(
            model=SYNTHESIS_MODEL_FALLBACK,
            input=[
                {"role": "system", "content": METADATA_SYSTEM_PROMPT},
                {"role": "user", "content": assembled_markdown[:60000]},
            ],
            text={"format": {"type": "json_object"}},
            max_output_tokens=4000,
        )
        try:
            metadata = json.loads(meta_resp.output_text or "{}")
        except json.JSONDecodeError:
            metadata = {"parse_error": True, "raw": (meta_resp.output_text or "")[:2000]}
    except Exception as e:
        logger.warning("Metadata extraction failed: %s", e)
        metadata = {"extraction_error": str(e)}

    return (last_response_id, assembled_markdown, metadata)


# ── Stage 4: PDF rendering ───────────────────────────────────────────────────

REPORT_CSS = """
@page {
    size: letter;
    margin: 0.85in 0.75in 1.0in 0.75in;
    @frame footer {
        -pdf-frame-content: footerContent;
        left: 0.75in;
        right: 0.75in;
        bottom: 0.4in;
        height: 0.4in;
    }
    @frame header {
        -pdf-frame-content: headerContent;
        left: 0.75in;
        right: 0.75in;
        top: 0.35in;
        height: 0.35in;
    }
}
body {
    font-family: "Helvetica", "Arial", sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #1f2937;
}
.cover {
    background-color: #1f2937;
    color: #ffffff;
    padding: 0;
    page-break-after: always;
}
.cover-band {
    background-color: #ef4444;
    height: 0.45in;
    width: 100%;
}
.cover-inner {
    padding: 1.0in 1.0in 0 1.0in;
}
.cover-eyebrow {
    font-size: 11pt;
    color: #fca5a5;
    text-transform: uppercase;
    letter-spacing: 2pt;
    margin: 0 0 18pt 0;
}
.cover-title {
    font-size: 32pt;
    font-weight: bold;
    line-height: 1.1;
    color: #ffffff;
    margin: 0 0 8pt 0;
}
.cover-subtitle {
    font-size: 14pt;
    color: #d1d5db;
    margin: 0 0 60pt 0;
}
.cover-meta {
    border-top: 1pt solid #4b5563;
    padding-top: 16pt;
    margin-top: 30pt;
}
.cover-meta-row {
    margin: 0 0 6pt 0;
    font-size: 10pt;
    color: #d1d5db;
}
.cover-meta-row b {
    color: #ffffff;
    display: inline-block;
    width: 1.6in;
}
.cover-warning {
    background-color: #7f1d1d;
    border-left: 4pt solid #ef4444;
    padding: 12pt;
    margin-top: 50pt;
    color: #fee2e2;
    font-size: 9pt;
    line-height: 1.4;
}
.cover-footer {
    position: absolute;
    bottom: 0.5in;
    left: 1.0in;
    right: 1.0in;
    color: #9ca3af;
    font-size: 8pt;
    border-top: 1pt solid #4b5563;
    padding-top: 10pt;
}

/* Page header / footer */
.header {
    border-bottom: 0.5pt solid #d1d5db;
    padding-bottom: 4pt;
    color: #6b7280;
    font-size: 8pt;
}
.header-left {
    width: 70%;
    text-align: left;
}
.header-right {
    width: 30%;
    text-align: right;
}
.footer {
    border-top: 0.5pt solid #d1d5db;
    padding-top: 4pt;
    color: #9ca3af;
    font-size: 8pt;
    text-align: center;
}

/* Headings */
h1 {
    font-size: 18pt;
    color: #111827;
    border-bottom: 2pt solid #ef4444;
    padding-bottom: 6pt;
    margin: 24pt 0 12pt 0;
    -pdf-keep-with-next: true;
}
h2 {
    font-size: 14pt;
    color: #1f2937;
    margin: 18pt 0 8pt 0;
    -pdf-keep-with-next: true;
    border-left: 4pt solid #ef4444;
    padding-left: 10pt;
}
h3 {
    font-size: 11pt;
    color: #374151;
    margin: 12pt 0 6pt 0;
    -pdf-keep-with-next: true;
}
h4 {
    font-size: 10pt;
    color: #4b5563;
    margin: 10pt 0 4pt 0;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    -pdf-keep-with-next: true;
}

p {
    margin: 0 0 8pt 0;
    text-align: justify;
}
strong, b {
    color: #111827;
}
em, i {
    color: #4b5563;
}
ul, ol {
    margin: 4pt 0 10pt 18pt;
}
li {
    margin: 0 0 3pt 0;
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0 12pt 0;
    font-size: 9pt;
}
th {
    background-color: #1f2937;
    color: #ffffff;
    padding: 6pt 8pt;
    text-align: left;
    font-weight: bold;
    border: 0.5pt solid #1f2937;
}
td {
    padding: 5pt 8pt;
    border: 0.5pt solid #d1d5db;
    vertical-align: top;
}
tr:nth-child(even) td {
    background-color: #f9fafb;
}

/* Callouts */
.callout {
    background-color: #fef3c7;
    border-left: 4pt solid #f59e0b;
    padding: 10pt 14pt;
    margin: 12pt 0;
    font-size: 9.5pt;
}
.callout-warning {
    background-color: #fee2e2;
    border-left-color: #ef4444;
}
.callout-info {
    background-color: #dbeafe;
    border-left-color: #3b82f6;
}

/* TOC */
.toc {
    page-break-after: always;
}
.toc h1 {
    border-bottom: 2pt solid #ef4444;
}
.toc-item {
    margin: 4pt 0;
    font-size: 10pt;
}
.toc-item b { color: #1f2937; }

hr {
    border: none;
    border-top: 0.5pt solid #d1d5db;
    margin: 14pt 0;
}

code {
    background-color: #f3f4f6;
    padding: 1pt 4pt;
    font-family: "Courier", monospace;
    font-size: 9pt;
}
"""


def _build_cover_page(title: str, subject: dict, effective_date: str) -> str:
    """Build the cover-page HTML block."""
    addr = subject.get("address") or "Subject Property"
    city = subject.get("city") or ""
    province = subject.get("province") or ""
    postal = subject.get("postal_code") or ""
    location_line = ", ".join(p for p in [city, province, postal] if p)

    return f"""
    <div class="cover">
      <div class="cover-band"></div>
      <div class="cover-inner">
        <p class="cover-eyebrow">Management Appraisal Report</p>
        <p class="cover-title">{addr}</p>
        <p class="cover-subtitle">{location_line}</p>

        <div class="cover-meta">
          <p class="cover-meta-row"><b>Effective Date</b>{effective_date}</p>
          <p class="cover-meta-row"><b>Report Type</b>AI-Assisted Internal Draft</p>
          <p class="cover-meta-row"><b>Prepared For</b>Living Well Communities GP/LP</p>
          <p class="cover-meta-row"><b>Property ID</b>{subject.get("property_id", "")}</p>
          <p class="cover-meta-row"><b>Year Built</b>{subject.get("year_built") or "—"}</p>
          <p class="cover-meta-row"><b>Lot Size</b>{f"{int(subject.get('lot_size'))} sq ft" if subject.get("lot_size") else "—"}</p>
        </div>

        <div class="cover-warning">
          <b>NOT A CERTIFIED APPRAISAL.</b> This is an AI-assisted internal management
          draft prepared for portfolio decision-making. It is not USPAP-compliant or
          AIC-compliant and may not be relied upon by lenders, courts, or regulators.
          A qualified human appraiser must validate every fact, assumption, and
          computation before any external use.
        </div>
      </div>

      <div class="cover-footer">
        Living Well Communities &middot; Generated by AI synthesis pipeline &middot; {effective_date}
      </div>
    </div>
    """


def _build_toc(markdown_text: str) -> str:
    """Build a simple table of contents from h1/h2 headings in the markdown."""
    import re as _re
    items: list[str] = []
    for line in markdown_text.splitlines():
        m = _re.match(r"^(#{1,2})\s+(.+)$", line)
        if not m:
            continue
        level = len(m.group(1))
        title = m.group(2).strip()
        # Skip the document title (first H1) — it's already on the cover
        if level == 1 and "Management Appraisal Report" in title:
            continue
        indent = "&nbsp;&nbsp;&nbsp;&nbsp;" * (level - 1)
        items.append(f'<p class="toc-item">{indent}<b>{title}</b></p>')

    if not items:
        return ""

    return (
        '<div class="toc">'
        '<h1>Table of Contents</h1>'
        + "".join(items)
        + "</div>"
    )


def _markdown_to_html(md_text: str) -> str:
    """Convert markdown to HTML using python-markdown with table & extra extensions."""
    import markdown as md_lib
    return md_lib.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists", "nl2br"],
    )


def render_pdf(markdown_text: str, out_path: Path, title: str,
               subject: dict | None = None, effective_date: str = "") -> None:
    """Render the markdown report to a styled, paginated PDF.

    Uses xhtml2pdf so we get real table rendering, headers/footers, page numbers,
    and a cover page — appraisal-report-grade output instead of plain paragraphs.
    """
    from xhtml2pdf import pisa
    import re as _re

    subject = subject or {}

    # Strip the title H1 from the body since the cover page handles it.
    body_md = _re.sub(
        r"^#\s+Management Appraisal Report.*?\n",
        "",
        markdown_text,
        count=1,
        flags=_re.MULTILINE,
    )

    cover_html = _build_cover_page(title, subject, effective_date)
    toc_html = _build_toc(body_md)
    body_html = _markdown_to_html(body_md)

    # Header / footer content (xhtml2pdf reads these from named frames)
    addr = subject.get("address") or "Subject Property"
    header_html = (
        '<div class="header"><table><tr>'
        f'<td class="header-left">{addr} &middot; Management Appraisal Report (Draft)</td>'
        f'<td class="header-right">{effective_date}</td>'
        "</tr></table></div>"
    )
    footer_html = (
        '<div class="footer">'
        'Living Well Communities &middot; Internal Draft &middot; '
        'Page <pdf:pagenumber/> of <pdf:pagecount/>'
        "</div>"
    )

    full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>{title}</title>
    <style>{REPORT_CSS}</style>
</head>
<body>
    <div id="headerContent">{header_html}</div>
    <div id="footerContent">{footer_html}</div>

    {cover_html}

    {toc_html}

    {body_html}
</body>
</html>"""

    with open(out_path, "wb") as fh:
        result = pisa.CreatePDF(src=full_html, dest=fh, encoding="utf-8")
        if result.err:
            logger.warning("xhtml2pdf reported %d errors while rendering", result.err)


# ── Stage 5: email delivery ──────────────────────────────────────────────────

def email_report(to_email: str, property_name: str, pdf_path: Path) -> tuple[bool, str | None]:
    """Email the rendered PDF as an attachment via Resend.

    Returns (success, error_message). On failure, the error message is
    surfaced so the orchestrator can record WHY the email step skipped
    instead of leaving delivered_at silently NULL.
    """
    try:
        from app.services.email import _get_resend_config
        api_key, from_email = _get_resend_config()
        if not api_key:
            msg = "Resend API key not configured (set RESEND_API_KEY in Settings)"
            logger.warning(msg)
            return (False, msg)
        try:
            import resend
        except ImportError:
            msg = "resend package not installed in this environment"
            logger.error(msg)
            return (False, msg)
        import base64
        resend.api_key = api_key

        pdf_bytes = pdf_path.read_bytes()
        attachment_b64 = base64.b64encode(pdf_bytes).decode("ascii")

        params = {
            "from": from_email,
            "to": [to_email],
            "subject": f"Management Appraisal Report — {property_name}",
            "html": f"""
                <p>Hi,</p>
                <p>The AI-assisted Management Appraisal draft for <strong>{property_name}</strong> is attached.</p>
                <p><em>This is an internal draft only — not a licensed or certified appraisal.
                Please review carefully before acting on any conclusions.</em></p>
                <p>— Living Well Communities</p>
            """,
            "attachments": [
                {
                    "filename": pdf_path.name,
                    "content": attachment_b64,
                }
            ],
        }
        resend.Emails.send(params)
        return (True, None)
    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        logger.exception("Failed to email report")
        return (False, msg)


# ── Orchestrator ─────────────────────────────────────────────────────────────

def _set_status(db: Session, job: ValuationReportJob, status: str, error: str | None = None) -> None:
    job.status = status
    if error:
        job.error = error
    job.updated_at = datetime.utcnow()
    db.commit()


def run_job(job_id: int) -> None:
    """Top-level orchestrator. Runs in a background thread with its own DB session."""
    db = SessionLocal()
    try:
        job = db.query(ValuationReportJob).filter(ValuationReportJob.id == job_id).first()
        if not job:
            logger.error("Job %s not found", job_id)
            return

        prop = db.query(Property).filter(Property.property_id == job.property_id).first()
        prop_label = prop.address if prop else f"Property {job.property_id}"

        job_dir = ARTIFACT_ROOT / f"job-{job_id}"
        job_dir.mkdir(parents=True, exist_ok=True)

        # Stage 0: subject package
        _set_status(db, job, "building_subject")
        subject_package = build_subject_package(db, job.property_id, job.effective_date)
        subj_path = job_dir / "subject_package.json"
        subj_path.write_text(json.dumps(subject_package, indent=2, default=str), encoding="utf-8")
        job.subject_package_path = str(subj_path)
        db.commit()

        # Stage 1: vector store sync
        _set_status(db, job, "syncing_files")
        try:
            vs_id = sync_property_vector_store(db, job)
            job.property_vector_store_id = vs_id
            db.commit()
        except Exception as e:
            logger.warning("Vector store sync failed (continuing without): %s", e)

        # Stage 2: public research
        _set_status(db, job, "researching")
        research_id, research_text = run_public_research(job, subject_package)
        job.public_research_response_id = research_id
        research_path = job_dir / "research_dossier.md"
        research_path.write_text(research_text, encoding="utf-8")
        job.research_artifact_path = str(research_path)
        db.commit()

        # Stage 3: private synthesis
        _set_status(db, job, "synthesizing")
        synth_id, report_md, metadata = run_private_synthesis(job, subject_package, research_text)
        job.synthesis_response_id = synth_id
        synth_md_path = job_dir / "synthesis_report.md"
        synth_md_path.write_text(report_md, encoding="utf-8")
        job.synthesis_markdown_path = str(synth_md_path)

        meta_path = job_dir / "metadata.json"
        meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        db.commit()

        # Stage 4: PDF render
        _set_status(db, job, "rendering")
        pdf_path = job_dir / f"valuation_report_v{job.draft_version}.pdf"
        render_pdf(
            report_md,
            pdf_path,
            title=f"Management Appraisal Report — {prop_label}",
            subject=subject_package.get("subject", {}),
            effective_date=str(job.effective_date or subject_package.get("effective_date") or ""),
        )
        job.report_artifact_path = str(pdf_path)

        # Source log file (extract from metadata if present)
        source_log = metadata.get("source_log", []) if isinstance(metadata, dict) else []
        if source_log:
            log_path = job_dir / "source_log.json"
            log_path.write_text(json.dumps(source_log, indent=2), encoding="utf-8")
            job.source_log_path = str(log_path)
        db.commit()

        # Stage 5: email
        if job.deliver_to_email:
            _set_status(db, job, "emailing")
            ok, err = email_report(job.deliver_to_email, prop_label, pdf_path)
            if ok:
                job.delivered_at = datetime.utcnow()
                db.commit()
            else:
                # Surface the failure on the job record so the UI shows WHY
                # the email step skipped (instead of leaving delivered_at NULL
                # with no explanation)
                existing_err = job.error or ""
                job.error = (existing_err + "\n" if existing_err else "") + f"Email delivery failed: {err}"
                db.commit()
                logger.warning("Job %s rendered but email delivery failed: %s", job_id, err)

        _set_status(db, job, "completed")
        logger.info("Valuation report job %s completed", job_id)

    except Exception as e:
        logger.exception("Valuation report job %s failed", job_id)
        try:
            job = db.query(ValuationReportJob).filter(ValuationReportJob.id == job_id).first()
            if job:
                _set_status(db, job, "failed", error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}")
        except Exception:
            pass
    finally:
        db.close()


def start_job_in_background(job_id: int) -> None:
    """Spawn the orchestrator in a daemon thread."""
    t = threading.Thread(target=run_job, args=(job_id,), daemon=True, name=f"valuation-job-{job_id}")
    t.start()
