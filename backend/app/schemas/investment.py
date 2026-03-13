"""
Pydantic schemas for the investment structure: GP, LP, Subscription, Holding,
Distribution Events, and Allocations.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# GP Entity
# ---------------------------------------------------------------------------

class GPEntityBase(BaseModel):
    legal_name: str
    management_fee_percent: Optional[Decimal] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None


class GPEntityCreate(GPEntityBase):
    pass


class GPEntityUpdate(BaseModel):
    legal_name: Optional[str] = None
    management_fee_percent: Optional[Decimal] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None


class GPEntityOut(GPEntityBase):
    gp_id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# LP Entity
# ---------------------------------------------------------------------------

class LPEntityBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "forming"
    target_raise: Optional[Decimal] = None
    minimum_investment: Optional[Decimal] = None
    offering_date: Optional[date] = None
    closing_date: Optional[date] = None
    preferred_return_rate: Optional[Decimal] = None
    gp_promote_percent: Optional[Decimal] = None
    gp_catchup_percent: Optional[Decimal] = None
    asset_management_fee_percent: Optional[Decimal] = None
    acquisition_fee_percent: Optional[Decimal] = None


class LPEntityCreate(LPEntityBase):
    gp_id: int


class LPEntityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    target_raise: Optional[Decimal] = None
    minimum_investment: Optional[Decimal] = None
    offering_date: Optional[date] = None
    closing_date: Optional[date] = None
    preferred_return_rate: Optional[Decimal] = None
    gp_promote_percent: Optional[Decimal] = None
    gp_catchup_percent: Optional[Decimal] = None
    asset_management_fee_percent: Optional[Decimal] = None
    acquisition_fee_percent: Optional[Decimal] = None


class LPEntityOut(LPEntityBase):
    lp_id: int
    gp_id: int

    class Config:
        from_attributes = True


class LPEntityDetail(LPEntityOut):
    """LP with nested subscriptions, holdings, and properties summary."""
    total_committed: Optional[Decimal] = None
    total_funded: Optional[Decimal] = None
    subscription_count: int = 0
    holding_count: int = 0
    property_count: int = 0

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------

class SubscriptionBase(BaseModel):
    commitment_amount: Decimal
    funded_amount: Decimal = Decimal("0")
    status: str = "draft"
    submitted_date: Optional[date] = None
    accepted_date: Optional[date] = None
    funded_date: Optional[date] = None
    issued_date: Optional[date] = None
    notes: Optional[str] = None


class SubscriptionCreate(SubscriptionBase):
    investor_id: int
    lp_id: int


class SubscriptionUpdate(BaseModel):
    commitment_amount: Optional[Decimal] = None
    funded_amount: Optional[Decimal] = None
    status: Optional[str] = None
    submitted_date: Optional[date] = None
    accepted_date: Optional[date] = None
    funded_date: Optional[date] = None
    issued_date: Optional[date] = None
    notes: Optional[str] = None


class SubscriptionOut(SubscriptionBase):
    subscription_id: int
    investor_id: int
    lp_id: int
    investor_name: Optional[str] = None
    lp_name: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Holding
# ---------------------------------------------------------------------------

class HoldingBase(BaseModel):
    ownership_percent: Decimal
    cost_basis: Decimal
    unreturned_capital: Decimal
    unpaid_preferred: Decimal = Decimal("0")
    is_gp: bool = False


class HoldingCreate(HoldingBase):
    investor_id: int
    lp_id: int
    subscription_id: Optional[int] = None


class HoldingUpdate(BaseModel):
    ownership_percent: Optional[Decimal] = None
    cost_basis: Optional[Decimal] = None
    unreturned_capital: Optional[Decimal] = None
    unpaid_preferred: Optional[Decimal] = None
    is_gp: Optional[bool] = None


class HoldingOut(HoldingBase):
    holding_id: int
    investor_id: int
    lp_id: int
    subscription_id: Optional[int] = None
    investor_name: Optional[str] = None
    lp_name: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Distribution Event & Allocation
# ---------------------------------------------------------------------------

class DistributionAllocationOut(BaseModel):
    allocation_id: int
    holding_id: int
    amount: Decimal
    distribution_type: str
    method: Optional[str] = None
    notes: Optional[str] = None
    investor_name: Optional[str] = None
    ownership_percent: Optional[Decimal] = None

    class Config:
        from_attributes = True


class DistributionEventBase(BaseModel):
    period_label: str
    total_distributable: Decimal
    status: str = "draft"
    notes: Optional[str] = None


class DistributionEventCreate(DistributionEventBase):
    lp_id: int


class DistributionEventOut(DistributionEventBase):
    event_id: int
    lp_id: int
    created_date: datetime
    approved_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    allocations: List[DistributionAllocationOut] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Scope Assignment
# ---------------------------------------------------------------------------

class ScopeAssignmentBase(BaseModel):
    entity_type: str
    entity_id: int
    permission_level: str = "view"


class ScopeAssignmentCreate(ScopeAssignmentBase):
    user_id: int


class ScopeAssignmentOut(ScopeAssignmentBase):
    assignment_id: int
    user_id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Operator Entity
# ---------------------------------------------------------------------------

class OperatorEntityBase(BaseModel):
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class OperatorEntityCreate(OperatorEntityBase):
    pass


class OperatorEntityOut(OperatorEntityBase):
    operator_id: int

    class Config:
        from_attributes = True
