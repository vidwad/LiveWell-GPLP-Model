"""
Portfolio Valuation routes: advanced returns metrics, refinance & sale scenarios,
redevelopment scenario comparison, valuation history, and cap rate calculator.
"""
import datetime

from typing import List as _List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as _BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload as _joinedload

from app.core.deps import (
    get_current_user, require_gp_ops_pm, require_gp_or_ops,
    require_investor_or_above,
)
from app.db.models import (
    DevelopmentPlan, Holding, DistributionAllocation, LPEntity,
    Property, RefinanceScenario, SaleScenario, Subscription,
    User, ValuationHistory,
)
from app.db.session import get_db
from app.schemas.portfolio import (
    CapRateValuationInput, CapRateValuationResult,
    RefinanceScenarioCreate, RefinanceScenarioOut,
    SaleScenarioCreate, SaleScenarioOut,
    ValuationCreate, ValuationOut,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Advanced Returns Metrics  (XIRR + Equity Multiple)
# ---------------------------------------------------------------------------


class FundReturnsResult(_BaseModel):
    lp_id: int
    lp_name: str
    total_invested_capital: float
    total_distributions: float
    equity_multiple: float | None
    xirr_percent: float | None
    investor_count: int


class PortfolioReturnsResult(_BaseModel):
    funds: list[FundReturnsResult]
    portfolio_equity_multiple: float | None
    portfolio_xirr_percent: float | None


@router.get("/metrics/returns", response_model=PortfolioReturnsResult)
def portfolio_returns_metrics(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """
    Compute XIRR and equity multiple for each LP fund and the overall portfolio.
    Uses Holding (funded_date + funded_amount) and DistributionAllocation as cash flows.
    """
    from app.services.calculations import calculate_xirr, calculate_equity_multiple

    lps = db.query(LPEntity).all()
    fund_results = []

    portfolio_total_invested = 0.0
    portfolio_total_distributions = 0.0
    portfolio_cash_flows: list[float] = []
    portfolio_dates: list[datetime.date] = []

    for lp in lps:
        holdings = (
            db.query(Holding)
            .join(Subscription, Holding.subscription_id == Subscription.subscription_id)
            .filter(Subscription.lp_id == lp.lp_id)
            .all()
        )

        if not holdings:
            continue

        investor_ids = {h.investor_id for h in holdings}
        holding_ids = [h.holding_id for h in holdings]

        cash_flows: list[float] = []
        dates: list[datetime.date] = []

        for h in holdings:
            # funded_amount and funded_date live on the Subscription, not the Holding
            sub = h.subscription
            if sub and sub.funded_amount and sub.funded_date:
                fd = sub.funded_date if isinstance(sub.funded_date, datetime.date) else sub.funded_date.date()
                cash_flows.append(-float(sub.funded_amount))
                dates.append(fd)
            elif getattr(h, "cost_basis", None):
                # Fallback: use cost_basis as the invested amount with a synthetic date
                cash_flows.append(-float(h.cost_basis))
                # Use subscription accepted_date or a default
                fallback_date = (sub.accepted_date or sub.submitted_date) if sub else None
                if fallback_date:
                    fd = fallback_date if isinstance(fallback_date, datetime.date) else fallback_date.date()
                else:
                    fd = datetime.date(2025, 1, 1)  # default for seed data
                dates.append(fd)

        allocations = (
            db.query(DistributionAllocation)
            .filter(DistributionAllocation.holding_id.in_(holding_ids))
            .all()
        )
        total_distributions = 0.0
        for alloc in allocations:
            amount = float(alloc.amount or 0)
            if amount > 0:
                event = alloc.event
                alloc_date = None
                if event:
                    raw_dt = event.paid_date or event.approved_date or event.created_date
                    if raw_dt:
                        alloc_date = raw_dt.date() if hasattr(raw_dt, "date") else raw_dt
                if alloc_date:
                    cash_flows.append(amount)
                    dates.append(alloc_date)
                total_distributions += amount

        total_invested = sum(-cf for cf in cash_flows if cf < 0)

        xirr_result = calculate_xirr(cash_flows, dates) if len(cash_flows) >= 2 else None
        em = calculate_equity_multiple(total_distributions, total_invested)

        fund_results.append(FundReturnsResult(
            lp_id=lp.lp_id,
            lp_name=lp.name,
            total_invested_capital=round(total_invested, 2),
            total_distributions=round(total_distributions, 2),
            equity_multiple=em,
            xirr_percent=round(xirr_result * 100, 2) if xirr_result is not None else None,
            investor_count=len(investor_ids),
        ))

        portfolio_total_invested += total_invested
        portfolio_total_distributions += total_distributions
        portfolio_cash_flows.extend(cash_flows)
        portfolio_dates.extend(dates)

    portfolio_em = calculate_equity_multiple(portfolio_total_distributions, portfolio_total_invested)
    portfolio_xirr = None
    if len(portfolio_cash_flows) >= 2:
        combined = sorted(zip(portfolio_dates, portfolio_cash_flows))
        p_dates = [d for d, _ in combined]
        p_cfs = [cf for _, cf in combined]
        raw = calculate_xirr(p_cfs, p_dates)
        portfolio_xirr = round(raw * 100, 2) if raw is not None else None

    return PortfolioReturnsResult(
        funds=fund_results,
        portfolio_equity_multiple=portfolio_em,
        portfolio_xirr_percent=portfolio_xirr,
    )


# ---------------------------------------------------------------------------
# Phase 5: Refinance & Sale Scenarios
# ---------------------------------------------------------------------------


def _calc_refinance(scenario: RefinanceScenario) -> RefinanceScenarioOut:
    new_loan = round(float(scenario.assumed_new_valuation) * float(scenario.new_ltv_percent) / 100, 2)
    debt_payout = float(scenario.existing_debt_payout or 0)
    closing = float(scenario.closing_costs or 0)
    net_proceeds = round(new_loan - debt_payout - closing, 2)

    # ROI calculations
    equity = float(scenario.total_equity_invested or 0)
    noi = float(scenario.annual_noi_at_refi or 0)
    hold_months = scenario.hold_period_months

    equity_multiple = None
    cash_on_cash = None
    annualized_roi = None

    if equity > 0:
        equity_multiple = round((net_proceeds + equity) / equity, 2)
        if noi > 0:
            cash_on_cash = round(noi / equity * 100, 2)
        if hold_months and hold_months > 0:
            hold_years = hold_months / 12
            total_gain = net_proceeds  # cash freed from refi
            annualized_roi = round(((1 + total_gain / equity) ** (1 / hold_years) - 1) * 100, 2) if total_gain > -equity else None

    # Linked milestone title
    milestone_title = None
    if scenario.linked_milestone:
        milestone_title = scenario.linked_milestone.title

    return RefinanceScenarioOut(
        scenario_id=scenario.scenario_id,
        property_id=scenario.property_id,
        label=scenario.label,
        assumed_new_valuation=float(scenario.assumed_new_valuation),
        new_ltv_percent=float(scenario.new_ltv_percent),
        new_interest_rate=float(scenario.new_interest_rate) if scenario.new_interest_rate else None,
        new_amortization_months=scenario.new_amortization_months,
        existing_debt_payout=debt_payout,
        closing_costs=closing,
        notes=scenario.notes,
        new_loan_amount=new_loan,
        net_proceeds=net_proceeds,
        created_at=scenario.created_at,
        expected_date=scenario.expected_date,
        linked_milestone_id=scenario.linked_milestone_id,
        linked_event=scenario.linked_event,
        total_equity_invested=equity if equity else None,
        annual_noi_at_refi=noi if noi else None,
        hold_period_months=hold_months,
        equity_multiple=equity_multiple,
        cash_on_cash_return=cash_on_cash,
        annualized_roi=annualized_roi,
        linked_milestone_title=milestone_title,
    )


def _calc_sale(scenario: SaleScenario) -> SaleScenarioOut:
    price = float(scenario.assumed_sale_price)
    selling_costs = round(price * float(scenario.selling_costs_percent) / 100, 2)
    debt_payout = float(scenario.debt_payout or 0)
    reserves = float(scenario.capital_gains_reserve or 0)
    net_proceeds = round(price - selling_costs - debt_payout - reserves, 2)

    # ROI calculations
    equity = float(scenario.total_equity_invested or 0)
    noi = float(scenario.annual_noi_at_sale or 0)
    hold_months = scenario.hold_period_months
    annual_cf = float(scenario.annual_cash_flow or 0)

    total_return = None
    equity_multiple = None
    irr_estimate = None
    cash_on_cash = None
    cap_rate_val = None

    if equity > 0:
        hold_years = (hold_months / 12) if hold_months and hold_months > 0 else 0
        cumulative_cf = annual_cf * hold_years if hold_years > 0 else 0
        total_return = round(net_proceeds + cumulative_cf - equity, 2)
        equity_multiple = round((net_proceeds + cumulative_cf) / equity, 2)
        if annual_cf > 0:
            cash_on_cash = round(annual_cf / equity * 100, 2)
        if hold_years > 0 and total_return > -equity:
            irr_estimate = round(((1 + (net_proceeds + cumulative_cf - equity) / equity) ** (1 / hold_years) - 1) * 100, 2)

    if price > 0 and noi > 0:
        cap_rate_val = round(noi / price * 100, 2)

    # Linked milestone title
    milestone_title = None
    if scenario.linked_milestone:
        milestone_title = scenario.linked_milestone.title

    return SaleScenarioOut(
        scenario_id=scenario.scenario_id,
        property_id=scenario.property_id,
        label=scenario.label,
        assumed_sale_price=price,
        selling_costs_percent=float(scenario.selling_costs_percent),
        debt_payout=debt_payout,
        capital_gains_reserve=reserves,
        notes=scenario.notes,
        selling_costs=selling_costs,
        net_proceeds=net_proceeds,
        created_at=scenario.created_at,
        expected_date=scenario.expected_date,
        linked_milestone_id=scenario.linked_milestone_id,
        linked_event=scenario.linked_event,
        total_equity_invested=equity if equity else None,
        annual_noi_at_sale=noi if noi else None,
        hold_period_months=hold_months,
        annual_cash_flow=annual_cf if annual_cf else None,
        total_return=total_return,
        equity_multiple=equity_multiple,
        irr_estimate=irr_estimate,
        cash_on_cash_return=cash_on_cash,
        cap_rate=cap_rate_val,
        linked_milestone_title=milestone_title,
    )


@router.get("/properties/{property_id}/refinance-scenarios", response_model=_List[RefinanceScenarioOut])
def list_refinance_scenarios(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    return [_calc_refinance(s) for s in db.query(RefinanceScenario).options(_joinedload(RefinanceScenario.linked_milestone)).filter(RefinanceScenario.property_id == property_id).all()]


@router.post("/properties/{property_id}/refinance-scenarios", response_model=RefinanceScenarioOut, status_code=status.HTTP_201_CREATED)
def create_refinance_scenario(
    property_id: int,
    payload: RefinanceScenarioCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    scenario = RefinanceScenario(property_id=property_id, **payload.model_dump())
    db.add(scenario)
    try:
        db.commit()
        db.refresh(scenario)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return _calc_refinance(scenario)


@router.delete("/refinance-scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_refinance_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    s = db.query(RefinanceScenario).filter(RefinanceScenario.scenario_id == scenario_id).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
    db.delete(s)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/properties/{property_id}/sale-scenarios", response_model=_List[SaleScenarioOut])
def list_sale_scenarios(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    return [_calc_sale(s) for s in db.query(SaleScenario).options(_joinedload(SaleScenario.linked_milestone)).filter(SaleScenario.property_id == property_id).all()]


@router.post("/properties/{property_id}/sale-scenarios", response_model=SaleScenarioOut, status_code=status.HTTP_201_CREATED)
def create_sale_scenario(
    property_id: int,
    payload: SaleScenarioCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    scenario = SaleScenario(property_id=property_id, **payload.model_dump())
    db.add(scenario)
    try:
        db.commit()
        db.refresh(scenario)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return _calc_sale(scenario)


@router.delete("/sale-scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    s = db.query(SaleScenario).filter(SaleScenario.scenario_id == scenario_id).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
    db.delete(s)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Phase 5: Redevelopment Scenario Comparison
# ---------------------------------------------------------------------------

@router.get("/properties/{property_id}/plans/compare")
def compare_development_plans(
    property_id: int,
    plan_ids: str,   # comma-separated list of plan IDs e.g. "1,2,3"
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    """
    Side-by-side comparison of multiple DevelopmentPlan versions for a property.
    Pass ?plan_ids=1,2,3 (comma-separated).
    Returns cost breakdown, NOI, debt impact, and projected valuation for each plan.
    """
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")

    try:
        ids = [int(i.strip()) for i in plan_ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(400, "plan_ids must be comma-separated integers")

    plans = (
        db.query(DevelopmentPlan)
        .filter(
            DevelopmentPlan.plan_id.in_(ids),
            DevelopmentPlan.property_id == property_id,
        )
        .all()
    )

    if not plans:
        raise HTTPException(404, "No plans found for this property with the given IDs")

    comparison = []
    for plan in plans:
        total_cost = float(plan.estimated_construction_cost or 0)
        noi = float(plan.projected_annual_noi or 0)
        revenue = float(plan.projected_annual_revenue or 0)

        # Implied cap rate valuation at 5.5% cap rate
        implied_valuation = round(noi / 0.055, 2) if noi > 0 else None

        # Debt impact: estimate 65% LTV on implied valuation
        estimated_debt = round(implied_valuation * 0.65, 2) if implied_valuation else None
        equity_required = round(total_cost - (estimated_debt or 0), 2) if total_cost > 0 else None

        comparison.append({
            "plan_id": plan.plan_id,
            "version": plan.version,
            "status": plan.status.value,
            "planned_units": plan.planned_units,
            "planned_beds": plan.planned_beds,
            "planned_sqft": float(plan.planned_sqft or 0),
            "cost_breakdown": {
                "hard_costs": float(plan.hard_costs or 0),
                "soft_costs": float(plan.soft_costs or 0),
                "site_costs": float(plan.site_costs or 0),
                "financing_costs": float(plan.financing_costs or 0),
                "total_estimated_cost": total_cost,
                "cost_per_sqft": float(plan.cost_per_sqft or 0),
            },
            "income": {
                "projected_annual_revenue": revenue,
                "projected_annual_noi": noi,
                "noi_margin_percent": round(noi / revenue * 100, 1) if revenue > 0 else None,
            },
            "valuation": {
                "implied_valuation_at_5_5_cap": implied_valuation,
                "estimated_debt_at_65_ltv": estimated_debt,
                "estimated_equity_required": equity_required,
            },
            "timeline": {
                "development_start_date": str(plan.development_start_date) if plan.development_start_date else None,
                "estimated_completion_date": str(plan.estimated_completion_date) if plan.estimated_completion_date else None,
                "estimated_stabilization_date": str(plan.estimated_stabilization_date) if plan.estimated_stabilization_date else None,
                "construction_duration_days": plan.construction_duration_days,
            },
        })

    return {"property_id": property_id, "plans_compared": len(comparison), "comparison": comparison}


# ---------------------------------------------------------------------------
# Phase 6: Valuation History
# ---------------------------------------------------------------------------


@router.get("/properties/{property_id}/valuations", response_model=_List[ValuationOut])
def list_valuations(
    property_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """List all valuation records for a property, newest first."""
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    return (
        db.query(ValuationHistory)
        .filter(ValuationHistory.property_id == property_id)
        .order_by(ValuationHistory.valuation_date.desc())
        .all()
    )


@router.post(
    "/properties/{property_id}/valuations",
    response_model=ValuationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_valuation(
    property_id: int,
    payload: ValuationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Record a new valuation for a property and optionally update current_market_value."""
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    val = ValuationHistory(
        property_id=property_id,
        created_by=current_user.user_id,
        **payload.model_dump(),
    )
    db.add(val)

    # Also update the property's current_market_value to the latest valuation
    prop.current_market_value = payload.value
    try:
        db.commit()
        db.refresh(val)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return val


@router.delete("/valuations/{valuation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_valuation(
    valuation_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    v = db.query(ValuationHistory).filter(ValuationHistory.valuation_id == valuation_id).first()
    if not v:
        raise HTTPException(404, "Valuation not found")
    db.delete(v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Task 1: Cap Rate / Income Approach Valuation Calculator
# ---------------------------------------------------------------------------


@router.post("/properties/{property_id}/valuations/cap-rate", response_model=CapRateValuationResult)
def calculate_cap_rate_valuation(
    property_id: int,
    payload: CapRateValuationInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Calculate property value using the income approach (NOI / Cap Rate).

    Optionally auto-creates a valuation record and updates the property's current_market_value.
    """
    from decimal import Decimal, ROUND_HALF_UP

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if payload.cap_rate <= 0:
        raise HTTPException(400, "Cap rate must be greater than 0")

    noi = Decimal(str(payload.noi))
    cap_rate_pct = Decimal(str(payload.cap_rate))
    cap_rate_decimal = cap_rate_pct / Decimal("100")
    estimated_value = (noi / cap_rate_decimal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Value per unit and per sqft from active development plan
    plan = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.property_id == property_id)
        .order_by(DevelopmentPlan.plan_id.desc())
        .first()
    )
    value_per_unit = None
    value_per_sqft = None
    if plan:
        if plan.planned_units and plan.planned_units > 0:
            value_per_unit = (estimated_value / Decimal(str(plan.planned_units))).quantize(Decimal("0.01"))
        if plan.planned_sqft and plan.planned_sqft > 0:
            value_per_sqft = (estimated_value / Decimal(str(plan.planned_sqft))).quantize(Decimal("0.01"))

    return CapRateValuationResult(
        noi=noi,
        cap_rate=cap_rate_pct,
        estimated_value=estimated_value,
        value_per_unit=value_per_unit,
        value_per_sqft=value_per_sqft,
    )


@router.post("/properties/{property_id}/valuations/cap-rate/save", response_model=ValuationOut, status_code=status.HTTP_201_CREATED)
def save_cap_rate_valuation(
    property_id: int,
    payload: CapRateValuationInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Calculate cap rate valuation AND save it as a valuation record."""
    from decimal import Decimal, ROUND_HALF_UP
    import datetime as _dt

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    if payload.cap_rate <= 0:
        raise HTTPException(400, "Cap rate must be greater than 0")

    noi = Decimal(str(payload.noi))
    cap_rate_decimal = Decimal(str(payload.cap_rate)) / Decimal("100")
    estimated_value = (noi / cap_rate_decimal).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    val = ValuationHistory(
        property_id=property_id,
        valuation_date=_dt.date.today(),
        value=estimated_value,
        method="cap_rate",
        notes=f"Income approach: NOI ${noi:,.2f} / Cap Rate {payload.cap_rate}%",
        created_by=current_user.user_id,
    )
    db.add(val)
    prop.current_market_value = estimated_value
    try:
        db.commit()
        db.refresh(val)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return val
