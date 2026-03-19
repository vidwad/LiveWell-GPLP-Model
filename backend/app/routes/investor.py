"""
API routes for the Investor domain.
Ownership/Contributions/Distributions are now handled via the investment routes
(GP, LP, Subscription, Holding, DistributionEvent).
This file retains: Investor CRUD, Dashboard, Documents, Messages, Waterfall.
"""
import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_admin, require_gp_or_ops, require_investor_or_above
from app.db.models import (
    Investor, InvestorDocument, InvestorMessage, User, UserRole,
    Subscription, Holding, DistributionAllocation, DistributionEvent, LPEntity,
    OnboardingStatus, OnboardingChecklistItem, IndicationOfInterest, IOIStatus,
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
    )


def _get_investor_or_404(investor_id: int, db: Session) -> Investor:
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")
    return inv


# ---------------------------------------------------------------------------
# Investors
# ---------------------------------------------------------------------------

@router.get("/investors", response_model=list[InvestorOut])
def list_investors(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    return db.query(Investor).all()


@router.get("/investors-summary", response_model=list[InvestorSummary])
def list_investors_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Return all investors with subscription summary data for the list view."""
    from decimal import Decimal as D
    investors = db.query(Investor).all()
    terminal = {"issued", "closed", "rejected", "withdrawn", "cancelled"}
    result = []
    for inv in investors:
        subs = (
            db.query(Subscription)
            .options(joinedload(Subscription.lp))
            .filter(Subscription.investor_id == inv.investor_id)
            .order_by(Subscription.created_at.desc())
            .all()
        )
        total_committed = sum((s.commitment_amount or D(0) for s in subs), D(0))
        total_funded = sum((s.funded_amount or D(0) for s in subs), D(0))
        active = [s for s in subs if (s.status.value if s.status else "draft") not in terminal]
        lp_names = list({s.lp.name for s in subs if s.lp})
        latest_status = subs[0].status.value if subs and subs[0].status else None
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
            active_subscriptions=len(active),
            lp_names=lp_names,
            latest_status=latest_status,
            created_at=inv.created_at,
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


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

@router.post("/investors/{investor_id}/documents", response_model=DocumentOut)
def upload_document(
    investor_id: int,
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    _get_investor_or_404(investor_id, db)
    doc = InvestorDocument(
        investor_id=investor_id,
        upload_date=datetime.datetime.utcnow(),
        **payload.model_dump()
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/investors/{investor_id}/documents", response_model=list[DocumentOut])
def list_documents(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    inv = _get_investor_or_404(investor_id, db)
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return sorted(inv.documents, key=lambda x: x.upload_date, reverse=True) if inv.documents else []


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
    ("kyc_identity", "KYC — Government-issued photo ID", True, 1),
    ("kyc_address", "KYC — Proof of address (utility bill or bank statement)", True, 2),
    ("accreditation_cert", "Accreditation certificate or self-certification", True, 3),
    ("subscription_agreement", "Signed subscription agreement", True, 4),
    ("banking_info", "Banking / eTransfer information", True, 5),
    ("tax_form", "Tax form (T5013 consent or W-8BEN)", True, 6),
    ("aml_screening", "AML/KYC screening completed", True, 7),
    ("welcome_call", "Welcome call with GP", False, 8),
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

    return InvestorOnboardingDetail(
        investor=inv,
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


@router.post("/leads/quick-add", status_code=201)
def quick_add_lead(
    name: str,
    email: str,
    lp_id: int | None = None,
    indicated_amount: float | None = None,
    phone: str | None = None,
    source: str | None = None,
    notes: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    """Quick-add a new lead — creates investor record + optional IOI in one call.

    This is the CRM entry point: captures a potential investor and their
    interest in a specific LP, all in one step.
    """
    from decimal import Decimal

    # Check for existing investor
    existing = db.query(Investor).filter(Investor.email == email).first()
    if existing:
        inv = existing
    else:
        inv = Investor(
            name=name,
            email=email,
            phone=phone,
            accredited_status="pending",
            onboarding_status=OnboardingStatus.lead,
            notes=notes,
        )
        db.add(inv)
        db.flush()

    # Create IOI if LP and amount provided
    ioi = None
    if lp_id and indicated_amount:
        lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
        if lp:
            ioi = IndicationOfInterest(
                investor_id=inv.investor_id,
                lp_id=lp_id,
                indicated_amount=Decimal(str(indicated_amount)),
                source=source,
                notes=notes,
            )
            db.add(ioi)
            db.flush()

    db.commit()

    return {
        "investor_id": inv.investor_id,
        "name": inv.name,
        "is_new": not existing,
        "onboarding_status": inv.onboarding_status.value if inv.onboarding_status else "lead",
        "ioi_id": ioi.ioi_id if ioi else None,
        "ioi_amount": float(ioi.indicated_amount) if ioi else None,
        "message": f"{'New lead' if not existing else 'Existing investor'} '{name}' added"
                   + (f" with ${indicated_amount:,.0f} IOI" if ioi else ""),
    }
