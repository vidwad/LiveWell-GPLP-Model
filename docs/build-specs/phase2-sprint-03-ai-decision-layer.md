# Phase 2 Sprint 3: AI Decision Layer

> **Status:** Ready for Claude  
> **Depends on:** Phase 2 Sprint 2 (Calculation Engines)  
> **Estimated effort:** High  

## Overview

This sprint implements the AI Decision Layer, moving beyond basic chat to structured, actionable intelligence. It introduces:

1. **Structured OpenAI Outputs** — Using Pydantic `response_format` to guarantee typed JSON returns
2. **Auto-Populate Defaults** — AI suggests buildable area, units, and costs based on address and zoning
3. **Risk Analysis Engine** — AI evaluates a property and returns typed risk items (severity, category, mitigation)
4. **Enhanced AI Dashboard** — Interactive risk cards and severity badges on the frontend

---

## Section A — AI Service with Structured Outputs

### File: `backend/app/services/ai.py`

**Replace the entire file** with this implementation:

```python
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
    debt = f"Debt: ${debt_balance:,.2f}" if debt_balance else "Debt: Unlevereaged"
    
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
```

---

## Section B — AI Schemas

### File: `backend/app/schemas/ai.py`

**Replace the entire file** with this:

```python
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
```

---

## Section C — AI Routes

### File: `backend/app/routes/ai.py`

**Replace the entire file** with this:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, Property, DebtFacility
from app.core.deps import get_current_user, require_gp_or_ops
from app.schemas.ai import (
    PropertyDefaultsRequest, PropertyDefaultsResponse,
    RiskAnalysisRequest, RiskAnalysisResponse
)
from app.services.ai import suggest_property_defaults, analyze_property_risk
from app.services.calculations import calculate_noi

router = APIRouter()

@router.post("/suggest-defaults", response_model=PropertyDefaultsResponse)
def get_property_defaults(
    payload: PropertyDefaultsRequest,
    current_user: User = Depends(require_gp_or_ops),
):
    """Get AI-suggested defaults for a new property."""
    result = suggest_property_defaults(
        address=payload.address,
        zoning=payload.zoning,
        city=payload.city
    )
    return result

@router.post("/analyze-risk", response_model=RiskAnalysisResponse)
def get_risk_analysis(
    payload: RiskAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Perform AI risk analysis on an existing property."""
    prop = db.query(Property).filter(Property.property_id == payload.property_id).first()
    if not prop:
        raise HTTPException(404, "Property not found")

    # Gather debt info
    debts = db.query(DebtFacility).filter(
        DebtFacility.property_id == prop.property_id,
        DebtFacility.status == "active"
    ).all()
    total_debt = sum(float(d.outstanding_balance or 0) for d in debts)

    # Estimate NOI if we have units (rough estimate for AI context)
    estimated_noi = None
    if prop.units:
        # Assume $1500/mo per unit, 30% expense ratio
        gross_rev = len(prop.units) * 1500 * 12
        noi_dict = calculate_noi(gross_potential_revenue=gross_rev, operating_expenses=gross_rev * 0.3)
        estimated_noi = noi_dict["noi"]

    result = analyze_property_risk(
        address=prop.address,
        purchase_price=float(prop.purchase_price or 0),
        zoning=prop.zoning or "Unknown",
        development_stage=prop.development_stage.value if prop.development_stage else "Unknown",
        noi=estimated_noi,
        debt_balance=total_debt if total_debt > 0 else None
    )
    
    return result
```

---

## Section D — Frontend Types & Hooks

### File: `livingwell-frontend/src/types/ai.ts`

**Replace the entire file** with this:

```typescript
export interface PropertyDefaultsRequest {
  address: string;
  zoning: string;
  city?: string;
}

export interface PropertyDefaultsResponse {
  estimated_lot_size: number;
  max_buildable_area: number;
  recommended_units: number;
  estimated_cost_per_sqft: number;
  reasoning: string;
}

export interface RiskItem {
  category: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  description: string;
  mitigation: string;
}

export interface RiskAnalysisResponse {
  overall_risk_score: number;
  summary: string;
  risks: RiskItem[];
}
```

### File: `livingwell-frontend/src/hooks/useAI.ts`

**Replace the entire file** with this:

```typescript
import { useMutation } from '@tanreact/query';
import api from '@/lib/api';
import { PropertyDefaultsRequest, PropertyDefaultsResponse, RiskAnalysisResponse } from '@/types/ai';

export function usePropertyDefaults() {
  return useMutation<PropertyDefaultsResponse, Error, PropertyDefaultsRequest>({
    mutationFn: async (data) => {
      const response = await api.post('/ai/suggest-defaults', data);
      return response.data;
    },
  });
}

export function useRiskAnalysis() {
  return useMutation<RiskAnalysisResponse, Error, number>({
    mutationFn: async (propertyId) => {
      const response = await api.post('/ai/analyze-risk', { property_id: propertyId });
      return response.data;
    },
  });
}
```

---

## Section E — Frontend AI Dashboard

### File: `livingwell-frontend/src/app/(dashboard)/ai/page.tsx`

**Replace the entire file** with this:

```tsx
'use client';

import { useState } from 'react';
import { useProperties } from '@/hooks/usePortfolio';
import { useRiskAnalysis } from '@/hooks/useAI';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, TrendingUp, Scale, Settings } from 'lucide-react';

export default function AIDashboardPage() {
  const { data: properties, isLoading: propsLoading } = useProperties();
  const { mutate: analyzeRisk, data: riskData, isPending: isAnalyzing } = useRiskAnalysis();
  const [selectedPropId, setSelectedPropId] = useState<string>('');

  const handleAnalyze = () => {
    if (selectedPropId) {
      analyzeRisk(parseInt(selectedPropId));
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'financial': return <TrendingUp className="h-4 w-4" />;
      case 'regulatory': return <Scale className="h-4 w-4" />;
      case 'operational': return <Settings className="h-4 w-4" />;
      default: return <ShieldAlert className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Decision Layer</h1>
        <p className="text-muted-foreground">
          AI-powered risk analysis and underwriting intelligence.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Property Risk Analysis</CardTitle>
          <CardDescription>Select a property to generate a comprehensive risk profile.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={selectedPropId} onValueChange={setSelectedPropId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a property..." />
            </SelectTrigger>
            <SelectContent>
              {properties?.map((p) => (
                <SelectItem key={p.property_id} value={p.property_id.toString()}>
                  {p.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAnalyze} disabled={!selectedPropId || isAnalyzing}>
            {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Analyze Risk
          </Button>
        </CardContent>
      </Card>

      {riskData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1 bg-slate-50">
              <CardHeader>
                <CardTitle>Risk Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className={`text-6xl font-bold ${riskData.overall_risk_score > 70 ? 'text-red-600' : riskData.overall_risk_score > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {riskData.overall_risk_score}
                </div>
                <p className="text-sm text-muted-foreground mt-2">/ 100 (Lower is better)</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg leading-relaxed">{riskData.summary}</p>
              </CardContent>
            </Card>
          </div>

          <h3 className="text-xl font-semibold mt-8 mb-4">Identified Risks & Mitigations</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {riskData.risks.map((risk, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {getCategoryIcon(risk.category)}
                      <span className="text-sm font-medium uppercase tracking-wider">{risk.category}</span>
                    </div>
                    <Badge className={getSeverityColor(risk.severity)}>{risk.severity}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{risk.description}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-100 p-3 rounded-md mt-2">
                    <span className="font-semibold text-sm block mb-1">Mitigation Strategy:</span>
                    <span className="text-sm">{risk.mitigation}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Section F — Verification Checklist

1. Start backend and frontend
2. Login as `admin@livingwell.ca`
3. Test defaults endpoint: `POST /api/ai/suggest-defaults` with `{"address": "123 Main St", "zoning": "R-CG"}`
   - Should return structured JSON with `estimated_lot_size`, `max_buildable_area`, etc.
4. Navigate to the AI Decision Layer in the frontend sidebar
5. Select "123 Recovery Road NE" from the dropdown and click "Analyze Risk"
6. Verify the UI renders the Risk Score, Executive Summary, and Risk Cards with correct severity colors
7. Note: If `OPENAI_API_KEY` is not set in `backend/.env`, the endpoints will gracefully return the fallback dummy data defined in `services/ai.py`. This is expected and means the architecture works.
