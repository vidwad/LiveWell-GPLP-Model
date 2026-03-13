"""
API routes for the Investor domain.
Ownership/Contributions/Distributions are now handled via the investment routes
(GP, LP, Subscription, Holding, DistributionEvent).
This file retains: Investor CRUD, Dashboard, Documents, Messages, Waterfall.
"""
import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_admin, require_gp_or_ops, require_investor_or_above
from app.db.models import (
    Investor, InvestorDocument, InvestorMessage, User, UserRole,
    Subscription, Holding, DistributionAllocation,
)
from app.db.session import get_db
from app.schemas.investor import (
    DocumentCreate, DocumentOut,
    InvestorCreate, InvestorUpdate, InvestorDashboard, InvestorOut,
    MessageCreate, MessageOut,
    WaterfallInput, WaterfallResultSchema,
)
from app.services.waterfall import WaterfallEngine

router = APIRouter()


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
    _: User = Depends(require_gp_or_ops),
):
    inv = _get_investor_or_404(investor_id, db)
    return _build_dashboard(inv, db)


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
