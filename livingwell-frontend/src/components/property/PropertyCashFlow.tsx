"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  BarChart3, DollarSign, ChevronDown, ChevronRight, Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n) : "—";

interface PropertyCashFlowProps {
  propertyId: number;
  activePhase: "as_is" | "post_renovation" | "full_development";
  phasePlanId: number | null;
  totalAnnualDebtService: number;
  totalDebtOutstanding: number;
  property: Record<string, any>;
}

export function PropertyCashFlow({
  propertyId, activePhase, phasePlanId, totalAnnualDebtService, totalDebtOutstanding, property,
}: PropertyCashFlowProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["phase-cashflow", propertyId, phasePlanId],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (phasePlanId) params.plan_id = String(phasePlanId);
      return apiClient.get(`/api/portfolio/properties/${propertyId}/phase-cashflow`, { params }).then(r => r.data);
    },
    enabled: propertyId > 0,
  });

  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading cash flow...</div>;
  if (!data) return <div className="py-8 text-center text-muted-foreground">No data available. Configure Operations and Lender Financing first.</div>;

  const { summary, years, totals, phase_name, phase_start, phase_end, total_months } = data;

  const formatDateShort = (d: string) => {
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return d; }
  };

  return (
    <div className="space-y-6">
      {/* Phase Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            {phase_name}
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateShort(phase_start)} — {formatDateShort(phase_end)}
            <span className="text-xs">({total_months} months)</span>
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {activePhase === "as_is" ? "As-Is" : data.plan_id ? phase_name : "Baseline"}
        </Badge>
      </div>

      {/* Operating Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Annualized Operating Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm max-w-xl">
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Gross Potential Rent</span>
              <span className="font-medium tabular-nums">{fmt(summary.annual_gpr)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Ancillary Revenue</span>
              <span className="font-medium tabular-nums">{fmt(summary.annual_ancillary)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Vacancy ({summary.vacancy_rate}%)</span>
              <span className="font-medium tabular-nums text-red-600">included</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Effective Gross Income</span>
              <span className="font-semibold tabular-nums">{fmt(summary.annual_egi)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Operating Expenses</span>
              <span className="font-medium tabular-nums text-orange-600">({fmt(summary.annual_expenses)})</span>
            </div>
            <div className="flex justify-between py-1.5 border-b-2 border-foreground/20">
              <span className="font-semibold">Net Operating Income</span>
              <span className="font-bold tabular-nums text-green-700">{fmt(summary.annual_noi)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Annual Debt Service</span>
              <span className="font-medium tabular-nums">({fmt(summary.annual_debt_service)})</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="font-semibold">Cash Flow After Debt</span>
              <span className={cn("font-bold tabular-nums", (summary.annual_cashflow || 0) >= 0 ? "text-green-700" : "text-red-600")}>{fmt(summary.annual_cashflow)}</span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className={cn("rounded-lg border p-3", summary.dscr && summary.dscr >= 1.2 ? "bg-green-50 border-green-200" : summary.dscr && summary.dscr >= 1.0 ? "bg-amber-50 border-amber-200" : "bg-muted")}>
              <p className="text-[10px] text-muted-foreground font-medium uppercase">DSCR</p>
              <p className={cn("text-lg font-bold", summary.dscr && summary.dscr >= 1.2 ? "text-green-700" : summary.dscr && summary.dscr >= 1.0 ? "text-amber-700" : "")}>{summary.dscr ? `${summary.dscr}x` : "—"}</p>
            </div>
            <div className="rounded-lg border bg-blue-50 border-blue-200 p-3">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Units / Beds</p>
              <p className="text-lg font-bold text-blue-700">{summary.units} / {summary.beds}</p>
            </div>
            <div className="rounded-lg border bg-purple-50 border-purple-200 p-3">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Cash-on-Cash</p>
              <p className="text-lg font-bold text-purple-700">{summary.cash_on_cash != null ? `${summary.cash_on_cash}%` : "—"}</p>
            </div>
            <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">NOI / Unit</p>
              <p className="text-lg font-bold text-emerald-700">{summary.units > 0 ? fmt(summary.annual_noi / summary.units) : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Table with Expandable Monthly Rows */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            {activePhase === "as_is" ? "As-Is Period Cash Flow" : `Stabilized Period Cash Flow — Post ${phase_name || "Development"}`}
            <span className="text-xs text-muted-foreground font-normal ml-1">Click a year to see monthly detail</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[160px]">Period</TableHead>
                  <TableHead className="text-right">Revenue (EGI)</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">NOI</TableHead>
                  <TableHead className="text-right">Debt Service</TableHead>
                  <TableHead className="text-right">Net Cash Flow</TableHead>
                  <TableHead className="text-right">Cumulative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((year: any) => (
                  <React.Fragment key={year.year}>
                    {/* Year summary row */}
                    <TableRow
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleYear(year.year)}
                    >
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          {expandedYears.has(year.year) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                          <div>
                            <span>{year.label}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">
                              {formatDateShort(year.start)} — {formatDateShort(year.end)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{fmt(year.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-orange-600">({fmt(year.expenses)})</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">{fmt(year.noi)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">({fmt(year.debt_service)})</TableCell>
                      <TableCell className={cn("text-right tabular-nums text-sm font-semibold", year.net_cashflow >= 0 ? "text-green-600" : "text-red-600")}>{fmt(year.net_cashflow)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums text-sm", year.cumulative >= 0 ? "text-green-600" : "text-red-600")}>{fmt(year.cumulative)}</TableCell>
                    </TableRow>

                    {/* Expanded monthly rows */}
                    {expandedYears.has(year.year) && year.monthly_detail?.map((m: any, mi: number) => (
                      <TableRow key={`${year.year}-${mi}`} className="bg-muted/10">
                        <TableCell className="text-xs text-muted-foreground pl-10">{m.month}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{fmt(m.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-orange-400">({fmt(m.expenses)})</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{fmt(m.noi)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">({fmt(m.debt_service)})</TableCell>
                        <TableCell className={cn("text-right tabular-nums text-xs", m.net_cashflow >= 0 ? "text-green-500" : "text-red-500")}>{fmt(m.net_cashflow)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums text-xs", m.cumulative >= 0 ? "text-green-500" : "text-red-500")}>{fmt(m.cumulative)}</TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}

                {/* Totals row */}
                <TableRow className="border-t-2 bg-muted/30 font-semibold">
                  <TableCell className="text-sm">Total ({total_months} months)</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{fmt(totals.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-orange-600">({fmt(totals.expenses)})</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-bold">{fmt(totals.noi)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">({fmt(totals.debt_service)})</TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm font-bold", totals.net_cashflow >= 0 ? "text-green-700" : "text-red-700")}>{fmt(totals.net_cashflow)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
