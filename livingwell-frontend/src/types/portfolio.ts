export type DevelopmentStage =
  | "prospect"
  | "acquisition"
  | "interim_operation"
  | "planning"
  | "permit"
  | "construction"
  | "lease_up"
  | "stabilized"
  | "exit";

export type DevelopmentPlanStatus =
  | "draft"
  | "approved"
  | "active"
  | "superseded"
  | "archived";

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
  lp_id: number | null;
  lp_name: string | null;
  address: string;
  city: string;
  province: string;
  purchase_date: string | null;
  purchase_price: string | null;
  assessed_value: string | null;
  current_market_value: string | null;
  lot_size: string | null;
  zoning: string | null;
  max_buildable_area: string | null;
  floor_area_ratio: string | null;
  development_stage: DevelopmentStage;
  cluster_id: number | null;
  community_id: number | null;
  community_name: string | null;
}

export interface PropertyCreate {
  address: string;
  city: string;
  province: string;
  lp_id?: number;
  purchase_date?: string;
  purchase_price?: number;
  assessed_value?: number;
  current_market_value?: number;
  lot_size?: number;
  zoning?: string;
  max_buildable_area?: number;
  floor_area_ratio?: number;
  development_stage: DevelopmentStage;
  cluster_id?: number;
  community_id?: number;
}

export interface DevelopmentPlan {
  plan_id: number;
  property_id: number;
  version: number;
  status: DevelopmentPlanStatus;
  planned_units: number;
  planned_beds: number;
  planned_sqft: string;
  hard_costs: string | null;
  soft_costs: string | null;
  site_costs: string | null;
  financing_costs: string | null;
  contingency_percent: string | null;
  cost_per_sqft: string | null;
  estimated_construction_cost: string | null;
  projected_annual_revenue: string | null;
  projected_annual_noi: string | null;
  development_start_date: string | null;
  construction_duration_days: number | null;
  estimated_completion_date: string | null;
  estimated_stabilization_date: string | null;
}

export interface DevelopmentPlanCreate {
  version?: number;
  status?: DevelopmentPlanStatus;
  planned_units: number;
  planned_beds: number;
  planned_sqft: number;
  hard_costs?: number;
  soft_costs?: number;
  site_costs?: number;
  financing_costs?: number;
  contingency_percent?: number;
  cost_per_sqft?: number;
  estimated_construction_cost?: number;
  projected_annual_revenue?: number;
  projected_annual_noi?: number;
  development_start_date?: string;
  construction_duration_days?: number;
  estimated_completion_date?: string;
  estimated_stabilization_date?: string;
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
  building_type?: string;
  include_commercial_kitchen?: boolean;
  soft_cost_percent?: number;
  site_cost_flat?: number;
  financing_cost_percent?: number;
  contingency_percent?: number;
  escalation_percent_per_year?: number;
  target_start_date?: string | null;
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

export interface DebtFacility {
  debt_id: number;
  property_id: number;
  lender_name: string;
  debt_type: string;
  status: string;
  commitment_amount: number;
  drawn_amount: number;
  outstanding_balance: number;
  interest_rate: number | null;
  rate_type: string;
  term_months: number | null;
  amortization_months: number | null;
  io_period_months: number;
  origination_date: string | null;
  maturity_date: string | null;
  ltv_covenant: number | null;
  dscr_covenant: number | null;
  notes: string | null;
  created_at: string | null;
}

export interface DebtFacilityCreate {
  property_id: number;
  lender_name: string;
  debt_type: string;
  commitment_amount: number;
  interest_rate?: number;
  rate_type?: string;
  term_months?: number;
  amortization_months?: number;
  io_period_months?: number;
  origination_date?: string;
  maturity_date?: string;
  ltv_covenant?: number;
  dscr_covenant?: number;
  notes?: string;
}
