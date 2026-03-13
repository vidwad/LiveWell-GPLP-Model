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
