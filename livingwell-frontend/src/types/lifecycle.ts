// ── Property Lifecycle Types ─────────────────────────────────────────

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

export type MilestoneStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface StageTransition {
  transition_id: number;
  property_id: number;
  from_stage: DevelopmentStage;
  to_stage: DevelopmentStage;
  transitioned_by: number;
  transitioned_at: string;
  notes: string | null;
  validation_passed: boolean;
  validation_errors: string | null;
}

export interface AllowedTransition {
  current_stage: DevelopmentStage;
  allowed_transitions: DevelopmentStage[];
  validation_requirements?: Record<string, string[]>;
}

export interface TransitionRequest {
  to_stage: DevelopmentStage;
  notes?: string;
  force?: boolean;
}

export interface PropertyMilestone {
  milestone_id: number;
  property_id: number;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  stage: DevelopmentStage;
  target_date: string;
  actual_date: string | null;
  sort_order: number;
}

export interface MilestoneCreate {
  title: string;
  description?: string;
  target_date: string;
  stage: DevelopmentStage;
  sort_order?: number;
}

export interface MilestoneUpdate {
  title?: string;
  description?: string;
  status?: MilestoneStatus;
  target_date?: string;
  actual_date?: string;
}

// ── Quarterly Reports ───────────────────────────────────────────────

export type QuarterlyReportStatus = "draft" | "review" | "published";

export interface QuarterlyReport {
  report_id: number;
  lp_id: number;
  period_label: string;
  quarter: number;
  year: number;
  status: QuarterlyReportStatus;
  total_revenue: string;
  total_expenses: string;
  net_operating_income: string;
  total_distributions: string;
  portfolio_value: string;
  portfolio_ltv: string;
  executive_summary: string | null;
  property_updates: string | null;
  market_commentary: string | null;
  generated_at: string | null;
  published_at: string | null;
  generated_by: number | null;
}

export interface QuarterlyReportCreate {
  quarter: number;
  year: number;
}

export interface QuarterlyReportUpdate {
  status?: QuarterlyReportStatus;
  executive_summary?: string;
  market_commentary?: string;
}

// ── eTransfer Tracking ──────────────────────────────────────────────

export type ETransferStatus =
  | "initiated"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export interface ETransferTracking {
  tracking_id: number;
  allocation_id: number;
  recipient_email: string;
  amount: string;
  security_question: string | null;
  reference_number: string | null;
  status: ETransferStatus;
  initiated_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  notes: string | null;
}

export interface ETransferCreate {
  allocation_id: number;
  recipient_email: string;
  amount: number;
  security_question?: string;
}

export interface ETransferUpdate {
  status?: ETransferStatus;
  reference_number?: string;
  notes?: string;
}

// ── Message Threads ─────────────────────────────────────────────────

export interface MessageReply {
  reply_id: number;
  parent_message_id: number;
  sender_id: number;
  body: string;
  sent_at: string;
  is_read: boolean;
}

export interface MessageReplyCreate {
  body: string;
}

// ── Operator Budgets ────────────────────────────────────────────────

export type BudgetPeriodType = "monthly" | "quarterly" | "annual";

export interface OperatorBudget {
  budget_id: number;
  operator_id: number;
  community_id: number;
  period_type: BudgetPeriodType;
  period_label: string;
  year: number;
  quarter: number | null;
  month: number | null;
  budgeted_revenue: string;
  budgeted_expenses: string;
  budgeted_noi: string;
  actual_revenue: string | null;
  actual_expenses: string | null;
  actual_noi: string | null;
  notes: string | null;
}

export interface BudgetCreate {
  operator_id: number;
  community_id: number;
  period_type: BudgetPeriodType;
  period_label: string;
  year: number;
  quarter?: number;
  month?: number;
  budgeted_revenue: number;
  budgeted_expenses: number;
  budgeted_noi: number;
}

export interface BudgetUpdate {
  actual_revenue?: number;
  actual_expenses?: number;
  actual_noi?: number;
  notes?: string;
}

// ── Operating Expenses ──────────────────────────────────────────────

export type ExpenseCategory =
  | "property_management"
  | "utilities"
  | "insurance"
  | "property_tax"
  | "maintenance_repairs"
  | "staffing"
  | "meal_program"
  | "supplies"
  | "marketing"
  | "technology"
  | "professional_fees"
  | "other";

export interface OperatingExpense {
  expense_id: number;
  community_id: number;
  budget_id: number | null;
  category: ExpenseCategory;
  description: string;
  amount: string;
  expense_date: string;
  period_month: number;
  period_year: number;
  vendor: string | null;
  invoice_ref: string | null;
  is_recurring: boolean;
  notes: string | null;
}

export interface ExpenseCreate {
  community_id: number;
  budget_id?: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  period_month: number;
  period_year: number;
  vendor?: string;
  invoice_ref?: string;
  is_recurring?: boolean;
}

export interface ExpenseUpdate {
  amount?: number;
  description?: string;
  notes?: string;
}

export interface ExpenseSummary {
  community_id: number;
  year: number;
  quarter: number | null;
  total_expenses: string;
  by_category: Record<string, string>;
  expense_count: number;
}
