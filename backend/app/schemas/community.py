import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel
from app.db.models import (
    BedStatus, CommunityType, MaintenanceStatus, PaymentStatus, RentType,
    RenovationPhase, UnitType,
)


# ---------------------------------------------------------------------------
# Community
# ---------------------------------------------------------------------------

class CommunityCreate(BaseModel):
    community_type: CommunityType
    name: str
    city: str
    province: str = "Alberta"
    operator_id: Optional[int] = None
    has_meal_plan: bool = False
    meal_plan_monthly_cost: Optional[Decimal] = None
    target_occupancy_percent: Optional[Decimal] = None
    description: Optional[str] = None


class CommunityUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    community_type: Optional[CommunityType] = None
    operator_id: Optional[int] = None
    has_meal_plan: Optional[bool] = None
    meal_plan_monthly_cost: Optional[Decimal] = None
    target_occupancy_percent: Optional[Decimal] = None
    description: Optional[str] = None


class CommunityOut(BaseModel):
    community_id: int
    community_type: CommunityType
    name: str
    city: str
    province: str
    operator_id: Optional[int] = None
    has_meal_plan: bool
    meal_plan_monthly_cost: Optional[Decimal] = None
    target_occupancy_percent: Optional[Decimal] = None
    description: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Unit
# ---------------------------------------------------------------------------

class UnitCreate(BaseModel):
    unit_number: str
    unit_type: UnitType
    bed_count: int
    sqft: Decimal
    floor: Optional[str] = None
    is_legal_suite: bool = False
    notes: Optional[str] = None
    community_id: Optional[int] = None  # optional operational grouping
    monthly_rent: Optional[Decimal] = None  # for by_unit pricing
    bedroom_count: Optional[int] = None  # for by_bedroom pricing
    renovation_phase: RenovationPhase = RenovationPhase.pre_renovation
    development_plan_id: Optional[int] = None  # NULL = baseline, set = plan-specific


class UnitUpdate(BaseModel):
    unit_number: Optional[str] = None
    unit_type: Optional[UnitType] = None
    bed_count: Optional[int] = None
    sqft: Optional[Decimal] = None
    floor: Optional[str] = None
    is_legal_suite: Optional[bool] = None
    is_occupied: Optional[bool] = None
    notes: Optional[str] = None
    community_id: Optional[int] = None
    monthly_rent: Optional[Decimal] = None
    bedroom_count: Optional[int] = None
    renovation_phase: Optional[RenovationPhase] = None
    development_plan_id: Optional[int] = None


class UnitOut(BaseModel):
    unit_id: int
    property_id: int
    community_id: Optional[int] = None
    unit_number: str
    unit_type: UnitType
    bed_count: int
    sqft: Decimal
    floor: Optional[str] = None
    is_legal_suite: bool
    is_occupied: bool
    notes: Optional[str] = None
    monthly_rent: Optional[Decimal] = None
    bedroom_count: Optional[int] = None
    renovation_phase: RenovationPhase = RenovationPhase.pre_renovation
    development_plan_id: Optional[int] = None

    model_config = {"from_attributes": True}


class UnitWithBedsOut(UnitOut):
    """Unit with nested bed details."""
    beds: list["BedOut"] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Bed
# ---------------------------------------------------------------------------

class BedCreate(BaseModel):
    unit_id: Optional[int] = None  # Optional: auto-set from URL path
    bed_label: str
    monthly_rent: Decimal
    rent_type: RentType = RentType.private_pay
    bedroom_number: Optional[int] = None
    is_post_renovation: bool = False
    status: Optional[str] = None  # Optional: defaults to 'available' in model


class BedOut(BaseModel):
    bed_id: int
    unit_id: int
    bed_label: str
    monthly_rent: Decimal
    rent_type: RentType
    status: BedStatus
    bedroom_number: Optional[int] = None
    is_post_renovation: bool = False

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Resident
# ---------------------------------------------------------------------------

class ResidentCreate(BaseModel):
    unit_id: int
    bed_id: Optional[int] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    bed_number: str
    rent_type: RentType
    move_in_date: datetime.date
    move_out_date: Optional[datetime.date] = None
    enrolled_meal_plan: bool = False


class ResidentOut(BaseModel):
    resident_id: int
    community_id: int
    unit_id: int
    bed_id: Optional[int] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    bed_number: str
    rent_type: RentType
    move_in_date: datetime.date
    move_out_date: Optional[datetime.date] = None
    enrolled_meal_plan: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Maintenance Request
# ---------------------------------------------------------------------------

class MaintenanceRequestCreate(BaseModel):
    property_id: int
    resident_id: Optional[int] = None
    description: str


class MaintenanceRequestUpdate(BaseModel):
    status: MaintenanceStatus
    resolved_at: Optional[datetime.datetime] = None


class MaintenanceRequestOut(BaseModel):
    request_id: int
    property_id: int
    resident_id: Optional[int] = None
    description: str
    status: MaintenanceStatus
    created_at: datetime.datetime
    resolved_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Rent Payment
# ---------------------------------------------------------------------------

class RentPaymentCreate(BaseModel):
    amount: Decimal
    payment_date: datetime.datetime
    period_month: int
    period_year: int
    bed_id: Optional[int] = None
    includes_meal_plan: bool = False


class RentPaymentOut(BaseModel):
    payment_id: int
    resident_id: int
    bed_id: Optional[int] = None
    amount: Decimal
    payment_date: datetime.datetime
    period_month: int
    period_year: int
    status: PaymentStatus
    includes_meal_plan: bool

    model_config = {"from_attributes": True}
