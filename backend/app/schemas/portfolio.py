"""
Pydantic schemas for the Portfolio domain: Properties, Clusters,
Development Plans, and Financial Modeling.
"""
import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel
from app.db.models import DevelopmentStage


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

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Development Plan
# ---------------------------------------------------------------------------

class DevelopmentPlanCreate(BaseModel):
    version: int = 1
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


class DevelopmentPlanOut(BaseModel):
    plan_id: int
    property_id: int
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


class RefinanceScenarioOut(RefinanceScenarioCreate):
    scenario_id: int
    property_id: int
    # Computed fields
    new_loan_amount: float
    net_proceeds: float
    created_at: datetime.datetime | None = None

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


class SaleScenarioOut(SaleScenarioCreate):
    scenario_id: int
    property_id: int
    # Computed fields
    selling_costs: float
    net_proceeds: float
    created_at: datetime.datetime | None = None

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
