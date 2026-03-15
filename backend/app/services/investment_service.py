"""
Investment Service Layer
========================
Centralises all heavy computations for the investment domain:
  - LP summary / detail roll-ups
  - Holding ownership percentage (computed from units)
  - Portfolio roll-up (target + actual properties)
  - European-style distribution waterfall (4-tier)

All functions accept a SQLAlchemy Session and return plain dicts or
Pydantic-compatible structures so route handlers stay thin.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import models as m

ZERO = Decimal("0")
TWO = Decimal("0.01")
FOUR = Decimal("0.0001")


# ── helpers ────────────────────────────────────────────────────────────────

def _d(val: Any) -> Decimal:
    """Safely coerce a value to Decimal."""
    if val is None:
        return ZERO
    return Decimal(str(val))


def _pct(numerator: Decimal, denominator: Decimal) -> Decimal:
    """Return percentage with 4 decimal places, or 0 if denominator is 0."""
    if denominator == ZERO:
        return ZERO
    return (numerator / denominator * Decimal("100")).quantize(FOUR, rounding=ROUND_HALF_UP)


# ── Holding ownership (unit-based) ────────────────────────────────────────

def compute_holdings_with_ownership(
    db: Session, lp_id: int
) -> List[Dict[str, Any]]:
    """
    Fetch all holdings for an LP and compute ownership_percent and cost_basis
    dynamically from unit counts.

    ownership_percent = units_held / total_units_outstanding * 100
    cost_basis        = units_held * average_issue_price
    """
    holdings = (
        db.query(m.Holding)
        .filter(m.Holding.lp_id == lp_id, m.Holding.status == "active")
        .all()
    )

    total_units = sum(_d(h.units_held) for h in holdings)

    results = []
    for h in holdings:
        units = _d(h.units_held)
        avg_price = _d(h.average_issue_price)
        investor = db.query(m.Investor).get(h.investor_id)

        results.append({
            "holding_id": h.holding_id,
            "investor_id": h.investor_id,
            "lp_id": h.lp_id,
            "subscription_id": h.subscription_id,
            "investor_name": investor.name if investor else None,
            "lp_name": None,  # filled by caller if needed
            "units_held": units,
            "average_issue_price": avg_price,
            "total_capital_contributed": _d(h.total_capital_contributed),
            "initial_issue_date": h.initial_issue_date,
            "unreturned_capital": _d(h.unreturned_capital),
            "unpaid_preferred": _d(h.unpaid_preferred),
            "is_gp": h.is_gp,
            "status": h.status,
            # Computed fields
            "ownership_percent": _pct(units, total_units),
            "cost_basis": (units * avg_price).quantize(TWO, rounding=ROUND_HALF_UP),
        })

    return results


# ── LP Summary ─────────────────────────────────────────────────────────────

def compute_lp_summary(db: Session, lp_id: int) -> Dict[str, Any]:
    """
    Compute all derived / aggregate fields for an LP detail view.
    Returns a dict that can be merged into the LP response.
    """
    lp = db.query(m.LPEntity).get(lp_id)
    if not lp:
        return {}

    # Subscription aggregates
    subs = db.query(m.Subscription).filter(m.Subscription.lp_id == lp_id).all()
    total_committed = sum(_d(s.commitment_amount) for s in subs)
    total_funded = sum(_d(s.funded_amount) for s in subs)
    total_units_issued = sum(_d(s.unit_quantity) for s in subs if s.status in ("funded", "issued", "closed"))
    gross_subs = total_committed
    accepted_subs = sum(_d(s.commitment_amount) for s in subs if s.status in ("accepted", "funded", "issued", "closed"))
    funded_subs = sum(_d(s.commitment_amount) for s in subs if s.status in ("funded", "issued", "closed"))

    target = _d(lp.target_raise)
    max_raise = _d(lp.maximum_raise) or target
    remaining_capacity = max(ZERO, max_raise - total_committed)

    # Unique investor count
    investor_ids = set(s.investor_id for s in subs)
    investor_count = len(investor_ids)

    # Holdings
    holdings = db.query(m.Holding).filter(m.Holding.lp_id == lp_id).all()
    holding_count = len(holdings)

    # Properties (actual)
    property_count = db.query(func.count(m.Property.property_id)).filter(
        m.Property.lp_id == lp_id
    ).scalar() or 0

    # Target properties
    target_property_count = db.query(func.count(m.TargetProperty.target_property_id)).filter(
        m.TargetProperty.lp_id == lp_id
    ).scalar() or 0

    # Capital deployment
    formation = _d(lp.formation_costs)
    offering = _d(lp.offering_costs)
    reserve_pct = _d(lp.reserve_percent)
    reserve_fixed = _d(lp.reserve_amount)
    reserve_alloc = reserve_fixed if reserve_fixed > ZERO else (total_funded * reserve_pct / Decimal("100"))
    total_formation_costs = formation + offering
    net_deployable = total_funded - total_formation_costs - reserve_alloc

    # Capital deployed = sum of actual property purchase prices
    capital_deployed = db.query(func.coalesce(func.sum(m.Property.purchase_price), 0)).filter(
        m.Property.lp_id == lp_id
    ).scalar()
    capital_deployed = _d(capital_deployed)
    capital_available = net_deployable - capital_deployed

    return {
        "total_committed": total_committed,
        "total_funded": total_funded,
        "total_units_issued": total_units_issued,
        "subscription_count": len(subs),
        "holding_count": holding_count,
        "property_count": property_count,
        "target_property_count": target_property_count,
        "investor_count": investor_count,
        "gross_subscriptions": gross_subs,
        "accepted_subscriptions": accepted_subs,
        "funded_subscriptions": funded_subs,
        "remaining_capacity": remaining_capacity,
        "total_formation_costs": total_formation_costs,
        "total_reserve_allocations": reserve_alloc,
        "net_deployable_capital": net_deployable,
        "capital_deployed": capital_deployed,
        "capital_available": capital_available,
    }


# ── Portfolio Roll-up ──────────────────────────────────────────────────────

def compute_portfolio_rollup(db: Session, lp_id: int) -> Dict[str, Any]:
    """
    Aggregate target + actual property data for an LP.
    Returns projected returns based on stabilised pro-forma assumptions.
    """
    lp = db.query(m.LPEntity).get(lp_id)
    if not lp:
        return {}

    # Target properties
    targets = db.query(m.TargetProperty).filter(m.TargetProperty.lp_id == lp_id).all()
    t_count = len(targets)
    t_acq = sum(_d(t.estimated_acquisition_price) for t in targets)
    t_constr = sum(_d(t.construction_budget) for t in targets)
    t_all_in = t_acq + t_constr
    t_noi = sum(_d(t.stabilized_annual_noi) for t in targets)
    t_value = sum(_d(t.stabilized_value) for t in targets)
    t_debt = sum(_d(t.assumed_debt_amount) for t in targets)
    t_equity = t_all_in - t_debt
    t_units = sum(t.planned_units or 0 for t in targets)
    t_beds = sum(t.planned_beds or 0 for t in targets)

    # Actual properties
    props = db.query(m.Property).filter(m.Property.lp_id == lp_id).all()
    a_count = len(props)
    a_purchase = sum(_d(p.purchase_price) for p in props)
    a_market = sum(_d(p.current_market_value or p.estimated_value or p.purchase_price) for p in props)

    # Projected returns (based on target properties)
    lp_summary = compute_lp_summary(db, lp_id)
    total_funded = _d(lp_summary.get("total_funded", 0))
    total_equity_invested = total_funded  # full upfront funding

    projected_portfolio_value = t_value + a_market
    projected_lp_equity = projected_portfolio_value - t_debt
    projected_annual_noi = t_noi

    # Cash-on-cash = annual NOI / total equity invested
    projected_coc = ZERO
    if total_equity_invested > ZERO:
        projected_coc = (projected_annual_noi / total_equity_invested * Decimal("100")).quantize(TWO)

    # Equity multiple = projected equity value / total equity invested
    projected_em = ZERO
    if total_equity_invested > ZERO:
        projected_em = (projected_lp_equity / total_equity_invested).quantize(TWO)

    return {
        "lp_id": lp_id,
        "lp_name": lp.name,
        "target_property_count": t_count,
        "total_target_acquisition_cost": t_acq,
        "total_target_construction_budget": t_constr,
        "total_target_all_in_cost": t_all_in,
        "total_target_stabilized_noi": t_noi,
        "total_target_stabilized_value": t_value,
        "total_target_debt": t_debt,
        "total_target_equity_required": t_equity,
        "actual_property_count": a_count,
        "total_actual_purchase_price": a_purchase,
        "total_actual_market_value": a_market,
        "total_planned_units": t_units,
        "total_planned_beds": t_beds,
        "projected_portfolio_value": projected_portfolio_value,
        "projected_lp_equity_value": projected_lp_equity,
        "projected_annual_noi": projected_annual_noi,
        "projected_cash_on_cash": projected_coc,
        "projected_equity_multiple": projected_em,
        "projected_irr": None,  # IRR requires time-series cash flows; placeholder
    }


# ── European-Style Distribution Waterfall (4-Tier) ─────────────────────────

def compute_waterfall(
    db: Session,
    lp_id: int,
    distributable_amount: Decimal,
) -> Dict[str, Any]:
    """
    Compute a European-style (whole-fund) distribution waterfall.

    Tiers:
      1. Return of Capital (ROC) — pro-rata to all holders by unreturned capital
      2. Preferred Return — to LP holders only, based on accrued preferred
      3. GP Catch-up — GP receives until total GP share = gp_promote_percent of total
      4. Carried Interest — remaining split LP/GP per fund terms

    Returns a dict with tier totals and per-holding allocations.
    """
    lp = db.query(m.LPEntity).get(lp_id)
    if not lp:
        return {"error": "LP not found"}

    pref_rate = _d(lp.preferred_return_rate) / Decimal("100") if lp.preferred_return_rate else ZERO
    gp_promote = _d(lp.gp_promote_percent) / Decimal("100") if lp.gp_promote_percent else Decimal("0.20")
    gp_catchup_pct = _d(lp.gp_catchup_percent) / Decimal("100") if lp.gp_catchup_percent else Decimal("1.00")

    holdings = (
        db.query(m.Holding)
        .filter(m.Holding.lp_id == lp_id, m.Holding.status == "active")
        .all()
    )
    if not holdings:
        return {"error": "No active holdings"}

    total_units = sum(_d(h.units_held) for h in holdings)
    remaining = _d(distributable_amount)

    # Initialise per-holding allocation tracking
    alloc = {}
    for h in holdings:
        investor = db.query(m.Investor).get(h.investor_id)
        alloc[h.holding_id] = {
            "holding_id": h.holding_id,
            "investor_id": h.investor_id,
            "investor_name": investor.name if investor else "Unknown",
            "is_gp": h.is_gp,
            "units_held": _d(h.units_held),
            "unreturned_capital": _d(h.unreturned_capital),
            "unpaid_preferred": _d(h.unpaid_preferred),
            "tier1_roc": ZERO,
            "tier2_preferred": ZERO,
            "tier3_catchup": ZERO,
            "tier4_carry": ZERO,
            "total": ZERO,
        }

    # ── Tier 1: Return of Capital ──────────────────────────────────────
    total_unreturned = sum(a["unreturned_capital"] for a in alloc.values())
    tier1_pool = min(remaining, total_unreturned)

    if tier1_pool > ZERO and total_unreturned > ZERO:
        for a in alloc.values():
            share = (a["unreturned_capital"] / total_unreturned * tier1_pool).quantize(TWO)
            a["tier1_roc"] = share
            a["unreturned_capital"] -= share
    remaining -= tier1_pool

    # ── Tier 2: Preferred Return (LP holders only) ─────────────────────
    # Preferred = accrued preferred on unreturned capital
    # For simplicity, use unpaid_preferred stored on each holding
    # In production, this would accrue based on time periods
    lp_holdings = [a for a in alloc.values() if not a["is_gp"]]
    total_preferred_owed = sum(a["unpaid_preferred"] for a in lp_holdings)
    tier2_pool = min(remaining, total_preferred_owed)

    if tier2_pool > ZERO and total_preferred_owed > ZERO:
        for a in lp_holdings:
            share = (a["unpaid_preferred"] / total_preferred_owed * tier2_pool).quantize(TWO)
            a["tier2_preferred"] = share
            a["unpaid_preferred"] -= share
    remaining -= tier2_pool

    # ── Tier 3: GP Catch-up ────────────────────────────────────────────
    # GP should receive gp_promote_percent of total distributions so far.
    # After Tier 1+2, GP has only received tier1_roc.
    # GP catch-up continues until GP total = gp_promote * total_distributed.
    total_distributed_so_far = tier1_pool + tier2_pool
    gp_holdings = [a for a in alloc.values() if a["is_gp"]]
    gp_received = sum(a["tier1_roc"] for a in gp_holdings)
    gp_target = (total_distributed_so_far + remaining) * gp_promote  # target GP share of everything
    gp_catchup_needed = max(ZERO, gp_target - gp_received)

    # GP catch-up rate: GP gets gp_catchup_pct of each dollar until caught up
    tier3_pool = ZERO
    if remaining > ZERO and gp_catchup_needed > ZERO:
        # Amount needed at the catch-up rate
        if gp_catchup_pct > ZERO:
            raw_catchup = (gp_catchup_needed / gp_catchup_pct).quantize(TWO)
            tier3_pool = min(remaining, raw_catchup)
            gp_catchup_amount = (tier3_pool * gp_catchup_pct).quantize(TWO)
            lp_catchup_amount = tier3_pool - gp_catchup_amount
        else:
            tier3_pool = ZERO
            gp_catchup_amount = ZERO
            lp_catchup_amount = ZERO

        # Distribute GP catch-up to GP holdings pro-rata by units
        total_gp_units = sum(a["units_held"] for a in gp_holdings)
        if total_gp_units > ZERO:
            for a in gp_holdings:
                a["tier3_catchup"] = (a["units_held"] / total_gp_units * gp_catchup_amount).quantize(TWO)

        # LP portion of catch-up tier distributed pro-rata to LP holdings
        total_lp_units = sum(a["units_held"] for a in lp_holdings)
        if total_lp_units > ZERO and lp_catchup_amount > ZERO:
            for a in lp_holdings:
                a["tier3_catchup"] = (a["units_held"] / total_lp_units * lp_catchup_amount).quantize(TWO)

        remaining -= tier3_pool

    # ── Tier 4: Carried Interest Split ─────────────────────────────────
    # Remaining split: LP gets (1 - gp_promote), GP gets gp_promote
    tier4_pool = remaining
    if tier4_pool > ZERO:
        lp_share = (tier4_pool * (Decimal("1") - gp_promote)).quantize(TWO)
        gp_share = tier4_pool - lp_share

        total_lp_units = sum(a["units_held"] for a in lp_holdings)
        if total_lp_units > ZERO:
            for a in lp_holdings:
                a["tier4_carry"] = (a["units_held"] / total_lp_units * lp_share).quantize(TWO)

        total_gp_units = sum(a["units_held"] for a in gp_holdings)
        if total_gp_units > ZERO:
            for a in gp_holdings:
                a["tier4_carry"] = (a["units_held"] / total_gp_units * gp_share).quantize(TWO)

    # Compute totals
    for a in alloc.values():
        a["total"] = a["tier1_roc"] + a["tier2_preferred"] + a["tier3_catchup"] + a["tier4_carry"]

    return {
        "lp_id": lp_id,
        "distributable_amount": _d(distributable_amount),
        "tier1_total": tier1_pool,
        "tier2_total": tier2_pool,
        "tier3_total": tier3_pool,
        "tier4_total": tier4_pool,
        "waterfall_params": {
            "preferred_return_rate": str(lp.preferred_return_rate),
            "gp_promote_percent": str(lp.gp_promote_percent),
            "gp_catchup_percent": str(lp.gp_catchup_percent),
            "style": "European (whole-fund)",
        },
        "allocations": list(alloc.values()),
    }
