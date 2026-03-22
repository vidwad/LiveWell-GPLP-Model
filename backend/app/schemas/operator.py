"""
Schemas for Staffing & Scheduling (operator domain).
"""
import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


# ── Staff ────────────────────────────────────────────────────────────

class StaffCreate(BaseModel):
    community_id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str = "support_worker"
    status: str = "active"
    hourly_rate: Optional[Decimal] = None
    hire_date: Optional[datetime.date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None


class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    hourly_rate: Optional[Decimal] = None
    hire_date: Optional[datetime.date] = None
    termination_date: Optional[datetime.date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None
    community_id: Optional[int] = None


class StaffOut(BaseModel):
    staff_id: int
    community_id: int
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    role: str
    status: str
    hourly_rate: Optional[Decimal]
    hire_date: Optional[datetime.date]
    termination_date: Optional[datetime.date]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    notes: Optional[str]
    created_at: Optional[datetime.datetime]

    model_config = {"from_attributes": True}


# ── Shift ────────────────────────────────────────────────────────────

class ShiftCreate(BaseModel):
    staff_id: int
    community_id: Optional[int] = None
    shift_date: datetime.date
    start_time: str  # HH:MM
    end_time: str    # HH:MM
    notes: Optional[str] = None


class ShiftUpdate(BaseModel):
    shift_date: Optional[datetime.date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    hours: Optional[Decimal] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    staff_id: Optional[int] = None


class ShiftOut(BaseModel):
    shift_id: int
    staff_id: int
    community_id: int
    shift_date: datetime.date
    start_time: str
    end_time: str
    hours: Optional[Decimal]
    status: str
    notes: Optional[str]
    created_at: Optional[datetime.datetime]

    model_config = {"from_attributes": True}
