"""
Projection Snapshot Service
============================
Captures frozen point-in-time projection snapshots for an LP tranche.

Each capture event records BOTH an LP-side projection and a GP-side
projection so the GP can show investors what they originally subscribed
against, years after the fact.

The snapshot is reproducible: it stores the full lifetime cash flow payload
(every property in the LP, stitched onto a single calendar timeline) plus
the waterfall split applied to the disposition proceeds and operating
distributions, plus all assumption blocks. Re-running the live model
later will not change a stored snapshot.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import (
    LPEntity, LPTranche, TrancheProjectionSnapshot, User, Property,
)

logger = logging.getLogger(__name__)


def _to_jsonable(obj: Any) -> Any:
    """Recursively convert Decimal/date/datetime to JSON-safe primitives."""
    if obj is None:
        return None
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime,)):
        return obj.isoformat()
    if hasattr(obj, "isoformat"):  # date
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(v) for v in obj]
    return obj


def _split_lp_gp(portfolio_payload: dict, lp: LPEntity) -> dict:
    """Apply the LP/GP waterfall split to a portfolio cash flow payload.

    The portfolio cash flow is pre-fee, pre-promote. We allocate each year's
    distributable cash flow (positive net cash flow rows + disposition
    proceeds + refinance distributions) between LP and GP based on the LP's
    waterfall configuration.

    For projection purposes we use a simplified European-style end-of-fund
    waterfall:
      1. Return of all paid-in capital to LP first (until total positive
         distributions = paid-in)
      2. Preferred return on paid-in (compounded annually at the configured
         pref rate, applied to remaining distributable cash)
      3. GP catch-up to gp_promote_percent of total distributions
      4. Carry split: LP gets lp_split_percent (default 80%), GP gets the rest

    The result is two parallel cash flow streams. The "lp_payload" is what
    LP investors see; the "gp_payload" is what the GP receives (promote +
    catch-up, no equity contribution outflows).
    """
    pref_rate = float(lp.preferred_return_rate or 8) / 100.0
    gp_promote = float(lp.gp_promote_percent or 20) / 100.0
    gp_catchup = float(lp.gp_catchup_percent or 100) / 100.0
    lp_split = float(lp.lp_split_percent or (100 - (lp.gp_promote_percent or 20))) / 100.0

    periods = portfolio_payload.get("periods") or []

    # Total paid-in capital from the periods stream = absolute value of all
    # negative-NCF rows (acquisition + any operating shortfall + construction
    # equity not covered by loan draws)
    paid_in = sum(-(p.get("net_cashflow_budget") or 0) for p in periods if (p.get("net_cashflow_budget") or 0) < 0)

    # Total distributable = sum of positive NCF rows
    total_distributable = sum((p.get("net_cashflow_budget") or 0) for p in periods if (p.get("net_cashflow_budget") or 0) > 0)

    # Walk the waterfall once to determine total LP / total GP
    # Tier 1: Return of capital — first dollars go to LP up to paid_in
    tier1 = min(paid_in, total_distributable)
    remaining = total_distributable - tier1

    # Tier 2: Preferred return — flat annual pref on paid-in over the hold years
    hold_years = portfolio_payload.get("hold_years") or len([p for p in periods if (p.get("type") or "") in ("operating", "stabilized", "construction", "mixed")])
    pref_due = paid_in * pref_rate * max(1, hold_years)
    tier2 = min(pref_due, remaining)
    remaining -= tier2

    # Tier 3: GP catch-up — GP gets gp_promote_percent of (tier1 + tier2 + catchup_amount)
    # so catchup_amount = (gp_promote * (tier1 + tier2)) / (1 - gp_promote) approximately,
    # subject to gp_catchup_pct of each dollar going to GP until caught up.
    gp_target_after_catchup = gp_promote * (tier1 + tier2)
    catchup_pool = 0.0
    if gp_catchup > 0 and remaining > 0 and gp_target_after_catchup > 0:
        # Solve: gp_catchup * catchup_pool = gp_target_after_catchup
        ideal_catchup = gp_target_after_catchup / gp_catchup
        catchup_pool = min(remaining, ideal_catchup)
    tier3_gp = catchup_pool * gp_catchup
    tier3_lp = catchup_pool - tier3_gp
    remaining -= catchup_pool

    # Tier 4: Carry split
    tier4_lp = remaining * lp_split
    tier4_gp = remaining - tier4_lp

    total_lp = tier1 + tier2 + tier3_lp + tier4_lp
    total_gp = tier3_gp + tier4_gp

    # Equity-multiple math
    lp_em = round(total_lp / paid_in, 2) if paid_in > 0 else None
    lp_profit = round(total_lp - paid_in, 0) if paid_in > 0 else None
    gp_em = None  # GP didn't put up equity in this simplified projection
    gp_profit = round(total_gp, 0)

    # Annualized returns
    def annualized(em: float | None, years: int) -> float | None:
        if em is None or em <= 0 or years <= 0:
            return None
        try:
            return round(((em) ** (1 / years) - 1) * 100, 1)
        except Exception:
            return None

    lp_roi = annualized(lp_em, hold_years)

    return {
        "waterfall_inputs": {
            "paid_in_capital": round(paid_in, 0),
            "total_distributable_pre_split": round(total_distributable, 0),
            "preferred_return_rate_pct": round(pref_rate * 100, 2),
            "gp_promote_pct": round(gp_promote * 100, 2),
            "gp_catchup_pct": round(gp_catchup * 100, 2),
            "lp_split_pct": round(lp_split * 100, 2),
            "hold_years": hold_years,
        },
        "tier_breakdown": {
            "tier1_return_of_capital": round(tier1, 0),
            "tier2_preferred_return": round(tier2, 0),
            "tier3_catchup_pool": round(catchup_pool, 0),
            "tier3_gp_share": round(tier3_gp, 0),
            "tier3_lp_share": round(tier3_lp, 0),
            "tier4_carry_pool": round(tier4_lp + tier4_gp, 0),
            "tier4_lp_share": round(tier4_lp, 0),
            "tier4_gp_share": round(tier4_gp, 0),
        },
        "lp_results": {
            "total_distributions": round(total_lp, 0),
            "paid_in_capital": round(paid_in, 0),
            "net_profit": lp_profit,
            "equity_multiple": lp_em,
            "annualized_return_pct": lp_roi,
        },
        "gp_results": {
            "total_distributions": round(total_gp, 0),
            "promote_pct_of_profit": round((total_gp / (total_lp + total_gp - paid_in) * 100), 1) if (total_lp + total_gp - paid_in) > 0 else None,
            "equity_multiple": gp_em,
            "net_profit": gp_profit,
        },
    }


def capture_tranche_snapshot(
    db: Session,
    lp_id: int,
    tranche_id: int,
    captured_by: User | None,
    trigger: str = "manual",
    label: str | None = None,
    notes: str | None = None,
) -> list[TrancheProjectionSnapshot]:
    """Capture a complete projection snapshot for a tranche.

    Creates TWO rows: one with projection_type='lp', one with projection_type='gp'.
    Both share the same captured_at timestamp so they're paired in the UI.

    Returns the list of newly-created snapshot rows.
    """
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise ValueError(f"LP {lp_id} not found")
    tranche = db.query(LPTranche).filter(LPTranche.tranche_id == tranche_id).first()
    if not tranche or tranche.lp_id != lp_id:
        raise ValueError(f"Tranche {tranche_id} not found on LP {lp_id}")

    # Lazy import to avoid circular module loading at startup
    from app.routes.portfolio_performance import get_lp_portfolio_cashflow

    # Compute the live portfolio cash flow at this exact moment
    portfolio_payload = get_lp_portfolio_cashflow(
        lp_id=lp_id,
        db=db,
        current_user=captured_by,
    )

    # Apply the waterfall to derive LP-side and GP-side numbers
    waterfall_split = _split_lp_gp(portfolio_payload, lp)

    captured_at = datetime.utcnow()
    label_final = label or f"Tranche {tranche.tranche_number} ({tranche.tranche_name or 'unnamed'}) — {trigger}"

    # Build a list of property summaries for the snapshot context
    properties = db.query(Property).filter(Property.lp_id == lp_id).all()
    property_summary = [
        {
            "property_id": p.property_id,
            "address": p.address,
            "city": p.city,
            "purchase_price": float(p.purchase_price) if p.purchase_price else None,
            "current_market_value": float(p.current_market_value) if p.current_market_value else None,
            "stage": (p.development_stage.value if hasattr(p.development_stage, "value") else str(p.development_stage)) if p.development_stage else None,
        }
        for p in properties
    ]

    # The snapshot payload — this is what makes the snapshot reproducible
    full_payload = _to_jsonable({
        "captured_at": captured_at,
        "lp": {
            "lp_id": lp.lp_id,
            "name": lp.name,
            "waterfall_style": lp.waterfall_style,
            "preferred_return_rate": float(lp.preferred_return_rate or 0),
            "gp_promote_percent": float(lp.gp_promote_percent or 0),
            "gp_catchup_percent": float(lp.gp_catchup_percent or 0),
            "lp_split_percent": float(lp.lp_split_percent or 0),
            "management_fee_percent": float(lp.management_fee_percent or 0),
            "acquisition_fee_percent": float(lp.acquisition_fee_percent or 0),
            "asset_management_fee_percent": float(lp.asset_management_fee_percent or 0),
        },
        "tranche": {
            "tranche_id": tranche.tranche_id,
            "tranche_number": tranche.tranche_number,
            "tranche_name": tranche.tranche_name,
            "opening_date": tranche.opening_date,
            "closing_date": tranche.closing_date,
            "status": tranche.status.value if tranche.status else None,
            "issue_price": float(tranche.issue_price) if tranche.issue_price else None,
            "target_amount": float(tranche.target_amount) if tranche.target_amount else None,
            "target_units": float(tranche.target_units) if tranche.target_units else None,
        },
        "properties": property_summary,
        "portfolio_cashflow": portfolio_payload,
        "waterfall_split": waterfall_split,
    })

    snapshots: list[TrancheProjectionSnapshot] = []

    # LP-side snapshot
    lp_kpis = {
        **(waterfall_split.get("lp_results") or {}),
        "tranche_label": label_final,
        "captured_at": captured_at.isoformat(),
        "property_count": len(properties),
        "horizon": (portfolio_payload.get("horizon") or {}),
    }
    lp_snapshot = TrancheProjectionSnapshot(
        lp_id=lp_id,
        tranche_id=tranche_id,
        captured_at=captured_at,
        captured_by=captured_by.user_id if captured_by else None,
        capture_trigger=trigger,
        projection_type="lp",
        label=label_final,
        notes=notes,
        headline_kpis=json.dumps(lp_kpis, default=str),
        snapshot_payload=json.dumps(full_payload, default=str),
    )
    db.add(lp_snapshot)
    snapshots.append(lp_snapshot)

    # GP-side snapshot
    gp_kpis = {
        **(waterfall_split.get("gp_results") or {}),
        "tranche_label": label_final,
        "captured_at": captured_at.isoformat(),
        "property_count": len(properties),
    }
    gp_snapshot = TrancheProjectionSnapshot(
        lp_id=lp_id,
        tranche_id=tranche_id,
        captured_at=captured_at,
        captured_by=captured_by.user_id if captured_by else None,
        capture_trigger=trigger,
        projection_type="gp",
        label=label_final,
        notes=notes,
        headline_kpis=json.dumps(gp_kpis, default=str),
        snapshot_payload=json.dumps(full_payload, default=str),
    )
    db.add(gp_snapshot)
    snapshots.append(gp_snapshot)

    db.commit()
    for s in snapshots:
        db.refresh(s)
    return snapshots
