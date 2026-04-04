"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import {
  Trash2,
  ChevronDown,
  ChevronRight,
  Landmark,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, cn } from "@/lib/utils";
import {
  useRefinanceScenarios,
  useCreateRefinanceScenario,
  useDeleteRefinanceScenario,
  useSaleScenarios,
  useCreateSaleScenario,
  useDeleteSaleScenario,
} from "@/hooks/usePortfolio";
import { useMilestones } from "@/hooks/useLifecycle";

const STAGE_CONFIG: Record<string, { label: string }> = {
  prospect: { label: "Prospect" }, acquisition: { label: "Acquisition" },
  interim_operation: { label: "Interim Operation" }, planning: { label: "Planning" },
  construction: { label: "Construction" }, lease_up: { label: "Lease-Up" },
  stabilized: { label: "Stabilized" }, exit: { label: "Exit" },
};

interface ExitScenariosTabProps {
  propertyId: number;
  canEdit: boolean;
  property: Record<string, any>;
  totalDebtOutstanding: number;
  totalAnnualDebtService: number;
  activePhase?: "as_is" | "post_renovation" | "full_development";
  proFormaData?: Record<string, any> | null;
  financialSnapshot?: Record<string, any> | null;
}

export function ExitScenariosTab({ propertyId, canEdit, property, totalDebtOutstanding, totalAnnualDebtService, activePhase = "as_is", proFormaData, financialSnapshot }: ExitScenariosTabProps) {
  const { data: refiScenarios } = useRefinanceScenarios(propertyId);
  const { mutateAsync: createRefi, isPending: refiPending } = useCreateRefinanceScenario(propertyId);
  const { mutateAsync: deleteRefi } = useDeleteRefinanceScenario(propertyId);
  const { data: saleScenarios } = useSaleScenarios(propertyId);
  const { mutateAsync: createSale, isPending: salePending } = useCreateSaleScenario(propertyId);
  const { mutateAsync: deleteSale } = useDeleteSaleScenario(propertyId);
  const { data: milestones } = useMilestones(propertyId);

  const [refiForm, setRefiForm] = useState({
    label: "Refinance Scenario", assumed_new_valuation: "", new_ltv_percent: "75",
    new_interest_rate: "", new_amortization_months: "300", existing_debt_payout: "",
    closing_costs: "0", notes: "",
    expected_date: "", linked_event: "", linked_milestone_id: "",
    total_equity_invested: "", annual_noi_at_refi: "", hold_period_months: "",
  });
  const [expandedRefi, setExpandedRefi] = useState<number | null>(null);

  const [saleForm, setSaleForm] = useState({
    label: "Sale Scenario", assumed_sale_price: "", selling_costs_percent: "5",
    debt_payout: "", capital_gains_reserve: "0", notes: "",
    expected_date: "", linked_event: "", linked_milestone_id: "",
    total_equity_invested: "", annual_noi_at_sale: "", hold_period_months: "",
    annual_cash_flow: "",
  });
  const [expandedSale, setExpandedSale] = useState<number | null>(null);

  // Fetch phase-aware underwriting summary for accurate NOI
  const phasePlanId = (() => {
    if (activePhase === "as_is" || !property?.development_plans) return null;
    const plans = property.development_plans || [];
    const sorted = [...plans].sort((a: any, b: any) => a.plan_id - b.plan_id);
    if (activePhase === "post_renovation") return sorted[0]?.plan_id ?? null;
    if (activePhase === "full_development") return sorted.length > 1 ? sorted[sorted.length - 1]?.plan_id : sorted[0]?.plan_id ?? null;
    return null;
  })();

  const { data: uwSummary } = useQuery({
    queryKey: ["underwriting-summary", propertyId, phasePlanId],
    queryFn: () => {
      const url = phasePlanId
        ? `/api/portfolio/properties/${propertyId}/underwriting-summary?plan_id=${phasePlanId}`
        : `/api/portfolio/properties/${propertyId}/underwriting-summary`;
      return apiClient.get(url).then(r => r.data);
    },
    enabled: propertyId > 0,
  });

  // Cascading data: Pro Forma → Underwriting → Property fallback
  const computedEquity = financialSnapshot?.equity?.equity_value
    ?? ((property?.purchase_price ?? 0) - totalDebtOutstanding);
  const computedNOI = proFormaData?.noi
    ?? uwSummary?.noi
    ?? financialSnapshot?.expenses?.noi
    ?? ((property?.annual_revenue ?? 0) - (property?.annual_expenses ?? 0));
  const computedCashFlow = computedNOI - totalAnnualDebtService;
  const computedValue = proFormaData?.implied_value_at_cap
    ?? uwSummary?.implied_value_at_cap
    ?? financialSnapshot?.equity?.current_value
    ?? (property?.current_market_value ?? property?.purchase_price ?? 0);

  // Auto-fill refinance and sale form defaults from upstream data
  useEffect(() => {
    setRefiForm(prev => {
      const updates: Record<string, string> = {};
      if (!prev.assumed_new_valuation && computedValue > 0)
        updates.assumed_new_valuation = String(Math.round(computedValue));
      if (!prev.existing_debt_payout && totalDebtOutstanding > 0)
        updates.existing_debt_payout = String(Math.round(totalDebtOutstanding));
      if (!prev.total_equity_invested && computedEquity > 0)
        updates.total_equity_invested = String(Math.round(computedEquity));
      if (!prev.annual_noi_at_refi && computedNOI > 0)
        updates.annual_noi_at_refi = String(Math.round(computedNOI));
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
    setSaleForm(prev => {
      const updates: Record<string, string> = {};
      if (!prev.assumed_sale_price && computedValue > 0)
        updates.assumed_sale_price = String(Math.round(computedValue));
      if (!prev.debt_payout && totalDebtOutstanding > 0)
        updates.debt_payout = String(Math.round(totalDebtOutstanding));
      if (!prev.total_equity_invested && computedEquity > 0)
        updates.total_equity_invested = String(Math.round(computedEquity));
      if (!prev.annual_noi_at_sale && computedNOI > 0)
        updates.annual_noi_at_sale = String(Math.round(computedNOI));
      if (!prev.annual_cash_flow && computedCashFlow > 0)
        updates.annual_cash_flow = String(Math.round(computedCashFlow));
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  }, [computedValue, computedEquity, computedNOI, computedCashFlow, totalDebtOutstanding]);

  const handleCreateRefi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRefi({
        label: refiForm.label,
        assumed_new_valuation: Number(refiForm.assumed_new_valuation),
        new_ltv_percent: Number(refiForm.new_ltv_percent),
        new_interest_rate: refiForm.new_interest_rate ? Number(refiForm.new_interest_rate) : undefined,
        new_amortization_months: refiForm.new_amortization_months ? Number(refiForm.new_amortization_months) : undefined,
        existing_debt_payout: refiForm.existing_debt_payout ? Number(refiForm.existing_debt_payout) : undefined,
        closing_costs: Number(refiForm.closing_costs),
        notes: refiForm.notes || undefined,
        expected_date: refiForm.expected_date || undefined,
        linked_event: refiForm.linked_event || undefined,
        linked_milestone_id: refiForm.linked_milestone_id ? Number(refiForm.linked_milestone_id) : undefined,
        total_equity_invested: refiForm.total_equity_invested ? Number(refiForm.total_equity_invested) : undefined,
        annual_noi_at_refi: refiForm.annual_noi_at_refi ? Number(refiForm.annual_noi_at_refi) : undefined,
        hold_period_months: refiForm.hold_period_months ? Number(refiForm.hold_period_months) : undefined,
      });
      toast.success("Refinance scenario saved");
      setRefiForm({ label: "Refinance Scenario", assumed_new_valuation: "", new_ltv_percent: "75", new_interest_rate: "", new_amortization_months: "300", existing_debt_payout: "", closing_costs: "0", notes: "", expected_date: "", linked_event: "", linked_milestone_id: "", total_equity_invested: "", annual_noi_at_refi: "", hold_period_months: "" });
    } catch (e) { toast.error("Failed to save refinance scenario"); }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSale({
        label: saleForm.label,
        assumed_sale_price: Number(saleForm.assumed_sale_price),
        selling_costs_percent: Number(saleForm.selling_costs_percent),
        debt_payout: saleForm.debt_payout ? Number(saleForm.debt_payout) : undefined,
        capital_gains_reserve: Number(saleForm.capital_gains_reserve),
        notes: saleForm.notes || undefined,
        expected_date: saleForm.expected_date || undefined,
        linked_event: saleForm.linked_event || undefined,
        linked_milestone_id: saleForm.linked_milestone_id ? Number(saleForm.linked_milestone_id) : undefined,
        total_equity_invested: saleForm.total_equity_invested ? Number(saleForm.total_equity_invested) : undefined,
        annual_noi_at_sale: saleForm.annual_noi_at_sale ? Number(saleForm.annual_noi_at_sale) : undefined,
        hold_period_months: saleForm.hold_period_months ? Number(saleForm.hold_period_months) : undefined,
        annual_cash_flow: saleForm.annual_cash_flow ? Number(saleForm.annual_cash_flow) : undefined,
      });
      toast.success("Sale scenario saved");
      setSaleForm({ label: "Sale Scenario", assumed_sale_price: "", selling_costs_percent: "5", debt_payout: "", capital_gains_reserve: "0", notes: "", expected_date: "", linked_event: "", linked_milestone_id: "", total_equity_invested: "", annual_noi_at_sale: "", hold_period_months: "", annual_cash_flow: "" });
    } catch (e) { toast.error("Failed to save sale scenario"); }
  };

  const eventOptions = [
    { value: "construction_completion", label: "Construction Completion" },
    { value: "lease_up_complete", label: "Lease-Up Complete" },
    { value: "stabilization", label: "Stabilization" },
    { value: "interim_operation_end", label: "Interim Operation End" },
    { value: "planning_approval", label: "Planning Approval" },
  ];

  const renderTimingFields = (form: any, setForm: any) => (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3">
      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Timing & Event Linkage</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Expected Date</Label><Input type="date" value={form.expected_date} onChange={(e) => setForm((f: any) => ({ ...f, expected_date: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Hold Period (mo)</Label><Input type="number" value={form.hold_period_months} onChange={(e) => setForm((f: any) => ({ ...f, hold_period_months: e.target.value }))} placeholder="e.g. 24" /></div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Linked Event</Label>
        <Select value={form.linked_event} onValueChange={(v) => setForm((f: any) => ({ ...f, linked_event: v }))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select trigger event" /></SelectTrigger>
          <SelectContent>{eventOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      {(milestones ?? []).length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Link to Milestone</Label>
          <Select value={form.linked_milestone_id} onValueChange={(v) => setForm((f: any) => ({ ...f, linked_milestone_id: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Optional milestone" /></SelectTrigger>
            <SelectContent>
              {(milestones as Array<{ milestone_id: number; title: string; stage: string }>).map((m) => (
                <SelectItem key={m.milestone_id} value={String(m.milestone_id)}>{m.title} ({STAGE_CONFIG[m.stage]?.label ?? m.stage})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  const renderScenarioTimeline = (s: { expected_date?: string; linked_event?: string; linked_milestone_title?: string }) => (
    (s.expected_date || s.linked_event || s.linked_milestone_title) ? (
      <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Timeline & Event Linkage</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {s.expected_date && <div><span className="text-xs text-muted-foreground">Expected Date: </span><span className="font-medium">{new Date(s.expected_date + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</span></div>}
          {s.linked_event && <div><span className="text-xs text-muted-foreground">Trigger Event: </span><span className="font-medium capitalize">{s.linked_event.replace(/_/g, " ")}</span></div>}
          {s.linked_milestone_title && <div><span className="text-xs text-muted-foreground">Linked Milestone: </span><span className="font-medium">{s.linked_milestone_title}</span></div>}
        </div>
      </div>
    ) : null
  );

  return (
    <div className="space-y-8">
      {/* Phase Context Banner */}
      {activePhase === "as_is" && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Landmark className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">As-Is Exit Analysis</span> — Model refinancing and sale scenarios
              based on the property's current operating performance and market value.
            </p>
          </CardContent>
        </Card>
      )}
      {activePhase === "post_renovation" && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Landmark className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Post-Renovation Exit Analysis</span> — Model exit scenarios
              based on the improved property value and enhanced rental income after renovations.
            </p>
          </CardContent>
        </Card>
      )}
      {activePhase === "full_development" && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Landmark className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-200">
              <span className="font-medium">Developed Property Exit Analysis</span> — Model refinancing
              (including CMHC permanent takeout) and disposition scenarios based on the fully developed property.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Data Flow Banner */}
      {(proFormaData || financialSnapshot) && (
        <Card className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
          <CardContent className="py-2.5 px-4">
            <div className="flex items-center gap-3 text-xs text-indigo-700 dark:text-indigo-300 flex-wrap">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">Auto-populated:</span>
              <span className="bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                NOI: ${Math.round(computedNOI).toLocaleString()}
              </span>
              <span className="bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                Value: ${Math.round(computedValue).toLocaleString()}
              </span>
              <span className="bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                Equity: ${Math.round(computedEquity).toLocaleString()}
              </span>
              <span className="bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                Debt: ${Math.round(totalDebtOutstanding).toLocaleString()}
              </span>
              {proFormaData && (
                <span className="text-indigo-500 italic">via Pro Forma</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refinance Scenarios */}
      <section>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><Landmark className="h-4 w-4 text-muted-foreground" />Refinance Scenarios</h3>
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">New Refinance Scenario</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateRefi} className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Label</Label><Input value={refiForm.label} onChange={(e) => setRefiForm((f) => ({ ...f, label: e.target.value }))} /></div>
                {renderTimingFields(refiForm, setRefiForm)}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Valuation ($)</Label><Input type="number" value={refiForm.assumed_new_valuation} onChange={(e) => setRefiForm((f) => ({ ...f, assumed_new_valuation: e.target.value }))} required /></div>
                  <div className="space-y-1"><Label className="text-xs">LTV (%)</Label><Input type="number" step="0.1" value={refiForm.new_ltv_percent} onChange={(e) => setRefiForm((f) => ({ ...f, new_ltv_percent: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Rate (%)</Label><Input type="number" step="0.01" value={refiForm.new_interest_rate} onChange={(e) => setRefiForm((f) => ({ ...f, new_interest_rate: e.target.value }))} placeholder="opt." /></div>
                  <div className="space-y-1"><Label className="text-xs">Amort (mo)</Label><Input type="number" value={refiForm.new_amortization_months} onChange={(e) => setRefiForm((f) => ({ ...f, new_amortization_months: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Debt Payout ($)</Label><div className="flex gap-1.5"><Input type="number" value={refiForm.existing_debt_payout} onChange={(e) => setRefiForm((f) => ({ ...f, existing_debt_payout: e.target.value }))} placeholder={totalDebtOutstanding > 0 ? `Current: ${totalDebtOutstanding.toLocaleString()}` : "opt."} />{totalDebtOutstanding > 0 && !refiForm.existing_debt_payout && (<Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setRefiForm(f => ({ ...f, existing_debt_payout: String(totalDebtOutstanding) }))}>Auto-fill</Button>)}</div></div>
                  <div className="space-y-1"><Label className="text-xs">Closing Costs ($)</Label><Input type="number" value={refiForm.closing_costs} onChange={(e) => setRefiForm((f) => ({ ...f, closing_costs: e.target.value }))} /></div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> ROI Projection Inputs</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Total Equity ($)</Label><div className="flex gap-1.5"><Input type="number" value={refiForm.total_equity_invested} onChange={(e) => setRefiForm((f) => ({ ...f, total_equity_invested: e.target.value }))} placeholder={computedEquity > 0 ? `Est: ${Math.round(computedEquity).toLocaleString()}` : "e.g. 200000"} />{computedEquity > 0 && !refiForm.total_equity_invested && (<Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setRefiForm(f => ({ ...f, total_equity_invested: String(Math.round(computedEquity)) }))}>Auto</Button>)}</div></div>
                    <div className="space-y-1"><Label className="text-xs">Annual NOI at Refi ($)</Label><div className="flex gap-1.5"><Input type="number" value={refiForm.annual_noi_at_refi} onChange={(e) => setRefiForm((f) => ({ ...f, annual_noi_at_refi: e.target.value }))} placeholder={computedNOI > 0 ? `Est: ${Math.round(computedNOI).toLocaleString()}` : "e.g. 72000"} />{computedNOI > 0 && !refiForm.annual_noi_at_refi && (<Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setRefiForm(f => ({ ...f, annual_noi_at_refi: String(Math.round(computedNOI)) }))}>Auto</Button>)}</div></div>
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Notes</Label><Input value={refiForm.notes} onChange={(e) => setRefiForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" /></div>
                <Button type="submit" className="w-full" disabled={refiPending}>{refiPending ? "Saving\u2026" : "Save Scenario"}</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {!refiScenarios || refiScenarios.length === 0 ? (
              <Card><CardContent className="py-8"><p className="text-sm text-muted-foreground text-center">No refinance scenarios yet. Create one to see projected ROI metrics.</p></CardContent></Card>
            ) : (
              (refiScenarios as Array<any>).map((s) => (
                <Card key={s.scenario_id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer" onClick={() => setExpandedRefi(expandedRefi === s.scenario_id ? null : s.scenario_id)}>
                    <div className="flex items-center gap-3">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{s.label}</span>
                      {s.expected_date && <Badge variant="outline" className="text-xs gap-1"><Calendar className="h-3 w-3" />{new Date(s.expected_date + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</Badge>}
                      {s.linked_event && <Badge variant="secondary" className="text-xs">{s.linked_event.replace(/_/g, " ")}</Badge>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-sm font-bold", s.net_proceeds >= 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(s.net_proceeds)} net</span>
                      {expandedRefi === s.scenario_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                  {expandedRefi === s.scenario_id && (
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Valuation</p><p className="text-sm font-bold">{formatCurrency(s.assumed_new_valuation)}</p></div>
                        <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">New Loan ({s.new_ltv_percent}% LTV)</p><p className="text-sm font-bold">{formatCurrency(s.new_loan_amount)}</p></div>
                        <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Debt Payout</p><p className="text-sm font-bold">{formatCurrency(s.existing_debt_payout ?? 0)}</p></div>
                        <div className={cn("text-center p-3 rounded-lg", s.net_proceeds >= 0 ? "bg-green-50" : "bg-red-50")}><p className="text-xs text-muted-foreground">Net Proceeds</p><p className={cn("text-sm font-bold", s.net_proceeds >= 0 ? "text-green-700" : "text-red-700")}>{formatCurrency(s.net_proceeds)}</p></div>
                      </div>
                      {(s.equity_multiple || s.cash_on_cash_return || s.annualized_roi) && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
                          <p className="text-xs font-semibold text-emerald-700 mb-3 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Projected ROI Metrics</p>
                          <div className="grid grid-cols-3 gap-4">
                            {s.equity_multiple != null && <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{s.equity_multiple}x</p><p className="text-xs text-muted-foreground">Equity Multiple</p></div>}
                            {s.cash_on_cash_return != null && <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{s.cash_on_cash_return}%</p><p className="text-xs text-muted-foreground">Cash-on-Cash</p></div>}
                            {s.annualized_roi != null && <div className="text-center"><p className="text-2xl font-bold text-emerald-700">{s.annualized_roi}%</p><p className="text-xs text-muted-foreground">Annualized ROI</p></div>}
                          </div>
                          {s.hold_period_months && <p className="text-xs text-muted-foreground text-center mt-2">Based on {s.hold_period_months} month hold period{s.total_equity_invested ? ` with ${formatCurrency(s.total_equity_invested)} equity invested` : ""}</p>}
                        </div>
                      )}
                      {renderScenarioTimeline(s)}
                      {s.notes && <p className="text-xs text-muted-foreground italic">{s.notes}</p>}
                      <div className="flex justify-end"><button onClick={() => deleteRefi(s.scenario_id)} className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete Scenario</button></div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Sale Scenarios */}
      <section>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" />Sale Scenarios</h3>
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">New Sale Scenario</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSale} className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Label</Label><Input value={saleForm.label} onChange={(e) => setSaleForm((f) => ({ ...f, label: e.target.value }))} /></div>
                {renderTimingFields(saleForm, setSaleForm)}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Sale Price ($)</Label><Input type="number" value={saleForm.assumed_sale_price} onChange={(e) => setSaleForm((f) => ({ ...f, assumed_sale_price: e.target.value }))} required /></div>
                  <div className="space-y-1"><Label className="text-xs">Selling Costs (%)</Label><Input type="number" step="0.1" value={saleForm.selling_costs_percent} onChange={(e) => setSaleForm((f) => ({ ...f, selling_costs_percent: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Debt Payout ($)</Label><div className="flex gap-1.5"><Input type="number" value={saleForm.debt_payout} onChange={(e) => setSaleForm((f) => ({ ...f, debt_payout: e.target.value }))} placeholder={totalDebtOutstanding > 0 ? `Current: ${totalDebtOutstanding.toLocaleString()}` : "opt."} />{totalDebtOutstanding > 0 && !saleForm.debt_payout && (<Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setSaleForm(f => ({ ...f, debt_payout: String(totalDebtOutstanding) }))}>Auto-fill</Button>)}</div></div>
                  <div className="space-y-1"><Label className="text-xs">Cap Gains Reserve ($)</Label><Input type="number" value={saleForm.capital_gains_reserve} onChange={(e) => setSaleForm((f) => ({ ...f, capital_gains_reserve: e.target.value }))} /></div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> ROI Projection Inputs</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Total Equity ($)</Label><div className="flex gap-1.5"><Input type="number" value={saleForm.total_equity_invested} onChange={(e) => setSaleForm((f) => ({ ...f, total_equity_invested: e.target.value }))} placeholder={computedEquity > 0 ? `Est: ${Math.round(computedEquity).toLocaleString()}` : "e.g. 200000"} />{computedEquity > 0 && !saleForm.total_equity_invested && (<Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setSaleForm(f => ({ ...f, total_equity_invested: String(Math.round(computedEquity)) }))}>Auto</Button>)}</div></div>
                    <div className="space-y-1"><Label className="text-xs">Annual NOI at Sale ($)</Label><div className="flex gap-1.5"><Input type="number" value={saleForm.annual_noi_at_sale} onChange={(e) => setSaleForm((f) => ({ ...f, annual_noi_at_sale: e.target.value }))} placeholder={computedNOI > 0 ? `Est: ${Math.round(computedNOI).toLocaleString()}` : "e.g. 78000"} />{computedNOI > 0 && !saleForm.annual_noi_at_sale && (<Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setSaleForm(f => ({ ...f, annual_noi_at_sale: String(Math.round(computedNOI)) }))}>Auto</Button>)}</div></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Avg Annual Cash Flow After DS ($)</Label><div className="flex gap-1.5"><Input type="number" value={saleForm.annual_cash_flow} onChange={(e) => setSaleForm((f) => ({ ...f, annual_cash_flow: e.target.value }))} placeholder={computedCashFlow > 0 ? `Est: ${Math.round(computedCashFlow).toLocaleString()}` : "e.g. 28000"} />{computedCashFlow > 0 && !saleForm.annual_cash_flow && (<Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setSaleForm(f => ({ ...f, annual_cash_flow: String(Math.round(computedCashFlow)) }))}>Auto</Button>)}</div></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Notes</Label><Input value={saleForm.notes} onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" /></div>
                <Button type="submit" className="w-full" disabled={salePending}>{salePending ? "Saving\u2026" : "Save Scenario"}</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {!saleScenarios || saleScenarios.length === 0 ? (
              <Card><CardContent className="py-8"><p className="text-sm text-muted-foreground text-center">No sale scenarios yet. Create one to see projected ROI and cash flow metrics.</p></CardContent></Card>
            ) : (
              (saleScenarios as Array<any>).map((s) => (
                <Card key={s.scenario_id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer" onClick={() => setExpandedSale(expandedSale === s.scenario_id ? null : s.scenario_id)}>
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{s.label}</span>
                      {s.expected_date && <Badge variant="outline" className="text-xs gap-1"><Calendar className="h-3 w-3" />{new Date(s.expected_date + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</Badge>}
                      {s.linked_event && <Badge variant="secondary" className="text-xs">{s.linked_event.replace(/_/g, " ")}</Badge>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-sm font-bold", s.net_proceeds >= 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(s.net_proceeds)} net</span>
                      {expandedSale === s.scenario_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                  {expandedSale === s.scenario_id && (
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Sale Price</p><p className="text-sm font-bold">{formatCurrency(s.assumed_sale_price)}</p></div>
                        <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Selling Costs ({s.selling_costs_percent}%)</p><p className="text-sm font-bold">{formatCurrency(s.selling_costs)}</p></div>
                        <div className="text-center p-3 rounded-lg bg-muted/30"><p className="text-xs text-muted-foreground">Debt Payout</p><p className="text-sm font-bold">{formatCurrency(s.debt_payout ?? 0)}</p></div>
                        <div className={cn("text-center p-3 rounded-lg", s.net_proceeds >= 0 ? "bg-green-50" : "bg-red-50")}><p className="text-xs text-muted-foreground">Net Proceeds</p><p className={cn("text-sm font-bold", s.net_proceeds >= 0 ? "text-green-700" : "text-red-700")}>{formatCurrency(s.net_proceeds)}</p></div>
                      </div>
                      {(s.total_return != null || s.equity_multiple != null || s.irr_estimate != null || s.cap_rate != null) && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
                          <p className="text-xs font-semibold text-emerald-700 mb-3 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Projected ROI & Cash Flow</p>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {s.total_return != null && <div className="text-center"><p className={cn("text-xl font-bold", s.total_return >= 0 ? "text-emerald-700" : "text-red-600")}>{formatCurrency(s.total_return)}</p><p className="text-xs text-muted-foreground">Total Return</p></div>}
                            {s.equity_multiple != null && <div className="text-center"><p className="text-xl font-bold text-emerald-700">{s.equity_multiple}x</p><p className="text-xs text-muted-foreground">Equity Multiple</p></div>}
                            {s.irr_estimate != null && <div className="text-center"><p className="text-xl font-bold text-emerald-700">{s.irr_estimate}%</p><p className="text-xs text-muted-foreground">Est. IRR</p></div>}
                            {s.cash_on_cash_return != null && <div className="text-center"><p className="text-xl font-bold text-emerald-700">{s.cash_on_cash_return}%</p><p className="text-xs text-muted-foreground">Cash-on-Cash</p></div>}
                            {s.cap_rate != null && <div className="text-center"><p className="text-xl font-bold text-emerald-700">{s.cap_rate}%</p><p className="text-xs text-muted-foreground">Cap Rate</p></div>}
                          </div>
                          {s.hold_period_months && <p className="text-xs text-muted-foreground text-center mt-2">Based on {s.hold_period_months} month hold ({(s.hold_period_months / 12).toFixed(1)} yr){s.total_equity_invested ? ` | ${formatCurrency(s.total_equity_invested)} equity` : ""}{s.annual_cash_flow ? ` | ${formatCurrency(s.annual_cash_flow)}/yr cash flow` : ""}</p>}
                        </div>
                      )}
                      {renderScenarioTimeline(s)}
                      {s.notes && <p className="text-xs text-muted-foreground italic">{s.notes}</p>}
                      <div className="flex justify-end"><button onClick={() => deleteSale(s.scenario_id)} className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete Scenario</button></div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
