"""
Portfolio Construction routes: construction expenses, budget vs actual tracking,
and construction draw schedule management.
"""
from typing import List as _List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func as sa_func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import (
    require_gp_or_ops, require_investor_or_above,
)
from app.db.models import (
    ConstructionDraw, ConstructionDrawStatus, ConstructionExpense,
    DebtFacility, DevelopmentPlan, Property, User,
)
from app.db.session import get_db
from app.schemas.portfolio import (
    ConstructionBudgetSummary, ConstructionDrawCreate, ConstructionDrawOut,
    ConstructionExpenseCreate, ConstructionExpenseOut,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Task 2: Construction Budget vs Actual Tracking
# ---------------------------------------------------------------------------


@router.get("/properties/{property_id}/construction-expenses", response_model=_List[ConstructionExpenseOut])
def list_construction_expenses(
    property_id: int,
    plan_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    query = db.query(ConstructionExpense).filter(ConstructionExpense.property_id == property_id)
    if plan_id:
        query = query.filter(ConstructionExpense.plan_id == plan_id)
    return query.order_by(ConstructionExpense.expense_id).all()


@router.post("/properties/{property_id}/construction-expenses", response_model=ConstructionExpenseOut, status_code=status.HTTP_201_CREATED)
def create_construction_expense(
    property_id: int,
    payload: ConstructionExpenseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    if not db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == payload.plan_id).first():
        raise HTTPException(404, "Development plan not found")
    expense = ConstructionExpense(property_id=property_id, **payload.model_dump())
    db.add(expense)
    try:
        db.commit()
        db.refresh(expense)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return expense


@router.patch("/construction-expenses/{expense_id}", response_model=ConstructionExpenseOut)
def update_construction_expense(
    expense_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    expense = db.query(ConstructionExpense).filter(ConstructionExpense.expense_id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Construction expense not found")
    for k, v in payload.items():
        if k == "expense_date" and isinstance(v, str):
            from datetime import date as _date
            v = _date.fromisoformat(v)
        if hasattr(expense, k):
            setattr(expense, k, v)
    try:
        db.commit()
        db.refresh(expense)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return expense


@router.delete("/construction-expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_construction_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    expense = db.query(ConstructionExpense).filter(ConstructionExpense.expense_id == expense_id).first()
    if not expense:
        raise HTTPException(404, "Construction expense not found")
    db.delete(expense)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/properties/{property_id}/construction-budget-summary", response_model=ConstructionBudgetSummary)
def get_construction_budget_summary(
    property_id: int,
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    """Get budget vs actual summary for a development plan."""
    from decimal import Decimal

    expenses = (
        db.query(ConstructionExpense)
        .filter(ConstructionExpense.property_id == property_id, ConstructionExpense.plan_id == plan_id)
        .all()
    )

    total_budgeted = sum(Decimal(str(e.budgeted_amount or 0)) for e in expenses)
    total_actual = sum(Decimal(str(e.actual_amount or 0)) for e in expenses)

    by_category: dict[str, dict] = {}
    for e in expenses:
        cat = e.category
        if cat not in by_category:
            by_category[cat] = {"budgeted": Decimal("0"), "actual": Decimal("0"), "variance": Decimal("0")}
        by_category[cat]["budgeted"] += Decimal(str(e.budgeted_amount or 0))
        by_category[cat]["actual"] += Decimal(str(e.actual_amount or 0))
    for cat in by_category:
        by_category[cat]["variance"] = by_category[cat]["budgeted"] - by_category[cat]["actual"]
        by_category[cat] = {k: float(v) for k, v in by_category[cat].items()}

    # ── Cost metrics: $/unit, $/sqft, $/bed ──
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == plan_id).first()

    # Use plan's planned units/beds if available, else baseline property counts
    total_units = int(plan.planned_units or 0) if plan and plan.planned_units else int(prop.bedrooms or 0) if prop else 0
    building_sqft = float(plan.planned_sqft or 0) if plan and plan.planned_sqft else float(prop.building_sqft or 0) if prop else 0
    total_beds = int(plan.planned_beds or 0) if plan and plan.planned_beds else total_units

    budget_f = float(total_budgeted)
    cost_per_unit = round(budget_f / total_units, 2) if total_units > 0 else None
    cost_per_sqft = round(budget_f / building_sqft, 2) if building_sqft > 0 else None
    cost_per_bed = round(budget_f / total_beds, 2) if total_beds > 0 else None

    return ConstructionBudgetSummary(
        property_id=property_id,
        plan_id=plan_id,
        line_items=expenses,
        total_budgeted=total_budgeted,
        total_actual=total_actual,
        total_variance=total_budgeted - total_actual,
        by_category=by_category,
        cost_per_unit=cost_per_unit,
        cost_per_sqft=cost_per_sqft,
        cost_per_bed=cost_per_bed,
        total_units=total_units,
        building_sqft=building_sqft,
        total_beds=total_beds,
    )


# ---------------------------------------------------------------------------
# Task 3: Construction Draw Schedule
# ---------------------------------------------------------------------------


@router.get("/properties/{property_id}/construction-draws", response_model=_List[ConstructionDrawOut])
def list_construction_draws(
    property_id: int,
    debt_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_investor_or_above),
):
    query = db.query(ConstructionDraw).filter(ConstructionDraw.property_id == property_id)
    if debt_id:
        query = query.filter(ConstructionDraw.debt_id == debt_id)
    return query.order_by(ConstructionDraw.draw_number).all()


@router.post("/properties/{property_id}/construction-draws", response_model=ConstructionDrawOut, status_code=status.HTTP_201_CREATED)
def create_construction_draw(
    property_id: int,
    payload: ConstructionDrawCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    facility = db.query(DebtFacility).filter(
        DebtFacility.debt_id == payload.debt_id,
        DebtFacility.property_id == property_id,
    ).first()
    if not facility:
        raise HTTPException(404, "Debt facility not found for this property")

    draw = ConstructionDraw(
        property_id=property_id,
        **payload.model_dump(),
    )
    db.add(draw)
    try:
        db.commit()
        db.refresh(draw)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return draw


@router.patch("/construction-draws/{draw_id}", response_model=ConstructionDrawOut)
def update_construction_draw(
    draw_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    draw = db.query(ConstructionDraw).filter(ConstructionDraw.draw_id == draw_id).first()
    if not draw:
        raise HTTPException(404, "Construction draw not found")
    date_fields = {"requested_date", "approved_date", "funded_date"}
    for k, v in payload.items():
        if k == "status" and v:
            v = ConstructionDrawStatus(v)
        if k in date_fields and isinstance(v, str):
            from datetime import date as _date
            v = _date.fromisoformat(v)
        if hasattr(draw, k):
            setattr(draw, k, v)
    # When a draw is funded, update the debt facility's drawn_amount
    if draw.status == ConstructionDrawStatus.funded and draw.approved_amount:
        db.flush()  # ensure this draw's status is visible to the sum query
        facility = db.query(DebtFacility).filter(DebtFacility.debt_id == draw.debt_id).first()
        if facility:
            funded_total = (
                db.query(sa_func.coalesce(sa_func.sum(ConstructionDraw.approved_amount), 0))
                .filter(
                    ConstructionDraw.debt_id == draw.debt_id,
                    ConstructionDraw.status == ConstructionDrawStatus.funded,
                )
                .scalar()
            )
            facility.drawn_amount = float(funded_total or 0)
            facility.outstanding_balance = float(funded_total or 0)
    try:
        db.commit()
        db.refresh(draw)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
    return draw


@router.delete("/construction-draws/{draw_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_construction_draw(
    draw_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    draw = db.query(ConstructionDraw).filter(ConstructionDraw.draw_id == draw_id).first()
    if not draw:
        raise HTTPException(404, "Construction draw not found")
    db.delete(draw)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error (e.g., duplicate entry or missing foreign key)")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
