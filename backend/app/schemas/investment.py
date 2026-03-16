"""
Pydantic schemas for the investment structure: GP, LP, Tranche, Subscription,
Holding, Target Property, Distribution Events, and Allocations.
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
    legal_name: Optional[str] = None
    lp_number: Optional[str] = None
    description: Optional[str] = None

    # Focus
    city_focus: Optional[str] = None
    community_focus: Optional[str] = None
    purpose_type: Optional[str] = None

    # Status
    status: str = "draft"

    # Offering terms
    unit_price: Optional[Decimal] = None
    minimum_subscription: Optional[Decimal] = None
    target_raise: Optional[Decimal] = None
    minimum_raise: Optional[Decimal] = None
    maximum_raise: Optional[Decimal] = None
    offering_date: Optional[date] = None
    closing_date: Optional[date] = None

    # Financing / offering costs
    formation_costs: Optional[Decimal] = None
    offering_costs: Optional[Decimal] = None
    reserve_percent: Optional[Decimal] = None
    reserve_amount: Optional[Decimal] = None

    # Waterfall rules (fully configurable per LP)
    waterfall_style: Optional[str] = "european"
    preferred_return_rate: Optional[Decimal] = None
    gp_promote_percent: Optional[Decimal] = None
    gp_catchup_percent: Optional[Decimal] = None
    lp_split_percent: Optional[Decimal] = None
    hurdle_rate_2: Optional[Decimal] = None
    gp_promote_percent_2: Optional[Decimal] = None
    management_fee_percent: Optional[Decimal] = None

    # Fee structure
    asset_management_fee_percent: Optional[Decimal] = None
    acquisition_fee_percent: Optional[Decimal] = None
    selling_commission_percent: Optional[Decimal] = None
    construction_management_fee_percent: Optional[Decimal] = None
    refinancing_fee_percent: Optional[Decimal] = None
    turnover_replacement_fee_percent: Optional[Decimal] = None
    lp_profit_share_percent: Optional[Decimal] = None
    gp_profit_share_percent: Optional[Decimal] = None

    total_units_authorized: Optional[Decimal] = None
    notes: Optional[str] = None


class LPEntityCreate(LPEntityBase):
    gp_id: int


class LPEntityUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    lp_number: Optional[str] = None
    description: Optional[str] = None
    city_focus: Optional[str] = None
    community_focus: Optional[str] = None
    purpose_type: Optional[str] = None
    status: Optional[str] = None
    unit_price: Optional[Decimal] = None
    minimum_subscription: Optional[Decimal] = None
    target_raise: Optional[Decimal] = None
    minimum_raise: Optional[Decimal] = None
    maximum_raise: Optional[Decimal] = None
    offering_date: Optional[date] = None
    closing_date: Optional[date] = None
    formation_costs: Optional[Decimal] = None
    offering_costs: Optional[Decimal] = None
    reserve_percent: Optional[Decimal] = None
    reserve_amount: Optional[Decimal] = None
    waterfall_style: Optional[str] = None
    preferred_return_rate: Optional[Decimal] = None
    gp_promote_percent: Optional[Decimal] = None
    gp_catchup_percent: Optional[Decimal] = None
    lp_split_percent: Optional[Decimal] = None
    hurdle_rate_2: Optional[Decimal] = None
    gp_promote_percent_2: Optional[Decimal] = None
    management_fee_percent: Optional[Decimal] = None
    asset_management_fee_percent: Optional[Decimal] = None
    acquisition_fee_percent: Optional[Decimal] = None
    selling_commission_percent: Optional[Decimal] = None
    construction_management_fee_percent: Optional[Decimal] = None
    refinancing_fee_percent: Optional[Decimal] = None
    turnover_replacement_fee_percent: Optional[Decimal] = None
    lp_profit_share_percent: Optional[Decimal] = None
    gp_profit_share_percent: Optional[Decimal] = None
    total_units_authorized: Optional[Decimal] = None
    notes: Optional[str] = None


class LPEntityOut(LPEntityBase):
    lp_id: int
    gp_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LPEntityDetail(LPEntityOut):
    """LP with nested summaries."""
    total_committed: Optional[Decimal] = None
    total_funded: Optional[Decimal] = None
    total_units_issued: Optional[Decimal] = None
    subscription_count: int = 0
    holding_count: int = 0
    property_count: int = 0
    target_property_count: int = 0
    investor_count: int = 0

    # Funding progress
    gross_subscriptions: Optional[Decimal] = None
    accepted_subscriptions: Optional[Decimal] = None
    funded_subscriptions: Optional[Decimal] = None
    remaining_capacity: Optional[Decimal] = None

    # Capital deployment
    total_formation_costs: Optional[Decimal] = None
    total_reserve_allocations: Optional[Decimal] = None
    net_deployable_capital: Optional[Decimal] = None
    capital_deployed: Optional[Decimal] = None
    capital_available: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# LP Tranche / Closing
# ---------------------------------------------------------------------------

class LPTrancheBase(BaseModel):
    tranche_number: int = 1
    tranche_name: Optional[str] = None
    opening_date: Optional[date] = None
    closing_date: Optional[date] = None
    status: str = "draft"
    issue_price: Optional[Decimal] = None
    target_amount: Optional[Decimal] = None
    target_units: Optional[Decimal] = None
    notes: Optional[str] = None


class LPTrancheCreate(LPTrancheBase):
    lp_id: int


class LPTrancheUpdate(BaseModel):
    tranche_number: Optional[int] = None
    tranche_name: Optional[str] = None
    opening_date: Optional[date] = None
    closing_date: Optional[date] = None
    status: Optional[str] = None
    issue_price: Optional[Decimal] = None
    target_amount: Optional[Decimal] = None
    target_units: Optional[Decimal] = None
    notes: Optional[str] = None


class LPTrancheOut(LPTrancheBase):
    tranche_id: int
    lp_id: int
    created_at: Optional[datetime] = None

    # Computed summary
    subscriptions_count: int = 0
    total_subscribed: Optional[Decimal] = None
    total_funded: Optional[Decimal] = None
    total_units: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------

class SubscriptionBase(BaseModel):
    commitment_amount: Decimal
    funded_amount: Decimal = Decimal("0")
    issue_price: Decimal
    unit_quantity: Decimal
    status: str = "draft"
    submitted_date: Optional[date] = None
    accepted_date: Optional[date] = None
    funded_date: Optional[date] = None
    issued_date: Optional[date] = None
    notes: Optional[str] = None


class SubscriptionCreate(SubscriptionBase):
    investor_id: int
    lp_id: int
    tranche_id: Optional[int] = None


class SubscriptionUpdate(BaseModel):
    commitment_amount: Optional[Decimal] = None
    funded_amount: Optional[Decimal] = None
    issue_price: Optional[Decimal] = None
    unit_quantity: Optional[Decimal] = None
    status: Optional[str] = None
    submitted_date: Optional[date] = None
    accepted_date: Optional[date] = None
    funded_date: Optional[date] = None
    issued_date: Optional[date] = None
    tranche_id: Optional[int] = None
    notes: Optional[str] = None


class SubscriptionOut(SubscriptionBase):
    subscription_id: int
    investor_id: int
    lp_id: int
    tranche_id: Optional[int] = None
    investor_name: Optional[str] = None
    lp_name: Optional[str] = None
    tranche_name: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Holding
# ---------------------------------------------------------------------------

class HoldingBase(BaseModel):
    units_held: Decimal
    average_issue_price: Decimal
    total_capital_contributed: Decimal
    initial_issue_date: date
    unreturned_capital: Decimal
    unpaid_preferred: Decimal = Decimal("0")
    is_gp: bool = False
    status: str = "active"


class HoldingCreate(HoldingBase):
    investor_id: int
    lp_id: int
    subscription_id: Optional[int] = None


class HoldingUpdate(BaseModel):
    units_held: Optional[Decimal] = None
    average_issue_price: Optional[Decimal] = None
    total_capital_contributed: Optional[Decimal] = None
    initial_issue_date: Optional[date] = None
    unreturned_capital: Optional[Decimal] = None
    unpaid_preferred: Optional[Decimal] = None
    is_gp: Optional[bool] = None
    status: Optional[str] = None


class HoldingOut(HoldingBase):
    holding_id: int
    investor_id: int
    lp_id: int
    subscription_id: Optional[int] = None
    investor_name: Optional[str] = None
    lp_name: Optional[str] = None

    # Computed fields (not stored in DB)
    ownership_percent: Optional[Decimal] = None  # computed: units_held / total_units * 100
    cost_basis: Optional[Decimal] = None          # computed: units_held * average_issue_price

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Target / Pipeline Property
# ---------------------------------------------------------------------------

class TargetPropertyBase(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = "AB"
    intended_community: Optional[str] = None
    status: str = "identified"

    # Acquisition
    estimated_acquisition_price: Optional[Decimal] = None
    lot_size: Optional[Decimal] = None
    zoning: Optional[str] = None

    # Current house
    current_sqft: Optional[Decimal] = None
    current_bedrooms: Optional[int] = None
    current_bathrooms: Optional[int] = None
    current_condition: Optional[str] = None
    current_assessed_value: Optional[Decimal] = None

    # Interim
    interim_monthly_revenue: Optional[Decimal] = None
    interim_monthly_expenses: Optional[Decimal] = None
    interim_occupancy_percent: Optional[Decimal] = None
    interim_hold_months: Optional[int] = None

    # Redevelopment
    planned_units: Optional[int] = None
    planned_beds: Optional[int] = None
    planned_sqft: Optional[Decimal] = None
    construction_budget: Optional[Decimal] = None
    hard_costs: Optional[Decimal] = None
    soft_costs: Optional[Decimal] = None
    contingency_percent: Optional[Decimal] = None
    construction_duration_months: Optional[int] = None

    # Stabilized
    stabilized_monthly_revenue: Optional[Decimal] = None
    stabilized_monthly_expenses: Optional[Decimal] = None
    stabilized_occupancy_percent: Optional[Decimal] = None
    stabilized_annual_noi: Optional[Decimal] = None
    stabilized_cap_rate: Optional[Decimal] = None
    stabilized_value: Optional[Decimal] = None

    # Debt
    assumed_ltv_percent: Optional[Decimal] = None
    assumed_interest_rate: Optional[Decimal] = None
    assumed_amortization_months: Optional[int] = None
    assumed_debt_amount: Optional[Decimal] = None

    # Timing
    target_acquisition_date: Optional[date] = None
    target_completion_date: Optional[date] = None
    target_stabilization_date: Optional[date] = None

    converted_property_id: Optional[int] = None
    notes: Optional[str] = None


class TargetPropertyCreate(TargetPropertyBase):
    lp_id: int


class TargetPropertyUpdate(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    intended_community: Optional[str] = None
    status: Optional[str] = None
    estimated_acquisition_price: Optional[Decimal] = None
    lot_size: Optional[Decimal] = None
    zoning: Optional[str] = None
    current_sqft: Optional[Decimal] = None
    current_bedrooms: Optional[int] = None
    current_bathrooms: Optional[int] = None
    current_condition: Optional[str] = None
    current_assessed_value: Optional[Decimal] = None
    interim_monthly_revenue: Optional[Decimal] = None
    interim_monthly_expenses: Optional[Decimal] = None
    interim_occupancy_percent: Optional[Decimal] = None
    interim_hold_months: Optional[int] = None
    planned_units: Optional[int] = None
    planned_beds: Optional[int] = None
    planned_sqft: Optional[Decimal] = None
    construction_budget: Optional[Decimal] = None
    hard_costs: Optional[Decimal] = None
    soft_costs: Optional[Decimal] = None
    contingency_percent: Optional[Decimal] = None
    construction_duration_months: Optional[int] = None
    stabilized_monthly_revenue: Optional[Decimal] = None
    stabilized_monthly_expenses: Optional[Decimal] = None
    stabilized_occupancy_percent: Optional[Decimal] = None
    stabilized_annual_noi: Optional[Decimal] = None
    stabilized_cap_rate: Optional[Decimal] = None
    stabilized_value: Optional[Decimal] = None
    assumed_ltv_percent: Optional[Decimal] = None
    assumed_interest_rate: Optional[Decimal] = None
    assumed_amortization_months: Optional[int] = None
    assumed_debt_amount: Optional[Decimal] = None
    target_acquisition_date: Optional[date] = None
    target_completion_date: Optional[date] = None
    target_stabilization_date: Optional[date] = None
    converted_property_id: Optional[int] = None
    notes: Optional[str] = None


class TargetPropertyOut(TargetPropertyBase):
    target_property_id: int
    lp_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# LP Portfolio Roll-up (computed, not stored)
# ---------------------------------------------------------------------------

class LPPortfolioRollup(BaseModel):
    """Projected portfolio summary for an LP based on target + actual properties."""
    lp_id: int
    lp_name: str

    # Target portfolio totals
    target_property_count: int = 0
    total_target_acquisition_cost: Decimal = Decimal("0")
    total_target_construction_budget: Decimal = Decimal("0")
    total_target_all_in_cost: Decimal = Decimal("0")
    total_target_stabilized_noi: Decimal = Decimal("0")
    total_target_stabilized_value: Decimal = Decimal("0")
    total_target_debt: Decimal = Decimal("0")
    total_target_equity_required: Decimal = Decimal("0")

    # Actual portfolio totals
    actual_property_count: int = 0
    total_actual_purchase_price: Decimal = Decimal("0")
    total_actual_market_value: Decimal = Decimal("0")

    # Combined
    total_planned_units: int = 0
    total_planned_beds: int = 0

    # Projected LP returns
    projected_portfolio_value: Optional[Decimal] = None
    projected_lp_equity_value: Optional[Decimal] = None
    projected_annual_noi: Optional[Decimal] = None
    projected_cash_on_cash: Optional[Decimal] = None
    projected_equity_multiple: Optional[Decimal] = None
    projected_irr: Optional[Decimal] = None


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


# ---------------------------------------------------------------------------
# Investor (expanded)
# ---------------------------------------------------------------------------

class InvestorBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    entity_type: Optional[str] = None
    jurisdiction: Optional[str] = None
    accredited_status: str = "accredited"
    exemption_type: Optional[str] = None
    tax_id: Optional[str] = None
    banking_info: Optional[str] = None
    notes: Optional[str] = None


class InvestorCreate(InvestorBase):
    user_id: Optional[int] = None


class InvestorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    entity_type: Optional[str] = None
    jurisdiction: Optional[str] = None
    accredited_status: Optional[str] = None
    exemption_type: Optional[str] = None
    tax_id: Optional[str] = None
    banking_info: Optional[str] = None
    notes: Optional[str] = None


class InvestorOut(InvestorBase):
    investor_id: int
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# LP Fee Schedule Items
# ---------------------------------------------------------------------------

class LPFeeItemBase(BaseModel):
    fee_name: str
    fee_slug: str
    fee_type: str                                      # "percentage" or "fixed"
    rate: Optional[Decimal] = None
    fixed_amount: Optional[Decimal] = None
    basis_type: Optional[str] = None
    basis_description: Optional[str] = None
    timing_trigger: Optional[str] = None
    calculation_description: Optional[str] = None
    calculated_amount: Optional[Decimal] = None
    is_active: bool = True
    default_rate: Optional[Decimal] = None
    default_fixed_amount: Optional[Decimal] = None
    notes: Optional[str] = None


class LPFeeItemCreate(LPFeeItemBase):
    lp_id: int


class LPFeeItemUpdate(BaseModel):
    fee_name: Optional[str] = None
    fee_type: Optional[str] = None
    rate: Optional[Decimal] = None
    fixed_amount: Optional[Decimal] = None
    basis_type: Optional[str] = None
    basis_description: Optional[str] = None
    timing_trigger: Optional[str] = None
    calculation_description: Optional[str] = None
    calculated_amount: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class LPFeeItemOut(LPFeeItemBase):
    fee_item_id: int
    lp_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
