export type DevelopmentStage =
  | "acquisition"
  | "interim_operation"
  | "planning"
  | "construction"
  | "stabilized"
  | "exit";

export type EntityType =
  | "property_lp"
  | "operating_company"
  | "property_management";

export interface PropertyCluster {
  cluster_id: number;
  name: string;
  city: string;
  has_commercial_kitchen: boolean;
  kitchen_capacity_meals_per_day: number | null;
  notes: string | null;
}

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
  floor_area_ratio: string | null;
  development_stage: DevelopmentStage;
  cluster_id: number | null;
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
  floor_area_ratio?: number;
  development_stage: DevelopmentStage;
  cluster_id?: number;
}

export interface DevelopmentPlan {
  plan_id: number;
  property_id: number;
  version: number;
  planned_units: number;
  planned_beds: number;
  planned_sqft: string;
  hard_costs: string | null;
  soft_costs: string | null;
  site_costs: string | null;
  financing_costs: string | null;
  contingency_percent: string | null;
  cost_escalation_percent_per_year: string | null;
  cost_per_sqft: string | null;
  estimated_construction_cost: string;
  development_start_date: string;
  construction_duration_days: number;
  estimated_completion_date: string | null;
}

export interface DevelopmentPlanCreate {
  version?: number;
  planned_units: number;
  planned_beds: number;
  planned_sqft: number;
  hard_costs?: number;
  soft_costs?: number;
  site_costs?: number;
  financing_costs?: number;
  contingency_percent?: number;
  cost_escalation_percent_per_year?: number;
  cost_per_sqft?: number;
  estimated_construction_cost: number;
  development_start_date: string;
  construction_duration_days: number;
  estimated_completion_date?: string;
}

export interface EconomicEntity {
  entity_id: number;
  property_id: number;
  entity_type: EntityType;
  legal_name: string;
  description: string | null;
  revenue_share_percent: string | null;
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
