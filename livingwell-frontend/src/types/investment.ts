// ── GP Entity ──────────────────────────────────────────────────────
export interface GPEntity {
  gp_id: number;
  legal_name: string;
  management_fee_percent: string;
  address: string | null;
  contact_email: string | null;
  notes: string | null;
}

// ── LP Entity ──────────────────────────────────────────────────────
export type LPStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "open_for_subscription"
  | "partially_funded"
  | "tranche_closed"
  | "fully_funded"
  | "operating"
  | "winding_down"
  | "dissolved"
  | "raising";

export type LPPurposeType =
  | "recover_well"
  | "study_well"
  | "retire_well"
  | "mixed";

export interface LPEntity {
  lp_id: number;
  gp_id: number;
  name: string;
  legal_name: string | null;
  lp_number: string | null;
  description: string | null;
  city_focus: string | null;
  community_focus: string | null;
  purpose_type: string | null;
  status: LPStatus;
  unit_price: string | null;
  minimum_subscription: string | null;
  total_units_authorized: string | null;
  target_raise: string | null;
  minimum_raise: string | null;
  maximum_raise: string | null;
  offering_date: string | null;
  closing_date: string | null;
  formation_costs: string | null;
  offering_costs: string | null;
  reserve_percent: string | null;
  reserve_amount: string | null;
  preferred_return_rate: string | null;
  gp_promote_percent: string | null;
  gp_catchup_percent: string | null;
  asset_management_fee_percent: string | null;
  acquisition_fee_percent: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LPDetail extends LPEntity {
  total_committed: string | null;
  total_funded: string | null;
  total_units_issued: string | null;
  subscription_count: number;
  holding_count: number;
  property_count: number;
  target_property_count: number;
  investor_count: number;
  gross_subscriptions: string | null;
  accepted_subscriptions: string | null;
  funded_subscriptions: string | null;
  remaining_capacity: string | null;
  total_formation_costs: string | null;
  total_reserve_allocations: string | null;
  net_deployable_capital: string | null;
  capital_deployed: string | null;
  capital_available: string | null;
}

export interface LPCreate {
  gp_id: number;
  name: string;
  legal_name?: string;
  lp_number?: string;
  description?: string;
  city_focus?: string;
  community_focus?: string;
  purpose_type?: string;
  status?: string;
  unit_price?: number;
  minimum_subscription?: number;
  total_units_authorized?: number;
  target_raise?: number;
  minimum_raise?: number;
  maximum_raise?: number;
  offering_date?: string;
  closing_date?: string;
  formation_costs?: number;
  offering_costs?: number;
  reserve_percent?: number;
  reserve_amount?: number;
  preferred_return_rate?: number;
  gp_promote_percent?: number;
  gp_catchup_percent?: number;
  asset_management_fee_percent?: number;
  acquisition_fee_percent?: number;
  notes?: string;
}

// ── LP Tranche / Closing ──────────────────────────────────────────
export type TrancheStatus = "draft" | "open" | "closed" | "cancelled";

export interface LPTranche {
  tranche_id: number;
  lp_id: number;
  tranche_number: number;
  tranche_name: string | null;
  opening_date: string | null;
  closing_date: string | null;
  status: TrancheStatus;
  issue_price: string | null;
  target_amount: string | null;
  target_units: string | null;
  notes: string | null;
  created_at: string | null;
  subscriptions_count: number;
  total_subscribed: string | null;
  total_funded: string | null;
  total_units: string | null;
}

export interface LPTrancheCreate {
  lp_id: number;
  tranche_number?: number;
  tranche_name?: string;
  opening_date?: string;
  closing_date?: string;
  status?: string;
  issue_price?: number;
  target_amount?: number;
  target_units?: number;
  notes?: string;
}

// ── Investor ──────────────────────────────────────────────────────
export interface Investor {
  investor_id: number;
  user_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  entity_type: string | null;
  jurisdiction: string | null;
  accredited_status: string;
  exemption_type: string | null;
  tax_id: string | null;
  banking_info: string | null;
  notes: string | null;
  created_at: string | null;
}

// ── Subscription ───────────────────────────────────────────────────
export type SubscriptionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "accepted"
  | "funded"
  | "issued"
  | "closed"
  | "rejected"
  | "withdrawn";

export interface Subscription {
  subscription_id: number;
  investor_id: number;
  lp_id: number;
  tranche_id: number | null;
  investor_name: string | null;
  lp_name: string | null;
  tranche_name: string | null;
  commitment_amount: string;
  funded_amount: string;
  issue_price: string | null;
  unit_quantity: string | null;
  status: SubscriptionStatus;
  submitted_date: string | null;
  accepted_date: string | null;
  funded_date: string | null;
  issued_date: string | null;
  notes: string | null;
}

export interface SubscriptionCreate {
  investor_id: number;
  lp_id: number;
  tranche_id?: number;
  commitment_amount: number;
  funded_amount?: number;
  issue_price?: number;
  unit_quantity?: number;
  status?: string;
  submitted_date?: string;
  accepted_date?: string;
  funded_date?: string;
  issued_date?: string;
  notes?: string;
}

// ── Holding ────────────────────────────────────────────────────────
export interface Holding {
  holding_id: number;
  investor_id: number;
  lp_id: number;
  subscription_id: number | null;
  investor_name: string | null;
  lp_name: string | null;
  units_held: string;
  average_issue_price: string;
  total_capital_contributed: string | null;
  initial_issue_date: string | null;
  ownership_percent: string;  // computed from units_held / total_units
  cost_basis: string;         // computed from units_held * average_issue_price
  unreturned_capital: string;
  unpaid_preferred: string;
  is_gp: boolean;
  status: string | null;
}

// ── Target / Pipeline Property ─────────────────────────────────────
export type TargetPropertyStatus =
  | "identified"
  | "underwriting"
  | "approved_target"
  | "under_offer"
  | "acquired"
  | "rejected"
  | "dropped";

export interface TargetProperty {
  target_property_id: number;
  lp_id: number;
  address: string | null;
  city: string | null;
  province: string | null;
  intended_community: string | null;
  status: TargetPropertyStatus;
  estimated_acquisition_price: string | null;
  lot_size: string | null;
  zoning: string | null;
  current_sqft: string | null;
  current_bedrooms: number | null;
  current_bathrooms: number | null;
  current_condition: string | null;
  current_assessed_value: string | null;
  interim_monthly_revenue: string | null;
  interim_monthly_expenses: string | null;
  interim_occupancy_percent: string | null;
  interim_hold_months: number | null;
  planned_units: number | null;
  planned_beds: number | null;
  planned_sqft: string | null;
  construction_budget: string | null;
  hard_costs: string | null;
  soft_costs: string | null;
  contingency_percent: string | null;
  construction_duration_months: number | null;
  stabilized_monthly_revenue: string | null;
  stabilized_monthly_expenses: string | null;
  stabilized_occupancy_percent: string | null;
  stabilized_annual_noi: string | null;
  stabilized_cap_rate: string | null;
  stabilized_value: string | null;
  assumed_ltv_percent: string | null;
  assumed_interest_rate: string | null;
  assumed_amortization_months: number | null;
  assumed_debt_amount: string | null;
  target_acquisition_date: string | null;
  target_completion_date: string | null;
  target_stabilization_date: string | null;
  converted_property_id: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ── LP Portfolio Roll-up ──────────────────────────────────────────
export interface LPPortfolioRollup {
  lp_id: number;
  lp_name: string;
  target_property_count: number;
  total_target_acquisition_cost: string;
  total_target_construction_budget: string;
  total_target_all_in_cost: string;
  total_target_stabilized_noi: string;
  total_target_stabilized_value: string;
  total_target_debt: string;
  total_target_equity_required: string;
  actual_property_count: number;
  total_actual_purchase_price: string;
  total_actual_market_value: string;
  total_planned_units: number;
  total_planned_beds: number;
  projected_portfolio_value: string | null;
  projected_lp_equity_value: string | null;
  projected_annual_noi: string | null;
  projected_cash_on_cash: string | null;
  projected_equity_multiple: string | null;
  projected_irr: string | null;
}

// ── Waterfall Result ──────────────────────────────────────────────
export interface WaterfallAllocation {
  holding_id: number;
  investor_id: number;
  investor_name: string;
  is_gp: boolean;
  units_held: number;
  unreturned_capital: number;
  unpaid_preferred: number;
  tier1_roc: number;
  tier2_preferred: number;
  tier3_catchup: number;
  tier4_carry: number;
  total: number;
}

export interface WaterfallResult {
  lp_id: number;
  distributable_amount: number;
  tier1_total: number;
  tier2_total: number;
  tier3_total: number;
  tier4_total: number;
  waterfall_params: {
    preferred_return_rate: string;
    gp_promote_percent: string;
    gp_catchup_percent: string;
    style: string;
  };
  allocations: WaterfallAllocation[];
}

// ── Distribution Event ─────────────────────────────────────────────
export type DistributionEventStatus = "draft" | "approved" | "paid";
export type DistributionType =
  | "return_of_capital"
  | "preferred_return"
  | "profit_share"
  | "refinance_proceeds";
export type DistributionMethod = "eTransfer" | "Wire" | "ACH" | "Cheque";

export interface DistributionAllocation {
  allocation_id: number;
  holding_id: number;
  amount: string;
  distribution_type: DistributionType;
  method: DistributionMethod;
  notes: string | null;
  investor_name: string | null;
  ownership_percent: string | null;
}

export interface DistributionEvent {
  event_id: number;
  lp_id: number;
  period_label: string;
  total_distributable: string;
  status: DistributionEventStatus;
  notes: string | null;
  created_date: string;
  approved_date: string | null;
  paid_date: string | null;
  allocations: DistributionAllocation[];
}
