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
