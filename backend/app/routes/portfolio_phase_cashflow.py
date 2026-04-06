"""
Phase-Specific Cash Flow — Monthly Granularity
================================================
Computes operating cash flow for a specific phase (as-is or development plan)
with monthly detail that can be expanded in the UI.
"""
from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    Property, Unit, Bed, DevelopmentPlan, DebtFacility,
    AcquisitionBaseline,
    AncillaryRevenueStream, OperatingExpenseLineItem,
    User, RenovationPhase,
)
from app.core.deps import require_investor_or_above
from app.services.calculations import calculate_annual_debt_service

router = APIRouter()


def _f(val) -> float:
    if val is None:
        return 0.0
    return float(val)


@router.get("/properties/{property_id}/phase-cashflow")
def get_phase_cashflow(
    property_id: int,
    plan_id: int | None = Query(None, description="None=as-is baseline, N=specific plan"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Compute cash flow for a specific phase with monthly detail.

    Returns:
    - Phase info (name, start date, end date)
    - Operating summary (revenue, expenses, NOI, debt service)
    - Year-by-year rows, each containing monthly breakdown
    - Period-level returns
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    baseline = db.query(AcquisitionBaseline).filter(
        AcquisitionBaseline.property_id == property_id
    ).first()

    all_plans = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.property_id == property_id
    ).order_by(DevelopmentPlan.plan_id).all()

    all_debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == property_id
    ).all()

    purchase_date = prop.purchase_date or date.today()
    hold_years = int(baseline.target_hold_years) if baseline and baseline.target_hold_years else 7
    exit_date = date(purchase_date.year + hold_years, purchase_date.month, purchase_date.day)
    rent_growth_annual = _f(prop.annual_rent_increase_pct) / 100 if prop.annual_rent_increase_pct else 0.03
    expense_growth_annual = 0.02

    # Determine phase boundaries
    sorted_plans = sorted(all_plans, key=lambda p: p.development_start_date or date(9999, 1, 1))

    if plan_id is None:
        # As-Is phase
        phase_name = "As-Is Operations"
        phase_start = purchase_date
        # End = first plan start, or exit date if no plans
        first_plan_start = None
        for p in sorted_plans:
            if p.development_start_date:
                first_plan_start = p.development_start_date
                break
        phase_end = first_plan_start or exit_date
        is_last_phase = len(all_plans) == 0
    else:
        plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == plan_id).first()
        if not plan:
            raise HTTPException(404, "Plan not found")

        phase_name = plan.plan_name or f"Plan {plan.plan_id}"
        phase_start = plan.development_start_date or purchase_date
        duration_days = plan.construction_duration_days or (plan.construction_duration_months * 30 if plan.construction_duration_months else 180)
        construction_end = plan.estimated_completion_date or (phase_start + timedelta(days=duration_days))
        lease_up_months = getattr(plan, 'lease_up_months', None) or 6
        stabilization_date = plan.estimated_stabilization_date or (construction_end + relativedelta(months=lease_up_months))

        # Find next plan start or exit date
        plan_index = next((i for i, p in enumerate(sorted_plans) if p.plan_id == plan_id), -1)
        if plan_index >= 0 and plan_index < len(sorted_plans) - 1:
            next_plan = sorted_plans[plan_index + 1]
            phase_end = next_plan.development_start_date or exit_date
            is_last_phase = False
        else:
            phase_end = exit_date
            is_last_phase = True

    # Compute NOI for this phase
    if plan_id:
        units = db.query(Unit).filter(Unit.property_id == property_id, Unit.development_plan_id == plan_id).all()
        if not units:
            units = db.query(Unit).filter(Unit.property_id == property_id, Unit.development_plan_id.is_(None)).all()
    else:
        units = db.query(Unit).filter(
            Unit.property_id == property_id,
            Unit.renovation_phase != RenovationPhase.post_renovation,
        ).all()

    beds = []
    for u in units:
        if plan_id:
            pb = db.query(Bed).filter(Bed.unit_id == u.unit_id, Bed.is_post_renovation == True).all()
            beds.extend(pb if pb else db.query(Bed).filter(Bed.unit_id == u.unit_id).all())
        else:
            beds.extend(db.query(Bed).filter(Bed.unit_id == u.unit_id, Bed.is_post_renovation == False).all())

    monthly_rent = sum(_f(b.monthly_rent) for b in beds)
    annual_gpr = monthly_rent * 12
    if annual_gpr <= 0 and prop.annual_revenue:
        annual_gpr = _f(prop.annual_revenue)
        monthly_rent = annual_gpr / 12

    # Ancillary
    anc = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id,
        AncillaryRevenueStream.development_plan_id == plan_id,
    ).all()
    monthly_ancillary = sum(
        _f(s.monthly_rate) * (s.total_count or 0) * _f(s.utilization_pct or 100) / 100
        for s in anc
    )
    if monthly_ancillary <= 0 and prop.annual_other_income:
        monthly_ancillary = _f(prop.annual_other_income) / 12

    vacancy_rate = 0.05
    monthly_gross = monthly_rent + monthly_ancillary
    monthly_vacancy = monthly_gross * vacancy_rate
    monthly_egi = monthly_gross - monthly_vacancy

    # Monthly expenses
    expenses = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
        OperatingExpenseLineItem.development_plan_id == plan_id,
    ).all()
    num_units = len(units) if units else 1
    annual_egi = monthly_egi * 12
    annual_fixed = 0.0
    annual_pct = 0.0
    for item in expenses:
        base = _f(item.base_amount)
        method = item.calc_method.value if hasattr(item.calc_method, 'value') else (item.calc_method or 'fixed')
        if method == 'per_unit':
            annual_fixed += base * num_units
        elif method == 'pct_egi':
            annual_pct += base
        else:
            annual_fixed += base
    if not expenses:
        annual_fixed = annual_egi * 0.35
    annual_pct_amount = annual_egi * annual_pct / 100
    monthly_expenses = (annual_fixed + annual_pct_amount) / 12

    monthly_noi = monthly_egi - monthly_expenses

    # Debt service for this phase
    if plan_id:
        phase_debts = [d for d in all_debts if d.development_plan_id == plan_id]
        replaced_ids = {d.replaces_debt_id for d in phase_debts if d.replaces_debt_id}
        within_replaced = set()
        for d in phase_debts:
            if d.replaces_debt_id and any(o.debt_id == d.replaces_debt_id for o in phase_debts):
                within_replaced.add(d.replaces_debt_id)
        active_debts = [d for d in phase_debts if d.debt_id not in within_replaced]
        baseline_carry = [d for d in all_debts if not d.development_plan_id and d.debt_id not in replaced_ids]
        debts = active_debts + baseline_carry
    else:
        debts = [d for d in all_debts if not d.development_plan_id]

    annual_ds = 0.0
    for d in debts:
        bal = _f(d.outstanding_balance or d.commitment_amount)
        if bal > 0 and d.interest_rate:
            annual_ds += calculate_annual_debt_service(
                bal, _f(d.interest_rate),
                d.amortization_months or 0, d.io_period_months or 0,
                compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
            )
    monthly_ds = annual_ds / 12

    # Build monthly rows grouped by year
    current = phase_start
    years = []
    current_year_months = []
    current_year_num = 1
    cumulative = 0.0
    month_index = 0

    while current < phase_end:
        month_end = min(current + relativedelta(months=1), phase_end)
        days_in_month = (month_end - current).days
        month_fraction = days_in_month / 30.44  # normalize to ~1.0 for full month

        # Apply growth
        years_elapsed = (current - phase_start).days / 365.25
        growth_factor = (1 + rent_growth_annual) ** years_elapsed
        exp_growth_factor = (1 + expense_growth_annual) ** years_elapsed

        m_egi = monthly_egi * growth_factor * month_fraction
        m_exp = monthly_expenses * exp_growth_factor * month_fraction
        m_noi = m_egi - m_exp
        m_ds = monthly_ds * month_fraction
        m_cf = m_noi - m_ds
        cumulative += m_cf

        current_year_months.append({
            "month": current.strftime("%b %Y"),
            "start": str(current),
            "end": str(month_end),
            "days": days_in_month,
            "revenue": round(m_egi, 0),
            "expenses": round(m_exp, 0),
            "noi": round(m_noi, 0),
            "debt_service": round(m_ds, 0),
            "net_cashflow": round(m_cf, 0),
            "cumulative": round(cumulative, 0),
        })

        # Check if we've crossed a year boundary
        next_month = month_end
        if next_month.month == phase_start.month and next_month.day <= phase_start.day and len(current_year_months) >= 2:
            # Year complete
            year_rev = sum(m["revenue"] for m in current_year_months)
            year_exp = sum(m["expenses"] for m in current_year_months)
            year_noi = sum(m["noi"] for m in current_year_months)
            year_ds = sum(m["debt_service"] for m in current_year_months)
            year_cf = sum(m["net_cashflow"] for m in current_year_months)
            is_partial = len(current_year_months) < 11

            years.append({
                "year": current_year_num,
                "label": f"Year {current_year_num}" + (" (partial)" if is_partial else ""),
                "start": current_year_months[0]["start"],
                "end": current_year_months[-1]["end"],
                "months": len(current_year_months),
                "revenue": round(year_rev, 0),
                "expenses": round(year_exp, 0),
                "noi": round(year_noi, 0),
                "debt_service": round(year_ds, 0),
                "net_cashflow": round(year_cf, 0),
                "cumulative": round(cumulative, 0),
                "monthly_detail": current_year_months,
            })
            current_year_months = []
            current_year_num += 1

        current = next_month

    # Final partial year
    if current_year_months:
        year_rev = sum(m["revenue"] for m in current_year_months)
        year_exp = sum(m["expenses"] for m in current_year_months)
        year_noi = sum(m["noi"] for m in current_year_months)
        year_ds = sum(m["debt_service"] for m in current_year_months)
        year_cf = sum(m["net_cashflow"] for m in current_year_months)

        years.append({
            "year": current_year_num,
            "label": f"Year {current_year_num}" + (" (partial)" if len(current_year_months) < 11 else ""),
            "start": current_year_months[0]["start"],
            "end": current_year_months[-1]["end"],
            "months": len(current_year_months),
            "revenue": round(year_rev, 0),
            "expenses": round(year_exp, 0),
            "noi": round(year_noi, 0),
            "debt_service": round(year_ds, 0),
            "net_cashflow": round(year_cf, 0),
            "cumulative": round(cumulative, 0),
            "monthly_detail": current_year_months,
        })

    # Period totals
    total_revenue = sum(y["revenue"] for y in years)
    total_expenses = sum(y["expenses"] for y in years)
    total_noi = sum(y["noi"] for y in years)
    total_ds = sum(y["debt_service"] for y in years)
    total_cf = sum(y["net_cashflow"] for y in years)

    # Period returns
    initial_equity = _f(baseline.initial_equity) if baseline and baseline.initial_equity else _f(prop.purchase_price) * 0.25
    period_coc = round((total_cf / max(len(years), 1)) / initial_equity * 100, 1) if initial_equity > 0 else None
    dscr = round(total_noi / total_ds, 2) if total_ds > 0 else None

    return {
        "property_id": property_id,
        "plan_id": plan_id,
        "phase_name": phase_name,
        "phase_start": str(phase_start),
        "phase_end": str(phase_end),
        "is_last_phase": is_last_phase,
        "total_months": sum(y["months"] for y in years),
        "summary": {
            "annual_gpr": round(annual_gpr, 0),
            "annual_ancillary": round(monthly_ancillary * 12, 0),
            "annual_egi": round(annual_egi, 0),
            "annual_expenses": round(annual_fixed + annual_pct_amount, 0),
            "annual_noi": round(monthly_noi * 12, 0),
            "annual_debt_service": round(annual_ds, 0),
            "annual_cashflow": round((monthly_noi - monthly_ds) * 12, 0),
            "units": len(units),
            "beds": len(beds),
            "vacancy_rate": vacancy_rate * 100,
            "dscr": dscr,
            "cash_on_cash": period_coc,
        },
        "totals": {
            "revenue": round(total_revenue, 0),
            "expenses": round(total_expenses, 0),
            "noi": round(total_noi, 0),
            "debt_service": round(total_ds, 0),
            "net_cashflow": round(total_cf, 0),
        },
        "years": years,
    }
