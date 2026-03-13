# Phase 2 Sprint 2: Calculation Engines — NOI, DSCR, LTV, IRR

> **Status:** Ready for Claude  
> **Depends on:** Phase 2 Sprint 1 (scope filtering + debt model)  
> **Estimated effort:** Medium-High  

## Overview

With the debt model in place, we can now build the core financial calculation engines that power the platform's analytics. This sprint adds:

1. **NOI Calculator** — Net Operating Income from property revenue and expenses
2. **DSCR Calculator** — Debt Service Coverage Ratio using NOI and debt payments
3. **LTV Calculator** — Loan-to-Value using outstanding debt and property valuation
4. **IRR Calculator** — Internal Rate of Return for LP investments
5. **Property Financial Summary endpoint** — Aggregates all calculations for a property

---

## Section A — Calculation Engine Service

### File: `backend/app/services/calculations.py` (NEW FILE)

```python
"""
Living Well Communities — Financial Calculation Engines
=======================================================
Pure functions that compute key real estate financial metrics.
All inputs are plain Python types; no database dependencies.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import math


def calculate_noi(
    gross_potential_revenue: float,
    vacancy_rate: float = 0.05,
    operating_expenses: float = 0.0,
    property_tax: float = 0.0,
    insurance: float = 0.0,
    management_fee_rate: float = 0.04,
    replacement_reserves: float = 0.0,
) -> dict:
    """
    Calculate Net Operating Income.

    Args:
        gross_potential_revenue: Total annual revenue if 100% occupied
        vacancy_rate: Expected vacancy as decimal (0.05 = 5%)
        operating_expenses: Annual operating expenses (utilities, repairs, etc.)
        property_tax: Annual property tax
        insurance: Annual insurance premium
        management_fee_rate: Management fee as % of effective gross income
        replacement_reserves: Annual capital reserve allocation

    Returns:
        Dict with line-item breakdown and final NOI
    """
    vacancy_loss = gross_potential_revenue * vacancy_rate
    effective_gross_income = gross_potential_revenue - vacancy_loss
    management_fee = effective_gross_income * management_fee_rate

    total_expenses = (
        operating_expenses
        + property_tax
        + insurance
        + management_fee
        + replacement_reserves
    )

    noi = effective_gross_income - total_expenses

    return {
        "gross_potential_revenue": round(gross_potential_revenue, 2),
        "vacancy_loss": round(vacancy_loss, 2),
        "vacancy_rate": round(vacancy_rate, 4),
        "effective_gross_income": round(effective_gross_income, 2),
        "operating_expenses": round(operating_expenses, 2),
        "property_tax": round(property_tax, 2),
        "insurance": round(insurance, 2),
        "management_fee": round(management_fee, 2),
        "management_fee_rate": round(management_fee_rate, 4),
        "replacement_reserves": round(replacement_reserves, 2),
        "total_expenses": round(total_expenses, 2),
        "noi": round(noi, 2),
    }


def calculate_dscr(
    noi: float,
    annual_debt_service: float,
) -> dict:
    """
    Calculate Debt Service Coverage Ratio.

    DSCR = NOI / Annual Debt Service
    - Above 1.25 is generally healthy
    - Below 1.0 means the property cannot cover its debt payments

    Args:
        noi: Net Operating Income (annual)
        annual_debt_service: Total annual debt payments (P&I)

    Returns:
        Dict with DSCR value and health assessment
    """
    if annual_debt_service <= 0:
        return {
            "noi": round(noi, 2),
            "annual_debt_service": 0.0,
            "dscr": None,
            "health": "no_debt",
            "message": "No debt service — property is unlevered",
        }

    dscr = noi / annual_debt_service

    if dscr >= 1.50:
        health = "strong"
    elif dscr >= 1.25:
        health = "healthy"
    elif dscr >= 1.10:
        health = "adequate"
    elif dscr >= 1.00:
        health = "tight"
    else:
        health = "distressed"

    return {
        "noi": round(noi, 2),
        "annual_debt_service": round(annual_debt_service, 2),
        "dscr": round(dscr, 4),
        "health": health,
        "message": f"DSCR of {dscr:.2f}x is {health}",
    }


def calculate_ltv(
    outstanding_debt: float,
    property_value: float,
) -> dict:
    """
    Calculate Loan-to-Value ratio.

    LTV = Outstanding Debt / Property Value
    - Below 65% is conservative
    - 65-75% is typical
    - Above 80% is high leverage

    Args:
        outstanding_debt: Total outstanding loan balance
        property_value: Current estimated property value

    Returns:
        Dict with LTV percentage and risk assessment
    """
    if property_value <= 0:
        return {
            "outstanding_debt": round(outstanding_debt, 2),
            "property_value": 0.0,
            "ltv_percent": None,
            "risk": "unknown",
            "message": "Property value not available",
        }

    ltv = (outstanding_debt / property_value) * 100

    if ltv <= 50:
        risk = "low"
    elif ltv <= 65:
        risk = "conservative"
    elif ltv <= 75:
        risk = "moderate"
    elif ltv <= 80:
        risk = "elevated"
    else:
        risk = "high"

    return {
        "outstanding_debt": round(outstanding_debt, 2),
        "property_value": round(property_value, 2),
        "ltv_percent": round(ltv, 2),
        "equity_percent": round(100 - ltv, 2),
        "equity_value": round(property_value - outstanding_debt, 2),
        "risk": risk,
        "message": f"LTV of {ltv:.1f}% — {risk} leverage",
    }


def calculate_annual_debt_service(
    outstanding_balance: float,
    annual_interest_rate: float,
    amortization_months: int,
    io_period_remaining_months: int = 0,
) -> float:
    """
    Calculate annual debt service (principal + interest).

    During IO period: interest only.
    After IO period: fully amortizing P&I.

    Args:
        outstanding_balance: Current loan balance
        annual_interest_rate: Annual rate as percentage (e.g. 5.25)
        amortization_months: Total amortization period in months
        io_period_remaining_months: Months remaining in IO period

    Returns:
        Annual debt service amount
    """
    if outstanding_balance <= 0 or annual_interest_rate <= 0:
        return 0.0

    monthly_rate = (annual_interest_rate / 100) / 12

    if io_period_remaining_months > 0:
        # Interest-only payment
        monthly_payment = outstanding_balance * monthly_rate
    elif amortization_months > 0:
        # Fully amortizing P&I
        monthly_payment = outstanding_balance * (
            monthly_rate * (1 + monthly_rate) ** amortization_months
        ) / ((1 + monthly_rate) ** amortization_months - 1)
    else:
        # Interest-only fallback
        monthly_payment = outstanding_balance * monthly_rate

    return round(monthly_payment * 12, 2)


def calculate_irr(
    cash_flows: list[float],
    guess: float = 0.10,
    max_iterations: int = 1000,
    tolerance: float = 1e-8,
) -> Optional[float]:
    """
    Calculate Internal Rate of Return using Newton's method.

    Args:
        cash_flows: List of cash flows. First element is typically negative (investment).
                    Subsequent elements are periodic returns.
        guess: Initial IRR guess (default 10%)
        max_iterations: Maximum Newton iterations
        tolerance: Convergence tolerance

    Returns:
        IRR as a decimal (0.15 = 15%), or None if it doesn't converge
    """
    if not cash_flows or len(cash_flows) < 2:
        return None

    rate = guess

    for _ in range(max_iterations):
        npv = sum(cf / (1 + rate) ** i for i, cf in enumerate(cash_flows))
        npv_derivative = sum(
            -i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cash_flows)
        )

        if abs(npv_derivative) < 1e-14:
            return None

        new_rate = rate - npv / npv_derivative

        if abs(new_rate - rate) < tolerance:
            return round(new_rate, 6)

        rate = new_rate

    return None


def calculate_cap_rate(noi: float, property_value: float) -> Optional[float]:
    """
    Calculate Capitalization Rate.

    Cap Rate = NOI / Property Value

    Returns:
        Cap rate as percentage (e.g. 6.5), or None if value is zero
    """
    if property_value <= 0:
        return None
    return round((noi / property_value) * 100, 2)


def calculate_cash_on_cash(
    annual_cash_flow_after_debt: float,
    total_equity_invested: float,
) -> Optional[float]:
    """
    Calculate Cash-on-Cash Return.

    CoC = Annual Cash Flow After Debt Service / Total Equity Invested

    Returns:
        Cash-on-cash as percentage, or None if no equity
    """
    if total_equity_invested <= 0:
        return None
    return round((annual_cash_flow_after_debt / total_equity_invested) * 100, 2)
```

---

## Section B — Calculation Schemas

### File: `backend/app/schemas/calculations.py` (NEW FILE)

```python
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
```

---

## Section C — Calculation API Routes

### File: `backend/app/routes/calculations.py` (NEW FILE)

```python
"""
Calculation engine endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, Property, DebtFacility
from app.core.deps import get_current_user, require_gp_or_ops
from app.schemas.calculations import (
    NOIInput, NOIResult,
    DSCRInput, DSCRResult,
    LTVInput, LTVResult,
    IRRInput, IRRResult,
    PropertyFinancialSummary,
)
from app.services.calculations import (
    calculate_noi,
    calculate_dscr,
    calculate_ltv,
    calculate_irr,
    calculate_cap_rate,
    calculate_cash_on_cash,
    calculate_annual_debt_service,
)

router = APIRouter()


@router.post("/noi", response_model=NOIResult)
def compute_noi(
    payload: NOIInput,
    current_user: User = Depends(get_current_user),
):
    """Calculate Net Operating Income from revenue and expense inputs."""
    return calculate_noi(**payload.model_dump())


@router.post("/dscr", response_model=DSCRResult)
def compute_dscr(
    payload: DSCRInput,
    current_user: User = Depends(get_current_user),
):
    """Calculate Debt Service Coverage Ratio."""
    return calculate_dscr(**payload.model_dump())


@router.post("/ltv", response_model=LTVResult)
def compute_ltv(
    payload: LTVInput,
    current_user: User = Depends(get_current_user),
):
    """Calculate Loan-to-Value ratio."""
    return calculate_ltv(**payload.model_dump())


@router.post("/irr", response_model=IRRResult)
def compute_irr(
    payload: IRRInput,
    current_user: User = Depends(get_current_user),
):
    """Calculate Internal Rate of Return from a series of cash flows."""
    result = calculate_irr(payload.cash_flows)
    return {
        "irr_decimal": result,
        "irr_percent": round(result * 100, 2) if result is not None else None,
        "cash_flows": payload.cash_flows,
        "message": f"IRR: {result * 100:.2f}%" if result else "IRR did not converge",
    }


@router.get("/property/{property_id}/summary", response_model=PropertyFinancialSummary)
def property_financial_summary(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate financial summary for a property.
    Pulls debt facilities and computes NOI, DSCR, LTV, cap rate.
    """
    prop = db.query(Property).filter(Property.property_id == property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Aggregate debt
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == property_id,
        DebtFacility.status.in_(["active", "pending"]),
    ).all()

    total_debt_outstanding = sum(float(d.outstanding_balance or 0) for d in debts)
    total_annual_ds = 0.0
    for d in debts:
        if d.outstanding_balance and d.interest_rate:
            ds = calculate_annual_debt_service(
                float(d.outstanding_balance),
                float(d.interest_rate),
                d.amortization_months or 0,
                d.io_period_months or 0,
            )
            total_annual_ds += ds

    # Use property estimated_value if available
    property_value = float(prop.estimated_value) if prop.estimated_value else 0.0
    total_equity = property_value - total_debt_outstanding

    # Compute NOI if we have revenue data (use beds/units to estimate)
    # For now, return a summary shell — NOI requires revenue input
    noi_result = None
    dscr_result = None
    ltv_result = None
    cap_rate = None
    coc = None

    if property_value > 0:
        ltv_result = calculate_ltv(total_debt_outstanding, property_value)

    return PropertyFinancialSummary(
        property_id=property_id,
        property_name=prop.name,
        noi=noi_result,
        dscr=dscr_result,
        ltv=ltv_result,
        cap_rate_percent=cap_rate,
        cash_on_cash_percent=coc,
        total_debt_outstanding=round(total_debt_outstanding, 2),
        total_equity=round(total_equity, 2),
        annual_debt_service=round(total_annual_ds, 2),
    )
```

### File: `backend/app/main.py`

**Add the calculations router:**

```python
from app.routes.calculations import router as calculations_router

# In the router includes section:
app.include_router(calculations_router, prefix="/api/calculations", tags=["Calculations"])
```

---

## Section D — Frontend Types

### File: `livingwell-frontend/src/types/calculations.ts` (NEW FILE)

```typescript
export interface NOIInput {
  gross_potential_revenue: number;
  vacancy_rate?: number;
  operating_expenses?: number;
  property_tax?: number;
  insurance?: number;
  management_fee_rate?: number;
  replacement_reserves?: number;
}

export interface NOIResult {
  gross_potential_revenue: number;
  vacancy_loss: number;
  vacancy_rate: number;
  effective_gross_income: number;
  operating_expenses: number;
  property_tax: number;
  insurance: number;
  management_fee: number;
  management_fee_rate: number;
  replacement_reserves: number;
  total_expenses: number;
  noi: number;
}

export interface DSCRResult {
  noi: number;
  annual_debt_service: number;
  dscr: number | null;
  health: string;
  message: string;
}

export interface LTVResult {
  outstanding_debt: number;
  property_value: number;
  ltv_percent: number | null;
  equity_percent: number | null;
  equity_value: number | null;
  risk: string;
  message: string;
}

export interface IRRResult {
  irr_decimal: number | null;
  irr_percent: number | null;
  cash_flows: number[];
  message: string;
}

export interface PropertyFinancialSummary {
  property_id: number;
  property_name: string;
  noi: NOIResult | null;
  dscr: DSCRResult | null;
  ltv: LTVResult | null;
  cap_rate_percent: number | null;
  cash_on_cash_percent: number | null;
  total_debt_outstanding: number;
  total_equity: number;
  annual_debt_service: number;
}
```

---

## Section E — Verification Checklist

1. Delete and rebuild: `rm -f backend/livingwell_dev.db && cd backend && python seed.py`
2. Start backend: `cd backend && uvicorn app.main:app --reload`
3. Login and get token
4. Test NOI: `POST /api/calculations/noi` with `{"gross_potential_revenue": 360000, "vacancy_rate": 0.05, "operating_expenses": 48000, "property_tax": 24000, "insurance": 8000}`
   - Expected NOI ≈ $252,280
5. Test DSCR: `POST /api/calculations/dscr` with `{"noi": 252280, "annual_debt_service": 180000}`
   - Expected DSCR ≈ 1.40x (healthy)
6. Test LTV: `POST /api/calculations/ltv` with `{"outstanding_debt": 2350000, "property_value": 4200000}`
   - Expected LTV ≈ 55.95% (conservative)
7. Test IRR: `POST /api/calculations/irr` with `{"cash_flows": [-500000, 60000, 65000, 70000, 75000, 580000]}`
   - Expected IRR ≈ 14-16%
8. Test property summary: `GET /api/calculations/property/1/summary`
   - Should return debt totals and LTV if property has estimated_value
9. Check Swagger docs at `/docs` — all 5 calculation endpoints should appear

---

## Notes for Claude

- The `Property` model needs an `estimated_value` field. Check if it exists; if not, add it:
  ```python
  estimated_value = Column(Numeric(15, 2), nullable=True)
  ```
  And add a seed value like `Decimal("4200000.00")` for prop1.
- The `DebtFacility` model was added in Phase 2 Sprint 1 — make sure that sprint is complete first.
- All calculation functions are pure (no DB access) — they can be unit tested independently.
- The property financial summary endpoint is a read-only aggregation — it pulls from the DB and computes on the fly.
