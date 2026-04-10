"""
API routes for the Investor domain.
Ownership/Contributions/Distributions are now handled via the investment routes
(GP, LP, Subscription, Holding, DistributionEvent).
This file retains: Investor CRUD, Dashboard, Documents, Messages, Waterfall.
"""
import datetime
from decimal import Decimal

from typing import Optional

from fastapi import APIRouter, Depends, Form as _Form, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.deps import get_current_user, require_gp_admin, require_gp_or_ops, require_investor_or_above
from app.db.models import (
    Investor, InvestorDocument, InvestorMessage, User, UserRole,
    Subscription, Holding, DistributionAllocation, DistributionEvent, LPEntity,
    OnboardingStatus, OnboardingChecklistItem, IndicationOfInterest, IOIStatus,
    DocumentType, InvestorStatus, ContactAssignment,
)
from app.db.session import get_db
from app.schemas.investor import (
    DocumentCreate, DocumentOut,
    InvestorCreate, InvestorUpdate, InvestorDashboard, InvestorOut, InvestorSummary,
    InvestorDistributionHistory, InvestorDistributionItem,
    MessageCreate, MessageOut,
    WaterfallInput, WaterfallResultSchema,
    OnboardingChecklistItemOut, OnboardingChecklistItemUpdate,
    OnboardingStatusTransition, InvestorOnboardingDetail,
    IOICreate, IOIUpdate, IOIOut, LPIOISummary,
)
from app.schemas.investment import SubscriptionOut
from app.services.waterfall import WaterfallEngine
from sqlalchemy.orm import joinedload

router = APIRouter()


def _sub_out(s: Subscription) -> SubscriptionOut:
    return SubscriptionOut(
        subscription_id=s.subscription_id,
        investor_id=s.investor_id,
        lp_id=s.lp_id,
        tranche_id=s.tranche_id,
        commitment_amount=s.commitment_amount,
        funded_amount=s.funded_amount,
        issue_price=s.issue_price,
        unit_quantity=s.unit_quantity,
        status=s.status.value if s.status else "draft",
        submitted_date=s.submitted_date,
        accepted_date=s.accepted_date,
        funded_date=s.funded_date,
        issued_date=s.issued_date,
        notes=s.notes,
        investor_name=s.investor.name if s.investor else None,
        lp_name=s.lp.name if s.lp else None,
        tranche_name=s.tranche.tranche_name if s.tranche else None,
        payment_method=s.payment_method,
        payment_reference=s.payment_reference,
        payment_received_date=s.payment_received_date,
        payment_cleared=s.payment_cleared,
        payment_notes=s.payment_notes,
        compliance_approved=s.compliance_approved,
        compliance_approved_by=s.compliance_approved_by,
        compliance_approved_at=s.compliance_approved_at,
        compliance_notes=s.compliance_notes,
    )


def _get_investor_or_404(investor_id: int, db: Session) -> Investor:
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")
    return inv


# ---------------------------------------------------------------------------
# Investors
# ---------------------------------------------------------------------------

@router.get("/investors")
def list_investors(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List investors with assigned users. Archived contacts hidden by default (?include_archived=true to show)."""
    if current_user.role in (UserRole.DEVELOPER, UserRole.GP_ADMIN):
        query = db.query(Investor)
        if not include_archived:
            query = query.filter(Investor.investor_status != InvestorStatus.archived)
        investors = query.all()
    else:
        # Non-admin: see new_lead (unassigned) + contacts assigned to them
        from sqlalchemy import or_
        assigned_ids = [
            ca.investor_id for ca in
            db.query(ContactAssignment).filter(ContactAssignment.user_id == current_user.user_id).all()
        ]
        query = db.query(Investor).filter(
            or_(
                Investor.investor_status == InvestorStatus.new_lead,
                Investor.investor_id.in_(assigned_ids) if assigned_ids else False,
            )
        )
        if not include_archived:
            query = query.filter(Investor.investor_status != InvestorStatus.archived)
        investors = query.all()

    # Attach assigned user names to each investor
    result = []
    for inv in investors:
        # Return only fields needed for list/detail — exclude large text blobs
        LIST_FIELDS = {
            "investor_id", "user_id", "first_name", "last_name", "company_name", "name",
            "email", "phone", "mobile", "street_address", "street_address_2",
            "city", "province", "postal_code", "country", "address",
            "entity_type", "jurisdiction", "accredited_status", "exemption_type",
            "investor_status", "onboarding_status", "tax_id",
            "linkedin_url", "risk_tolerance", "re_knowledge", "income_range",
            "net_worth_range", "other_investments", "investment_goals", "referral_source",
            "notes", "research_summary", "research_date",
            "created_at", "updated_at",
        }
        d = {c.name: getattr(inv, c.name) for c in inv.__table__.columns if c.name in LIST_FIELDS}
        # Convert enums to string values
        if d.get("investor_status"):
            d["investor_status"] = d["investor_status"].value if hasattr(d["investor_status"], "value") else str(d["investor_status"])
        if d.get("onboarding_status"):
            d["onboarding_status"] = d["onboarding_status"].value if hasattr(d["onboarding_status"], "value") else str(d["onboarding_status"])
        # Add assigned users
        assignments = db.query(ContactAssignment).filter(ContactAssignment.investor_id == inv.investor_id).all()
        d["assigned_users"] = [
            {"user_id": a.user_id, "user_name": a.user.full_name if a.user else None}
            for a in assignments
        ]
        result.append(d)
    return result


@router.get("/investors-summary", response_model=list[InvestorSummary])
def list_investors_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Return ALL investors with investor_status='investor'.

    These are the same contacts from the CRM page that have been promoted
    to investor status. Groups them as:
    - Active: has at least one holding with status 'active' in a current LP
    - Non-active (pending): investor status granted but no active holdings yet
      (either awaiting subscription, or past holdings all redeemed)
    """
    from decimal import Decimal as D
    from app.db.models import Holding

    # Get ALL investors with status='investor' — same table as CRM contacts
    investors = db.query(Investor).filter(
        Investor.investor_status == InvestorStatus.investor
    ).all()

    terminal_sub = {"closed", "rejected", "withdrawn", "cancelled"}
    result = []
    for inv in investors:
        subs = (
            db.query(Subscription)
            .options(joinedload(Subscription.lp))
            .filter(Subscription.investor_id == inv.investor_id)
            .order_by(Subscription.created_at.desc())
            .all()
        )
        holdings = db.query(Holding).filter(
            Holding.investor_id == inv.investor_id
        ).all()

        total_committed = sum((s.commitment_amount or D(0) for s in subs), D(0))
        total_funded = sum((s.funded_amount or D(0) for s in subs), D(0))
        active_subs = [s for s in subs if (s.status.value if s.status else "draft") not in terminal_sub]
        lp_names = list({s.lp.name for s in subs if s.lp})
        raw_status = subs[0].status.value if subs and subs[0].status else None

        # Compute effective status based on actual compliance + payment state
        # A subscription showing "issued" isn't truly issued unless compliance
        # is approved and full payment has cleared
        effective_status = raw_status
        if subs:
            latest_sub = subs[0]
            compliance_ok = bool(latest_sub.compliance_approved)
            fully_funded = (latest_sub.funded_amount or D(0)) >= (latest_sub.commitment_amount or D(0)) and (latest_sub.funded_amount or D(0)) > 0

            if raw_status in ("accepted", "funded", "issued"):
                if not compliance_ok:
                    effective_status = "pending_compliance"
                elif not fully_funded:
                    effective_status = "pending_payment"
                elif raw_status == "issued" and compliance_ok and fully_funded:
                    effective_status = "issued"
                else:
                    effective_status = raw_status

        # Active = compliance approved on ALL subscriptions + fully funded + holding active
        active_holdings = [h for h in holdings if (h.status or "active") == "active"]
        compliance_ok_any = any(bool(s.compliance_approved) for s in subs) if subs else False
        fully_funded_any = total_funded >= total_committed and total_funded > 0 if total_committed > 0 else False
        is_active = len(active_holdings) > 0 and compliance_ok_any and fully_funded_any

        # Action items: count of subscriptions needing attention
        action_count = 0
        for s in subs:
            s_status = s.status.value if s.status else "draft"
            if s_status in terminal_sub:
                continue
            s_compliance = bool(s.compliance_approved)
            s_funded = (s.funded_amount or D(0)) >= (s.commitment_amount or D(0)) and (s.funded_amount or D(0)) > 0
            if not s_compliance or not s_funded or s_status != "issued":
                action_count += 1

        # Missing documents count
        from app.db.models import InvestorDocument
        required_doc_types = {
            "investor_id_document", "accreditation_certificate", "aml_kyc_report",
            "subscription_agreement", "partnership_agreement", "banking_form",
        }
        existing_docs = set()
        investor_docs = db.query(InvestorDocument).filter(
            InvestorDocument.investor_id == inv.investor_id
        ).all()
        for doc in investor_docs:
            dtype = doc.document_type.value if hasattr(doc.document_type, "value") else str(doc.document_type)
            existing_docs.add(dtype)
        missing_docs = len(required_doc_types - existing_docs)

        # Compliance approved on latest subscription
        latest_compliance = bool(subs[0].compliance_approved) if subs else False

        result.append(InvestorSummary(
            investor_id=inv.investor_id,
            name=inv.name,
            email=inv.email,
            phone=inv.phone,
            entity_type=inv.entity_type,
            accredited_status=inv.accredited_status,
            total_committed=total_committed,
            total_funded=total_funded,
            subscription_count=len(subs),
            active_subscriptions=action_count,
            lp_names=lp_names,
            latest_status=effective_status,
            created_at=inv.created_at,
            is_active=is_active,
            holding_count=len(active_holdings),
            missing_docs_count=missing_docs,
            compliance_approved=latest_compliance,
        ))
    return result


@router.post("/investors", response_model=InvestorOut, status_code=status.HTTP_201_CREATED)
def create_investor(
    payload: InvestorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if db.query(Investor).filter(Investor.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Investor email already exists")
    investor = Investor(**payload.model_dump())
    db.add(investor)
    db.commit()
    db.refresh(investor)
    return investor


@router.get("/investors/{investor_id}", response_model=InvestorOut)
def get_investor(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    inv = _get_investor_or_404(investor_id, db)
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return inv


@router.patch("/investors/{investor_id}", response_model=InvestorOut)
def update_investor(
    investor_id: int,
    payload: InvestorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    inv = _get_investor_or_404(investor_id, db)
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(inv, key, val)
    db.commit()
    db.refresh(inv)
    return inv


@router.delete("/investors/{investor_id}", status_code=204)
def delete_investor(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_admin),
):
    """Delete an investor record. GP Admin only."""
    inv = _get_investor_or_404(investor_id, db)
    # Delete related IOIs
    db.query(IndicationOfInterest).filter(IndicationOfInterest.investor_id == investor_id).delete()
    db.delete(inv)
    db.commit()


class BulkDeleteBody(BaseModel):
    investor_ids: list[int]


@router.post("/investors/bulk-delete", status_code=200)
def bulk_delete_investors(
    body: BulkDeleteBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_admin),
):
    """Bulk delete investor records. GP Admin only."""
    deleted = 0
    for inv_id in body.investor_ids:
        inv = db.query(Investor).filter(Investor.investor_id == inv_id).first()
        if inv:
            db.query(IndicationOfInterest).filter(IndicationOfInterest.investor_id == inv_id).delete()
            db.delete(inv)
            deleted += 1
    db.commit()
    return {"deleted": deleted, "requested": len(body.investor_ids)}


# ---------------------------------------------------------------------------
# Subscriptions by Investor
# ---------------------------------------------------------------------------

@router.get("/investors/{investor_id}/subscriptions", response_model=list[SubscriptionOut])
def list_investor_subscriptions(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    inv = _get_investor_or_404(investor_id, db)
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    subs = (
        db.query(Subscription)
        .options(joinedload(Subscription.investor), joinedload(Subscription.lp), joinedload(Subscription.tranche))
        .filter(Subscription.investor_id == investor_id)
        .order_by(Subscription.created_at.desc())
        .all()
    )
    return [_sub_out(s) for s in subs]


# ---------------------------------------------------------------------------
# Dashboard (now uses Subscription/Holding instead of Ownership/Contribution)
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=InvestorDashboard)
def my_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    inv = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="No investor profile linked to this account")
    return _build_dashboard(inv, db)


@router.get("/investors/{investor_id}/dashboard", response_model=InvestorDashboard)
def investor_dashboard(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    investor = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not investor:
        raise HTTPException(404, "Investor not found")

    # INVESTOR role can only view their own dashboard
    if current_user.role == "INVESTOR":
        if investor.user_id != current_user.user_id:
            raise HTTPException(403, "Access denied")

    return _build_dashboard(investor, db)


def _build_dashboard(inv: Investor, db: Session) -> InvestorDashboard:
    # Aggregate from subscriptions
    subs = db.query(Subscription).filter(Subscription.investor_id == inv.investor_id).all()
    total_committed = sum((s.commitment_amount for s in subs), Decimal(0))
    total_funded = sum((s.funded_amount for s in subs), Decimal(0))

    # Aggregate from distribution allocations
    holdings = db.query(Holding).filter(Holding.investor_id == inv.investor_id).all()
    holding_ids = [h.holding_id for h in holdings]
    total_distributions = Decimal(0)
    if holding_ids:
        allocs = db.query(DistributionAllocation).filter(
            DistributionAllocation.holding_id.in_(holding_ids)
        ).all()
        total_distributions = sum((a.amount for a in allocs), Decimal(0))

    # Documents and messages
    docs = sorted(inv.documents, key=lambda x: x.upload_date, reverse=True) if inv.documents else []
    msgs = sorted(inv.messages, key=lambda x: x.sent_at, reverse=True) if inv.messages else []

    return InvestorDashboard(
        investor=InvestorOut.model_validate(inv),
        total_committed=total_committed,
        total_funded=total_funded,
        total_distributions=total_distributions,
        net_position=total_funded - total_distributions,
        subscription_count=len(subs),
        holding_count=len(holdings),
        documents=[DocumentOut.model_validate(doc) for doc in docs],
        messages=[MessageOut.model_validate(msg) for msg in msgs],
    )


# (Old document routes removed — replaced by CRM document routes below)

# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

@router.post("/investors/{investor_id}/messages", response_model=MessageOut)
def send_message(
    investor_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    _get_investor_or_404(investor_id, db)
    msg = InvestorMessage(
        investor_id=investor_id,
        sender_id=current_user.user_id,
        sent_at=datetime.datetime.utcnow(),
        **payload.model_dump()
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/investors/{investor_id}/messages", response_model=list[MessageOut])
def list_messages(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    inv = _get_investor_or_404(investor_id, db)
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return sorted(inv.messages, key=lambda x: x.sent_at, reverse=True) if inv.messages else []


# ---------------------------------------------------------------------------
# Distribution History
# ---------------------------------------------------------------------------

@router.get("/investors/{investor_id}/distributions", response_model=InvestorDistributionHistory)
def investor_distribution_history(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Return per-investor distribution history across all LPs."""
    inv = _get_investor_or_404(investor_id, db)
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get all holdings for this investor
    holdings = db.query(Holding).filter(Holding.investor_id == investor_id).all()
    holding_ids = [h.holding_id for h in holdings]
    # Map holding_id -> lp_id for LP name lookup
    holding_lp_map = {h.holding_id: h.lp_id for h in holdings}

    if not holding_ids:
        return InvestorDistributionHistory(
            investor_id=investor_id,
            investor_name=inv.name,
            total_distributions=Decimal(0),
            distributions=[],
        )

    # Get all allocations for these holdings, joined with events
    allocs = (
        db.query(DistributionAllocation, DistributionEvent)
        .join(DistributionEvent, DistributionAllocation.event_id == DistributionEvent.event_id)
        .filter(DistributionAllocation.holding_id.in_(holding_ids))
        .order_by(DistributionEvent.created_date.desc())
        .all()
    )

    # Cache LP names
    lp_name_cache: dict[int, str] = {}
    total = Decimal(0)
    items = []
    for alloc, event in allocs:
        lp_id = holding_lp_map.get(alloc.holding_id)
        if lp_id and lp_id not in lp_name_cache:
            lp = db.query(LPEntity).get(lp_id)
            lp_name_cache[lp_id] = lp.name if lp else f"LP #{lp_id}"

        total += alloc.amount or Decimal(0)
        items.append(InvestorDistributionItem(
            allocation_id=alloc.allocation_id,
            event_id=alloc.event_id,
            lp_name=lp_name_cache.get(lp_id, "Unknown"),
            period_label=event.period_label,
            distribution_type=alloc.distribution_type.value if alloc.distribution_type else "unknown",
            amount=alloc.amount or Decimal(0),
            event_status=event.status.value if event.status else "unknown",
            paid_date=event.paid_date,
            created_date=event.created_date,
            notes=alloc.notes,
        ))

    return InvestorDistributionHistory(
        investor_id=investor_id,
        investor_name=inv.name,
        total_distributions=total,
        distributions=items,
    )


# ---------------------------------------------------------------------------
# Waterfall Engine
# ---------------------------------------------------------------------------

@router.post("/waterfall/calculate", response_model=WaterfallResultSchema)
def calculate_waterfall(
    payload: WaterfallInput,
    _: User = Depends(require_gp_or_ops),
):
    result = WaterfallEngine.calculate_distribution(
        distributable_cash=payload.distributable_cash,
        unreturned_capital=payload.unreturned_capital,
        unpaid_pref_balance=payload.unpaid_pref_balance,
        pref_rate=payload.pref_rate,
        gp_promote_share=payload.gp_promote_share,
    )
    return result


# ---------------------------------------------------------------------------
# Investor Statement PDF
# ---------------------------------------------------------------------------

@router.get("/investors/{investor_id}/statement")
def investor_statement_pdf(
    investor_id: int,
    as_of_date: str | None = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Generate and return a PDF investor account statement."""
    inv = _get_investor_or_404(investor_id, db)
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    from app.services.statement_service import generate_investor_statement

    parsed_date = None
    if as_of_date:
        try:
            parsed_date = datetime.date.fromisoformat(as_of_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    pdf_bytes = generate_investor_statement(db, investor_id, as_of_date=parsed_date)

    filename = f"statement_{inv.name.replace(' ', '_')}_{as_of_date or datetime.date.today().isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ===========================================================================
# Investor Onboarding Workflow
# ===========================================================================

# Default checklist steps created for every new investor
_DEFAULT_CHECKLIST = [
    # Phase 1: Relationship Building
    ("info_package_sent", "Information package sent", False, 1),
    ("intro_meeting", "Introductory meeting / call", False, 2),
    ("risk_assessment", "Risk tolerance assessment completed", False, 3),
    ("re_knowledge_review", "Real estate investment knowledge reviewed", False, 4),
    ("financial_profile", "Income & net worth profile captured", False, 5),
    ("investment_goals", "Investment goals & timeline discussed", False, 6),
    ("ioi_obtained", "Obtain Indication of Interest amount", True, 7),
    # Phase 2: KYC & Compliance
    ("kyc_identity", "KYC — Government-issued photo ID", True, 8),
    ("kyc_address", "KYC — Proof of address (utility bill or bank statement)", True, 9),
    ("accreditation_cert", "Accreditation certificate or self-certification", True, 10),
    ("aml_screening", "AML/KYC screening completed", True, 11),
    # Phase 3: Investment Documentation
    ("ioi_form_signed", "Indication of Interest form signed", True, 12),
    ("subscription_agreement", "Signed subscription agreement", True, 13),
    ("banking_info", "Banking / eTransfer information", True, 14),
    ("tax_form", "Tax form (T5013 consent or W-8BEN)", True, 15),
    # Phase 4: Onboarding Complete
    ("welcome_call", "Welcome call with GP", False, 16),
    ("portal_access", "Investor portal access set up", False, 17),
]


def _ensure_checklist(db: Session, investor_id: int):
    """Create default onboarding checklist if none exists."""
    existing = db.query(OnboardingChecklistItem).filter(
        OnboardingChecklistItem.investor_id == investor_id
    ).count()
    if existing > 0:
        return
    for step_name, step_label, is_required, sort_order in _DEFAULT_CHECKLIST:
        db.add(OnboardingChecklistItem(
            investor_id=investor_id,
            step_name=step_name,
            step_label=step_label,
            is_required=is_required,
            sort_order=sort_order,
        ))
    db.flush()


@router.get("/investors/{investor_id}/onboarding", response_model=InvestorOnboardingDetail)
def get_investor_onboarding(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Get investor onboarding status and checklist."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")

    _ensure_checklist(db, investor_id)
    db.commit()

    items = (
        db.query(OnboardingChecklistItem)
        .filter(OnboardingChecklistItem.investor_id == investor_id)
        .order_by(OnboardingChecklistItem.sort_order)
        .all()
    )

    total = len(items)
    completed = sum(1 for i in items if i.is_completed)
    required = sum(1 for i in items if i.is_required)
    completed_required = sum(1 for i in items if i.is_required and i.is_completed)
    is_ready = completed_required >= required and required > 0

    # Build investor dict with assigned_users as plain dicts
    assignments = db.query(ContactAssignment).filter(ContactAssignment.investor_id == investor_id).all()
    inv_data = {c.name: getattr(inv, c.name) for c in inv.__table__.columns}
    inv_data["assigned_users"] = [
        {"user_id": a.user_id, "user_name": a.user.full_name if a.user else None}
        for a in assignments
    ]

    return InvestorOnboardingDetail(
        investor=inv_data,
        checklist=items,
        completed_steps=completed,
        total_steps=total,
        required_steps=required,
        completed_required=completed_required,
        is_ready_for_approval=is_ready,
    )


@router.patch("/investors/{investor_id}/onboarding/status")
def transition_onboarding_status(
    investor_id: int,
    payload: OnboardingStatusTransition,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Transition investor onboarding status with validation."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")

    current = inv.onboarding_status.value if inv.onboarding_status else "lead"
    new = payload.new_status

    # Validate transitions
    allowed_transitions = {
        "lead": ["invited", "documents_pending", "rejected"],
        "invited": ["documents_pending", "rejected"],
        "documents_pending": ["under_review", "rejected"],
        "under_review": ["approved", "documents_pending", "rejected"],
        "approved": ["active", "suspended"],
        "active": ["suspended"],
        "suspended": ["active", "approved"],
        "rejected": ["lead"],  # allow re-opening
    }

    if new not in allowed_transitions.get(current, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{current}' to '{new}'. "
                   f"Allowed: {allowed_transitions.get(current, [])}",
        )

    # Approval requires all required checklist items completed
    if new == "approved":
        _ensure_checklist(db, investor_id)
        items = db.query(OnboardingChecklistItem).filter(
            OnboardingChecklistItem.investor_id == investor_id,
            OnboardingChecklistItem.is_required == True,
        ).all()
        incomplete = [i.step_label for i in items if not i.is_completed]
        if incomplete:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve: {len(incomplete)} required steps incomplete: "
                       + ", ".join(incomplete[:3]) + ("..." if len(incomplete) > 3 else ""),
            )

    inv.onboarding_status = OnboardingStatus(new)

    # Track timestamps
    now = datetime.datetime.utcnow()
    if new == "invited":
        inv.invited_at = now
    elif new == "documents_pending" and not inv.onboarding_started_at:
        inv.onboarding_started_at = now
    elif new == "approved":
        inv.approved_at = now
        inv.approved_by = current_user.user_id
    elif new == "active":
        inv.onboarding_completed_at = now

    db.commit()
    db.refresh(inv)

    return {
        "investor_id": inv.investor_id,
        "name": inv.name,
        "previous_status": current,
        "new_status": new,
        "message": f"Onboarding status changed to '{new}'",
    }


@router.patch("/investors/{investor_id}/onboarding/checklist/{item_id}")
def update_checklist_item(
    investor_id: int,
    item_id: int,
    payload: OnboardingChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Mark a checklist item as complete/incomplete, attach a document."""
    item = db.query(OnboardingChecklistItem).filter(
        OnboardingChecklistItem.item_id == item_id,
        OnboardingChecklistItem.investor_id == investor_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    if payload.is_completed is not None:
        item.is_completed = payload.is_completed
        if payload.is_completed:
            item.completed_at = datetime.datetime.utcnow()
            item.completed_by = current_user.user_id
        else:
            item.completed_at = None
            item.completed_by = None
    if payload.document_id is not None:
        item.document_id = payload.document_id
    if payload.notes is not None:
        item.notes = payload.notes

    db.commit()
    db.refresh(item)
    return item


@router.post("/investors/{investor_id}/onboarding/initialize")
def initialize_onboarding(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Initialize onboarding for an investor — creates checklist and sets status to invited."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")

    _ensure_checklist(db, investor_id)

    if inv.onboarding_status in (None, OnboardingStatus.lead):
        inv.onboarding_status = OnboardingStatus.invited
        inv.invited_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(inv)

    return {
        "investor_id": inv.investor_id,
        "onboarding_status": inv.onboarding_status.value,
        "checklist_items_created": db.query(OnboardingChecklistItem).filter(
            OnboardingChecklistItem.investor_id == investor_id
        ).count(),
        "message": "Onboarding initialized",
    }


# ===========================================================================
# Indications of Interest (IOI) — CRM Pipeline
# ===========================================================================

def _ioi_out(ioi: IndicationOfInterest) -> IOIOut:
    return IOIOut(
        ioi_id=ioi.ioi_id,
        investor_id=ioi.investor_id,
        lp_id=ioi.lp_id,
        indicated_amount=ioi.indicated_amount,
        status=ioi.status.value if ioi.status else "expressed",
        source=ioi.source,
        notes=ioi.notes,
        follow_up_date=ioi.follow_up_date,
        last_contact_date=ioi.last_contact_date,
        subscription_id=ioi.subscription_id,
        converted_at=ioi.converted_at,
        created_at=ioi.created_at,
        investor_name=ioi.investor.name if ioi.investor else None,
        lp_name=ioi.lp.name if ioi.lp else None,
    )


@router.get("/ioi", response_model=list[IOIOut])
def list_iois(
    lp_id: int | None = None,
    investor_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """List all indications of interest, optionally filtered by LP or investor."""
    query = db.query(IndicationOfInterest).order_by(IndicationOfInterest.created_at.desc())
    if lp_id:
        query = query.filter(IndicationOfInterest.lp_id == lp_id)
    if investor_id:
        query = query.filter(IndicationOfInterest.investor_id == investor_id)
    if status_filter:
        query = query.filter(IndicationOfInterest.status == IOIStatus(status_filter))
    return [_ioi_out(i) for i in query.all()]


@router.post("/ioi", response_model=IOIOut, status_code=201)
def create_ioi(
    payload: IOICreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Create an indication of interest for an investor in an LP."""
    inv = db.query(Investor).filter(Investor.investor_id == payload.investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")
    lp = db.query(LPEntity).filter(LPEntity.lp_id == payload.lp_id).first()
    if not lp:
        raise HTTPException(404, "LP not found")

    ioi = IndicationOfInterest(
        investor_id=payload.investor_id,
        lp_id=payload.lp_id,
        indicated_amount=payload.indicated_amount,
        source=payload.source,
        notes=payload.notes,
        follow_up_date=payload.follow_up_date,
    )
    db.add(ioi)
    db.commit()
    db.refresh(ioi)
    return _ioi_out(ioi)


@router.patch("/ioi/{ioi_id}", response_model=IOIOut)
def update_ioi(
    ioi_id: int,
    payload: IOIUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Update an IOI — change amount, status, add notes, log contact."""
    ioi = db.query(IndicationOfInterest).filter(IndicationOfInterest.ioi_id == ioi_id).first()
    if not ioi:
        raise HTTPException(404, "IOI not found")
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"]:
        data["status"] = IOIStatus(data["status"])
    for k, v in data.items():
        setattr(ioi, k, v)
    db.commit()
    db.refresh(ioi)
    return _ioi_out(ioi)


@router.post("/ioi/{ioi_id}/convert")
def convert_ioi_to_subscription(
    ioi_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Convert an IOI into a draft subscription.

    Creates a subscription with the IOI amount and links them.
    The subscription still needs to go through the normal funding workflow.
    """
    ioi = db.query(IndicationOfInterest).filter(IndicationOfInterest.ioi_id == ioi_id).first()
    if not ioi:
        raise HTTPException(404, "IOI not found")
    if ioi.status == IOIStatus.converted:
        raise HTTPException(400, "IOI already converted to subscription")
    if ioi.status in (IOIStatus.withdrawn, IOIStatus.expired):
        raise HTTPException(400, f"Cannot convert IOI with status '{ioi.status.value}'")

    lp = db.query(LPEntity).filter(LPEntity.lp_id == ioi.lp_id).first()
    issue_price = lp.unit_price if lp else None
    unit_qty = (ioi.indicated_amount / issue_price) if issue_price and issue_price > 0 else None

    from app.db.models import SubscriptionStatus
    sub = Subscription(
        investor_id=ioi.investor_id,
        lp_id=ioi.lp_id,
        commitment_amount=ioi.indicated_amount,
        funded_amount=0,
        issue_price=issue_price or 0,
        unit_quantity=unit_qty or 0,
        status=SubscriptionStatus.draft,
        notes=f"Converted from IOI #{ioi.ioi_id}. Source: {ioi.source or 'N/A'}",
    )
    db.add(sub)
    db.flush()

    ioi.status = IOIStatus.converted
    ioi.subscription_id = sub.subscription_id
    ioi.converted_at = datetime.datetime.utcnow()
    db.commit()

    return {
        "ioi_id": ioi.ioi_id,
        "subscription_id": sub.subscription_id,
        "investor_name": ioi.investor.name,
        "lp_name": ioi.lp.name,
        "amount": float(ioi.indicated_amount),
        "message": "IOI converted to draft subscription. Complete the subscription workflow to fund.",
    }


@router.delete("/ioi/{ioi_id}", status_code=204)
def delete_ioi(
    ioi_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    ioi = db.query(IndicationOfInterest).filter(IndicationOfInterest.ioi_id == ioi_id).first()
    if not ioi:
        raise HTTPException(404, "IOI not found")
    db.delete(ioi)
    db.commit()


@router.get("/ioi/lp-summary/{lp_id}", response_model=LPIOISummary)
def get_lp_ioi_summary(
    lp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Get IOI pipeline summary for an LP — total interest, conversion rate, coverage ratio."""
    from decimal import Decimal

    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(404, "LP not found")

    iois = db.query(IndicationOfInterest).filter(IndicationOfInterest.lp_id == lp_id).all()

    total_expressed = sum(float(i.indicated_amount) for i in iois if i.status in (IOIStatus.expressed, IOIStatus.confirmed, IOIStatus.converted))
    total_confirmed = sum(float(i.indicated_amount) for i in iois if i.status in (IOIStatus.confirmed, IOIStatus.converted))
    converted_count = sum(1 for i in iois if i.status == IOIStatus.converted)

    # Subscription totals
    subs = db.query(Subscription).filter(Subscription.lp_id == lp_id).all()
    total_subscribed = sum(float(s.commitment_amount) for s in subs)
    total_funded = sum(float(s.funded_amount) for s in subs)

    target = float(lp.target_raise) if lp.target_raise else None
    ioi_count = len([i for i in iois if i.status not in (IOIStatus.withdrawn, IOIStatus.expired)])

    conversion_rate = (converted_count / ioi_count * 100) if ioi_count > 0 else None
    coverage_ratio = (total_expressed / target * 100) if target and target > 0 else None

    return LPIOISummary(
        lp_id=lp_id,
        lp_name=lp.name,
        target_raise=lp.target_raise,
        total_ioi_expressed=Decimal(str(total_expressed)),
        total_ioi_confirmed=Decimal(str(total_confirmed)),
        total_subscribed=Decimal(str(total_subscribed)),
        total_funded=Decimal(str(total_funded)),
        ioi_count=ioi_count,
        conversion_rate=round(conversion_rate, 1) if conversion_rate else None,
        coverage_ratio=round(coverage_ratio, 1) if coverage_ratio else None,
    )


class QuickAddLeadBody(BaseModel):
    # Name: accepts first_name+last_name OR legacy name field
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    name: Optional[str] = None  # legacy: "First Last" — auto-split if first_name not provided
    email: Optional[str] = None
    lp_id: Optional[int] = None
    indicated_amount: Optional[float] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    # Address: accepts split fields OR legacy address string
    street_address: Optional[str] = None
    street_address_2: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None  # legacy: full address string
    entity_type: Optional[str] = None
    jurisdiction: Optional[str] = None
    accredited_status: Optional[str] = None
    exemption_type: Optional[str] = None
    tax_id: Optional[str] = None
    banking_info: Optional[str] = None
    onboarding_status: Optional[str] = None
    investor_status: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    linkedin_url: Optional[str] = None
    risk_tolerance: Optional[str] = None
    re_knowledge: Optional[str] = None
    other_investments: Optional[str] = None
    income_range: Optional[str] = None
    net_worth_range: Optional[str] = None
    investment_goals: Optional[str] = None
    referral_source: Optional[str] = None


@router.post("/leads/quick-add", status_code=201)
def quick_add_lead(
    body: QuickAddLeadBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Quick-add a new lead — creates investor record + optional IOI in one call.

    This is the CRM entry point: captures a potential investor and their
    interest in a specific LP, all in one step.
    Accepts a JSON body for robust handling of addresses with commas, special chars, etc.
    All investor fields supported for CSV import compatibility.
    Non-admin users are auto-assigned to contacts they create.
    """
    from decimal import Decimal

    # Resolve first_name / last_name from legacy 'name' if needed
    first_name = body.first_name
    last_name = body.last_name
    if not first_name and body.name:
        parts = body.name.strip().split(",", 1) if "," in (body.name or "") else body.name.strip().rsplit(" ", 1)
        if len(parts) == 2 and "," in (body.name or ""):
            last_name = parts[0].strip()
            first_name = parts[1].strip()
        elif len(parts) == 2:
            first_name = parts[0].strip()
            last_name = parts[1].strip()
        else:
            first_name = body.name.strip()
    # Both required — default last_name to empty string if not provided
    first_name = first_name or ""
    last_name = last_name or ""
    # Auto-compute full name
    full_name = f"{first_name} {last_name}".strip()

    # Resolve address fields
    jurisdiction = body.jurisdiction or body.province

    # Check for existing investor by email or full name
    existing = None
    if body.email:
        existing = db.query(Investor).filter(Investor.email == body.email).first()
    if not existing and full_name:
        existing = db.query(Investor).filter(Investor.name == full_name).first()
    if existing:
        inv = existing
        is_new = False
    else:
        inv = Investor(
            first_name=first_name or "",
            last_name=last_name,
            company_name=body.company_name,
            name=full_name,
            email=body.email if body.email else None,
            phone=body.phone,
            mobile=body.mobile,
            street_address=body.street_address,
            street_address_2=body.street_address_2,
            city=body.city,
            province=body.province,
            postal_code=body.postal_code,
            country=body.country or "Canada",
            address=body.address,  # legacy
            entity_type=body.entity_type,
            jurisdiction=jurisdiction,
            accredited_status=body.accredited_status or "pending",
            exemption_type=body.exemption_type,
            tax_id=body.tax_id,
            banking_info=body.banking_info,
            onboarding_status=OnboardingStatus(body.onboarding_status) if body.onboarding_status else OnboardingStatus.lead,
            investor_status=InvestorStatus(body.investor_status) if body.investor_status else InvestorStatus.new_lead,
            notes=body.notes,
            linkedin_url=body.linkedin_url,
            risk_tolerance=body.risk_tolerance,
            re_knowledge=body.re_knowledge,
            other_investments=body.other_investments,
            income_range=body.income_range,
            net_worth_range=body.net_worth_range,
            investment_goals=body.investment_goals,
            referral_source=body.referral_source,
        )
        is_new = True
        db.add(inv)
        try:
            db.flush()
        except Exception:
            db.rollback()
            return {"investor_id": None, "name": body.name, "is_new": False, "message": f"Skipped duplicate: '{body.name}'"}

    # Create IOI if LP and amount provided
    ioi = None
    if body.lp_id and body.indicated_amount:
        lp = db.query(LPEntity).filter(LPEntity.lp_id == body.lp_id).first()
        if lp:
            ioi = IndicationOfInterest(
                investor_id=inv.investor_id,
                lp_id=body.lp_id,
                indicated_amount=Decimal(str(body.indicated_amount)),
                source=body.source,
                notes=body.notes,
            )
            db.add(ioi)
            db.flush()

    # Auto-assign to current user if they're not GP_ADMIN
    if is_new and current_user.role not in (UserRole.DEVELOPER, UserRole.GP_ADMIN):
        existing_assignment = db.query(ContactAssignment).filter(
            ContactAssignment.investor_id == inv.investor_id,
            ContactAssignment.user_id == current_user.user_id,
        ).first()
        if not existing_assignment:
            db.add(ContactAssignment(
                investor_id=inv.investor_id,
                user_id=current_user.user_id,
                assigned_by=current_user.user_id,
                notes="Auto-assigned on create",
            ))

    db.commit()

    return {
        "investor_id": inv.investor_id,
        "name": inv.name,
        "is_new": is_new,
        "onboarding_status": inv.onboarding_status.value if inv.onboarding_status else "lead",
        "ioi_id": ioi.ioi_id if ioi else None,
        "ioi_amount": float(ioi.indicated_amount) if ioi else None,
        "message": f"{'New lead' if not existing else 'Existing investor'} '{body.name}' added"
                   + (f" with ${body.indicated_amount:,.0f} IOI" if ioi else ""),
    }


# ---------------------------------------------------------------------------
# LinkedIn Search & Profile Fetch (via OpenAI)
# ---------------------------------------------------------------------------

@router.post("/investors/{investor_id}/linkedin-search")
def linkedin_search(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Use OpenAI web search to find the investor's LinkedIn profile URL."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")
    from app.db.models import PlatformSetting
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured. Add it in Settings.")
    client = _OpenAI(api_key=api_key)

    location = inv.jurisdiction or ""
    entity = inv.entity_type or ""
    prompt = (
        f"Find the LinkedIn profile URL for this person:\n"
        f"Name: {inv.name}\n"
        f"{'Location: ' + location if location else ''}\n"
        f"{'Type: ' + entity if entity else ''}\n"
        f"{'Email: ' + inv.email if inv.email else ''}\n\n"
        f"Search LinkedIn, Google, company websites, and professional directories.\n"
        f"Return ONLY the LinkedIn profile URL (https://linkedin.com/in/...). "
        f"If you cannot find a matching profile, return 'NOT_FOUND'."
    )

    try:
        response = client.responses.create(
            model="gpt-5.4",
            tools=[{"type": "web_search_preview"}],
            input=prompt,
        )
        result = response.output_text.strip()
        url = None
        for line in result.split("\n"):
            line = line.strip()
            if "linkedin.com/in/" in line:
                # Extract URL
                start = line.find("https://")
                if start == -1:
                    start = line.find("http://")
                if start >= 0:
                    end = len(line)
                    for ch in [" ", ")", "]", '"', "'"]:
                        idx = line.find(ch, start)
                        if idx > start:
                            end = min(end, idx)
                    url = line[start:end]
                    break

        if url and "linkedin.com/in/" in url:
            inv.linkedin_url = url
            db.commit()
            return {"linkedin_url": url, "found": True}
        else:
            return {"linkedin_url": None, "found": False, "raw_response": result[:300]}
    except Exception as e:
        raise HTTPException(500, f"OpenAI search failed: {str(e)}")


@router.post("/investors/{investor_id}/linkedin-fetch")
def linkedin_fetch_info(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Use OpenAI web search to gather publicly available info about this investor
    from LinkedIn, Google, company websites, news, and professional directories."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")
    from app.db.models import PlatformSetting
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured. Add it in Settings.")
    client = _OpenAI(api_key=api_key)

    linkedin_line = f"LinkedIn: {inv.linkedin_url}\n" if inv.linkedin_url else ""
    location = inv.jurisdiction or ""
    entity = inv.entity_type or ""
    email_domain = inv.email.split("@")[1] if inv.email and "@" in inv.email else ""

    prompt = (
        f"Research this person using all publicly available sources — LinkedIn, Google, "
        f"company websites, news articles, professional directories, regulatory filings:\n\n"
        f"Name: {inv.name}\n"
        f"{linkedin_line}"
        f"{'Email domain: ' + email_domain if email_domain else ''}\n"
        f"{'Location: ' + location if location else ''}\n"
        f"{'Profession/Type: ' + entity if entity else ''}\n\n"
        f"Compile a CRM intelligence report with:\n"
        f"1. Current Job Title & Company\n"
        f"2. Industry / Sector\n"
        f"3. Career History (key roles, years of experience)\n"
        f"4. Education (degrees, institutions)\n"
        f"5. Location (city, province/state)\n"
        f"6. Key Skills & Professional Expertise\n"
        f"7. Board Memberships, Associations, or Community Involvement\n"
        f"8. Investment Signals (real estate experience, finance background, "
        f"business ownership, entrepreneurship, wealth indicators)\n"
        f"9. Professional Seniority Level (C-suite, VP, Director, etc.)\n"
        f"10. Estimated Accredited Investor Likelihood (based on profession, seniority, business ownership)\n"
        f"11. News Mentions or Public Awards\n"
        f"12. Any Concerns or Red Flags\n\n"
        f"Use ONLY publicly available information. If a field has no data, say 'Not found'. "
        f"Format as a concise but thorough intelligence brief useful for investor relations."
    )

    try:
        response = client.responses.create(
            model="gpt-5.4",
            tools=[{"type": "web_search_preview"}],
            input=prompt,
        )
        info = response.output_text.strip()

        # Generate a 1-2 paragraph executive summary
        summary_prompt = (
            f"Summarize the following research about {inv.name} in 1-2 short paragraphs. "
            f"Focus on their professional background, investment relevance, and whether they "
            f"would likely qualify as an accredited investor. Keep it concise and actionable "
            f"for a CRM user.\n\n{info}"
        )
        try:
            summary_resp = client.responses.create(
                model="gpt-5.4",
                input=summary_prompt,
            )
            summary = summary_resp.output_text.strip()
        except Exception:
            summary = info[:500] + "..."

        # Store research details and summary separately
        timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        # Save to dedicated research fields only
        inv.research_summary = summary
        inv.research_details = info
        inv.research_date = datetime.datetime.utcnow()

        # Pre-generate TTS audio for instant playback later
        tts_audio_url = None
        try:
            tts_resp = client.audio.speech.create(
                model="tts-1",
                voice="nova",
                input=summary[:4096],
            )
            import os
            uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "tts")
            os.makedirs(uploads_dir, exist_ok=True)
            filename = f"investor_{investor_id}_research.mp3"
            filepath = os.path.join(uploads_dir, filename)
            with open(filepath, "wb") as f:
                for chunk in tts_resp.iter_bytes():
                    f.write(chunk)
            inv.tts_audio_path = f"/uploads/tts/{filename}"
            tts_audio_url = inv.tts_audio_path
        except Exception:
            pass  # TTS cache is best-effort, don't fail the research

        db.commit()

        return {
            "investor_id": investor_id,
            "summary": summary,
            "research_details": info,
            "notes_updated": True,
            "tts_audio_url": tts_audio_url,
        }
    except Exception as e:
        raise HTTPException(500, f"OpenAI fetch failed: {str(e)}")


# ---------------------------------------------------------------------------
# Investor Documents (CRM)
# ---------------------------------------------------------------------------

from fastapi import UploadFile, File as FastAPIFile
import uuid
from pathlib import Path as _Path


# Document template definitions (downloadable blank forms)
DOCUMENT_TEMPLATES = {
    "information_package": {"title": "Information Package", "filename": "Living_Well_Information_Package.pdf"},
    "indication_of_interest": {"title": "Indication of Interest Form", "filename": "IOI_Form.pdf"},
    "subscription_agreement": {"title": "Subscription Agreement", "filename": "Subscription_Agreement.pdf"},
    "partnership_agreement": {"title": "Partnership Agreement", "filename": "Partnership_Agreement.pdf"},
    "banking_form": {"title": "Banking Information Form", "filename": "Banking_Form.pdf"},
    "tax_form": {"title": "Tax Form (T5013 / W-8BEN)", "filename": "Tax_Form.pdf"},
    "accreditation_certificate": {"title": "Accreditation Self-Certification", "filename": "Accreditation_Certificate.pdf"},
}


@router.get("/investors/{investor_id}/documents")
def list_investor_documents(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List all documents for an investor, grouped by category."""
    docs = db.query(InvestorDocument).filter(
        InvestorDocument.investor_id == investor_id
    ).order_by(InvestorDocument.upload_date.desc()).all()

    return [{
        "document_id": d.document_id,
        "investor_id": d.investor_id,
        "title": d.title,
        "document_type": d.document_type.value if d.document_type else "other",
        "file_url": d.file_url,
        "upload_date": str(d.upload_date) if d.upload_date else None,
        "is_viewed": d.is_viewed,
    } for d in docs]


@router.post("/investors/{investor_id}/documents", status_code=201)
def upload_investor_document(
    investor_id: int,
    file: UploadFile = FastAPIFile(...),
    document_type: str = Query("other"),
    title: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Upload a document for an investor."""
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    uploads_dir = _Path(__file__).resolve().parent.parent.parent / "uploads" / "investor-docs"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "pdf"
    filename = f"{investor_id}_{document_type}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = uploads_dir / filename

    content = file.file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "File must be under 20MB")
    with open(filepath, "wb") as f:
        f.write(content)

    file_url = f"/uploads/investor-docs/{filename}"
    doc_title = title or (DOCUMENT_TEMPLATES.get(document_type, {}).get("title") or file.filename or document_type)

    try:
        doc_type_enum = DocumentType(document_type)
    except ValueError:
        doc_type_enum = DocumentType.other

    doc = InvestorDocument(
        investor_id=investor_id,
        title=doc_title,
        document_type=doc_type_enum,
        file_url=file_url,
        upload_date=datetime.datetime.utcnow(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "document_id": doc.document_id,
        "title": doc.title,
        "document_type": document_type,
        "file_url": file_url,
    }


@router.delete("/investors/{investor_id}/documents/{document_id}")
def delete_investor_document(
    investor_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Delete an investor document."""
    doc = db.query(InvestorDocument).filter(
        InvestorDocument.document_id == document_id,
        InvestorDocument.investor_id == investor_id,
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()
    return {"status": "deleted"}


@router.get("/document-templates")
def list_document_templates(
    _: User = Depends(get_current_user),
):
    """List available document templates for download."""
    return [
        {"key": k, "title": v["title"], "filename": v["filename"]}
        for k, v in DOCUMENT_TEMPLATES.items()
    ]


# ---------------------------------------------------------------------------
# K-1 / Tax Documents
# ---------------------------------------------------------------------------

@router.get("/investors/{investor_id}/tax-summary")
def get_investor_tax_summary(
    investor_id: int,
    tax_year: int = 2025,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """
    Generate K-1 tax summary for an investor for a given tax year.
    Shows partnership income allocation, distributions, and capital account.
    """
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(403, "Access denied")

    # Get subscriptions (capital contributions)
    subscriptions = (
        db.query(Subscription)
        .filter(
            Subscription.investor_id == investor_id,
            Subscription.status.in_(["funded", "partially_funded"]),
        )
        .all()
    )

    # Get distributions for the tax year
    year_start = datetime.date(tax_year, 1, 1)
    year_end = datetime.date(tax_year, 12, 31)
    distributions = (
        db.query(DistributionAllocation)
        .filter(
            DistributionAllocation.investor_id == investor_id,
        )
        .join(DistributionEvent)
        .filter(
            DistributionEvent.record_date >= year_start,
            DistributionEvent.record_date <= year_end,
        )
        .all()
    )

    total_contributed = sum(float(s.funded_amount or 0) for s in subscriptions)
    total_distributions = sum(float(d.amount or 0) for d in distributions)

    # Holdings for ownership percentage
    holdings = (
        db.query(Holding)
        .filter(Holding.investor_id == investor_id)
        .all()
    )

    # Build per-LP breakdown
    lp_ids = set()
    for s in subscriptions:
        if s.lp_id:
            lp_ids.add(s.lp_id)
    for h in holdings:
        if h.lp_id:
            lp_ids.add(h.lp_id)

    lp_breakdowns = []
    for lp_id in lp_ids:
        lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
        if not lp:
            continue

        lp_subs = [s for s in subscriptions if s.lp_id == lp_id]
        lp_dists = [d for d in distributions if d.lp_id == lp_id]
        lp_holdings = [h for h in holdings if h.lp_id == lp_id]

        lp_contributed = sum(float(s.funded_amount or 0) for s in lp_subs)
        lp_distributed = sum(float(d.amount or 0) for d in lp_dists)
        ownership_pct = sum(float(h.ownership_percent or 0) for h in lp_holdings)

        lp_breakdowns.append({
            "lp_id": lp_id,
            "lp_name": lp.name,
            "capital_contributed": round(lp_contributed, 2),
            "distributions_received": round(lp_distributed, 2),
            "ownership_percent": round(ownership_pct, 4),
            "beginning_capital": round(lp_contributed, 2),
            "ending_capital": round(lp_contributed - lp_distributed, 2),
        })

    # Check for existing K-1 documents
    existing_docs = (
        db.query(InvestorDocument)
        .filter(
            InvestorDocument.investor_id == investor_id,
            InvestorDocument.document_type == DocumentType.tax_form,
            InvestorDocument.title.contains(str(tax_year)),
        )
        .all()
    )

    return {
        "investor_id": investor_id,
        "investor_name": inv.name,
        "tax_year": tax_year,
        "total_capital_contributed": round(total_contributed, 2),
        "total_distributions": round(total_distributions, 2),
        "net_capital_account": round(total_contributed - total_distributions, 2),
        "lp_breakdowns": lp_breakdowns,
        "has_k1_document": len(existing_docs) > 0,
        "k1_documents": [
            {
                "document_id": d.document_id,
                "title": d.title,
                "upload_date": d.upload_date.isoformat() if d.upload_date else None,
                "is_viewed": d.is_viewed,
            }
            for d in existing_docs
        ],
    }


@router.get("/tax-documents")
def list_tax_documents(
    tax_year: int = 2025,
    lp_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """
    List all tax documents across investors for a tax year.
    Used by GP to track K-1 distribution status.
    """
    investors = db.query(Investor).all()

    result = []
    for inv in investors:
        # Check subscriptions for this investor
        sub_query = db.query(Subscription).filter(
            Subscription.investor_id == inv.investor_id,
            Subscription.status.in_(["funded", "partially_funded"]),
        )
        if lp_id:
            sub_query = sub_query.filter(Subscription.lp_id == lp_id)
        subs = sub_query.all()
        if not subs:
            continue

        total_contributed = sum(float(s.funded_amount or 0) for s in subs)

        # Check for K-1 docs
        existing_docs = (
            db.query(InvestorDocument)
            .filter(
                InvestorDocument.investor_id == inv.investor_id,
                InvestorDocument.document_type == DocumentType.tax_form,
                InvestorDocument.title.contains(str(tax_year)),
            )
            .all()
        )

        # Year distributions
        year_start = datetime.date(tax_year, 1, 1)
        year_end = datetime.date(tax_year, 12, 31)
        year_dists = (
            db.query(DistributionAllocation)
            .filter(DistributionAllocation.investor_id == inv.investor_id)
            .join(DistributionEvent)
            .filter(
                DistributionEvent.record_date >= year_start,
                DistributionEvent.record_date <= year_end,
            )
            .all()
        )
        total_distributed = sum(float(d.amount or 0) for d in year_dists)

        lp_names = list(set(s.lp.name for s in subs if s.lp))

        result.append({
            "investor_id": inv.investor_id,
            "investor_name": inv.name,
            "email": inv.email,
            "lp_names": lp_names,
            "capital_contributed": round(total_contributed, 2),
            "distributions": round(total_distributed, 2),
            "k1_status": "uploaded" if existing_docs else "pending",
            "k1_documents": [
                {
                    "document_id": d.document_id,
                    "title": d.title,
                    "is_viewed": d.is_viewed,
                }
                for d in existing_docs
            ],
        })

    pending = sum(1 for r in result if r["k1_status"] == "pending")
    uploaded = sum(1 for r in result if r["k1_status"] == "uploaded")

    return {
        "tax_year": tax_year,
        "total_investors": len(result),
        "k1_uploaded": uploaded,
        "k1_pending": pending,
        "investors": result,
    }


# ===========================================================================
# CRM Activity Log
# ===========================================================================

from app.db.models import CRMActivity, CRMActivityType


class CRMActivityCreate(BaseModel):
    activity_type: str
    subject: str
    body: Optional[str] = None
    outcome: Optional[str] = None
    follow_up_date: Optional[str] = None
    follow_up_notes: Optional[str] = None
    meeting_date: Optional[str] = None
    meeting_location: Optional[str] = None
    attendees: Optional[str] = None


class CRMActivityUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    outcome: Optional[str] = None
    follow_up_date: Optional[str] = None
    follow_up_notes: Optional[str] = None
    is_follow_up_done: Optional[bool] = None
    meeting_date: Optional[str] = None
    meeting_location: Optional[str] = None
    attendees: Optional[str] = None


@router.get("/investors/{investor_id}/activities")
def list_crm_activities(
    investor_id: int,
    activity_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """List CRM activities for an investor, newest first."""
    query = db.query(CRMActivity).filter(CRMActivity.investor_id == investor_id)
    if activity_type:
        query = query.filter(CRMActivity.activity_type == activity_type)
    activities = query.order_by(CRMActivity.created_at.desc()).limit(limit).all()

    return [
        {
            "activity_id": a.activity_id,
            "investor_id": a.investor_id,
            "activity_type": a.activity_type.value if hasattr(a.activity_type, "value") else a.activity_type,
            "subject": a.subject,
            "body": a.body,
            "outcome": a.outcome,
            "follow_up_date": str(a.follow_up_date) if a.follow_up_date else None,
            "follow_up_notes": a.follow_up_notes,
            "is_follow_up_done": a.is_follow_up_done,
            "meeting_date": a.meeting_date.isoformat() if a.meeting_date else None,
            "meeting_location": a.meeting_location,
            "attendees": a.attendees,
            "created_by": a.creator.full_name if a.creator else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in activities
    ]


@router.post("/investors/{investor_id}/activities", status_code=201)
def create_crm_activity(
    investor_id: int,
    payload: CRMActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Log a CRM activity (call, email, meeting, note)."""
    from datetime import datetime as dt, date as _date

    investor = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not investor:
        raise HTTPException(404, "Investor not found")

    activity = CRMActivity(
        investor_id=investor_id,
        activity_type=CRMActivityType(payload.activity_type),
        subject=payload.subject,
        body=payload.body,
        outcome=payload.outcome,
        follow_up_date=_date.fromisoformat(payload.follow_up_date) if payload.follow_up_date else None,
        follow_up_notes=payload.follow_up_notes,
        meeting_date=dt.fromisoformat(payload.meeting_date) if payload.meeting_date else None,
        meeting_location=payload.meeting_location,
        attendees=payload.attendees,
        created_by=current_user.user_id,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    return {
        "activity_id": activity.activity_id,
        "activity_type": activity.activity_type.value,
        "subject": activity.subject,
        "created_at": activity.created_at.isoformat(),
    }


@router.patch("/activities/{activity_id}")
def update_crm_activity(
    activity_id: int,
    payload: CRMActivityUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Update a CRM activity."""
    from datetime import datetime as dt, date as _date

    activity = db.query(CRMActivity).filter(CRMActivity.activity_id == activity_id).first()
    if not activity:
        raise HTTPException(404, "Activity not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "follow_up_date" and val:
            val = _date.fromisoformat(val)
        elif field == "meeting_date" and val:
            val = dt.fromisoformat(val)
        setattr(activity, field, val)

    db.commit()
    db.refresh(activity)
    return {"status": "updated", "activity_id": activity.activity_id}


@router.delete("/activities/{activity_id}", status_code=204)
def delete_crm_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    activity = db.query(CRMActivity).filter(CRMActivity.activity_id == activity_id).first()
    if not activity:
        raise HTTPException(404, "Activity not found")
    db.delete(activity)
    db.commit()


@router.get("/investors/{investor_id}/follow-ups")
def list_pending_follow_ups(
    investor_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """List pending follow-ups across all investors (or for a specific one)."""
    query = db.query(CRMActivity).filter(
        CRMActivity.follow_up_date.isnot(None),
        CRMActivity.is_follow_up_done == False,
    )
    if investor_id:
        query = query.filter(CRMActivity.investor_id == investor_id)

    activities = query.order_by(CRMActivity.follow_up_date.asc()).limit(50).all()
    return [
        {
            "activity_id": a.activity_id,
            "investor_id": a.investor_id,
            "investor_name": a.investor.name if a.investor else None,
            "activity_type": a.activity_type.value if hasattr(a.activity_type, "value") else a.activity_type,
            "subject": a.subject,
            "follow_up_date": str(a.follow_up_date),
            "follow_up_notes": a.follow_up_notes,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in activities
    ]


@router.patch("/investors/{investor_id}/edit")
def edit_investor_crm(
    investor_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Edit investor fields from the CRM (name, email, phone, notes, entity_type, etc.)."""
    investor = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not investor:
        raise HTTPException(404, "Investor not found")

    allowed = {"first_name", "last_name", "company_name", "name", "email", "phone", "mobile",
               "street_address", "street_address_2", "city", "province", "postal_code", "country",
               "address", "entity_type", "jurisdiction",
               "accredited_status", "exemption_type", "tax_id", "banking_info", "notes",
               "investor_status", "linkedin_url", "risk_tolerance", "re_knowledge",
               "other_investments", "income_range", "net_worth_range", "investment_goals",
               "referral_source"}

    # Pre-flight uniqueness check on email — investors.email has a UNIQUE
    # constraint, so a clean 409 with a helpful message is better than a
    # generic 500 from the IntegrityError raised on commit.
    if "email" in payload:
        new_email = (payload.get("email") or "").strip() or None
        if new_email and new_email != investor.email:
            existing = (
                db.query(Investor)
                .filter(Investor.email == new_email, Investor.investor_id != investor_id)
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"That email address is already in use by another investor "
                        f"(#{existing.investor_id} {existing.name or ''}). "
                        f"Use a different address or merge the contacts."
                    ),
                )

    for key, val in payload.items():
        if key in allowed:
            setattr(investor, key, val if val != "" else None)

    # Auto-compute full name if first/last changed
    if "first_name" in payload or "last_name" in payload:
        fn = investor.first_name or ""
        ln = investor.last_name or ""
        investor.name = f"{fn} {ln}".strip()

    try:
        db.commit()
        db.refresh(investor)
    except IntegrityError as e:
        db.rollback()
        # Catch any other unique-constraint hits we didn't pre-check
        msg = str(e.orig) if hasattr(e, "orig") else str(e)
        if "UNIQUE" in msg.upper() and "email" in msg.lower():
            raise HTTPException(409, "Email address already in use by another investor")
        raise HTTPException(400, f"Database constraint failed: {msg}")

    return {
        "investor_id": investor.investor_id,
        "name": investor.name,
        "email": investor.email,
        "status": "updated",
    }


# ===========================================================================
# Contact Assignments (CRM ownership)
# ===========================================================================

@router.get("/investors/{investor_id}/assignments")
def list_assignments(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List all users assigned to this investor contact."""
    assignments = db.query(ContactAssignment).filter(
        ContactAssignment.investor_id == investor_id
    ).all()
    return [{
        "assignment_id": a.assignment_id,
        "investor_id": a.investor_id,
        "user_id": a.user_id,
        "user_name": a.user.full_name if a.user else None,
        "user_email": a.user.email if a.user else None,
        "user_role": a.user.role.value if a.user else None,
        "assigned_at": str(a.assigned_at),
        "assigned_by_name": a.assigner.full_name if a.assigner else None,
        "notes": a.notes,
    } for a in assignments]


class AssignContactBody(BaseModel):
    user_id: int
    notes: str | None = None


@router.post("/investors/{investor_id}/assignments", status_code=201)
def assign_contact(
    investor_id: int,
    body: AssignContactBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Assign a user to this investor contact. Auto-updates status from new_lead to warm_lead."""
    investor = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not investor:
        raise HTTPException(404, "Investor not found")
    user = db.query(User).filter(User.user_id == body.user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    # Check for duplicate
    existing = db.query(ContactAssignment).filter(
        ContactAssignment.investor_id == investor_id,
        ContactAssignment.user_id == body.user_id,
    ).first()
    if existing:
        return {"assignment_id": existing.assignment_id, "message": "Already assigned"}

    assignment = ContactAssignment(
        investor_id=investor_id,
        user_id=body.user_id,
        assigned_by=current_user.user_id,
        notes=body.notes,
    )
    db.add(assignment)

    # Auto-advance from new_lead when first assigned
    if investor.investor_status == InvestorStatus.new_lead:
        investor.investor_status = InvestorStatus.warm_lead

    db.commit()
    db.refresh(assignment)
    return {
        "assignment_id": assignment.assignment_id,
        "investor_id": investor_id,
        "user_id": body.user_id,
        "user_name": user.full_name,
        "message": f"Assigned {user.full_name} to {investor.name}",
    }


@router.delete("/investors/{investor_id}/assignments/{user_id}")
def unassign_contact(
    investor_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Remove a user assignment from this investor contact."""
    assignment = db.query(ContactAssignment).filter(
        ContactAssignment.investor_id == investor_id,
        ContactAssignment.user_id == user_id,
    ).first()
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    db.delete(assignment)
    db.commit()
    return {"message": "Unassigned"}


# ===========================================================================
# Investor Status Updates
# ===========================================================================

class UpdateInvestorStatusBody(BaseModel):
    investor_status: str


@router.patch("/investors/{investor_id}/status")
def update_investor_status(
    investor_id: int,
    body: UpdateInvestorStatusBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Update the sales pipeline status of an investor contact."""
    investor = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not investor:
        raise HTTPException(404, "Investor not found")
    try:
        new_status = InvestorStatus(body.investor_status)
    except ValueError:
        valid = [s.value for s in InvestorStatus]
        raise HTTPException(400, f"Invalid status. Valid: {', '.join(valid)}")

    # Require email or phone for statuses beyond warm_lead
    contact_required = {InvestorStatus.prospect, InvestorStatus.hot_prospect, InvestorStatus.investor}
    if new_status in contact_required and not investor.email and not investor.phone:
        raise HTTPException(
            400,
            "Cannot advance to this status without an email or phone number. "
            "Please update the contact details first."
        )

    old_status = investor.investor_status
    investor.investor_status = new_status
    db.commit()
    return {
        "investor_id": investor_id,
        "old_status": old_status.value if old_status else None,
        "new_status": new_status.value,
    }


# ===========================================================================
# Follow-up Scheduler
# ===========================================================================

class ScheduleFollowUpBody(BaseModel):
    follow_up_type: str  # call, email, meeting
    follow_up_date: str  # ISO date string
    follow_up_time: Optional[str] = None  # HH:MM
    subject: Optional[str] = None
    notes: Optional[str] = None


@router.post("/investors/{investor_id}/schedule-followup", status_code=201)
def schedule_followup(
    investor_id: int,
    body: ScheduleFollowUpBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule a follow-up call, email, or meeting. Creates a CRM activity with follow_up_date."""
    from app.db.models import CRMActivity, CRMActivityType
    from datetime import date as _date

    investor = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not investor:
        raise HTTPException(404, "Investor not found")

    # Map follow_up_type to CRM activity type
    type_map = {
        "call": CRMActivityType.call,
        "email": CRMActivityType.email,
        "meeting": CRMActivityType.meeting,
    }
    activity_type = type_map.get(body.follow_up_type, CRMActivityType.follow_up)

    subject = body.subject or f"Follow-up {body.follow_up_type} with {investor.name}"
    follow_date = _date.fromisoformat(body.follow_up_date)

    activity = CRMActivity(
        investor_id=investor_id,
        activity_type=activity_type,
        subject=subject,
        body=body.notes,
        follow_up_date=follow_date,
        follow_up_notes=f"Scheduled {body.follow_up_type}" + (f" at {body.follow_up_time}" if body.follow_up_time else ""),
        is_follow_up_done=False,
        created_by=current_user.user_id,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    # Build Google Calendar event link
    from urllib.parse import quote
    start_dt = body.follow_up_date.replace("-", "")
    if body.follow_up_time:
        start_dt += "T" + body.follow_up_time.replace(":", "") + "00"
        # End time = 30 minutes later
        h, m = int(body.follow_up_time.split(":")[0]), int(body.follow_up_time.split(":")[1])
        end_m = m + 30
        end_h = h + end_m // 60
        end_m = end_m % 60
        end_dt = body.follow_up_date.replace("-", "") + f"T{end_h:02d}{end_m:02d}00"
    else:
        end_dt = start_dt  # all-day event

    gcal_url = (
        f"https://calendar.google.com/calendar/render?action=TEMPLATE"
        f"&text={quote(subject)}"
        f"&dates={start_dt}/{end_dt}"
        f"&details={quote(body.notes or '')}"
    )

    return {
        "activity_id": activity.activity_id,
        "investor_id": investor_id,
        "type": body.follow_up_type,
        "date": body.follow_up_date,
        "time": body.follow_up_time,
        "subject": subject,
        "message": f"Follow-up {body.follow_up_type} scheduled for {body.follow_up_date}",
        "google_calendar_url": gcal_url,
    }


# ===========================================================================
# Voice Recording & Transcription
# ===========================================================================

@router.post("/investors/{investor_id}/transcribe-call", status_code=201)
def transcribe_call_recording(
    investor_id: int,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a voice recording, transcribe via OpenAI Whisper, return transcript."""
    from app.db.models import CRMActivity, CRMActivityType, PlatformSetting

    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    # Read audio file
    content = file.file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio file must be under 25MB")

    # Save audio file
    uploads_dir = _Path(__file__).resolve().parent.parent.parent / "uploads" / "call-recordings"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "webm"
    filename = f"{investor_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = uploads_dir / filename
    with open(filepath, "wb") as f:
        f.write(content)
    audio_url = f"/uploads/call-recordings/{filename}"

    # Transcribe via OpenAI Whisper
    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured. Add it in Settings.")

    client = _OpenAI(api_key=api_key)

    try:
        with open(filepath, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )
        transcript = transcription if isinstance(transcription, str) else str(transcription)
    except Exception as e:
        transcript = f"[Transcription failed: {str(e)}]"

    # Don't create CRM activity here — the frontend Log Activity form handles that.
    # This endpoint only transcribes and returns the text.

    return {
        "activity_id": None,
        "investor_id": investor_id,
        "transcript": transcript,
        "audio_url": audio_url,
        "duration_seconds": None,
    }


# ===========================================================================
# Text-to-Speech (OpenAI TTS)
# ===========================================================================

class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"  # alloy, echo, fable, onyx, nova, shimmer


@router.post("/tts")
def text_to_speech(
    body: TTSRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Convert text to natural speech using OpenAI TTS. Returns audio file URL."""
    from app.db.models import PlatformSetting

    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured")

    client = _OpenAI(api_key=api_key)

    try:
        from fastapi.responses import StreamingResponse

        response = client.audio.speech.create(
            model="tts-1",
            voice=body.voice,
            input=body.text[:4096],
        )

        # Stream directly to client for faster playback start
        return StreamingResponse(
            response.iter_bytes(),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"},
        )
    except Exception as e:
        raise HTTPException(500, f"TTS failed: {str(e)}")


# ===========================================================================
# CRM Activity Statistics
# ===========================================================================

@router.get("/crm-stats")
def get_crm_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get CRM activity statistics for the current user — today, this week, this month."""
    from app.db.models import CRMActivity, InvestorTask
    from datetime import date, timedelta
    from sqlalchemy import func as sa_func, and_

    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday
    month_start = today.replace(day=1)

    def count_activities(since: date, activity_type: str = None):
        q = db.query(sa_func.count(CRMActivity.activity_id)).filter(
            sa_func.date(CRMActivity.created_at) >= since,
        )
        if current_user.role not in (UserRole.DEVELOPER, UserRole.GP_ADMIN):
            q = q.filter(CRMActivity.created_by == current_user.user_id)
        if activity_type:
            q = q.filter(CRMActivity.activity_type == activity_type)
        return q.scalar() or 0

    # Overdue follow-ups
    overdue_followups_q = db.query(sa_func.count(CRMActivity.activity_id)).filter(
        CRMActivity.follow_up_date < today,
        CRMActivity.is_follow_up_done == False,
    )
    if current_user.role not in (UserRole.DEVELOPER, UserRole.GP_ADMIN):
        overdue_followups_q = overdue_followups_q.filter(CRMActivity.created_by == current_user.user_id)
    overdue_followups = overdue_followups_q.scalar() or 0

    # Overdue tasks
    overdue_tasks_q = db.query(sa_func.count(InvestorTask.task_id)).filter(
        InvestorTask.due_date < today,
        InvestorTask.is_completed == False,
    )
    if current_user.role not in (UserRole.DEVELOPER, UserRole.GP_ADMIN):
        overdue_tasks_q = overdue_tasks_q.filter(InvestorTask.created_by == current_user.user_id)
    overdue_tasks = overdue_tasks_q.scalar() or 0

    # Open tasks total
    open_tasks_q = db.query(sa_func.count(InvestorTask.task_id)).filter(InvestorTask.is_completed == False)
    if current_user.role not in (UserRole.DEVELOPER, UserRole.GP_ADMIN):
        open_tasks_q = open_tasks_q.filter(InvestorTask.created_by == current_user.user_id)
    open_tasks = open_tasks_q.scalar() or 0

    # New leads this week/month
    new_leads_week = db.query(sa_func.count(Investor.investor_id)).filter(
        sa_func.date(Investor.created_at) >= week_start,
    ).scalar() or 0
    new_leads_month = db.query(sa_func.count(Investor.investor_id)).filter(
        sa_func.date(Investor.created_at) >= month_start,
    ).scalar() or 0

    return {
        "today": {
            "calls": count_activities(today, "call"),
            "emails": count_activities(today, "email"),
            "meetings": count_activities(today, "meeting"),
            "notes": count_activities(today, "note"),
            "total": count_activities(today),
        },
        "week": {
            "calls": count_activities(week_start, "call"),
            "emails": count_activities(week_start, "email"),
            "meetings": count_activities(week_start, "meeting"),
            "notes": count_activities(week_start, "note"),
            "total": count_activities(week_start),
        },
        "month": {
            "calls": count_activities(month_start, "call"),
            "emails": count_activities(month_start, "email"),
            "meetings": count_activities(month_start, "meeting"),
            "notes": count_activities(month_start, "note"),
            "total": count_activities(month_start),
        },
        "overdue_followups": overdue_followups,
        "overdue_tasks": overdue_tasks,
        "open_tasks": open_tasks,
        "new_leads_week": new_leads_week,
        "new_leads_month": new_leads_month,
    }


# ===========================================================================
# Investor Tasks
# ===========================================================================

from app.db.models import InvestorTask


@router.get("/investors/{investor_id}/tasks")
def list_investor_tasks(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tasks = db.query(InvestorTask).filter(
        InvestorTask.investor_id == investor_id
    ).order_by(InvestorTask.is_completed, InvestorTask.due_date.asc().nullslast(), InvestorTask.created_at.desc()).all()
    return [{
        "task_id": t.task_id,
        "description": t.description,
        "due_date": str(t.due_date) if t.due_date else None,
        "is_completed": t.is_completed,
        "completed_date": str(t.completed_date) if t.completed_date else None,
        "source": t.source,
        "priority": t.priority,
        "created_at": str(t.created_at),
    } for t in tasks]


class CreateTaskBody(BaseModel):
    description: str
    due_date: Optional[str] = None
    priority: str = "normal"


@router.post("/investors/{investor_id}/tasks", status_code=201)
def create_investor_task(
    investor_id: int,
    body: CreateTaskBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as _date
    task = InvestorTask(
        investor_id=investor_id,
        description=body.description,
        due_date=_date.fromisoformat(body.due_date) if body.due_date else None,
        priority=body.priority,
        source="manual",
        created_by=current_user.user_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"task_id": task.task_id, "description": task.description}


@router.patch("/investors/{investor_id}/tasks/{task_id}")
def update_investor_task(
    investor_id: int,
    task_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from datetime import date as _date
    task = db.query(InvestorTask).filter(
        InvestorTask.task_id == task_id, InvestorTask.investor_id == investor_id
    ).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if "is_completed" in payload:
        task.is_completed = bool(payload["is_completed"])
        task.completed_date = _date.today() if task.is_completed else None
    if "description" in payload:
        task.description = payload["description"]
    if "due_date" in payload:
        task.due_date = _date.fromisoformat(payload["due_date"]) if payload["due_date"] else None
    if "priority" in payload:
        task.priority = payload["priority"]
    db.commit()
    return {"task_id": task.task_id, "is_completed": task.is_completed, "completed_date": str(task.completed_date) if task.completed_date else None}


@router.delete("/investors/{investor_id}/tasks/{task_id}")
def delete_investor_task(
    investor_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    task = db.query(InvestorTask).filter(
        InvestorTask.task_id == task_id, InvestorTask.investor_id == investor_id
    ).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return {"status": "deleted"}


@router.post("/investors/{investor_id}/tasks/suggest")
def suggest_tasks(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Use OpenAI to suggest tasks based on recent activity, SMS messages,
    call transcripts, research, notes, and investor status."""
    from app.db.models import CRMActivity, PlatformSetting, TwilioSMSLog, TwilioCallLog

    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    # Gather recent CRM activities (calls, emails, meetings, notes, etc.)
    activities = db.query(CRMActivity).filter(
        CRMActivity.investor_id == investor_id
    ).order_by(CRMActivity.created_at.desc()).limit(15).all()

    activity_text = "\n".join([
        f"- [{a.activity_type.value if hasattr(a.activity_type, 'value') else a.activity_type}] "
        f"{a.subject}: {(a.body or '')[:300]} (Outcome: {a.outcome or 'none'})"
        for a in activities
    ]) or "No recent activities."

    # Gather SMS conversation history
    sms_messages = db.query(TwilioSMSLog).filter(
        TwilioSMSLog.investor_id == investor_id
    ).order_by(TwilioSMSLog.created_at.desc()).limit(20).all()

    sms_text = ""
    if sms_messages:
        sms_text = "SMS Conversation (most recent first):\n" + "\n".join([
            f"- [{m.direction.upper()}] {m.body[:200]}"
            for m in sms_messages
        ])

    # Gather call transcripts
    call_logs = db.query(TwilioCallLog).filter(
        TwilioCallLog.investor_id == investor_id,
        TwilioCallLog.transcript.isnot(None),
    ).order_by(TwilioCallLog.created_at.desc()).limit(5).all()

    transcript_text = ""
    if call_logs:
        transcript_text = "Call Transcripts:\n" + "\n---\n".join([
            f"Call on {c.created_at.strftime('%Y-%m-%d')} ({c.duration_seconds or 0}s): {c.transcript[:500]}"
            for c in call_logs
        ])

    # Research summary
    research_text = ""
    if inv.research_summary:
        research_text = f"Research Summary:\n{inv.research_summary[:500]}"

    # Get existing tasks
    existing = db.query(InvestorTask).filter(
        InvestorTask.investor_id == investor_id, InvestorTask.is_completed == False
    ).all()
    existing_text = "\n".join([f"- {t.description}" for t in existing]) or "None"

    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured")

    client = _OpenAI(api_key=api_key)

    prompt = (
        f"You are a CRM assistant for a real estate investment syndication company. "
        f"Based on ALL the following data for investor {inv.first_name} {inv.last_name}, "
        f"suggest 3-5 actionable follow-up tasks.\n\n"
        f"Extract action items from conversations, text messages, call transcripts, "
        f"and any commitments or requests made by either party.\n\n"
        f"Investor Status: {inv.investor_status.value if inv.investor_status else 'new_lead'}\n"
        f"Company: {inv.company_name or 'N/A'}\n"
        f"Notes: {(inv.notes or '')[:500]}\n\n"
        f"{research_text}\n\n"
        f"Recent CRM Activities:\n{activity_text}\n\n"
        f"{sms_text}\n\n"
        f"{transcript_text}\n\n"
        f"Existing Open Tasks (do NOT duplicate):\n{existing_text}\n\n"
        f"TODAY'S DATE IS: {datetime.date.today().isoformat()}\n\n"
        f"Return ONLY a JSON array of objects, each with:\n"
        f'- "description": short actionable task description\n'
        f'- "due_date": suggested date in YYYY-MM-DD format (MUST be today or in the future, within next 30 days)\n'
        f'- "priority": "low", "normal", or "high"\n\n'
        f"IMPORTANT: All due_date values MUST be in {datetime.date.today().year}. Never use past dates.\n\n"
        f"Focus on: action items from conversations, promised follow-ups, "
        f"document requests, meeting scheduling, and next steps to advance the relationship."
    )

    import json as _json
    import re as _re

    def _parse_json_array(text: str) -> list:
        """Parse a JSON array from text, handling markdown code fences."""
        text = text.strip()
        # Strip markdown code fences (```json ... ``` or ``` ... ```)
        text = _re.sub(r"^```(?:json)?\s*", "", text)
        text = _re.sub(r"\s*```$", "", text)
        text = text.strip()
        if text.startswith("["):
            return _json.loads(text)
        # Try to find array in the text
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            return _json.loads(text[start:end])
        return []

    import logging as _logging

    suggestions = []
    # Try Claude first
    try:
        from app.services.ai import _call_claude_json
        result = _call_claude_json(prompt, max_tokens=1024)
        if isinstance(result, list) and len(result) > 0:
            suggestions = result
        elif isinstance(result, dict) and result:
            suggestions = result.get("tasks", result.get("suggestions", []))
        if not suggestions:
            raise ValueError("Claude returned empty result")
        _logging.info(f"AI Suggest: Claude returned {len(suggestions)} suggestions")
    except Exception as e:
        _logging.info(f"AI Suggest: Claude failed ({e}), trying OpenAI...")
        # Fall back to OpenAI
        try:
            response = client.responses.create(model="gpt-5.4", input=prompt)
            raw = response.output_text
            _logging.info(f"AI Suggest: OpenAI raw response: {raw[:200]}")
            suggestions = _parse_json_array(raw)
            _logging.info(f"AI Suggest: OpenAI parsed {len(suggestions)} suggestions")
        except Exception as e2:
            _logging.error(f"AI Suggest: OpenAI also failed: {e2}")
            suggestions = []

    _logging.info(f"AI Suggest: Final suggestions count = {len(suggestions)}")

    # Save suggestions as tasks
    from datetime import date as _date
    created = []
    today = _date.today()
    for s in suggestions[:5]:
        desc = s.get("description", "")
        if not desc:
            continue
        due = None
        try:
            due = _date.fromisoformat(s.get("due_date", ""))
            # Fix past dates — push to today + 3 days
            if due < today:
                due = today + datetime.timedelta(days=3)
        except (ValueError, TypeError):
            pass
        task = InvestorTask(
            investor_id=investor_id,
            description=desc,
            due_date=due,
            priority=s.get("priority", "normal"),
            source="ai_suggested",
            created_by=current_user.user_id,
        )
        db.add(task)
        created.append(desc)

    db.commit()
    return {"suggested": len(created), "tasks": created}


# ===========================================================================
# Task Actions — AI-suggested execution steps for tasks
# ===========================================================================

from app.db.models import TaskAction, TaskActionType


@router.post("/tasks/{task_id}/generate-actions")
def generate_task_actions(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate AI-suggested execution actions for a task."""
    from app.db.models import PlatformSetting

    task = db.query(InvestorTask).filter(InvestorTask.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    inv = db.query(Investor).filter(Investor.investor_id == task.investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    # Don't regenerate if actions already exist
    existing_actions = db.query(TaskAction).filter(
        TaskAction.task_id == task_id, TaskAction.is_dismissed == False
    ).all()
    if existing_actions:
        return _format_actions_response(existing_actions)

    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured")

    client = _OpenAI(api_key=api_key)

    investor_name = f"{inv.first_name or ''} {inv.last_name or ''}".strip()
    investor_email = inv.email or ""
    investor_phone = inv.mobile or inv.phone or ""

    prompt = (
        f"You are a CRM assistant. Today's date is {datetime.date.today().isoformat()}.\n"
        f"For the following task, suggest 2-4 concrete execution actions "
        f"that a user can take to complete it. Each action should be immediately actionable.\n\n"
        f"Task: {task.description}\n"
        f"Due: {task.due_date or 'Not set'}\n"
        f"Priority: {task.priority or 'normal'}\n\n"
        f"Investor: {investor_name}\n"
        f"Email: {investor_email or 'Not on file'}\n"
        f"Phone: {investor_phone or 'Not on file'}\n"
        f"Status: {inv.investor_status.value if inv.investor_status else 'new_lead'}\n"
        f"Company: {inv.company_name or 'N/A'}\n\n"
        f"Return ONLY a JSON array of objects, each with:\n"
        f'- "action_type": one of "send_email", "send_sms", "schedule_calendar", "make_call", "prepare_document", "research", "other"\n'
        f'- "title": short action title (e.g. "Send introduction email")\n'
        f'- "description": brief explanation of what this action does\n'
        f'- "draft_content": the actual draft content (email body, SMS text, meeting agenda, etc.) — make it professional and ready to send\n'
        f'- "metadata": object with relevant details:\n'
        f'  - For emails: {{"to": "email", "subject": "subject line"}}\n'
        f'  - For SMS: {{"to": "phone number"}}\n'
        f'  - For calendar: {{"title": "event title", "date": "YYYY-MM-DD", "time": "HH:MM", "duration_minutes": 30}}\n'
        f'  - For calls: {{"to": "phone number"}}\n'
        f'  - For others: {{}}\n\n'
        f"Make the draft content specific to {investor_name} and professional. "
        f"Use the company name 'Living Well Communities' for the sender."
    )

    import json as _json
    import re as _re

    def _parse_json_array(text: str) -> list:
        text = text.strip()
        text = _re.sub(r"^```(?:json)?\s*", "", text)
        text = _re.sub(r"\s*```$", "", text)
        text = text.strip()
        if text.startswith("["):
            return _json.loads(text)
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            return _json.loads(text[start:end])
        return []

    try:
        response = client.responses.create(model="gpt-5.4", input=prompt)
        actions_data = _parse_json_array(response.output_text)
    except Exception:
        actions_data = []

    if not actions_data:
        raise HTTPException(500, "Failed to generate actions")

    created = []
    for a in actions_data[:4]:
        action_type_str = a.get("action_type", "other")
        try:
            action_type = TaskActionType(action_type_str)
        except ValueError:
            action_type = TaskActionType.other

        metadata = a.get("metadata", {})
        action = TaskAction(
            task_id=task_id,
            action_type=action_type,
            title=a.get("title", "Action"),
            description=a.get("description", ""),
            draft_content=a.get("draft_content", ""),
            metadata_json=_json.dumps(metadata) if metadata else None,
        )
        db.add(action)
        created.append(action)

    db.commit()
    for a in created:
        db.refresh(a)

    return _format_actions_response(created)


@router.get("/tasks/{task_id}/actions")
def get_task_actions(
    task_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get execution actions for a task."""
    actions = db.query(TaskAction).filter(
        TaskAction.task_id == task_id, TaskAction.is_dismissed == False
    ).all()
    return _format_actions_response(actions)


@router.post("/tasks/actions/{action_id}/execute")
def execute_task_action(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Execute a task action — sends email, SMS, creates calendar event, etc."""
    import json as _json

    action = db.query(TaskAction).filter(TaskAction.action_id == action_id).first()
    if not action:
        raise HTTPException(404, "Action not found")
    if action.is_executed:
        raise HTTPException(400, "Action already executed")

    task = db.query(InvestorTask).filter(InvestorTask.task_id == action.task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    inv = db.query(Investor).filter(Investor.investor_id == task.investor_id).first()
    metadata = _json.loads(action.metadata_json) if action.metadata_json else {}
    result = {"action_id": action_id, "status": "executed", "details": {}}

    if action.action_type == TaskActionType.send_sms:
        # Send SMS via Twilio
        to_number = metadata.get("to") or inv.mobile or inv.phone
        if not to_number:
            raise HTTPException(400, "No phone number available")
        try:
            from app.services.twilio_service import send_sms
            sms_log = send_sms(
                db=db,
                investor_id=task.investor_id,
                body=action.draft_content or "",
                sent_by_user_id=current_user.user_id,
                to_number=to_number,
            )
            result["details"] = {"sms_log_id": sms_log.sms_log_id, "to": to_number}
        except Exception as e:
            raise HTTPException(500, f"SMS send failed: {str(e)}")

    elif action.action_type == TaskActionType.send_email:
        # Generate a mailto: link (or send via Resend if configured)
        to_email = metadata.get("to") or inv.email
        subject = metadata.get("subject", "")
        body = action.draft_content or ""
        if not to_email:
            raise HTTPException(400, "No email address available")
        # Try sending via Resend
        try:
            from app.db.models import PlatformSetting
            resend_key = db.query(PlatformSetting).filter(PlatformSetting.key == "RESEND_API_KEY").first()
            from_email_setting = db.query(PlatformSetting).filter(PlatformSetting.key == "RESEND_FROM_EMAIL").first()
            if resend_key and resend_key.value:
                import resend
                resend.api_key = resend_key.value
                from_email = from_email_setting.value if from_email_setting and from_email_setting.value else "onboarding@resend.dev"
                resend.Emails.send({
                    "from": from_email,
                    "to": to_email,
                    "subject": subject,
                    "text": body,
                })
                result["details"] = {"sent_via": "resend", "to": to_email}
            else:
                # Return mailto link as fallback
                import urllib.parse
                mailto = f"mailto:{to_email}?subject={urllib.parse.quote(subject)}&body={urllib.parse.quote(body)}"
                result["details"] = {"mailto_url": mailto, "to": to_email}
                result["status"] = "draft_ready"
        except Exception as e:
            import urllib.parse
            mailto = f"mailto:{to_email}?subject={urllib.parse.quote(subject)}&body={urllib.parse.quote(body)}"
            result["details"] = {"mailto_url": mailto, "to": to_email, "fallback_reason": str(e)}
            result["status"] = "draft_ready"

    elif action.action_type == TaskActionType.schedule_calendar:
        # Generate Google Calendar URL
        title = metadata.get("title", action.title)
        date = metadata.get("date", "")
        time = metadata.get("time", "09:00")
        duration = int(metadata.get("duration_minutes", 30))
        description = action.draft_content or ""

        if date:
            start_str = f"{date}T{time}:00"
            from datetime import datetime as _dt, timedelta
            try:
                start = _dt.fromisoformat(start_str)
                end = start + timedelta(minutes=duration)
                gcal_url = (
                    f"https://calendar.google.com/calendar/render?action=TEMPLATE"
                    f"&text={_url_encode(title)}"
                    f"&dates={start.strftime('%Y%m%dT%H%M%S')}/{end.strftime('%Y%m%dT%H%M%S')}"
                    f"&details={_url_encode(description)}"
                )
                result["details"] = {"google_calendar_url": gcal_url, "date": date, "time": time}
            except Exception:
                result["details"] = {"date": date, "time": time, "title": title}
                result["status"] = "draft_ready"
        else:
            result["status"] = "draft_ready"
            result["details"] = {"title": title}

    elif action.action_type == TaskActionType.make_call:
        to_number = metadata.get("to") or inv.mobile or inv.phone
        result["details"] = {"to": to_number, "note": "Use the Comms tab to initiate the call"}
        result["status"] = "draft_ready"

    else:
        result["status"] = "noted"
        result["details"] = {"note": "Action logged as completed"}

    # Mark action as executed
    action.is_executed = True
    action.executed_at = datetime.datetime.utcnow()
    db.commit()

    return result


@router.delete("/tasks/actions/{action_id}")
def dismiss_task_action(
    action_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Dismiss/delete a suggested action."""
    action = db.query(TaskAction).filter(TaskAction.action_id == action_id).first()
    if not action:
        raise HTTPException(404, "Action not found")
    action.is_dismissed = True
    db.commit()
    return {"status": "dismissed"}


def _format_actions_response(actions):
    """Format actions for API response."""
    import json as _json
    return [
        {
            "action_id": a.action_id,
            "task_id": a.task_id,
            "action_type": a.action_type.value if hasattr(a.action_type, "value") else a.action_type,
            "title": a.title,
            "description": a.description,
            "draft_content": a.draft_content,
            "metadata": _json.loads(a.metadata_json) if a.metadata_json else {},
            "is_executed": a.is_executed,
            "executed_at": a.executed_at.isoformat() if a.executed_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in actions
    ]


def _url_encode(s: str) -> str:
    import urllib.parse
    return urllib.parse.quote(s, safe="")


# ===========================================================================
# My Pipeline — Personal investor funnel with conversion metrics
# ===========================================================================

PIPELINE_STAGES = ["new_lead", "warm_lead", "prospect", "hot_prospect", "investor"]
STAGE_PROBABILITIES = {
    "new_lead": 0.05,
    "warm_lead": 0.15,
    "prospect": 0.30,
    "hot_prospect": 0.60,
    "investor": 1.0,
    "write_off": 0.0,
    "archived": 0.0,
}
DEFAULT_ESTIMATE = 50000  # Default $ estimate when no IOI exists


@router.get("/my-pipeline")
def get_my_pipeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Return aggregated pipeline data for the current user's assigned contacts."""
    from app.db.models import (
        ContactAssignment, CRMActivity, CRMActivityType,
        IndicationOfInterest, Subscription, TwilioSMSLog, TwilioCallLog,
    )
    from sqlalchemy import func as _func
    from decimal import Decimal

    # Get assigned investor IDs
    assignments = db.query(ContactAssignment.investor_id).filter(
        ContactAssignment.user_id == current_user.user_id
    ).all()
    assigned_ids = [a[0] for a in assignments]

    if not assigned_ids:
        return {
            "stages": [],
            "contacts": [],
            "activity_metrics": [],
            "total_pipeline_value": 0,
            "total_committed_value": 0,
            "total_funded_value": 0,
            "total_contacts": 0,
        }

    # Get all assigned investors
    investors = db.query(Investor).filter(Investor.investor_id.in_(assigned_ids)).all()

    # Get IOIs for these investors
    iois = db.query(IndicationOfInterest).filter(
        IndicationOfInterest.investor_id.in_(assigned_ids)
    ).all()
    ioi_by_investor = {}
    for ioi in iois:
        if ioi.investor_id not in ioi_by_investor:
            ioi_by_investor[ioi.investor_id] = []
        ioi_by_investor[ioi.investor_id].append(ioi)

    # Get subscriptions
    subs = db.query(Subscription).filter(
        Subscription.investor_id.in_(assigned_ids)
    ).all()
    sub_by_investor = {}
    for s in subs:
        if s.investor_id not in sub_by_investor:
            sub_by_investor[s.investor_id] = []
        sub_by_investor[s.investor_id].append(s)

    # Get activity counts per investor (by this user)
    activity_counts = (
        db.query(
            CRMActivity.investor_id,
            _func.count(CRMActivity.activity_id).label("count"),
            _func.max(CRMActivity.created_at).label("last_activity"),
        )
        .filter(
            CRMActivity.investor_id.in_(assigned_ids),
            CRMActivity.created_by == current_user.user_id,
        )
        .group_by(CRMActivity.investor_id)
        .all()
    )
    activity_map = {a.investor_id: {"count": a.count, "last": a.last_activity} for a in activity_counts}

    # Build stages
    stage_data = {s: {"count": 0, "ioi_total": Decimal(0), "committed": Decimal(0), "funded": Decimal(0), "estimated": Decimal(0)} for s in PIPELINE_STAGES}

    contacts = []
    for inv in investors:
        status = inv.investor_status.value if inv.investor_status else "new_lead"
        if status in ("write_off", "archived"):
            continue

        # IOI amount
        inv_iois = ioi_by_investor.get(inv.investor_id, [])
        ioi_amount = sum(float(i.indicated_amount or 0) for i in inv_iois)

        # Subscription amounts
        inv_subs = sub_by_investor.get(inv.investor_id, [])
        committed = sum(float(s.commitment_amount or 0) for s in inv_subs)
        funded = sum(float(s.funded_amount or 0) for s in inv_subs)

        # Estimate value
        base_amount = ioi_amount or committed or DEFAULT_ESTIMATE
        probability = STAGE_PROBABILITIES.get(status, 0.05)
        estimated = base_amount * probability

        # Activity info
        act_info = activity_map.get(inv.investor_id, {"count": 0, "last": None})

        # Days in current stage (approximate from updated_at)
        days_in_stage = (datetime.date.today() - (inv.updated_at or inv.created_at or datetime.datetime.utcnow()).date()).days if (inv.updated_at or inv.created_at) else 0

        # Aggregate into stage
        if status in stage_data:
            stage_data[status]["count"] += 1
            stage_data[status]["ioi_total"] += Decimal(str(ioi_amount))
            stage_data[status]["committed"] += Decimal(str(committed))
            stage_data[status]["funded"] += Decimal(str(funded))
            stage_data[status]["estimated"] += Decimal(str(estimated))

        contacts.append({
            "investor_id": inv.investor_id,
            "name": f"{inv.first_name or ''} {inv.last_name or ''}".strip(),
            "company": inv.company_name or "",
            "investor_status": status,
            "ioi_amount": ioi_amount,
            "committed_amount": committed,
            "funded_amount": funded,
            "estimated_value": round(estimated, 2),
            "probability": probability,
            "last_activity_date": act_info["last"].isoformat() if act_info["last"] else None,
            "activity_count": act_info["count"],
            "days_in_stage": max(days_in_stage, 0),
            "email": inv.email or "",
            "phone": inv.phone or inv.mobile or "",
        })

    # Build stages response
    stages = []
    for s in PIPELINE_STAGES:
        d = stage_data[s]
        stages.append({
            "stage": s,
            "label": s.replace("_", " ").title(),
            "count": d["count"],
            "ioi_total": float(d["ioi_total"]),
            "committed": float(d["committed"]),
            "funded": float(d["funded"]),
            "estimated_value": float(d["estimated"]),
            "probability": STAGE_PROBABILITIES[s],
        })

    # Activity metrics by type
    activity_by_type = (
        db.query(
            CRMActivity.activity_type,
            _func.count(CRMActivity.activity_id).label("total"),
            _func.count(_func.distinct(CRMActivity.investor_id)).label("contacts_touched"),
        )
        .filter(
            CRMActivity.investor_id.in_(assigned_ids),
            CRMActivity.created_by == current_user.user_id,
        )
        .group_by(CRMActivity.activity_type)
        .all()
    )

    # Conversion data: which activity types appear for converted investors
    converted_ids = {inv.investor_id for inv in investors if inv.investor_status and inv.investor_status.value == "investor"}
    activity_metrics = []
    for at in activity_by_type:
        atype = at.activity_type.value if hasattr(at.activity_type, "value") else str(at.activity_type)
        # Count how many converted investors have this activity type
        converted_with = 0
        if converted_ids:
            converted_with = db.query(_func.count(_func.distinct(CRMActivity.investor_id))).filter(
                CRMActivity.investor_id.in_(converted_ids),
                CRMActivity.activity_type == at.activity_type,
                CRMActivity.created_by == current_user.user_id,
            ).scalar() or 0

        activity_metrics.append({
            "activity_type": atype,
            "total_count": at.total,
            "contacts_touched": at.contacts_touched,
            "avg_per_contact": round(at.total / max(at.contacts_touched, 1), 1),
            "converted_contacts": converted_with,
        })

    total_pipeline = sum(s["estimated_value"] for s in stages)
    total_committed = sum(s["committed"] for s in stages)
    total_funded = sum(s["funded"] for s in stages)

    return {
        "stages": stages,
        "contacts": sorted(contacts, key=lambda c: PIPELINE_STAGES.index(c["investor_status"]) if c["investor_status"] in PIPELINE_STAGES else 99),
        "activity_metrics": activity_metrics,
        "total_pipeline_value": round(total_pipeline, 2),
        "total_committed_value": round(total_committed, 2),
        "total_funded_value": round(total_funded, 2),
        "total_contacts": len(contacts),
    }


@router.get("/my-pipeline/trends")
def get_pipeline_trends(
    period: str = "weekly",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Historical pipeline stage counts over time based on status change activities."""
    from app.db.models import ContactAssignment, CRMActivity, CRMActivityType
    from sqlalchemy import func as _func

    assigned_ids = [a[0] for a in db.query(ContactAssignment.investor_id).filter(
        ContactAssignment.user_id == current_user.user_id
    ).all()]

    if not assigned_ids:
        return []

    # Get status change activities for assigned contacts
    status_changes = (
        db.query(CRMActivity)
        .filter(
            CRMActivity.investor_id.in_(assigned_ids),
            CRMActivity.activity_type == CRMActivityType.status_change,
        )
        .order_by(CRMActivity.created_at.asc())
        .all()
    )

    # Also get all assigned investors for current snapshot
    investors = db.query(Investor).filter(Investor.investor_id.in_(assigned_ids)).all()

    # Build weekly/monthly snapshots from status changes
    from collections import defaultdict
    snapshots = defaultdict(lambda: {s: 0 for s in PIPELINE_STAGES})

    # Current state as the latest snapshot
    now_key = datetime.date.today().strftime("%Y-W%V" if period == "weekly" else "%Y-%m")
    for inv in investors:
        status = inv.investor_status.value if inv.investor_status else "new_lead"
        if status in PIPELINE_STAGES:
            snapshots[now_key][status] += 1

    # Parse historical transitions to build earlier snapshots
    for sc in status_changes:
        if sc.created_at:
            key = sc.created_at.strftime("%Y-W%V" if period == "weekly" else "%Y-%m")
            # Try to extract new status from subject
            subject = (sc.subject or "").lower()
            for stage in PIPELINE_STAGES:
                if stage.replace("_", " ") in subject or stage in subject:
                    snapshots[key][stage] = snapshots[key].get(stage, 0) + 1

    # Sort by period
    result = []
    for key in sorted(snapshots.keys()):
        entry = {"period": key}
        entry.update(snapshots[key])
        result.append(entry)

    return result[-12:]  # Last 12 periods


@router.get("/my-pipeline/activity-impact")
def get_activity_impact(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Show which activity types correlate with conversion to investor status."""
    from app.db.models import ContactAssignment, CRMActivity
    from sqlalchemy import func as _func

    assigned_ids = [a[0] for a in db.query(ContactAssignment.investor_id).filter(
        ContactAssignment.user_id == current_user.user_id
    ).all()]

    if not assigned_ids:
        return []

    investors = db.query(Investor).filter(Investor.investor_id.in_(assigned_ids)).all()
    converted_ids = {inv.investor_id for inv in investors if inv.investor_status and inv.investor_status.value == "investor"}
    non_converted_ids = {inv.investor_id for inv in investors if inv.investor_id not in converted_ids and inv.investor_status and inv.investor_status.value not in ("write_off", "archived")}

    # Get activity types and their counts for converted vs non-converted
    all_types = db.query(CRMActivity.activity_type).filter(
        CRMActivity.investor_id.in_(assigned_ids)
    ).distinct().all()

    results = []
    for (atype,) in all_types:
        atype_val = atype.value if hasattr(atype, "value") else str(atype)

        # Contacts with this activity type who converted
        converted_with = db.query(_func.count(_func.distinct(CRMActivity.investor_id))).filter(
            CRMActivity.investor_id.in_(converted_ids),
            CRMActivity.activity_type == atype,
        ).scalar() or 0 if converted_ids else 0

        # Contacts with this activity type who haven't converted
        non_converted_with = db.query(_func.count(_func.distinct(CRMActivity.investor_id))).filter(
            CRMActivity.investor_id.in_(non_converted_ids),
            CRMActivity.activity_type == atype,
        ).scalar() or 0 if non_converted_ids else 0

        total_with = converted_with + non_converted_with
        conversion_rate = round(converted_with / total_with * 100, 1) if total_with > 0 else 0

        results.append({
            "activity_type": atype_val,
            "converted_contacts": converted_with,
            "non_converted_contacts": non_converted_with,
            "total_contacts": total_with,
            "conversion_rate": conversion_rate,
        })

    return sorted(results, key=lambda r: r["conversion_rate"], reverse=True)


# ===========================================================================
# Investor Query — AI chat about a specific investor using all data sources
# ===========================================================================

class InvestorQueryRequest(BaseModel):
    question: str
    conversation_history: list[dict] = []  # [{role, content}, ...]


@router.post("/investors/{investor_id}/query")
def investor_query(
    investor_id: int,
    body: InvestorQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Answer questions about an investor using ALL available data.

    Gathers: profile, activities, SMS messages, call transcripts, tasks,
    documents, research, subscriptions, follow-ups, and assignments.
    Auto-triggers research if none exists.
    """
    import json as _json
    import re as _re
    from app.db.models import (
        CRMActivity, PlatformSetting, TwilioSMSLog, TwilioCallLog,
        InvestorDocument, Subscription, ContactAssignment,
    )

    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    # ── Gather ALL data sources ──────────────────────────────────────

    # 1. Profile
    investor_name = f"{inv.first_name or ''} {inv.last_name or ''}".strip()
    profile_data = (
        f"Name: {investor_name}\n"
        f"Email: {inv.email or 'N/A'}\n"
        f"Phone: {inv.phone or 'N/A'}\n"
        f"Mobile: {inv.mobile or 'N/A'}\n"
        f"Company/Trust: {inv.company_name or 'N/A'}\n"
        f"Entity Type: {inv.entity_type or 'N/A'}\n"
        f"Status: {inv.investor_status.value if inv.investor_status else 'new_lead'}\n"
        f"Accredited: {inv.accredited_status or 'N/A'}\n"
        f"Exemption: {inv.exemption_type or 'N/A'}\n"
        f"Jurisdiction: {inv.jurisdiction or 'N/A'}\n"
        f"Address: {', '.join(filter(None, [inv.street_address, inv.street_address_2, inv.city, inv.province, inv.postal_code, inv.country]))}\n"
        f"Risk Tolerance: {inv.risk_tolerance or 'N/A'}\n"
        f"RE Knowledge: {inv.re_knowledge or 'N/A'}\n"
        f"Income Range: {inv.income_range or 'N/A'}\n"
        f"Net Worth Range: {inv.net_worth_range or 'N/A'}\n"
        f"Investment Goals: {inv.investment_goals or 'N/A'}\n"
        f"Referral Source: {inv.referral_source or 'N/A'}\n"
        f"Notes: {inv.notes or 'None'}\n"
    )

    # 2. Research
    research_data = ""
    if inv.research_summary:
        research_data = f"Research Summary:\n{inv.research_summary}\n"
    if inv.research_details:
        research_data += f"\nFull Research Details:\n{inv.research_details[:3000]}\n"
    if not research_data:
        research_data = "No research has been conducted yet.\n"

    # 3. CRM Activities (last 25)
    activities = db.query(CRMActivity).filter(
        CRMActivity.investor_id == investor_id
    ).order_by(CRMActivity.created_at.desc()).limit(25).all()
    activity_data = "CRM Activity Log:\n"
    if activities:
        for a in activities:
            atype = a.activity_type.value if hasattr(a.activity_type, "value") else str(a.activity_type)
            ts = a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else ""
            activity_data += f"- [{ts}] [{atype}] {a.subject}: {(a.body or '')[:300]}"
            if a.outcome:
                activity_data += f" | Outcome: {a.outcome}"
            activity_data += "\n"
    else:
        activity_data += "No activities logged.\n"

    # 4. SMS Messages (last 30)
    sms_messages = db.query(TwilioSMSLog).filter(
        TwilioSMSLog.investor_id == investor_id
    ).order_by(TwilioSMSLog.created_at.asc()).limit(30).all()
    sms_data = ""
    if sms_messages:
        sms_data = "SMS Conversation:\n"
        for m in sms_messages:
            ts = m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else ""
            direction = "SENT" if m.direction == "outbound" else "RECEIVED"
            sms_data += f"- [{ts}] [{direction}] {m.body[:300]}\n"

    # 5. Call Transcripts
    call_logs = db.query(TwilioCallLog).filter(
        TwilioCallLog.investor_id == investor_id
    ).order_by(TwilioCallLog.created_at.desc()).limit(10).all()
    call_data = ""
    if call_logs:
        call_data = "Call History:\n"
        for c in call_logs:
            ts = c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else ""
            dur = f"{c.duration_seconds}s" if c.duration_seconds else "N/A"
            call_data += f"- [{ts}] {c.direction} to {c.to_number} | Status: {c.status.value if hasattr(c.status, 'value') else c.status} | Duration: {dur}\n"
            if c.transcript:
                call_data += f"  Transcript: {c.transcript[:500]}\n"

    # 6. Tasks
    tasks = db.query(InvestorTask).filter(
        InvestorTask.investor_id == investor_id
    ).order_by(InvestorTask.created_at.desc()).limit(20).all()
    task_data = ""
    if tasks:
        task_data = "Tasks:\n"
        for t in tasks:
            status = "DONE" if t.is_completed else "OPEN"
            task_data += f"- [{status}] {t.description} (Due: {t.due_date or 'N/A'}, Priority: {t.priority or 'normal'})\n"

    # 7. Documents
    documents = db.query(InvestorDocument).filter(
        InvestorDocument.investor_id == investor_id
    ).all()
    doc_data = ""
    if documents:
        doc_data = "Uploaded Documents:\n"
        for d in documents:
            dtype = d.document_type.value if hasattr(d.document_type, "value") else str(d.document_type)
            viewed = "viewed" if d.is_viewed else "not viewed"
            doc_data += f"- {d.title} (Type: {dtype}, {viewed}, Uploaded: {d.upload_date.strftime('%Y-%m-%d') if d.upload_date else 'N/A'})\n"

    # 8. Subscriptions / Investments
    subscriptions = db.query(Subscription).filter(
        Subscription.investor_id == investor_id
    ).all()
    sub_data = ""
    if subscriptions:
        sub_data = "Investment Subscriptions:\n"
        for s in subscriptions:
            sub_data += (
                f"- LP #{s.lp_id}: Amount ${s.amount:,.2f}, "
                f"Status: {s.status.value if hasattr(s.status, 'value') else s.status}, "
                f"Date: {s.subscription_date.strftime('%Y-%m-%d') if s.subscription_date else 'N/A'}\n"
            )

    # 9. Assigned Users
    assignments = db.query(ContactAssignment).filter(
        ContactAssignment.investor_id == investor_id
    ).all()
    assign_data = ""
    if assignments:
        from app.db.models import User as _User
        assign_data = "Assigned To:\n"
        for a in assignments:
            user = db.query(_User).filter(_User.user_id == a.user_id).first()
            assign_data += f"- {user.full_name or user.email} (Scope: {a.scope or 'N/A'})\n"

    # ── Build the full context ───────────────────────────────────────

    full_context = (
        f"=== INVESTOR PROFILE ===\n{profile_data}\n"
        f"=== RESEARCH ===\n{research_data}\n"
        f"=== ACTIVITY LOG ===\n{activity_data}\n"
    )
    if sms_data:
        full_context += f"=== SMS MESSAGES ===\n{sms_data}\n"
    if call_data:
        full_context += f"=== CALL HISTORY & TRANSCRIPTS ===\n{call_data}\n"
    if task_data:
        full_context += f"=== TASKS ===\n{task_data}\n"
    if doc_data:
        full_context += f"=== DOCUMENTS ===\n{doc_data}\n"
    if sub_data:
        full_context += f"=== INVESTMENTS ===\n{sub_data}\n"
    if assign_data:
        full_context += f"=== TEAM ASSIGNMENTS ===\n{assign_data}\n"

    # ── Call AI ──────────────────────────────────────────────────────

    setting = db.query(PlatformSetting).filter(PlatformSetting.key == "OPENAI_API_KEY").first()
    api_key = setting.value if setting else None
    if not api_key:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured")

    try:
        from openai import OpenAI as _OpenAI
    except ImportError:
        raise HTTPException(400, "OpenAI package not installed")

    client = _OpenAI(api_key=api_key)

    system_prompt = (
        f"You are an AI CRM assistant for Living Well Communities, a real estate investment syndication company. "
        f"You have access to ALL data about the investor below. Answer questions thoroughly and accurately "
        f"based ONLY on the available data. If information is not available, say so clearly.\n\n"
        f"Today's date: {datetime.date.today().isoformat()}\n\n"
        f"{full_context}"
    )

    # Build messages for conversation
    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.conversation_history[-10:]:  # Keep last 10 turns
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": body.question})

    try:
        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=messages,
            max_completion_tokens=2048,
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(500, f"AI query failed: {str(e)}")

    # Check if research should be triggered
    needs_research = not inv.research_summary and not inv.research_details
    research_triggered = False
    if needs_research and ("research" in body.question.lower() or "background" in body.question.lower() or "linkedin" in body.question.lower()):
        research_triggered = True

    return {
        "answer": answer,
        "investor_id": investor_id,
        "investor_name": investor_name,
        "data_sources_used": {
            "profile": True,
            "research": bool(inv.research_summary or inv.research_details),
            "activities": len(activities),
            "sms_messages": len(sms_messages),
            "call_logs": len(call_logs),
            "tasks": len(tasks),
            "documents": len(documents),
            "subscriptions": len(subscriptions),
        },
        "needs_research": needs_research,
        "research_triggered": research_triggered,
    }


# ===========================================================================
# Investor Compliance Check
# ===========================================================================

@router.get("/investors/{investor_id}/compliance")
def get_investor_compliance(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Check investor compliance readiness for subscription/funding/issuance."""
    from app.services.validation_service import validate_investor_compliance
    from app.db.models import InvestorDocument, OnboardingChecklistItem

    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(404, "Investor not found")

    # Check at all three levels
    sub_check = validate_investor_compliance(db, inv, "subscription", bypass=True)
    fund_check = validate_investor_compliance(db, inv, "funding", bypass=True)
    issue_check = validate_investor_compliance(db, inv, "issuance", bypass=True)

    # Get document summary
    docs = db.query(InvestorDocument).filter(
        InvestorDocument.investor_id == investor_id
    ).all()
    doc_types = [d.document_type.value if hasattr(d.document_type, "value") else str(d.document_type) for d in docs]

    # Get checklist progress
    checklist = db.query(OnboardingChecklistItem).filter(
        OnboardingChecklistItem.investor_id == investor_id
    ).all()
    total_required = len([c for c in checklist if c.is_required])
    completed_required = len([c for c in checklist if c.is_required and c.is_completed])

    return {
        "investor_id": investor_id,
        "investor_status": inv.investor_status.value if inv.investor_status else "new_lead",
        "onboarding_status": inv.onboarding_status.value if inv.onboarding_status else "lead",
        "accredited_status": inv.accredited_status or "pending",
        "accreditation_expires_at": inv.accreditation_expires_at.isoformat() if inv.accreditation_expires_at else None,
        "checklist_progress": f"{completed_required}/{total_required}",
        "documents_on_file": doc_types,
        "subscription_ready": sub_check,
        "funding_ready": fund_check,
        "issuance_ready": issue_check,
    }
