export type DevelopmentStage =
  | "acquisition"
  | "planning"
  | "construction"
  | "operational";

export interface Property {
  property_id: number;
  address: string;
  city: string;
  province: string;
  purchase_date: string;
  purchase_price: string;
  lot_size: string | null;
  zoning: string | null;
  max_buildable_area: string | null;
  development_stage: DevelopmentStage;
}

export interface PropertyCreate {
  address: string;
  city: string;
  province: string;
  purchase_date: string;
  purchase_price: number;
  lot_size?: number;
  zoning?: string;
  max_buildable_area?: number;
  development_stage: DevelopmentStage;
}

export interface DevelopmentPlan {
  plan_id: number;
  property_id: number;
  planned_units: number;
  planned_beds: number;
  planned_sqft: string;
  estimated_construction_cost: string;
  development_start_date: string;
  construction_duration_days: number;
}

export interface DevelopmentPlanCreate {
  planned_units: number;
  planned_beds: number;
  planned_sqft: number;
  estimated_construction_cost: number;
  development_start_date: string;
  construction_duration_days: number;
}

export interface ModelingInput {
  purchase_price: number;
  construction_cost: number;
  annual_revenue: number;
  annual_expenses: number;
  hold_period_years: number;
  exit_cap_rate: number;
}

export interface ModelingResult {
  construction_costs: string;
  noi: string;
  cap_rate: string;
  irr: string;
}
