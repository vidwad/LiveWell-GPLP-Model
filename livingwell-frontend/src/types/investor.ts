export type EntityType = "individual" | "corporation" | "trust" | "partnership";
export type AccreditedStatus = "accredited" | "non_accredited" | "pending";

export interface Investor {
  investor_id: number;
  user_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  entity_type: EntityType;
  accredited_status: AccreditedStatus;
}

export interface InvestorCreate {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  entity_type?: EntityType;
  accredited_status?: AccreditedStatus;
  user_id?: number;
}

export interface InvestorSummary {
  investor_id: number;
  name: string;
  email: string;
  phone: string | null;
  entity_type: string | null;
  accredited_status: string;
  total_committed: string;
  total_funded: string;
  subscription_count: number;
  active_subscriptions: number;
  lp_names: string[];
  latest_status: string | null;
  created_at: string | null;
  is_active: boolean;
  holding_count: number;
  missing_docs_count: number;
  compliance_approved: boolean;
}

export type DocumentType =
  | "subscription_agreement"
  | "partnership_agreement"
  | "tax_form"
  | "quarterly_report"
  | "capital_call"
  | "distribution_notice"
  | "other";

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

export interface InvestorDashboard {
  investor: Investor;
  total_committed: string;
  total_funded: string;
  total_distributions: string;
  net_position: string;
  subscription_count: number;
  holding_count: number;
  documents: Document[];
  messages: Message[];
}

export interface InvestorDistributionItem {
  allocation_id: number;
  event_id: number;
  lp_name: string;
  period_label: string;
  distribution_type: string;
  amount: string;
  event_status: string;
  paid_date: string | null;
  created_date: string;
  notes: string | null;
}

export interface InvestorDistributionHistory {
  investor_id: number;
  investor_name: string;
  total_distributions: string;
  distributions: InvestorDistributionItem[];
}

export interface WaterfallInput {
  distributable_cash: number;
  unreturned_capital: number;
  unpaid_pref_balance: number;
  preferred_rate?: number;
  gp_catchup_percent?: number;
  lp_gp_split_lp?: number;
  lp_gp_split_gp?: number;
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
