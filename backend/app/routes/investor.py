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
)
from app.db.session import get_db
from app.schemas.investor import (
    DocumentCreate, DocumentOut,
    InvestorCreate, InvestorUpdate, InvestorDashboard, InvestorOut, InvestorSummary,
    InvestorDistributionHistory, InvestorDistributionItem,
    MessageCreate, MessageOut,
    WaterfallInput, WaterfallResultSchema,
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
