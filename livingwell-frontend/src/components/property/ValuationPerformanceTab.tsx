"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  BarChart3, TrendingUp, DollarSign, Target, AlertTriangle, ExternalLink, ChevronRight, ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n) : "—";

const TYPE_COLORS: Record<string, string> = {
  acquisition: "text-purple-600",
  operating: "text-blue-600",
  construction: "text-orange-600",
  stabilized: "text-green-600",
  disposition: "text-red-600",
  refinance: "text-indigo-600 font-semibold",
  mixed: "text-blue-600",
};

const TYPE_BG: Record<string, string> = {
  acquisition: "bg-purple-50/50",
  construction: "bg-orange-50/50",
  disposition: "bg-green-50/50",
  refinance: "bg-indigo-50/60",
};

interface ValuationPerformanceTabProps {
  propertyId: number;
  canEdit: boolean;
  property: Record<string, any>;
  onNavigateTab?: (tab: string) => void;
}

export function ValuationPerformanceTab({ propertyId, canEdit, property, onNavigateTab }: ValuationPerformanceTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["lifetime-cashflow", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/lifetime-cashflow`).then(r => r.data),
    enabled: propertyId > 0,
  });

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  if (isLoading || !data) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  const { periods, assumptions, returns, disposition, actual_disposition } = data;

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const isExpandable = (row: any) => ["operating", "stabilized", "construction", "mixed", "refinance"].includes(row.type);

  const SourceLink = ({ source, tab }: { source: string; tab?: string }) => (
    <button
      onClick={() => tab && onNavigateTab?.(tab)}
      className={cn("text-[10px] text-muted-foreground italic", tab && "hover:text-primary hover:underline cursor-pointer")}
      title={tab ? `Go to ${tab} tab to edit` : undefined}
    >
      {source} {tab && <ExternalLink className="h-2.5 w-2.5 inline ml-0.5" />}
    </button>
  );

  // Selected metric for the breakdown panel (null = none expanded)
  const breakdowns = (returns?.breakdowns || {}) as Record<string, any>;
  const metricCards: { key: string; label: string; sub: string; value: string; color: string; tw: string }[] = [
    {
      key: "initial_year_coc",
      label: "Initial Year CoC",
      sub: "Year 1 operating yield",
      value: returns?.initial_year_coc != null ? `${returns.initial_year_coc}%` : "—",
      color: "text-blue-700",
      tw: "border-l-blue-500",
    },
    {
      key: "stabilized_avg_coc",
      label: "Stabilized CoC",
      sub: "Avg of stabilized years",
      value: returns?.stabilized_avg_coc != null ? `${returns.stabilized_avg_coc}%` : "—",
      color: "text-green-700",
      tw: "border-l-green-500",
    },
    {
      key: "hold_period_avg_coc",
      label: "Hold-Period CoC",
      sub: "Avg across all hold years",
      value: returns?.hold_period_avg_coc != null ? `${returns.hold_period_avg_coc}%` : "—",
      color: "text-amber-700",
      tw: "border-l-amber-500",
    },
    {
      key: "equity_multiple",
      label: "Equity Multiple",
      sub: `${data.hold_years}-year hold`,
      value: returns?.equity_multiple != null ? `${returns.equity_multiple}x` : "—",
      color: "text-indigo-700",
      tw: "border-l-indigo-500",
    },
    {
      key: "annualized_roi",
      label: "Annualized ROI",
      sub: "Compounded annually",
      value: returns?.annualized_roi != null ? `${returns.annualized_roi}%` : "—",
      color: "text-purple-700",
      tw: "border-l-purple-500",
    },
  ];

  const fmtInput = (input: any): string => {
    const v = input.value;
    if (v == null) return "—";
    if (input.format === "currency") {
      return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
    }
    if (input.format === "multiple") return `${v}x`;
    if (input.format === "number") return String(v);
    return String(v);
  };

  return (
    <div className="space-y-6">
      {/* ═══ RETURN METRICS — five canonical CoC variants, click for breakdown ═══ */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Recommended Return Metrics Summary <span className="text-[10px] italic font-normal">(click any card for the calculation)</span></p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {metricCards.map((m) => {
            const isSelected = selectedMetric === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMetric(isSelected ? null : m.key)}
                className={cn(
                  "text-left border-l-4 rounded-md border bg-card transition-all px-3 pt-3 pb-2 hover:shadow-md",
                  m.tw,
                  isSelected ? "ring-2 ring-primary/60 shadow-md" : ""
                )}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{m.label}</p>
                <p className={cn("text-2xl font-bold mt-0.5", m.color)}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Breakdown panel for the selected metric */}
        {selectedMetric && breakdowns[selectedMetric] && (
          <Card className="mt-3 border-primary/40">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold">{breakdowns[selectedMetric].label}</p>
                  <p className="text-[11px] text-muted-foreground italic mt-0.5">{breakdowns[selectedMetric].formula}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMetric(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  title="Close"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1 mb-3">
                {(breakdowns[selectedMetric].inputs || []).map((inp: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs border-b border-dashed border-muted-foreground/20 py-1">
                    <span className="text-muted-foreground">{inp.name}</span>
                    <span className="font-medium tabular-nums">{fmtInput(inp)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-muted/40 rounded px-3 py-2 mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Calculation</p>
                <p className="text-sm font-mono">{breakdowns[selectedMetric].calculation}</p>
                <p className="text-base font-bold mt-1">= {breakdowns[selectedMetric].result}</p>
              </div>
              {breakdowns[selectedMetric].interpretation && (
                <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                  {breakdowns[selectedMetric].interpretation}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ KEY ASSUMPTIONS (with source links) ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Key Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Purchase Price</span>
              <div className="text-right">
                <span className="font-medium text-xs">{fmt(assumptions.purchase_price)}</span>
                <br /><SourceLink source="Acquisition" tab="acquisition" />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Initial Equity</span>
              <div className="text-right">
                <span className="font-medium text-xs">{fmt(assumptions.initial_equity)}</span>
                <br /><SourceLink source="Acquisition" tab="acquisition" />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Exit Cap Rate</span>
              <div className="text-right">
                <span className="font-medium text-xs">{assumptions.exit_cap_rate}%</span>
                <br /><SourceLink source={assumptions.exit_cap_rate_source} tab="acquisition" />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Selling Costs</span>
              <div className="text-right">
                <span className="font-medium text-xs">{assumptions.selling_cost_pct}%</span>
                <br /><SourceLink source={assumptions.selling_cost_source} tab="acquisition" />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Rent Growth</span>
              <span className="font-medium text-xs">{assumptions.rent_growth_pct}%/yr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Expense Growth</span>
              <span className="font-medium text-xs">{assumptions.expense_growth_pct}%/yr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Hold Period</span>
              <div className="text-right">
                <span className="font-medium text-xs">{data.hold_years} years</span>
                <br /><SourceLink source="Acquisition" tab="acquisition" />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs">Initial Debt</span>
              <div className="text-right">
                <span className="font-medium text-xs">{fmt(assumptions.initial_debt)}</span>
                <br /><SourceLink source="Lender Financing" tab="debt" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ LIFETIME CASH FLOW TABLE ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Lifetime Cash Flow — Budget
            </CardTitle>
            <button
              type="button"
              onClick={() => {
                const url = `${apiClient.defaults.baseURL || ""}/api/portfolio/properties/${propertyId}/lifetime-cashflow.csv?include_monthly=true`;
                window.open(url, "_blank");
              }}
              className="text-xs px-3 py-1.5 rounded border border-input bg-background hover:bg-muted inline-flex items-center gap-1.5"
              title="Download Lifetime Cash Flow as CSV (opens in Excel / Google Sheets)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download CSV
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[180px]">Period</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">NOI</TableHead>
                  <TableHead className="text-right">Debt Service</TableHead>
                  <TableHead className="text-right">Int. Reserve</TableHead>
                  <TableHead className="text-right">Construction</TableHead>
                  <TableHead className="text-right">Loan Draw</TableHead>
                  <TableHead className="text-right">Refi Distribution</TableHead>
                  <TableHead className="text-right">Net Cash Flow</TableHead>
                  <TableHead className="text-right">Cumulative</TableHead>
                  <TableHead className="text-right min-w-[100px]">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((row: any, i: number) => {
                  const expandable = isExpandable(row);
                  const expanded = expandedRows.has(i);
                  return (
                <React.Fragment key={i}>
                  <TableRow
                    className={cn(TYPE_BG[row.type] || "", expandable && "cursor-pointer hover:bg-muted/40")}
                    onClick={expandable ? () => toggleRow(i) : undefined}
                  >
                    <TableCell className={cn("font-medium text-sm", TYPE_COLORS[row.type])}>
                      <span className="inline-flex items-center gap-1">
                        {expandable ? (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
                        {row.period}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.revenue_budget ? fmt(row.revenue_budget) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-orange-600">
                      {row.expenses_budget ? `(${fmt(row.expenses_budget)})` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {row.noi_budget ? fmt(row.noi_budget) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.debt_service_budget ? `(${fmt(row.debt_service_budget)})` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-blue-600" title="Interest reserve drawn from construction loan to fund interest during construction (non-cash to equity)">
                      {row.interest_reserve_draw ? fmt(row.interest_reserve_draw) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-orange-600">
                      {row.construction_cost ? `(${fmt(row.construction_cost)})` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-blue-600" title="Construction loan draw — funds construction cost, non-cash to equity sponsor">
                      {row.construction_loan_draw ? fmt(row.construction_loan_draw) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-indigo-600" title="Refinance distribution: new loan proceeds less old loan payoff. Cash returned to equity at takeout.">
                      {row.refinance_proceeds ? fmt(row.refinance_proceeds) : "—"}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm font-semibold",
                      row.net_cashflow_budget >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {fmt(row.net_cashflow_budget)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm",
                      row.cumulative_budget >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {fmt(row.cumulative_budget)}
                    </TableCell>
                    <TableCell className="text-right">
                      <SourceLink
                        source={row.source?.replace("Acquisition Baseline", "Acq.").replace("Operations", "Ops").replace("Master Plan:", "")}
                        tab={row.source?.includes("Acquisition") ? "acquisition" : row.source?.includes("Operations") ? "operations" : row.source?.includes("Master Plan") ? "strategy" : undefined}
                      />
                    </TableCell>
                  </TableRow>
                  {expandable && expanded && (row.months || []).map((mr: any, m: number) => {
                    const rev = mr.revenue_budget || 0;
                    const exp = mr.expenses_budget || 0;
                    const noi = mr.noi_budget || 0;
                    const ds = mr.debt_service_budget || 0;
                    const ir = mr.interest_reserve_draw || 0;
                    const cc = mr.construction_cost || 0;
                    const cl = mr.construction_loan_draw || 0;
                    const rp = mr.refinance_proceeds || 0;
                    const ncf = mr.net_cashflow_budget || 0;
                    return (
                      <TableRow key={`${i}-m${m}`} className="bg-muted/10 text-xs">
                        <TableCell className="pl-8 text-muted-foreground">{mr.month}</TableCell>
                        <TableCell className="text-right tabular-nums">{rev ? fmt(rev) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-orange-600/80">{exp ? `(${fmt(exp)})` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{noi ? fmt(noi) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{ds ? `(${fmt(ds)})` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-blue-600/80">{ir ? fmt(ir) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-orange-600/80">{cc ? `(${fmt(cc)})` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-blue-600/80">{cl ? fmt(cl) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-indigo-600/80">{rp ? fmt(rp) : "—"}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", ncf >= 0 ? "text-green-600/80" : "text-red-600/80")}>{fmt(ncf)}</TableCell>
                        <TableCell colSpan={2} className="text-[10px] text-muted-foreground italic">{mr.source || ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ DISPOSITION SUMMARY ═══ */}
      <Card className="border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Projected Disposition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Exit NOI</p>
              <p className="text-sm font-bold">{fmt(disposition.exit_noi)}</p>
              <SourceLink source="Operations" tab="operations" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sale Price ({assumptions.exit_cap_rate}% cap)</p>
              <p className="text-sm font-bold">{fmt(disposition.exit_price)}</p>
              <SourceLink source={assumptions.exit_cap_rate_source} tab="acquisition" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Selling Costs ({assumptions.selling_cost_pct}%)</p>
              <p className="text-sm font-bold text-red-600">({fmt(disposition.selling_costs)})</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Debt Payoff</p>
              <p className="text-sm font-bold text-red-600">({fmt(disposition.debt_payoff)})</p>
              <SourceLink source="Lender Financing" tab="debt" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Proceeds</p>
              <p className="text-lg font-bold text-green-700">{fmt(disposition.net_proceeds)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ VALUATION SENSITIVITY ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Valuation Sensitivity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Scenario</TableHead>
                  <TableHead className="text-right">NOI</TableHead>
                  <TableHead className="text-right">Cap Rate</TableHead>
                  <TableHead className="text-right">Property Value</TableHead>
                  <TableHead className="text-right">Net Proceeds</TableHead>
                  <TableHead className="text-right">Equity Multiple</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { label: "Downside", noiAdj: -0.10, capAdj: 0.50, color: "text-red-600" },
                  { label: "Conservative", noiAdj: -0.05, capAdj: 0.25, color: "text-amber-600" },
                  { label: "Base Case", noiAdj: 0, capAdj: 0, color: "text-foreground font-semibold" },
                  { label: "Optimistic", noiAdj: 0.05, capAdj: -0.25, color: "text-blue-600" },
                  { label: "Upside", noiAdj: 0.10, capAdj: -0.50, color: "text-green-600" },
                ].map(s => {
                  const noi = disposition.exit_noi * (1 + s.noiAdj);
                  const cap = assumptions.exit_cap_rate + s.capAdj;
                  const val = cap > 0 ? noi / (cap / 100) : 0;
                  const costs = val * assumptions.selling_cost_pct / 100;
                  const net = val - costs - disposition.debt_payoff;
                  const opCF = returns.total_operating_cashflow || 0;
                  const totalRet = net + opCF;
                  const em = assumptions.initial_equity > 0 ? (totalRet / assumptions.initial_equity) : null;
                  const roi = assumptions.initial_equity > 0 && data.hold_years > 0 && em != null && em > 0
                    ? ((em ** (1 / data.hold_years)) - 1) * 100 : null;
                  return (
                    <TableRow key={s.label} className={s.noiAdj === 0 ? "bg-muted/30" : ""}>
                      <TableCell className={cn("font-medium", s.color)}>{s.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(noi)}</TableCell>
                      <TableCell className="text-right tabular-nums">{cap.toFixed(2)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(val)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums font-medium", net >= 0 ? "text-green-600" : "text-red-600")}>{fmt(net)}</TableCell>
                      <TableCell className="text-right tabular-nums">{em != null ? `${em.toFixed(2)}x` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{roi != null ? `${roi.toFixed(1)}%` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            NOI adjusted +/-5% and +/-10%. Cap rate adjusted +/-25bps and +/-50bps from {assumptions.exit_cap_rate}% base.
          </p>
        </CardContent>
      </Card>

      {/* ═══ ACTUAL DISPOSITION (if exists) ═══ */}
      {actual_disposition && (
        <Card className="border-amber-200 bg-amber-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-600" />
              Actual Disposition
              <Badge variant="outline" className="ml-2">Realized</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {actual_disposition.close_date && <div><p className="text-xs text-muted-foreground">Close Date</p><p className="font-medium">{actual_disposition.close_date}</p></div>}
              {actual_disposition.sale_price > 0 && <div><p className="text-xs text-muted-foreground">Sale Price</p><p className="font-medium">{fmt(actual_disposition.sale_price)}</p></div>}
              {actual_disposition.net_proceeds > 0 && <div><p className="text-xs text-muted-foreground">Net Proceeds</p><p className="font-bold text-green-700">{fmt(actual_disposition.net_proceeds)}</p></div>}
              {actual_disposition.realized_equity_multiple > 0 && <div><p className="text-xs text-muted-foreground">Realized Multiple</p><p className="font-bold">{actual_disposition.realized_equity_multiple}x</p></div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
