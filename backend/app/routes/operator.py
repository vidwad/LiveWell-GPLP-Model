"""
API routes for Operator Layer management:
- Operator budgets (annual/quarterly)
- Operating expense tracking
- Budget vs. actual reporting
"""
from collections import defaultdict
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user, require_gp_or_ops, require_gp_ops_pm,
)
from app.db.models import (
    User, OperatorEntity, OperatorBudget, OperatingExpense,
    Community, BudgetPeriodType, FundingOpportunity, FundingStatus,
    UnitTurnover, ArrearsRecord, Unit, Resident, TurnoverStatus,
)
from app.db.session import get_db
from app.schemas.lifecycle import (
    OperatorBudgetCreate, OperatorBudgetUpdate, OperatorBudgetOut,
    OperatingExpenseCreate, OperatingExpenseUpdate, OperatingExpenseOut,
    ExpenseSummaryOut,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Operator Budgets
# ---------------------------------------------------------------------------

@router.get("/budgets", response_model=List[OperatorBudgetOut])
def list_budgets(
    operator_id: int | None = None,
    community_id: int | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_ops_pm),
):
    """List operator budgets with optional filters."""
    query = db.query(OperatorBudget)
    if operator_id:
        query = query.filter(OperatorBudget.operator_id == operator_id)
    if community_id:
        query = query.filter(OperatorBudget.community_id == community_id)
    if year:
        query = query.filter(OperatorBudget.year == year)

    budgets = query.order_by(OperatorBudget.year.desc(), OperatorBudget.quarter).all()

    result = []
    for b in budgets:
        out = OperatorBudgetOut(
            budget_id=b.budget_id,
            operator_id=b.operator_id,
            community_id=b.community_id,
            period_type=b.period_type,
            period_label=b.period_label,
            year=b.year,
            quarter=b.quarter,
            budgeted_revenue=b.budgeted_revenue,
            budgeted_expenses=b.budgeted_expenses,
            budgeted_noi=b.budgeted_noi,
            actual_revenue=b.actual_revenue,
            actual_expenses=b.actual_expenses,
            actual_noi=b.actual_noi,
            notes=b.notes,
            created_at=b.created_at,
            revenue_variance=(
                b.actual_revenue - b.budgeted_revenue
                if b.actual_revenue is not None else None
            ),
            expense_variance=(
                b.actual_expenses - b.budgeted_expenses
                if b.actual_expenses is not None else None
            ),
            noi_variance=(
                b.actual_noi - b.budgeted_noi
                if b.actual_noi is not None else None
            ),
        )
        result.append(out)
    return result


@router.post(
    "/budgets",
    response_model=OperatorBudgetOut,
    status_code=status.HTTP_201_CREATED,
)
def create_budget(
    payload: OperatorBudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Create a new operator budget."""
    # Validate operator and community exist
    operator = db.query(OperatorEntity).filter(
        OperatorEntity.operator_id == payload.operator_id
    ).first()
    if not operator:
        raise HTTPException(404, "Operator not found")

    community = db.query(Community).filter(
        Community.community_id == payload.community_id
    ).first()
    if not community:
        raise HTTPException(404, "Community not found")

    # Check for duplicate
    existing = db.query(OperatorBudget).filter(
        OperatorBudget.operator_id == payload.operator_id,
        OperatorBudget.community_id == payload.community_id,
        OperatorBudget.year == payload.year,
        OperatorBudget.quarter == payload.quarter,
    ).first()
    if existing:
        raise HTTPException(400, f"Budget already exists for this period (ID: {existing.budget_id})")

    budget = OperatorBudget(**payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)

    return OperatorBudgetOut(
        budget_id=budget.budget_id,
        operator_id=budget.operator_id,
        community_id=budget.community_id,
        period_type=budget.period_type,
        period_label=budget.period_label,
        year=budget.year,
        quarter=budget.quarter,
        budgeted_revenue=budget.budgeted_revenue,
        budgeted_expenses=budget.budgeted_expenses,
        budgeted_noi=budget.budgeted_noi,
        actual_revenue=budget.actual_revenue,
        actual_expenses=budget.actual_expenses,
        actual_noi=budget.actual_noi,
        notes=budget.notes,
        created_at=budget.created_at,
    )


@router.patch("/budgets/{budget_id}", response_model=OperatorBudgetOut)
def update_budget(
    budget_id: int,
    payload: OperatorBudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Update a budget (actuals, notes, etc.)."""
    budget = db.query(OperatorBudget).filter(
        OperatorBudget.budget_id == budget_id
    ).first()
    if not budget:
        raise HTTPException(404, "Budget not found")

    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(budget, key, val)

    db.commit()
    db.refresh(budget)

    return OperatorBudgetOut(
        budget_id=budget.budget_id,
        operator_id=budget.operator_id,
        community_id=budget.community_id,
        period_type=budget.period_type,
        period_label=budget.period_label,
        year=budget.year,
        quarter=budget.quarter,
        budgeted_revenue=budget.budgeted_revenue,
        budgeted_expenses=budget.budgeted_expenses,
        budgeted_noi=budget.budgeted_noi,
        actual_revenue=budget.actual_revenue,
        actual_expenses=budget.actual_expenses,
        actual_noi=budget.actual_noi,
        notes=budget.notes,
        created_at=budget.created_at,
        revenue_variance=(
            budget.actual_revenue - budget.budgeted_revenue
            if budget.actual_revenue is not None else None
        ),
        expense_variance=(
            budget.actual_expenses - budget.budgeted_expenses
            if budget.actual_expenses is not None else None
        ),
        noi_variance=(
            budget.actual_noi - budget.budgeted_noi
            if budget.actual_noi is not None else None
        ),
    )


# ---------------------------------------------------------------------------
# Operating Expenses
# ---------------------------------------------------------------------------

@router.get("/expenses", response_model=List[OperatingExpenseOut])
def list_expenses(
    community_id: int | None = None,
    year: int | None = None,
    month: int | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_ops_pm),
):
    """List operating expenses with optional filters."""
    query = db.query(OperatingExpense)
    if community_id:
        query = query.filter(OperatingExpense.community_id == community_id)
    if year:
        query = query.filter(OperatingExpense.period_year == year)
    if month:
        query = query.filter(OperatingExpense.period_month == month)
    if category:
        query = query.filter(OperatingExpense.category == category)

    return query.order_by(OperatingExpense.expense_date.desc()).all()


@router.post(
    "/expenses",
    response_model=OperatingExpenseOut,
    status_code=status.HTTP_201_CREATED,
)
def create_expense(
    payload: OperatingExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_ops_pm),
):
    """Record a new operating expense."""
    community = db.query(Community).filter(
        Community.community_id == payload.community_id
    ).first()
    if not community:
        raise HTTPException(404, "Community not found")

    if payload.budget_id:
        budget = db.query(OperatorBudget).filter(
            OperatorBudget.budget_id == payload.budget_id
        ).first()
        if not budget:
            raise HTTPException(404, "Budget not found")

    expense = OperatingExpense(**payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.patch("/expenses/{expense_id}", response_model=OperatingExpenseOut)
def update_expense(
    expense_id: int,
    payload: OperatingExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_ops_pm),
):
    """Update an operating expense."""
    expense = db.query(OperatingExpense).filter(
        OperatingExpense.expense_id == expense_id
    ).first()
    if not expense:
        raise HTTPException(404, "Expense not found")

    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(expense, key, val)

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Delete an operating expense."""
    expense = db.query(OperatingExpense).filter(
        OperatingExpense.expense_id == expense_id
    ).first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    db.delete(expense)
    db.commit()


# ---------------------------------------------------------------------------
# Expense Summary / Budget vs. Actual
# ---------------------------------------------------------------------------

@router.get(
    "/communities/{community_id}/expense-summary",
    response_model=ExpenseSummaryOut,
)
def get_expense_summary(
    community_id: int,
    year: int,
    quarter: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_ops_pm),
):
    """Get aggregated expense summary by category for a community/period."""
    community = db.query(Community).filter(
        Community.community_id == community_id
    ).first()
    if not community:
        raise HTTPException(404, "Community not found")

    query = db.query(OperatingExpense).filter(
        OperatingExpense.community_id == community_id,
        OperatingExpense.period_year == year,
    )

    if quarter:
        months = {1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]}[quarter]
        query = query.filter(OperatingExpense.period_month.in_(months))
        period_label = f"Q{quarter} {year}"
    else:
        period_label = str(year)

    expenses = query.all()

    by_category = defaultdict(Decimal)
    for exp in expenses:
        by_category[exp.category.value] += exp.amount

    return ExpenseSummaryOut(
        community_id=community_id,
        period_label=period_label,
        total_expenses=sum(by_category.values(), Decimal("0")),
        by_category=dict(by_category),
        expense_count=len(expenses),
    )


# ---------------------------------------------------------------------------
# Phase 5: Funding Opportunities (Grant Tracking)
# ---------------------------------------------------------------------------

import datetime as _dt
from pydantic import BaseModel as _BaseModel


class _FundingCreate(_BaseModel):
    title: str
    funding_source: str | None = None
    operator_id: int | None = None
    community_id: int | None = None
    amount: float | None = None
    status: str = "draft"
    submission_deadline: _dt.date | None = None
    reporting_deadline: _dt.date | None = None
    awarded_amount: float | None = None
    notes: str | None = None


class _FundingUpdate(_BaseModel):
    title: str | None = None
    funding_source: str | None = None
    operator_id: int | None = None
    community_id: int | None = None
    amount: float | None = None
    status: str | None = None
    submission_deadline: _dt.date | None = None
    reporting_deadline: _dt.date | None = None
    awarded_amount: float | None = None
    notes: str | None = None


class _FundingOut(_FundingCreate):
    funding_id: int
    created_at: _dt.datetime | None = None
    updated_at: _dt.datetime | None = None

    model_config = {"from_attributes": True}


@router.get("/funding", response_model=List[_FundingOut])
def list_funding(
    operator_id: int | None = None,
    community_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    q = db.query(FundingOpportunity)
    if operator_id:
        q = q.filter(FundingOpportunity.operator_id == operator_id)
    if community_id:
        q = q.filter(FundingOpportunity.community_id == community_id)
    if status:
        q = q.filter(FundingOpportunity.status == status)
    return q.order_by(FundingOpportunity.created_at.desc()).all()


@router.post("/funding", response_model=_FundingOut, status_code=201)
def create_funding(
    payload: _FundingCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    opp = FundingOpportunity(**payload.model_dump())
    db.add(opp)
    db.commit()
    db.refresh(opp)
    return opp


@router.patch("/funding/{funding_id}", response_model=_FundingOut)
def update_funding(
    funding_id: int,
    payload: _FundingUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    opp = db.query(FundingOpportunity).filter(FundingOpportunity.funding_id == funding_id).first()
    if not opp:
        raise HTTPException(404, "Funding opportunity not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        if hasattr(opp, k):
            setattr(opp, k, v)
    db.commit()
    db.refresh(opp)
    return opp


@router.delete("/funding/{funding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_funding(
    funding_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_or_ops),
):
    opp = db.query(FundingOpportunity).filter(FundingOpportunity.funding_id == funding_id).first()
    if not opp:
        raise HTTPException(404, "Funding opportunity not found")
    db.delete(opp)
    db.commit()


# ---------------------------------------------------------------------------
# Phase 5: Unit Turnovers
# ---------------------------------------------------------------------------

class _TurnoverCreate(_BaseModel):
    unit_id: int
    vacated_by_resident_id: int | None = None
    move_out_date: _dt.date | None = None
    target_ready_date: _dt.date | None = None
    status: str = "scheduled"
    inspection_notes: str | None = None
    cleaning_complete: bool = False
    repairs_complete: bool = False
    painting_complete: bool = False
    inspection_passed: bool | None = None
    assigned_to: int | None = None


class _TurnoverUpdate(_BaseModel):
    unit_id: int | None = None
    vacated_by_resident_id: int | None = None
    move_out_date: _dt.date | None = None
    target_ready_date: _dt.date | None = None
    status: str | None = None
    inspection_notes: str | None = None
    cleaning_complete: bool | None = None
    repairs_complete: bool | None = None
    painting_complete: bool | None = None
    inspection_passed: bool | None = None
    assigned_to: int | None = None


class _TurnoverOut(_TurnoverCreate):
    turnover_id: int
    actual_ready_date: _dt.date | None = None
    created_at: _dt.datetime | None = None

    model_config = {"from_attributes": True}


@router.get("/turnovers", response_model=List[_TurnoverOut])
def list_turnovers(
    unit_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    q = db.query(UnitTurnover)
    if unit_id:
        q = q.filter(UnitTurnover.unit_id == unit_id)
    if status_filter:
        q = q.filter(UnitTurnover.status == status_filter)
    return q.order_by(UnitTurnover.created_at.desc()).all()


@router.post("/turnovers", response_model=_TurnoverOut, status_code=201)
def create_turnover(
    payload: _TurnoverCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    turnover = UnitTurnover(**payload.model_dump())
    db.add(turnover)
    db.commit()
    db.refresh(turnover)
    return turnover


@router.patch("/turnovers/{turnover_id}", response_model=_TurnoverOut)
def update_turnover(
    turnover_id: int,
    payload: _TurnoverUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    t = db.query(UnitTurnover).filter(UnitTurnover.turnover_id == turnover_id).first()
    if not t:
        raise HTTPException(404, "Turnover not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        if hasattr(t, k):
            setattr(t, k, v)
    if all([t.cleaning_complete, t.repairs_complete, t.painting_complete]) and t.inspection_passed:
        t.status = TurnoverStatus.ready
        t.actual_ready_date = _dt.date.today()
    db.commit()
    db.refresh(t)
    return t


# ---------------------------------------------------------------------------
# Phase 5: Arrears Records
# ---------------------------------------------------------------------------

class _ArrearsCreate(_BaseModel):
    resident_id: int
    rent_payment_id: int | None = None
    amount_overdue: float
    due_date: _dt.date
    follow_up_action: str | None = None
    follow_up_date: _dt.date | None = None
    notes: str | None = None


class _ArrearsOut(_ArrearsCreate):
    arrears_id: int
    days_overdue: int
    aging_bucket: str
    is_resolved: bool
    resolved_date: _dt.date | None = None
    created_at: _dt.datetime | None = None

    model_config = {"from_attributes": True}


def _calc_aging(days: int) -> str:
    if days <= 30:
        return "0-30"
    elif days <= 60:
        return "31-60"
    elif days <= 90:
        return "61-90"
    else:
        return "90+"


@router.get("/arrears", response_model=List[_ArrearsOut])
def list_arrears(
    resident_id: int | None = None,
    unresolved_only: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    q = db.query(ArrearsRecord)
    if resident_id:
        q = q.filter(ArrearsRecord.resident_id == resident_id)
    if unresolved_only:
        q = q.filter(ArrearsRecord.is_resolved == False)
    records = q.order_by(ArrearsRecord.due_date).all()
    today = _dt.date.today()
    for r in records:
        r.days_overdue = (today - r.due_date).days if not r.is_resolved else r.days_overdue
        r.aging_bucket = _calc_aging(r.days_overdue)
    return records


@router.post("/arrears", response_model=_ArrearsOut, status_code=201)
def create_arrears(
    payload: _ArrearsCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    import datetime as dt_
    today = dt_.date.today()
    days = (today - payload.due_date).days
    record = ArrearsRecord(
        **payload.model_dump(),
        days_overdue=days,
        aging_bucket=_calc_aging(days),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.patch("/arrears/{arrears_id}/resolve", response_model=_ArrearsOut)
def resolve_arrears(
    arrears_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_gp_ops_pm),
):
    import datetime as dt_
    record = db.query(ArrearsRecord).filter(ArrearsRecord.arrears_id == arrears_id).first()
    if not record:
        raise HTTPException(404, "Arrears record not found")
    record.is_resolved = True
    record.resolved_date = dt_.date.today()
    db.commit()
    db.refresh(record)
    return record
