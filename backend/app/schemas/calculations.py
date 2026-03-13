from pydantic import BaseModel
from typing import Optional


class NOIInput(BaseModel):
    gross_potential_revenue: float
    vacancy_rate: float = 0.05
    operating_expenses: float = 0.0
    property_tax: float = 0.0
    insurance: float = 0.0
    management_fee_rate: float = 0.04
    replacement_reserves: float = 0.0


class NOIResult(BaseModel):
    gross_potential_revenue: float
    vacancy_loss: float
    vacancy_rate: float
    effective_gross_income: float
    operating_expenses: float
    property_tax: float
    insurance: float
    management_fee: float
    management_fee_rate: float
    replacement_reserves: float
    total_expenses: float
    noi: float


class DSCRInput(BaseModel):
    noi: float
    annual_debt_service: float


class DSCRResult(BaseModel):
    noi: float
    annual_debt_service: float
    dscr: Optional[float]
    health: str
    message: str


class LTVInput(BaseModel):
    outstanding_debt: float
    property_value: float


class LTVResult(BaseModel):
    outstanding_debt: float
    property_value: float
    ltv_percent: Optional[float]
    equity_percent: Optional[float] = None
    equity_value: Optional[float] = None
    risk: str
    message: str


class IRRInput(BaseModel):
    cash_flows: list[float]


class IRRResult(BaseModel):
    irr_decimal: Optional[float]
    irr_percent: Optional[float]
    cash_flows: list[float]
    message: str


class PropertyFinancialSummary(BaseModel):
    property_id: int
    property_name: str
    noi: Optional[NOIResult] = None
    dscr: Optional[DSCRResult] = None
    ltv: Optional[LTVResult] = None
    cap_rate_percent: Optional[float] = None
    cash_on_cash_percent: Optional[float] = None
    total_debt_outstanding: float = 0.0
    total_equity: float = 0.0
    annual_debt_service: float = 0.0
