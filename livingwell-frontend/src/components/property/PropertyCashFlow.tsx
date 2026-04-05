"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  BarChart3, TrendingUp, DollarSign, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n) : "—";
const fmtPct = (n: number | null | undefined) => n != null ? `${Number(n).toFixed(1)}%` : "—";

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
  // Pull NOI from underwriting summary (reads from Operations data)
  const { data: uw } = useQuery({
    queryKey: ["underwriting-summary-cf", propertyId, phasePlanId],
    queryFn: () => {
      const params: Record<string, string> = { vacancy_rate: "5", cap_rate: "5.5" };
      if (phasePlanId) params.plan_id = String(phasePlanId);
      return apiClient.get(`/api/portfolio/properties/${propertyId}/underwriting-summary`, { params }).then(r => r.data);
    },
    enabled: propertyId > 0,
  });

  // Pull acquisition baseline for equity and exit assumptions
  const { data: baseline } = useQuery({
    queryKey: ["acquisition-baseline", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/acquisition-baseline`).then(r => r.data),
    enabled: propertyId > 0,
  });

  // Pull exit forecast
  const { data: exitForecast } = useQuery({
    queryKey: ["exit-forecast", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/exit-forecast`).then(r => r.data),
    enabled: propertyId > 0,
  });

  // Pull financial snapshot for rent roll totals
  const { data: snapshot } = useQuery({
    queryKey: ["financial-snapshot", propertyId, phasePlanId],
    queryFn: () => {
      const url = phasePlanId
        ? `/api/portfolio/properties/${propertyId}/financial-snapshot?plan_id=${phasePlanId}`
        : `/api/portfolio/properties/${propertyId}/financial-snapshot`;
      return apiClient.get(url).then(r => r.data);
    },
    enabled: propertyId > 0,
  });

  if (!uw) return null;

  // Extract key metrics
  const gpr = uw.gross_potential_rent || 0;
  const ancillary = uw.ancillary_revenue || 0;
  const grossPotential = uw.gross_potential_revenue || 0;
  const vacancyRate = uw.vacancy_rate || 5;
  const vacancyLoss = uw.vacancy_loss || 0;
  const egi = uw.effective_gross_income || 0;
  const totalExpenses = uw.total_operating_expenses || 0;
  const expenseRatio = uw.expense_ratio || 0;
  const noi = uw.noi || 0;
  const ads = totalAnnualDebtService;
  const cashFlowAfterDebt = noi - ads;
  const dscr = ads > 0 ? noi / ads : null;

  // Equity and value
  const purchasePrice = Number(property?.purchase_price) || 0;
  const equity = baseline?.exists ? Number(baseline.initial_equity || 0) : purchasePrice - totalDebtOutstanding;
  const currentValue = Number(property?.current_market_value || property?.assessed_value || purchasePrice) || 0;

  // Exit assumptions (from forecast or baseline)
  const exitCapRate = Number(exitForecast?.forecast_exit_cap_rate || baseline?.original_exit_cap_rate || 5.5);
  const exitYear = exitForecast?.forecast_sale_year || baseline?.target_sale_year;
  const holdYears = baseline?.exists ? Number(baseline.target_hold_years || 7) : 7;
  const rentGrowth = Number(property?.annual_rent_increase_pct || 3) / 100;
  const expenseGrowth = 0.02; // 2% default
  const sellingCostPct = Number(exitForecast?.forecast_selling_cost_pct || baseline?.original_selling_cost_pct || 5) / 100;

  // Build year-by-year cash flow projection
  const projections: Array<{
    year: number;
    revenue: number;
    expenses: number;
    noi: number;
    debtService: number;
    cashFlow: number;
    cumulative: number;
  }> = [];

  let cumulative = 0;
  for (let y = 1; y <= holdYears; y++) {
    const revGrowthFactor = Math.pow(1 + rentGrowth, y - 1);
    const expGrowthFactor = Math.pow(1 + expenseGrowth, y - 1);
    const yearRevenue = egi * revGrowthFactor;
    const yearExpenses = totalExpenses * expGrowthFactor;
    const yearNOI = yearRevenue - yearExpenses;
    const yearCF = yearNOI - ads;
    cumulative += yearCF;
    projections.push({
      year: y,
      revenue: yearRevenue,
      expenses: yearExpenses,
      noi: yearNOI,
      debtService: ads,
      cashFlow: yearCF,
      cumulative,
    });
  }

  // Terminal sale event
  const exitNOI = projections.length > 0 ? projections[projections.length - 1].noi : noi;
  const exitPrice = exitCapRate > 0 ? exitNOI / (exitCapRate / 100) : 0;
  const sellingCosts = exitPrice * sellingCostPct;
  const debtPayoff = totalDebtOutstanding; // simplified: assume current balance at exit
  const netSaleProceeds = exitPrice - sellingCosts - debtPayoff;

  // Property-level returns
  const totalCashFlow = cumulative;
  const totalReturn = totalCashFlow + netSaleProceeds;
  const equityMultiple = equity > 0 ? totalReturn / equity : null;
  const cashOnCash = equity > 0 ? (cashFlowAfterDebt / equity) * 100 : null;

  // Simple IRR approximation (annualized)
  const annualizedROI = equity > 0 && holdYears > 0
    ? ((Math.pow(totalReturn / equity, 1 / holdYears) - 1) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Stabilized Operating Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Stabilized Operating Summary
            <Badge variant="secondary" className="ml-2 text-xs">
              {activePhase === "as_is" ? "As-Is" : activePhase === "post_renovation" ? "Post-Renovation" : "Full Development"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm max-w-xl">
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Gross Potential Rent</span>
              <span className="font-medium tabular-nums">{fmt(gpr)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Ancillary Revenue</span>
              <span className="font-medium tabular-nums">{fmt(ancillary)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Vacancy Loss ({vacancyRate}%)</span>
              <span className="font-medium tabular-nums text-red-600">({fmt(vacancyLoss)})</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Effective Gross Income</span>
              <span className="font-semibold tabular-nums">{fmt(egi)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Operating Expenses ({expenseRatio.toFixed(0)}%)</span>
              <span className="font-medium tabular-nums text-orange-600">({fmt(totalExpenses)})</span>
            </div>
            <div className="flex justify-between py-1.5 border-b-2 border-foreground/20">
              <span className="font-semibold">Net Operating Income</span>
              <span className="font-bold tabular-nums text-green-700">{fmt(noi)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dashed">
              <span className="text-muted-foreground">Annual Debt Service</span>
              <span className="font-medium tabular-nums">({fmt(ads)})</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="font-semibold">Cash Flow After Debt</span>
              <span className={cn("font-bold tabular-nums", cashFlowAfterDebt >= 0 ? "text-green-700" : "text-red-600")}>{fmt(cashFlowAfterDebt)}</span>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className={cn("rounded-lg border p-3", dscr && dscr >= 1.2 ? "bg-green-50 border-green-200" : dscr && dscr >= 1.0 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200")}>
              <p className="text-[10px] text-muted-foreground font-medium uppercase">DSCR</p>
              <p className={cn("text-lg font-bold", dscr && dscr >= 1.2 ? "text-green-700" : dscr && dscr >= 1.0 ? "text-amber-700" : "text-red-700")}>{dscr ? `${dscr.toFixed(2)}x` : "—"}</p>
            </div>
            <div className="rounded-lg border bg-blue-50 border-blue-200 p-3">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Cap Rate</p>
              <p className="text-lg font-bold text-blue-700">{noi > 0 && currentValue > 0 ? `${(noi / currentValue * 100).toFixed(2)}%` : "—"}</p>
            </div>
            <div className="rounded-lg border bg-purple-50 border-purple-200 p-3">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Cash-on-Cash</p>
              <p className="text-lg font-bold text-purple-700">{cashOnCash != null ? `${cashOnCash.toFixed(1)}%` : "—"}</p>
            </div>
            <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">NOI / Unit</p>
              <p className="text-lg font-bold text-emerald-700">{uw.total_units > 0 ? fmt(noi / uw.total_units) : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Projection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            {holdYears}-Year Cash Flow Projection
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {rentGrowth > 0 ? `${(rentGrowth * 100).toFixed(0)}% rent growth` : "flat"} &middot; {(expenseGrowth * 100).toFixed(0)}% expense growth
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Revenue (EGI)</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">NOI</TableHead>
                  <TableHead className="text-right">Debt Service</TableHead>
                  <TableHead className="text-right">Cash Flow</TableHead>
                  <TableHead className="text-right">Cumulative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projections.map(row => (
                  <TableRow key={row.year}>
                    <TableCell className="font-medium">{row.year}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-orange-600">({fmt(row.expenses)})</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(row.noi)}</TableCell>
                    <TableCell className="text-right tabular-nums">({fmt(row.debtService)})</TableCell>
                    <TableCell className={cn("text-right tabular-nums font-semibold", row.cashFlow >= 0 ? "text-green-600" : "text-red-600")}>{fmt(row.cashFlow)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", row.cumulative >= 0 ? "text-green-600" : "text-red-600")}>{fmt(row.cumulative)}</TableCell>
                  </TableRow>
                ))}
                {/* Terminal Sale Event */}
                <TableRow className="border-t-2 border-green-300 bg-green-50/50">
                  <TableCell colSpan={7} className="py-1">
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" /> Sale Event — Year {holdYears}
                    </span>
                  </TableCell>
                </TableRow>
                <TableRow className="bg-green-50/30">
                  <TableCell className="font-bold text-green-700">EXIT</TableCell>
                  <TableCell colSpan={2} className="text-right text-xs text-muted-foreground">
                    Exit NOI {fmt(exitNOI)} @ {exitCapRate}% cap
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-700">{fmt(exitPrice)}</TableCell>
                  <TableCell className="text-right text-red-600 text-xs">
                    Costs {fmt(sellingCosts)} + Debt {fmt(debtPayoff)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-700 text-base">{fmt(netSaleProceeds)}</TableCell>
                  <TableCell className="text-right font-bold text-green-700">{fmt(totalReturn)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Property-Level Returns */}
      <Card className="border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Property-Level Returns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Equity Invested</p>
              <p className="text-lg font-bold">{fmt(equity)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Cumulative Cash Flow</p>
              <p className={cn("text-lg font-bold", totalCashFlow >= 0 ? "text-green-700" : "text-red-600")}>{fmt(totalCashFlow)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Net Sale Proceeds</p>
              <p className="text-lg font-bold text-green-700">{fmt(netSaleProceeds)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Return</p>
              <p className="text-lg font-bold text-green-700">{fmt(totalReturn)}</p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Equity Multiple</p>
              <p className="text-2xl font-bold">{equityMultiple != null ? `${equityMultiple.toFixed(2)}x` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Annualized ROI</p>
              <p className="text-2xl font-bold">{annualizedROI != null ? `${annualizedROI.toFixed(1)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Cash-on-Cash</p>
              <p className="text-2xl font-bold">{cashOnCash != null ? `${cashOnCash.toFixed(1)}%` : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sensitivity Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Sensitivity Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Scenario</TableHead>
                  <TableHead className="text-right">Exit NOI</TableHead>
                  <TableHead className="text-right">Exit Cap</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
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
                ].map(scenario => {
                  const sNOI = exitNOI * (1 + scenario.noiAdj);
                  const sCap = exitCapRate + scenario.capAdj;
                  const sPrice = sCap > 0 ? sNOI / (sCap / 100) : 0;
                  const sCosts = sPrice * sellingCostPct;
                  const sNet = sPrice - sCosts - debtPayoff;
                  const sTotal = totalCashFlow + sNet;
                  const sEM = equity > 0 ? sTotal / equity : null;
                  const sROI = equity > 0 && holdYears > 0 ? (Math.pow(sTotal / equity, 1 / holdYears) - 1) * 100 : null;
                  return (
                    <TableRow key={scenario.label} className={scenario.noiAdj === 0 ? "bg-muted/30" : ""}>
                      <TableCell className={cn("font-medium", scenario.color)}>{scenario.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(sNOI)}</TableCell>
                      <TableCell className="text-right tabular-nums">{sCap.toFixed(2)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(sPrice)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums font-medium", sNet >= 0 ? "text-green-600" : "text-red-600")}>{fmt(sNet)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{sEM != null ? `${sEM.toFixed(2)}x` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{sROI != null ? `${sROI.toFixed(1)}%` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            NOI adjusted by +/-5% and +/-10%. Cap rate adjusted by +/-25bps and +/-50bps from base case of {exitCapRate}%.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
