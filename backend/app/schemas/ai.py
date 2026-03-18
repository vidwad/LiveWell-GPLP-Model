"""Pydantic schemas for AI endpoints."""
from pydantic import BaseModel
from typing import Optional


class PropertyDefaultsRequest(BaseModel):
    address: str
    zoning: str
    city: str = "Calgary"


class PropertyDefaultsResponse(BaseModel):
    estimated_lot_size: float
    max_buildable_area: float
    recommended_units: int
    estimated_cost_per_sqft: float
    reasoning: str


class RiskAnalysisRequest(BaseModel):
    property_id: int


class RiskItemSchema(BaseModel):
    category: str
    severity: str
    description: str
    mitigation: str


class RiskAnalysisResponse(BaseModel):
    overall_risk_score: int
    summary: str
    risks: list[RiskItemSchema]
