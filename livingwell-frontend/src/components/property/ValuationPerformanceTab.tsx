"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  BarChart3, TrendingUp, DollarSign, Target, AlertTriangle, ExternalLink,
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
};

const TYPE_BG: Record<string, string> = {
  acquisition: "bg-purple-50/50",
  construction: "bg-orange-50/50",
  disposition: "bg-green-50/50",
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

  if (isLoading || !data) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  const { periods, assumptions, returns, disposition, actual_disposition } = data;

  const SourceLink = ({ source, tab }: { source: string; tab?: string }) => (
    <button
      onClick={() => tab && onNavigateTab?.(tab)}
      className={cn("text-[10px] text-muted-foreground italic", tab && "hover:text-primary hover:underline cursor-pointer")}
      title={tab ? `Go to ${tab} tab to edit` : undefined}
    >
      {source} {tab && <ExternalLink className="h-2.5 w-2.5 inline ml-0.5" />}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* ═══ RETURN METRICS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Total Return</p>
            <p className={cn("text-xl font-bold", (returns.total_return || 0) >= 0 ? "text-green-700" : "text-red-600")}>{fmt(returns.total_return)}</p>
            <p className="text-[10px] text-muted-foreground">on {fmt(returns.total_equity_invested)} equity</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Equity Multiple</p>
            <p className="text-xl font-bold text-blue-700">{returns.equity_multiple != null ? `${returns.equity_multiple}x` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">{data.hold_years}-year hold</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Annualized ROI</p>
            <p className="text-xl font-bold text-purple-700">{returns.annualized_roi != null ? `${returns.annualized_roi}%` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">compounded annually</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Avg Cash-on-Cash</p>
            <p className="text-xl font-bold text-amber-700">{returns.avg_cash_on_cash != null ? `${returns.avg_cash_on_cash}%` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">annual operating yield</p>
          </CardContent>
        </Card>
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
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Lifetime Cash Flow — Budget
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
                  <TableHead className="text-right">Construction</TableHead>
                  <TableHead className="text-right">Net Cash Flow</TableHead>
                  <TableHead className="text-right">Cumulative</TableHead>
                  <TableHead className="text-right min-w-[100px]">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((row: any, i: number) => (
                  <TableRow key={i} className={TYPE_BG[row.type] || ""}>
                    <TableCell className={cn("font-medium text-sm", TYPE_COLORS[row.type])}>
                      {row.period}
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
                    <TableCell className="text-right tabular-nums text-sm text-orange-600">
                      {row.construction_cost ? `(${fmt(row.construction_cost)})` : "—"}
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
                ))}
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
                  const em = assumptions.initial_equity > 0 ? (totalRet / assumptions.initial_equity + 1) : null;
                  const roi = assumptions.initial_equity > 0 && data.hold_years > 0
                    ? ((((totalRet + assumptions.initial_equity) / assumptions.initial_equity) ** (1 / data.hold_years)) - 1) * 100 : null;
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
