# Sprint 4 Build Specification: AI Decision Layer

## Overview
This sprint upgrades the AI service from a basic chat interface to a structured, multi-agent decision layer. It implements structured JSON outputs using Pydantic models with OpenAI, enabling the AI to return typed data that the frontend can render as interactive UI components rather than just text blocks.

**Key Features:**
1. **Structured OpenAI Outputs:** Use `response_format` with Pydantic models to guarantee JSON responses.
2. **Auto-Populate Defaults:** AI suggests buildable area, unit config, and costs based on address and zoning.
3. **Risk Detection Engine:** AI analyzes development plans and flags specific risks (financial, regulatory, timeline) with severity levels.
4. **Enhanced AI Dashboard:** A new frontend interface that renders AI insights as structured cards and alerts.

---

## Section A: Update AI Service (Backend)
**File:** `backend/app/services/ai.py`
**Action:** Replace the entire file with this structured output implementation.

```python
import json
from typing import Any
from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.config import settings

_client: OpenAI | None = None

def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client

# ---------------------------------------------------------------------------
# Structured Output Models
# ---------------------------------------------------------------------------

class PropertyDefaults(BaseModel):
    estimated_buildable_sqft: int = Field(description="Estimated buildable square footage based on lot size and zoning")
    suggested_building_type: str = Field(description="One of: multiplex_standard, multiplex_premium, shared_housing")
    estimated_hard_cost_per_sqft: float = Field(description="Estimated hard construction cost per sqft in CAD")
    suggested_unit_count: int = Field(description="Suggested number of units")
    suggested_bed_count: int = Field(description="Suggested total number of beds")
    rationale: str = Field(description="Brief explanation of these suggestions")

class RiskItem(BaseModel):
    category: str = Field(description="Category of risk: financial, regulatory, timeline, or operational")
    severity: str = Field(description="Severity: low, medium, or high")
    description: str = Field(description="Detailed description of the risk")
    mitigation: str = Field(description="Suggested mitigation strategy")

class RiskAnalysis(BaseModel):
    overall_risk_score: int = Field(description="Overall risk score from 1 to 10 (10 being highest risk)")
    risks: list[RiskItem] = Field(description="List of identified risks")
    summary: str = Field(description="Executive summary of the risk profile")

# ---------------------------------------------------------------------------
# AI Functions
# ---------------------------------------------------------------------------

def generate_property_defaults(address: str, lot_size: float, zoning: str) -> dict[str, Any]:
    """Generate structured default assumptions for a new property."""
    client = _get_client()
    
    system_prompt = (
        "You are an expert real estate development analyst specializing in Alberta multiplexes "
        "and shared housing (sober living, student housing, senior living). "
        "Based on the address, lot size, and zoning provided, suggest realistic development defaults."
    )
    
    user_prompt = f"Address: {address}\nLot Size: {lot_size} sqft\nZoning: {zoning}"
    
    response = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=PropertyDefaults,
        temperature=0.2,
    )
    
    return json.loads(response.choices[0].message.content)


def analyze_development_risk(property_data: dict, plan_data: dict, cost_data: dict) -> dict[str, Any]:
    """Analyze a development plan and return structured risk items."""
    client = _get_client()
    
    system_prompt = (
        "You are a Chief Risk Officer for a real estate private equity firm. "
        "Analyze the provided property details, development plan, and cost estimates. "
        "Identify specific risks (financial, regulatory, timeline, operational) and suggest mitigations. "
        "Pay special attention to Alberta-specific construction costs, zoning constraints, and interest rate sensitivity."
    )
    
    user_prompt = (
        f"Property: {json.dumps(property_data)}\n"
        f"Development Plan: {json.dumps(plan_data)}\n"
        f"Cost Estimates: {json.dumps(cost_data)}"
    )
    
    response = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=RiskAnalysis,
        temperature=0.3,
    )
    
    return json.loads(response.choices[0].message.content)


# Keep existing functions for backward compatibility
def validate_assumptions(assumptions: dict) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an expert real estate analyst. Validate these assumptions. Be concise."},
            {"role": "user", "content": str(assumptions)},
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()

def scenario_analysis(interest_rate_shift: float, portfolio_summary: dict) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Analyze the impact of an interest rate change on this portfolio. Be concise."},
            {"role": "user", "content": f"Shift: +{interest_rate_shift}%\nPortfolio:\n{portfolio_summary}"},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()
```

---

## Section B: Update AI Schemas
**File:** `backend/app/schemas/ai.py`
**Action:** Replace the entire file.

```python
from typing import Any
from pydantic import BaseModel

# Existing basic schemas
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

# New structured schemas
class PropertyDefaultsRequest(BaseModel):
    address: str
    lot_size: float
    zoning: str

class PropertyDefaultsResponse(BaseModel):
    estimated_buildable_sqft: int
    suggested_building_type: str
    estimated_hard_cost_per_sqft: float
    suggested_unit_count: int
    suggested_bed_count: int
    rationale: str

class RiskAnalysisRequest(BaseModel):
    property_id: int
    plan_id: int

class RiskItemSchema(BaseModel):
    category: str
    severity: str
    description: str
    mitigation: str

class RiskAnalysisResponse(BaseModel):
    overall_risk_score: int
    risks: list[RiskItemSchema]
    summary: str
```

---

## Section C: Update AI Routes
**File:** `backend/app/routes/ai.py`
**Action:** Replace the entire file.

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_gp_or_ops
from app.core.config import settings
from app.db.session import get_db
from app.db.models import User, Property, DevelopmentPlan
from app.schemas.ai import (
    AIResponse, AssumptionValidationRequest, ScenarioRequest,
    PropertyDefaultsRequest, PropertyDefaultsResponse,
    RiskAnalysisRequest, RiskAnalysisResponse
)
from app.services import ai as ai_service
from app.services.modeling import CostEstimator

router = APIRouter()

def _check_ai_enabled():
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="AI service not configured (missing OPENAI_API_KEY)")

@router.post("/validate", response_model=AIResponse)
def validate_assumptions(payload: AssumptionValidationRequest, _: User = Depends(get_current_user)):
    _check_ai_enabled()
    result = ai_service.validate_assumptions(payload.model_dump(exclude_none=True))
    return AIResponse(result=result)

@router.post("/scenario", response_model=AIResponse)
def scenario_analysis(payload: ScenarioRequest, _: User = Depends(get_current_user)):
    _check_ai_enabled()
    result = ai_service.scenario_analysis(payload.interest_rate_shift, payload.portfolio_summary)
    return AIResponse(result=result)

@router.post("/defaults", response_model=PropertyDefaultsResponse)
def get_property_defaults(payload: PropertyDefaultsRequest, _: User = Depends(require_gp_or_ops)):
    _check_ai_enabled()
    result = ai_service.generate_property_defaults(
        address=payload.address,
        lot_size=payload.lot_size,
        zoning=payload.zoning
    )
    return PropertyDefaultsResponse(**result)

@router.post("/risk-analysis", response_model=RiskAnalysisResponse)
def analyze_risk(payload: RiskAnalysisRequest, db: Session = Depends(get_db), _: User = Depends(require_gp_or_ops)):
    _check_ai_enabled()
    
    # Fetch property and plan
    prop = db.query(Property).filter(Property.property_id == payload.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
        
    plan = db.query(DevelopmentPlan).filter(DevelopmentPlan.plan_id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Development plan not found")
        
    # Generate cost estimate to feed to AI
    cost_estimate = CostEstimator.calculate_total_costs(
        planned_sqft=plan.planned_sqft,
        building_type=plan.building_type,
        include_commercial_kitchen=False
    )
    
    # Prepare data dictionaries
    prop_data = {
        "address": prop.address,
        "city": prop.city,
        "purchase_price": float(prop.purchase_price),
        "lot_size": float(prop.lot_size),
        "zoning": prop.zoning
    }
    
    plan_data = {
        "target_start_date": str(plan.target_start_date) if plan.target_start_date else None,
        "target_completion_date": str(plan.target_completion_date) if plan.target_completion_date else None,
        "planned_sqft": float(plan.planned_sqft),
        "building_type": plan.building_type,
        "estimated_units": plan.estimated_units
    }
    
    # Call AI
    result = ai_service.analyze_development_risk(prop_data, plan_data, cost_estimate)
    return RiskAnalysisResponse(**result)
```

---

## Section D: Update Frontend Types
**File:** `livingwell-frontend/src/types/ai.ts`
**Action:** Replace the entire file.

```typescript
export interface AssumptionValidationRequest {
  cap_rate: number;
  construction_cost_per_sqft: number;
  timeline_months: number;
  market: string;
  extra?: Record<string, unknown>;
}

export interface ScenarioRequest {
  interest_rate_shift: number;
  portfolio_summary: Record<string, unknown>;
}

export interface AIResponse {
  result: string;
}

export interface PropertyDefaultsRequest {
  address: string;
  lot_size: number;
  zoning: string;
}

export interface PropertyDefaultsResponse {
  estimated_buildable_sqft: number;
  suggested_building_type: string;
  estimated_hard_cost_per_sqft: number;
  suggested_unit_count: number;
  suggested_bed_count: number;
  rationale: string;
}

export interface RiskAnalysisRequest {
  property_id: number;
  plan_id: number;
}

export interface RiskItem {
  category: string;
  severity: "low" | "medium" | "high";
  description: string;
  mitigation: string;
}

export interface RiskAnalysisResponse {
  overall_risk_score: number;
  risks: RiskItem[];
  summary: string;
}
```

---

## Section E: Update Frontend Hooks
**File:** `livingwell-frontend/src/hooks/useAI.ts`
**Action:** Replace the entire file.

```typescript
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { 
  AssumptionValidationRequest, 
  ScenarioRequest, 
  AIResponse,
  PropertyDefaultsRequest,
  PropertyDefaultsResponse,
  RiskAnalysisRequest,
  RiskAnalysisResponse
} from "@/types/ai";

export function useValidateAssumptions() {
  return useMutation({
    mutationFn: (data: AssumptionValidationRequest) =>
      apiClient.post<AIResponse>("/api/ai/validate", data).then((r) => r.data),
  });
}

export function useRunScenario() {
  return useMutation({
    mutationFn: (data: ScenarioRequest) =>
      apiClient.post<AIResponse>("/api/ai/scenario", data).then((r) => r.data),
  });
}

export function usePropertyDefaults() {
  return useMutation({
    mutationFn: (data: PropertyDefaultsRequest) =>
      apiClient.post<PropertyDefaultsResponse>("/api/ai/defaults", data).then((r) => r.data),
  });
}

export function useRiskAnalysis() {
  return useMutation({
    mutationFn: (data: RiskAnalysisRequest) =>
      apiClient.post<RiskAnalysisResponse>("/api/ai/risk-analysis", data).then((r) => r.data),
  });
}
```

---

## Section F: Update AI Dashboard Page
**File:** `livingwell-frontend/src/app/(dashboard)/ai/page.tsx`
**Action:** Replace the entire file to add the new Risk Analysis tab.

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useValidateAssumptions, useRunScenario, useRiskAnalysis } from "@/hooks/useAI";
import { useProperties, useDevelopmentPlans } from "@/hooks/usePortfolio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RiskAnalysisResponse } from "@/types/ai";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [riskResult, setRiskResult] = useState<RiskAnalysisResponse | null>(null);
  const [noKey, setNoKey] = useState(false);

  const { mutateAsync: validate, isPending: validatePending } = useValidateAssumptions();
  const { mutateAsync: scenario, isPending: scenarioPending } = useRunScenario();
  const { mutateAsync: analyzeRisk, isPending: riskPending } = useRiskAnalysis();

  const { data: properties } = useProperties();
  
  const [validateForm, setValidateForm] = useState({
    cap_rate: 0.05,
    construction_cost_per_sqft: 250,
    timeline_months: 18,
    market: "Calgary, AB",
  });

  const [scenarioForm, setScenarioForm] = useState({
    interest_rate_shift: 0.5,
    portfolio_summary: "{}",
  });

  const [riskForm, setRiskForm] = useState({
    property_id: 0,
    plan_id: 0,
  });

  // Fetch plans when property is selected
  const { data: plans } = useDevelopmentPlans(riskForm.property_id, { 
    enabled: riskForm.property_id > 0 
  });

  const handleError = (err: any) => {
    const status = err?.response?.status;
    if (status === 503) {
      setNoKey(true);
    } else {
      toast.error("AI request failed");
    }
  };

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = `Validate assumptions: cap rate ${(validateForm.cap_rate * 100).toFixed(1)}%, construction $${validateForm.construction_cost_per_sqft}/sqft, ${validateForm.timeline_months} months in ${validateForm.market}`;
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    try {
      const res = await validate(validateForm);
      setMessages((m) => [...m, { role: "assistant", content: res.result }]);
      setNoKey(false);
    } catch (err) {
      handleError(err);
      setMessages((m) => m.slice(0, -1));
    }
  };

  const handleScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    let portfolioObj = {};
    try {
      portfolioObj = JSON.parse(scenarioForm.portfolio_summary);
    } catch {
      toast.error("Portfolio summary must be valid JSON");
      return;
    }
    const prompt = `Scenario: ${scenarioForm.interest_rate_shift > 0 ? "+" : ""}${scenarioForm.interest_rate_shift}% interest rate shift`;
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    try {
      const res = await scenario({
        interest_rate_shift: scenarioForm.interest_rate_shift,
        portfolio_summary: portfolioObj,
      });
      setMessages((m) => [...m, { role: "assistant", content: res.result }]);
      setNoKey(false);
    } catch (err) {
      handleError(err);
      setMessages((m) => m.slice(0, -1));
    }
  };

  const handleRiskAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riskForm.property_id || !riskForm.plan_id) {
      toast.error("Please select a property and a development plan");
      return;
    }
    try {
      const res = await analyzeRisk(riskForm);
      setRiskResult(res);
      setNoKey(false);
      toast.success("Risk analysis complete");
    } catch (err) {
      handleError(err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Decision Layer
        </h1>
        <p className="text-muted-foreground">
          Structured intelligence for development planning and risk management
        </p>
      </div>

      {noKey && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">OpenAI API key not configured</p>
            <p className="text-sm">
              Add your <code className="rounded bg-yellow-100 px-1">OPENAI_API_KEY</code> to <code className="rounded bg-yellow-100 px-1">backend/.env</code> and restart the server.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="risk" className="space-y-6">
        <TabsList>
          <TabsTrigger value="risk">Development Risk Analysis</TabsTrigger>
          <TabsTrigger value="chat">General Analysis (Chat)</TabsTrigger>
        </TabsList>

        {/* RISK ANALYSIS TAB */}
        <TabsContent value="risk">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-base">Select Project</CardTitle>
                <CardDescription>Choose a property and plan to analyze</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRiskAnalysis} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Property</Label>
                    <Select
                      value={String(riskForm.property_id)}
                      onValueChange={(v) => setRiskForm({ property_id: Number(v), plan_id: 0 })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select property..." /></SelectTrigger>
                      <SelectContent>
                        {properties?.map((p) => (
                          <SelectItem key={p.property_id} value={String(p.property_id)}>
                            {p.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Development Plan</Label>
                    <Select
                      value={String(riskForm.plan_id)}
                      onValueChange={(v) => setRiskForm(f => ({ ...f, plan_id: Number(v) }))}
                      disabled={!riskForm.property_id || !plans || plans.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={plans?.length === 0 ? "No plans found" : "Select plan..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {plans?.map((p) => (
                          <SelectItem key={p.plan_id} value={String(p.plan_id)}>
                            {p.building_type} ({p.planned_sqft} sqft)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full" disabled={riskPending || !riskForm.plan_id}>
                    {riskPending ? "Analyzing..." : "Run Risk Analysis"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              {!riskResult && !riskPending && (
                <Card className="border-dashed bg-muted/50">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No Analysis Run</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                      Select a property and development plan to generate a structured AI risk assessment.
                    </p>
                  </CardContent>
                </Card>
              )}

              {riskPending && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
                    <p className="text-sm text-muted-foreground animate-pulse">AI is analyzing property data, zoning, and cost estimates...</p>
                  </CardContent>
                </Card>
              )}

              {riskResult && !riskPending && (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle>Risk Summary</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Risk Score:</span>
                          <Badge variant={riskResult.overall_risk_score > 7 ? "destructive" : riskResult.overall_risk_score > 4 ? "default" : "secondary"} className="text-base px-3 py-1">
                            {riskResult.overall_risk_score} / 10
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{riskResult.summary}</p>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Identified Risks</h3>
                    {riskResult.risks.map((risk, i) => (
                      <Card key={i} className="overflow-hidden">
                        <div className={`h-1 w-full ${risk.severity === 'high' ? 'bg-red-500' : risk.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                                {risk.category}
                              </Badge>
                              <Badge className={getSeverityColor(risk.severity)} variant="outline">
                                {risk.severity} severity
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm font-medium mb-3">{risk.description}</p>
                          <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mitigation Strategy</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{risk.mitigation}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* CHAT TAB (Legacy) */}
        <TabsContent value="chat">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Assumption Validation</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={handleValidate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cap Rate</Label>
                        <Input type="number" step="0.001" value={validateForm.cap_rate} onChange={(e) => setValidateForm(f => ({ ...f, cap_rate: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost ($/sqft)</Label>
                        <Input type="number" value={validateForm.construction_cost_per_sqft} onChange={(e) => setValidateForm(f => ({ ...f, construction_cost_per_sqft: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={validatePending}>{validatePending ? "Analyzing..." : "Validate"}</Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <Card className="flex flex-col h-[500px]">
              <CardHeader><CardTitle className="text-base">Response History</CardTitle></CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`rounded-lg p-3 text-sm ${msg.role === "user" ? "bg-muted" : "bg-primary/5 border border-primary/20"}`}>
                      <p className="mb-1 text-xs font-semibold uppercase opacity-60">{msg.role === "user" ? "You" : "AI"}</p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Verification Checklist
1. Ensure `OPENAI_API_KEY` is set in `backend/.env`.
2. Rebuild the database and start the backend.
3. Start the frontend and navigate to the AI Assistant page.
4. Go to the "Development Risk Analysis" tab.
5. Select "142 Whyte Ave" and its development plan.
6. Click "Run Risk Analysis".
7. Verify that the AI returns a structured response with an overall score, summary, and individual risk cards with severity badges and mitigation strategies.
