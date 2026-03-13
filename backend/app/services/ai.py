import os
from typing import Optional
from pydantic import BaseModel, Field
from openai import OpenAI

# Initialize OpenAI client
# Requires OPENAI_API_KEY in environment
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "dummy-key-for-testing"))

# ─── Structured Output Schemas ──────────────────────────────────────────────

class PropertyDefaultsSuggestion(BaseModel):
    estimated_lot_size: float = Field(description="Estimated lot size in sq ft based on typical lots in the area")
    max_buildable_area: float = Field(description="Maximum buildable area in sq ft based on zoning")
    recommended_units: int = Field(description="Recommended number of units for this zoning")
    estimated_cost_per_sqft: float = Field(description="Estimated construction cost per sq ft in CAD")
    reasoning: str = Field(description="Brief explanation of how these numbers were derived")

class RiskItem(BaseModel):
    category: str = Field(description="Category of risk (e.g., Financial, Regulatory, Market, Operational)")
    severity: str = Field(description="Severity level: Low, Medium, High, Critical")
    description: str = Field(description="Clear description of the risk")
    mitigation: str = Field(description="Suggested mitigation strategy")

class PropertyRiskAnalysis(BaseModel):
    overall_risk_score: int = Field(description="Overall risk score from 1-100 (lower is better)")
    summary: str = Field(description="Executive summary of the risk profile")
    risks: list[RiskItem] = Field(description="List of identified risks")

# ─── Service Functions ──────────────────────────────────────────────────────

def suggest_property_defaults(address: str, zoning: str, city: str = "Calgary") -> dict:
    """
    Use AI to suggest default values for a new property based on address and zoning.
    Uses OpenAI's structured output feature to guarantee the return format.
    """
    prompt = f"""
    You are an expert real estate developer in {city}, Alberta.
    I am evaluating a property at {address} with zoning {zoning}.
    
    Based on typical {city} lot sizes and {zoning} regulations (e.g., R-CG allows multiplexes),
    suggest the estimated lot size, max buildable area, recommended number of units, 
    and current estimated construction cost per sqft in CAD.
    """

    try:
        response = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a precise real estate data assistant."},
                {"role": "user", "content": prompt}
            ],
            response_format=PropertyDefaultsSuggestion,
        )
        return response.choices[0].message.parsed.model_dump()
    except Exception as e:
        # Fallback for testing without API key
        return {
            "estimated_lot_size": 5000.0,
            "max_buildable_area": 4000.0,
            "recommended_units": 4,
            "estimated_cost_per_sqft": 300.0,
            "reasoning": f"Fallback data: API error or missing key ({str(e)})"
        }

def analyze_property_risk(
    address: str, 
    purchase_price: float, 
    zoning: str, 
    development_stage: str,
    noi: Optional[float] = None,
    debt_balance: Optional[float] = None
) -> dict:
    """
    Perform a comprehensive risk analysis on a property.
    """
    financials = f"NOI: ${noi:,.2f}" if noi else "NOI: Unknown"
    debt = f"Debt: ${debt_balance:,.2f}" if debt_balance else "Debt: Unleveraged"
    
    prompt = f"""
    Perform a risk analysis for a real estate investment with the following details:
    Address: {address}
    Purchase Price: ${purchase_price:,.2f}
    Zoning: {zoning}
    Stage: {development_stage}
    {financials}
    {debt}
    
    Identify specific Financial, Regulatory, Market, and Operational risks.
    Assign a severity to each and provide a mitigation strategy.
    """

    try:
        response = client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a Chief Risk Officer for a real estate private equity firm."},
                {"role": "user", "content": prompt}
            ],
            response_format=PropertyRiskAnalysis,
        )
        return response.choices[0].message.parsed.model_dump()
    except Exception as e:
        # Fallback for testing without API key
        return {
            "overall_risk_score": 45,
            "summary": f"Fallback analysis: API error or missing key ({str(e)})",
            "risks": [
                {
                    "category": "Regulatory",
                    "severity": "Medium",
                    "description": f"Zoning {zoning} may require discretionary approval.",
                    "mitigation": "Engage planning consultant early."
                },
                {
                    "category": "Financial",
                    "severity": "High" if debt_balance and debt_balance > purchase_price * 0.7 else "Low",
                    "description": "Interest rate exposure on debt facility.",
                    "mitigation": "Explore fixed-rate hedging options."
                }
            ]
        }
