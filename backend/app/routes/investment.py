"""
API routes for the investment structure: GP entities, LP entities, Tranches,
Subscriptions, Holdings, Target Properties, Distribution Events, and LP Roll-ups.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from app.core.deps import get_current_user, require_gp_admin, require_gp_or_ops, require_investor_or_above
from app.db.models import (
    User, UserRole, GPEntity, LPEntity, LPTranche, Investor, Subscription,
    Holding, TargetProperty, Property,
    DistributionEvent, DistributionAllocation, ScopeAssignment, ScopeEntityType,
    SubscriptionStatus, DistributionEventStatus, LPStatus, TrancheStatus,
    TargetPropertyStatus, OperatorEntity,
)
from app.db.session import get_db
from app.schemas.investment import (
    GPEntityCreate, GPEntityUpdate, GPEntityOut,
    LPEntityCreate, LPEntityUpdate, LPEntityOut, LPEntityDetail,
    LPTrancheCreate, LPTrancheUpdate, LPTrancheOut,
    SubscriptionCreate, SubscriptionUpdate, SubscriptionOut,
    HoldingCreate, HoldingUpdate, HoldingOut,
    TargetPropertyCreate, TargetPropertyUpdate, TargetPropertyOut,
    LPPortfolioRollup,
    DistributionEventCreate, DistributionEventOut,
    ScopeAssignmentCreate, ScopeAssignmentOut,
    OperatorEntityCreate, OperatorEntityOut,
    InvestorCreate, InvestorUpdate, InvestorOut,
)

router = APIRouter()


# ===========================================================================
# Helper: build SubscriptionOut from ORM object
# ===========================================================================
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


def _holding_out(h: Holding) -> HoldingOut:
    return HoldingOut(
        holding_id=h.holding_id,
        investor_id=h.investor_id,
        lp_id=h.lp_id,
        subscription_id=h.subscription_id,
        units_held=h.units_held,
        average_issue_price=h.average_issue_price,
        total_capital_contributed=h.total_capital_contributed,
        initial_issue_date=h.initial_issue_date,
        ownership_percent=h.ownership_percent,
        cost_basis=h.cost_basis,
        unreturned_capital=h.unreturned_capital,
        unpaid_preferred=h.unpaid_preferred,
        is_gp=h.is_gp,
        status=h.status,
        investor_name=h.investor.name if h.investor else None,
        lp_name=h.lp.name if h.lp else None,
    )


# ===========================================================================
# GP Entities
# ===========================================================================

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


# ===========================================================================
# LP Entities
# ===========================================================================

@router.get("/lp", response_model=List[LPEntityOut])
def list_lp_entities(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    if current_user.role == UserRole.GP_ADMIN:
        return db.query(LPEntity).all()

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
    data = payload.model_dump()
    # Convert string status to enum
    if data.get("status"):
        data["status"] = LPStatus(data["status"])
    if data.get("purpose_type"):
        from app.db.models import LPPurposeType
        data["purpose_type"] = LPPurposeType(data["purpose_type"])
    lp = LPEntity(**data)
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

    if current_user.role != UserRole.GP_ADMIN:
        has_scope = db.query(ScopeAssignment).filter(
            ScopeAssignment.user_id == current_user.user_id,
            ScopeAssignment.entity_type == ScopeEntityType.lp,
            ScopeAssignment.entity_id == lp_id,
        ).first()
        if not has_scope:
            raise HTTPException(status_code=403, detail="No access to this LP")

    subs = lp.subscriptions or []
    total_committed = sum(s.commitment_amount for s in subs) if subs else Decimal("0")
    total_funded = sum(s.funded_amount for s in subs) if subs else Decimal("0")

    # Funding progress
    gross_subs = total_committed
    accepted_subs = sum(
        s.commitment_amount for s in subs
        if s.status and s.status.value in ("accepted", "funded", "issued", "closed")
    )
    funded_subs = sum(s.funded_amount for s in subs)
    total_units = sum(s.unit_quantity or Decimal("0") for s in subs if s.status and s.status.value in ("issued", "closed"))

    target = lp.target_raise or Decimal("0")
    remaining = max(target - total_committed, Decimal("0"))

    # Capital deployment
    formation = lp.formation_costs or Decimal("0")
    offering = lp.offering_costs or Decimal("0")
    reserve = lp.reserve_amount or Decimal("0")
    if not reserve and lp.reserve_percent and total_funded:
        reserve = total_funded * lp.reserve_percent / Decimal("100")
    net_deployable = max(total_funded - formation - offering - reserve, Decimal("0"))

    # Capital deployed to actual properties
    capital_deployed = sum(
        p.purchase_price or Decimal("0") for p in (lp.properties or [])
    )
    capital_available = max(net_deployable - capital_deployed, Decimal("0"))

    # Unique investors
    investor_ids = set(s.investor_id for s in subs)

    return LPEntityDetail(
        lp_id=lp.lp_id,
        gp_id=lp.gp_id,
        name=lp.name,
        legal_name=lp.legal_name,
        lp_number=lp.lp_number,
        description=lp.description,
        city_focus=lp.city_focus,
        community_focus=lp.community_focus,
        purpose_type=lp.purpose_type.value if lp.purpose_type else None,
        status=lp.status.value if lp.status else "draft",
        unit_price=lp.unit_price,
        minimum_subscription=lp.minimum_subscription,
        minimum_investment=lp.minimum_investment,
        target_raise=lp.target_raise,
        minimum_raise=lp.minimum_raise,
        maximum_raise=lp.maximum_raise,
        offering_date=lp.offering_date,
        closing_date=lp.closing_date,
        formation_costs=lp.formation_costs,
        offering_costs=lp.offering_costs,
        reserve_percent=lp.reserve_percent,
        reserve_amount=lp.reserve_amount,
        preferred_return_rate=lp.preferred_return_rate,
        gp_promote_percent=lp.gp_promote_percent,
        gp_catchup_percent=lp.gp_catchup_percent,
        asset_management_fee_percent=lp.asset_management_fee_percent,
        acquisition_fee_percent=lp.acquisition_fee_percent,
        notes=lp.notes,
        created_at=lp.created_at,
        updated_at=lp.updated_at,
        total_committed=total_committed,
        total_funded=total_funded,
        total_units_issued=total_units,
        subscription_count=len(subs),
        holding_count=len(lp.holdings) if lp.holdings else 0,
        property_count=len(lp.properties) if lp.properties else 0,
        target_property_count=len(lp.target_properties) if lp.target_properties else 0,
        investor_count=len(investor_ids),
        gross_subscriptions=gross_subs,
        accepted_subscriptions=accepted_subs,
        funded_subscriptions=funded_subs,
        remaining_capacity=remaining,
        total_formation_costs=formation,
        total_reserve_allocations=reserve,
        net_deployable_capital=net_deployable,
        capital_deployed=capital_deployed,
        capital_available=capital_available,
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
        if key == "status" and val:
            val = LPStatus(val)
        if key == "purpose_type" and val:
            from app.db.models import LPPurposeType
            val = LPPurposeType(val)
        setattr(lp, key, val)
    db.commit()
    db.refresh(lp)
    return lp


# ===========================================================================
# LP Tranches / Closings
# ===========================================================================

@router.get("/lp/{lp_id}/tranches", response_model=List[LPTrancheOut])
def list_tranches(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    tranches = db.query(LPTranche).filter(LPTranche.lp_id == lp_id).order_by(LPTranche.tranche_number).all()
    result = []
    for t in tranches:
        subs = t.subscriptions or []
        result.append(LPTrancheOut(
            tranche_id=t.tranche_id,
            lp_id=t.lp_id,
            tranche_number=t.tranche_number,
            tranche_name=t.tranche_name,
            opening_date=t.opening_date,
            closing_date=t.closing_date,
            status=t.status.value if t.status else "draft",
            issue_price=t.issue_price,
            target_amount=t.target_amount,
            target_units=t.target_units,
            notes=t.notes,
            created_at=t.created_at,
            subscriptions_count=len(subs),
            total_subscribed=sum(s.commitment_amount for s in subs) if subs else Decimal("0"),
            total_funded=sum(s.funded_amount for s in subs) if subs else Decimal("0"),
            total_units=sum(s.unit_quantity or Decimal("0") for s in subs) if subs else Decimal("0"),
        ))
    return result


@router.post("/lp/{lp_id}/tranches", response_model=LPTrancheOut, status_code=status.HTTP_201_CREATED)
def create_tranche(
    lp_id: int,
    payload: LPTrancheCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    data = payload.model_dump()
    data["lp_id"] = lp_id
    if data.get("status"):
        data["status"] = TrancheStatus(data["status"])
    tranche = LPTranche(**data)
    db.add(tranche)
    db.commit()
    db.refresh(tranche)
    return LPTrancheOut(
        tranche_id=tranche.tranche_id,
        lp_id=tranche.lp_id,
        tranche_number=tranche.tranche_number,
        tranche_name=tranche.tranche_name,
        opening_date=tranche.opening_date,
        closing_date=tranche.closing_date,
        status=tranche.status.value if tranche.status else "draft",
        issue_price=tranche.issue_price,
        target_amount=tranche.target_amount,
        target_units=tranche.target_units,
        notes=tranche.notes,
        created_at=tranche.created_at,
    )


@router.patch("/tranches/{tranche_id}", response_model=LPTrancheOut)
def update_tranche(
    tranche_id: int,
    payload: LPTrancheUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    tranche = db.query(LPTranche).filter(LPTranche.tranche_id == tranche_id).first()
    if not tranche:
        raise HTTPException(status_code=404, detail="Tranche not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        if key == "status" and val:
            val = TrancheStatus(val)
        setattr(tranche, key, val)
    db.commit()
    db.refresh(tranche)
    subs = tranche.subscriptions or []
    return LPTrancheOut(
        tranche_id=tranche.tranche_id,
        lp_id=tranche.lp_id,
        tranche_number=tranche.tranche_number,
        tranche_name=tranche.tranche_name,
        opening_date=tranche.opening_date,
        closing_date=tranche.closing_date,
        status=tranche.status.value if tranche.status else "draft",
        issue_price=tranche.issue_price,
        target_amount=tranche.target_amount,
        target_units=tranche.target_units,
        notes=tranche.notes,
        created_at=tranche.created_at,
        subscriptions_count=len(subs),
        total_subscribed=sum(s.commitment_amount for s in subs) if subs else Decimal("0"),
        total_funded=sum(s.funded_amount for s in subs) if subs else Decimal("0"),
        total_units=sum(s.unit_quantity or Decimal("0") for s in subs) if subs else Decimal("0"),
    )


# ===========================================================================
# Investors (CRUD)
# ===========================================================================

@router.get("/investors", response_model=List[InvestorOut])
def list_investors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    return db.query(Investor).order_by(Investor.name).all()


@router.post("/investors", response_model=InvestorOut, status_code=status.HTTP_201_CREATED)
def create_investor(
    payload: InvestorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    existing = db.query(Investor).filter(Investor.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Investor with this email already exists")
    inv = Investor(**payload.model_dump())
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.get("/investors/{investor_id}", response_model=InvestorOut)
def get_investor(
    investor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")
    return inv


@router.patch("/investors/{investor_id}", response_model=InvestorOut)
def update_investor(
    investor_id: int,
    payload: InvestorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    inv = db.query(Investor).filter(Investor.investor_id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(inv, key, val)
    db.commit()
    db.refresh(inv)
    return inv


# ===========================================================================
# Subscriptions
# ===========================================================================

@router.get("/lp/{lp_id}/subscriptions", response_model=List[SubscriptionOut])
def list_subscriptions(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    query = db.query(Subscription).filter(Subscription.lp_id == lp_id)

    if current_user.role == UserRole.INVESTOR:
        investor = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
        if not investor:
            return []
        query = query.filter(Subscription.investor_id == investor.investor_id)

    return [_sub_out(s) for s in query.all()]


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

    # Rule: LP must be open for subscription
    allowed_statuses = [
        LPStatus.open_for_subscription,
        LPStatus.partially_funded,
        LPStatus.operating,  # allow for backward compat
    ]
    if lp.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"LP is not open for subscriptions (current status: {lp.status.value})"
        )

    investor = db.query(Investor).filter(Investor.investor_id == payload.investor_id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    # Validate tranche if provided
    tranche = None
    if payload.tranche_id:
        tranche = db.query(LPTranche).filter(
            LPTranche.tranche_id == payload.tranche_id,
            LPTranche.lp_id == lp_id,
        ).first()
        if not tranche:
            raise HTTPException(status_code=404, detail="Tranche not found for this LP")
        if tranche.status != TrancheStatus.open:
            raise HTTPException(status_code=400, detail="Tranche is not open for subscriptions")

    # Auto-calculate unit_quantity if issue_price is set
    issue_price = payload.issue_price or (tranche.issue_price if tranche else lp.unit_price)
    unit_qty = payload.unit_quantity
    if issue_price and not unit_qty and payload.commitment_amount:
        unit_qty = payload.commitment_amount / issue_price

    sub = Subscription(
        investor_id=payload.investor_id,
        lp_id=lp_id,
        tranche_id=payload.tranche_id,
        commitment_amount=payload.commitment_amount,
        funded_amount=payload.funded_amount,
        issue_price=issue_price,
        unit_quantity=unit_qty,
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
    return _sub_out(sub)


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
    return _sub_out(sub)


# ===========================================================================
# Holdings
# ===========================================================================

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
    return [_holding_out(h) for h in query.all()]


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

    # Rule: No holding without a valid funded subscription (unless GP position)
    if not payload.is_gp and payload.subscription_id:
        sub = db.query(Subscription).filter(Subscription.subscription_id == payload.subscription_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found")
        if sub.status not in (SubscriptionStatus.funded, SubscriptionStatus.issued, SubscriptionStatus.closed):
            raise HTTPException(status_code=400, detail="Subscription must be funded before creating a holding")

    holding = Holding(
        investor_id=payload.investor_id,
        lp_id=lp_id,
        subscription_id=payload.subscription_id,
        units_held=payload.units_held,
        average_issue_price=payload.average_issue_price,
        total_capital_contributed=payload.total_capital_contributed,
        initial_issue_date=payload.initial_issue_date,
        ownership_percent=payload.ownership_percent,
        cost_basis=payload.cost_basis,
        unreturned_capital=payload.unreturned_capital,
        unpaid_preferred=payload.unpaid_preferred,
        is_gp=payload.is_gp,
        status=payload.status,
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return _holding_out(holding)


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
    return _holding_out(holding)


# ===========================================================================
# Target / Pipeline Properties
# ===========================================================================

@router.get("/lp/{lp_id}/target-properties", response_model=List[TargetPropertyOut])
def list_target_properties(
    lp_id: int,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    query = db.query(TargetProperty).filter(TargetProperty.lp_id == lp_id)
    if status_filter:
        query = query.filter(TargetProperty.status == TargetPropertyStatus(status_filter))
    return query.order_by(TargetProperty.target_property_id).all()


@router.post("/lp/{lp_id}/target-properties", response_model=TargetPropertyOut, status_code=status.HTTP_201_CREATED)
def create_target_property(
    lp_id: int,
    payload: TargetPropertyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    data = payload.model_dump()
    data["lp_id"] = lp_id
    if data.get("status"):
        data["status"] = TargetPropertyStatus(data["status"])
    tp = TargetProperty(**data)
    db.add(tp)
    db.commit()
    db.refresh(tp)
    return tp


@router.get("/target-properties/{target_property_id}", response_model=TargetPropertyOut)
def get_target_property(
    target_property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    tp = db.query(TargetProperty).filter(TargetProperty.target_property_id == target_property_id).first()
    if not tp:
        raise HTTPException(status_code=404, detail="Target property not found")
    return tp


@router.patch("/target-properties/{target_property_id}", response_model=TargetPropertyOut)
def update_target_property(
    target_property_id: int,
    payload: TargetPropertyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    tp = db.query(TargetProperty).filter(TargetProperty.target_property_id == target_property_id).first()
    if not tp:
        raise HTTPException(status_code=404, detail="Target property not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        if key == "status" and val:
            val = TargetPropertyStatus(val)
        setattr(tp, key, val)
    db.commit()
    db.refresh(tp)
    return tp


@router.delete("/target-properties/{target_property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target_property(
    target_property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    tp = db.query(TargetProperty).filter(TargetProperty.target_property_id == target_property_id).first()
    if not tp:
        raise HTTPException(status_code=404, detail="Target property not found")
    db.delete(tp)
    db.commit()


# ===========================================================================
# LP Portfolio Roll-up (Target + Actual)
# ===========================================================================

@router.get("/lp/{lp_id}/portfolio-rollup", response_model=LPPortfolioRollup)
def get_lp_portfolio_rollup(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    targets = lp.target_properties or []
    actuals = lp.properties or []

    # Target portfolio totals
    total_acq = sum(t.estimated_acquisition_price or Decimal("0") for t in targets)
    total_constr = sum(t.construction_budget or Decimal("0") for t in targets)
    total_all_in = total_acq + total_constr
    total_stab_noi = sum(t.stabilized_annual_noi or Decimal("0") for t in targets)
    total_stab_val = sum(t.stabilized_value or Decimal("0") for t in targets)
    total_debt = sum(t.assumed_debt_amount or Decimal("0") for t in targets)
    total_equity_req = total_all_in - total_debt

    total_planned_units = sum(t.planned_units or 0 for t in targets)
    total_planned_beds = sum(t.planned_beds or 0 for t in targets)

    # Actual portfolio totals
    total_purchase = sum(p.purchase_price or Decimal("0") for p in actuals)
    total_market = sum(p.current_market_value or p.estimated_value or Decimal("0") for p in actuals)

    # Projected LP-level metrics
    total_funded = sum(s.funded_amount for s in (lp.subscriptions or [])) if lp.subscriptions else Decimal("0")
    projected_equity_value = total_stab_val - total_debt if total_stab_val else None
    projected_cash_on_cash = None
    projected_equity_multiple = None
    if total_funded and total_funded > 0:
        if total_stab_noi:
            projected_cash_on_cash = (total_stab_noi / total_funded) * Decimal("100")
        if projected_equity_value:
            projected_equity_multiple = projected_equity_value / total_funded

    return LPPortfolioRollup(
        lp_id=lp.lp_id,
        lp_name=lp.name,
        target_property_count=len(targets),
        total_target_acquisition_cost=total_acq,
        total_target_construction_budget=total_constr,
        total_target_all_in_cost=total_all_in,
        total_target_stabilized_noi=total_stab_noi,
        total_target_stabilized_value=total_stab_val,
        total_target_debt=total_debt,
        total_target_equity_required=total_equity_req,
        actual_property_count=len(actuals),
        total_actual_purchase_price=total_purchase,
        total_actual_market_value=total_market,
        total_planned_units=total_planned_units,
        total_planned_beds=total_planned_beds,
        projected_portfolio_value=total_stab_val if total_stab_val else None,
        projected_lp_equity_value=projected_equity_value,
        projected_annual_noi=total_stab_noi if total_stab_noi else None,
        projected_cash_on_cash=projected_cash_on_cash,
        projected_equity_multiple=projected_equity_multiple,
    )


# ===========================================================================
# Distribution Events
# ===========================================================================

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


# ===========================================================================
# Scope Assignments
# ===========================================================================

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


# ===========================================================================
# Operator Entities
# ===========================================================================

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
