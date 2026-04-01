"""
Business Validation Service
============================
Centralises business rule enforcement across all domains:
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
    bypass: bool = False,
) -> None:
    """Validate that an LP status transition is allowed.

    Args:
        bypass: If True, skip validation (for DEVELOPER role overrides).
    """
    if bypass:
        return
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


# ── LP / Property / Community Purpose Type Consistency ──────────────────

def validate_property_lp_community_match(
    db: Session,
    lp_id: int | None,
    community_id: int | None,
    property_id: int | None = None,
):
    """Ensure a property's community type matches its LP's purpose_type.

    Rules:
    - Each LP serves exactly one community type (no Mixed)
    - A property assigned to an LP must belong to a community of the same type
    - If either lp_id or community_id is None, no validation needed
    """
    if not lp_id or not community_id:
        return  # Can't validate without both

    from app.db.models import LPEntity, Community

    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    community = db.query(Community).filter(Community.community_id == community_id).first()

    if not lp or not community:
        return  # Will be caught by FK validation

    if not lp.purpose_type:
        return  # LP has no purpose_type set yet — allow assignment

    lp_type = lp.purpose_type.value if hasattr(lp.purpose_type, "value") else str(lp.purpose_type)
    comm_type = community.community_type.value if hasattr(community.community_type, "value") else str(community.community_type)

    if lp_type != comm_type:
        raise HTTPException(
            status_code=400,
            detail=f"Community type mismatch: LP '{lp.name}' is a {lp_type} fund, "
                   f"but community '{community.name}' is {comm_type}. "
                   f"Properties in this LP must belong to {lp_type} communities.",
        )


def validate_lp_purpose_type_change(
    db: Session,
    lp_id: int,
    new_purpose_type: str,
):
    """Ensure an LP's purpose_type can be changed without orphaning properties.

    If the LP already has properties assigned to communities of a different type,
    the purpose_type change is blocked.
    """
    from app.db.models import LPEntity, Property, Community

    properties = db.query(Property).filter(Property.lp_id == lp_id).all()

    for prop in properties:
        if not prop.community_id:
            continue
        community = db.query(Community).filter(Community.community_id == prop.community_id).first()
        if not community:
            continue
        comm_type = community.community_type.value if hasattr(community.community_type, "value") else str(community.community_type)
        if comm_type != new_purpose_type:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change LP purpose to {new_purpose_type}: "
                       f"property '{prop.address}' belongs to community '{community.name}' "
                       f"which is {comm_type}. Reassign the property first.",
            )


# ---------------------------------------------------------------------------
# Maintenance Status Transitions
# ---------------------------------------------------------------------------

MAINTENANCE_TRANSITIONS = {
    "open": {"in_progress", "resolved"},
    "in_progress": {"resolved", "open"},  # can reopen
    "resolved": {"open"},                 # can reopen
}


def validate_maintenance_status_transition(current: str, target: str) -> None:
    """Validate that a maintenance request status transition is allowed."""
    allowed = MAINTENANCE_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition maintenance from '{current}' to '{target}'. "
                   f"Allowed: {', '.join(sorted(allowed)) if allowed else 'none'}.",
        )


# ---------------------------------------------------------------------------
# Milestone Status Transitions
# ---------------------------------------------------------------------------

MILESTONE_TRANSITIONS = {
    "pending": {"in_progress", "skipped"},
    "in_progress": {"completed", "overdue", "pending"},
    "overdue": {"completed", "in_progress"},
    "completed": set(),   # terminal
    "skipped": {"pending"},  # can un-skip
}


def validate_milestone_status_transition(current: str, target: str) -> None:
    """Validate that a milestone status transition is allowed."""
    allowed = MILESTONE_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition milestone from '{current}' to '{target}'. "
                   f"Allowed: {', '.join(sorted(allowed)) if allowed else 'none (terminal)'}.",
        )


# ---------------------------------------------------------------------------
# Turnover Status Transitions
# ---------------------------------------------------------------------------

TURNOVER_TRANSITIONS = {
    "scheduled": {"in_progress", "completed"},
    "in_progress": {"ready", "completed"},
    "ready": {"completed"},
    "completed": set(),  # terminal
}


def validate_turnover_status_transition(current: str, target: str) -> None:
    """Validate that a unit turnover status transition is allowed."""
    allowed = TURNOVER_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition turnover from '{current}' to '{target}'. "
                   f"Allowed: {', '.join(sorted(allowed)) if allowed else 'none (terminal)'}.",
        )


# ---------------------------------------------------------------------------
# Shift Status Transitions
# ---------------------------------------------------------------------------

SHIFT_TRANSITIONS = {
    "scheduled": {"in_progress", "completed", "cancelled", "no_show"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),   # terminal
    "cancelled": set(),   # terminal
    "no_show": set(),     # terminal
}


def validate_shift_status_transition(current: str, target: str) -> None:
    """Validate that a shift status transition is allowed."""
    allowed = SHIFT_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition shift from '{current}' to '{target}'. "
                   f"Allowed: {', '.join(sorted(allowed)) if allowed else 'none (terminal)'}.",
        )


# ── Investor Compliance Validation ────────────────────────────────────────

# Required document types before subscription can be created
REQUIRED_DOCS_FOR_SUBSCRIPTION = {
    "investor_id_document",      # Photo ID (KYC)
    "accreditation_certificate", # Accreditation proof
}

# Required document types before subscription can be funded
REQUIRED_DOCS_FOR_FUNDING = {
    "investor_id_document",
    "accreditation_certificate",
    "aml_kyc_report",
    "subscription_agreement",
}

# Required before issued
REQUIRED_DOCS_FOR_ISSUANCE = {
    "investor_id_document",
    "accreditation_certificate",
    "aml_kyc_report",
    "subscription_agreement",
    "partnership_agreement",
    "banking_form",
}


def validate_investor_compliance(
    db: Session,
    investor: m.Investor,
    check_level: str = "subscription",
    bypass: bool = False,
) -> dict:
    """Validate investor compliance readiness for subscription/funding/issuance.

    Args:
        db: Database session
        investor: The investor to check
        check_level: 'subscription', 'funding', or 'issuance'
        bypass: If True, return warnings but don't raise (for DEVELOPER override)

    Returns:
        dict with {ready: bool, warnings: list, missing_docs: list}

    Raises:
        HTTPException if not ready and bypass=False
    """
    import datetime

    warnings = []
    missing_docs = []

    # 1. Check onboarding status
    onboarding = investor.onboarding_status.value if investor.onboarding_status else "lead"
    if onboarding not in ("approved", "active"):
        warnings.append(f"Onboarding status is '{onboarding}' — must be 'approved' or 'active'")

    # 2. Check accreditation
    accredited = investor.accredited_status or "pending"
    if accredited == "pending":
        warnings.append("Accreditation status is pending — must be verified before investment")
    elif accredited == "expired":
        warnings.append("Accreditation has expired — renewal required")

    # Check expiration date
    if investor.accreditation_expires_at:
        if investor.accreditation_expires_at < datetime.date.today():
            warnings.append(f"Accreditation expired on {investor.accreditation_expires_at}")

    # 3. Check required documents
    required_set = {
        "subscription": REQUIRED_DOCS_FOR_SUBSCRIPTION,
        "funding": REQUIRED_DOCS_FOR_FUNDING,
        "issuance": REQUIRED_DOCS_FOR_ISSUANCE,
    }.get(check_level, REQUIRED_DOCS_FOR_SUBSCRIPTION)

    existing_docs = set()
    investor_docs = db.query(m.InvestorDocument).filter(
        m.InvestorDocument.investor_id == investor.investor_id
    ).all()
    for doc in investor_docs:
        dtype = doc.document_type.value if hasattr(doc.document_type, "value") else str(doc.document_type)
        existing_docs.add(dtype)

    missing_docs = list(required_set - existing_docs)

    if missing_docs:
        doc_labels = {
            "investor_id_document": "Photo ID (KYC)",
            "accreditation_certificate": "Accreditation Certificate",
            "aml_kyc_report": "AML/KYC Report",
            "subscription_agreement": "Subscription Agreement",
            "partnership_agreement": "Partnership Agreement",
            "banking_form": "Banking Information",
            "tax_form": "Tax Form",
        }
        readable = [doc_labels.get(d, d) for d in missing_docs]
        warnings.append(f"Missing required documents: {', '.join(readable)}")

    ready = len(warnings) == 0

    if not ready and not bypass:
        raise HTTPException(
            status_code=400,
            detail=f"Investor compliance check failed for {check_level}: " + "; ".join(warnings),
        )

    return {"ready": ready, "warnings": warnings, "missing_docs": missing_docs}


def auto_create_holding_from_subscription(db: Session, subscription: m.Subscription) -> Optional[m.Holding]:
    """Auto-create a Holding record when a subscription reaches 'issued' status.

    Returns the created Holding or None if one already exists.
    """
    # Check if holding already exists
    existing = db.query(m.Holding).filter(
        m.Holding.subscription_id == subscription.subscription_id
    ).first()
    if existing:
        return None

    holding = m.Holding(
        investor_id=subscription.investor_id,
        lp_id=subscription.lp_id,
        subscription_id=subscription.subscription_id,
        units_held=subscription.unit_quantity,
        average_issue_price=subscription.issue_price,
        total_capital_contributed=subscription.funded_amount,
        initial_issue_date=subscription.issued_date or subscription.funded_date,
        unreturned_capital=subscription.funded_amount,
        unpaid_preferred=Decimal("0"),
        is_gp=False,
        status="active",
    )
    db.add(holding)

    # Also advance onboarding status to 'active' if it's 'approved'
    investor = db.query(m.Investor).filter(
        m.Investor.investor_id == subscription.investor_id
    ).first()
    if investor:
        if investor.onboarding_status == m.OnboardingStatus.approved:
            investor.onboarding_status = m.OnboardingStatus.active
        if investor.investor_status != m.InvestorStatus.investor:
            investor.investor_status = m.InvestorStatus.investor

    return holding
