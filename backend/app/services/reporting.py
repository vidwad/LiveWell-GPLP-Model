from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy.orm import Session

from app.db.models import (
    Community, DebtFacility, DevelopmentPlan, DistributionAllocation,
    Holding, Investor, LPEntity, OperatorBudget, OperatingExpense,
    Property, Subscription, Unit,
)
from app.services.calculations import (
    calculate_noi, calculate_annual_debt_service, calculate_ltv,
    calculate_equity_multiple, calculate_xirr,
)


# ---------------------------------------------------------------------------
# LP Roll-up Engine
# ---------------------------------------------------------------------------

@dataclass
class PropertyRollup:
    property_id: int
    address: str
    development_stage: str
    market_value: float
    total_debt: float
    equity_value: float
    noi: float
    annual_debt_service: float
    cash_flow: float
    ltv_percent: Optional[float]
    dscr: Optional[float]


@dataclass
class LPRollup:
    lp_id: int
    lp_name: str
    property_count: int
    total_portfolio_value: float
    total_debt_outstanding: float
    lp_equity_value: float          # Portfolio Value - Total Debt
    projected_annual_cash_flow: float
    total_noi: float
    portfolio_ltv: Optional[float]
    portfolio_dscr: Optional[float]
    properties: List[PropertyRollup] = field(default_factory=list)


class LPRollupEngine:
    """
    Aggregates financial metrics across all properties linked to an LPEntity,
    computing total portfolio value, debt, equity, and projected cash flow.
    """

    def __init__(self, db: Session):
        self.db = db

    def rollup_lp(self, lp: LPEntity) -> LPRollup:
        properties = (
            self.db.query(Property)
            .filter(Property.lp_id == lp.lp_id)
            .all()
        )

        prop_rollups: List[PropertyRollup] = []
        total_value = 0.0
        total_debt = 0.0
        total_noi = 0.0
        total_ads = 0.0

        for prop in properties:
            # Valuation
            val = float(
                prop.current_market_value or prop.estimated_value or prop.purchase_price or 0
            )
            total_value += val

            # Debt
            debts = (
                self.db.query(DebtFacility)
                .filter(
                    DebtFacility.property_id == prop.property_id,
                    DebtFacility.status == "active",
                )
                .all()
            )
            prop_debt = sum(float(d.outstanding_balance or 0) for d in debts)
            total_debt += prop_debt

            prop_ads = 0.0
            for d in debts:
                if d.outstanding_balance and d.interest_rate:
                    prop_ads += calculate_annual_debt_service(
                        float(d.outstanding_balance),
                        float(d.interest_rate),
                        d.amortization_months or 0,
                        d.io_period_months or 0,
                    )
            total_ads += prop_ads

            # NOI
            prop_noi = 0.0
            active_plans = [
                p for p in prop.development_plans
                if p.status.value in ("active", "approved")
            ]
            if active_plans:
                plan = active_plans[0]
                if plan.projected_annual_noi:
                    prop_noi = float(plan.projected_annual_noi)
                elif plan.planned_units and plan.planned_units > 0:
                    gross_rev = plan.planned_units * 1500 * 12
                    noi_dict = calculate_noi(
                        gross_potential_revenue=gross_rev,
                        operating_expenses=gross_rev * 0.30,
                    )
                    prop_noi = noi_dict["noi"]
            total_noi += prop_noi

            ltv_pct = round(prop_debt / val * 100, 2) if val > 0 else None
            dscr = round(prop_noi / prop_ads, 2) if prop_ads > 0 else None

            prop_rollups.append(PropertyRollup(
                property_id=prop.property_id,
                address=prop.address,
                development_stage=prop.development_stage.value,
                market_value=round(val, 2),
                total_debt=round(prop_debt, 2),
                equity_value=round(val - prop_debt, 2),
                noi=round(prop_noi, 2),
                annual_debt_service=round(prop_ads, 2),
                cash_flow=round(prop_noi - prop_ads, 2),
                ltv_percent=ltv_pct,
                dscr=dscr,
            ))

        portfolio_ltv = round(total_debt / total_value * 100, 2) if total_value > 0 else None
        portfolio_dscr = round(total_noi / total_ads, 2) if total_ads > 0 else None

        return LPRollup(
            lp_id=lp.lp_id,
            lp_name=lp.name,
            property_count=len(properties),
            total_portfolio_value=round(total_value, 2),
            total_debt_outstanding=round(total_debt, 2),
            lp_equity_value=round(total_value - total_debt, 2),
            projected_annual_cash_flow=round(total_noi - total_ads, 2),
            total_noi=round(total_noi, 2),
            portfolio_ltv=portfolio_ltv,
            portfolio_dscr=portfolio_dscr,
            properties=prop_rollups,
        )

    def rollup_all(self) -> List[LPRollup]:
        lps = self.db.query(LPEntity).all()
        return [self.rollup_lp(lp) for lp in lps]


# ---------------------------------------------------------------------------
# Fund Performance Report (uses LPRollupEngine)
# ---------------------------------------------------------------------------

def generate_fund_performance_report(db: Session) -> dict:
    """Generate a performance report rolled up by LP Entity."""
    engine = LPRollupEngine(db)
    rollups = engine.rollup_all()

    report = [
        {
            "lp_id": r.lp_id,
            "lp_name": r.lp_name,
            "property_count": r.property_count,
            "total_value": r.total_portfolio_value,
            "total_debt": r.total_debt_outstanding,
            "total_equity": r.lp_equity_value,
            "total_noi": r.total_noi,
            "projected_annual_cash_flow": r.projected_annual_cash_flow,
            "portfolio_ltv": r.portfolio_ltv,
            "portfolio_dscr": r.portfolio_dscr,
            "properties": [
                {
                    "property_id": p.property_id,
                    "address": p.address,
                    "development_stage": p.development_stage,
                    "market_value": p.market_value,
                    "total_debt": p.total_debt,
                    "equity_value": p.equity_value,
                    "noi": p.noi,
                    "cash_flow": p.cash_flow,
                    "ltv_percent": p.ltv_percent,
                    "dscr": p.dscr,
                }
                for p in r.properties
            ],
        }
        for r in rollups
    ]

    return {"funds": report}


# ---------------------------------------------------------------------------
# GP Monthly Management Pack
# ---------------------------------------------------------------------------

def generate_management_pack(db: Session) -> dict:
    """
    Aggregate a GP management pack report covering:
    - LP Summary (capital raised, equity value)
    - Property Summary (occupancy, NOI)
    - Development Update (active projects, budget variance)
    - Operator Budget Issues (variances)
    """

    # 1. LP Summary
    lp_rollup_engine = LPRollupEngine(db)
    rollups = lp_rollup_engine.rollup_all()

    lp_summary = []
    for r in rollups:
        # Capital raised from subscriptions
        subs = (
            db.query(Subscription)
            .filter(Subscription.lp_id == r.lp_id)
            .all()
        )
        capital_raised = sum(float(s.funded_amount or 0) for s in subs)
        capital_committed = sum(float(s.commitment_amount or 0) for s in subs)

        # Total distributions
        holdings = db.query(Holding).filter(Holding.lp_id == r.lp_id).all()
        holding_ids = [h.holding_id for h in holdings]
        total_distributions = 0.0
        if holding_ids:
            allocs = (
                db.query(DistributionAllocation)
                .filter(DistributionAllocation.holding_id.in_(holding_ids))
                .all()
            )
            total_distributions = sum(float(a.amount or 0) for a in allocs)

        lp_summary.append({
            "lp_id": r.lp_id,
            "lp_name": r.lp_name,
            "capital_committed": round(capital_committed, 2),
            "capital_raised": round(capital_raised, 2),
            "equity_value": r.lp_equity_value,
            "total_distributions": round(total_distributions, 2),
            "equity_multiple": calculate_equity_multiple(total_distributions, capital_raised),
        })

    # 2. Property Summary (occupancy + NOI)
    properties = db.query(Property).all()
    total_units = db.query(Unit).count()
    occupied_units = db.query(Unit).filter(Unit.is_occupied == True).count()
    portfolio_occupancy = round(occupied_units / total_units * 100, 1) if total_units else 0.0

    prop_summary = []
    for prop in properties:
        units = db.query(Unit).filter(
            Unit.community_id == prop.community.community_id
        ).all() if prop.community else []
        total_u = len(units)
        occupied_u = sum(1 for u in units if u.is_occupied)
        occ_rate = round(occupied_u / total_u * 100, 1) if total_u else None

        active_plans = [p for p in prop.development_plans if p.status.value in ("active", "approved")]
        noi = float(active_plans[0].projected_annual_noi) if active_plans and active_plans[0].projected_annual_noi else None

        prop_summary.append({
            "property_id": prop.property_id,
            "address": prop.address,
            "development_stage": prop.development_stage.value,
            "total_units": total_u,
            "occupied_units": occupied_u,
            "occupancy_rate": occ_rate,
            "projected_annual_noi": noi,
        })

    # 3. Development Update (active construction plans)
    active_plans = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.status.in_(["active", "approved"]))
        .all()
    )
    dev_update = []
    for plan in active_plans:
        estimated = float(plan.estimated_construction_cost or 0)
        actual_hard = float(plan.hard_costs or 0)
        budget_variance = round(actual_hard - estimated, 2) if actual_hard and estimated else None

        dev_update.append({
            "plan_id": plan.plan_id,
            "property_id": plan.property_id,
            "version": plan.version,
            "status": plan.status.value,
            "planned_units": plan.planned_units,
            "estimated_construction_cost": estimated,
            "hard_costs": actual_hard,
            "budget_variance": budget_variance,
            "development_start_date": str(plan.development_start_date) if plan.development_start_date else None,
            "estimated_completion_date": str(plan.estimated_completion_date) if plan.estimated_completion_date else None,
        })

    # 4. Operator Budget Issues
    budget_issues = []
    try:
        budgets = db.query(OperatorBudget).all()
        for budget in budgets:
            expenses = (
                db.query(OperatingExpense)
                .filter(OperatingExpense.budget_id == budget.budget_id)
                .all()
            )
            total_actual = sum(float(e.actual_amount or 0) for e in expenses)
            total_budgeted = sum(float(e.budgeted_amount or 0) for e in expenses)
            variance = round(total_actual - total_budgeted, 2)
            if abs(variance) > 1000:  # Only flag material variances
                budget_issues.append({
                    "budget_id": budget.budget_id,
                    "operator_id": budget.operator_id,
                    "period": f"{budget.period_year}-Q{budget.period_quarter}" if hasattr(budget, "period_quarter") else str(budget.period_year),
                    "total_budgeted": round(total_budgeted, 2),
                    "total_actual": round(total_actual, 2),
                    "variance": variance,
                    "is_over_budget": variance > 0,
                })
    except Exception:
        pass  # OperatorBudget may not have all expected fields in all envs

    return {
        "generated_at": datetime.datetime.utcnow().isoformat(),
        "lp_summary": lp_summary,
        "property_summary": prop_summary,
        "portfolio_occupancy_rate": portfolio_occupancy,
        "development_update": dev_update,
        "operator_budget_issues": budget_issues,
    }
