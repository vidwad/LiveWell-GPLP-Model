import datetime
from decimal import Decimal

from pydantic import BaseModel
from app.db.models import DevelopmentStage, EntityType




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

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Property
# ---------------------------------------------------------------------------

class PropertyCreate(BaseModel):
    address: str
    city: str
    province: str
    purchase_date: datetime.date
    purchase_price: Decimal
    lot_size: Decimal | None = None
    zoning: str | None = None
    max_buildable_area: Decimal | None = None
    floor_area_ratio: Decimal | None = None
    development_stage: DevelopmentStage = DevelopmentStage.acquisition
    cluster_id: int | None = None


class PropertyUpdate(BaseModel):
    address: str | None = None
    city: str | None = None
    province: str | None = None
    purchase_date: datetime.date | None = None
    purchase_price: Decimal | None = None
    lot_size: Decimal | None = None
    zoning: str | None = None
    max_buildable_area: Decimal | None = None
    floor_area_ratio: Decimal | None = None
    development_stage: DevelopmentStage | None = None
    cluster_id: int | None = None


class PropertyOut(BaseModel):
    property_id: int
    address: str
    city: str
    province: str
    purchase_date: datetime.date
    purchase_price: Decimal
    lot_size: Decimal | None
    zoning: str | None
    max_buildable_area: Decimal | None
    floor_area_ratio: Decimal | None
    development_stage: DevelopmentStage
    cluster_id: int | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Development Plan
# ---------------------------------------------------------------------------

class DevelopmentPlanCreate(BaseModel):
    version: int = 1
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
    development_start_date: datetime.date
    construction_duration_days: int
    estimated_completion_date: datetime.date | None = None


class DevelopmentPlanOut(BaseModel):
    plan_id: int
    property_id: int
    version: int
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
    development_start_date: datetime.date
    construction_duration_days: int
    estimated_completion_date: datetime.date | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Economic Entity
# ---------------------------------------------------------------------------

class EconomicEntityCreate(BaseModel):
    entity_type: EntityType
    legal_name: str
    description: str | None = None
    revenue_share_percent: Decimal | None = None


class EconomicEntityOut(BaseModel):
    entity_id: int
    property_id: int
    entity_type: EntityType
    legal_name: str
    description: str | None
    revenue_share_percent: Decimal | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Financial Modeling (unchanged interface, will be enhanced in Sprint 2)
# ---------------------------------------------------------------------------

class ModelingInput(BaseModel):
    unit_count: int
    avg_cost_per_unit: Decimal
    rent_income: Decimal
    other_income: Decimal
    operating_expenses: Decimal
    market_value: Decimal
    cash_flows: list[Decimal]


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
    building_type: str = "multiplex_standard"  # multiplex_standard, multiplex_premium, shared_housing
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
