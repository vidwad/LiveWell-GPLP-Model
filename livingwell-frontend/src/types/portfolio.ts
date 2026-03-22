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
  pm_id: number | null;
  pm_name: string | null;
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
  pm_id?: number;
}

// ── Property Manager ─────────────────────────────────────────────
export interface PropertyManager {
  pm_id: number;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  management_fee_percent: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  notes: string | null;
  property_count: number;
}

export interface PropertyManagerCreate {
  name: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  management_fee_percent?: number;
  contract_start_date?: string;
  contract_end_date?: string;
  notes?: string;
}

export interface DevelopmentPlan {
  plan_id: number;
  property_id: number;
  plan_name: string | null;
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
  cost_escalation_percent_per_year: string | null;
  cost_per_sqft: string | null;
  estimated_construction_cost: string | null;
  projected_annual_revenue: string | null;
  projected_annual_noi: string | null;
  development_start_date: string | null;
  construction_duration_days: number | null;
  estimated_completion_date: string | null;
  estimated_stabilization_date: string | null;
  rent_pricing_mode: string | null;
  annual_rent_increase_pct: string | null;
}

export interface DevelopmentPlanCreate {
  version?: number;
  plan_name?: string;
  status?: DevelopmentPlanStatus;
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
  estimated_construction_cost?: number;
  projected_annual_revenue?: number;
  projected_annual_noi?: number;
  development_start_date?: string;
  construction_duration_days?: number;
  estimated_completion_date?: string;
  estimated_stabilization_date?: string;
  rent_pricing_mode?: string;
  annual_rent_increase_pct?: number;
}

export type DevelopmentPlanUpdate = Partial<Omit<DevelopmentPlanCreate, 'planned_units' | 'planned_beds' | 'planned_sqft' | 'estimated_construction_cost'>> & {
  plan_name?: string;
  planned_units?: number;
  planned_beds?: number;
  planned_sqft?: number;
  estimated_construction_cost?: number;
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

// ── Projection Types ────────────────────────────────────────────────

export interface ProjectionRow {
  year: number;
  phase: string;
  gross_potential_rent: number;
  vacancy_loss: number;
  effective_gross_income: number;
  operating_expenses: number;
  noi: number;
  annual_debt_service: number;
  cash_flow: number;
  cumulative_cash_flow: number;
}

export interface ProjectionFees {
  selling_commission: number;
  offering_cost: number;
  acquisition_fee: number;
  total_upfront_fees: number;
  management_fee_annual: number;
  total_management_fees: number;
  construction_mgmt_fee: number;
  total_construction_mgmt_fees: number;
  refinancing_fee: number;
  turnover_fee: number;
  turnover_replacement_fee: number;
  total_ongoing_fees: number;
  total_all_fees: number;
  net_deployable_capital: number;
}

export interface ProjectionSummary {
  total_cash_flow: number;
  terminal_value: number;
  net_exit_proceeds: number;
  equity_multiple: string;
  irr_estimate: string;
  total_return: number;
  cash_on_cash_avg: string;
  annualized_roi: string;
  exit_noi: number;
  disposition_costs: number;
  total_equity_invested: number;
  fees?: ProjectionFees;
  lp_share_of_profits?: number;
  gp_share_of_profits?: number;
}

export interface ProjectionResult {
  projections: ProjectionRow[];
  summary: ProjectionSummary;
}

// ── Unit & Bed Types ────────────────────────────────────────────────

export interface Bed {
  bed_id: number;
  bed_label: string;
  monthly_rent: number;
  rent_type: string;
  status: string;
  bedroom_number?: number;
  is_post_renovation?: boolean;
}

export interface Bedroom {
  bedroom_number: number;
  total_rent: number;
  beds: Bed[];
}

export interface PropertyUnit {
  unit_id: number;
  unit_number: string;
  unit_type: string;
  is_legal_suite: boolean;
  floor: string | null;
  sqft: string;
  bed_count: number;
  bedroom_count?: number;
  is_occupied: boolean;
  development_plan_id: number | null;
  beds: Bed[];
  bedrooms?: Bedroom[];
}

// ── Unit Summary Types ──────────────────────────────────────────────

export interface UnitMixEntry {
  count: number;
  beds: number;
  sqft: number;
}

export interface FloorBreakdownEntry {
  units: number;
  beds: number;
}

export interface UnitSummaryBase {
  total_units: number;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  vacancy_rate: number;
  total_sqft: number;
  potential_monthly_rent: number;
  actual_monthly_rent: number;
  legal_suites: number;
  unit_mix: Record<string, UnitMixEntry>;
  floor_breakdown: Record<string, FloorBreakdownEntry>;
}

export interface ValuationScenario {
  cap_rate: number;
  baseline_value: number;
  post_redev_value: number;
  value_increase: number;
  value_increase_pct: number;
}

export interface NetImpact {
  delta_units: number;
  delta_beds: number;
  delta_sqft: number;
  delta_monthly_rent: number;
  delta_annual_rent: number;
  valuation_scenarios: ValuationScenario[];
}

export interface RedevelopmentPhase extends UnitSummaryBase {
  plan_id: number;
  plan_name: string;
  plan_status: string;
  start_date: string | null;
  completion_date: string | null;
}

export interface UnitSummaryResponse extends UnitSummaryBase {
  has_redevelopment: boolean;
  baseline?: UnitSummaryBase;
  redevelopment_phases?: RedevelopmentPhase[];
  net_impact?: NetImpact;
}

// ── Rent Roll Types ─────────────────────────────────────────────────

export interface RentRollUnit {
  unit_id: number;
  unit_number: string;
  unit_type: string;
  bed_count: number;
  bedroom_count?: number;
  sqft: number;
  floor: string | null;
  is_occupied: boolean;
  unit_potential_monthly: number;
  unit_actual_monthly: number;
  unit_vacancy_count: number;
  beds: Bed[];
  bedrooms?: Bedroom[];
}

export interface RentRollData {
  total_units: number;
  total_beds: number;
  potential_monthly_rent: number;
  potential_annual_rent: number;
  actual_monthly_rent: number;
  actual_annual_rent: number;
  vacancy_count: number;
  vacancy_rate: number;
  vacancy_loss_annual: number;
  units: RentRollUnit[];
}

export interface RentRollComparison {
  prev_monthly: number;
  prev_beds: number;
  prev_units: number;
  plan_monthly: number;
  plan_beds: number;
  plan_units: number;
  delta_monthly: number;
  delta_annual: number;
  pct_change: number;
}

export interface EscalationYear {
  year: number;
  monthly: number;
  gross_annual: number;
}

export interface RentRollPlanPhase {
  plan_id: number;
  plan_label: string;
  plan_status: string;
  pricing_mode: string;
  annual_rent_increase_pct: number;
  development_start_date: string | null;
  estimated_completion_date: string | null;
  estimated_stabilization_date: string | null;
  debt_count: number;
  annual_debt_service: number;
  rent_roll: RentRollData | null;
  comparison_vs_previous: RentRollComparison | null;
  escalation_projection: EscalationYear[] | null;
}

export interface RentRollResponse {
  baseline: {
    pricing_mode: string;
    rent_roll: RentRollData;
  };
  plan_phases: RentRollPlanPhase[];
}

// ── Projection Input ────────────────────────────────────────────────

export interface ProjectionInput {
  annual_expense_ratio: number;
  vacancy_rate: number;
  annual_rent_increase: number;
  expense_growth_rate: number;
  construction_start_date?: string;
  construction_months: number;
  lease_up_months: number;
  exit_cap_rate: number;
  disposition_cost_pct: number;
  projection_years: number;
  management_fee_rate: number;
  construction_mgmt_fee_rate: number;
  selling_commission_rate: number;
  acquisition_fee_rate: number;
  refinancing_fee_rate: number;
  turnover_fee_rate: number;
  lp_profit_share: number;
  gp_profit_share: number;
  offering_cost?: number;
  construction_budget?: number;
  acquisition_cost?: number;
  gross_raise?: number;
  refinance_amount?: number;
  property_fmv_at_turnover?: number;
  planned_units?: number;
  monthly_rent_per_unit?: number;
  annual_debt_service?: number;
  total_equity_invested?: number;
  debt_balance_at_exit?: number;
  carrying_cost_annual?: number;
}

// ── Construction Expense & Draw Types ────────────────────────────────

export interface ConstructionExpense {
  expense_id: number;
  property_id: number;
  plan_id: number;
  category: string;
  description: string | null;
  budgeted_amount: string;
  actual_amount: string;
  vendor: string | null;
  invoice_ref: string | null;
  expense_date: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface ConstructionExpenseCreate {
  plan_id: number;
  category: string;
  description?: string;
  budgeted_amount?: number;
  actual_amount?: number;
  vendor?: string;
  invoice_ref?: string;
  expense_date?: string;
  notes?: string;
}

export interface ConstructionBudgetSummary {
  property_id: number;
  plan_id: number;
  line_items: ConstructionExpense[];
  total_budgeted: string;
  total_actual: string;
  total_variance: string;
  by_category: Record<string, { budgeted: number; actual: number; variance: number }>;
}

export interface ConstructionDraw {
  draw_id: number;
  property_id: number;
  debt_id: number;
  draw_number: number;
  requested_amount: string;
  approved_amount: string | null;
  status: string;
  description: string | null;
  requested_date: string | null;
  approved_date: string | null;
  funded_date: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface ConstructionDrawCreate {
  debt_id: number;
  draw_number: number;
  requested_amount: number;
  description?: string;
  requested_date?: string;
  notes?: string;
}

// ── Edit Plan Form ──────────────────────────────────────────────────

export interface EditPlanForm {
  plan_name: string;
  status: string;
  planned_units: number;
  planned_beds: number;
  planned_sqft: number;
  estimated_construction_cost: number;
  development_start_date: string;
  construction_duration_days: number;
  hard_costs: number;
  soft_costs: number;
  site_costs: number;
  financing_costs: number;
  contingency_percent: number;
  cost_per_sqft: number;
  projected_annual_revenue: number;
  projected_annual_noi: number;
  estimated_completion_date: string;
  estimated_stabilization_date: string;
  rent_pricing_mode: string;
  annual_rent_increase_pct: number;
}
