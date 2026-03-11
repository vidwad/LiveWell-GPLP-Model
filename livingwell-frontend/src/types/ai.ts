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
