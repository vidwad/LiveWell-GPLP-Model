"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ChevronDown, ChevronRight, Download, AlertTriangle } from "lucide-react";
import Link from "next/link";
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

interface Props {
  lpId: number;
}

export function PortfolioCashFlowTab({ lpId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["lp-portfolio-cashflow", lpId],
    queryFn: () =>
      apiClient.get(`/api/portfolio/lp/${lpId}/portfolio-cashflow`).then((r) => r.data),
    enabled: lpId > 0,
  });

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  if (isLoading || !data) {
    return <div className="py-8 text-center text-muted-foreground">Loading portfolio cash flow…</div>;
  }

  if ((data.property_count || 0) === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No properties are linked to this LP yet. Add properties under the Property Holdings tab to see an aggregated cash flow.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { periods, returns, by_property: byProperty, errors, horizon, lp_name } = data;
  const breakdowns = (returns?.breakdowns || {}) as Record<string, any>;

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const isExpandable = (row: any) => Array.isArray(row.months) && row.months.length > 0;

  const metricCards: { key: string; label: string; sub: string; value: string; color: string; tw: string }[] = [
    {
      key: "initial_year_coc",
      label: "Initial Year CoC",
      sub: "Portfolio Year 1 yield",
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
      sub: `${horizon?.years ?? "—"} year horizon`,
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

  const downloadCsv = () => {
    const url = `${apiClient.defaults.baseURL || ""}/api/portfolio/lp/${lpId}/portfolio-cashflow.csv`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">{lp_name} — Portfolio Cash Flow</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggregated lifetime cash flow across <strong>{data.property_count}</strong> {data.property_count === 1 ? "property" : "properties"}
            {horizon?.start && horizon?.end && <> &middot; {horizon.start} → {horizon.end}</>}
            <span className="ml-2 italic">(pre-fee, pre-promote)</span>
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="text-xs px-3 py-1.5 rounded border border-input bg-background hover:bg-muted inline-flex items-center gap-1.5"
          title="Download portfolio cash flow as CSV"
        >
          <Download className="h-3.5 w-3.5" /> Download CSV
        </button>
      </div>

      {/* ── Five metric cards ───────────────────────── */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">
          Portfolio Return Metrics{" "}
          <span className="text-[10px] italic font-normal">(click any card for the calculation)</span>
        </p>
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
                  isSelected ? "ring-2 ring-primary/60 shadow-md" : "",
                )}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{m.label}</p>
                <p className={cn("text-2xl font-bold mt-0.5", m.color)}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
              </button>
            );
          })}
        </div>

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
              <div className="space-y-1 mb-3 max-h-72 overflow-y-auto">
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

      {/* ── Aggregated Lifetime Cash Flow Table ───── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Aggregated Lifetime Cash Flow
            <span className="text-xs text-muted-foreground font-normal ml-1">
              Click a year to see monthly detail
            </span>
          </CardTitle>
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
                  <TableHead className="text-right">Refi</TableHead>
                  <TableHead className="text-right">Net Cash Flow</TableHead>
                  <TableHead className="text-right">Cumulative</TableHead>
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
                            {expandable
                              ? expanded
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />
                              : <span className="w-3.5" />}
                            {row.period}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{row.revenue_budget ? fmt(row.revenue_budget) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-orange-600">{row.expenses_budget ? `(${fmt(row.expenses_budget)})` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">{row.noi_budget ? fmt(row.noi_budget) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{row.debt_service_budget ? `(${fmt(row.debt_service_budget)})` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-blue-600">{row.interest_reserve_draw ? fmt(row.interest_reserve_draw) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-orange-600">{row.construction_cost ? `(${fmt(row.construction_cost)})` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-blue-600">{row.construction_loan_draw ? fmt(row.construction_loan_draw) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-indigo-600">{row.refinance_proceeds ? fmt(row.refinance_proceeds) : "—"}</TableCell>
                        <TableCell className={cn("text-right tabular-nums text-sm font-semibold", row.net_cashflow_budget >= 0 ? "text-green-600" : "text-red-600")}>{fmt(row.net_cashflow_budget)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums text-sm", row.cumulative_budget >= 0 ? "text-green-600" : "text-red-600")}>{fmt(row.cumulative_budget)}</TableCell>
                      </TableRow>
                      {expandable && expanded && row.months.map((mr: any, m: number) => (
                        <TableRow key={`${i}-m${m}`} className="bg-muted/10 text-xs">
                          <TableCell className="pl-8 text-muted-foreground">{mr.month}</TableCell>
                          <TableCell className="text-right tabular-nums">{mr.revenue_budget ? fmt(mr.revenue_budget) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-orange-600/80">{mr.expenses_budget ? `(${fmt(mr.expenses_budget)})` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{mr.noi_budget ? fmt(mr.noi_budget) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{mr.debt_service_budget ? `(${fmt(mr.debt_service_budget)})` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-blue-600/80">{mr.interest_reserve_draw ? fmt(mr.interest_reserve_draw) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-orange-600/80">{mr.construction_cost ? `(${fmt(mr.construction_cost)})` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-blue-600/80">{mr.construction_loan_draw ? fmt(mr.construction_loan_draw) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-indigo-600/80">{mr.refinance_proceeds ? fmt(mr.refinance_proceeds) : "—"}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", mr.net_cashflow_budget >= 0 ? "text-green-600/80" : "text-red-600/80")}>{fmt(mr.net_cashflow_budget)}</TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── By-property contribution ─────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Per-Property Contribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Property</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Hold Yrs</TableHead>
                  <TableHead className="text-right">Equity In</TableHead>
                  <TableHead className="text-right">Total Return</TableHead>
                  <TableHead className="text-right">EM</TableHead>
                  <TableHead className="text-right">Annualized ROI</TableHead>
                  <TableHead className="text-right">Initial CoC</TableHead>
                  <TableHead className="text-right">Stab CoC</TableHead>
                  <TableHead className="text-right">Hold CoC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProperty.map((bp: any) => (
                  <TableRow key={bp.property_id}>
                    <TableCell>
                      <Link href={`/portfolio/${bp.property_id}`} className="text-primary hover:underline">
                        {bp.address}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{bp.city}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{bp.stage}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{bp.hold_years ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{bp.equity_invested != null ? fmt(bp.equity_invested) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{bp.total_return != null ? fmt(bp.total_return) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{bp.equity_multiple != null ? `${bp.equity_multiple}x` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{bp.annualized_roi != null ? `${bp.annualized_roi}%` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{bp.initial_year_coc != null ? `${bp.initial_year_coc}%` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{bp.stabilized_avg_coc != null ? `${bp.stabilized_avg_coc}%` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{bp.hold_period_avg_coc != null ? `${bp.hold_period_avg_coc}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Errors ───────────────────────────────── */}
      {errors && errors.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Properties skipped from rollup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1">
              {errors.map((e: any, i: number) => (
                <li key={i}>
                  <strong>#{e.property_id}</strong> {e.address}: <span className="text-amber-800">{e.error}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
