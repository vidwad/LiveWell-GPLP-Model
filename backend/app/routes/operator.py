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
    Community, BudgetPeriodType,
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
