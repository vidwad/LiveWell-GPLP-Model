"""
API routes for the investment structure: GP entities, LP entities, Tranches,
Subscriptions, Holdings, Target Properties, Distribution Events, and LP Roll-ups.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from app.core.utils import get_or_404
from app.core.deps import (
    get_current_user, require_gp_admin, require_gp_or_ops, require_investor_or_above,
    check_entity_access, filter_by_lp_scope, PaginationParams,
)
from app.db.models import (
    User, UserRole, GPEntity, LPEntity, LPTranche, Investor, Subscription,
    Holding, TargetProperty, Property,
    DistributionEvent, DistributionAllocation, ScopeAssignment, ScopeEntityType,
    SubscriptionStatus, DistributionEventStatus, LPStatus, TrancheStatus,
    TargetPropertyStatus, OperatorEntity, LPFeeItem,
)
from app.db.session import get_db
from app.services.investment_service import (
    compute_lp_summary,
    compute_holdings_with_ownership,
    compute_portfolio_rollup,
    compute_waterfall,
    compute_lp_pnl,
    compute_lp_nav,
)
from app.services.validation_service import (
    validate_subscription_amount,
    validate_subscription_status_transition,
    validate_lp_status_transition,
    validate_tranche_status_transition,
    validate_holding_units,
    validate_upfront_funding,
)
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
    LPFeeItemCreate, LPFeeItemUpdate, LPFeeItemOut,
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

@router.get("/gp")
def list_gp_entities(
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    return pg.paginate(db.query(GPEntity))


@router.post("/gp", response_model=GPEntityOut, status_code=status.HTTP_201_CREATED)
def create_gp_entity(
    payload: GPEntityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    gp = GPEntity(**payload.model_dump())
    db.add(gp)
    try:
        db.commit()
        db.refresh(gp)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
        db.refresh(gp)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return gp


# ===========================================================================
# LP Entities
# ===========================================================================

@router.get("/lp")
def list_lp_entities(
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    if current_user.role == UserRole.GP_ADMIN:
        return pg.paginate(db.query(LPEntity))

    scope_ids = [
        s.entity_id for s in
        db.query(ScopeAssignment).filter(
            ScopeAssignment.user_id == current_user.user_id,
            ScopeAssignment.entity_type == ScopeEntityType.lp,
        ).all()
    ]
    if not scope_ids:
        return {"items": [], "total": 0, "skip": pg.skip, "limit": pg.limit}
    return pg.paginate(db.query(LPEntity).filter(LPEntity.lp_id.in_(scope_ids)))


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
    # Normalize empty strings to None for optional fields
    for k, v in list(data.items()):
        if v == "":
            data[k] = None
    # Convert string status to enum
    if data.get("status"):
        data["status"] = LPStatus(data["status"])
    if data.get("purpose_type"):
        from app.db.models import LPPurposeType
        data["purpose_type"] = LPPurposeType(data["purpose_type"])
    lp = LPEntity(**data)
    db.add(lp)
    try:
        db.commit()
        db.refresh(lp)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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

    # Use service layer for all computed fields
    summary = compute_lp_summary(db, lp_id)

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
        selling_commission_percent=lp.selling_commission_percent,
        construction_management_fee_percent=lp.construction_management_fee_percent,
        refinancing_fee_percent=lp.refinancing_fee_percent,
        turnover_replacement_fee_percent=lp.turnover_replacement_fee_percent,
        lp_profit_share_percent=lp.lp_profit_share_percent,
        gp_profit_share_percent=lp.gp_profit_share_percent,
        total_units_authorized=lp.total_units_authorized,
        notes=lp.notes,
        created_at=lp.created_at,
        updated_at=lp.updated_at,
        **summary,
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

    data = payload.model_dump(exclude_unset=True)
    # Normalize empty strings to None for optional fields
    for k, v in list(data.items()):
        if v == "":
            data[k] = None

    # Validate LP status transition if status is being changed
    if "status" in data and data["status"]:
        current = lp.status.value if lp.status else "draft"
        if data["status"] != current:
            validate_lp_status_transition(current, data["status"])

    # Validate purpose_type change — can't orphan existing properties
    if "purpose_type" in data and data["purpose_type"]:
        from app.services.validation_service import validate_lp_purpose_type_change
        validate_lp_purpose_type_change(db, lp_id, data["purpose_type"])

    for key, val in data.items():
        if key == "status" and val:
            val = LPStatus(val)
        if key == "purpose_type" and val:
            from app.db.models import LPPurposeType
            val = LPPurposeType(val)
        setattr(lp, key, val)
    try:
        db.commit()
        db.refresh(lp)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    # Scope check: verify user has access to this LP
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
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
    try:
        db.commit()
        db.refresh(tranche)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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

    data = payload.model_dump(exclude_unset=True)

    # Validate tranche status transition
    if "status" in data and data["status"]:
        current = tranche.status.value if tranche.status else "draft"
        validate_tranche_status_transition(current, data["status"])

    for key, val in data.items():
        if key == "status" and val:
            val = TrancheStatus(val)
        setattr(tranche, key, val)
    try:
        db.commit()
        db.refresh(tranche)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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

@router.get("/investors")
def list_investors(
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    return pg.paginate(db.query(Investor).order_by(Investor.name))


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
    try:
        db.commit()
        db.refresh(inv)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
        db.refresh(inv)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return inv


# ===========================================================================
# Subscriptions
# ===========================================================================

@router.get("/lp/{lp_id}/subscriptions")
def list_subscriptions(
    lp_id: int,
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    # Scope check: verify user has access to this LP
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    query = db.query(Subscription).filter(Subscription.lp_id == lp_id)

    if current_user.role == UserRole.INVESTOR:
        investor = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
        if not investor:
            return {"items": [], "total": 0, "skip": pg.skip, "limit": pg.limit}
        query = query.filter(Subscription.investor_id == investor.investor_id)

    return pg.paginate(query, transform=_sub_out)


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

    # Validate subscription amount against fund rules
    validate_subscription_amount(db, lp, payload.commitment_amount)

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
    try:
        db.commit()
        db.refresh(sub)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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

    data = payload.model_dump(exclude_unset=True)

    # Validate status transition if status is being changed
    if "status" in data and data["status"]:
        current = sub.status.value if sub.status else "draft"
        validate_subscription_status_transition(current, data["status"])

        # If transitioning to 'funded', enforce full upfront funding
        if data["status"] == "funded":
            funded_amt = data.get("funded_amount", sub.funded_amount)
            commit_amt = data.get("commitment_amount", sub.commitment_amount)
            if funded_amt != commit_amt:
                raise HTTPException(
                    status_code=400,
                    detail=f"Full upfront funding required. Funded amount must equal "
                           f"commitment amount (${commit_amt:,.2f})",
                )

    # Validate commitment amount change if applicable
    if "commitment_amount" in data and data["commitment_amount"]:
        lp = db.query(LPEntity).filter(LPEntity.lp_id == sub.lp_id).first()
        if lp:
            validate_subscription_amount(
                db, lp, data["commitment_amount"],
                exclude_subscription_id=subscription_id,
            )

    for key, val in data.items():
        if key == "status" and val:
            val = SubscriptionStatus(val)
        setattr(sub, key, val)
    try:
        db.commit()
        db.refresh(sub)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return _sub_out(sub)


# ===========================================================================
# Holdings
# ===========================================================================

@router.get("/lp/{lp_id}/holdings")
def list_holdings(
    lp_id: int,
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    # Scope check: verify user has access to this LP
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    # Use service layer for computed ownership_percent and cost_basis
    holdings_data = compute_holdings_with_ownership(db, lp_id)

    # Filter for investor role
    if current_user.role == UserRole.INVESTOR:
        investor = db.query(Investor).filter(Investor.user_id == current_user.user_id).first()
        if not investor:
            return {"items": [], "total": 0, "skip": pg.skip, "limit": pg.limit}
        holdings_data = [h for h in holdings_data if h["investor_id"] == investor.investor_id]

    # Manual pagination on the in-memory list
    total = len(holdings_data)
    items = [HoldingOut(**h) for h in holdings_data[pg.skip:pg.skip + pg.limit]]
    return {"items": items, "total": total, "skip": pg.skip, "limit": pg.limit}


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

    # Validate total units won't exceed authorized limit
    validate_holding_units(db, lp, payload.units_held)

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
        unreturned_capital=payload.unreturned_capital,
        unpaid_preferred=payload.unpaid_preferred,
        is_gp=payload.is_gp,
        status=payload.status,
    )
    db.add(holding)
    try:
        db.commit()
        db.refresh(holding)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    # Return with computed ownership_percent and cost_basis
    holdings_data = compute_holdings_with_ownership(db, lp_id)
    for h in holdings_data:
        if h["holding_id"] == holding.holding_id:
            return HoldingOut(**h)
    return _holding_out(holding)  # fallback


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
    try:
        db.commit()
        db.refresh(holding)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    # Return with computed ownership_percent and cost_basis
    holdings_data = compute_holdings_with_ownership(db, holding.lp_id)
    for h in holdings_data:
        if h["holding_id"] == holding.holding_id:
            return HoldingOut(**h)
    return _holding_out(holding)  # fallback


# ===========================================================================
# Target / Pipeline Properties
# ===========================================================================

@router.get("/lp/{lp_id}/target-properties")
def list_target_properties(
    lp_id: int,
    status_filter: Optional[str] = Query(None, alias="status"),
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    # Scope check: verify user has access to this LP
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    query = db.query(TargetProperty).filter(TargetProperty.lp_id == lp_id)
    if status_filter:
        query = query.filter(TargetProperty.status == TargetPropertyStatus(status_filter))
    return pg.paginate(query.order_by(TargetProperty.target_property_id))


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
    try:
        db.commit()
        db.refresh(tp)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
        db.refresh(tp)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/target-properties/{target_property_id}/convert")
def convert_target_to_actual(
    target_property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Convert a target/pipeline property into an actual acquired Property record.

    Pre-fills the Property from the target's underwriting assumptions.
    The target property is marked as 'acquired' and linked to the new property.
    """
    from app.db.models import DevelopmentStage

    tp = db.query(TargetProperty).filter(TargetProperty.target_property_id == target_property_id).first()
    if not tp:
        raise HTTPException(status_code=404, detail="Target property not found")
    if tp.converted_property_id:
        raise HTTPException(status_code=409, detail="Target property has already been converted")

    # Create the actual Property record pre-filled from target assumptions
    prop = Property(
        lp_id=tp.lp_id,
        address=tp.address or "TBD",
        city=tp.city or "TBD",
        province=tp.province or "AB",
        purchase_price=tp.estimated_acquisition_price,
        estimated_value=tp.stabilized_value,
        lot_size=tp.lot_size,
        zoning=tp.zoning,
        development_stage=DevelopmentStage.acquired,
    )
    db.add(prop)
    db.flush()  # get the property_id

    # Link the target to the new property and mark as acquired
    tp.converted_property_id = prop.property_id
    tp.status = TargetPropertyStatus.acquired
    try:
        db.commit()
        db.refresh(prop)
        db.refresh(tp)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "message": "Target property converted to actual property",
        "target_property_id": tp.target_property_id,
        "property_id": prop.property_id,
        "address": prop.address,
        "city": prop.city,
        "purchase_price": str(prop.purchase_price) if prop.purchase_price else None,
    }


# ===========================================================================
# LP Portfolio Roll-up (Target + Actual)
# ===========================================================================

@router.get("/lp/{lp_id}/portfolio-rollup", response_model=LPPortfolioRollup)
def get_lp_portfolio_rollup(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    # Scope check: verify user has access to this LP
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    # Use service layer for all rollup computations
    rollup = compute_portfolio_rollup(db, lp_id)
    return LPPortfolioRollup(**rollup)


# ===========================================================================
# LP P&L Summary
# ===========================================================================

@router.get("/lp/{lp_id}/pnl")
def get_lp_pnl(
    lp_id: int,
    year: int = Query(default=2026, ge=2020, le=2040),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """LP-level P&L: aggregated revenue, expenses, debt service, management fees across all LP properties."""
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")
    result = compute_lp_pnl(db, lp_id, year, month)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ===========================================================================
# LP NAV Calculation
# ===========================================================================

@router.get("/lp/{lp_id}/nav")
def get_lp_nav(
    lp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Compute Net Asset Value for an LP fund."""
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")
    result = compute_lp_nav(db, lp_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ===========================================================================
# LP Trend Data (Time-Series Snapshots)
# ===========================================================================

@router.get("/lp/{lp_id}/trend")
def get_lp_trend(
    lp_id: int,
    months: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    """Get time-series trend data for an LP (NAV, funded capital, distributions over time)."""
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    from app.services.snapshot_service import get_trend
    data = get_trend(db, "lp", lp_id, months)
    return {
        "lp_id": lp_id,
        "lp_name": lp.name,
        "periods": len(data),
        "data": data,
    }


# ===========================================================================
# Distribution Waterfall (European-style, 4-tier)
# ===========================================================================

from pydantic import BaseModel as _BM

class WaterfallRequest(_BM):
    distributable_amount: Decimal


@router.post("/lp/{lp_id}/waterfall")
def run_waterfall(
    lp_id: int,
    payload: WaterfallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Run a European-style distribution waterfall calculation.

    This is a simulation / preview endpoint. It does NOT create distribution
    events or allocations — it returns the computed breakdown so the GP admin
    can review before approving an actual distribution.
    """
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    result = compute_waterfall(db, lp_id, payload.distributable_amount)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ===========================================================================
# Distribution Events
# ===========================================================================

@router.get("/lp/{lp_id}/distributions")
def list_distribution_events(
    lp_id: int,
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_investor_or_above),
):
    # Scope check: verify user has access to this LP
    if current_user.role not in (UserRole.GP_ADMIN, UserRole.OPERATIONS_MANAGER):
        if not check_entity_access(current_user, db, ScopeEntityType.lp, lp_id):
            raise HTTPException(status_code=403, detail="Access denied")
    query = db.query(DistributionEvent).filter(DistributionEvent.lp_id == lp_id)
    return pg.paginate(query)


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
    try:
        db.commit()
        db.refresh(event)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
# Distribution Workflow (create-from-waterfall → approve → pay → publish)
# ===========================================================================

class CreateFromWaterfallRequest(_BM):
    distributable_amount: Decimal
    period_label: str
    notes: str | None = None


@router.post("/lp/{lp_id}/distributions/create-from-waterfall", status_code=status.HTTP_201_CREATED)
def create_distribution_from_waterfall(
    lp_id: int,
    payload: CreateFromWaterfallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Run the waterfall and save results as a draft DistributionEvent with allocations.

    This is the first step of the distribution workflow:
    1. create-from-waterfall (this) → creates draft event + allocations
    2. approve → GP reviews and approves
    3. pay → marks as paid, updates holding capital accounts
    4. publish → makes visible to investors
    """
    from app.db.models import DistributionType

    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP entity not found")

    # Run waterfall computation
    result = compute_waterfall(db, lp_id, payload.distributable_amount)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Create the distribution event
    event = DistributionEvent(
        lp_id=lp_id,
        period_label=payload.period_label,
        total_distributable=payload.distributable_amount,
        status=DistributionEventStatus.calculated,
        notes=payload.notes,
    )
    db.add(event)
    db.flush()  # get event_id

    # Create allocations from waterfall results
    allocations_created = 0
    for alloc_data in result.get("allocations", []):
        total = alloc_data.get("total", Decimal("0"))
        if total <= 0:
            continue

        holding_id = alloc_data["holding_id"]

        # Determine distribution type based on which tier contributed most
        tier1 = alloc_data.get("tier1_roc", Decimal("0"))
        tier2 = alloc_data.get("tier2_preferred", Decimal("0"))
        tier3 = alloc_data.get("tier3_catchup", Decimal("0"))
        tier4 = alloc_data.get("tier4_carry", Decimal("0"))

        # Create separate allocations per tier (for transparency)
        if tier1 > 0:
            db.add(DistributionAllocation(
                event_id=event.event_id,
                holding_id=holding_id,
                amount=tier1,
                distribution_type=DistributionType.return_of_capital,
                notes="Tier 1: Return of Capital",
            ))
            allocations_created += 1

        if tier2 > 0:
            db.add(DistributionAllocation(
                event_id=event.event_id,
                holding_id=holding_id,
                amount=tier2,
                distribution_type=DistributionType.preferred_return,
                notes="Tier 2: Preferred Return",
            ))
            allocations_created += 1

        if tier3 > 0:
            dist_type = DistributionType.profit_share if alloc_data.get("is_gp") else DistributionType.preferred_return
            db.add(DistributionAllocation(
                event_id=event.event_id,
                holding_id=holding_id,
                amount=tier3,
                distribution_type=dist_type,
                notes="Tier 3: GP Catch-up" if alloc_data.get("is_gp") else "Tier 3: LP Catch-up Share",
            ))
            allocations_created += 1

        if tier4 > 0:
            db.add(DistributionAllocation(
                event_id=event.event_id,
                holding_id=holding_id,
                amount=tier4,
                distribution_type=DistributionType.profit_share,
                notes="Tier 4: Carried Interest",
            ))
            allocations_created += 1

    try:
        db.commit()
        db.refresh(event)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "event_id": event.event_id,
        "status": event.status.value,
        "period_label": event.period_label,
        "total_distributable": str(event.total_distributable),
        "allocations_created": allocations_created,
        "waterfall_summary": {
            "tier1_roc": str(result.get("tier1_total", 0)),
            "tier2_preferred": str(result.get("tier2_total", 0)),
            "tier3_catchup": str(result.get("tier3_total", 0)),
            "tier4_carry": str(result.get("tier4_total", 0)),
        },
        "message": "Distribution event created with allocations. Review and approve to proceed.",
    }


@router.patch("/distributions/{event_id}/approve")
def approve_distribution(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Approve a calculated distribution event. Moves status from calculated → approved."""
    event = db.query(DistributionEvent).filter(DistributionEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Distribution event not found")

    if event.status not in (DistributionEventStatus.draft, DistributionEventStatus.calculated):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve: event is already {event.status.value}",
        )

    # Verify allocations exist
    alloc_count = db.query(DistributionAllocation).filter(
        DistributionAllocation.event_id == event_id
    ).count()
    if alloc_count == 0:
        raise HTTPException(status_code=400, detail="Cannot approve: no allocations found")

    event.status = DistributionEventStatus.approved
    event.approved_date = datetime.utcnow()

    try:
        db.commit()
        db.refresh(event)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    # Notify investors about approved distribution
    try:
        from app.db.models import NotificationType
        from app.services.notifications import notify_all_lp_investors
        if event.lp_id:
            notify_all_lp_investors(
                db=db,
                lp_id=event.lp_id,
                title="Distribution Approved",
                message=f"A {event.distribution_type.value.replace('_', ' ')} distribution of ${float(event.total_amount):,.2f} has been approved.",
                type=NotificationType.distribution,
                action_url="/distributions",
            )
            db.commit()
    except Exception:
        pass  # best-effort

    return {
        "event_id": event.event_id,
        "status": event.status.value,
        "approved_date": str(event.approved_date),
        "allocation_count": alloc_count,
        "message": "Distribution approved. Use /pay to execute payment and update capital accounts.",
    }


@router.patch("/distributions/{event_id}/pay")
def pay_distribution(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Execute payment of an approved distribution.

    This is the critical step that:
    1. Marks the event as paid
    2. Updates each holding's unreturned_capital and unpaid_preferred
    3. Creates an audit log entry
    """
    from app.db.models import AuditLog, DistributionType

    event = db.query(DistributionEvent).filter(DistributionEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Distribution event not found")

    if event.status != DistributionEventStatus.approved:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pay: event must be approved first (current: {event.status.value})",
        )

    allocations = db.query(DistributionAllocation).filter(
        DistributionAllocation.event_id == event_id
    ).all()

    if not allocations:
        raise HTTPException(status_code=400, detail="Cannot pay: no allocations found")

    # Update holding capital accounts based on allocation types
    holdings_updated = set()
    for alloc in allocations:
        holding = db.query(Holding).filter(Holding.holding_id == alloc.holding_id).first()
        if not holding:
            continue

        amount = Decimal(str(alloc.amount))

        if alloc.distribution_type == DistributionType.return_of_capital:
            # ROC reduces unreturned capital
            holding.unreturned_capital = max(
                Decimal("0"),
                Decimal(str(holding.unreturned_capital or 0)) - amount,
            )
        elif alloc.distribution_type == DistributionType.preferred_return:
            # Preferred return reduces unpaid preferred
            holding.unpaid_preferred = max(
                Decimal("0"),
                Decimal(str(holding.unpaid_preferred or 0)) - amount,
            )
        # profit_share, refinancing, sale_proceeds don't reduce capital accounts

        holdings_updated.add(holding.holding_id)

    # Mark event as paid
    event.status = DistributionEventStatus.paid
    event.paid_date = datetime.utcnow()

    # Audit log
    db.add(AuditLog(
        user_id=current_user.user_id,
        action="distribution.paid",
        entity_type="DistributionEvent",
        entity_id=event.event_id,
        details=f"Paid {len(allocations)} allocations totaling ${event.total_distributable:,.2f}. "
                f"Updated {len(holdings_updated)} holdings.",
    ))

    try:
        db.commit()
        db.refresh(event)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "event_id": event.event_id,
        "status": event.status.value,
        "paid_date": str(event.paid_date),
        "allocations_paid": len(allocations),
        "holdings_updated": len(holdings_updated),
        "total_distributed": str(event.total_distributable),
        "message": "Distribution paid. Holding capital accounts updated. Use /publish to make visible to investors.",
    }


@router.patch("/distributions/{event_id}/publish")
def publish_distribution(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    """Publish a paid distribution (make visible to investors)."""
    event = db.query(DistributionEvent).filter(DistributionEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Distribution event not found")

    if event.status != DistributionEventStatus.paid:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish: event must be paid first (current: {event.status.value})",
        )

    event.status = DistributionEventStatus.published

    try:
        db.commit()
        db.refresh(event)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "event_id": event.event_id,
        "status": event.status.value,
        "message": "Distribution published and visible to investors.",
    }


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
    try:
        db.commit()
        db.refresh(scope)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ===========================================================================
# Operator Entities
# ===========================================================================

@router.get("/operators")
def list_operators(
    pg: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    return pg.paginate(db.query(OperatorEntity))


@router.post("/operators", response_model=OperatorEntityOut, status_code=status.HTTP_201_CREATED)
def create_operator(
    payload: OperatorEntityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_admin),
):
    op = OperatorEntity(**payload.model_dump())
    db.add(op)
    try:
        db.commit()
        db.refresh(op)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return op


# ===========================================================================
# Task 7: Portfolio-Level Analytics Dashboard
# ===========================================================================

@router.get("/portfolio-analytics")
def get_portfolio_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Cross-LP analytics: total AUM, blended returns, portfolio-wide metrics.

    Aggregates data across all LPs the user has access to.
    """
    from decimal import Decimal

    lps = db.query(LPEntity).all()
    if not lps:
        return {"lp_count": 0, "funds": [], "totals": {}}

    fund_summaries = []
    totals = {
        "total_aum": Decimal("0"),
        "total_committed": Decimal("0"),
        "total_funded": Decimal("0"),
        "total_deployed": Decimal("0"),
        "total_nav": Decimal("0"),
        "total_properties": 0,
        "total_target_properties": 0,
        "total_investors": 0,
        "total_units_outstanding": Decimal("0"),
    }
    all_investor_ids = set()

    for lp in lps:
        summary = compute_lp_summary(db, lp.lp_id)
        nav_data = compute_lp_nav(db, lp.lp_id)

        committed = Decimal(str(summary.get("total_committed", 0)))
        funded = Decimal(str(summary.get("total_funded", 0)))
        deployed = Decimal(str(summary.get("capital_deployed", 0)))
        nav = Decimal(str(nav_data.get("nav", 0))) if "nav" in nav_data else Decimal("0")
        nav_per_unit = nav_data.get("nav_per_unit", 0) if "nav_per_unit" in nav_data else 0
        prop_count = summary.get("property_count", 0)
        tp_count = summary.get("target_property_count", 0)
        inv_count = summary.get("investor_count", 0)

        # Collect unique investor IDs
        subs = db.query(Subscription).filter(Subscription.lp_id == lp.lp_id).all()
        for s in subs:
            all_investor_ids.add(s.investor_id)

        fund_summaries.append({
            "lp_id": lp.lp_id,
            "name": lp.name,
            "status": lp.status.value if lp.status else "draft",
            "committed": float(committed),
            "funded": float(funded),
            "deployed": float(deployed),
            "nav": float(nav),
            "nav_per_unit": float(nav_per_unit),
            "original_unit_price": float(lp.unit_price) if lp.unit_price else None,
            "property_count": prop_count,
            "target_property_count": tp_count,
            "investor_count": inv_count,
            "subscription_count": summary.get("subscription_count", 0),
            "holding_count": summary.get("holding_count", 0),
            "preferred_return_rate": float(lp.preferred_return_rate) if lp.preferred_return_rate else None,
            "gp_promote_percent": float(lp.gp_promote_percent) if lp.gp_promote_percent else None,
        })

        totals["total_aum"] += nav if nav > 0 else funded
        totals["total_committed"] += committed
        totals["total_funded"] += funded
        totals["total_deployed"] += deployed
        totals["total_nav"] += nav
        totals["total_properties"] += prop_count
        totals["total_target_properties"] += tp_count

    totals["total_investors"] = len(all_investor_ids)
    totals["lp_count"] = len(lps)

    # Blended metrics
    if totals["total_funded"] > 0:
        totals["blended_deployment_ratio"] = float(
            (totals["total_deployed"] / totals["total_funded"] * Decimal("100")).quantize(Decimal("0.01"))
        )
    else:
        totals["blended_deployment_ratio"] = 0

    if totals["total_funded"] > 0:
        totals["blended_nav_premium"] = float(
            ((totals["total_nav"] - totals["total_funded"]) / totals["total_funded"] * Decimal("100")).quantize(Decimal("0.01"))
        )
    else:
        totals["blended_nav_premium"] = 0

    # Convert Decimals to float for JSON
    totals = {k: float(v) if isinstance(v, Decimal) else v for k, v in totals.items()}

    return {
        "funds": fund_summaries,
        "totals": totals,
    }


# ===========================================================================
# LP Fee Schedule Items
# ===========================================================================

@router.get("/lps/{lp_id}/fees", response_model=List[LPFeeItemOut])
def list_lp_fee_items(
    lp_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_investor_or_above),
):
    """List all fee items for an LP."""
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP not found")
    items = db.query(LPFeeItem).filter(LPFeeItem.lp_id == lp_id).order_by(LPFeeItem.fee_item_id).all()
    return items


@router.get("/lps/{lp_id}/fees/{fee_item_id}", response_model=LPFeeItemOut)
def get_lp_fee_item(
    lp_id: int,
    fee_item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_investor_or_above),
):
    """Get a single fee item."""
    item = db.query(LPFeeItem).filter(
        LPFeeItem.lp_id == lp_id,
        LPFeeItem.fee_item_id == fee_item_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fee item not found")
    return item


@router.post("/lps/{lp_id}/fees", response_model=LPFeeItemOut, status_code=201)
def create_lp_fee_item(
    lp_id: int,
    payload: LPFeeItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_admin),
):
    """Create a custom fee item for an LP."""
    lp = db.query(LPEntity).filter(LPEntity.lp_id == lp_id).first()
    if not lp:
        raise HTTPException(status_code=404, detail="LP not found")
    item = LPFeeItem(**payload.model_dump())
    item.lp_id = lp_id
    db.add(item)
    try:
        db.commit()
        db.refresh(item)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return item


@router.patch("/lps/{lp_id}/fees/{fee_item_id}", response_model=LPFeeItemOut)
def update_lp_fee_item(
    lp_id: int,
    fee_item_id: int,
    payload: LPFeeItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_admin),
):
    """Update a fee item (rate, basis, notes, active status, etc.)."""
    item = db.query(LPFeeItem).filter(
        LPFeeItem.lp_id == lp_id,
        LPFeeItem.fee_item_id == fee_item_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fee item not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(item, key, val)
    try:
        db.commit()
        db.refresh(item)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return item


@router.delete("/lps/{lp_id}/fees/{fee_item_id}", status_code=204)
def delete_lp_fee_item(
    lp_id: int,
    fee_item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_gp_admin),
):
    """Delete a fee item."""
    item = db.query(LPFeeItem).filter(
        LPFeeItem.lp_id == lp_id,
        LPFeeItem.fee_item_id == fee_item_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Fee item not found")
    db.delete(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return None
