# Sprint 2 — Construction Cost Estimation Engine

**Status:** Ready for implementation
**Assigned to:** Claude (local development)
**Reviewed by:** Manus
**Date:** 2026-03-11

---

## Overview

This sprint builds the **Construction Cost Estimation Engine**, a core feature of the Living Well platform. It replaces the basic placeholder math in `services/modeling.py` with a robust, structured calculator based on real Alberta construction benchmarks (CMHC Q1-2025 data).

The engine will:
1. Calculate hard costs based on building type and square footage ($280–$450/sqft)
2. Calculate soft costs as a percentage of hard costs (typically 15-25%)
3. Calculate site costs and financing costs
4. Apply contingency percentages
5. Apply time-based cost escalation (inflation) based on the development start date
6. Provide a new API endpoint to run these calculations dynamically
7. Update the frontend to use this new endpoint in the modeling view

**Prerequisite:** This sprint assumes Sprint 1 (Enhanced Data Model) has been fully implemented.

---

## Important Instructions for Claude

1. **Work in order.** Complete each section (A through E) sequentially.
2. **Use the exact code provided.** Do not paraphrase or simplify the calculation logic.
3. **Test the backend** by starting the server (`uvicorn app.main:app --reload`) and hitting the new `/api/portfolio/modeling/estimate-costs` endpoint via Swagger (`/docs`).
4. **Test the frontend** by running `npm run dev` and verifying the Portfolio Modeling page works with the new data structure.

---

## Section A: Updated Modeling Service

**File:** `backend/app/services/modeling.py`

Replace the entire file with the following code. This introduces the new `CostEstimator` class that uses Alberta benchmarks.

```python
import datetime
from decimal import Decimal, ROUND_HALF_UP

# Alberta CMHC Q1-2025 Benchmarks (Hard Costs per SqFt)
# Adjusted slightly to provide a range for the Living Well model
ALBERTA_BENCHMARKS = {
    "multiplex_standard": Decimal("280.00"),  # 4-plex to 6-plex base
    "multiplex_premium": Decimal("350.00"),   # 4-plex to 6-plex high-end (RetireWell)
    "shared_housing": Decimal("320.00"),      # RecoverWell / StudyWell specific buildout
    "commercial_kitchen_add": Decimal("150000.00"), # Flat add for cluster kitchen
}

class CostEstimator:
    """
    Calculates detailed construction costs based on Alberta benchmarks,
    soft costs, contingency, and time-based escalation.
    """
    
    @staticmethod
    def calculate_total_costs(
        planned_sqft: Decimal,
        building_type: str = "multiplex_standard",
        include_commercial_kitchen: bool = False,
        soft_cost_percent: Decimal = Decimal("20.00"),
        site_cost_flat: Decimal = Decimal("75000.00"),
        financing_cost_percent: Decimal = Decimal("5.00"),
        contingency_percent: Decimal = Decimal("10.00"),
        escalation_percent_per_year: Decimal = Decimal("4.00"),
        months_to_start: int = 0,
    ) -> dict:
        """
        Returns a detailed breakdown of estimated construction costs.
        """
        # 1. Hard Costs
        base_cost_per_sqft = ALBERTA_BENCHMARKS.get(building_type, ALBERTA_BENCHMARKS["multiplex_standard"])
        hard_costs = planned_sqft * base_cost_per_sqft
        
        if include_commercial_kitchen:
            hard_costs += ALBERTA_BENCHMARKS["commercial_kitchen_add"]
            
        # 2. Soft Costs (Architecture, Engineering, Permits, Legal)
        soft_costs = hard_costs * (soft_cost_percent / Decimal("100"))
        
        # 3. Site Costs (Excavation, Servicing, Landscaping)
        site_costs = site_cost_flat
        
        # Subtotal before financing and contingency
        subtotal_1 = hard_costs + soft_costs + site_costs
        
        # 4. Financing Costs (Interest reserve, loan fees)
        financing_costs = subtotal_1 * (financing_cost_percent / Decimal("100"))
        
        # Subtotal before contingency
        subtotal_2 = subtotal_1 + financing_costs
        
        # 5. Contingency
        contingency = subtotal_2 * (contingency_percent / Decimal("100"))
        
        # Total Current Cost
        total_current_cost = subtotal_2 + contingency
        
        # 6. Escalation (Inflation based on time to start)
        escalation_multiplier = Decimal("1")
        if months_to_start > 0:
            years_to_start = Decimal(months_to_start) / Decimal("12")
            # Compound interest formula: (1 + r)^t
            escalation_multiplier = (Decimal("1") + (escalation_percent_per_year / Decimal("100"))) ** years_to_start
            
        total_escalated_cost = total_current_cost * escalation_multiplier
        
        # Calculate effective cost per sqft
        effective_cost_per_sqft = total_escalated_cost / planned_sqft if planned_sqft > 0 else Decimal("0")
        
        return {
            "hard_costs": hard_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "soft_costs": soft_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "site_costs": site_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "financing_costs": financing_costs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "contingency": contingency.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "total_current_cost": total_current_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "escalation_amount": (total_escalated_cost - total_current_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "total_escalated_cost": total_escalated_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "effective_cost_per_sqft": effective_cost_per_sqft.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        }


# Keep existing functions for backward compatibility with other parts of the app
def calculate_construction_costs(unit_count: int, avg_cost_per_unit: Decimal) -> Decimal:
    return Decimal(unit_count) * avg_cost_per_unit

def calculate_noi(rent_income: Decimal, other_income: Decimal, operating_expenses: Decimal) -> Decimal:
    return rent_income + other_income - operating_expenses

def calculate_cap_rate(noi: Decimal, market_value: Decimal) -> Decimal:
    if market_value == 0:
        raise ValueError("market_value cannot be zero")
    return (noi / market_value) * Decimal(100)

def calculate_irr(cash_flow: list[Decimal]) -> Decimal:
    if not cash_flow:
        raise ValueError("cash_flow is empty")
    returns = []
    for t, cf in enumerate(cash_flow):
        returns.append(cf / (Decimal(1) + Decimal(0.1)) ** t)
    total = sum(returns)
    return (total - cash_flow[0]) / abs(cash_flow[0])
```

---

## Section B: New Pydantic Schemas

**File:** `backend/app/schemas/portfolio.py`

Add the following new schemas to the bottom of the file (after `ModelingResult`):

```python
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
```

---

## Section C: New API Endpoint

**File:** `backend/app/routes/portfolio.py`

1. **Update imports** at the top of the file to include the new schemas and service class:

```python
# Add to existing imports from app.schemas.portfolio:
from app.schemas.portfolio import (
    # ... existing imports ...
    CostEstimateInput, CostEstimateResult
)

# Add to existing imports from app.services.modeling:
from app.services.modeling import (
    # ... existing imports ...
    CostEstimator
)
import datetime
from dateutil.relativedelta import relativedelta
```

2. **Add the new endpoint** at the very end of the file:

```python
# ---------------------------------------------------------------------------
# Cost Estimation Engine
# ---------------------------------------------------------------------------

@router.post("/modeling/estimate-costs", response_model=CostEstimateResult)
def estimate_construction_costs(
    payload: CostEstimateInput,
    _: User = Depends(require_gp_or_ops),
):
    """
    Calculate detailed construction costs based on Alberta benchmarks.
    """
    months_to_start = 0
    if payload.target_start_date:
        today = datetime.date.today()
        if payload.target_start_date > today:
            rd = relativedelta(payload.target_start_date, today)
            months_to_start = rd.years * 12 + rd.months

    result = CostEstimator.calculate_total_costs(
        planned_sqft=payload.planned_sqft,
        building_type=payload.building_type,
        include_commercial_kitchen=payload.include_commercial_kitchen,
        soft_cost_percent=payload.soft_cost_percent,
        site_cost_flat=payload.site_cost_flat,
        financing_cost_percent=payload.financing_cost_percent,
        contingency_percent=payload.contingency_percent,
        escalation_percent_per_year=payload.escalation_percent_per_year,
        months_to_start=months_to_start,
    )
    
    return result
```

*(Note: You may need to run `pip install python-dateutil` in the backend directory if it's not already in `requirements.txt`. Please add `python-dateutil==2.9.0.post0` to `backend/requirements.txt`)*

---

## Section D: Frontend Types Update

**File:** `livingwell-frontend/src/types/portfolio.ts`

Add the new types to the bottom of the file:

```typescript
export interface CostEstimateInput {
  planned_sqft: number;
  building_type: "multiplex_standard" | "multiplex_premium" | "shared_housing";
  include_commercial_kitchen: boolean;
  soft_cost_percent: number;
  site_cost_flat: number;
  financing_cost_percent: number;
  contingency_percent: number;
  escalation_percent_per_year: number;
  target_start_date: string | null;
}

export interface CostEstimateResult {
  hard_costs: string;
  soft_costs: string;
  site_costs: string;
  financing_costs: string;
  contingency: string;
  total_current_cost: string;
  escalation_amount: string;
  total_escalated_cost: string;
  effective_cost_per_sqft: string;
}
```

---

## Section E: Frontend API Client Update

**File:** `livingwell-frontend/src/lib/api.ts`

Add the new API call to the `portfolio` object (around line 40):

```typescript
export const portfolio = {
  // ... existing methods ...
  
  // Add this new method:
  estimateCosts: async (data: CostEstimateInput) => {
    const response = await api.post<CostEstimateResult>('/portfolio/modeling/estimate-costs', data);
    return response.data;
  },
};
```

---

## Section F: Verification Checklist

After completing all sections, verify the following:

1. **Install new dependency:**
   ```bash
   cd backend
   echo "python-dateutil==2.9.0.post0" >> requirements.txt
   pip install -r requirements.txt
   ```

2. **Start backend and check Swagger:**
   ```bash
   uvicorn app.main:app --reload
   ```
   Open `http://localhost:8000/docs` and verify:
   - The `/api/portfolio/modeling/estimate-costs` endpoint exists.
   - Test it with `planned_sqft: 5000` and `building_type: "multiplex_standard"`. It should return a detailed breakdown with `hard_costs` around 1,400,000.

3. **Commit and push:**
   ```bash
   git add -A
   git commit -m "Sprint 2: Construction Cost Estimation Engine with Alberta benchmarks"
   git push
   ```

---

## What Comes Next (Sprint 3 Preview)

Sprint 3 will focus on the **Investor Portal Enhancement** — building the LP waterfall distribution logic (preferred returns vs profit sharing), document management, and secure messaging.
