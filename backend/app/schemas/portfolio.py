"""
Pydantic schemas for the Portfolio domain: Properties, Clusters,
Development Plans, and Financial Modeling.
"""
import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel
from app.db.models import DevelopmentStage, RentPricingMode


# ---------------------------------------------------------------------------
# Property Cluster
# ---------------------------------------------------------------------------

class PropertyClusterCreate(BaseModel):
    name: str
    city: str
    has_commercial_kitchen: bool = False
    kitchen_capacity_meals_per_day: int | None = None
    notes: str | None = None


class PropertyClusterOut(BaseModel):
    cluster_id: int
    name: str
    city: str
    has_commercial_kitchen: bool
    kitchen_capacity_meals_per_day: int | None
    notes: str | None
    property_count: int = 0

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Property
# ---------------------------------------------------------------------------

class PropertyCreate(BaseModel):
    address: str
    city: str
    province: str
    lp_id: int | None = None
    cluster_id: int | None = None
    community_id: int | None = None
    pm_id: int | None = None
    purchase_date: datetime.date | None = None
    purchase_price: Decimal | None = None
    assessed_value: Decimal | None = None
    current_market_value: Decimal | None = None
    lot_size: Decimal | None = None
    zoning: str | None = None
    max_buildable_area: Decimal | None = None
    floor_area_ratio: Decimal | None = None
    development_stage: DevelopmentStage = DevelopmentStage.prospect
    rent_pricing_mode: RentPricingMode = RentPricingMode.by_bed
    annual_rent_increase_pct: Decimal | None = None
    annual_revenue: Decimal | None = None
    annual_expenses: Decimal | None = None
    annual_other_income: Decimal | None = None
    # Physical property details
    year_built: int | None = None
    property_type: str | None = None
    building_sqft: Decimal | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    property_style: str | None = None
    garage: str | None = None
    # Location & municipal
    neighbourhood: str | None = None
    ward: str | None = None
    legal_description: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    roll_number: str | None = None
    assessment_class: str | None = None
    # Tax
    tax_amount: Decimal | None = None
    tax_year: int | None = None
    # MLS / market
    mls_number: str | None = None
    list_price: Decimal | None = None
    last_sold_price: Decimal | None = None
    last_sold_date: datetime.date | None = None


class PropertyUpdate(BaseModel):
    address: str | None = None
    city: str | None = None
    province: str | None = None
    lp_id: int | None = None
    cluster_id: int | None = None
    community_id: int | None = None
    pm_id: int | None = None
    purchase_date: datetime.date | None = None
    purchase_price: Decimal | None = None
    assessed_value: Decimal | None = None
    current_market_value: Decimal | None = None
    lot_size: Decimal | None = None
    zoning: str | None = None
    max_buildable_area: Decimal | None = None
    floor_area_ratio: Decimal | None = None
    development_stage: DevelopmentStage | None = None
    rent_pricing_mode: RentPricingMode | None = None
    annual_rent_increase_pct: Decimal | None = None
    annual_revenue: Decimal | None = None
    annual_expenses: Decimal | None = None
    annual_other_income: Decimal | None = None
    year_built: int | None = None
    property_type: str | None = None
    building_sqft: Decimal | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    property_style: str | None = None
    garage: str | None = None
    neighbourhood: str | None = None
    ward: str | None = None
    legal_description: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    roll_number: str | None = None
    assessment_class: str | None = None
    tax_amount: Decimal | None = None
    tax_year: int | None = None
    mls_number: str | None = None
    list_price: Decimal | None = None
    last_sold_price: Decimal | None = None
    last_sold_date: datetime.date | None = None


class PropertyOut(BaseModel):
    property_id: int
    address: str
    city: str
    province: str
    lp_id: int | None
    lp_name: str | None = None
    cluster_id: int | None
    community_id: int | None = None
    community_name: str | None = None
    pm_id: int | None = None
    pm_name: str | None = None
    purchase_date: datetime.date | None
    purchase_price: Decimal | None
    assessed_value: Decimal | None
    current_market_value: Decimal | None
    lot_size: Decimal | None
    zoning: str | None
    max_buildable_area: Decimal | None
    floor_area_ratio: Decimal | None
    development_stage: DevelopmentStage
    rent_pricing_mode: RentPricingMode = RentPricingMode.by_bed
    annual_rent_increase_pct: Decimal | None = None
    annual_revenue: Decimal | None = None
    annual_expenses: Decimal | None = None
    annual_other_income: Decimal | None = None
    # Physical property details
    year_built: int | None = None
    property_type: str | None = None
    building_sqft: Decimal | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    property_style: str | None = None
    garage: str | None = None
    # Location & municipal
    neighbourhood: str | None = None
    ward: str | None = None
    legal_description: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    roll_number: str | None = None
    assessment_class: str | None = None
    # Tax
    tax_amount: Decimal | None = None
    tax_year: int | None = None
    # MLS / market
    mls_number: str | None = None
    list_price: Decimal | None = None
    last_sold_price: Decimal | None = None
    last_sold_date: datetime.date | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Development Plan
# ---------------------------------------------------------------------------

class DevelopmentPlanCreate(BaseModel):
    version: int = 1
    plan_name: str | None = None
    status: str = "draft"
    planned_units: int
    planned_beds: int
    planned_sqft: Decimal
    hard_costs: Decimal | None = None
    soft_costs: Decimal | None = None
    site_costs: Decimal | None = None
    financing_costs: Decimal | None = None
    contingency_percent: Decimal | None = None
    cost_escalation_percent_per_year: Decimal | None = None
    cost_per_sqft: Decimal | None = None
    estimated_construction_cost: Decimal
    projected_annual_revenue: Decimal | None = None
    projected_annual_noi: Decimal | None = None
    development_start_date: datetime.date | None = None
    construction_duration_days: int | None = None
    estimated_completion_date: datetime.date | None = None
    estimated_stabilization_date: datetime.date | None = None
    rent_pricing_mode: str | None = None
    annual_rent_increase_pct: Decimal | None = None


class DevelopmentPlanUpdate(BaseModel):
    """All fields optional — only supplied fields are updated."""
    plan_name: str | None = None
    version: int | None = None
    status: str | None = None
    planned_units: int | None = None
    planned_beds: int | None = None
    planned_sqft: Decimal | None = None
    hard_costs: Decimal | None = None
    soft_costs: Decimal | None = None
    site_costs: Decimal | None = None
    financing_costs: Decimal | None = None
    contingency_percent: Decimal | None = None
    cost_escalation_percent_per_year: Decimal | None = None
    cost_per_sqft: Decimal | None = None
    estimated_construction_cost: Decimal | None = None
    projected_annual_revenue: Decimal | None = None
    projected_annual_noi: Decimal | None = None
    development_start_date: datetime.date | None = None
    construction_duration_days: int | None = None
    estimated_completion_date: datetime.date | None = None
    estimated_stabilization_date: datetime.date | None = None
    rent_pricing_mode: str | None = None
    annual_rent_increase_pct: Decimal | None = None


class DevelopmentPlanOut(BaseModel):
    plan_id: int
    property_id: int
    plan_name: str | None = None
    version: int
    status: str
    planned_units: int
    planned_beds: int
    planned_sqft: Decimal
    hard_costs: Decimal | None
    soft_costs: Decimal | None
    site_costs: Decimal | None
    financing_costs: Decimal | None
    contingency_percent: Decimal | None
    cost_escalation_percent_per_year: Decimal | None
    cost_per_sqft: Decimal | None
    estimated_construction_cost: Decimal
    projected_annual_revenue: Decimal | None
    projected_annual_noi: Decimal | None
    development_start_date: datetime.date | None
    construction_duration_days: int | None
    estimated_completion_date: datetime.date | None
    estimated_stabilization_date: datetime.date | None
    rent_pricing_mode: str | None = None
    annual_rent_increase_pct: Decimal | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Financial Modeling
# ---------------------------------------------------------------------------

class ModelingInput(BaseModel):
    purchase_price: Decimal
    construction_cost: Decimal
    annual_revenue: Decimal
    annual_expenses: Decimal
    hold_period_years: int = 5
    exit_cap_rate: Decimal = Decimal("0.05")


class ModelingResult(BaseModel):
    construction_costs: Decimal
    noi: Decimal
    cap_rate: Decimal
    irr: Decimal


# ---------------------------------------------------------------------------
# Cost Estimation Engine
# ---------------------------------------------------------------------------

class CostEstimateInput(BaseModel):
    planned_sqft: Decimal
    building_type: str = "multiplex_standard"
    include_commercial_kitchen: bool = False
    soft_cost_percent: Decimal = Decimal("20.00")
    site_cost_flat: Decimal = Decimal("75000.00")
    financing_cost_percent: Decimal = Decimal("5.00")
    contingency_percent: Decimal = Decimal("10.00")
    escalation_percent_per_year: Decimal = Decimal("4.00")
    target_start_date: datetime.date | None = None


class CostEstimateResult(BaseModel):
    hard_costs: Decimal
    soft_costs: Decimal
    site_costs: Decimal
    financing_costs: Decimal
    contingency: Decimal
    total_current_cost: Decimal
    escalation_amount: Decimal
    total_escalated_cost: Decimal
    effective_cost_per_sqft: Decimal


# ---------------------------------------------------------------------------
# Debt Facility
# ---------------------------------------------------------------------------

class DebtFacilityCreate(BaseModel):
    property_id: int
    lender_name: str
    debt_type: str
    commitment_amount: float
    interest_rate: float | None = None
    rate_type: str = "fixed"
    term_months: int | None = None
    amortization_months: int | None = None
    io_period_months: int = 0
    origination_date: str | None = None
    maturity_date: str | None = None
    ltv_covenant: float | None = None
    dscr_covenant: float | None = None
    debt_purpose: str = "acquisition"  # acquisition, construction, refinancing
    replaces_debt_id: int | None = None  # links refinancing to original debt
    development_plan_id: int | None = None  # NULL = baseline, set = plan-specific
    # CMHC / Insured Mortgage Fields
    is_cmhc_insured: bool = False
    cmhc_insurance_premium_pct: float | None = None
    cmhc_application_fee: float | None = None
    cmhc_program: str | None = None  # "MLI Select", "Standard", "Flex"
    compounding_method: str = "semi_annual"  # semi_annual (Canadian std), monthly, annual
    lender_fee_pct: float | None = None
    notes: str | None = None

class DebtFacilityOut(BaseModel):
    debt_id: int
    property_id: int
    lender_name: str
    debt_type: str
    status: str
    commitment_amount: float
    drawn_amount: float
    outstanding_balance: float
    interest_rate: float | None
    rate_type: str
    term_months: int | None
    amortization_months: int | None
    io_period_months: int
    origination_date: datetime.date | None
    maturity_date: datetime.date | None
    ltv_covenant: float | None
    dscr_covenant: float | None
    debt_purpose: str = "acquisition"
    replaces_debt_id: int | None = None
    development_plan_id: int | None = None
    # CMHC / Insured Mortgage Fields
    is_cmhc_insured: bool = False
    cmhc_insurance_premium_pct: float | None = None
    cmhc_insurance_premium_amount: float | None = None
    cmhc_application_fee: float | None = None
    cmhc_program: str | None = None
    compounding_method: str = "semi_annual"
    lender_fee_pct: float | None = None
    lender_fee_amount: float | None = None
    capitalized_fees: float | None = None
    notes: str | None
    created_at: datetime.datetime | None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Refinance Scenario
# ---------------------------------------------------------------------------

class RefinanceScenarioCreate(BaseModel):
    label: str = "Refinance Scenario"
    assumed_new_valuation: float
    new_ltv_percent: float
    new_interest_rate: float | None = None
    new_amortization_months: int | None = None
    existing_debt_payout: float | None = None
    closing_costs: float = 0.0
    notes: str | None = None
    # Date & event linkage
    expected_date: datetime.date | None = None
    linked_milestone_id: int | None = None
    linked_event: str | None = None  # e.g. "construction_completion", "stabilization"
    # ROI inputs
    total_equity_invested: float | None = None
    annual_noi_at_refi: float | None = None
    hold_period_months: int | None = None


class RefinanceScenarioOut(RefinanceScenarioCreate):
    scenario_id: int
    property_id: int
    # Computed fields
    new_loan_amount: float
    net_proceeds: float
    created_at: datetime.datetime | None = None
    # Computed ROI metrics
    equity_multiple: float | None = None  # (net_proceeds + equity) / equity
    cash_on_cash_return: float | None = None  # annual NOI / equity
    annualized_roi: float | None = None  # annualized return over hold period
    linked_milestone_title: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Sale Scenario
# ---------------------------------------------------------------------------

class SaleScenarioCreate(BaseModel):
    label: str = "Sale Scenario"
    assumed_sale_price: float
    selling_costs_percent: float = 5.0
    debt_payout: float | None = None
    capital_gains_reserve: float = 0.0
    notes: str | None = None
    # Date & event linkage
    expected_date: datetime.date | None = None
    linked_milestone_id: int | None = None
    linked_event: str | None = None  # e.g. "stabilization", "lease_up_complete"
    # ROI inputs
    total_equity_invested: float | None = None
    annual_noi_at_sale: float | None = None
    hold_period_months: int | None = None
    annual_cash_flow: float | None = None  # avg annual cash flow during hold


class SaleScenarioOut(SaleScenarioCreate):
    scenario_id: int
    property_id: int
    # Computed fields
    selling_costs: float
    net_proceeds: float
    created_at: datetime.datetime | None = None
    # Computed ROI metrics
    total_return: float | None = None  # net_proceeds + cumulative cash flow - equity
    equity_multiple: float | None = None  # (net_proceeds + cumulative_cf) / equity
    irr_estimate: float | None = None  # simplified annualized IRR
    cash_on_cash_return: float | None = None  # annual cash flow / equity
    cap_rate: float | None = None  # NOI / sale price
    linked_milestone_title: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Valuation History
# ---------------------------------------------------------------------------

class ValuationCreate(BaseModel):
    valuation_date: datetime.date
    value: Decimal
    method: str = "internal_estimate"
    appraiser: str | None = None
    notes: str | None = None
    document_url: str | None = None


class ValuationOut(BaseModel):
    valuation_id: int
    property_id: int
    valuation_date: datetime.date
    value: Decimal
    method: str
    appraiser: str | None
    notes: str | None
    document_url: str | None
    created_by: int | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Cap Rate Valuation Calculator
# ---------------------------------------------------------------------------

class CapRateValuationInput(BaseModel):
    noi: Decimal
    cap_rate: Decimal  # as percentage, e.g. 5.5 = 5.5%


class CapRateValuationResult(BaseModel):
    noi: Decimal
    cap_rate: Decimal
    estimated_value: Decimal
    value_per_unit: Decimal | None = None
    value_per_sqft: Decimal | None = None


# ---------------------------------------------------------------------------
# Construction Budget vs Actual
# ---------------------------------------------------------------------------

class ConstructionExpenseCreate(BaseModel):
    plan_id: int
    category: str
    description: str | None = None
    budgeted_amount: Decimal = Decimal("0")
    actual_amount: Decimal = Decimal("0")
    vendor: str | None = None
    invoice_ref: str | None = None
    expense_date: datetime.date | None = None
    notes: str | None = None


class ConstructionExpenseOut(BaseModel):
    expense_id: int
    property_id: int
    plan_id: int
    category: str
    description: str | None
    budgeted_amount: Decimal
    actual_amount: Decimal
    vendor: str | None
    invoice_ref: str | None
    expense_date: datetime.date | None
    notes: str | None
    created_at: datetime.datetime | None

    model_config = {"from_attributes": True}


class ConstructionBudgetSummary(BaseModel):
    property_id: int
    plan_id: int
    line_items: list[ConstructionExpenseOut]
    total_budgeted: Decimal
    total_actual: Decimal
    total_variance: Decimal
    by_category: dict[str, dict]


# ---------------------------------------------------------------------------
# Construction Draw Schedule
# ---------------------------------------------------------------------------

class ConstructionDrawCreate(BaseModel):
    debt_id: int
    draw_number: int
    requested_amount: Decimal
    description: str | None = None
    requested_date: datetime.date | None = None
    notes: str | None = None


class ConstructionDrawOut(BaseModel):
    draw_id: int
    property_id: int
    debt_id: int
    draw_number: int
    requested_amount: Decimal
    approved_amount: Decimal | None
    status: str
    description: str | None
    requested_date: datetime.date | None
    approved_date: datetime.date | None
    funded_date: datetime.date | None
    notes: str | None
    created_at: datetime.datetime | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Ancillary Revenue Streams
# ---------------------------------------------------------------------------

class AncillaryRevenueStreamCreate(BaseModel):
    stream_type: str  # parking, pet_fee, storage, bike, laundry, other
    description: str | None = None
    total_count: int = 0
    utilization_pct: Decimal = Decimal("100")
    monthly_rate: Decimal = Decimal("0")
    annual_escalation_pct: Decimal = Decimal("0")
    development_plan_id: int | None = None
    notes: str | None = None


class AncillaryRevenueStreamUpdate(BaseModel):
    stream_type: str | None = None
    description: str | None = None
    total_count: int | None = None
    utilization_pct: Decimal | None = None
    monthly_rate: Decimal | None = None
    annual_escalation_pct: Decimal | None = None
    development_plan_id: int | None = None
    notes: str | None = None


class AncillaryRevenueStreamOut(BaseModel):
    stream_id: int
    property_id: int
    development_plan_id: int | None
    stream_type: str
    description: str | None
    total_count: int
    utilization_pct: Decimal
    monthly_rate: Decimal
    annual_escalation_pct: Decimal | None
    notes: str | None
    # Computed fields (not stored, calculated on read)
    monthly_revenue: Decimal | None = None
    annual_revenue: Decimal | None = None
    created_at: datetime.datetime | None
    updated_at: datetime.datetime | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Operating Expense Line Items
# ---------------------------------------------------------------------------

class OperatingExpenseLineItemCreate(BaseModel):
    category: str  # property_tax, insurance, utilities, salaries, management_fee, repairs_maintenance, miscellaneous, reserves, elevator, premium_services, other
    description: str | None = None
    calc_method: str = "per_unit"  # fixed, per_unit, pct_egi
    base_amount: Decimal = Decimal("0")
    annual_escalation_pct: Decimal = Decimal("3")
    development_plan_id: int | None = None
    notes: str | None = None


class OperatingExpenseLineItemUpdate(BaseModel):
    category: str | None = None
    description: str | None = None
    calc_method: str | None = None
    base_amount: Decimal | None = None
    annual_escalation_pct: Decimal | None = None
    development_plan_id: int | None = None
    notes: str | None = None


class OperatingExpenseLineItemOut(BaseModel):
    expense_item_id: int
    property_id: int
    development_plan_id: int | None
    category: str
    description: str | None
    calc_method: str
    base_amount: Decimal
    annual_escalation_pct: Decimal
    notes: str | None
    # Computed fields
    computed_annual_amount: Decimal | None = None
    created_at: datetime.datetime | None
    updated_at: datetime.datetime | None

    model_config = {"from_attributes": True}


class OperatingExpenseSummary(BaseModel):
    property_id: int
    plan_id: int | None
    total_units: int
    egi: Decimal
    total_annual_expenses: Decimal
    expense_ratio: Decimal  # total_annual_expenses / EGI * 100
    items: list[OperatingExpenseLineItemOut]
