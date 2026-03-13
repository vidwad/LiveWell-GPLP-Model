"""
API routes for the investment structure: GP entities, LP entities,
Subscriptions, Holdings, and Distribution Events.
"""
from datetime import datetime
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_admin, require_gp_or_ops, require_investor_or_above
from app.db.models import (
    User, UserRole, GPEntity, LPEntity, Investor, Subscription, Holding,
    DistributionEvent, DistributionAllocation, ScopeAssignment, ScopeEntityType,
    SubscriptionStatus, DistributionEventStatus,
)
from app.db.session import get_db
from app.schemas.investment import (
    GPEntityCreate, GPEntityUpdate, GPEntityOut,
    LPEntityCreate, LPEntityUpdate, LPEntityOut, LPEntityDetail,
    SubscriptionCreate, SubscriptionUpdate, SubscriptionOut,
    HoldingCreate, HoldingUpdate, HoldingOut,
    DistributionEventCreate, DistributionEventOut,
    ScopeAssignmentCreate, ScopeAssignmentOut,
    OperatorEntityCreate, OperatorEntityOut,
)
from app.db.models import OperatorEntity

router = APIRouter()


# ---------------------------------------------------------------------------
# GP Entities
# ---------------------------------------------------------------------------

@router.get("/gp", response_model=List[GPEntityOut])
def list_gp_entities(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    return db.query(GPEntity).all()


@router.post("/gp", response_model=GPEntityOut, status_code=status.HTTP_201_CREATED)
def create_gp_entity(
    payload: GPEntityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    gp = GPEntity(**payload.model_dump())
    db.add(gp)
    db.commit()
    db.refresh(gp)
    return gp


@router.get("/gp/{gp_id}", response_model=GPEntityOut)
def get_gp_entity(
    gp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    gp = db.query(GPEntity).filter(GPEntity.gp_id == gp_id).first()
    if not gp:
        raise HTTPException(status_code=404, detail="GP entity not found")
    return gp


@router.patch("/gp/{gp_id}", response_model=GPEntityOut)
def update_gp_entity(
    gp_id: int,
    payload: GPEntityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    gp = db.query(GPEntity).filter(GPEntity.gp_id == gp_id).first()
    if not gp:
        raise HTTPException(status_code=404, detail="GP entity not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(gp, key, val)
    db.commit()
    db.refresh(gp)
    return gp


# ---------------------------------------------------------------------------
# LP Entities
# ---------------------------------------------------------------------------

@router.get("/lp", response_model=List[LPEntityOut])
def list_lp_entities(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    if current_user.role == UserRole.GP_ADMIN:
        return db.query(LPEntity).all()

    # For investors, only show LPs they have scope access to
    scope_ids = [
        s.entity_id for s in
        db.query(ScopeAssignment).filter(
            ScopeAssignment.user_id == current_user.user_id,
            ScopeAssignment.entity_type == ScopeEntityType.lp,
        ).all()
    ]
    if not scope_ids:
        return []
    return db.query(LPEntity).filter(LPEntity.lp_id.in_(scope_ids)).all()


@router.post("/lp", response_model=LPEntityOut, status_code=status.HTTP_201_CREATED)
def create_lp_entity(
    payload: LPEntityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    gp = db.query(GPEntity).filter(GPEntity.gp_id == payload.gp_id).first()
    if not gp:
        raise HTTPException(status_code=404, detail="GP entity not found")
    lp = LPEntity(**payload.model_dump())
    db.add(lp)
    db.commit()
    db.refresh(lp)
    return lp


@router.get("/lp/{lp_id}", response_model=LPEntityDetail)
def get_lp_detail(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    # Scope check for non-GP users
    if current_user.role != UserRole.GP_ADMIN:
        has_scope = db.query(ScopeAssignment).filter(
            ScopeAssignment.user_id == current_user.user_id,
            ScopeAssignment.entity_type == ScopeEntityType.lp,
            ScopeAssignment.entity_id == lp_id,
        ).first()
        if not has_scope:
            raise HTTPException(status_code=403, detail="No access to this LP")

    total_committed = sum(s.commitment_amount for s in lp.subscriptions) if lp.subscriptions else Decimal("0")
    total_funded = sum(s.funded_amount for s in lp.subscriptions) if lp.subscriptions else Decimal("0")

    return LPEntityDetail(
        lp_id=lp.lp_id,
        gp_id=lp.gp_id,
        name=lp.name,
        description=lp.description,
        status=lp.status.value if lp.status else "forming",
        target_raise=lp.target_raise,
        minimum_investment=lp.minimum_investment,
        offering_date=lp.offering_date,
        closing_date=lp.closing_date,
        preferred_return_rate=lp.preferred_return_rate,
        gp_promote_percent=lp.gp_promote_percent,
        gp_catchup_percent=lp.gp_catchup_percent,
        asset_management_fee_percent=lp.asset_management_fee_percent,
        acquisition_fee_percent=lp.acquisition_fee_percent,
        total_committed=total_committed,
        total_funded=total_funded,
        subscription_count=len(lp.subscriptions) if lp.subscriptions else 0,
        holding_count=len(lp.holdings) if lp.holdings else 0,
        property_count=len(lp.properties) if lp.properties else 0,
    )


@router.patch("/lp/{lp_id}", response_model=LPEntityOut)
def update_lp_entity(
    lp_id: int,
    payload: LPEntityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(lp, key, val)
    db.commit()
    db.refresh(lp)
    return lp


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------

@router.get("/lp/{lp_id}/subscriptions", response_model=List[SubscriptionOut])
def list_subscriptions(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    query = db.query(Subscription).filter(Subscription.lp_id == lp_id)

    # Investors can only see their own subscriptions
    if current_user.role == UserRole.INVESTOR:
        investor = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
        if not investor:
            return []
        query = query.filter(Subscription.investor_id == investor.investor_id)

    subs = query.all()
    result = []
    for s in subs:
        out = SubscriptionOut(
            subscription_id=s.subscription_id,
            investor_id=s.investor_id,
            lp_id=s.lp_id,
            commitment_amount=s.commitment_amount,
            funded_amount=s.funded_amount,
            status=s.status.value if s.status else "draft",
            submitted_date=s.submitted_date,
            accepted_date=s.accepted_date,
            funded_date=s.funded_date,
            issued_date=s.issued_date,
            notes=s.notes,
            investor_name=s.investor.name if s.investor else None,
            lp_name=s.lp.name if s.lp else None,
        )
        result.append(out)
    return result


@router.post("/lp/{lp_id}/subscriptions", response_model=SubscriptionOut, status_code=status.HTTP_201_CREATED)
def create_subscription(
    lp_id: int,
    payload: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")
    investor = db.query(Investor).filter(Investor.investor_id == payload.investor_id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    sub = Subscription(
        investor_id=payload.investor_id,
        lp_id=lp_id,
        commitment_amount=payload.commitment_amount,
        funded_amount=payload.funded_amount,
        status=SubscriptionStatus(payload.status) if payload.status else SubscriptionStatus.draft,
        submitted_date=payload.submitted_date,
        accepted_date=payload.accepted_date,
        funded_date=payload.funded_date,
        issued_date=payload.issued_date,
        notes=payload.notes,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return SubscriptionOut(
        subscription_id=sub.subscription_id,
        investor_id=sub.investor_id,
        lp_id=sub.lp_id,
        commitment_amount=sub.commitment_amount,
        funded_amount=sub.funded_amount,
        status=sub.status.value if sub.status else "draft",
        submitted_date=sub.submitted_date,
        accepted_date=sub.accepted_date,
        funded_date=sub.funded_date,
        issued_date=sub.issued_date,
        notes=sub.notes,
        investor_name=investor.name,
        lp_name=lp.name,
    )


@router.patch("/subscriptions/{subscription_id}", response_model=SubscriptionOut)
def update_subscription(
    subscription_id: int,
    payload: SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    sub = db.query(Subscription).filter(Subscription.subscription_id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        if key == "status" and val:
            val = SubscriptionStatus(val)
        setattr(sub, key, val)
    db.commit()
    db.refresh(sub)
    return SubscriptionOut(
        subscription_id=sub.subscription_id,
        investor_id=sub.investor_id,
        lp_id=sub.lp_id,
        commitment_amount=sub.commitment_amount,
        funded_amount=sub.funded_amount,
        status=sub.status.value if sub.status else "draft",
        submitted_date=sub.submitted_date,
        accepted_date=sub.accepted_date,
        funded_date=sub.funded_date,
        issued_date=sub.issued_date,
        notes=sub.notes,
        investor_name=sub.investor.name if sub.investor else None,
        lp_name=sub.lp.name if sub.lp else None,
    )


# ---------------------------------------------------------------------------
# Holdings
# ---------------------------------------------------------------------------

@router.get("/lp/{lp_id}/holdings", response_model=List[HoldingOut])
def list_holdings(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    query = db.query(Holding).filter(Holding.lp_id == lp_id)

    if current_user.role == UserRole.INVESTOR:
        investor = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
        if not investor:
            return []
        query = query.filter(Holding.investor_id == investor.investor_id)

    holdings = query.all()
    result = []
    for h in holdings:
        result.append(HoldingOut(
            holding_id=h.holding_id,
            investor_id=h.investor_id,
            lp_id=h.lp_id,
            subscription_id=h.subscription_id,
            ownership_percent=h.ownership_percent,
            cost_basis=h.cost_basis,
            unreturned_capital=h.unreturned_capital,
            unpaid_preferred=h.unpaid_preferred,
            is_gp=h.is_gp,
            investor_name=h.investor.name if h.investor else None,
            lp_name=h.lp.name if h.lp else None,
        ))
    return result


@router.post("/lp/{lp_id}/holdings", response_model=HoldingOut, status_code=status.HTTP_201_CREATED)
def create_holding(
    lp_id: int,
    payload: HoldingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")
    investor = db.query(Investor).filter(Investor.investor_id == payload.investor_id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    holding = Holding(
        investor_id=payload.investor_id,
        lp_id=lp_id,
        subscription_id=payload.subscription_id,
        ownership_percent=payload.ownership_percent,
        cost_basis=payload.cost_basis,
        unreturned_capital=payload.unreturned_capital,
        unpaid_preferred=payload.unpaid_preferred,
        is_gp=payload.is_gp,
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return HoldingOut(
        holding_id=holding.holding_id,
        investor_id=holding.investor_id,
        lp_id=holding.lp_id,
        subscription_id=holding.subscription_id,
        ownership_percent=holding.ownership_percent,
        cost_basis=holding.cost_basis,
        unreturned_capital=holding.unreturned_capital,
        unpaid_preferred=holding.unpaid_preferred,
        is_gp=holding.is_gp,
        investor_name=investor.name,
        lp_name=lp.name,
    )


@router.patch("/holdings/{holding_id}", response_model=HoldingOut)
def update_holding(
    holding_id: int,
    payload: HoldingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    holding = db.query(Holding).filter(Holding.holding_id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(holding, key, val)
    db.commit()
    db.refresh(holding)
    return HoldingOut(
        holding_id=holding.holding_id,
        investor_id=holding.investor_id,
        lp_id=holding.lp_id,
        subscription_id=holding.subscription_id,
        ownership_percent=holding.ownership_percent,
        cost_basis=holding.cost_basis,
        unreturned_capital=holding.unreturned_capital,
        unpaid_preferred=holding.unpaid_preferred,
        is_gp=holding.is_gp,
        investor_name=holding.investor.name if holding.investor else None,
        lp_name=holding.lp.name if holding.lp else None,
    )


# ---------------------------------------------------------------------------
# Distribution Events
# ---------------------------------------------------------------------------

@router.get("/lp/{lp_id}/distributions", response_model=List[DistributionEventOut])
def list_distribution_events(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    events = db.query(DistributionEvent).filter(DistributionEvent.lp_id == lp_id).all()
    return events


@router.post("/lp/{lp_id}/distributions", response_model=DistributionEventOut, status_code=status.HTTP_201_CREATED)
def create_distribution_event(
    lp_id: int,
    payload: DistributionEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    event = DistributionEvent(
        lp_id=lp_id,
        period_label=payload.period_label,
        total_distributable=payload.total_distributable,
        status=DistributionEventStatus(payload.status) if payload.status else DistributionEventStatus.draft,
        notes=payload.notes,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/distributions/{event_id}", response_model=DistributionEventOut)
def get_distribution_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    event = db.query(DistributionEvent).filter(DistributionEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Distribution event not found")
    return event


# ---------------------------------------------------------------------------
# Scope Assignments
# ---------------------------------------------------------------------------

@router.get("/scopes", response_model=List[ScopeAssignmentOut])
def list_scope_assignments(
    user_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    query = db.query(ScopeAssignment)
    if user_id:
        query = query.filter(ScopeAssignment.user_id == user_id)
    return query.all()


@router.post("/scopes", response_model=ScopeAssignmentOut, status_code=status.HTTP_201_CREATED)
def create_scope_assignment(
    payload: ScopeAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    scope = ScopeAssignment(
        user_id=payload.user_id,
        entity_type=ScopeEntityType(payload.entity_type),
        entity_id=payload.entity_id,
        permission_level=payload.permission_level,
    )
    db.add(scope)
    db.commit()
    db.refresh(scope)
    return scope


@router.delete("/scopes/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scope_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    scope = db.query(ScopeAssignment).filter(ScopeAssignment.assignment_id == assignment_id).first()
    if not scope:
        raise HTTPException(status_code=404, detail="Scope assignment not found")
    db.delete(scope)
    db.commit()


# ---------------------------------------------------------------------------
# Operator Entities
# ---------------------------------------------------------------------------

@router.get("/operators", response_model=List[OperatorEntityOut])
def list_operators(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    return db.query(OperatorEntity).all()


@router.post("/operators", response_model=OperatorEntityOut, status_code=status.HTTP_201_CREATED)
def create_operator(
    payload: OperatorEntityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    op = OperatorEntity(**payload.model_dump())
    db.add(op)
    db.commit()
    db.refresh(op)
    return op
