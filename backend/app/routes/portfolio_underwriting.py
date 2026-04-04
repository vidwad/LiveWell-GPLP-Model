"""
Lender Underwriting Summary
============================
Computes all key metrics a commercial lender (bank, credit union, CMHC)
needs to evaluate a multi-family property loan application.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    Property, Unit, Bed, DebtFacility, DebtStatus,
    DevelopmentPlan, RenovationPhase,
    AncillaryRevenueStream, OperatingExpenseLineItem,
)
from app.core.deps import require_investor_or_above
from app.db.models import User

router = APIRouter()


def _f(val) -> float:
    """Safe float conversion."""
    if val is None:
        return 0.0
    return float(val)


@router.get("/properties/{property_id}/underwriting-summary")
def get_underwriting_summary(
    property_id: int,
    plan_id: int | None = Query(None, description="Development plan ID (null = baseline)"),
    vacancy_rate: float = Query(5.0, description="Assumed vacancy rate %"),
    cap_rate: float = Query(5.5, description="Assumed cap rate %"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Compute a comprehensive lender underwriting summary for a property.

    Returns all metrics a commercial lender needs:
    - Revenue breakdown (GPR, ancillary, vacancy, EGI)
    - Expense breakdown (total, ratio, per-unit)
    - NOI and NOI metrics (per unit, per bed, per sqft)
    - Debt metrics (DSCR, LTV, Debt Yield, Break-Even Occupancy)
    - Valuation metrics (Value/Suite, Loan/Suite, Implied Value at Cap)
    - CMHC-specific info if applicable
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # ── Revenue ──────────────────────────────────────────────────────
    if plan_id is not None:
        # Post-renovation / development plan: use units linked to this plan
        units = db.query(Unit).filter(
            Unit.property_id == property_id,
            Unit.development_plan_id == plan_id,
        ).all()
        if not units:
            # Fallback: if no plan-specific units, use baseline units
            units = db.query(Unit).filter(
                Unit.property_id == property_id,
                Unit.renovation_phase != RenovationPhase.post_renovation,
            ).all()
    else:
        # Baseline: exclude post-renovation units
        units = db.query(Unit).filter(
            Unit.property_id == property_id,
            Unit.renovation_phase != RenovationPhase.post_renovation,
        ).all()

    beds = []
    for u in units:
        if plan_id is not None:
            # For plan-specific underwriting, use post-reno beds if available
            plan_beds = db.query(Bed).filter(
                Bed.unit_id == u.unit_id,
                Bed.is_post_renovation == True,
            ).all()
            if plan_beds:
                beds.extend(plan_beds)
            else:
                beds.extend(db.query(Bed).filter(Bed.unit_id == u.unit_id).all())
        else:
            beds.extend(db.query(Bed).filter(
                Bed.unit_id == u.unit_id,
                Bed.is_post_renovation == False,
            ).all())

    monthly_rent = sum(_f(b.monthly_rent) for b in beds)
    gpr = monthly_rent * 12
    if gpr <= 0 and prop.annual_revenue:
        gpr = _f(prop.annual_revenue)

    # Ancillary revenue
    ancillary_streams = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id,
        AncillaryRevenueStream.development_plan_id == plan_id,
    ).all()
    ancillary_annual = 0.0
    ancillary_detail = []
    for s in ancillary_streams:
        utilization = float(s.utilization_pct or 100) / 100.0
        monthly = float(s.monthly_rate or 0) * (s.total_count or 0) * utilization
        annual = monthly * 12
        ancillary_annual += annual
        ancillary_detail.append({
            "stream_type": s.stream_type,
            "annual_revenue": round(annual, 2),
        })

    other_income = ancillary_annual if ancillary_annual > 0 else _f(prop.annual_other_income)
    gross_potential = gpr + other_income

    vac_rate = vacancy_rate / 100
    vacancy_loss = gross_potential * vac_rate
    egi = gross_potential - vacancy_loss

    # ── Expenses ─────────────────────────────────────────────────────
    expense_items = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
        OperatingExpenseLineItem.development_plan_id == plan_id,
    ).all()

    num_units = len(units) if units else 1
    total_expenses = 0.0
    expense_breakdown = []

    if expense_items:
        for item in expense_items:
            base = float(item.base_amount or 0)
            method = item.calc_method.value if hasattr(item.calc_method, 'value') else (item.calc_method or 'fixed')
            if method == 'per_unit':
                item_annual = base * num_units
            elif method == 'pct_egi':
                item_annual = egi * (base / 100.0)
            else:
                item_annual = base
            total_expenses += item_annual
            expense_breakdown.append({
                "category": item.category,
                "description": item.description,
                "annual_amount": round(item_annual, 2),
                "calc_method": method,
                "base_amount": base,
            })
    else:
        # Legacy fallback
        prop_value = _f(prop.current_market_value or prop.assessed_value or prop.purchase_price)
        total_expenses = _f(prop.annual_expenses) if prop.annual_expenses else (egi * 0.35)
        expense_breakdown.append({
            "category": "total_estimate",
            "description": "Estimated from expense ratio",
            "annual_amount": round(total_expenses, 2),
            "calc_method": "estimated",
            "base_amount": total_expenses,
        })

    noi = egi - total_expenses
    expense_ratio = (total_expenses / egi * 100) if egi > 0 else 0

    # ── Debt ─────────────────────────────────────────────────────────
    from app.services.calculations import calculate_annual_debt_service

    if plan_id is not None:
        # Plan-specific: show debt linked to this plan
        # Exclude debts that are replaced by other debts within the same plan
        plan_debts = db.query(DebtFacility).filter(
            DebtFacility.property_id == property_id,
            DebtFacility.development_plan_id == plan_id,
        ).all()
        # Build set of all debt IDs that are replaced by another plan debt
        all_replaced_ids = {d.replaces_debt_id for d in plan_debts if d.replaces_debt_id}
        # Filter out plan debts that are replaced by other plan debts
        active_plan_debts = [d for d in plan_debts if d.debt_id not in all_replaced_ids]
        # Also check baseline debts not replaced
        baseline_debts = db.query(DebtFacility).filter(
            DebtFacility.property_id == property_id,
            DebtFacility.development_plan_id == None,
            DebtFacility.status == DebtStatus.active,
        ).all()
        # Include baseline debt that isn't replaced by any plan debt
        debts = active_plan_debts + [d for d in baseline_debts if d.debt_id not in all_replaced_ids]
    else:
        # Baseline: only active debt with no plan link
        debts = db.query(DebtFacility).filter(
            DebtFacility.property_id == property_id,
            DebtFacility.development_plan_id == None,
            DebtFacility.status == DebtStatus.active,
        ).all()

    total_ads = 0.0
    total_debt = 0.0
    debt_summary = []
    cmhc_loans = []

    for d in debts:
        balance = _f(d.outstanding_balance or d.commitment_amount)
        compounding = getattr(d, 'compounding_method', None) or 'semi_annual'
        if balance > 0 and d.interest_rate:
            ads = calculate_annual_debt_service(
                balance, _f(d.interest_rate),
                d.amortization_months or 0, d.io_period_months or 0,
                compounding=compounding,
            )
            total_ads += ads
        else:
            ads = 0.0
        total_debt += balance

        debt_info = {
            "debt_id": d.debt_id,
            "lender_name": d.lender_name,
            "debt_type": d.debt_type.value if hasattr(d.debt_type, 'value') else d.debt_type,
            "outstanding_balance": round(balance, 2),
            "interest_rate": _f(d.interest_rate),
            "annual_debt_service": round(ads, 2),
            "compounding_method": compounding,
        }
        debt_summary.append(debt_info)

        if getattr(d, 'is_cmhc_insured', False):
            cmhc_loans.append({
                "debt_id": d.debt_id,
                "lender_name": d.lender_name,
                "cmhc_program": getattr(d, 'cmhc_program', None),
                "insurance_premium_pct": _f(getattr(d, 'cmhc_insurance_premium_pct', None)),
                "insurance_premium_amount": _f(getattr(d, 'cmhc_insurance_premium_amount', None)),
                "application_fee": _f(getattr(d, 'cmhc_application_fee', None)),
                "capitalized_fees": _f(getattr(d, 'capitalized_fees', None)),
            })

    cash_flow_after_debt = noi - total_ads

    # ── Valuation ────────────────────────────────────────────────────
    prop_value = _f(prop.current_market_value or prop.assessed_value or prop.purchase_price)
    implied_value = (noi / (cap_rate / 100)) if noi > 0 and cap_rate > 0 else 0

    # ── Key Ratios ───────────────────────────────────────────────────
    dscr = (noi / total_ads) if total_ads > 0 else None
    ltv = (total_debt / prop_value * 100) if prop_value > 0 else None
    debt_yield = (noi / total_debt * 100) if total_debt > 0 else None

    # Break-Even Occupancy = (Total Expenses + Debt Service) / Gross Potential Revenue
    break_even_occ = ((total_expenses + total_ads) / gross_potential * 100) if gross_potential > 0 else None

    # Per-unit metrics
    total_beds_count = len(beds)
    total_sqft = sum(_f(u.sqft) for u in units)

    value_per_suite = (prop_value / num_units) if num_units > 0 else None
    loan_per_suite = (total_debt / num_units) if num_units > 0 else None
    noi_per_unit = (noi / num_units) if num_units > 0 else None
    noi_per_bed = (noi / total_beds_count) if total_beds_count > 0 else None
    noi_per_sqft = (noi / total_sqft) if total_sqft > 0 else None
    expense_per_unit = (total_expenses / num_units) if num_units > 0 else None

    # ── DSCR Health Assessment ───────────────────────────────────────
    if dscr is None:
        dscr_health = "no_debt"
    elif dscr >= 1.50:
        dscr_health = "strong"
    elif dscr >= 1.25:
        dscr_health = "healthy"
    elif dscr >= 1.10:
        dscr_health = "adequate"
    elif dscr >= 1.00:
        dscr_health = "tight"
    else:
        dscr_health = "distressed"

    # ── LTV Risk Assessment ──────────────────────────────────────────
    if ltv is None:
        ltv_risk = "unknown"
    elif ltv <= 50:
        ltv_risk = "low"
    elif ltv <= 65:
        ltv_risk = "conservative"
    elif ltv <= 75:
        ltv_risk = "moderate"
    elif ltv <= 80:
        ltv_risk = "elevated"
    else:
        ltv_risk = "high"

    return {
        "property_id": property_id,
        "plan_id": plan_id,
        "property_address": prop.address,

        # Revenue
        "gross_potential_rent": round(gpr, 2),
        "ancillary_revenue": round(other_income, 2),
        "ancillary_detail": ancillary_detail,
        "gross_potential_revenue": round(gross_potential, 2),
        "vacancy_rate": round(vacancy_rate, 2),
        "vacancy_loss": round(vacancy_loss, 2),
        "effective_gross_income": round(egi, 2),

        # Expenses
        "total_operating_expenses": round(total_expenses, 2),
        "expense_ratio": round(expense_ratio, 2),
        "expense_per_unit": round(expense_per_unit, 2) if expense_per_unit else None,
        "expense_breakdown": expense_breakdown,

        # NOI
        "noi": round(noi, 2),
        "noi_per_unit": round(noi_per_unit, 2) if noi_per_unit else None,
        "noi_per_bed": round(noi_per_bed, 2) if noi_per_bed else None,
        "noi_per_sqft": round(noi_per_sqft, 2) if noi_per_sqft else None,

        # Debt
        "total_debt": round(total_debt, 2),
        "annual_debt_service": round(total_ads, 2),
        "cash_flow_after_debt": round(cash_flow_after_debt, 2),
        "debt_facilities": debt_summary,
        "cmhc_insured_loans": cmhc_loans,

        # Key Lender Ratios
        "dscr": round(dscr, 4) if dscr else None,
        "dscr_health": dscr_health,
        "ltv": round(ltv, 2) if ltv else None,
        "ltv_risk": ltv_risk,
        "debt_yield": round(debt_yield, 2) if debt_yield else None,
        "break_even_occupancy": round(break_even_occ, 2) if break_even_occ else None,

        # Valuation
        "property_value": round(prop_value, 2),
        "implied_value_at_cap": round(implied_value, 2),
        "cap_rate_assumption": round(cap_rate, 2),
        "value_per_suite": round(value_per_suite, 2) if value_per_suite else None,
        "loan_per_suite": round(loan_per_suite, 2) if loan_per_suite else None,

        # Scale
        "total_units": num_units,
        "total_beds": total_beds_count,
        "total_sqft": round(total_sqft, 2),
    }
