"""
Portfolio-level consolidated analytics for an LP fund.

Aggregates property-level financials into portfolio-wide metrics:
- Consolidated DSCR, LTV, Debt Yield
- Diversification analysis (by city, stage, type, community)
- Portfolio-level pro forma summary
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models as m
from app.core.deps import require_gp_or_ops

router = APIRouter()

ZERO = Decimal("0")
TWO = Decimal("0.01")


def _d(v) -> Decimal:
    if v is None:
        return ZERO
    return Decimal(str(v))


@router.get("/lp/{lp_id}/consolidated-financials")
def get_consolidated_financials(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: m.User = Depends(require_gp_or_ops),
):
    """
    Consolidated financial summary across all properties in an LP.
    Returns portfolio-level DSCR, LTV, Debt Yield, NOI, and per-property breakdown.
    """
    lp = db.query(m.LPEntity).filter(m.LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP not found")

    props = db.query(m.Property).filter(m.Property.lp_id == lp_id).all()
    if not props:
        return {
            "lp_id": lp_id,
            "lp_name": lp.name,
            "property_count": 0,
            "properties": [],
            "consolidated": {},
            "diversification": {},
        }

    # ── Per-Property Financial Summary ────────────────────────────────
    property_summaries = []
    total_noi = ZERO
    total_revenue = ZERO
    total_expenses = ZERO
    total_market_value = ZERO
    total_purchase_price = ZERO
    total_debt_balance = ZERO
    total_annual_debt_service = ZERO
    total_units = 0
    total_beds = 0
    total_sqft = ZERO

    for prop in props:
        # Revenue
        rev = _d(prop.annual_revenue) + _d(prop.annual_other_income)

        # Ancillary revenue from streams
        streams = (
            db.query(m.AncillaryRevenueStream)
            .filter(
                m.AncillaryRevenueStream.property_id == prop.property_id,
                m.AncillaryRevenueStream.development_plan_id.is_(None),
            )
            .all()
        )
        ancillary_total = ZERO
        for s in streams:
            count = s.total_count or 0
            util = _d(s.utilization_rate) / Decimal("100") if s.utilization_rate else Decimal("1")
            monthly = _d(s.monthly_rate)
            ancillary_total += Decimal(str(count)) * util * monthly * Decimal("12")
        rev += ancillary_total

        # Expenses
        exp = _d(prop.annual_expenses)

        # Check for granular operating expenses
        opex_items = (
            db.query(m.OperatingExpenseLineItem)
            .filter(
                m.OperatingExpenseLineItem.property_id == prop.property_id,
                m.OperatingExpenseLineItem.development_plan_id.is_(None),
            )
            .all()
        )
        if opex_items:
            granular_exp = ZERO
            unit_count = db.query(m.Unit).filter(
                m.Unit.property_id == prop.property_id,
                m.Unit.is_baseline == True,
            ).count()
            egi = rev  # Effective Gross Income for % of EGI calculations
            for item in opex_items:
                if item.calc_method == "per_unit":
                    granular_exp += _d(item.base_amount) * Decimal(str(unit_count))
                elif item.calc_method == "pct_egi":
                    granular_exp += egi * _d(item.base_amount) / Decimal("100")
                else:  # fixed
                    granular_exp += _d(item.base_amount)
            exp = granular_exp

        noi = rev - exp

        # Market value
        market_val = _d(prop.current_market_value or prop.estimated_value or prop.purchase_price)
        purchase = _d(prop.purchase_price)

        # Debt
        debts = db.query(m.DebtFacility).filter(m.DebtFacility.property_id == prop.property_id).all()
        prop_debt_balance = ZERO
        prop_annual_ds = ZERO
        for d in debts:
            prop_debt_balance += _d(d.loan_amount)
            if d.interest_rate and d.amortization_years and d.loan_amount:
                # Canadian semi-annual compounding
                annual_rate = _d(d.interest_rate) / Decimal("100")
                semi = annual_rate / Decimal("2")
                monthly_rate = (Decimal("1") + semi) ** (Decimal("1") / Decimal("6")) - Decimal("1")
                n_payments = int((_d(d.amortization_years) * Decimal("12")))
                if monthly_rate > ZERO and n_payments > 0:
                    principal = _d(d.loan_amount)
                    if hasattr(d, 'capitalized_fees_total') and d.capitalized_fees_total:
                        principal += _d(d.capitalized_fees_total)
                    pmt = principal * monthly_rate / (Decimal("1") - (Decimal("1") + monthly_rate) ** (-n_payments))
                    prop_annual_ds += pmt * Decimal("12")

        # Units and beds
        units = db.query(m.Unit).filter(
            m.Unit.property_id == prop.property_id,
            m.Unit.is_baseline == True,
        ).all()
        prop_units = len(units)
        prop_beds = sum(
            db.query(m.Bed).filter(m.Bed.unit_id == u.unit_id).count()
            for u in units
        )

        prop_sqft = _d(prop.total_sqft)

        # Cap rate
        cap_rate = ZERO
        if market_val > ZERO:
            cap_rate = (noi / market_val * Decimal("100")).quantize(TWO)

        # DSCR
        dscr = ZERO
        if prop_annual_ds > ZERO:
            dscr = (noi / prop_annual_ds).quantize(TWO)

        # LTV
        ltv = ZERO
        if market_val > ZERO:
            ltv = (prop_debt_balance / market_val * Decimal("100")).quantize(TWO)

        property_summaries.append({
            "property_id": prop.property_id,
            "address": prop.address,
            "city": prop.city,
            "province": prop.province,
            "stage": prop.stage.value if prop.stage else "unknown",
            "property_type": prop.property_type,
            "community_name": prop.community_name,
            "zoning": prop.zoning,
            "annual_revenue": float(rev),
            "annual_expenses": float(exp),
            "noi": float(noi),
            "market_value": float(market_val),
            "purchase_price": float(purchase),
            "debt_balance": float(prop_debt_balance),
            "annual_debt_service": float(prop_annual_ds),
            "cap_rate": float(cap_rate),
            "dscr": float(dscr),
            "ltv": float(ltv),
            "units": prop_units,
            "beds": prop_beds,
            "sqft": float(prop_sqft),
        })

        total_noi += noi
        total_revenue += rev
        total_expenses += exp
        total_market_value += market_val
        total_purchase_price += purchase
        total_debt_balance += prop_debt_balance
        total_annual_debt_service += prop_annual_ds
        total_units += prop_units
        total_beds += prop_beds
        total_sqft += prop_sqft

    # ── Consolidated Metrics ──────────────────────────────────────────
    portfolio_dscr = ZERO
    if total_annual_debt_service > ZERO:
        portfolio_dscr = (total_noi / total_annual_debt_service).quantize(TWO)

    portfolio_ltv = ZERO
    if total_market_value > ZERO:
        portfolio_ltv = (total_debt_balance / total_market_value * Decimal("100")).quantize(TWO)

    portfolio_debt_yield = ZERO
    if total_debt_balance > ZERO:
        portfolio_debt_yield = (total_noi / total_debt_balance * Decimal("100")).quantize(TWO)

    portfolio_cap_rate = ZERO
    if total_market_value > ZERO:
        portfolio_cap_rate = (total_noi / total_market_value * Decimal("100")).quantize(TWO)

    portfolio_expense_ratio = ZERO
    if total_revenue > ZERO:
        portfolio_expense_ratio = (total_expenses / total_revenue * Decimal("100")).quantize(TWO)

    breakeven_occupancy = ZERO
    if total_revenue > ZERO:
        required = total_expenses + total_annual_debt_service
        breakeven_occupancy = (required / total_revenue * Decimal("100")).quantize(TWO)

    noi_per_unit = ZERO
    if total_units > 0:
        noi_per_unit = (total_noi / Decimal(str(total_units))).quantize(TWO)

    value_per_unit = ZERO
    if total_units > 0:
        value_per_unit = (total_market_value / Decimal(str(total_units))).quantize(TWO)

    debt_per_unit = ZERO
    if total_units > 0:
        debt_per_unit = (total_debt_balance / Decimal(str(total_units))).quantize(TWO)

    appreciation = ZERO
    if total_purchase_price > ZERO:
        appreciation = ((total_market_value - total_purchase_price) / total_purchase_price * Decimal("100")).quantize(TWO)

    consolidated = {
        "total_revenue": float(total_revenue),
        "total_expenses": float(total_expenses),
        "total_noi": float(total_noi),
        "total_market_value": float(total_market_value),
        "total_purchase_price": float(total_purchase_price),
        "total_debt_balance": float(total_debt_balance),
        "total_annual_debt_service": float(total_annual_debt_service),
        "total_units": total_units,
        "total_beds": total_beds,
        "total_sqft": float(total_sqft),
        "portfolio_dscr": float(portfolio_dscr),
        "portfolio_ltv": float(portfolio_ltv),
        "portfolio_debt_yield": float(portfolio_debt_yield),
        "portfolio_cap_rate": float(portfolio_cap_rate),
        "portfolio_expense_ratio": float(portfolio_expense_ratio),
        "breakeven_occupancy": float(breakeven_occupancy),
        "noi_per_unit": float(noi_per_unit),
        "value_per_unit": float(value_per_unit),
        "debt_per_unit": float(debt_per_unit),
        "portfolio_appreciation": float(appreciation),
    }

    # ── Diversification Analysis ──────────────────────────────────────
    by_city: Dict[str, Dict[str, Any]] = {}
    by_stage: Dict[str, Dict[str, Any]] = {}
    by_type: Dict[str, Dict[str, Any]] = {}
    by_community: Dict[str, Dict[str, Any]] = {}

    for ps in property_summaries:
        # By city
        city = ps["city"] or "Unknown"
        if city not in by_city:
            by_city[city] = {"count": 0, "market_value": 0, "noi": 0, "units": 0, "beds": 0}
        by_city[city]["count"] += 1
        by_city[city]["market_value"] += ps["market_value"]
        by_city[city]["noi"] += ps["noi"]
        by_city[city]["units"] += ps["units"]
        by_city[city]["beds"] += ps["beds"]

        # By stage
        stage = ps["stage"] or "unknown"
        if stage not in by_stage:
            by_stage[stage] = {"count": 0, "market_value": 0, "noi": 0, "units": 0, "beds": 0}
        by_stage[stage]["count"] += 1
        by_stage[stage]["market_value"] += ps["market_value"]
        by_stage[stage]["noi"] += ps["noi"]
        by_stage[stage]["units"] += ps["units"]
        by_stage[stage]["beds"] += ps["beds"]

        # By property type
        ptype = ps["property_type"] or "Unknown"
        if ptype not in by_type:
            by_type[ptype] = {"count": 0, "market_value": 0, "noi": 0, "units": 0, "beds": 0}
        by_type[ptype]["count"] += 1
        by_type[ptype]["market_value"] += ps["market_value"]
        by_type[ptype]["noi"] += ps["noi"]
        by_type[ptype]["units"] += ps["units"]
        by_type[ptype]["beds"] += ps["beds"]

        # By community focus
        comm = ps["community_name"] or "Unassigned"
        if comm not in by_community:
            by_community[comm] = {"count": 0, "market_value": 0, "noi": 0, "units": 0, "beds": 0}
        by_community[comm]["count"] += 1
        by_community[comm]["market_value"] += ps["market_value"]
        by_community[comm]["noi"] += ps["noi"]
        by_community[comm]["units"] += ps["units"]
        by_community[comm]["beds"] += ps["beds"]

    # Add percentage of portfolio for each diversification category
    for bucket in [by_city, by_stage, by_type, by_community]:
        for key, data in bucket.items():
            data["pct_of_value"] = round(
                data["market_value"] / float(total_market_value) * 100, 1
            ) if float(total_market_value) > 0 else 0
            data["pct_of_noi"] = round(
                data["noi"] / float(total_noi) * 100, 1
            ) if float(total_noi) > 0 else 0

    diversification = {
        "by_city": by_city,
        "by_stage": by_stage,
        "by_property_type": by_type,
        "by_community": by_community,
    }

    return {
        "lp_id": lp_id,
        "lp_name": lp.name,
        "property_count": len(props),
        "properties": property_summaries,
        "consolidated": consolidated,
        "diversification": diversification,
    }


@router.get("/lp/{lp_id}/consolidated-cashflow")
def get_consolidated_cashflow(
    lp_id: int,
    years: int = Query(default=10, ge=1, le=30),
    rent_escalation: float = Query(default=3.0),
    expense_escalation: float = Query(default=2.5),
    vacancy_rate: float = Query(default=5.0),
    db: Session = Depends(get_db),
    current_user: m.User = Depends(require_gp_or_ops),
):
    """
    Consolidated multi-year cash flow projection across all properties in an LP.
    Aggregates year-by-year revenue, expenses, NOI, debt service, and cash flow.
    """
    lp = db.query(m.LPEntity).filter(m.LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP not found")

    props = db.query(m.Property).filter(m.Property.lp_id == lp_id).all()
    if not props:
        return {"lp_id": lp_id, "lp_name": lp.name, "years": [], "properties": []}

    rent_esc = Decimal(str(rent_escalation)) / Decimal("100")
    exp_esc = Decimal(str(expense_escalation)) / Decimal("100")
    vac = Decimal(str(vacancy_rate)) / Decimal("100")

    # Initialize consolidated year buckets
    consolidated_years = []
    for yr in range(1, years + 1):
        consolidated_years.append({
            "year": yr,
            "gross_revenue": ZERO,
            "vacancy_loss": ZERO,
            "effective_revenue": ZERO,
            "operating_expenses": ZERO,
            "noi": ZERO,
            "debt_service": ZERO,
            "cash_flow_before_tax": ZERO,
        })

    property_projections = []

    for prop in props:
        # Base revenue
        base_rev = _d(prop.annual_revenue) + _d(prop.annual_other_income)

        # Add ancillary
        streams = (
            db.query(m.AncillaryRevenueStream)
            .filter(
                m.AncillaryRevenueStream.property_id == prop.property_id,
                m.AncillaryRevenueStream.development_plan_id.is_(None),
            )
            .all()
        )
        for s in streams:
            count = s.total_count or 0
            util = _d(s.utilization_rate) / Decimal("100") if s.utilization_rate else Decimal("1")
            monthly = _d(s.monthly_rate)
            base_rev += Decimal(str(count)) * util * monthly * Decimal("12")

        # Base expenses
        base_exp = _d(prop.annual_expenses)

        # Annual debt service
        debts = db.query(m.DebtFacility).filter(m.DebtFacility.property_id == prop.property_id).all()
        annual_ds = ZERO
        for d in debts:
            if d.interest_rate and d.amortization_years and d.loan_amount:
                annual_rate = _d(d.interest_rate) / Decimal("100")
                semi = annual_rate / Decimal("2")
                monthly_rate = (Decimal("1") + semi) ** (Decimal("1") / Decimal("6")) - Decimal("1")
                n_payments = int((_d(d.amortization_years) * Decimal("12")))
                if monthly_rate > ZERO and n_payments > 0:
                    principal = _d(d.loan_amount)
                    pmt = principal * monthly_rate / (Decimal("1") - (Decimal("1") + monthly_rate) ** (-n_payments))
                    annual_ds += pmt * Decimal("12")

        prop_years = []
        for yr in range(1, years + 1):
            gross = base_rev * (Decimal("1") + rent_esc) ** Decimal(str(yr - 1))
            vac_loss = gross * vac
            eff_rev = gross - vac_loss
            exp = base_exp * (Decimal("1") + exp_esc) ** Decimal(str(yr - 1))
            noi = eff_rev - exp
            cf = noi - annual_ds

            prop_years.append({
                "year": yr,
                "gross_revenue": float(gross.quantize(TWO)),
                "vacancy_loss": float(vac_loss.quantize(TWO)),
                "effective_revenue": float(eff_rev.quantize(TWO)),
                "operating_expenses": float(exp.quantize(TWO)),
                "noi": float(noi.quantize(TWO)),
                "debt_service": float(annual_ds.quantize(TWO)),
                "cash_flow_before_tax": float(cf.quantize(TWO)),
            })

            # Add to consolidated
            consolidated_years[yr - 1]["gross_revenue"] += gross
            consolidated_years[yr - 1]["vacancy_loss"] += vac_loss
            consolidated_years[yr - 1]["effective_revenue"] += eff_rev
            consolidated_years[yr - 1]["operating_expenses"] += exp
            consolidated_years[yr - 1]["noi"] += noi
            consolidated_years[yr - 1]["debt_service"] += annual_ds
            consolidated_years[yr - 1]["cash_flow_before_tax"] += cf

        property_projections.append({
            "property_id": prop.property_id,
            "address": prop.address,
            "city": prop.city,
            "years": prop_years,
        })

    # Convert consolidated Decimals to float
    for cy in consolidated_years:
        for k, v in cy.items():
            if isinstance(v, Decimal):
                cy[k] = float(v.quantize(TWO))

    return {
        "lp_id": lp_id,
        "lp_name": lp.name,
        "assumptions": {
            "rent_escalation": rent_escalation,
            "expense_escalation": expense_escalation,
            "vacancy_rate": vacancy_rate,
            "projection_years": years,
        },
        "consolidated_years": consolidated_years,
        "property_projections": property_projections,
    }
