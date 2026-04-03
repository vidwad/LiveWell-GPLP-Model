"""
Stabilized Pro Forma Service
=============================
Builds a complete pro forma from a property's current data:
rent roll, operating expenses, debt facilities, and development plan.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session

from app.db import models as m
from app.services.calculations import (
    calculate_annual_debt_service, calculate_cap_rate,
    calculate_cash_on_cash, calculate_dscr, calculate_ltv,
)

ZERO = Decimal("0")
TWO = Decimal("0.01")


def _d(val) -> float:
    if val is None:
        return 0.0
    return float(val)


def generate_proforma(
    db: Session,
    property_id: int,
    plan_id: Optional[int] = None,
    vacancy_rate: float = 5.0,
    management_fee_rate: float = 4.0,
    replacement_reserve_pct: float = 2.0,
    cap_rate_assumption: float = 5.5,
    label: Optional[str] = None,
) -> dict:
    """Generate a stabilized pro forma from a property's current data.

    Pulls:
    - Rent roll (from beds or property annual_revenue)
    - Operating expenses (from community expenses or property annual_expenses)
    - Debt service (from active debt facilities)
    - Unit count (from development plan or property units)

    Returns a dict matching the ProForma model fields.
    """
    prop = db.query(m.Property).filter(m.Property.property_id == property_id).first()
    if not prop:
        return {"error": "Property not found"}

    # --- Revenue ---
    # Try rent roll first (sum of bed monthly rents × 12)
    units = db.query(m.Unit).filter(
        m.Unit.property_id == property_id,
        m.Unit.renovation_phase != m.RenovationPhase.post_renovation,
    ).all()

    beds = []
    for u in units:
        beds.extend(db.query(m.Bed).filter(m.Bed.unit_id == u.unit_id).all())

    monthly_rent = sum(_d(b.monthly_rent) for b in beds)
    gross_potential_rent = monthly_rent * 12

    # Fall back to property.annual_revenue if no beds
    if gross_potential_rent <= 0 and prop.annual_revenue:
        gross_potential_rent = _d(prop.annual_revenue)

    # Ancillary revenue streams (parking, pets, storage, etc.)
    ancillary_streams = db.query(m.AncillaryRevenueStream).filter(
        m.AncillaryRevenueStream.property_id == property_id,
        m.AncillaryRevenueStream.development_plan_id == plan_id,
    ).all()
    ancillary_annual = 0.0
    for s in ancillary_streams:
        utilization = float(s.utilization_pct or 100) / 100.0
        monthly = float(s.monthly_rate or 0) * (s.total_count or 0) * utilization
        ancillary_annual += monthly * 12

    # Fall back to property.annual_other_income if no ancillary streams
    other_income = ancillary_annual if ancillary_annual > 0 else _d(prop.annual_other_income)
    gross_potential = gross_potential_rent + other_income

    # Vacancy
    vac_rate = vacancy_rate / 100
    vacancy_loss = gross_potential * vac_rate
    egi = gross_potential - vacancy_loss

    # --- Expenses ---
    # First, check for granular operating expense line items
    expense_items = db.query(m.OperatingExpenseLineItem).filter(
        m.OperatingExpenseLineItem.property_id == property_id,
        m.OperatingExpenseLineItem.development_plan_id == plan_id,
    ).all()

    prop_value = _d(prop.current_market_value or prop.assessed_value or prop.purchase_price)
    num_units = len(units) if units else 1

    if expense_items:
        # Use granular line items
        annual_expenses = 0.0
        property_tax = 0.0
        insurance = 0.0
        mgmt_fee = 0.0
        reserves = 0.0
        for item in expense_items:
            base = float(item.base_amount or 0)
            method = item.calc_method.value if hasattr(item.calc_method, 'value') else (item.calc_method or 'fixed')
            if method == 'per_unit':
                item_annual = base * num_units
            elif method == 'pct_egi':
                item_annual = egi * (base / 100.0)
            else:  # fixed
                item_annual = base

            annual_expenses += item_annual
            cat = item.category or ''
            if cat == 'property_tax':
                property_tax += item_annual
            elif cat == 'insurance':
                insurance += item_annual
            elif cat == 'management_fee':
                mgmt_fee += item_annual
            elif cat == 'reserves':
                reserves += item_annual

        total_exp = annual_expenses
        mgmt_fee_decimal = management_fee_rate / 100  # keep for output
    else:
        # Fall back to legacy logic
        annual_expenses = 0.0
        if prop.community_id:
            from app.services.operations_service import compute_expenses
            import datetime
            yr = datetime.date.today().year
            exp_data = compute_expenses(db, prop.community_id, yr)
            total_props = db.query(m.Property).filter(m.Property.community_id == prop.community_id).count()
            if total_props > 0:
                annual_expenses = exp_data.get("total_expenses", 0) / total_props

        if annual_expenses <= 0 and prop.annual_expenses:
            annual_expenses = _d(prop.annual_expenses)

        property_tax = prop_value * 0.01
        insurance = prop_value * 0.003
        mgmt_fee_decimal = management_fee_rate / 100
        mgmt_fee = egi * mgmt_fee_decimal
        reserves = egi * (replacement_reserve_pct / 100)
        total_exp = annual_expenses + property_tax + insurance + mgmt_fee + reserves

    noi = egi - total_exp
    expense_ratio = (total_exp / egi * 100) if egi > 0 else 0

    # --- Debt Service ---
    debts = db.query(m.DebtFacility).filter(
        m.DebtFacility.property_id == property_id,
        m.DebtFacility.status == m.DebtStatus.active,
    ).all()

    total_ads = 0.0
    total_debt = 0.0
    for d in debts:
        if d.outstanding_balance and d.interest_rate:
            ads = calculate_annual_debt_service(
                _d(d.outstanding_balance), _d(d.interest_rate),
                d.amortization_months or 0, d.io_period_months or 0,
            )
            total_ads += ads
        total_debt += _d(d.outstanding_balance or d.commitment_amount)

    cash_flow_after_debt = noi - total_ads

    # --- Ratios ---
    dscr_data = calculate_dscr(noi, total_ads)
    dscr_val = dscr_data.get("dscr")

    cap_rate_val = calculate_cap_rate(noi, prop_value) if prop_value > 0 else None

    ltv_data = calculate_ltv(total_debt, prop_value) if prop_value > 0 else {}
    ltv_val = ltv_data.get("ltv_percent")

    # Implied value at assumed cap rate
    implied_value = (noi / (cap_rate_assumption / 100)) if noi > 0 and cap_rate_assumption > 0 else None

    # Equity
    total_equity = prop_value - total_debt if prop_value > 0 else 0
    coc = calculate_cash_on_cash(cash_flow_after_debt, total_equity) if total_equity > 0 else None

    # --- Units / Scale ---
    plan = None
    if plan_id:
        plan = db.query(m.DevelopmentPlan).filter(m.DevelopmentPlan.plan_id == plan_id).first()
    elif prop.development_plans:
        plan = prop.development_plans[0]

    total_units_count = plan.planned_units if plan else len(units)
    total_beds_count = plan.planned_beds if plan else len(beds)
    total_sqft = float(plan.planned_sqft) if plan else sum(_d(u.sqft) for u in units)

    noi_per_unit = (noi / total_units_count) if total_units_count > 0 else None
    noi_per_bed = (noi / total_beds_count) if total_beds_count > 0 else None
    noi_per_sqft = (noi / total_sqft) if total_sqft > 0 else None

    if not label:
        label = f"Stabilized Pro Forma — {prop.address}"

    return {
        "property_id": property_id,
        "plan_id": plan_id or (plan.plan_id if plan else None),
        "label": label,
        "status": "draft",
        # Revenue
        "gross_potential_rent": round(gross_potential_rent, 2),
        "other_income": round(other_income, 2),
        "vacancy_rate": round(vacancy_rate, 2),
        "vacancy_loss": round(vacancy_loss, 2),
        "effective_gross_income": round(egi, 2),
        # Expenses
        "operating_expenses": round(annual_expenses, 2),
        "property_tax": round(property_tax, 2),
        "insurance": round(insurance, 2),
        "management_fee": round(mgmt_fee, 2),
        "management_fee_rate": round(mgmt_fee_decimal, 4),
        "replacement_reserves": round(reserves, 2),
        "total_expenses": round(total_exp, 2),
        # NOI
        "noi": round(noi, 2),
        "expense_ratio": round(expense_ratio, 2),
        # Debt
        "annual_debt_service": round(total_ads, 2),
        "cash_flow_after_debt": round(cash_flow_after_debt, 2),
        # Ratios
        "dscr": round(dscr_val, 4) if dscr_val else None,
        "cap_rate": round(cap_rate_val, 2) if cap_rate_val else None,
        "ltv": round(ltv_val, 2) if ltv_val else None,
        # Valuation
        "total_debt": round(total_debt, 2),
        "property_value": round(prop_value, 2),
        "implied_value_at_cap": round(implied_value, 2) if implied_value else None,
        # Equity
        "total_equity": round(total_equity, 2),
        "cash_on_cash": round(coc, 2) if coc else None,
        # Units
        "total_units": total_units_count,
        "total_beds": total_beds_count,
        "total_sqft": round(total_sqft, 2),
        "noi_per_unit": round(noi_per_unit, 2) if noi_per_unit else None,
        "noi_per_bed": round(noi_per_bed, 2) if noi_per_bed else None,
        "noi_per_sqft": round(noi_per_sqft, 2) if noi_per_sqft else None,
    }
