"""
LP–Property Bridge API Routes
===============================
Endpoints that connect property-level financials to LP-level investor returns.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.services.lp_property_bridge import (
    compute_distributable_cash,
    compute_capital_events,
    compute_investor_return_projection,
)

router = APIRouter(prefix="/investment", tags=["LP-Property Bridge"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. Distributable Cash Flow
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/lp/{lp_id}/distributable-cash")
async def get_distributable_cash(lp_id: int, db: Session = Depends(get_db)):
    """
    Compute the annual distributable cash flow for an LP fund.
    
    Shows the full waterfall from gross property revenue down to distributable
    cash after debt service, management fees, and reserves.
    """
    return compute_distributable_cash(db, lp_id)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Capital Events
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/lp/{lp_id}/capital-events")
async def get_capital_events(lp_id: int, db: Session = Depends(get_db)):
    """
    Aggregate all capital events (refinances and sales) across LP properties.
    
    Returns net proceeds for each event, available for distribution through
    the waterfall.
    """
    return compute_capital_events(db, lp_id)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Investor Return Projection
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/lp/{lp_id}/investor-return-projection")
async def get_investor_return_projection(
    lp_id: int,
    years: int = Query(default=10, ge=1, le=30, description="Projection horizon in years"),
    rent_escalation: float = Query(default=3.0, ge=0, le=20, description="Annual rent escalation %"),
    expense_escalation: float = Query(default=2.5, ge=0, le=20, description="Annual expense escalation %"),
    vacancy_rate: float = Query(default=5.0, ge=0, le=50, description="Assumed vacancy rate %"),
    exit_cap_rate: float = Query(default=5.5, ge=1, le=20, description="Exit cap rate %"),
    db: Session = Depends(get_db),
):
    """
    Compute a multi-year investor return projection.
    
    Shows year-by-year property NOI flowing through the LP waterfall,
    capital events at their expected dates, terminal value, and computes
    IRR and equity multiple.
    """
    return compute_investor_return_projection(
        db, lp_id,
        projection_years=years,
        rent_escalation=rent_escalation,
        expense_escalation=expense_escalation,
        vacancy_rate=vacancy_rate,
        exit_cap_rate=exit_cap_rate,
    )
