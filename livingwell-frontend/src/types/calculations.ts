export interface NOIInput {
  gross_potential_revenue: number;
  vacancy_rate?: number;
  operating_expenses?: number;
  property_tax?: number;
  insurance?: number;
  management_fee_rate?: number;
  replacement_reserves?: number;
}

export interface NOIResult {
  gross_potential_revenue: number;
  vacancy_loss: number;
  vacancy_rate: number;
  effective_gross_income: number;
  operating_expenses: number;
  property_tax: number;
  insurance: number;
  management_fee: number;
  management_fee_rate: number;
  replacement_reserves: number;
  total_expenses: number;
  noi: number;
}

export interface DSCRResult {
  noi: number;
  annual_debt_service: number;
  dscr: number | null;
  health: string;
  message: string;
}

export interface LTVResult {
  outstanding_debt: number;
  property_value: number;
  ltv_percent: number | null;
  equity_percent: number | null;
  equity_value: number | null;
  risk: string;
  message: string;
}

export interface IRRResult {
  irr_decimal: number | null;
  irr_percent: number | null;
  cash_flows: number[];
  message: string;
}

export interface PropertyFinancialSummary {
  property_id: number;
  property_name: string;
  noi: NOIResult | null;
  dscr: DSCRResult | null;
  ltv: LTVResult | null;
  cap_rate_percent: number | null;
  cash_on_cash_percent: number | null;
  total_debt_outstanding: number;
  total_equity: number;
  annual_debt_service: number;
}
