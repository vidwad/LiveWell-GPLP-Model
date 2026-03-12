import datetime
from decimal import Decimal

from pydantic import BaseModel
from app.db.models import (
    BedStatus, CommunityType, MaintenanceStatus, PaymentStatus, RentType, UnitType,
)


# ---------------------------------------------------------------------------
# Community
# ---------------------------------------------------------------------------

class CommunityCreate(BaseModel):
    property_id: int
    community_type: CommunityType
    name: str
    has_meal_plan: bool = False
    meal_plan_monthly_cost: Decimal | None = None


class CommunityOut(BaseModel):
    community_id: int
    property_id: int
    community_type: CommunityType
    name: str
    has_meal_plan: bool
    meal_plan_monthly_cost: Decimal | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Unit
# ---------------------------------------------------------------------------

class UnitCreate(BaseModel):
    unit_number: str
    unit_type: UnitType
    bed_count: int
    sqft: Decimal


class UnitOut(BaseModel):
    unit_id: int
    community_id: int
    unit_number: str
    unit_type: UnitType
    bed_count: int
    sqft: Decimal
    is_occupied: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Bed
# ---------------------------------------------------------------------------

class BedCreate(BaseModel):
    unit_id: int
    bed_label: str
    monthly_rent: Decimal
    rent_type: RentType = RentType.private_pay


class BedOut(BaseModel):
    bed_id: int
    unit_id: int
    bed_label: str
    monthly_rent: Decimal
    rent_type: RentType
    status: BedStatus

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Resident
# ---------------------------------------------------------------------------

class ResidentCreate(BaseModel):
    unit_id: int
    bed_id: int | None = None
    full_name: str
    email: str | None = None
    phone: str | None = None
    bed_number: str
    rent_type: RentType
    move_in_date: datetime.date
    move_out_date: datetime.date | None = None
    enrolled_meal_plan: bool = False


class ResidentOut(BaseModel):
    resident_id: int
    community_id: int
    unit_id: int
    bed_id: int | None
    full_name: str
    email: str | None
    phone: str | None
    bed_number: str
    rent_type: RentType
    move_in_date: datetime.date
    move_out_date: datetime.date | None
    enrolled_meal_plan: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Maintenance Request
# ---------------------------------------------------------------------------

class MaintenanceRequestCreate(BaseModel):
    property_id: int
    resident_id: int | None = None
    description: str


class MaintenanceRequestUpdate(BaseModel):
    status: MaintenanceStatus
    resolved_at: datetime.datetime | None = None


class MaintenanceRequestOut(BaseModel):
    request_id: int
    property_id: int
    resident_id: int | None
    description: str
    status: MaintenanceStatus
    created_at: datetime.datetime
    resolved_at: datetime.datetime | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Rent Payment
# ---------------------------------------------------------------------------

class RentPaymentCreate(BaseModel):
    amount: Decimal
    payment_date: datetime.datetime
    period_month: int
    period_year: int
    bed_id: int | None = None
    includes_meal_plan: bool = False


class RentPaymentOut(BaseModel):
    payment_id: int
    resident_id: int
    bed_id: int | None
    amount: Decimal
    payment_date: datetime.datetime
    period_month: int
    period_year: int
    status: PaymentStatus
    includes_meal_plan: bool

    model_config = {"from_attributes": True}
