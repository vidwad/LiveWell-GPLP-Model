"""
Portfolio Performance — Lifetime Cash Flow & Valuation
=======================================================
Computes the full investment lifecycle from acquisition through disposition
using data already captured in Operations, Strategy, Lender Financing,
and Acquisition Baseline. No duplicate data entry.
"""
from decimal import Decimal
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    Property, Unit, Bed, DevelopmentPlan, DebtFacility, DebtStatus,
    AcquisitionBaseline, ExitForecast, ExitActual,
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


def _compute_phase_noi(db: Session, property_id: int, plan_id: int | None) -> dict:
    """Compute NOI for a specific phase from Operations data."""
    from app.db.models import RenovationPhase

    if plan_id:
        units = db.query(Unit).filter(
            Unit.property_id == property_id, Unit.development_plan_id == plan_id
        ).all()
        if not units:
            units = db.query(Unit).filter(
                Unit.property_id == property_id, Unit.development_plan_id.is_(None)
            ).all()
    else:
        units = db.query(Unit).filter(
            Unit.property_id == property_id,
            Unit.renovation_phase != RenovationPhase.post_renovation,
        ).all()

    beds = []
    for u in units:
        if plan_id:
            plan_beds = db.query(Bed).filter(Bed.unit_id == u.unit_id, Bed.is_post_renovation == True).all()
            beds.extend(plan_beds if plan_beds else db.query(Bed).filter(Bed.unit_id == u.unit_id).all())
        else:
            beds.extend(db.query(Bed).filter(Bed.unit_id == u.unit_id, Bed.is_post_renovation == False).all())

    monthly_rent = sum(_f(b.monthly_rent) for b in beds)
    gpr = monthly_rent * 12

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if gpr <= 0 and prop and prop.annual_revenue:
        gpr = _f(prop.annual_revenue)

    # Ancillary
    anc = db.query(AncillaryRevenueStream).filter(
        AncillaryRevenueStream.property_id == property_id,
        AncillaryRevenueStream.development_plan_id == plan_id,
    ).all()
    anc_annual = sum(
        _f(s.monthly_rate) * (s.total_count or 0) * _f(s.utilization_pct or 100) / 100 * 12
        for s in anc
    )
    other_income = anc_annual if anc_annual > 0 else _f(prop.annual_other_income) if prop else 0
    gross = gpr + other_income
    vacancy_loss = gross * 0.05
    egi = gross - vacancy_loss

    # Expenses
    expenses = db.query(OperatingExpenseLineItem).filter(
        OperatingExpenseLineItem.property_id == property_id,
        OperatingExpenseLineItem.development_plan_id == plan_id,
    ).all()
    num_units = len(units) if units else 1
    total_exp = 0.0
    for item in expenses:
        base = _f(item.base_amount)
        method = item.calc_method.value if hasattr(item.calc_method, 'value') else (item.calc_method or 'fixed')
        if method == 'per_unit':
            total_exp += base * num_units
        elif method == 'pct_egi':
            total_exp += egi * (base / 100)
        else:
            total_exp += base

    if not expenses:
        total_exp = _f(prop.annual_expenses) if prop and prop.annual_expenses else egi * 0.35

    noi = egi - total_exp

    return {
        "gpr": round(gpr, 2),
        "other_income": round(other_income, 2),
        "egi": round(egi, 2),
        "total_expenses": round(total_exp, 2),
        "noi": round(noi, 2),
        "units": len(units),
        "beds": len(beds),
    }


@router.get("/properties/{property_id}/lifetime-cashflow")
def get_lifetime_cashflow(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Compute the full investment lifecycle cash flow from existing data.

    Sources:
    - Acquisition Baseline → equity invested, purchase costs
    - Operations (per phase) → revenue, expenses, NOI
    - Strategy (plans) → construction costs, timelines
    - Lender Financing → debt service per phase
    - Exit assumptions → disposition proceeds

    Returns budget and actual columns for each period.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    baseline = db.query(AcquisitionBaseline).filter(
        AcquisitionBaseline.property_id == property_id
    ).first()
    exit_forecast = db.query(ExitForecast).filter(
        ExitForecast.property_id == property_id
    ).first()
    exit_actual = db.query(ExitActual).filter(
        ExitActual.property_id == property_id
    ).first()

    plans = db.query(DevelopmentPlan).filter(
        DevelopmentPlan.property_id == property_id
    ).order_by(DevelopmentPlan.plan_id).all()

    all_debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == property_id
    ).all()

    # Key values from Acquisition Baseline
    purchase_price = _f(baseline.purchase_price if baseline else prop.purchase_price)
    closing_costs = _f(baseline.closing_costs) if baseline else purchase_price * 0.03
    initial_equity = _f(baseline.initial_equity) if baseline else purchase_price * 0.25
    initial_debt = _f(baseline.initial_debt) if baseline else purchase_price * 0.75
    hold_years = int(baseline.target_hold_years) if baseline and baseline.target_hold_years else 7
    rent_growth = _f(prop.annual_rent_increase_pct) / 100 if prop.annual_rent_increase_pct else 0.03
    expense_growth = 0.02

    # Exit assumptions — sourced from baseline/forecast
    exit_cap = _f(exit_forecast.forecast_exit_cap_rate if exit_forecast and exit_forecast.forecast_exit_cap_rate
                  else baseline.original_exit_cap_rate if baseline and baseline.original_exit_cap_rate else 5.5)
    selling_cost_pct = _f(exit_forecast.forecast_selling_cost_pct if exit_forecast and exit_forecast.forecast_selling_cost_pct
                          else baseline.original_selling_cost_pct if baseline and baseline.original_selling_cost_pct else 5)

    # Baseline debt service
    baseline_debts = [d for d in all_debts if not d.development_plan_id]
    baseline_ads = 0.0
    for d in baseline_debts:
        bal = _f(d.outstanding_balance or d.commitment_amount)
        if bal > 0 and d.interest_rate:
            baseline_ads += calculate_annual_debt_service(
                bal, _f(d.interest_rate),
                d.amortization_months or 0, d.io_period_months or 0,
                compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
            )

    # Baseline NOI from Operations
    baseline_noi_data = _compute_phase_noi(db, property_id, None)
    baseline_noi = baseline_noi_data["noi"]
    baseline_egi = baseline_noi_data["egi"]
    baseline_expenses = baseline_noi_data["total_expenses"]

    # Build period rows
    periods = []
    cumulative_budget = 0.0
    year_counter = 0

    # Row 0: Acquisition
    acq_cost = purchase_price + closing_costs
    periods.append({
        "period": "Acquisition",
        "type": "acquisition",
        "year": 0,
        "revenue_budget": 0,
        "expenses_budget": round(closing_costs, 0),
        "noi_budget": 0,
        "debt_service_budget": 0,
        "construction_cost": 0,
        "net_cashflow_budget": round(-initial_equity, 0),
        "cumulative_budget": round(-initial_equity, 0),
        "source": "Acquisition Baseline",
    })
    cumulative_budget = -initial_equity

    # Determine phase schedule
    # As-Is years before first plan
    first_plan_start = None
    for p in plans:
        if p.development_start_date:
            first_plan_start = p.development_start_date
            break

    purchase_year = prop.purchase_date.year if prop.purchase_date else date.today().year
    first_plan_year = first_plan_start.year if first_plan_start else purchase_year + hold_years

    as_is_years = max(0, first_plan_year - purchase_year)
    current_noi = baseline_noi
    current_egi = baseline_egi
    current_expenses = baseline_expenses
    current_ads = baseline_ads

    # As-Is operating years
    for y in range(1, as_is_years + 1):
        year_counter += 1
        growth = (1 + rent_growth) ** (y - 1)
        exp_growth = (1 + expense_growth) ** (y - 1)
        rev = current_egi * growth
        exp = current_expenses * exp_growth
        noi = rev - exp
        cf = noi - current_ads
        cumulative_budget += cf
        periods.append({
            "period": f"Year {year_counter} (As-Is)",
            "type": "operating",
            "year": year_counter,
            "revenue_budget": round(rev, 0),
            "expenses_budget": round(exp, 0),
            "noi_budget": round(noi, 0),
            "debt_service_budget": round(current_ads, 0),
            "construction_cost": 0,
            "net_cashflow_budget": round(cf, 0),
            "cumulative_budget": round(cumulative_budget, 0),
            "source": "Operations (As-Is)",
        })

    # Development plan phases
    for plan in plans:
        plan_cost = _f(plan.estimated_construction_cost)
        duration_months = plan.construction_duration_months or (plan.construction_duration_days // 30 if plan.construction_duration_days else 6)
        duration_years = max(1, round(duration_months / 12))
        lease_up_months = getattr(plan, 'lease_up_months', None) or 6

        # Construction debt service
        plan_debts = [d for d in all_debts if d.development_plan_id == plan.plan_id]
        plan_ads = 0.0
        for d in plan_debts:
            bal = _f(d.outstanding_balance or d.commitment_amount)
            if bal > 0 and d.interest_rate:
                plan_ads += calculate_annual_debt_service(
                    bal, _f(d.interest_rate),
                    d.amortization_months or 0, d.io_period_months or 0,
                    compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
                )

        # Construction period
        for cy in range(1, duration_years + 1):
            year_counter += 1
            # During construction: no revenue, IO debt payments, construction costs spread
            cost_this_year = plan_cost / duration_years
            cf = -cost_this_year - plan_ads
            cumulative_budget += cf
            periods.append({
                "period": f"Year {year_counter} ({plan.plan_name or 'Construction'})",
                "type": "construction",
                "year": year_counter,
                "revenue_budget": 0,
                "expenses_budget": 0,
                "noi_budget": 0,
                "debt_service_budget": round(plan_ads, 0),
                "construction_cost": round(cost_this_year, 0),
                "net_cashflow_budget": round(cf, 0),
                "cumulative_budget": round(cumulative_budget, 0),
                "source": f"Master Plan: {plan.plan_name}",
            })

        # Post-plan NOI
        plan_noi_data = _compute_phase_noi(db, property_id, plan.plan_id)
        current_noi = plan_noi_data["noi"]
        current_egi = plan_noi_data["egi"]
        current_expenses = plan_noi_data["total_expenses"]

        # Update debt service to final plan debt
        if plan_debts:
            # Use the final (non-replaced) debt in the chain
            replaced_ids = {d.replaces_debt_id for d in plan_debts if d.replaces_debt_id}
            final_debts = [d for d in plan_debts if d.debt_id not in replaced_ids]
            current_ads = sum(
                calculate_annual_debt_service(
                    _f(d.outstanding_balance or d.commitment_amount),
                    _f(d.interest_rate),
                    d.amortization_months or 0, d.io_period_months or 0,
                    compounding=getattr(d, 'compounding_method', None) or 'semi_annual',
                )
                for d in final_debts if _f(d.outstanding_balance or d.commitment_amount) > 0 and d.interest_rate
            )

    # Remaining stabilized years until exit
    remaining_years = max(0, hold_years - year_counter)
    stabilized_start_noi = current_noi

    for y in range(1, remaining_years + 1):
        year_counter += 1
        growth = (1 + rent_growth) ** (y - 1)
        exp_growth = (1 + expense_growth) ** (y - 1)
        rev = current_egi * growth
        exp = current_expenses * exp_growth
        noi = rev - exp
        cf = noi - current_ads
        cumulative_budget += cf
        periods.append({
            "period": f"Year {year_counter} (Stabilized)",
            "type": "stabilized",
            "year": year_counter,
            "revenue_budget": round(rev, 0),
            "expenses_budget": round(exp, 0),
            "noi_budget": round(noi, 0),
            "debt_service_budget": round(current_ads, 0),
            "construction_cost": 0,
            "net_cashflow_budget": round(cf, 0),
            "cumulative_budget": round(cumulative_budget, 0),
            "source": "Operations (Stabilized)",
        })

    # Disposition
    exit_noi = periods[-1]["noi_budget"] if periods else current_noi
    exit_price = round(exit_noi / (exit_cap / 100), 0) if exit_cap > 0 else 0
    selling_costs = round(exit_price * selling_cost_pct / 100, 0)
    # Debt payoff — use current outstanding from final debts
    debt_payoff = sum(
        _f(d.outstanding_balance or d.commitment_amount)
        for d in all_debts
        if not any(other.replaces_debt_id == d.debt_id for other in all_debts)
        and _f(d.outstanding_balance) > 0
    )
    net_proceeds = exit_price - selling_costs - debt_payoff
    cumulative_budget += net_proceeds

    periods.append({
        "period": "Disposition",
        "type": "disposition",
        "year": year_counter,
        "revenue_budget": round(exit_price, 0),
        "expenses_budget": round(selling_costs + debt_payoff, 0),
        "noi_budget": round(exit_noi, 0),
        "debt_service_budget": 0,
        "construction_cost": 0,
        "net_cashflow_budget": round(net_proceeds, 0),
        "cumulative_budget": round(cumulative_budget, 0),
        "source": "Acquisition Baseline (exit assumptions)",
    })

    # Return metrics
    total_cash_invested = initial_equity + sum(p.get("construction_cost", 0) for p in periods)
    total_cash_returned = cumulative_budget + initial_equity  # net return
    total_operating_cf = sum(p["net_cashflow_budget"] for p in periods if p["type"] == "operating" or p["type"] == "stabilized")
    equity_multiple = round(cumulative_budget / initial_equity + 1, 2) if initial_equity > 0 else None

    # Annualized ROI — handle negative returns safely
    annualized_roi = None
    if initial_equity > 0 and hold_years > 0:
        total_value = cumulative_budget + initial_equity
        if total_value > 0:
            annualized_roi = round(((total_value / initial_equity) ** (1 / hold_years) - 1) * 100, 1)
        else:
            annualized_roi = round(-100.0, 1)  # Total loss

    avg_coc = round((total_operating_cf / max(hold_years, 1)) / initial_equity * 100, 1) if initial_equity > 0 and hold_years > 0 else None

    # Actual disposition data
    actual_disposition = None
    if exit_actual and exit_actual.actual_sale_price:
        actual_disposition = {
            "listing_date": str(exit_actual.listing_date) if exit_actual.listing_date else None,
            "broker": exit_actual.broker_name,
            "close_date": str(exit_actual.close_date) if exit_actual.close_date else None,
            "sale_price": _f(exit_actual.actual_sale_price),
            "selling_costs": _f(exit_actual.actual_selling_costs),
            "mortgage_payout": _f(exit_actual.actual_mortgage_payout),
            "net_proceeds": _f(exit_actual.actual_net_proceeds),
            "realized_irr": _f(exit_actual.realized_irr),
            "realized_equity_multiple": _f(exit_actual.realized_equity_multiple),
        }

    return {
        "property_id": property_id,
        "hold_years": hold_years,
        "periods": periods,
        "assumptions": {
            "purchase_price": round(purchase_price, 0),
            "closing_costs": round(closing_costs, 0),
            "initial_equity": round(initial_equity, 0),
            "initial_debt": round(initial_debt, 0),
            "rent_growth_pct": round(rent_growth * 100, 1),
            "expense_growth_pct": round(expense_growth * 100, 1),
            "exit_cap_rate": exit_cap,
            "exit_cap_rate_source": "Exit Forecast" if exit_forecast and exit_forecast.forecast_exit_cap_rate else "Acquisition Baseline" if baseline and baseline.original_exit_cap_rate else "Default (5.5%)",
            "selling_cost_pct": selling_cost_pct,
            "selling_cost_source": "Exit Forecast" if exit_forecast and exit_forecast.forecast_selling_cost_pct else "Acquisition Baseline" if baseline and baseline.original_selling_cost_pct else "Default (5%)",
        },
        "returns": {
            "total_equity_invested": round(initial_equity, 0),
            "total_operating_cashflow": round(total_operating_cf, 0),
            "net_sale_proceeds": round(net_proceeds, 0),
            "total_return": round(cumulative_budget, 0),
            "equity_multiple": equity_multiple,
            "annualized_roi": annualized_roi,
            "avg_cash_on_cash": avg_coc,
        },
        "disposition": {
            "exit_price": round(exit_price, 0),
            "exit_noi": round(exit_noi, 0),
            "selling_costs": round(selling_costs, 0),
            "debt_payoff": round(debt_payoff, 0),
            "net_proceeds": round(net_proceeds, 0),
        },
        "actual_disposition": actual_disposition,
    }
