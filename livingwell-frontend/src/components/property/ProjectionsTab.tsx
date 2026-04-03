"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { BarChart3, TrendingUp, DollarSign, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { useRunProjection } from "@/hooks/usePortfolio";
import type { ProjectionResult, ProjectionInput } from "@/types/portfolio";

const PHASE_COLORS: Record<string, string> = {
  interim:      "bg-yellow-100 text-yellow-800",
  construction: "bg-orange-100 text-orange-800",
  lease_up:     "bg-blue-100 text-blue-800",
  stabilized:   "bg-green-100 text-green-800",
};

interface ProjectionsTabProps {
  propertyId: number;
  totalAnnualDebtService: number;
  activePhase?: "as_is" | "post_renovation" | "full_development";
}

export function ProjectionsTab({ propertyId, totalAnnualDebtService, activePhase = "as_is" }: ProjectionsTabProps) {
  const { mutateAsync: runProjection, isPending: projPending } = useRunProjection(propertyId);
  const [projResults, setProjResults] = useState<ProjectionResult | null>(null);
  const [useCapRateCurve, setUseCapRateCurve] = useState(false);
  const [capRateCurvePoints, setCapRateCurvePoints] = useState<{year: string; rate: string}[]>([
    { year: "1", rate: "6.0" },
    { year: "5", rate: "5.5" },
    { year: "10", rate: "5.0" },
  ]);
  const [projForm, setProjForm] = useState({
    planned_units: "", monthly_rent_per_unit: "", annual_expense_ratio: "35",
    vacancy_rate: "5", annual_rent_increase: "3", expense_growth_rate: "2",
    construction_start_date: "", construction_months: "9",
    lease_up_months: "6", annual_debt_service: "", exit_cap_rate: "5.5",
    disposition_cost_pct: "2", total_equity_invested: "", debt_balance_at_exit: "",
    carrying_cost_annual: "",
    management_fee_rate: "2.5", construction_mgmt_fee_rate: "1.5",
    construction_budget: "", selling_commission_rate: "10",
    offering_cost: "250000", acquisition_fee_rate: "2",
    acquisition_cost: "", gross_raise: "",
    refinancing_fee_rate: "2.5", refinance_amount: "",
    turnover_fee_rate: "2", property_fmv_at_turnover: "",
    lp_profit_share: "70", gp_profit_share: "30",
  });

  const handleRunProjection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const input: ProjectionInput = {
        annual_expense_ratio: Number(projForm.annual_expense_ratio) / 100,
        vacancy_rate: Number(projForm.vacancy_rate) / 100,
        annual_rent_increase: Number(projForm.annual_rent_increase) / 100,
        expense_growth_rate: Number(projForm.expense_growth_rate) / 100,
        construction_start_date: projForm.construction_start_date || undefined,
        construction_months: Number(projForm.construction_months),
        lease_up_months: Number(projForm.lease_up_months),
        exit_cap_rate: Number(projForm.exit_cap_rate) / 100,
        disposition_cost_pct: Number(projForm.disposition_cost_pct) / 100,
        projection_years: 10,
        management_fee_rate: Number(projForm.management_fee_rate) / 100,
        construction_mgmt_fee_rate: Number(projForm.construction_mgmt_fee_rate) / 100,
        selling_commission_rate: Number(projForm.selling_commission_rate) / 100,
        acquisition_fee_rate: Number(projForm.acquisition_fee_rate) / 100,
        refinancing_fee_rate: Number(projForm.refinancing_fee_rate) / 100,
        turnover_fee_rate: Number(projForm.turnover_fee_rate) / 100,
        lp_profit_share: Number(projForm.lp_profit_share) / 100,
        gp_profit_share: Number(projForm.gp_profit_share) / 100,
        offering_cost: projForm.offering_cost ? Number(projForm.offering_cost) : undefined,
        construction_budget: projForm.construction_budget ? Number(projForm.construction_budget) : undefined,
        acquisition_cost: projForm.acquisition_cost ? Number(projForm.acquisition_cost) : undefined,
        gross_raise: projForm.gross_raise ? Number(projForm.gross_raise) : undefined,
        refinance_amount: projForm.refinance_amount ? Number(projForm.refinance_amount) : undefined,
        property_fmv_at_turnover: projForm.property_fmv_at_turnover ? Number(projForm.property_fmv_at_turnover) : undefined,
        planned_units: projForm.planned_units ? Number(projForm.planned_units) : undefined,
        monthly_rent_per_unit: projForm.monthly_rent_per_unit ? Number(projForm.monthly_rent_per_unit) : undefined,
        annual_debt_service: projForm.annual_debt_service ? Number(projForm.annual_debt_service) : undefined,
        total_equity_invested: projForm.total_equity_invested ? Number(projForm.total_equity_invested) : undefined,
        debt_balance_at_exit: projForm.debt_balance_at_exit ? Number(projForm.debt_balance_at_exit) : undefined,
        carrying_cost_annual: projForm.carrying_cost_annual ? Number(projForm.carrying_cost_annual) : undefined,
        cap_rate_curve: useCapRateCurve
          ? Object.fromEntries(capRateCurvePoints.filter(p => p.year && p.rate).map(p => [p.year, Number(p.rate) / 100]))
          : undefined,
      };
      const result = await runProjection(input) as ProjectionResult;
      setProjResults(result);
      toast.success("Projection complete");
    } catch (e) { toast.error("Failed to run projection"); }
  };

  const f = projForm;
  const sf = (key: string, val: string) => setProjForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      {/* Phase Context Banner */}
      {activePhase === "as_is" && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <BarChart3 className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">As-Is Projections</span> — Project forward from the property's
              current operating performance. Construction timeline fields are optional.
            </p>
          </CardContent>
        </Card>
      )}
      {activePhase === "post_renovation" && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <BarChart3 className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Post-Renovation Projections</span> — Project forward with
              improved rents and updated unit mix after renovations are complete.
            </p>
          </CardContent>
        </Card>
      )}
      {activePhase === "full_development" && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <BarChart3 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-200">
              <span className="font-medium">Full Development Projections</span> — Includes construction period
              (zero income), lease-up ramp, and stabilized operations for the fully developed property.
            </p>
          </CardContent>
        </Card>
      )}

    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Projection Inputs Panel */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" />Projection Assumptions</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleRunProjection} className="space-y-4">
            {/* Revenue Assumptions */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-700">Revenue Assumptions</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Vacancy Rate (%)</Label><Input type="number" step="0.1" value={f.vacancy_rate} onChange={(e) => sf("vacancy_rate", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Annual Rent Increase (%)</Label><Input type="number" step="0.1" value={f.annual_rent_increase} onChange={(e) => sf("annual_rent_increase", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Planned Units</Label><Input type="number" value={f.planned_units} onChange={(e) => sf("planned_units", e.target.value)} placeholder="Auto from rent roll" /></div>
                <div className="space-y-1"><Label className="text-xs">Rent / Unit ($)</Label><Input type="number" value={f.monthly_rent_per_unit} onChange={(e) => sf("monthly_rent_per_unit", e.target.value)} placeholder="Auto from rent roll" /></div>
              </div>
            </div>
            {/* Expense Assumptions */}
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-orange-700">Expense Assumptions</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Expense Ratio (%)</Label><Input type="number" step="0.1" value={f.annual_expense_ratio} onChange={(e) => sf("annual_expense_ratio", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Expense Growth (%/yr)</Label><Input type="number" step="0.1" value={f.expense_growth_rate} onChange={(e) => sf("expense_growth_rate", e.target.value)} /></div>
              </div>
            </div>
            {/* Development Timeline */}
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-purple-700">Development Timeline</p>
              <div className="space-y-1"><Label className="text-xs">Construction Start</Label><Input type="date" value={f.construction_start_date} onChange={(e) => sf("construction_start_date", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Construction (months)</Label><Input type="number" value={f.construction_months} onChange={(e) => sf("construction_months", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Lease-Up (months)</Label><Input type="number" value={f.lease_up_months} onChange={(e) => sf("lease_up_months", e.target.value)} /></div>
              </div>
            </div>
            {/* Debt & Financing */}
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-red-700">Debt & Financing</p>
              <div className="space-y-1"><Label className="text-xs">Annual Debt Service ($)</Label><div className="flex gap-1.5"><Input type="number" value={f.annual_debt_service} onChange={(e) => sf("annual_debt_service", e.target.value)} placeholder={totalAnnualDebtService > 0 ? `Auto: $${Math.round(totalAnnualDebtService).toLocaleString()}` : "Auto from debt facilities"} />{totalAnnualDebtService > 0 && !f.annual_debt_service && (<Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => sf("annual_debt_service", String(Math.round(totalAnnualDebtService)))}>Fill</Button>)}</div></div>
              <div className="space-y-1"><Label className="text-xs">Carrying Cost During Construction ($/yr)</Label><Input type="number" value={f.carrying_cost_annual} onChange={(e) => sf("carrying_cost_annual", e.target.value)} placeholder="Interest-only payments" /></div>
              <div className="space-y-1"><Label className="text-xs">Debt Balance at Exit ($)</Label><Input type="number" value={f.debt_balance_at_exit} onChange={(e) => sf("debt_balance_at_exit", e.target.value)} placeholder="For net exit proceeds" /></div>
            </div>
            {/* Exit & Return */}
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-green-700">Exit & Return</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Exit Cap Rate (%)</Label><Input type="number" step="0.1" value={f.exit_cap_rate} onChange={(e) => sf("exit_cap_rate", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Disposition Costs (%)</Label><Input type="number" step="0.1" value={f.disposition_cost_pct} onChange={(e) => sf("disposition_cost_pct", e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Total Equity Invested ($)</Label><Input type="number" value={f.total_equity_invested} onChange={(e) => sf("total_equity_invested", e.target.value)} placeholder="For ROI & equity multiple" /></div>
            </div>
            {/* LP Fees & Costs */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-amber-700">LP Fees & Costs</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Management Fee (% of Gross Rev)</Label><Input type="number" step="0.1" value={f.management_fee_rate} onChange={(e) => sf("management_fee_rate", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Construction Mgmt Fee (%)</Label><Input type="number" step="0.1" value={f.construction_mgmt_fee_rate} onChange={(e) => sf("construction_mgmt_fee_rate", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Selling Commission (%)</Label><Input type="number" step="0.1" value={f.selling_commission_rate} onChange={(e) => sf("selling_commission_rate", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Offering Cost ($)</Label><Input type="number" value={f.offering_cost} onChange={(e) => sf("offering_cost", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Acquisition Fee (%)</Label><Input type="number" step="0.1" value={f.acquisition_fee_rate} onChange={(e) => sf("acquisition_fee_rate", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Acquisition Cost ($)</Label><Input type="number" value={f.acquisition_cost} onChange={(e) => sf("acquisition_cost", e.target.value)} placeholder="Purchase price" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Gross Capital Raise ($)</Label><Input type="number" value={f.gross_raise} onChange={(e) => sf("gross_raise", e.target.value)} placeholder="Total capital raised" /></div>
                <div className="space-y-1"><Label className="text-xs">Construction Budget ($)</Label><Input type="number" value={f.construction_budget} onChange={(e) => sf("construction_budget", e.target.value)} placeholder="Auto from plan" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Refinancing Fee (%)</Label><Input type="number" step="0.1" value={f.refinancing_fee_rate} onChange={(e) => sf("refinancing_fee_rate", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Refinance Amount ($)</Label><Input type="number" value={f.refinance_amount} onChange={(e) => sf("refinance_amount", e.target.value)} placeholder="If applicable" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Turnover/Replacement Fee (%)</Label><Input type="number" step="0.1" value={f.turnover_fee_rate} onChange={(e) => sf("turnover_fee_rate", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Property FMV at Turnover ($)</Label><Input type="number" value={f.property_fmv_at_turnover} onChange={(e) => sf("property_fmv_at_turnover", e.target.value)} placeholder="If applicable" /></div>
              </div>
            </div>
            {/* Variable Cap Rate Curve */}
            <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-teal-700">Variable Cap Rate Curve</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={useCapRateCurve} onChange={(e) => setUseCapRateCurve(e.target.checked)} className="rounded" />
                  <span className="text-xs text-muted-foreground">Enable</span>
                </label>
              </div>
              {useCapRateCurve && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground">Set cap rates at specific years. Values are interpolated between points.</p>
                  {capRateCurvePoints.map((pt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1 space-y-0.5">
                        <Label className="text-[10px]">Year</Label>
                        <Input type="number" min="1" max="30" value={pt.year} onChange={(e) => {
                          const updated = [...capRateCurvePoints];
                          updated[idx] = { ...updated[idx], year: e.target.value };
                          setCapRateCurvePoints(updated);
                        }} className="h-7 text-xs" />
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <Label className="text-[10px]">Cap Rate (%)</Label>
                        <Input type="number" step="0.1" value={pt.rate} onChange={(e) => {
                          const updated = [...capRateCurvePoints];
                          updated[idx] = { ...updated[idx], rate: e.target.value };
                          setCapRateCurvePoints(updated);
                        }} className="h-7 text-xs" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 mt-3 text-red-400 hover:text-red-600" onClick={() => {
                        if (capRateCurvePoints.length > 1) setCapRateCurvePoints(capRateCurvePoints.filter((_, i) => i !== idx));
                      }}>&times;</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={() => setCapRateCurvePoints([...capRateCurvePoints, { year: "", rate: "" }])}>+ Add Point</Button>
                </div>
              )}
            </div>
            {/* Profit Sharing */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-indigo-700">Profit Sharing</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">LP Share (%)</Label><Input type="number" step="1" value={f.lp_profit_share} onChange={(e) => setProjForm((prev) => ({ ...prev, lp_profit_share: e.target.value, gp_profit_share: String(100 - Number(e.target.value)) }))} /></div>
                <div className="space-y-1"><Label className="text-xs">GP Share (%)</Label><Input type="number" step="1" value={f.gp_profit_share} onChange={(e) => setProjForm((prev) => ({ ...prev, gp_profit_share: e.target.value, lp_profit_share: String(100 - Number(e.target.value)) }))} /></div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={projPending}>{projPending ? "Running\u2026" : "Run 10-Year Projection"}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <div className="space-y-6">
        {!projResults ? (
          <Card><CardContent className="py-12 text-center"><BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Fill in the assumptions and run a projection to see year-by-year results.</p><p className="text-xs text-muted-foreground mt-1">Revenue and debt service are auto-populated from the rent roll and debt facilities.</p></CardContent></Card>
        ) : (
          <React.Fragment>
            {/* Summary Metrics */}
            {projResults.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-green-200 bg-green-50/30"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Cash Flow</p><p className={cn("text-lg font-bold", projResults.summary.total_cash_flow < 0 ? "text-red-600" : "text-green-700")}>{formatCurrency(projResults.summary.total_cash_flow)}</p></CardContent></Card>
                <Card className="border-blue-200 bg-blue-50/30"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Terminal Value</p><p className="text-lg font-bold text-blue-700">{formatCurrency(projResults.summary.terminal_value)}</p><p className="text-[10px] text-muted-foreground">Net: {formatCurrency(projResults.summary.net_exit_proceeds)}</p></CardContent></Card>
                <Card className="border-purple-200 bg-purple-50/30"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Equity Multiple</p><p className="text-lg font-bold text-purple-700">{projResults.summary.equity_multiple}x</p><p className="text-[10px] text-muted-foreground">IRR: {projResults.summary.irr_estimate}%</p></CardContent></Card>
                <Card className="border-orange-200 bg-orange-50/30"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Return</p><p className="text-lg font-bold text-orange-700">{formatCurrency(projResults.summary.total_return)}</p><p className="text-[10px] text-muted-foreground">CoC: {projResults.summary.cash_on_cash_avg}%</p></CardContent></Card>
              </div>
            )}

            {/* Year-by-Year Table */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Year-by-Year Pro Forma</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow className="bg-muted/50"><TableHead>Year</TableHead><TableHead>Phase</TableHead><TableHead className="text-right">Gross Potential Rent</TableHead><TableHead className="text-right">Vacancy Loss</TableHead><TableHead className="text-right">EGI</TableHead><TableHead className="text-right">OpEx</TableHead><TableHead className="text-right">NOI</TableHead><TableHead className="text-right">Debt Svc</TableHead><TableHead className="text-right">Cash Flow</TableHead><TableHead className="text-right">Cumulative</TableHead>{useCapRateCurve && <><TableHead className="text-right">Cap Rate</TableHead><TableHead className="text-right">Implied Value</TableHead></>}</TableRow></TableHeader>
                    <TableBody>
                      {projResults.projections.map((row, i) => (
                        <TableRow key={i} className={String(row.phase) === "construction" ? "bg-red-50/30" : String(row.phase) === "lease_up" ? "bg-yellow-50/30" : ""}>
                          <TableCell className="font-medium">{String(row.year ?? i + 1)}</TableCell>
                          <TableCell><span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", PHASE_COLORS[String(row.phase ?? "")] ?? "bg-gray-100 text-gray-700")}>{String(row.phase ?? "—").replace("_", "-")}</span></TableCell>
                          <TableCell className="text-right">{formatCurrency(row.gross_potential_rent)}</TableCell>
                          <TableCell className="text-right text-red-500">{row.vacancy_loss > 0 ? `-${formatCurrency(row.vacancy_loss)}` : "—"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.effective_gross_income)}</TableCell>
                          <TableCell className="text-right text-orange-600">{row.operating_expenses > 0 ? formatCurrency(row.operating_expenses) : "—"}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(row.noi)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.annual_debt_service)}</TableCell>
                          <TableCell className={cn("text-right font-semibold", row.cash_flow < 0 ? "text-red-600" : "text-green-600")}>{formatCurrency(row.cash_flow)}</TableCell>
                          <TableCell className={cn("text-right", row.cumulative_cash_flow < 0 ? "text-red-600" : "text-green-600")}>{formatCurrency(row.cumulative_cash_flow)}</TableCell>
                          {useCapRateCurve && <><TableCell className="text-right text-teal-600">{(row.implied_cap_rate ?? 0) > 0 ? `${((row.implied_cap_rate ?? 0) * 100).toFixed(2)}%` : "\u2014"}</TableCell><TableCell className="text-right text-teal-700 font-medium">{(row.implied_value ?? 0) > 0 ? formatCurrency(row.implied_value ?? 0) : "\u2014"}</TableCell></>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Exit Value Summary */}
            {projResults.summary && (
              <Card className="border-green-300">
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" />Exit & Return Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><p className="text-xs text-muted-foreground">Exit Year NOI</p><p className="text-sm font-semibold">{formatCurrency(projResults.summary.exit_noi)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Terminal Value (Gross)</p><p className="text-sm font-semibold">{formatCurrency(projResults.summary.terminal_value)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Disposition Costs</p><p className="text-sm font-semibold text-red-600">-{formatCurrency(projResults.summary.disposition_costs)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Net Exit Proceeds</p><p className="text-sm font-semibold text-green-700">{formatCurrency(projResults.summary.net_exit_proceeds)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Cumulative Cash Flow</p><p className={cn("text-sm font-semibold", projResults.summary.total_cash_flow < 0 ? "text-red-600" : "text-green-700")}>{formatCurrency(projResults.summary.total_cash_flow)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total Return</p><p className="text-sm font-bold text-green-700">{formatCurrency(projResults.summary.total_return)}</p></div>
                  </div>
                  <Separator className="my-4" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-muted-foreground">Equity Multiple</p><p className="text-lg font-bold">{projResults.summary.equity_multiple}x</p></div>
                    <div><p className="text-xs text-muted-foreground">IRR (Estimated)</p><p className="text-lg font-bold">{projResults.summary.irr_estimate}%</p></div>
                    <div><p className="text-xs text-muted-foreground">Avg Cash-on-Cash</p><p className="text-lg font-bold">{projResults.summary.cash_on_cash_avg}%</p></div>
                    <div><p className="text-xs text-muted-foreground">Annualized ROI</p><p className="text-lg font-bold">{projResults.summary.annualized_roi}%</p></div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* LP Fee Summary */}
            {projResults.summary?.fees && (() => {
              const fees = projResults.summary.fees;
              return (
                <Card className="border-amber-300">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-amber-600" />LP Fee Schedule Summary</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-amber-700 mb-2">Upfront Fees (Deducted from Capital Raise)</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-amber-50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Selling Commission (10%)</p><p className="text-sm font-semibold">{formatCurrency(fees.selling_commission)}</p></div>
                          <div className="bg-amber-50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Offering Cost (Fixed)</p><p className="text-sm font-semibold">{formatCurrency(fees.offering_cost)}</p></div>
                          <div className="bg-amber-50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Acquisition Fee (2%)</p><p className="text-sm font-semibold">{formatCurrency(fees.acquisition_fee)}</p></div>
                          <div className="bg-amber-50 rounded-lg p-3 border border-amber-300"><p className="text-[10px] text-muted-foreground font-semibold">Total Upfront Fees</p><p className="text-sm font-bold text-amber-700">{formatCurrency(fees.total_upfront_fees)}</p></div>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold text-amber-700 mb-2">Ongoing Fees (Over Projection Period)</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-amber-50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Management Fees (2.5% of Gross Rev)</p><p className="text-sm font-semibold">{formatCurrency(fees.total_management_fees)}</p></div>
                          <div className="bg-amber-50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Construction Mgmt Fee (1.5%)</p><p className="text-sm font-semibold">{formatCurrency(fees.total_construction_mgmt_fees)}</p></div>
                          <div className="bg-amber-50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Refinancing Fee (2.5%)</p><p className="text-sm font-semibold">{formatCurrency(fees.refinancing_fee)}</p></div>
                          <div className="bg-amber-50 rounded-lg p-3"><p className="text-[10px] text-muted-foreground">Turnover Fee (2%)</p><p className="text-sm font-semibold">{formatCurrency(fees.turnover_replacement_fee)}</p></div>
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="bg-red-50 rounded-lg p-3 border border-red-200"><p className="text-[10px] text-muted-foreground font-semibold">Total All Fees</p><p className="text-sm font-bold text-red-700">{formatCurrency(fees.total_all_fees)}</p></div>
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200"><p className="text-[10px] text-muted-foreground font-semibold">Net Deployable Capital</p><p className="text-sm font-bold text-green-700">{formatCurrency(fees.net_deployable_capital)}</p></div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200"><p className="text-[10px] text-muted-foreground font-semibold">Fee Drag on Returns</p><p className="text-sm font-bold text-blue-700">{projResults.summary.total_equity_invested && projResults.summary.total_equity_invested > 0 ? `${((fees.total_all_fees / projResults.summary.total_equity_invested) * 100).toFixed(1)}%` : "N/A"}</p></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Profit Sharing (70/30) */}
            {projResults.summary && projResults.summary.lp_share_of_profits != null && (
              <Card className="border-indigo-300">
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-indigo-600" />Profit Sharing (70/30 LP/GP Split)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-indigo-50 rounded-lg p-4 text-center"><p className="text-xs text-muted-foreground">Total Profit</p><p className="text-lg font-bold text-indigo-700">{formatCurrency(projResults.summary.total_return)}</p></div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center border-2 border-blue-300"><p className="text-xs text-muted-foreground">LP Share (70%)</p><p className="text-lg font-bold text-blue-700">{formatCurrency(projResults.summary.lp_share_of_profits ?? 0)}</p></div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center border-2 border-orange-300"><p className="text-xs text-muted-foreground">GP Share (30%)</p><p className="text-lg font-bold text-orange-700">{formatCurrency(projResults.summary.gp_share_of_profits ?? 0)}</p></div>
                    <div className="bg-green-50 rounded-lg p-4 text-center"><p className="text-xs text-muted-foreground">LP Equity Multiple</p><p className="text-lg font-bold text-green-700">{projResults.summary.total_equity_invested && projResults.summary.total_equity_invested > 0 ? `${(projResults.summary.lp_share_of_profits / (projResults.summary.total_equity_invested * 0.7)).toFixed(2)}x` : "N/A"}</p></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
    </div>
  );
}
