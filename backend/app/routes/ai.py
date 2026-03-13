from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, Property, DebtFacility
from app.core.deps import get_current_user, require_gp_or_ops
from app.schemas.ai import (
    PropertyDefaultsRequest, PropertyDefaultsResponse,
    RiskAnalysisRequest, RiskAnalysisResponse
)
from app.services.ai import suggest_property_defaults, analyze_property_risk
from app.services.calculations import calculate_noi

router = APIRouter()

@router.post("/suggest-defaults", response_model=PropertyDefaultsResponse)
def get_property_defaults(
    payload: PropertyDefaultsRequest,
    current_user: User = Depends(require_gp_or_ops),
):
    """Get AI-suggested defaults for a new property."""
    result = suggest_property_defaults(
        address=payload.address,
        zoning=payload.zoning,
        city=payload.city
    )
    return result

@router.post("/analyze-risk", response_model=RiskAnalysisResponse)
def get_risk_analysis(
    payload: RiskAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Perform AI risk analysis on an existing property."""
    prop = db.query(Property).filter(Property.property_id == payload.property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Gather debt info
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == prop.property_id,
        DebtFacility.status == "active"
    ).all()
    total_debt = sum(float(d.outstanding_balance or 0) for d in debts)

    # Estimate NOI from development plans (rough estimate for AI context)
    estimated_noi = None
    active_plans = [p for p in prop.development_plans if p.status.value in ("active", "approved")]
    if active_plans:
        plan = active_plans[0]
        if plan.projected_annual_noi:
            estimated_noi = float(plan.projected_annual_noi)
        elif plan.planned_units and plan.planned_units > 0:
            # Fallback: assume $1500/mo per unit, 30% expense ratio
            gross_rev = plan.planned_units * 1500 * 12
            noi_dict = calculate_noi(gross_potential_revenue=gross_rev, operating_expenses=gross_rev * 0.3)
            estimated_noi = noi_dict["noi"]

    result = analyze_property_risk(
        address=prop.address,
        purchase_price=float(prop.purchase_price or 0),
        zoning=prop.zoning or "Unknown",
        development_stage=prop.development_stage.value if prop.development_stage else "Unknown",
        noi=estimated_noi,
        debt_balance=total_debt if total_debt > 0 else None
    )
    
    return result
