"""
LP–Property Bridge Service
===========================
Connects property-level financials to LP-level investor returns.

Key functions:
1. compute_distributable_cash — Property NOI → LP distributable cash after debt, fees, reserves
2. compute_capital_event_proceeds — Refinance/Sale proceeds available for distribution
3. compute_investor_return_projection — Multi-year time-series with IRR calculation
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import models as m
from app.services.calculations import calculate_annual_debt_service
from app.services.waterfall import WaterfallEngine

ZERO = Decimal("0")
TWO = Decimal("0.01")


def _d(val: Any) -> Decimal:
    if val is None:
        return ZERO
    return Decimal(str(val))


def _q(val: Decimal) -> Decimal:
    return val.quantize(TWO, rounding=ROUND_HALF_UP)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Property NOI → LP Distributable Cash
# ─────────────────────────────────────────────────────────────────────────────

def compute_distributable_cash(db: Session, lp_id: int) -> Dict[str, Any]:
    """
    Compute the annual distributable cash flow for an LP fund by aggregating
    property-level NOI, subtracting debt service, management fees, and reserves.

    Returns a detailed waterfall from gross revenue down to distributable cash.
    """
    lp = db.query(m.LPEntity).get(lp_id)
    if not lp:
        return {"error": "LP not found"}

    properties = db.query(m.Property).filter(m.Property.lp_id == lp_id).all()
    if not properties:
        return _empty_distributable(lp_id, lp.name)

    # ── Aggregate property-level financials ──
    total_gross_revenue = ZERO
    total_vacancy_loss = ZERO
    total_other_income = ZERO
    total_operating_expenses = ZERO
    total_annual_debt_service = ZERO
    property_details = []

    for p in properties:
        rev = _d(p.annual_revenue)
        vacancy_pct = _d(p.vacancy_rate) / Decimal("100") if p.vacancy_rate else Decimal("0.05")
        vacancy_loss = rev * vacancy_pct
        egi = rev - vacancy_loss
        other_inc = _d(p.annual_other_income)

        # Operating expenses: use expense_ratio if no granular data
        expense_ratio = _d(p.expense_ratio) / Decimal("100") if p.expense_ratio else Decimal("0.35")

        # Check for granular operating expense line items
        opex_items = db.query(m.OperatingExpenseLineItem).filter(
            m.OperatingExpenseLineItem.property_id == p.property_id
        ).all() if hasattr(m, 'OperatingExpenseLineItem') else []

        if opex_items:
            total_units = db.query(func.count(m.Unit.unit_id)).filter(
                m.Unit.property_id == p.property_id
            ).scalar() or 1
            opex = ZERO
            for item in opex_items:
                if item.calc_method == "per_unit":
                    opex += _d(item.base_amount) * Decimal(str(total_units))
                elif item.calc_method == "percent_egi":
                    opex += (egi + other_inc) * _d(item.base_amount) / Decimal("100")
                else:  # fixed
                    opex += _d(item.base_amount)
        else:
            opex = (egi + other_inc) * expense_ratio

        noi = egi + other_inc - opex

        # Debt service
        prop_debt_service = ZERO
        debts = db.query(m.DebtFacility).filter(
            m.DebtFacility.property_id == p.property_id,
            m.DebtFacility.status == "active",
        ).all()
        for d in debts:
            if d.outstanding_balance and d.interest_rate:
                ads = calculate_annual_debt_service(
                    float(d.outstanding_balance),
                    float(d.interest_rate),
                    d.amortization_months or 0,
                    d.io_period_months or 0,
                )
                prop_debt_service += _d(ads)

        cash_after_debt = noi - prop_debt_service

        total_gross_revenue += rev
        total_vacancy_loss += vacancy_loss
        total_other_income += other_inc
        total_operating_expenses += opex
        total_annual_debt_service += prop_debt_service

        property_details.append({
            "property_id": p.property_id,
            "address": p.address,
            "city": p.city,
            "gross_revenue": float(_q(rev)),
            "vacancy_loss": float(_q(vacancy_loss)),
            "other_income": float(_q(other_inc)),
            "operating_expenses": float(_q(opex)),
            "noi": float(_q(noi)),
            "debt_service": float(_q(prop_debt_service)),
            "cash_after_debt": float(_q(cash_after_debt)),
        })

    # ── LP-level deductions ──
    total_noi = total_gross_revenue - total_vacancy_loss + total_other_income - total_operating_expenses
    total_cash_after_debt = total_noi - total_annual_debt_service

    # Management fees
    mgmt_fee_pct = _d(lp.management_fee_percent) / Decimal("100") if lp.management_fee_percent else ZERO
    asset_mgmt_fee_pct = _d(lp.asset_management_fee_percent) / Decimal("100") if lp.asset_management_fee_percent else ZERO

    mgmt_fee = total_gross_revenue * mgmt_fee_pct
    asset_mgmt_fee = total_noi * asset_mgmt_fee_pct  # typically on NAV or NOI

    # Capital reserves (typically 3-5% of EGI)
    reserve_pct = Decimal("0.03")  # 3% default
    capital_reserves = (total_gross_revenue - total_vacancy_loss) * reserve_pct

    total_deductions = mgmt_fee + asset_mgmt_fee + capital_reserves
    distributable_cash = total_cash_after_debt - total_deductions

    return {
        "lp_id": lp_id,
        "lp_name": lp.name,
        "property_count": len(properties),
        "waterfall": {
            "gross_revenue": float(_q(total_gross_revenue)),
            "vacancy_loss": float(_q(total_vacancy_loss)),
            "effective_gross_income": float(_q(total_gross_revenue - total_vacancy_loss)),
            "other_income": float(_q(total_other_income)),
            "total_revenue": float(_q(total_gross_revenue - total_vacancy_loss + total_other_income)),
            "operating_expenses": float(_q(total_operating_expenses)),
            "noi": float(_q(total_noi)),
            "debt_service": float(_q(total_annual_debt_service)),
            "cash_after_debt": float(_q(total_cash_after_debt)),
            "management_fee": float(_q(mgmt_fee)),
            "asset_management_fee": float(_q(asset_mgmt_fee)),
            "capital_reserves": float(_q(capital_reserves)),
            "total_lp_deductions": float(_q(total_deductions)),
            "distributable_cash": float(_q(distributable_cash)),
        },
        "fee_detail": {
            "management_fee_percent": float(mgmt_fee_pct * Decimal("100")),
            "asset_management_fee_percent": float(asset_mgmt_fee_pct * Decimal("100")),
            "capital_reserve_percent": float(reserve_pct * Decimal("100")),
        },
        "properties": property_details,
    }


def _empty_distributable(lp_id: int, lp_name: str) -> Dict[str, Any]:
    return {
        "lp_id": lp_id,
        "lp_name": lp_name,
        "property_count": 0,
        "waterfall": {k: 0.0 for k in [
            "gross_revenue", "vacancy_loss", "effective_gross_income",
            "other_income", "total_revenue", "operating_expenses", "noi",
            "debt_service", "cash_after_debt", "management_fee",
            "asset_management_fee", "capital_reserves", "total_lp_deductions",
            "distributable_cash",
        ]},
        "fee_detail": {"management_fee_percent": 0, "asset_management_fee_percent": 0, "capital_reserve_percent": 3},
        "properties": [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Capital Event Proceeds
# ─────────────────────────────────────────────────────────────────────────────

def compute_capital_events(db: Session, lp_id: int) -> Dict[str, Any]:
    """
    Aggregate all capital events (refinances and sales) across LP properties.
    Compute net proceeds available for distribution through the waterfall.
    """
    lp = db.query(m.LPEntity).get(lp_id)
    if not lp:
        return {"error": "LP not found"}

    properties = db.query(m.Property).filter(m.Property.lp_id == lp_id).all()
    prop_ids = [p.property_id for p in properties]

    # ── Refinance Events ──
    refinances = db.query(m.RefinanceScenario).filter(
        m.RefinanceScenario.property_id.in_(prop_ids)
    ).order_by(m.RefinanceScenario.expected_date.asc().nullslast()).all()

    refi_events = []
    total_refi_proceeds = ZERO
    for r in refinances:
        new_loan = _d(r.assumed_new_valuation) * _d(r.new_ltv_percent) / Decimal("100")
        existing_debt = _d(r.existing_debt_payout)
        closing = _d(r.closing_costs)
        net_proceeds = new_loan - existing_debt - closing

        prop = db.query(m.Property).get(r.property_id)
        total_refi_proceeds += net_proceeds

        refi_events.append({
            "scenario_id": r.scenario_id,
            "property_id": r.property_id,
            "property_address": prop.address if prop else "Unknown",
            "label": r.label,
            "expected_date": r.expected_date.isoformat() if r.expected_date else None,
            "new_valuation": float(_q(_d(r.assumed_new_valuation))),
            "new_ltv_percent": float(_d(r.new_ltv_percent)),
            "new_loan_amount": float(_q(new_loan)),
            "existing_debt_payout": float(_q(existing_debt)),
            "closing_costs": float(_q(closing)),
            "net_proceeds": float(_q(net_proceeds)),
            "annual_noi_at_refi": float(_q(_d(r.annual_noi_at_refi))),
            "linked_event": r.linked_event,
        })

    # ── Sale Events ──
    sales = db.query(m.SaleScenario).filter(
        m.SaleScenario.property_id.in_(prop_ids)
    ).order_by(m.SaleScenario.expected_date.asc().nullslast()).all()

    sale_events = []
    total_sale_proceeds = ZERO
    for s in sales:
        sale_price = _d(s.assumed_sale_price)
        selling_costs = sale_price * _d(s.selling_costs_percent) / Decimal("100")
        debt_payout = _d(s.debt_payout)
        cap_gains_reserve = _d(s.capital_gains_reserve)
        net_proceeds = sale_price - selling_costs - debt_payout - cap_gains_reserve

        prop = db.query(m.Property).get(s.property_id)
        total_sale_proceeds += net_proceeds

        sale_events.append({
            "scenario_id": s.scenario_id,
            "property_id": s.property_id,
            "property_address": prop.address if prop else "Unknown",
            "label": s.label,
            "expected_date": s.expected_date.isoformat() if s.expected_date else None,
            "sale_price": float(_q(sale_price)),
            "selling_costs_percent": float(_d(s.selling_costs_percent)),
            "selling_costs": float(_q(selling_costs)),
            "debt_payout": float(_q(debt_payout)),
            "capital_gains_reserve": float(_q(cap_gains_reserve)),
            "net_proceeds": float(_q(net_proceeds)),
            "annual_noi_at_sale": float(_q(_d(s.annual_noi_at_sale))),
            "linked_event": s.linked_event,
        })

    return {
        "lp_id": lp_id,
        "lp_name": lp.name,
        "refinance_events": refi_events,
        "sale_events": sale_events,
        "total_refinance_proceeds": float(_q(total_refi_proceeds)),
        "total_sale_proceeds": float(_q(total_sale_proceeds)),
        "total_capital_event_proceeds": float(_q(total_refi_proceeds + total_sale_proceeds)),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Multi-Year Investor Return Projection with IRR
# ─────────────────────────────────────────────────────────────────────────────

def compute_investor_return_projection(
    db: Session,
    lp_id: int,
    projection_years: int = 10,
    rent_escalation: float = 3.0,
    expense_escalation: float = 2.5,
    vacancy_rate: float = 5.0,
    exit_cap_rate: float = 5.5,
) -> Dict[str, Any]:
    """
    Compute a multi-year investor return projection that shows:
    - Year-by-year property NOI flowing to the LP
    - Operating cash distributions through the waterfall
    - Capital events (refinances, sales) at their expected dates
    - Terminal value at exit
    - IRR and equity multiple calculations
    """
    lp = db.query(m.LPEntity).get(lp_id)
    if not lp:
        return {"error": "LP not found"}

    properties = db.query(m.Property).filter(m.Property.lp_id == lp_id).all()
    if not properties:
        return {"error": "No properties in LP"}

    # ── LP configuration ──
    pref_rate = _d(lp.preferred_return_rate) / Decimal("100") if lp.preferred_return_rate else Decimal("0.08")
    mgmt_fee_pct = _d(lp.management_fee_percent) / Decimal("100") if lp.management_fee_percent else ZERO
    asset_mgmt_fee_pct = _d(lp.asset_management_fee_percent) / Decimal("100") if lp.asset_management_fee_percent else ZERO

    # ── Total equity invested (from holdings) ──
    total_equity = ZERO
    holdings = db.query(m.Holding).filter(
        m.Holding.lp_id == lp_id, m.Holding.status == "active"
    ).all()
    for h in holdings:
        total_equity += _d(h.unreturned_capital)
    if total_equity == ZERO:
        # Fallback: use total funded from subscriptions
        subs = db.query(m.Subscription).filter(
            m.Subscription.lp_id == lp_id,
            m.Subscription.status.in_(["funded", "active"]),
        ).all()
        for s in subs:
            total_equity += _d(s.amount_funded)

    # ── Capital events timeline ──
    prop_ids = [p.property_id for p in properties]
    refinances = db.query(m.RefinanceScenario).filter(
        m.RefinanceScenario.property_id.in_(prop_ids)
    ).all()
    sales = db.query(m.SaleScenario).filter(
        m.SaleScenario.property_id.in_(prop_ids)
    ).all()

    # Map capital events to years
    current_year = date.today().year
    refi_by_year: Dict[int, Decimal] = {}
    for r in refinances:
        yr = r.expected_date.year if r.expected_date else current_year + 3
        new_loan = _d(r.assumed_new_valuation) * _d(r.new_ltv_percent) / Decimal("100")
        net = new_loan - _d(r.existing_debt_payout) - _d(r.closing_costs)
        refi_by_year[yr] = refi_by_year.get(yr, ZERO) + net

    sale_by_year: Dict[int, Decimal] = {}
    for s in sales:
        yr = s.expected_date.year if s.expected_date else current_year + projection_years
        sale_price = _d(s.assumed_sale_price)
        selling_costs = sale_price * _d(s.selling_costs_percent) / Decimal("100")
        net = sale_price - selling_costs - _d(s.debt_payout) - _d(s.capital_gains_reserve)
        sale_by_year[yr] = sale_by_year.get(yr, ZERO) + net

    # ── Year 0: Initial investment (negative cash flow) ──
    rent_esc = Decimal(str(rent_escalation)) / Decimal("100")
    exp_esc = Decimal(str(expense_escalation)) / Decimal("100")
    vac_rate = Decimal(str(vacancy_rate)) / Decimal("100")
    exit_cap = Decimal(str(exit_cap_rate)) / Decimal("100")

    # ── Base year property financials ──
    base_gross_revenue = ZERO
    base_other_income = ZERO
    base_opex = ZERO
    base_debt_service = ZERO

    for p in properties:
        rev = _d(p.annual_revenue)
        base_gross_revenue += rev
        base_other_income += _d(p.annual_other_income)

        exp_ratio = _d(p.expense_ratio) / Decimal("100") if p.expense_ratio else Decimal("0.35")
        egi = rev * (Decimal("1") - vac_rate)
        base_opex += (egi + _d(p.annual_other_income)) * exp_ratio

        debts = db.query(m.DebtFacility).filter(
            m.DebtFacility.property_id == p.property_id,
            m.DebtFacility.status == "active",
        ).all()
        for d in debts:
            if d.outstanding_balance and d.interest_rate:
                ads = calculate_annual_debt_service(
                    float(d.outstanding_balance),
                    float(d.interest_rate),
                    d.amortization_months or 0,
                    d.io_period_months or 0,
                )
                base_debt_service += _d(ads)

    # ── Build year-by-year projection ──
    yearly_projections = []
    irr_cashflows = [float(-total_equity)]  # Year 0: investment outflow

    cumulative_distributions = ZERO
    unreturned_capital = total_equity
    unpaid_pref = ZERO

    for yr_idx in range(1, projection_years + 1):
        year = current_year + yr_idx

        # Escalate revenue and expenses
        gross_rev = base_gross_revenue * (Decimal("1") + rent_esc) ** yr_idx
        other_inc = base_other_income * (Decimal("1") + rent_esc) ** yr_idx
        vacancy = gross_rev * vac_rate
        egi = gross_rev - vacancy + other_inc
        opex = base_opex * (Decimal("1") + exp_esc) ** yr_idx
        noi = egi - opex

        # Debt service (simplified: stays constant unless refinanced)
        debt_svc = base_debt_service

        cash_after_debt = noi - debt_svc

        # LP-level fees
        mgmt_fee = gross_rev * mgmt_fee_pct
        asset_fee = noi * asset_mgmt_fee_pct
        reserves = egi * Decimal("0.03")

        operating_distributable = cash_after_debt - mgmt_fee - asset_fee - reserves

        # Capital events for this year
        refi_proceeds = refi_by_year.get(year, ZERO)
        sale_proceeds = sale_by_year.get(year, ZERO)
        total_distributable = operating_distributable + refi_proceeds + sale_proceeds

        # Run waterfall
        unpaid_pref += unreturned_capital * pref_rate  # accrue preferred
        waterfall_result = WaterfallEngine.from_lp_config(
            distributable_cash=total_distributable,
            unreturned_capital=unreturned_capital,
            unpaid_pref_balance=unpaid_pref,
            lp_entity=lp,
        )

        lp_distribution = _d(waterfall_result["lp_distribution"])
        gp_distribution = _d(waterfall_result["gp_distribution"])
        unreturned_capital = _d(waterfall_result["unreturned_capital"])
        unpaid_pref = _d(waterfall_result["unpaid_pref_balance"])
        cumulative_distributions += lp_distribution

        # IRR cashflow for this year
        irr_cashflows.append(float(lp_distribution))

        yearly_projections.append({
            "year": year,
            "year_index": yr_idx,
            "gross_revenue": float(_q(gross_rev)),
            "vacancy_loss": float(_q(vacancy)),
            "other_income": float(_q(other_inc)),
            "effective_gross_income": float(_q(egi)),
            "operating_expenses": float(_q(opex)),
            "noi": float(_q(noi)),
            "debt_service": float(_q(debt_svc)),
            "cash_after_debt": float(_q(cash_after_debt)),
            "management_fee": float(_q(mgmt_fee)),
            "asset_management_fee": float(_q(asset_fee)),
            "capital_reserves": float(_q(reserves)),
            "operating_distributable": float(_q(operating_distributable)),
            "refinance_proceeds": float(_q(refi_proceeds)),
            "sale_proceeds": float(_q(sale_proceeds)),
            "total_distributable": float(_q(total_distributable)),
            "lp_distribution": float(_q(lp_distribution)),
            "gp_distribution": float(_q(gp_distribution)),
            "cumulative_lp_distributions": float(_q(cumulative_distributions)),
            "unreturned_capital": float(_q(unreturned_capital)),
            "unpaid_preferred": float(_q(unpaid_pref)),
        })

    # ── Terminal value (if no sale event in final year) ──
    final_year = yearly_projections[-1] if yearly_projections else None
    terminal_noi = _d(final_year["noi"]) if final_year else ZERO
    terminal_value = (terminal_noi / exit_cap) if exit_cap > ZERO else ZERO

    # Add terminal value to last year's IRR cashflow if no sale already captured
    final_year_num = current_year + projection_years
    if final_year_num not in sale_by_year:
        # Assume terminal value net of selling costs and debt
        total_outstanding_debt = ZERO
        for p in properties:
            debts = db.query(m.DebtFacility).filter(
                m.DebtFacility.property_id == p.property_id,
                m.DebtFacility.status == "active",
            ).all()
            for d in debts:
                total_outstanding_debt += _d(d.outstanding_balance or 0)

        terminal_net = terminal_value * Decimal("0.95") - total_outstanding_debt  # 5% selling costs
        if terminal_net > ZERO:
            irr_cashflows[-1] += float(terminal_net)

    # ── Compute IRR ──
    irr = _compute_irr(irr_cashflows)

    # ── Equity Multiple ──
    total_lp_return = cumulative_distributions
    if final_year_num not in sale_by_year and terminal_net > ZERO:
        total_lp_return += terminal_net * _d(lp.lp_profit_share_percent or 80) / Decimal("100")

    equity_multiple = (total_lp_return / total_equity).quantize(TWO) if total_equity > ZERO else ZERO

    # ── Cash-on-Cash (based on final stabilized year) ──
    final_lp_dist = _d(final_year["lp_distribution"]) if final_year else ZERO
    cash_on_cash = (final_lp_dist / total_equity * Decimal("100")).quantize(TWO) if total_equity > ZERO else ZERO

    return {
        "lp_id": lp_id,
        "lp_name": lp.name,
        "assumptions": {
            "projection_years": projection_years,
            "rent_escalation": rent_escalation,
            "expense_escalation": expense_escalation,
            "vacancy_rate": vacancy_rate,
            "exit_cap_rate": exit_cap_rate,
        },
        "total_equity_invested": float(_q(total_equity)),
        "summary": {
            "irr": irr,
            "equity_multiple": float(equity_multiple),
            "cash_on_cash_yield": float(cash_on_cash),
            "total_lp_distributions": float(_q(cumulative_distributions)),
            "terminal_value": float(_q(terminal_value)),
            "terminal_net_proceeds": float(_q(terminal_net)) if final_year_num not in sale_by_year else 0.0,
        },
        "yearly_projections": yearly_projections,
        "irr_cashflows": irr_cashflows,
    }


def _compute_irr(cashflows: List[float], max_iterations: int = 1000, tolerance: float = 1e-8) -> Optional[float]:
    """
    Compute IRR using Newton-Raphson method.
    Returns None if IRR cannot be computed.
    """
    if not cashflows or len(cashflows) < 2:
        return None

    # Initial guess
    rate = 0.10

    for _ in range(max_iterations):
        npv = sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))
        dnpv = sum(-t * cf / (1 + rate) ** (t + 1) for t, cf in enumerate(cashflows))

        if abs(dnpv) < 1e-12:
            break

        new_rate = rate - npv / dnpv

        if abs(new_rate - rate) < tolerance:
            return round(new_rate * 100, 2)  # Return as percentage

        rate = new_rate

        # Guard against divergence
        if rate < -0.99 or rate > 10.0:
            return None

    return round(rate * 100, 2) if abs(npv) < 0.01 else None
