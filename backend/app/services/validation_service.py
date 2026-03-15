"""
Business Validation Service
============================
Centralises business rule enforcement for the investment domain:
  - Subscription amount limits (min subscription, max raise capacity)
  - Subscription status transition rules
  - LP status transition rules
  - Holding consistency (total units cannot exceed total_units_authorized)
  - Tranche status transition rules

All functions raise HTTPException on validation failure so route handlers
can call them directly.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db import models as m

ZERO = Decimal("0")

# ── Valid status transitions ───────────────────────────────────────────────

_SUBSCRIPTION_TRANSITIONS = {
    "draft":        {"submitted", "cancelled"},
    "submitted":    {"under_review", "withdrawn"},
    "under_review": {"accepted", "rejected"},
    "accepted":     {"funded", "cancelled"},
    "funded":       {"issued"},
    "issued":       {"closed"},
    "closed":       set(),  # terminal
    "rejected":     set(),  # terminal
    "withdrawn":    set(),  # terminal
    "cancelled":    set(),  # terminal
}

_LP_TRANSITIONS = {
    "draft":                  {"under_review"},
    "under_review":           {"approved", "draft"},
    "approved":               {"open_for_subscription"},
    "open_for_subscription":  {"partially_funded", "fully_funded", "closed"},
    "partially_funded":       {"tranche_closed", "fully_funded", "closed"},
    "tranche_closed":         {"open_for_subscription", "fully_funded", "closed"},
    "fully_funded":           {"operating", "closed"},
    "operating":              {"winding_down"},
    "winding_down":           {"closed"},
    "closed":                 set(),  # terminal
}

_TRANCHE_TRANSITIONS = {
    "draft":     {"open", "cancelled"},
    "open":      {"closed", "cancelled"},
    "closed":    set(),  # terminal
    "cancelled": set(),  # terminal
}


# ── Subscription validations ──────────────────────────────────────────────

def validate_subscription_amount(
    db: Session,
    lp: m.LPEntity,
    commitment_amount: Decimal,
    exclude_subscription_id: Optional[int] = None,
) -> None:
    """
    Validate that a subscription amount meets fund rules:
    1. commitment_amount >= minimum_subscription (if set)
    2. Total commitments + this subscription <= maximum_raise (if set)
    """
    min_sub = lp.minimum_subscription
    if min_sub and commitment_amount < min_sub:
        raise HTTPException(
            status_code=400,
            detail=f"Subscription amount ${commitment_amount:,.2f} is below the minimum "
                   f"subscription of ${min_sub:,.2f}",
        )

    max_raise = lp.maximum_raise or lp.target_raise
    if max_raise:
        # Sum existing commitments (excluding the one being updated)
        query = db.query(m.Subscription).filter(
            m.Subscription.lp_id == lp.lp_id,
            m.Subscription.status.notin_([
                m.SubscriptionStatus.rejected,
                m.SubscriptionStatus.withdrawn,
                m.SubscriptionStatus.cancelled,
            ]),
        )
        if exclude_subscription_id:
            query = query.filter(m.Subscription.subscription_id != exclude_subscription_id)

        existing_total = sum(
            s.commitment_amount or ZERO for s in query.all()
        )

        if existing_total + commitment_amount > max_raise:
            remaining = max_raise - existing_total
            raise HTTPException(
                status_code=400,
                detail=f"Subscription of ${commitment_amount:,.2f} would exceed the maximum "
                       f"raise of ${max_raise:,.2f}. Remaining capacity: ${remaining:,.2f}",
            )


def validate_subscription_status_transition(
    current_status: str,
    new_status: str,
) -> None:
    """Validate that a subscription status transition is allowed."""
    allowed = _SUBSCRIPTION_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition subscription from '{current_status}' to '{new_status}'. "
                   f"Allowed transitions: {', '.join(sorted(allowed)) or 'none (terminal state)'}",
        )


# ── LP status validations ─────────────────────────────────────────────────

def validate_lp_status_transition(
    current_status: str,
    new_status: str,
) -> None:
    """Validate that an LP status transition is allowed."""
    allowed = _LP_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition LP from '{current_status}' to '{new_status}'. "
                   f"Allowed transitions: {', '.join(sorted(allowed)) or 'none (terminal state)'}",
        )


# ── Tranche status validations ────────────────────────────────────────────

def validate_tranche_status_transition(
    current_status: str,
    new_status: str,
) -> None:
    """Validate that a tranche status transition is allowed."""
    allowed = _TRANCHE_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition tranche from '{current_status}' to '{new_status}'. "
                   f"Allowed transitions: {', '.join(sorted(allowed)) or 'none (terminal state)'}",
        )


# ── Holding validations ───────────────────────────────────────────────────

def validate_holding_units(
    db: Session,
    lp: m.LPEntity,
    new_units: Decimal,
    exclude_holding_id: Optional[int] = None,
) -> None:
    """
    Validate that total units issued does not exceed total_units_authorized.
    """
    if not lp.total_units_authorized:
        return  # no cap set

    query = db.query(m.Holding).filter(
        m.Holding.lp_id == lp.lp_id,
        m.Holding.status == "active",
    )
    if exclude_holding_id:
        query = query.filter(m.Holding.holding_id != exclude_holding_id)

    existing_units = sum(h.units_held or ZERO for h in query.all())

    if existing_units + new_units > lp.total_units_authorized:
        remaining = lp.total_units_authorized - existing_units
        raise HTTPException(
            status_code=400,
            detail=f"Adding {new_units} units would exceed the authorized limit of "
                   f"{lp.total_units_authorized} units. Remaining capacity: {remaining} units",
        )


def validate_upfront_funding(subscription: m.Subscription) -> None:
    """
    For full upfront funding model: funded_amount must equal commitment_amount
    when transitioning to 'funded' status.
    """
    if subscription.funded_amount != subscription.commitment_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Full upfront funding required. Funded amount "
                   f"(${subscription.funded_amount:,.2f}) must equal commitment amount "
                   f"(${subscription.commitment_amount:,.2f})",
        )
