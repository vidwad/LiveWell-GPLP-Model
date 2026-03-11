import datetime
from decimal import Decimal

from pydantic import BaseModel
from app.db.models import DevelopmentStage


class PropertyCreate(BaseModel):
    address: str
    city: str
    province: str
    purchase_date: datetime.date
    purchase_price: Decimal
    lot_size: Decimal | None = None
    zoning: str | None = None
    max_buildable_area: Decimal | None = None
    development_stage: DevelopmentStage = DevelopmentStage.acquisition


class PropertyUpdate(BaseModel):
    address: str | None = None
    city: str | None = None
    province: str | None = None
    purchase_date: datetime.date | None = None
    purchase_price: Decimal | None = None
    lot_size: Decimal | None = None
    zoning: str | None = None
    max_buildable_area: Decimal | None = None
    development_stage: DevelopmentStage | None = None


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
    development_stage: DevelopmentStage

    model_config = {"from_attributes": True}


class DevelopmentPlanCreate(BaseModel):
    planned_units: int
    planned_beds: int
    planned_sqft: Decimal
    estimated_construction_cost: Decimal
    development_start_date: datetime.date
    construction_duration_days: int


class DevelopmentPlanOut(BaseModel):
    plan_id: int
    property_id: int
    planned_units: int
    planned_beds: int
    planned_sqft: Decimal
    estimated_construction_cost: Decimal
    development_start_date: datetime.date
    construction_duration_days: int

    model_config = {"from_attributes": True}


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
