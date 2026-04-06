"""
Portfolio Lending Metrics
==========================
Computes per-facility lending metrics that a commercial lender needs:
- LTV (Loan-to-Value) against appropriate valuation basis
- LTC (Loan-to-Cost) for development/construction
- DSCR per facility
- Debt yield
- Break-even occupancy
- Covenant compliance
- Risk flags and lender concerns
"""
from decimal import Decimal
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    Property, DebtFacility, DebtStatus, DevelopmentPlan,
    AcquisitionBaseline, Unit, Bed, RenovationPhase,
    AncillaryRevenueStream, OperatingExpenseLineItem,
    User,
)
from app.core.deps import require_investor_or_above
from app.services.calculations import calculate_annual_debt_service

router = APIRouter()


def _f(val) -> float:
    if val is None:
        return 0.0
    return float(val)


@router.get("/properties/{property_id}/lending-metrics")
def get_lending_metrics(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Compute comprehensive lending metrics for every debt facility on a property.

    For each facility, determines the correct valuation basis based on:
    - Acquisition debt: LTV vs purchase price
    - Renovation debt: LTC vs (purchase + reno cost), LTV vs as-improved value
    - Construction debt: LTC vs total project cost
    - Permanent/CMHC takeout: LTV vs stabilized value (NOI / cap rate)

    Also computes DSCR, debt yield, and flags lender concerns.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    purchase_price = _f(prop.purchase_price)
    acq = db.query(AcquisitionBaseline).filter(
        AcquisitionBaseline.property_id == property_id
    ).first()
    closing_costs = _f(acq.closing_costs) if acq else purchase_price * 0.03
    total_acquisition_cost = purchase_price + closing_costs

    # Get all plans
    plans = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.property_id == property_id
    ).order_by(DevelopmentPlan.plan_id).all()
    plans_by_id = {p.plan_id: p for p in plans}

    # Get all debts
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == property_id
    ).order_by(DebtFacility.debt_id).all()

    # Compute baseline NOI
    baseline_units = db.query(Unit).filter(
        Unit.property_id == property_id,
        Unit.development_plan_id.is_(None),
    ).all()
    baseline_beds = []
    for u in baseline_units:
        baseline_beds.extend(db.query(Bed).filter(Bed.unit_id == u.unit_id).all())
    baseline_gpr = sum(_f(b.monthly_rent) for b in baseline_beds) * 12
    if baseline_gpr <= 0:
        baseline_gpr = _f(prop.annual_revenue)

    # Baseline expenses
    baseline_opex = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
        OperatingExpenseLineItem.development_plan_id.is_(None),
    ).all()
    baseline_egi = baseline_gpr * 0.95  # 5% vacancy
    baseline_fixed = sum(_f(item.base_amount) for item in baseline_opex
                         if (item.calc_method.value if hasattr(item.calc_method, 'value') else item.calc_method) != 'pct_egi')
    baseline_pct = sum(_f(item.base_amount) for item in baseline_opex
                       if (item.calc_method.value if hasattr(item.calc_method, 'value') else item.calc_method) == 'pct_egi')
    baseline_total_opex = baseline_fixed + (baseline_egi * baseline_pct / 100)
    baseline_noi = baseline_egi - baseline_total_opex

    # Build replacement chain map
    replaces_map = {}  # debt_id -> debt that replaces it
    for d in debts:
        if d.replaces_debt_id:
            replaces_map[d.replaces_debt_id] = d

    # Compute metrics for each facility
    facilities = []
    concerns = []
    now = date.today()

    for d in debts:
        balance = _f(d.outstanding_balance or d.commitment_amount)
        commitment = _f(d.commitment_amount)
        rate = _f(d.interest_rate)
        compounding = getattr(d, 'compounding_method', None) or 'semi_annual'

        # Annual debt service
        ads = 0.0
        if balance > 0 and rate > 0:
            ads = calculate_annual_debt_service(
                balance, rate,
                d.amortization_months or 0,
                d.io_period_months or 0,
                compounding=compounding,
            )

        # Determine plan context
        plan = plans_by_id.get(d.development_plan_id) if d.development_plan_id else None
        plan_cost = _f(plan.estimated_construction_cost) if plan else 0
        plan_noi = _f(plan.projected_annual_noi) if plan else 0
        plan_cap = _f(plan.exit_cap_rate) / 100 if plan and plan.exit_cap_rate else 0

        # Total project cost for this plan
        total_project_cost = total_acquisition_cost + plan_cost

        # Stabilized value (from plan NOI / cap rate)
        stabilized_value = 0.0
        if plan_noi > 0 and plan_cap > 0:
            stabilized_value = plan_noi / plan_cap

        # As-improved value for renovation (purchase + reno cost, or appraised)
        as_improved_value = purchase_price + plan_cost if plan else purchase_price

        # ── Determine which metrics apply based on debt type/purpose ──
        debt_type = d.debt_type.value if hasattr(d.debt_type, 'value') else d.debt_type
        purpose = d.debt_purpose or "acquisition"

        ltv = None
        ltv_basis = None
        ltv_basis_value = None
        ltc = None
        ltc_basis = None
        ltc_basis_value = None
        dscr = None
        dscr_noi = None
        debt_yield = None

        if purpose == "acquisition" or (not d.development_plan_id and debt_type == "permanent_mortgage"):
            # Acquisition debt — LTV vs purchase price
            if purchase_price > 0:
                ltv = round(balance / purchase_price * 100, 2)
                ltv_basis = "Purchase Price"
                ltv_basis_value = purchase_price
            # DSCR vs baseline NOI
            if ads > 0 and baseline_noi > 0:
                dscr = round(baseline_noi / ads, 2)
                dscr_noi = round(baseline_noi, 0)
            if balance > 0 and baseline_noi > 0:
                debt_yield = round(baseline_noi / balance * 100, 2)

        elif debt_type == "construction_loan":
            # Construction loan — LTC vs total project cost.
            # Interest reserve is a *source* of funds, not a use, so it should
            # be excluded from BOTH the loan numerator (net loan available for
            # project costs) AND the cost denominator (since the reserve isn't
            # paying for hard/soft costs).
            interest_reserve = _f(getattr(d, "interest_reserve_amount", 0))
            net_loan_for_costs = max(0.0, commitment - interest_reserve)
            if total_project_cost > 0:
                ltc = round(net_loan_for_costs / total_project_cost * 100, 2)
                ltc_basis = "Total Project Cost (excl. interest reserve)"
                ltc_basis_value = total_project_cost
            # LTV at construction-end uses the FULLY drawn balance (commitment),
            # which by then includes the capitalized interest reserve.
            if stabilized_value > 0:
                ltv = round(commitment / stabilized_value * 100, 2)
                ltv_basis = "Stabilized Value"
                ltv_basis_value = stabilized_value
            # DSCR not applicable during construction (IO + reserve)

        elif purpose == "refinancing" or (d.development_plan_id and debt_type == "permanent_mortgage"):
            # Permanent takeout / CMHC — LTV vs stabilized value
            if stabilized_value > 0:
                ltv = round(balance / stabilized_value * 100, 2)
                ltv_basis = "Stabilized Value"
                ltv_basis_value = stabilized_value
            # Also show LTC
            if total_project_cost > 0:
                ltc = round(balance / total_project_cost * 100, 2)
                ltc_basis = "Total Project Cost"
                ltc_basis_value = total_project_cost
            # DSCR vs plan NOI
            if ads > 0 and plan_noi > 0:
                dscr = round(plan_noi / ads, 2)
                dscr_noi = round(plan_noi, 0)
            if balance > 0 and plan_noi > 0:
                debt_yield = round(plan_noi / balance * 100, 2)

        elif not d.development_plan_id:
            # Other baseline debt (bridge, mezzanine, HELOC)
            if purchase_price > 0:
                ltv = round(balance / purchase_price * 100, 2)
                ltv_basis = "Purchase Price"
                ltv_basis_value = purchase_price
            if ads > 0 and baseline_noi > 0:
                dscr = round(baseline_noi / ads, 2)
                dscr_noi = round(baseline_noi, 0)

        else:
            # Plan-linked non-construction debt (second mortgage for reno, etc.)
            if as_improved_value > 0:
                ltv = round(balance / as_improved_value * 100, 2)
                ltv_basis = "As-Improved Value"
                ltv_basis_value = as_improved_value
            if total_project_cost > 0:
                ltc = round(balance / total_project_cost * 100, 2)
                ltc_basis = "Total Project Cost"
                ltc_basis_value = total_project_cost

        # ── Maturity analysis ──
        maturity_date = d.maturity_date
        months_to_maturity = None
        if maturity_date:
            if isinstance(maturity_date, str):
                try:
                    maturity_date = date.fromisoformat(maturity_date)
                except ValueError:
                    maturity_date = None
            if maturity_date:
                delta = (maturity_date - now).days
                months_to_maturity = round(delta / 30.44, 1)

        # ── Is this debt replaced by another? ──
        replaced_by = replaces_map.get(d.debt_id)
        is_replaced = replaced_by is not None

        # ── CMHC specifics ──
        cmhc = None
        if d.is_cmhc_insured:
            cmhc = {
                "program": d.cmhc_program,
                "premium_pct": _f(d.cmhc_insurance_premium_pct),
                "premium_amount": _f(d.cmhc_insurance_premium_amount),
                "application_fee": _f(d.cmhc_application_fee),
                "capitalized_fees": _f(d.capitalized_fees),
                "lender_fee_pct": _f(d.lender_fee_pct),
                "lender_fee_amount": _f(d.lender_fee_amount),
            }

        # ── Lender Concerns ──
        facility_concerns = []

        # LTV thresholds
        if ltv is not None:
            if ltv > 80:
                facility_concerns.append({
                    "severity": "high",
                    "message": f"LTV {ltv:.1f}% exceeds 80% — high leverage",
                })
            elif ltv > 75:
                facility_concerns.append({
                    "severity": "medium",
                    "message": f"LTV {ltv:.1f}% above 75% — may require mortgage insurance",
                })

        # LTC thresholds
        if ltc is not None:
            if ltc > 80:
                facility_concerns.append({
                    "severity": "high",
                    "message": f"LTC {ltc:.1f}% exceeds 80% — above typical construction lending limits",
                })
            elif ltc > 75:
                facility_concerns.append({
                    "severity": "medium",
                    "message": f"LTC {ltc:.1f}% above 75% — at upper range for construction lending",
                })

        # DSCR thresholds
        if dscr is not None:
            if dscr < 1.0:
                facility_concerns.append({
                    "severity": "high",
                    "message": f"DSCR {dscr:.2f}x — NOI does not cover debt service",
                })
            elif dscr < 1.20:
                facility_concerns.append({
                    "severity": "medium",
                    "message": f"DSCR {dscr:.2f}x — below typical lender minimum of 1.20x",
                })
            elif dscr < 1.30:
                facility_concerns.append({
                    "severity": "low",
                    "message": f"DSCR {dscr:.2f}x — adequate but below CMHC minimum of 1.30x",
                })

        # Debt yield
        if debt_yield is not None and debt_yield < 7.0:
            facility_concerns.append({
                "severity": "medium",
                "message": f"Debt yield {debt_yield:.1f}% below 7% minimum many lenders require",
            })

        # Maturity
        if months_to_maturity is not None and months_to_maturity < 0:
            facility_concerns.append({
                "severity": "high",
                "message": f"Loan matured {abs(months_to_maturity):.0f} months ago — refinance or payoff required",
            })
        elif months_to_maturity is not None and months_to_maturity < 6:
            facility_concerns.append({
                "severity": "medium",
                "message": f"Loan matures in {months_to_maturity:.0f} months — begin refinance process",
            })

        # Covenant compliance
        if d.dscr_covenant and dscr is not None and dscr < float(d.dscr_covenant):
            facility_concerns.append({
                "severity": "high",
                "message": f"DSCR {dscr:.2f}x violates covenant minimum of {float(d.dscr_covenant):.2f}x",
            })
        if d.ltv_covenant and ltv is not None and ltv > float(d.ltv_covenant):
            facility_concerns.append({
                "severity": "high",
                "message": f"LTV {ltv:.1f}% violates covenant maximum of {float(d.ltv_covenant):.1f}%",
            })

        # Interest reserve sanity checks for construction loans
        if debt_type == "construction_loan":
            ir = _f(getattr(d, "interest_reserve_amount", 0))
            io = int(d.io_period_months or 0)
            rate_dec = _f(d.interest_rate) / 100.0
            # Expected reserve ≈ commitment × rate × (io/12) × 0.6 (linear-draw rule of thumb)
            expected_ir = commitment * rate_dec * (io / 12.0) * 0.6 if io > 0 else 0
            if ir == 0 and io > 0 and rate_dec > 0:
                facility_concerns.append({
                    "severity": "medium",
                    "message": f"No interest reserve set. Expected ~${expected_ir:,.0f} for a {io}-month IO period — sponsor would need to fund interest in cash during construction.",
                })
            elif ir > 0 and expected_ir > 0 and ir < expected_ir * 0.7:
                facility_concerns.append({
                    "severity": "low",
                    "message": f"Interest reserve ${ir:,.0f} appears under-sized; rule of thumb suggests ~${expected_ir:,.0f} for this loan and IO period.",
                })

        # Construction loan without takeout
        if debt_type == "construction_loan" and balance > 0 and not is_replaced:
            facility_concerns.append({
                "severity": "medium",
                "message": "No permanent takeout facility configured — required before construction completion",
            })

        # Construction loan must cover existing mortgage payout
        if debt_type == "construction_loan" and d.replaces_debt_id:
            replaced_debt = next((x for x in debts if x.debt_id == d.replaces_debt_id), None)
            if replaced_debt:
                payout_amount = _f(replaced_debt.outstanding_balance)
                remaining_for_construction = commitment - payout_amount
                if commitment > 0 and payout_amount > 0:
                    facility_concerns.append({
                        "severity": "info",
                        "message": f"Includes ${payout_amount:,.0f} to pay off {replaced_debt.lender_name}. Remaining for construction: ${remaining_for_construction:,.0f}",
                    })
                if commitment < payout_amount:
                    facility_concerns.append({
                        "severity": "high",
                        "message": f"Commitment ${commitment:,.0f} insufficient to pay off existing {replaced_debt.lender_name} (${payout_amount:,.0f})",
                    })

        # Missing maturity date
        if not maturity_date and balance > 0:
            facility_concerns.append({
                "severity": "low",
                "message": "No maturity date set",
            })

        concerns.extend([{**c, "facility": d.lender_name} for c in facility_concerns])

        facilities.append({
            "debt_id": d.debt_id,
            "lender_name": d.lender_name,
            "debt_type": debt_type,
            "debt_purpose": purpose,
            "status": d.status.value if hasattr(d.status, 'value') else d.status,
            "development_plan_id": d.development_plan_id,
            "replaces_debt_id": d.replaces_debt_id,
            "is_replaced": is_replaced,
            "replaced_by": replaced_by.lender_name if replaced_by else None,
            # Amounts
            "commitment": round(commitment, 2),
            "balance": round(balance, 2),
            "interest_reserve_amount": round(_f(getattr(d, "interest_reserve_amount", 0)), 2),
            "interest_reserve_drawn": round(_f(getattr(d, "interest_reserve_drawn", 0)), 2),
            "rate": rate,
            "rate_type": d.rate_type,
            "annual_debt_service": round(ads, 2),
            "monthly_payment": round(ads / 12, 2) if ads > 0 else 0,
            # Lending metrics
            "ltv": ltv,
            "ltv_basis": ltv_basis,
            "ltv_basis_value": round(ltv_basis_value, 0) if ltv_basis_value else None,
            "ltc": ltc,
            "ltc_basis": ltc_basis,
            "ltc_basis_value": round(ltc_basis_value, 0) if ltc_basis_value else None,
            "dscr": dscr,
            "dscr_noi": dscr_noi,
            "debt_yield": debt_yield,
            # Timeline
            "term_months": d.term_months,
            "amortization_months": d.amortization_months,
            "io_period_months": d.io_period_months,
            "maturity_date": str(maturity_date) if maturity_date else None,
            "months_to_maturity": months_to_maturity,
            "compounding": compounding,
            # CMHC
            "is_cmhc": d.is_cmhc_insured or False,
            "cmhc": cmhc,
            # Concerns
            "concerns": facility_concerns,
        })

    # Sort concerns by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    concerns.sort(key=lambda c: severity_order.get(c["severity"], 3))

    # Aggregate metrics
    total_debt = sum(f["balance"] for f in facilities if not f["is_replaced"])
    total_ads = sum(f["annual_debt_service"] for f in facilities if not f["is_replaced"])

    return {
        "property_id": property_id,
        "valuation_bases": {
            "purchase_price": round(purchase_price, 0),
            "total_acquisition_cost": round(total_acquisition_cost, 0),
            "baseline_noi": round(baseline_noi, 0),
            "plans": [
                {
                    "plan_id": p.plan_id,
                    "plan_name": p.plan_name,
                    "construction_cost": round(_f(p.estimated_construction_cost), 0),
                    "total_project_cost": round(total_acquisition_cost + _f(p.estimated_construction_cost), 0),
                    "projected_noi": round(_f(p.projected_annual_noi), 0),
                    "exit_cap_rate": _f(p.exit_cap_rate),
                    "stabilized_value": round(_f(p.projected_annual_noi) / (_f(p.exit_cap_rate) / 100), 0) if p.exit_cap_rate and _f(p.exit_cap_rate) > 0 and p.projected_annual_noi else None,
                }
                for p in plans
            ],
        },
        "total_debt": round(total_debt, 0),
        "total_annual_debt_service": round(total_ads, 0),
        "facilities": facilities,
        "concerns": concerns,
    }
