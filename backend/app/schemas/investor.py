import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr
from app.db.models import DistributionMethod, DistributionType, DocumentType


class InvestorCreate(BaseModel):
    name: str
    email: EmailStr
    accredited_status: str
    phone: str | None = None
    user_id: int | None = None
    preferred_return_rate: Decimal | None = None


class InvestorOut(BaseModel):
    investor_id: int
    name: str
    email: EmailStr
    accredited_status: str
    phone: str | None
    preferred_return_rate: Decimal | None

    model_config = {"from_attributes": True}


class ContributionCreate(BaseModel):
    amount: Decimal
    date: datetime.datetime
    notes: str | None = None


class ContributionOut(BaseModel):
    contribution_id: int
    investor_id: int
    amount: Decimal
    date: datetime.datetime
    notes: str | None

    model_config = {"from_attributes": True}


class OwnershipCreate(BaseModel):
    property_id: int | None = None
    ownership_percent: Decimal
    is_gp: bool = False


class OwnershipOut(BaseModel):
    ownership_id: int
    investor_id: int
    property_id: int | None
    ownership_percent: Decimal
    is_gp: bool

    model_config = {"from_attributes": True}


class DistributionCreate(BaseModel):
    amount: Decimal
    payment_date: datetime.datetime
    method: DistributionMethod
    distribution_type: DistributionType = DistributionType.preferred_return
    notes: str | None = None


class DistributionOut(BaseModel):
    distribution_id: int
    investor_id: int
    amount: Decimal
    payment_date: datetime.datetime
    method: DistributionMethod
    distribution_type: DistributionType | None
    notes: str | None

    model_config = {"from_attributes": True}


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
# Waterfall
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

# Update InvestorDashboard to include documents and messages
class InvestorDashboard(BaseModel):
    investor: InvestorOut
    total_contributed: Decimal
    total_distributed: Decimal
    net_position: Decimal
    ownership_positions: list[OwnershipOut]
    recent_distributions: list[DistributionOut]
    documents: list[DocumentOut] = []
    messages: list[MessageOut] = []
