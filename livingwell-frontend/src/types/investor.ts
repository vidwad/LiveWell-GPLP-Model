export type DistributionMethod = "eTransfer" | "Wire" | "ACH";
export type DistributionType =
  | "preferred_return"
  | "profit_share"
  | "refinancing"
  | "sale_proceeds";

export interface Investor {
  investor_id: number;
  user_id: number | null;
  name: string;
  email: string;
  accredited_status: string;
  phone: string | null;
  preferred_return_rate: string | null;
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
  is_gp: boolean;
}

export interface Distribution {
  distribution_id: number;
  investor_id: number;
  amount: string;
  payment_date: string;
  method: DistributionMethod;
  distribution_type: DistributionType | null;
  notes: string | null;
}

export type DocumentType = "subscription_agreement" | "partnership_agreement" | "tax_form" | "quarterly_report" | "capital_call" | "distribution_notice" | "other";

export interface Document {
  document_id: number;
  investor_id: number;
  title: string;
  document_type: DocumentType;
  file_url: string;
  upload_date: string;
  is_viewed: boolean;
}

export interface Message {
  message_id: number;
  investor_id: number;
  sender_id: number;
  subject: string;
  body: string;
  sent_at: string;
  is_read: boolean;
}

// Update InvestorDashboard to include the new arrays
export interface InvestorDashboard {
  investor: Investor;
  total_contributed: string;
  total_distributed: string;
  net_position: string;
  ownership_positions: Ownership[];
  recent_distributions: Distribution[];
  documents: Document[];
  messages: Message[];
}

export interface WaterfallInput {
  distributable_cash: number;
  unreturned_capital: number;
  unpaid_pref_balance: number;
  pref_rate?: number;
  gp_promote_share?: number;
}

export interface WaterfallResult {
  total_distribution: string;
  lp_distribution: string;
  gp_distribution: string;
  tier_1_lp: string;
  tier_1_gp: string;
  tier_2_lp: string;
  tier_2_gp: string;
  tier_3_lp: string;
  tier_3_gp: string;
  unpaid_pref_balance: string;
  unreturned_capital: string;
}
