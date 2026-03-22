"""
Pydantic schemas for Property Lifecycle, Quarterly Reports, eTransfer Tracking,
Message Threads, and Operator Budget/Expense management (Phase 3).
"""
import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel

from app.db.models import (
    DevelopmentStage, MilestoneStatus, QuarterlyReportStatus,
    ETransferStatus, ExpenseCategory, ExpensePhase, BudgetPeriodType,
)


# ---------------------------------------------------------------------------
# Property Lifecycle — Stage Transitions
# ---------------------------------------------------------------------------

class StageTransitionRequest(BaseModel):
    to_stage: DevelopmentStage
    notes: Optional[str] = None
    force: bool = False  # GP_ADMIN only


class ValidationCheckOut(BaseModel):
    name: str
    passed: bool
    message: str


class StageTransitionOut(BaseModel):
    transition_id: int
    property_id: int
    from_stage: str
    to_stage: str
    transitioned_by: int
    transitioned_at: datetime.datetime
    notes: Optional[str]
    validation_passed: bool
    validation_checks: List[ValidationCheckOut] = []

    model_config = {"from_attributes": True}


class AllowedTransitionsOut(BaseModel):
    current_stage: str
    allowed_transitions: List[str]


# ---------------------------------------------------------------------------
# Property Milestones
# ---------------------------------------------------------------------------

class MilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: Optional[datetime.date] = None
    stage: Optional[DevelopmentStage] = None
    sort_order: int = 0


class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[datetime.date] = None
    actual_date: Optional[datetime.date] = None
    status: Optional[MilestoneStatus] = None
    sort_order: Optional[int] = None


class MilestoneOut(BaseModel):
    milestone_id: int
    property_id: int
    title: str
    description: Optional[str]
    target_date: Optional[datetime.date]
    actual_date: Optional[datetime.date]
    status: MilestoneStatus
    stage: Optional[str]
    sort_order: int
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Quarterly Reports
# ---------------------------------------------------------------------------

class QuarterlyReportGenerate(BaseModel):
    quarter: int  # 1-4
    year: int


class QuarterlyReportUpdate(BaseModel):
    status: Optional[QuarterlyReportStatus] = None
    executive_summary: Optional[str] = None
    market_commentary: Optional[str] = None


class PropertyUpdateItem(BaseModel):
    property_id: int
    address: str
    city: str
    stage: str
    total_beds: int
    occupied_beds: int
    occupancy_percent: float
    communities: List[str]


class QuarterlyReportOut(BaseModel):
    report_id: int
    lp_id: int
    period_label: str
    quarter: int
    year: int
    status: QuarterlyReportStatus
    total_revenue: Optional[Decimal]
    total_expenses: Optional[Decimal]
    net_operating_income: Optional[Decimal]
    total_distributions: Optional[Decimal]
    portfolio_value: Optional[Decimal]
    portfolio_ltv: Optional[Decimal]
    executive_summary: Optional[str]
    property_updates: Optional[str]  # JSON string
    market_commentary: Optional[str]
    generated_at: datetime.datetime
    published_at: Optional[datetime.datetime]
    generated_by: Optional[int]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# eTransfer Tracking
# ---------------------------------------------------------------------------

class ETransferCreate(BaseModel):
    allocation_id: int
    recipient_email: str
    amount: Decimal
    security_question: Optional[str] = None
    notes: Optional[str] = None


class ETransferUpdate(BaseModel):
    status: Optional[ETransferStatus] = None
    reference_number: Optional[str] = None
    sent_at: Optional[datetime.datetime] = None
    accepted_at: Optional[datetime.datetime] = None
    notes: Optional[str] = None


class ETransferOut(BaseModel):
    tracking_id: int
    allocation_id: int
    recipient_email: str
    amount: Decimal
    security_question: Optional[str]
    reference_number: Optional[str]
    status: ETransferStatus
    initiated_at: datetime.datetime
    sent_at: Optional[datetime.datetime]
    accepted_at: Optional[datetime.datetime]
    expires_at: Optional[datetime.datetime]
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Message Threads (replies)
# ---------------------------------------------------------------------------

class MessageReplyCreate(BaseModel):
    body: str


class MessageReplyOut(BaseModel):
    reply_id: int
    parent_message_id: int
    sender_id: int
    body: str
    sent_at: datetime.datetime
    is_read: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Operator Budgets
# ---------------------------------------------------------------------------

class OperatorBudgetCreate(BaseModel):
    operator_id: int
    community_id: int
    period_type: BudgetPeriodType = BudgetPeriodType.annual
    period_label: str
    year: int
    quarter: Optional[int] = None
    budgeted_revenue: Decimal = Decimal("0")
    budgeted_expenses: Decimal = Decimal("0")
    budgeted_noi: Decimal = Decimal("0")
    notes: Optional[str] = None


class OperatorBudgetUpdate(BaseModel):
    budgeted_revenue: Optional[Decimal] = None
    budgeted_expenses: Optional[Decimal] = None
    budgeted_noi: Optional[Decimal] = None
    actual_revenue: Optional[Decimal] = None
    actual_expenses: Optional[Decimal] = None
    actual_noi: Optional[Decimal] = None
    notes: Optional[str] = None


class OperatorBudgetOut(BaseModel):
    budget_id: int
    operator_id: int
    community_id: int
    period_type: BudgetPeriodType
    period_label: str
    year: int
    quarter: Optional[int]
    budgeted_revenue: Decimal
    budgeted_expenses: Decimal
    budgeted_noi: Decimal
    actual_revenue: Optional[Decimal]
    actual_expenses: Optional[Decimal]
    actual_noi: Optional[Decimal]
    notes: Optional[str]
    created_at: datetime.datetime

    # Computed fields
    revenue_variance: Optional[Decimal] = None
    expense_variance: Optional[Decimal] = None
    noi_variance: Optional[Decimal] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Operating Expenses
# ---------------------------------------------------------------------------

class OperatingExpenseCreate(BaseModel):
    community_id: int
    budget_id: Optional[int] = None
    category: ExpenseCategory
    description: str
    amount: Decimal
    expense_date: datetime.date
    period_month: int
    period_year: int
    vendor: Optional[str] = None
    invoice_ref: Optional[str] = None
    is_recurring: bool = False
    phase: Optional[ExpensePhase] = None
    notes: Optional[str] = None


class OperatingExpenseUpdate(BaseModel):
    category: Optional[ExpenseCategory] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    expense_date: Optional[datetime.date] = None
    vendor: Optional[str] = None
    invoice_ref: Optional[str] = None
    is_recurring: Optional[bool] = None
    phase: Optional[ExpensePhase] = None
    notes: Optional[str] = None


class OperatingExpenseOut(BaseModel):
    expense_id: int
    community_id: int
    budget_id: Optional[int]
    category: ExpenseCategory
    description: str
    amount: Decimal
    expense_date: datetime.date
    period_month: int
    period_year: int
    vendor: Optional[str]
    invoice_ref: Optional[str]
    is_recurring: bool
    phase: Optional[str] = None
    notes: Optional[str]
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class ExpenseSummaryOut(BaseModel):
    """Aggregated expense summary by category for a community/period."""
    community_id: int
    period_label: str
    total_expenses: Decimal
    by_category: dict  # {category: amount}
    expense_count: int
