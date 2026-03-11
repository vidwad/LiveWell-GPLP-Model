import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr
from app.db.models import DistributionMethod


class InvestorCreate(BaseModel):
    name: str
    email: EmailStr
    accredited_status: str
    phone: str | None = None
    user_id: int | None = None


class InvestorOut(BaseModel):
    investor_id: int
    name: str
    email: EmailStr
    accredited_status: str
    phone: str | None

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


class OwnershipOut(BaseModel):
    ownership_id: int
    investor_id: int
    property_id: int | None
    ownership_percent: Decimal

    model_config = {"from_attributes": True}


class DistributionCreate(BaseModel):
    amount: Decimal
    payment_date: datetime.datetime
    method: DistributionMethod
    notes: str | None = None


class DistributionOut(BaseModel):
    distribution_id: int
    investor_id: int
    amount: Decimal
    payment_date: datetime.datetime
    method: DistributionMethod
    notes: str | None

    model_config = {"from_attributes": True}


class InvestorDashboard(BaseModel):
    investor: InvestorOut
    total_contributed: Decimal
    total_distributed: Decimal
    net_position: Decimal
    ownership_positions: list[OwnershipOut]
    recent_distributions: list[DistributionOut]
