from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_admin, require_gp_or_ops, require_investor_or_above
from app.db.models import CapitalContribution, Distribution, Investor, Ownership, User, UserRole
from app.db.session import get_db
from app.schemas.investor import (
    ContributionCreate, ContributionOut,
    DistributionCreate, DistributionOut,
    InvestorCreate, InvestorDashboard, InvestorOut,
    OwnershipCreate, OwnershipOut,
)

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
    # Investors can only view their own profile
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return inv


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=InvestorDashboard)
def my_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    inv = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="No investor profile linked to this account")
    return _build_dashboard(inv)


@router.get("/investors/{investor_id}/dashboard", response_model=InvestorDashboard)
def investor_dashboard(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    inv = _get_investor_or_404(investor_id, db)
    return _build_dashboard(inv)


def _build_dashboard(inv: Investor) -> InvestorDashboard:
    total_contributed = sum((c.amount for c in inv.contributions), Decimal(0))
    total_distributed = sum((d.amount for d in inv.distributions), Decimal(0))
    recent_distributions = sorted(inv.distributions, key=lambda d: d.payment_date, reverse=True)[:5]
    return InvestorDashboard(
        investor=InvestorOut.model_validate(inv),
        total_contributed=total_contributed,
        total_distributed=total_distributed,
        net_position=total_contributed - total_distributed,
        ownership_positions=[OwnershipOut.model_validate(o) for o in inv.ownership_positions],
        recent_distributions=[DistributionOut.model_validate(d) for d in recent_distributions],
    )


# ---------------------------------------------------------------------------
# Capital Contributions
# ---------------------------------------------------------------------------

@router.get("/investors/{investor_id}/contributions", response_model=list[ContributionOut])
def list_contributions(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    _get_investor_or_404(investor_id, db)
    return db.query(CapitalContribution).filter(
        CapitalContribution.investor_id == investor_id
    ).all()


@router.post(
    "/investors/{investor_id}/contributions",
    response_model=ContributionOut,
    status_code=status.HTTP_201_CREATED,
)
def add_contribution(
    investor_id: int,
    payload: ContributionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    _get_investor_or_404(investor_id, db)
    contribution = CapitalContribution(investor_id=investor_id, **payload.model_dump())
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution


# ---------------------------------------------------------------------------
# Ownership
# ---------------------------------------------------------------------------

@router.get("/investors/{investor_id}/ownership", response_model=list[OwnershipOut])
def list_ownership(
    investor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    _get_investor_or_404(investor_id, db)
    return db.query(Ownership).filter(Ownership.investor_id == investor_id).all()


@router.post(
    "/investors/{investor_id}/ownership",
    response_model=OwnershipOut,
    status_code=status.HTTP_201_CREATED,
)
def add_ownership(
    investor_id: int,
    payload: OwnershipCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_admin),
):
    _get_investor_or_404(investor_id, db)
    pos = Ownership(investor_id=investor_id, **payload.model_dump())
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return pos


# ---------------------------------------------------------------------------
# Distributions
# ---------------------------------------------------------------------------

@router.get("/investors/{investor_id}/distributions", response_model=list[DistributionOut])
def list_distributions(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    inv = _get_investor_or_404(investor_id, db)
    if current_user.role == UserRole.INVESTOR and inv.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Distribution).filter(Distribution.investor_id == investor_id).all()


@router.post(
    "/investors/{investor_id}/distributions",
    response_model=DistributionOut,
    status_code=status.HTTP_201_CREATED,
)
def add_distribution(
    investor_id: int,
    payload: DistributionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    _get_investor_or_404(investor_id, db)
    dist = Distribution(investor_id=investor_id, **payload.model_dump())
    db.add(dist)
    db.commit()
    db.refresh(dist)
    return dist
