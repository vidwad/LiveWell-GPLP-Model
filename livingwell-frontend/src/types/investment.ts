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
export type LPStatus = "raising" | "operating" | "winding_down" | "dissolved";

export interface LPEntity {
  lp_id: number;
  gp_id: number;
  name: string;
  description: string | null;
  status: LPStatus;
  target_raise: string;
  minimum_investment: string;
  offering_date: string | null;
  closing_date: string | null;
  preferred_return_rate: string;
  gp_promote_percent: string;
  gp_catchup_percent: string;
  asset_management_fee_percent: string;
  acquisition_fee_percent: string;
}

export interface LPCreate {
  gp_id: number;
  name: string;
  description?: string;
  status?: LPStatus;
  target_raise: number;
  minimum_investment: number;
  offering_date?: string;
  closing_date?: string;
  preferred_return_rate?: number;
  gp_promote_percent?: number;
  gp_catchup_percent?: number;
  asset_management_fee_percent?: number;
  acquisition_fee_percent?: number;
}

// ── Subscription ───────────────────────────────────────────────────
export type SubscriptionStatus =
  | "submitted"
  | "accepted"
  | "funded"
  | "issued"
  | "rejected"
  | "withdrawn";

export interface Subscription {
  subscription_id: number;
  investor_id: number;
  lp_id: number;
  investor_name: string;
  lp_name: string;
  commitment_amount: string;
  funded_amount: string;
  status: SubscriptionStatus;
  submitted_date: string | null;
  accepted_date: string | null;
  funded_date: string | null;
  issued_date: string | null;
  notes: string | null;
}

// ── Holding ────────────────────────────────────────────────────────
export interface Holding {
  holding_id: number;
  investor_id: number;
  lp_id: number;
  subscription_id: number | null;
  investor_name: string;
  lp_name: string;
  ownership_percent: string;
  cost_basis: string;
  unreturned_capital: string;
  unpaid_preferred: string;
  is_gp: boolean;
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
