"""
Calculation engine endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, Property, DebtFacility
from app.core.deps import get_current_user, require_gp_or_ops
from app.schemas.calculations import (
    NOIInput, NOIResult,
    DSCRInput, DSCRResult,
    LTVInput, LTVResult,
    IRRInput, IRRResult,
    PropertyFinancialSummary,
)
from app.services.calculations import (
    calculate_noi,
    calculate_dscr,
    calculate_ltv,
    calculate_irr,
    calculate_cap_rate,
    calculate_cash_on_cash,
    calculate_annual_debt_service,
)

router = APIRouter()


@router.post("/noi", response_model=NOIResult)
def compute_noi(
    payload: NOIInput,
    current_user: User = Depends(get_current_user),
):
    """Calculate Net Operating Income from revenue and expense inputs."""
    return calculate_noi(**payload.model_dump())


@router.post("/dscr", response_model=DSCRResult)
def compute_dscr(
    payload: DSCRInput,
    current_user: User = Depends(get_current_user),
):
    """Calculate Debt Service Coverage Ratio."""
    return calculate_dscr(**payload.model_dump())


@router.post("/ltv", response_model=LTVResult)
def compute_ltv(
    payload: LTVInput,
    current_user: User = Depends(get_current_user),
):
    """Calculate Loan-to-Value ratio."""
    return calculate_ltv(**payload.model_dump())


@router.post("/irr", response_model=IRRResult)
def compute_irr(
    payload: IRRInput,
    current_user: User = Depends(get_current_user),
):
    """Calculate Internal Rate of Return from a series of cash flows."""
    result = calculate_irr(payload.cash_flows)
    return {
        "irr_decimal": result,
        "irr_percent": round(result * 100, 2) if result is not None else None,
        "cash_flows": payload.cash_flows,
        "message": f"IRR: {result * 100:.2f}%" if result else "IRR did not converge",
    }


@router.get("/property/{property_id}/summary", response_model=PropertyFinancialSummary)
def property_financial_summary(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate financial summary for a property.
    Pulls debt facilities and computes NOI, DSCR, LTV, cap rate.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Aggregate debt
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == property_id,
        DebtFacility.status.in_(["active", "pending"]),
    ).all()

    total_debt_outstanding = sum(float(d.outstanding_balance or 0) for d in debts)
    total_annual_ds = 0.0
    for d in debts:
        if d.outstanding_balance and d.interest_rate:
            ds = calculate_annual_debt_service(
                float(d.outstanding_balance),
                float(d.interest_rate),
                d.amortization_months or 0,
                d.io_period_months or 0,
            )
            total_annual_ds += ds

    # Use property estimated_value if available
    property_value = float(prop.estimated_value) if prop.estimated_value else 0.0
    total_equity = property_value - total_debt_outstanding

    # Compute NOI if we have revenue data (use beds/units to estimate)
    # For now, return a summary shell — NOI requires revenue input
    noi_result = None
    dscr_result = None
    ltv_result = None
    cap_rate = None
    coc = None

    if property_value > 0:
        ltv_result = calculate_ltv(total_debt_outstanding, property_value)

    return PropertyFinancialSummary(
        property_id=property_id,
        property_name=prop.name if hasattr(prop, 'name') else prop.address,
        noi=noi_result,
        dscr=dscr_result,
        ltv=ltv_result,
        cap_rate_percent=cap_rate,
        cash_on_cash_percent=coc,
        total_debt_outstanding=round(total_debt_outstanding, 2),
        total_equity=round(total_equity, 2),
        annual_debt_service=round(total_annual_ds, 2),
    )
