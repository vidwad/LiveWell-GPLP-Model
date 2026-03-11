import datetime
from decimal import Decimal

from pydantic import BaseModel
from app.db.models import CommunityType, UnitType, RentType, MaintenanceStatus, PaymentStatus


class CommunityCreate(BaseModel):
    property_id: int
    community_type: CommunityType
    name: str


class CommunityOut(BaseModel):
    community_id: int
    property_id: int
    community_type: CommunityType
    name: str

    model_config = {"from_attributes": True}


class UnitCreate(BaseModel):
    unit_number: str
    unit_type: UnitType
    bed_count: int
    sqft: Decimal
    monthly_rent: Decimal


class UnitOut(BaseModel):
    unit_id: int
    community_id: int
    unit_number: str
    unit_type: UnitType
    bed_count: int
    sqft: Decimal
    monthly_rent: Decimal
    is_occupied: bool

    model_config = {"from_attributes": True}


class ResidentCreate(BaseModel):
    unit_id: int
    full_name: str
    email: str | None = None
    phone: str | None = None
    bed_number: str
    rent_type: RentType
    move_in_date: datetime.date
    move_out_date: datetime.date | None = None


class ResidentOut(BaseModel):
    resident_id: int
    community_id: int
    unit_id: int
    full_name: str
    email: str | None
    phone: str | None
    bed_number: str
    rent_type: RentType
    move_in_date: datetime.date
    move_out_date: datetime.date | None

    model_config = {"from_attributes": True}


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


class RentPaymentCreate(BaseModel):
    amount: Decimal
    payment_date: datetime.datetime
    period_month: int
    period_year: int


class RentPaymentOut(BaseModel):
    payment_id: int
    resident_id: int
    amount: Decimal
    payment_date: datetime.datetime
    period_month: int
    period_year: int
    status: PaymentStatus

    model_config = {"from_attributes": True}
