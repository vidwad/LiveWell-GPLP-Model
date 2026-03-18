"""
Pydantic schemas for the Investor domain.
Ownership/Contributions/Distributions are now handled via Subscription/Holding/DistributionEvent
in schemas/investment.py. This file retains Investor CRUD, Documents, Messages, and Waterfall.
"""
import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel
from app.db.models import DocumentType


# ---------------------------------------------------------------------------
# Investor
# ---------------------------------------------------------------------------

class InvestorCreate(BaseModel):
    name: str
    email: str
    phone: str | None = None
    address: str | None = None
    entity_type: str | None = None
    accredited_status: str
    user_id: int | None = None


class InvestorUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    entity_type: str | None = None
    accredited_status: str | None = None


class InvestorOut(BaseModel):
    investor_id: int
    user_id: int | None
    name: str
    email: str
    phone: str | None
    address: str | None
    entity_type: str | None
    accredited_status: str
    onboarding_status: str | None = "lead"
    onboarding_started_at: Optional[datetime.datetime] = None
    onboarding_completed_at: Optional[datetime.datetime] = None
    invited_at: Optional[datetime.datetime] = None
    approved_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}


class InvestorSummary(BaseModel):
    """Investor summary for the list view with subscription & action data."""
    investor_id: int
    name: str
    email: str
    phone: str | None = None
    entity_type: str | None = None
    accredited_status: str = "accredited"
    total_committed: Decimal = Decimal("0")
    total_funded: Decimal = Decimal("0")
    subscription_count: int = 0
    active_subscriptions: int = 0  # subscriptions needing action
    lp_names: list[str] = []  # LP funds this investor is in
    latest_status: str | None = None  # most recent subscription status
    created_at: Optional[datetime.datetime] = None


class InvestorDashboard(BaseModel):
    """Investor detail with aggregated investment data."""
    investor: InvestorOut
    total_committed: Decimal = Decimal("0")
    total_funded: Decimal = Decimal("0")
    total_distributions: Decimal = Decimal("0")
    net_position: Decimal = Decimal("0")
    subscription_count: int = 0
    holding_count: int = 0
    documents: list = []
    messages: list = []


# ---------------------------------------------------------------------------
# Investor Distribution History
# ---------------------------------------------------------------------------

class InvestorDistributionItem(BaseModel):
    """A single distribution allocation for an investor."""
    allocation_id: int
    event_id: int
    lp_name: str
    period_label: str
    distribution_type: str
    amount: Decimal
    event_status: str
    paid_date: Optional[datetime.datetime] = None
    created_date: datetime.datetime
    notes: Optional[str] = None


class InvestorDistributionHistory(BaseModel):
    """Full distribution history for an investor across all LPs."""
    investor_id: int
    investor_name: str
    total_distributions: Decimal = Decimal("0")
    distributions: List[InvestorDistributionItem] = []


# ---------------------------------------------------------------------------
# Documents & Messages
# ---------------------------------------------------------------------------

class DocumentCreate(BaseModel):
    title: str
    document_type: DocumentType
    file_url: str


class DocumentOut(BaseModel):
    document_id: int
    investor_id: int
    title: str
    document_type: DocumentType
    file_url: str
    upload_date: datetime.datetime
    is_viewed: bool

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    subject: str
    body: str


class MessageOut(BaseModel):
    message_id: int
    investor_id: int
    sender_id: int
    subject: str
    body: str
    sent_at: datetime.datetime
    is_read: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Waterfall (now LP-aware — takes LP waterfall terms)
# ---------------------------------------------------------------------------

class WaterfallInput(BaseModel):
    distributable_cash: Decimal
    unreturned_capital: Decimal
    unpaid_pref_balance: Decimal
    pref_rate: Decimal = Decimal("0.08")
    gp_promote_share: Decimal = Decimal("0.20")


class WaterfallResultSchema(BaseModel):
    total_distribution: Decimal
    lp_distribution: Decimal
    gp_distribution: Decimal
    tier_1_lp: Decimal
    tier_1_gp: Decimal
    tier_2_lp: Decimal
    tier_2_gp: Decimal
    tier_3_lp: Decimal
    tier_3_gp: Decimal
    unpaid_pref_balance: Decimal
    unreturned_capital: Decimal


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------

class OnboardingChecklistItemOut(BaseModel):
    item_id: int
    investor_id: int
    step_name: str
    step_label: str
    is_required: bool
    is_completed: bool
    completed_at: Optional[datetime.datetime] = None
    document_id: int | None = None
    notes: str | None = None
    sort_order: int = 0

    model_config = {"from_attributes": True}


class OnboardingChecklistItemUpdate(BaseModel):
    is_completed: bool | None = None
    document_id: int | None = None
    notes: str | None = None


class OnboardingStatusTransition(BaseModel):
    new_status: str
    notes: str | None = None


class InvestorOnboardingDetail(BaseModel):
    investor: InvestorOut
    checklist: List[OnboardingChecklistItemOut] = []
    completed_steps: int = 0
    total_steps: int = 0
    required_steps: int = 0
    completed_required: int = 0
    is_ready_for_approval: bool = False
