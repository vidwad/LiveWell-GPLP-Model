"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const fmt = (n: number | null | undefined) =>
  n != null
    ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n)
    : "—";
const fmtSigned = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n === 0) return "—";
  if (n < 0) return `(${fmt(Math.abs(n))})`;
  return fmt(n);
};
const fmtPct = (n: number | null | undefined, digits = 1) =>
  n != null ? `${Number(n).toFixed(digits)}%` : "—";

interface ProformaYear {
  year_number: number;
  calendar_year: number;
  label?: string;
  property_portfolio_price?: number;
  lp_equity_invested_this_year?: number;
  refi_distribution_to_lp?: number;
  cumulative_lp_equity_invested?: number;
  mortgage_balance_eoy?: number;
  lp_equity_value_eoy?: number;
  gross_rents?: number;
  expenses_total?: number;
  noi?: number;
  debt_service?: number;
  construction_cost?: number;
  net_cashflow_to_lp?: number;
  coc_pct?: number;
  principal_paydown_pct?: number;
  cap_gain_return_pct?: number;
  total_return_pct?: number;
  lp_capital_appreciation?: number;
  gp_capital_appreciation?: number;
  sale_price?: number;
  net_sale_proceeds?: number;
}

export interface ProformaData {
  lp_id: number;
  lp_name?: string;
  waterfall_mode: string;
  hold_years: number;
  years: ProformaYear[];
  summary: any;
  investor_reference: any;
  fee_assumptions: any;
}

interface Props {
  data: ProformaData;
}

export function LPInvestorProforma({ data }: Props) {
  const { years, summary, investor_reference: ref, fee_assumptions: fees } = data;

  if (!years || years.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No operating years to project. Add properties and configure their development plans
            to see the investor pro forma.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render columns: one per year + a Total column
  const yearCols = years.map((y) => ({ key: `y${y.year_number}`, label: `Year ${y.year_number}`, sub: y.calendar_year }));

  const colCount = years.length + 2; // label col + years + total col

  // Helper that draws a row
  const Row = ({
    label, values, total, totalFmt, hint, className, isHeader,
  }: {
    label: React.ReactNode;
    values: (number | null | undefined)[];
    total?: number | null;
    totalFmt?: "currency" | "percent" | "ratio";
    hint?: string;
    className?: string;
    isHeader?: boolean;
  }) => {
    const formatTotal = (v: number | null | undefined) => {
      if (v == null) return "—";
      if (totalFmt === "percent") return fmtPct(v);
      if (totalFmt === "ratio") return Number(v).toFixed(2);
      return fmt(v);
    };
    return (
      <tr className={cn(className)}>
        <td className={cn("py-1.5 pl-3 pr-2 text-xs sticky left-0 bg-inherit", isHeader && "font-semibold")}>
          {label}
          {hint && <span className="block text-[9px] text-muted-foreground italic">{hint}</span>}
        </td>
        {values.map((v, i) => (
          <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs">
            {totalFmt === "percent"
              ? fmtPct(v)
              : totalFmt === "ratio"
                ? v != null ? Number(v).toFixed(2) : "—"
                : fmtSigned(v)}
          </td>
        ))}
        {total !== undefined && (
          <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold border-l">
            {formatTotal(total)}
          </td>
        )}
      </tr>
    );
  };

  // Section header row
  const Section = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <tr className="bg-slate-100">
      <td colSpan={colCount} className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-700">
        {title}
        {subtitle && <span className="ml-2 font-normal italic text-slate-600">{subtitle}</span>}
      </td>
    </tr>
  );

  // Aggregate helpers for "Total" column
  const totalGrossRents = years.reduce((s, y) => s + (y.gross_rents || 0), 0);
  const totalExpenses = years.reduce((s, y) => s + (y.expenses_total || 0), 0);
  const totalNoi = years.reduce((s, y) => s + (y.noi || 0), 0);
  const totalDebtService = years.reduce((s, y) => s + (y.debt_service || 0), 0);
  const totalNetCfToLp = years.reduce((s, y) => s + (y.net_cashflow_to_lp || 0), 0);
  const totalLpEquityIn = years.reduce((s, y) => s + (y.lp_equity_invested_this_year || 0), 0);
  const totalRefiDist = years.reduce((s, y) => s + (y.refi_distribution_to_lp || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header summary band */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Hold Period" value={`${summary.hold_years} years`} color="text-slate-700" />
        <SummaryCard label="Total LP Equity" value={fmt(summary.total_initial_lp_equity)} color="text-blue-700" />
        <SummaryCard label="Avg Annual ROI" value={fmtPct(summary.avg_annual_roi_pct)} color="text-purple-700" />
        <SummaryCard label="Avg Cash Yield" value={fmtPct(summary.avg_coc_pct)} color="text-amber-700" />
        <SummaryCard label="Total Cap Gain" value={fmtPct(summary.cap_gain_return_pct)} color="text-green-700" />
      </div>

      {/* Pro forma table */}
      <Card>
        <CardContent className="pt-3 pb-3 px-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="py-2 pl-3 pr-2 text-left text-xs font-semibold sticky left-0 bg-slate-800">
                  {data.lp_name || "LP Investor Pro Forma"}
                </th>
                {yearCols.map((c) => (
                  <th key={c.key} className="py-2 px-2 text-right text-xs font-semibold">
                    {c.label}
                    <div className="text-[9px] font-normal opacity-80">{c.sub}</div>
                  </th>
                ))}
                <th className="py-2 px-2 text-right text-xs font-semibold border-l border-slate-600">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {/* ── 1. CAPITAL STACK & EQUITY BUILD ─────────────── */}
              <Section title="Capital Stack & Equity Build" />
              <Row
                label="Property Portfolio Price"
                values={years.map((y) => y.property_portfolio_price)}
                total={undefined}
              />
              <Row
                label="Closing Costs of Financing (to GP)"
                hint={`${fees.acquisition_fee_pct}% of equity`}
                values={years.map((y, i) => (i === 0 ? summary.acquisition_fees_to_gp : 0))}
                total={summary.acquisition_fees_to_gp}
              />
              <Row
                label="LP Sales Commissions (Finders)"
                hint={`${fees.selling_commission_pct}% of equity`}
                values={years.map((y, i) => (i === 0 ? summary.selling_commission : 0))}
                total={summary.selling_commission}
              />
              <Row
                label="Distribution from Refinancing"
                hint="Cash to LP from refi events"
                values={years.map((y) => -(y.refi_distribution_to_lp || 0))}
                total={-totalRefiDist}
              />
              <Row
                label="Total LP Equity Capital Invested"
                values={years.map((y) => y.lp_equity_invested_this_year)}
                total={totalLpEquityIn}
                isHeader
                className="bg-yellow-50 font-semibold"
              />

              {/* ── 2. PORTFOLIO VALUE & LP EQUITY POSITION ─────── */}
              <Section title="Portfolio Value & LP Equity Position" />
              <Row
                label="Property Portfolio Investment Value"
                values={years.map((y) => y.property_portfolio_price)}
              />
              <Row
                label="Mortgage Balance (EOY)"
                values={years.map((y) => -(y.mortgage_balance_eoy || 0))}
              />
              <Row
                label="LP Equity Investment Value (EOY)"
                values={years.map((y) => y.lp_equity_value_eoy)}
                isHeader
                className="bg-blue-50"
              />

              {/* ── 3. OPERATING PRO FORMA ───────────────────────── */}
              <Section title="Operating Pro Forma" />
              <Row label="Gross Rental Income" values={years.map((y) => y.gross_rents)} total={totalGrossRents} />
              <Row
                label="Total Operating Expenses"
                values={years.map((y) => -(y.expenses_total || 0))}
                total={-totalExpenses}
              />
              <Row
                label="Net Operating Income (NOI)"
                values={years.map((y) => y.noi)}
                total={totalNoi}
                isHeader
                className="bg-green-50 font-semibold"
              />
              <Row
                label="Mortgage Payment (Int + Principal)"
                values={years.map((y) => -(y.debt_service || 0))}
                total={-totalDebtService}
              />
              <Row
                label="Construction Cost"
                values={years.map((y) => -(y.construction_cost || 0))}
                total={-years.reduce((s, y) => s + (y.construction_cost || 0), 0)}
              />
              <Row
                label="Total Investment Cash Flow to LP"
                values={years.map((y) => y.net_cashflow_to_lp)}
                total={totalNetCfToLp}
                isHeader
                className="bg-emerald-50 font-bold"
              />

              {/* ── 4. ANTICIPATED RETURN ──────────────────────── */}
              <Section title="Anticipated Annual Return to LP Investors" />
              <Row
                label="Estimated Cash-on-Cash Return"
                values={years.map((y) => y.coc_pct)}
                total={summary.avg_coc_pct}
                totalFmt="percent"
              />
              <Row
                label="Equity from Principal Paydown"
                values={years.map((y) => y.principal_paydown_pct)}
                total={summary.avg_principal_paydown_pct}
                totalFmt="percent"
              />
              <Row
                label="Estimated Capital Gain Return"
                values={years.map((y) => y.cap_gain_return_pct)}
                total={summary.cap_gain_return_pct}
                totalFmt="percent"
              />
              <Row
                label="Total Anticipated Return to LP"
                values={years.map((y) => y.total_return_pct)}
                total={summary.avg_annual_roi_pct}
                totalFmt="percent"
                isHeader
                className="bg-yellow-100 font-bold"
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── 5. $100K INVESTOR REFERENCE ─────────────────────────── */}
      <Card>
        <CardContent className="pt-3 pb-3 px-2 overflow-x-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 px-3 py-2">
            Return on {fmt(ref?.investment_amount)} LP Investment
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="py-2 pl-3 pr-2 text-left text-xs font-semibold sticky left-0 bg-slate-800">
                  Cash Flow Component
                </th>
                {ref?.years?.map((y: any) => (
                  <th key={y.year_number} className="py-2 px-2 text-right text-xs font-semibold">
                    Year {y.year_number}
                    <div className="text-[9px] font-normal opacity-80">{y.calendar_year}</div>
                  </th>
                ))}
                <th className="py-2 px-2 text-right text-xs font-semibold border-l border-slate-600">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1.5 pl-3 pr-2 text-xs">Cash Flow from Investment</td>
                {ref?.years?.map((y: any, i: number) => (
                  <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs">
                    {i === 0 ? fmtSigned(-(ref.investment_amount || 0)) : "—"}
                  </td>
                ))}
                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold border-l">
                  {fmtSigned(-(ref.investment_amount || 0))}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pl-3 pr-2 text-xs">Net Rental Cash Flow</td>
                {ref?.years?.map((y: any, i: number) => (
                  <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs">
                    {fmtSigned(y.net_cashflow)}
                  </td>
                ))}
                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold border-l">
                  {fmtSigned(ref?.years?.reduce((s: number, y: any) => s + (y.net_cashflow || 0), 0))}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pl-3 pr-2 text-xs">Equity from Principal Paydown</td>
                {ref?.years?.map((y: any, i: number) => (
                  <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs">
                    {fmtSigned(y.principal_paydown)}
                  </td>
                ))}
                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold border-l">
                  {fmtSigned(ref?.years?.reduce((s: number, y: any) => s + (y.principal_paydown || 0), 0))}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pl-3 pr-2 text-xs">Anticipated Capital Gain</td>
                {ref?.years?.map((y: any, i: number) => (
                  <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs">
                    {fmtSigned(y.capital_gain)}
                  </td>
                ))}
                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold border-l">
                  {fmtSigned(ref?.years?.reduce((s: number, y: any) => s + (y.capital_gain || 0), 0))}
                </td>
              </tr>
              <tr className="bg-yellow-100 font-bold">
                <td className="py-1.5 pl-3 pr-2 text-xs">Total Cash Back on {fmt(ref?.investment_amount)}</td>
                {ref?.years?.map((y: any, i: number) => (
                  <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs">
                    {fmtSigned(y.total_cash_back)}
                  </td>
                ))}
                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-bold border-l">
                  {fmt(ref?.total_cash_returned)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Fee assumptions footnote */}
      <Card className="bg-muted/30">
        <CardContent className="pt-3 pb-3 px-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Fee Assumptions
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[10px]">
            <Fact label="Acquisition Fee (to GP)" value={`${fees.acquisition_fee_pct}%`} />
            <Fact label="Selling Commission" value={`${fees.selling_commission_pct}%`} />
            <Fact label="Annual Management Fee" value={`${fees.annual_management_fee_pct}% of EGI`} />
            <Fact label="LP Profit Share" value={`${fees.lp_profit_share_pct}%`} />
            <Fact label="GP Profit Share" value={`${fees.gp_profit_share_pct}%`} />
            <Fact label="Preferred Return" value={`${fees.preferred_return_rate_pct}%`} />
            <Fact label="GP Promote" value={`${fees.gp_promote_pct}%`} />
            <Fact label="Liquidation Cost" value={`${fees.liquidation_cost_pct}%`} />
          </div>
          <p className="text-[10px] text-muted-foreground italic mt-2">
            Waterfall mode: <strong>{data.waterfall_mode === "european" ? "European 4-tier (with preferred return + catch-up)" : "Simple split (LP/GP appreciation share)"}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className={cn("border-l-4", "border-l-slate-400")}>
      <CardContent className="pt-3 pb-3 px-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-xl font-bold mt-0.5", color || "text-slate-700")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> <strong>{value}</strong>
    </div>
  );
}
