"""
AI Routes — Claude-Powered Intelligence Endpoints
===================================================
Provides property analysis, underwriting, report generation,
anomaly detection, and conversational AI with full platform context.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User, Property, DebtFacility, LPEntity, Community,
    DevelopmentPlan, Bed, Unit, Subscription, Holding,
)
from app.core.deps import get_current_user, require_gp_or_ops, require_investor_or_above
from app.schemas.ai import (
    PropertyDefaultsRequest, PropertyDefaultsResponse,
    RiskAnalysisRequest, RiskAnalysisResponse,
)
from app.services.ai import (
    suggest_property_defaults, analyze_property_risk,
    analyze_underwriting, generate_report_narrative,
    detect_anomalies, chat_with_context,
    research_funding_opportunities,
    research_property_area,
    generate_staffing_schedule,
    compare_scenarios,
    predict_occupancy_risk,
    generate_executive_briefing,
    suggest_arrears_strategy,
    advise_distribution_timing,
    validate_rent_roll,
)

router = APIRouter()


# ── Helpers: Gather Rich Context ──────────────────────────────────────────

def _get_property_context(db: Session, property_id: int) -> dict:
    """Gather full property context for AI analysis."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        return {}

    # Debt
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == property_id,
    ).all()
    debt_list = [{
        "lender": d.lender_name,
        "type": d.debt_type.value if d.debt_type else None,
        "status": d.status.value if d.status else None,
        "balance": float(d.outstanding_balance or 0),
        "rate": float(d.interest_rate or 0),
        "amort_months": d.amortization_months,
    } for d in debts]
    total_debt = sum(d["balance"] for d in debt_list)

    # Rent roll
    units = db.query(Unit).filter(Unit.property_id == property_id).all()
    beds = []
    for u in units:
        for b in u.beds:
            beds.append({
                "unit": u.unit_number,
                "bed": b.bed_label,
                "rent": float(b.monthly_rent or 0),
                "status": b.status.value if b.status else "unknown",
            })
    monthly_rent = sum(b["rent"] for b in beds)

    # Dev plan
    plan = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.property_id == property_id
    ).order_by(DevelopmentPlan.plan_id.desc()).first()
    plan_data = None
    if plan:
        plan_data = {
            "planned_units": plan.planned_units,
            "planned_beds": plan.planned_beds,
            "planned_sqft": float(plan.planned_sqft or 0),
            "estimated_cost": float(plan.estimated_construction_cost or 0),
            "projected_noi": float(plan.projected_annual_noi or 0),
        }

    # Occupancy summary
    occupied = sum(1 for b in beds if b["status"] == "occupied")
    total_beds = len(beds)

    return {
        "property_id": prop.property_id,
        "address": prop.address,
        "city": prop.city,
        "purchase_price": float(prop.purchase_price or 0),
        "current_value": float(prop.current_market_value or prop.assessed_value or prop.purchase_price or 0),
        "zoning": prop.zoning,
        "development_stage": prop.development_stage.value if prop.development_stage else None,
        "lp_name": prop.lp.name if prop.lp else None,
        "total_beds": total_beds,
        "occupied_beds": occupied,
        "occupancy_rate": round(occupied / total_beds * 100, 1) if total_beds > 0 else 0,
        "monthly_rent": monthly_rent,
        "annual_rent": monthly_rent * 12,
        "total_debt": total_debt,
        "ltv": round(total_debt / float(prop.purchase_price) * 100, 1) if prop.purchase_price and float(prop.purchase_price) > 0 else None,
        "debt_facilities": debt_list,
        "development_plan": plan_data,
        # Physical details
        "year_built": prop.year_built,
        "property_type": prop.property_type,
        "building_sqft": float(prop.building_sqft) if prop.building_sqft else None,
        "bedrooms": prop.bedrooms,
        "bathrooms": prop.bathrooms,
        "property_style": prop.property_style,
        # Location & municipal
        "neighbourhood": prop.neighbourhood,
        "ward": prop.ward,
        "latitude": float(prop.latitude) if prop.latitude else None,
        "longitude": float(prop.longitude) if prop.longitude else None,
        "assessment_class": prop.assessment_class,
        # Tax & market
        "tax_amount": float(prop.tax_amount) if prop.tax_amount else None,
        "tax_year": prop.tax_year,
        "mls_number": prop.mls_number,
        "list_price": float(prop.list_price) if prop.list_price else None,
        "last_sold_price": float(prop.last_sold_price) if prop.last_sold_price else None,
        "last_sold_date": str(prop.last_sold_date) if prop.last_sold_date else None,
    }


def _get_lp_context(db: Session, lp_id: int) -> dict:
    """Gather LP-level context for AI."""
    from app.services.investment_service import compute_lp_summary, compute_lp_nav

    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        return {}

    summary = compute_lp_summary(db, lp_id)
    nav_data = compute_lp_nav(db, lp_id)

    return {
        "lp_id": lp.lp_id,
        "name": lp.name,
        "status": lp.status.value if lp.status else "draft",
        "target_raise": float(lp.target_raise or 0),
        "total_funded": float(summary.get("total_funded", 0)),
        "capital_deployed": float(summary.get("capital_deployed", 0)),
        "capital_available": float(summary.get("capital_available", 0)),
        "property_count": summary.get("property_count", 0),
        "investor_count": summary.get("investor_count", 0),
        "nav": float(nav_data.get("nav", 0)) if "nav" in nav_data else None,
        "nav_per_unit": float(nav_data.get("nav_per_unit", 0)) if "nav_per_unit" in nav_data else None,
        "preferred_return": float(lp.preferred_return_rate or 0),
        "gp_promote": float(lp.gp_promote_percent or 0),
    }


def _get_portfolio_context(db: Session) -> str:
    """Build a concise platform-wide context string for the chat assistant."""
    from app.services.investment_service import compute_lp_summary

    lps = db.query(LPEntity).all()
    props = db.query(Property).all()
    comms = db.query(Community).all()

    lines = [f"Platform: {len(lps)} LP funds, {len(props)} properties, {len(comms)} communities\n"]

    for lp in lps:
        s = compute_lp_summary(db, lp.lp_id)
        lines.append(
            f"- {lp.name} ({lp.status.value}): "
            f"${float(s.get('total_funded', 0)):,.0f} funded, "
            f"{s.get('property_count', 0)} properties, "
            f"{s.get('investor_count', 0)} investors"
        )

    lines.append("")
    for p in props[:10]:  # cap at 10
        lines.append(f"- {p.address}, {p.city}: stage={p.development_stage.value}, price=${float(p.purchase_price or 0):,.0f}")

    return "\n".join(lines)


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/suggest-defaults", response_model=PropertyDefaultsResponse)
def get_property_defaults(
    payload: PropertyDefaultsRequest,
    current_user: User = Depends(require_gp_or_ops),
):
    """Get AI-suggested defaults for a new property."""
    return suggest_property_defaults(
        address=payload.address,
        zoning=payload.zoning,
        city=payload.city,
    )


@router.post("/analyze-risk", response_model=RiskAnalysisResponse)
def get_risk_analysis(
    payload: RiskAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Comprehensive AI risk analysis with full property context."""
    ctx = _get_property_context(db, payload.property_id)
    if not ctx:
        raise HTTPException(404, "Property not found")

    result = analyze_property_risk(
        address=ctx["address"],
        purchase_price=ctx["purchase_price"],
        zoning=ctx.get("zoning", "Unknown"),
        development_stage=ctx.get("development_stage", "Unknown"),
        noi=ctx.get("annual_rent"),
        debt_balance=ctx.get("total_debt"),
        rent_roll_summary={
            "total_beds": ctx["total_beds"],
            "occupied": ctx["occupied_beds"],
            "occupancy_rate": ctx["occupancy_rate"],
            "monthly_rent": ctx["monthly_rent"],
        },
        debt_facilities=ctx.get("debt_facilities"),
        development_plan=ctx.get("development_plan"),
        property_details={
            "year_built": ctx.get("year_built"),
            "property_type": ctx.get("property_type"),
            "building_sqft": ctx.get("building_sqft"),
            "neighbourhood": ctx.get("neighbourhood"),
            "assessment_class": ctx.get("assessment_class"),
            "bedrooms": ctx.get("bedrooms"),
            "property_style": ctx.get("property_style"),
            "tax_amount": ctx.get("tax_amount"),
        },
    )
    return result


class UnderwritingRequest(BaseModel):
    property_id: int
    lp_id: Optional[int] = None


@router.post("/underwrite")
def get_underwriting_analysis(
    payload: UnderwritingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Full AI-powered acquisition underwriting memo."""
    prop_ctx = _get_property_context(db, payload.property_id)
    if not prop_ctx:
        raise HTTPException(404, "Property not found")

    lp_ctx = None
    if payload.lp_id:
        lp_ctx = _get_lp_context(db, payload.lp_id)

    # Gather comparable properties (same city, similar stage)
    prop = db.query(Property).filter(Property.property_id == payload.property_id).first()
    comps = db.query(Property).filter(
        Property.city == prop.city,
        Property.property_id != prop.property_id,
    ).limit(5).all()
    comp_list = [{
        "address": c.address,
        "purchase_price": float(c.purchase_price or 0),
        "stage": c.development_stage.value if c.development_stage else None,
        "value": float(c.current_market_value or c.purchase_price or 0),
    } for c in comps]

    return analyze_underwriting(prop_ctx, lp_ctx, comp_list)


class ReportNarrativeRequest(BaseModel):
    lp_id: int
    period: str  # e.g. "Q1 2026"


@router.post("/generate-report-narrative")
def get_report_narrative(
    payload: ReportNarrativeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Generate quarterly report narrative sections from LP data."""
    lp_ctx = _get_lp_context(db, payload.lp_id)
    if not lp_ctx:
        raise HTTPException(404, "LP not found")

    # Occupancy across LP communities
    props = db.query(Property).filter(Property.lp_id == payload.lp_id).all()
    occ_data = {}
    for p in props:
        if p.community:
            from app.services.operations_service import compute_occupancy
            occ = compute_occupancy(db, p.community_id)
            occ_data[p.community.name] = occ

    # Milestones
    from app.db.models import PropertyMilestone, MilestoneStatus
    milestones = []
    for p in props:
        ms = db.query(PropertyMilestone).filter(
            PropertyMilestone.property_id == p.property_id,
            PropertyMilestone.status == MilestoneStatus.completed,
        ).order_by(PropertyMilestone.actual_date.desc()).limit(3).all()
        for m in ms:
            milestones.append({
                "property": p.address,
                "milestone": m.title,
                "completed": str(m.actual_date) if m.actual_date else None,
            })

    # Trend data
    from app.services.snapshot_service import get_trend
    trend = get_trend(db, "lp", payload.lp_id, 6)

    return generate_report_narrative(
        lp_name=lp_ctx["name"],
        period=payload.period,
        financial_data=lp_ctx,
        occupancy_data=occ_data if occ_data else None,
        milestones=milestones if milestones else None,
        trend_data=trend if trend else None,
    )


class AnomalyRequest(BaseModel):
    entity_type: str  # "community" or "lp"
    entity_id: int
    months: int = 12


@router.post("/detect-anomalies")
def get_anomaly_detection(
    payload: AnomalyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Detect anomalies in trend data using AI."""
    from app.services.snapshot_service import get_trend

    # Get entity name
    if payload.entity_type == "community":
        entity = db.query(Community).filter(Community.community_id == payload.entity_id).first()
        name = entity.name if entity else f"Community #{payload.entity_id}"
    else:
        entity = db.query(LPEntity).filter(LPEntity.lp_id == payload.entity_id).first()
        name = entity.name if entity else f"LP #{payload.entity_id}"

    if not entity:
        raise HTTPException(404, f"{payload.entity_type.title()} not found")

    trend = get_trend(db, payload.entity_type, payload.entity_id, payload.months)
    if not trend:
        return {"anomalies": [], "summary": "No trend data available.", "trends": []}

    return detect_anomalies(trend, name)


class ChatRequest(BaseModel):
    message: str
    conversation_history: list = []
    include_portfolio_context: bool = True


@router.post("/chat")
def ai_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Conversational AI assistant with tool use.

    Claude can call 15+ platform tools to fetch live data — LP summaries,
    property details, occupancy, pro formas, waterfall simulations, trends, etc.
    Ask it anything about the portfolio and it will look up the answer.
    """
    context = None
    if payload.include_portfolio_context:
        context = _get_portfolio_context(db)

    result = chat_with_context(
        user_message=payload.message,
        conversation_history=payload.conversation_history,
        platform_context=context,
        db=db,
    )

    return {
        "response": result["response"],
        "tools_used": result.get("tools_used", []),
        "model": "claude" if result["response"] and "not configured" not in result["response"] else "fallback",
    }


# ── Grant & Funding Research ─────────────────────────────────────────────

class FundingResearchRequest(BaseModel):
    community_type: Optional[str] = None  # RecoverWell, StudyWell, RetireWell
    city: Optional[str] = None
    lp_id: Optional[int] = None  # auto-detect type/city from LP


@router.post("/research-funding")
def research_funding(
    payload: FundingResearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """AI-powered research of government grants and funding programs.

    Searches for relevant Canadian federal, provincial, and municipal
    funding programs based on the community type and location.
    Returns structured opportunities with eligibility and amounts.
    """
    from app.db.models import FundingOpportunity, FundingStatus

    community_type = payload.community_type
    city = payload.city

    # Auto-detect from LP if provided
    if payload.lp_id:
        lp = db.query(LPEntity).filter(LPEntity.lp_id == payload.lp_id).first()
        if lp:
            if not community_type and lp.purpose_type:
                community_type = lp.purpose_type.value
            if not city and lp.city_focus:
                city = lp.city_focus.split(",")[0].strip()

    if not community_type:
        community_type = "RecoverWell"
    if not city:
        city = "Calgary"

    # Count properties and beds for context
    from app.db.models import Property, Bed, Unit
    props = db.query(Property).all()
    property_count = len(props)
    bed_count = 0
    for p in props:
        units = db.query(Unit).filter(Unit.property_id == p.property_id).all()
        for u in units:
            bed_count += db.query(Bed).filter(Bed.unit_id == u.unit_id).count()

    # Get existing programs
    existing = db.query(FundingOpportunity).filter(
        FundingOpportunity.status.in_([FundingStatus.submitted, FundingStatus.awarded])
    ).all()
    current_programs = [f.title for f in existing]

    result = research_funding_opportunities(
        community_type=community_type,
        city=city,
        property_count=property_count,
        bed_count=bed_count,
        current_programs=current_programs if current_programs else None,
    )

    return result


@router.post("/research-funding/save-opportunities")
def save_researched_opportunities(
    opportunities: list[dict],
    operator_id: Optional[int] = None,
    community_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Save AI-researched funding opportunities to the database as drafts."""
    from app.db.models import FundingOpportunity, FundingStatus

    created = []
    for opp in opportunities:
        fo = FundingOpportunity(
            title=opp.get("program_name", "Untitled"),
            funding_source=opp.get("funding_source"),
            amount=None,  # Will be set when applying
            status=FundingStatus.draft,
            operator_id=operator_id,
            community_id=community_id,
            notes=(
                f"AI-researched opportunity.\n"
                f"Type: {opp.get('program_type', 'N/A')}\n"
                f"Estimated: {opp.get('estimated_amount', 'N/A')}\n"
                f"Eligibility: {opp.get('eligibility_summary', 'N/A')}\n"
                f"How to apply: {opp.get('application_notes', 'N/A')}\n"
                f"More info: {opp.get('url_hint', 'N/A')}"
            ),
        )
        db.add(fo)
        db.flush()
        created.append({"funding_id": fo.funding_id, "title": fo.title})

    db.commit()
    return {
        "saved": len(created),
        "opportunities": created,
        "message": f"{len(created)} funding opportunities saved as drafts.",
    }


# ── Investor Communication Drafts ────────────────────────────────────────

from app.services.ai import draft_investor_communication, COMM_TYPES


class InvestorCommRequest(BaseModel):
    investor_id: int
    comm_type: str  # distribution_notice, quarterly_update, welcome_letter, etc.
    lp_id: Optional[int] = None
    distribution_event_id: Optional[int] = None
    additional_context: Optional[str] = None


@router.get("/communication-types")
def list_communication_types(
    _: User = Depends(require_gp_or_ops),
):
    """List available investor communication types."""
    return [
        {"type": k, "label": v["label"], "description": v["description"]}
        for k, v in COMM_TYPES.items()
    ]


@router.post("/draft-investor-communication")
def draft_communication(
    payload: InvestorCommRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Draft a personalized investor communication using AI.

    Gathers the investor's holdings, distributions, and LP data to produce
    a tailored email with subject line and body text.
    """
    from app.db.models import (
        Investor, Holding, DistributionAllocation, DistributionEvent,
        PropertyMilestone, MilestoneStatus,
    )

    inv = db.query(Investor).filter(Investor.investor_id == payload.investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    investor_data = {
        "name": inv.name,
        "email": inv.email,
        "entity_type": inv.entity_type,
        "accredited_status": inv.accredited_status,
    }

    # Holdings
    holdings = db.query(Holding).filter(Holding.investor_id == inv.investor_id).all()
    holdings_data = [{
        "lp_name": h.lp.name if h.lp else None,
        "units_held": float(h.units_held),
        "total_capital": float(h.total_capital_contributed),
        "unreturned_capital": float(h.unreturned_capital),
        "is_gp": h.is_gp,
    } for h in holdings]

    # Distribution data (for distribution_notice type)
    distribution_data = None
    if payload.distribution_event_id:
        event = db.query(DistributionEvent).filter(
            DistributionEvent.event_id == payload.distribution_event_id
        ).first()
        if event:
            # Get this investor's allocations from this event
            holding_ids = [h.holding_id for h in holdings]
            allocs = db.query(DistributionAllocation).filter(
                DistributionAllocation.event_id == event.event_id,
                DistributionAllocation.holding_id.in_(holding_ids),
            ).all()
            total_amount = sum(float(a.amount) for a in allocs)
            distribution_data = {
                "period": event.period_label,
                "total_distributed": float(event.total_distributable),
                "investor_amount": total_amount,
                "status": event.status.value if event.status else "draft",
                "paid_date": str(event.paid_date) if event.paid_date else None,
                "allocations": [{
                    "amount": float(a.amount),
                    "type": a.distribution_type.value if a.distribution_type else "unknown",
                } for a in allocs],
            }

    # LP context
    lp_data = None
    if payload.lp_id:
        lp_data = _get_lp_context(db, payload.lp_id)
    elif holdings:
        # Use the first LP
        lp_data = _get_lp_context(db, holdings[0].lp_id)

    # Recent milestones (for milestone_update and quarterly_update types)
    milestones = None
    if payload.comm_type in ("milestone_update", "quarterly_update"):
        lp_ids = list(set(h.lp_id for h in holdings))
        from app.db.models import Property
        props = db.query(Property).filter(Property.lp_id.in_(lp_ids)).all()
        milestone_list = []
        for p in props:
            ms = db.query(PropertyMilestone).filter(
                PropertyMilestone.property_id == p.property_id,
                PropertyMilestone.status == MilestoneStatus.completed,
            ).order_by(PropertyMilestone.actual_date.desc()).limit(3).all()
            for m in ms:
                milestone_list.append({
                    "property": p.address,
                    "milestone": m.title,
                    "date": str(m.actual_date) if m.actual_date else None,
                })
        if milestone_list:
            milestones = milestone_list

    result = draft_investor_communication(
        comm_type=payload.comm_type,
        investor_data=investor_data,
        holdings_data=holdings_data,
        distribution_data=distribution_data,
        lp_data=lp_data,
        milestones=milestones,
        additional_context=payload.additional_context,
    )

    return result


class BulkCommRequest(BaseModel):
    lp_id: int
    comm_type: str
    distribution_event_id: Optional[int] = None
    additional_context: Optional[str] = None


@router.post("/draft-bulk-communications")
def draft_bulk_communications(
    payload: BulkCommRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Draft communications for ALL investors in an LP fund.

    Returns a list of drafts, one per investor, each personalized with
    their specific holdings and distribution amounts.
    """
    from app.db.models import Investor, Subscription

    lp = db.query(LPEntity).filter(LPEntity.lp_id == payload.lp_id).first()
    if not lp:
        raise HTTPException(404, "LP not found")

    # Get unique investors with subscriptions in this LP
    subs = db.query(Subscription).filter(Subscription.lp_id == payload.lp_id).all()
    investor_ids = list(set(s.investor_id for s in subs))

    drafts = []
    for inv_id in investor_ids:
        req = InvestorCommRequest(
            investor_id=inv_id,
            comm_type=payload.comm_type,
            lp_id=payload.lp_id,
            distribution_event_id=payload.distribution_event_id,
            additional_context=payload.additional_context,
        )
        try:
            result = draft_communication.__wrapped__(req, db, current_user) if hasattr(draft_communication, '__wrapped__') else None
            if not result:
                # Call the function directly with assembled data
                inv = db.query(Investor).filter(Investor.investor_id == inv_id).first()
                result = draft_investor_communication(
                    comm_type=payload.comm_type,
                    investor_data={"name": inv.name, "email": inv.email, "entity_type": inv.entity_type},
                    lp_data=_get_lp_context(db, payload.lp_id),
                    additional_context=payload.additional_context,
                )
            drafts.append({"investor_id": inv_id, "investor_name": inv.name, **result})
        except Exception as e:
            drafts.append({"investor_id": inv_id, "error": str(e)})

    return {
        "lp_id": payload.lp_id,
        "lp_name": lp.name,
        "comm_type": payload.comm_type,
        "drafts_generated": len(drafts),
        "drafts": drafts,
    }


# ── Area Research ────────────────────────────────────────────────────────

class AreaResearchRequest(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    province: str = "Alberta"
    radius_miles: float = 2.0
    property_id: Optional[int] = None  # auto-populate address/city from property
    zoning: Optional[str] = None
    property_type: Optional[str] = None
    additional_context: Optional[str] = None


@router.post("/area-research")
def get_area_research(
    payload: AreaResearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """AI-powered area research for real estate due diligence.

    Provides comprehensive neighbourhood analysis including comparable sales,
    active listings, zoning information, rezoning activity, rental market data,
    demographics, development activity, and redevelopment potential — all within
    a configurable radius of the target property.
    """
    address = payload.address
    city = payload.city
    zoning = payload.zoning

    # Auto-populate from property if property_id provided
    if payload.property_id:
        prop = db.query(Property).filter(Property.property_id == payload.property_id).first()
        if not prop:
            raise HTTPException(404, "Property not found")
        if not address:
            address = prop.address
        if not city:
            city = prop.city
        if not zoning and prop.zoning:
            zoning = prop.zoning

    if not address or not city:
        raise HTTPException(400, "Address and city are required (or provide property_id)")

    return research_property_area(
        address=address,
        city=city,
        province=payload.province,
        radius_miles=payload.radius_miles,
        zoning=zoning,
        property_type=payload.property_type,
        additional_context=payload.additional_context,
    )


# ── Decision Memory ──────────────────────────────────────────────────────

from app.services.decision_memory import log_decision, search_decisions
import datetime as _dt


class LogDecisionRequest(BaseModel):
    category: str
    title: str
    description: str
    property_id: Optional[int] = None
    lp_id: Optional[int] = None
    investor_id: Optional[int] = None
    amount: Optional[float] = None
    outcome: str = "pending"
    outcome_notes: Optional[str] = None
    lessons_learned: Optional[str] = None
    tags: Optional[list[str]] = None


class UpdateDecisionOutcomeRequest(BaseModel):
    outcome: str  # positive, neutral, negative
    outcome_notes: Optional[str] = None
    lessons_learned: Optional[str] = None


@router.post("/decisions", status_code=201)
def create_decision(
    payload: LogDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Log a business decision to institutional memory."""
    d = log_decision(
        db,
        category=payload.category,
        title=payload.title,
        description=payload.description,
        decision_date=_dt.date.today(),
        decision_maker_id=current_user.user_id,
        property_id=payload.property_id,
        lp_id=payload.lp_id,
        investor_id=payload.investor_id,
        amount=payload.amount,
        outcome=payload.outcome,
        outcome_notes=payload.outcome_notes,
        lessons_learned=payload.lessons_learned,
        tags=payload.tags,
    )
    db.commit()
    return {
        "decision_id": d.decision_id,
        "title": d.title,
        "category": d.category.value,
        "message": "Decision logged to institutional memory.",
    }


@router.get("/decisions")
def list_decisions(
    category: Optional[str] = None,
    property_id: Optional[int] = None,
    lp_id: Optional[int] = None,
    city: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Search institutional memory for past decisions."""
    return search_decisions(
        db, category=category, property_id=property_id,
        lp_id=lp_id, city=city, limit=limit,
    )


@router.get("/decisions/{decision_id}")
def get_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Get a single decision with full detail."""
    from app.db.models import DecisionLog
    d = db.query(DecisionLog).filter(DecisionLog.decision_id == decision_id).first()
    if not d:
        raise HTTPException(404, "Decision not found")
    import json
    return {
        "decision_id": d.decision_id,
        "category": d.category.value if d.category else None,
        "title": d.title,
        "description": d.description,
        "decision_date": str(d.decision_date) if d.decision_date else None,
        "amount": float(d.amount) if d.amount else None,
        "outcome": d.outcome.value if d.outcome else "pending",
        "outcome_notes": d.outcome_notes,
        "lessons_learned": d.lessons_learned,
        "tags": d.tags.split(",") if d.tags else [],
        "context_snapshot": json.loads(d.context_snapshot) if d.context_snapshot else None,
        "property_address": d.property.address if d.property else None,
        "lp_name": d.lp.name if d.lp else None,
        "investor_name": d.investor.name if d.investor else None,
        "created_at": str(d.created_at) if d.created_at else None,
    }


@router.patch("/decisions/{decision_id}/outcome")
def update_decision_outcome(
    decision_id: int,
    payload: UpdateDecisionOutcomeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Update the outcome of a past decision — record what actually happened."""
    from app.db.models import DecisionLog, DecisionOutcome
    d = db.query(DecisionLog).filter(DecisionLog.decision_id == decision_id).first()
    if not d:
        raise HTTPException(404, "Decision not found")

    d.outcome = DecisionOutcome(payload.outcome)
    d.outcome_notes = payload.outcome_notes
    d.outcome_date = _dt.date.today()
    if payload.lessons_learned:
        d.lessons_learned = payload.lessons_learned
    db.commit()
    db.refresh(d)

    return {
        "decision_id": d.decision_id,
        "title": d.title,
        "outcome": d.outcome.value,
        "message": "Decision outcome updated.",
    }


# ── AI Staffing Schedule ─────────────────────────────────────────────────

class StaffingScheduleRequest(BaseModel):
    community_id: int
    week_start: str  # YYYY-MM-DD (Monday)
    budget_weekly: float | None = None


@router.post("/generate-staffing-schedule")
def generate_staffing_schedule_endpoint(
    payload: StaffingScheduleRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Generate an AI-optimized weekly staffing schedule."""
    from app.db.models import Staff, Shift, StaffStatus

    community = db.query(Community).filter(Community.community_id == payload.community_id).first()
    if not community:
        raise HTTPException(404, "Community not found")

    # Get active staff
    staff = db.query(Staff).filter(
        Staff.community_id == payload.community_id,
        Staff.status == StaffStatus.active,
    ).all()

    staff_list = [{
        "staff_id": s.staff_id,
        "first_name": s.first_name,
        "last_name": s.last_name,
        "role": s.role.value if s.role else "support_worker",
        "hourly_rate": float(s.hourly_rate) if s.hourly_rate else 20.0,
    } for s in staff]

    # Get occupancy
    from app.services.operations_service import compute_occupancy
    occ = compute_occupancy(db, payload.community_id)
    occupancy_rate = occ.get("occupancy_rate", 0.85) if occ else 0.85

    # Get existing shifts for the week
    import datetime
    try:
        week_start = datetime.datetime.strptime(payload.week_start, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"Invalid date format: {payload.week_start}. Expected YYYY-MM-DD.")
    week_end = week_start + datetime.timedelta(days=6)
    existing_shifts = db.query(Shift).filter(
        Shift.community_id == payload.community_id,
        Shift.shift_date >= week_start,
        Shift.shift_date <= week_end,
    ).all()
    existing = [{
        "staff_id": sh.staff_id,
        "shift_date": str(sh.shift_date),
        "start_time": sh.start_time,
        "end_time": sh.end_time,
        "hours": float(sh.hours) if sh.hours else 0,
    } for sh in existing_shifts]

    return generate_staffing_schedule(
        community_name=community.name,
        community_type=community.community_type.value if community.community_type else "LiveWell",
        occupancy_rate=occupancy_rate,
        staff_list=staff_list,
        week_start=payload.week_start,
        budget_weekly=payload.budget_weekly,
        existing_shifts=existing if existing else None,
    )


# ── Scenario Comparison ──────────────────────────────────────────────────

class ScenarioInput(BaseModel):
    name: str
    vacancy_rate: float = 0.05
    rent_growth: float = 0.03
    expense_growth: float = 0.02
    cap_rate: float = 0.055


class ScenarioComparisonRequest(BaseModel):
    property_id: int
    scenarios: list[ScenarioInput]


@router.post("/compare-scenarios")
def compare_scenarios_endpoint(
    payload: ScenarioComparisonRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Compare multiple pro forma scenarios with AI commentary."""
    prop = db.query(Property).filter(Property.property_id == payload.property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Generate pro formas for each scenario
    from app.services.proforma_service import generate_proforma
    scenario_data = []
    for sc in payload.scenarios:
        proforma = generate_proforma(db, payload.property_id)
        scenario_data.append({
            "name": sc.name,
            "assumptions": sc.model_dump(),
            "proforma": proforma,
        })

    current = {
        "address": prop.address,
        "city": prop.city,
        "purchase_price": float(prop.purchase_price) if prop.purchase_price else None,
        "current_market_value": float(prop.current_market_value) if prop.current_market_value else None,
    }

    return compare_scenarios(
        property_name=f"{prop.address}, {prop.city}",
        scenarios=scenario_data,
        current_financials=current,
    )


# ── Predictive Occupancy Risk ────────────────────────────────────────────

class OccupancyRiskRequest(BaseModel):
    community_id: int


@router.post("/predict-occupancy-risk")
def predict_occupancy_risk_endpoint(
    payload: OccupancyRiskRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Predict occupancy risk for a community."""
    community = db.query(Community).filter(Community.community_id == payload.community_id).first()
    if not community:
        raise HTTPException(404, "Community not found")

    # Get occupancy
    from app.services.operations_service import compute_occupancy
    occ = compute_occupancy(db, payload.community_id)
    occupancy_rate = occ.get("occupancy_rate", 0.85) if occ else 0.85

    # Get trend data
    from app.services.snapshot_service import get_trend
    trend = get_trend(db, "community", payload.community_id, 12)

    # Get arrears for residents in this community
    from app.db.models import ArrearsRecord, Resident
    arrears = db.query(ArrearsRecord).join(Resident).filter(
        Resident.community_id == payload.community_id,
        ArrearsRecord.amount_overdue > 0,
    ).all()
    arrears_data = [{
        "resident_name": a.resident.full_name if a.resident else "Unknown",
        "amount_overdue": float(a.amount_overdue),
        "days_overdue": a.days_overdue,
    } for a in arrears] if arrears else None

    return predict_occupancy_risk(
        community_name=community.name,
        community_type=community.community_type.value if community.community_type else "LiveWell",
        current_occupancy=occupancy_rate,
        trend_data=trend if trend else [],
        arrears_data=arrears_data,
    )


# ── Arrears Collection Strategy ──────────────────────────────────────────

class ArrearsStrategyRequest(BaseModel):
    arrears_id: int


@router.post("/suggest-arrears-strategy")
def suggest_arrears_strategy_endpoint(
    payload: ArrearsStrategyRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Get AI-recommended collection strategy for an arrears case."""
    from app.db.models import ArrearsRecord, Resident

    arrear = db.query(ArrearsRecord).filter(ArrearsRecord.arrears_id == payload.arrears_id).first()
    if not arrear:
        raise HTTPException(404, "Arrears record not found")

    resident = arrear.resident
    community_type = "LiveWell"
    if resident and resident.community:
        community_type = resident.community.community_type.value if resident.community.community_type else "LiveWell"

    # Get arrears history for this resident
    history = []
    if resident:
        past = db.query(ArrearsRecord).filter(
            ArrearsRecord.resident_id == resident.resident_id,
        ).order_by(ArrearsRecord.created_at.desc()).limit(10).all()
        history = [{
            "record_date": str(a.due_date),
            "amount_overdue": float(a.amount_overdue),
            "days_overdue": a.days_overdue,
            "follow_up_action": a.follow_up_action,
        } for a in past]

    return suggest_arrears_strategy(
        resident_name=resident.full_name if resident else "Unknown",
        community_type=community_type,
        days_overdue=arrear.days_overdue or 0,
        amount_overdue=float(arrear.amount_overdue) if arrear.amount_overdue else 0,
        arrears_history=history if history else None,
        current_follow_up=arrear.follow_up_action,
    )


# ── Distribution Timing Advisor ──────────────────────────────────────────

class DistributionAdviceRequest(BaseModel):
    lp_id: int
    proposed_amount: float | None = None


@router.post("/advise-distribution")
def advise_distribution_endpoint(
    payload: DistributionAdviceRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Get AI advice on distribution timing and amount."""
    lp = db.query(LPEntity).filter(LPEntity.lp_id == payload.lp_id).first()
    if not lp:
        raise HTTPException(404, "LP not found")

    lp_ctx = _get_lp_context(db, payload.lp_id)

    # Get waterfall result if proposed amount
    waterfall_result = None
    if payload.proposed_amount:
        from app.services.investment_service import compute_waterfall
        try:
            waterfall_result = compute_waterfall(db, payload.lp_id, payload.proposed_amount)
        except Exception:
            pass

    # Get debt maturities for properties in this LP
    import datetime as _dt2
    lp_property_ids = [p.property_id for p in db.query(Property.property_id).filter(Property.lp_id == payload.lp_id).all()]
    debt_data = None
    if lp_property_ids:
        maturities = db.query(DebtFacility).filter(
            DebtFacility.property_id.in_(lp_property_ids),
            DebtFacility.maturity_date != None,
            DebtFacility.maturity_date <= _dt2.date.today() + _dt2.timedelta(days=365),
        ).all()
        debt_data = [{
            "lender": d.lender_name,
            "balance": float(d.outstanding_balance) if d.outstanding_balance else 0,
            "maturity_date": str(d.maturity_date),
        } for d in maturities] if maturities else None

    return advise_distribution_timing(
        lp_name=lp.name,
        lp_financials=lp_ctx,
        waterfall_result=waterfall_result,
        debt_maturities=debt_data,
        cash_reserves=float(lp_ctx.get("capital_available", 0)),
    )


# ── Rent Roll CSV Validation ────────────────────────────────────────────

class RentRollValidationRequest(BaseModel):
    property_id: int
    csv_rows: list[dict]


@router.post("/validate-rent-roll")
def validate_rent_roll_endpoint(
    payload: RentRollValidationRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Validate rent roll CSV data before import."""
    prop = db.query(Property).filter(Property.property_id == payload.property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Get existing units for comparison
    existing = db.query(Unit).filter(Unit.property_id == payload.property_id).all()
    existing_units = [{
        "unit_number": u.unit_number,
        "bed_count": len(u.beds) if hasattr(u, "beds") else 0,
    } for u in existing] if existing else None

    return validate_rent_roll(
        csv_rows=payload.csv_rows,
        property_address=prop.address,
        city=prop.city,
        existing_units=existing_units,
    )
