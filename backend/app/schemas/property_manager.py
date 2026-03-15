"""Pydantic schemas for PropertyManagerEntity."""
import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class PropertyManagerCreate(BaseModel):
    name: str
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    management_fee_percent: Decimal | None = None
    contract_start_date: datetime.date | None = None
    contract_end_date: datetime.date | None = None
    notes: str | None = None


class PropertyManagerUpdate(BaseModel):
    name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    management_fee_percent: Decimal | None = None
    contract_start_date: datetime.date | None = None
    contract_end_date: datetime.date | None = None
    notes: str | None = None


class PropertyManagerOut(BaseModel):
    pm_id: int
    name: str
    contact_email: str | None
    contact_phone: str | None
    address: str | None
    management_fee_percent: Decimal | None
    contract_start_date: datetime.date | None
    contract_end_date: datetime.date | None
    notes: str | None
    property_count: int = 0

    model_config = {"from_attributes": True}
