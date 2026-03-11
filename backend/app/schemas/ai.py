from pydantic import BaseModel


class AssumptionValidationRequest(BaseModel):
    cap_rate: float | None = None
    construction_cost_per_sqft: float | None = None
    timeline_months: int | None = None
    market: str | None = None
    extra: dict | None = None


class ScenarioRequest(BaseModel):
    interest_rate_shift: float
    portfolio_summary: dict


class AIResponse(BaseModel):
    result: str
