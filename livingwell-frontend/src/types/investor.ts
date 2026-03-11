export type DistributionMethod = "eTransfer" | "Wire" | "ACH";

export interface Investor {
  investor_id: number;
  user_id: number | null;
  name: string;
  email: string;
  accredited_status: string;
  phone: string | null;
}

export interface Contribution {
  contribution_id: number;
  investor_id: number;
  amount: string;
  date: string;
  notes: string | null;
}

export interface Ownership {
  ownership_id: number;
  investor_id: number;
  property_id: number | null;
  ownership_percent: string;
}

export interface Distribution {
  distribution_id: number;
  investor_id: number;
  amount: string;
  payment_date: string;
  method: DistributionMethod;
  notes: string | null;
}

export interface InvestorDashboard {
  investor: Investor;
  total_contributed: string;
  total_distributed: string;
  net_position: string;
  ownership_positions: Ownership[];
  recent_distributions: Distribution[];
}
