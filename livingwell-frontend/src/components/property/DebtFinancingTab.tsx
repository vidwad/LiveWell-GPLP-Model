"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Landmark,
  TrendingUp,
  Calendar,
  Edit2,
  Banknote,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatCurrencyCompact, formatDate, cn } from "@/lib/utils";
import { LenderUnderwritingSection } from "@/components/property/LenderUnderwritingSection";
import {
  useDebtFacilities,
  useCreateDebtFacility,
  useUpdateDebtFacility,
  useAmortizationSchedule,
} from "@/hooks/usePortfolio";
import type { DebtFacility } from "@/types/portfolio";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

/* ── Amortization Panel ── */
function AmortizationPanel({ propertyId, debtId }: { propertyId: number; debtId: number }) {
  const [years, setYears] = useState(10);
  const [showMonthly, setShowMonthly] = useState(false);
  const { data, isLoading } = useAmortizationSchedule(propertyId, debtId, years);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">No schedule data.</p>;

  const rawAnnual: Array<{
    year: number; total_payment: number; total_interest: number;
    total_principal: number; closing_balance: number; is_io_year?: boolean;
  }> = data.annual_schedule ?? data.annual ?? [];
  const startBalance = data.outstanding_balance ?? 0;
  const annual = rawAnnual.map((row, i) => ({
    ...row,
    opening_balance: i === 0 ? startBalance : rawAnnual[i - 1].closing_balance,
  }));
  const rawMonthly: Array<{
    period: number; payment: number; interest: number;
    principal: number; balance: number;
  }> = data.monthly_schedule ?? data.monthly ?? [];
  const monthly = rawMonthly.map((row, i) => ({
    period: row.period,
    year: Math.ceil(row.period / 12),
    month: ((row.period - 1) % 12) + 1,
    opening_balance: i === 0 ? startBalance : rawMonthly[i - 1].balance,
    payment: row.payment,
    interest: row.interest,
    principal: row.principal,
    closing_balance: row.balance,
  }));

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Projection years:</span>
        {[5, 10, 15, 20, 25].map((y) => (
          <button key={y} onClick={() => setYears(y)} className={cn("px-3 py-1 text-xs rounded-full border transition-colors font-medium", years === y ? "bg-primary text-primary-foreground border-primary" : "bg-white hover:bg-muted border-border")}>{y}yr</button>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wide">Annual Summary</p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>Year</TableHead><TableHead className="text-right">Opening Bal.</TableHead><TableHead className="text-right">Payment</TableHead><TableHead className="text-right">Interest</TableHead><TableHead className="text-right">Principal</TableHead><TableHead className="text-right">Closing Bal.</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {annual.map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="font-medium">{row.year}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.opening_balance)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.total_payment)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(row.total_interest)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(row.total_principal)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.closing_balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <button onClick={() => setShowMonthly((v) => !v)} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
        {showMonthly ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {showMonthly ? "Hide" : "Show"} monthly schedule
      </button>
      {showMonthly && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>#</TableHead><TableHead>Yr</TableHead><TableHead>Mo</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Payment</TableHead><TableHead className="text-right">Interest</TableHead><TableHead className="text-right">Principal</TableHead><TableHead className="text-right">Closing</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {monthly.map((row) => (
                <TableRow key={row.period}>
                  <TableCell className="text-muted-foreground">{row.period}</TableCell>
                  <TableCell>{row.year}</TableCell><TableCell>{row.month}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.opening_balance)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.payment)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(row.interest)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(row.principal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.closing_balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

interface DebtFinancingTabProps {
  propertyId: number;
  canEdit: boolean;
  property: Record<string, any>;
  totalDebtCommitment: number;
  totalDebtOutstanding: number;
  totalAnnualDebtService: number;
  activePhase?: "as_is" | "post_renovation" | "full_development";
  phaseFilteredDebts?: DebtFacility[];
  phasePlanId?: number | null;
}

export function DebtFinancingTab({ propertyId, canEdit, property, totalDebtCommitment, totalDebtOutstanding, totalAnnualDebtService, activePhase, phaseFilteredDebts, phasePlanId }: DebtFinancingTabProps) {
  const { data: allDebtFacilities } = useDebtFacilities(propertyId);

  // Use phase-filtered debts from parent (which uses development_plan_id + replaces_debt_id chain)
  const debtFacilities = phaseFilteredDebts ?? allDebtFacilities;

  // Fetch underwriting summary for the active phase to get accurate NOI
  const { data: uwSummary } = useQuery({
    queryKey: ["underwriting-summary-debt", propertyId, phasePlanId],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (phasePlanId) params.plan_id = String(phasePlanId);
      return apiClient.get(`/api/portfolio/properties/${propertyId}/underwriting-summary`, { params }).then(r => r.data);
    },
  });

  // Fetch lending metrics for all facilities
  const { data: lendingMetrics } = useQuery({
    queryKey: ["lending-metrics", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/lending-metrics`).then(r => r.data),
    enabled: propertyId > 0,
  });

  // Helper: get lending metrics for a specific debt facility
  const getMetrics = (debtId: number) =>
    lendingMetrics?.facilities?.find((f: any) => f.debt_id === debtId);
  const createDebt = useCreateDebtFacility(propertyId);
  const updateDebt = useUpdateDebtFacility(propertyId);

  const [expandedDebtId, setExpandedDebtId] = useState<number | null>(null);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);
  const [debtForm, setDebtForm] = useState({
    lender_name: "", debt_type: "permanent_mortgage", commitment_amount: "",
    drawn_amount: "0", outstanding_balance: "", interest_rate: "",
    rate_type: "fixed", term_months: "", amortization_months: "",
    io_period_months: "0", origination_date: "", maturity_date: "",
    ltv_covenant: "", dscr_covenant: "", notes: "",
    // CMHC / Insured Mortgage Fields
    is_cmhc_insured: false, cmhc_insurance_premium_pct: "",
    cmhc_application_fee: "", cmhc_program: "",
    compounding_method: "semi_annual", lender_fee_pct: "",
  });
  const resetDebtForm = () => setDebtForm({
    lender_name: "", debt_type: "permanent_mortgage", commitment_amount: "",
    drawn_amount: "0", outstanding_balance: "", interest_rate: "",
    rate_type: "fixed", term_months: "", amortization_months: "",
    io_period_months: "0", origination_date: "", maturity_date: "",
    ltv_covenant: "", dscr_covenant: "", notes: "",
    is_cmhc_insured: false, cmhc_insurance_premium_pct: "",
    cmhc_application_fee: "", cmhc_program: "",
    compounding_method: "semi_annual", lender_fee_pct: "",
  });

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<DebtFacility> & { lender_name: string; debt_type: string; commitment_amount: number } = {
        lender_name: debtForm.lender_name, debt_type: debtForm.debt_type,
        commitment_amount: Number(debtForm.commitment_amount),
        drawn_amount: debtForm.drawn_amount ? Number(debtForm.drawn_amount) : 0,
        outstanding_balance: debtForm.outstanding_balance ? Number(debtForm.outstanding_balance) : Number(debtForm.commitment_amount),
        interest_rate: debtForm.interest_rate ? Number(debtForm.interest_rate) : undefined,
        rate_type: debtForm.rate_type,
        term_months: debtForm.term_months ? Number(debtForm.term_months) : undefined,
        amortization_months: debtForm.amortization_months ? Number(debtForm.amortization_months) : undefined,
        io_period_months: debtForm.io_period_months ? Number(debtForm.io_period_months) : 0,
        origination_date: debtForm.origination_date || undefined,
        maturity_date: debtForm.maturity_date || undefined,
        ltv_covenant: debtForm.ltv_covenant ? Number(debtForm.ltv_covenant) : undefined,
        dscr_covenant: debtForm.dscr_covenant ? Number(debtForm.dscr_covenant) : undefined,
        notes: debtForm.notes || undefined,
        // Link to active plan if not baseline
        development_plan_id: phasePlanId || undefined,
        // CMHC fields
        is_cmhc_insured: debtForm.is_cmhc_insured,
        cmhc_insurance_premium_pct: debtForm.cmhc_insurance_premium_pct ? Number(debtForm.cmhc_insurance_premium_pct) : undefined,
        cmhc_application_fee: debtForm.cmhc_application_fee ? Number(debtForm.cmhc_application_fee) : undefined,
        cmhc_program: debtForm.cmhc_program || undefined,
        compounding_method: debtForm.compounding_method || "semi_annual",
        lender_fee_pct: debtForm.lender_fee_pct ? Number(debtForm.lender_fee_pct) : undefined,
      };
      await createDebt.mutateAsync(payload);
      toast.success("Debt facility added");
      setShowAddDebt(false);
      resetDebtForm();
    } catch (e) { toast.error("Failed to add debt facility"); }
  };

  const handleUpdateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebtId) return;
    try {
      const payload: Partial<DebtFacility> & { debtId: number; lender_name: string; debt_type: string; status: string } = {
        debtId: editingDebtId, lender_name: debtForm.lender_name, debt_type: debtForm.debt_type, status: "active",
        commitment_amount: Number(debtForm.commitment_amount),
        drawn_amount: debtForm.drawn_amount ? Number(debtForm.drawn_amount) : 0,
        outstanding_balance: debtForm.outstanding_balance ? Number(debtForm.outstanding_balance) : 0,
        interest_rate: debtForm.interest_rate ? Number(debtForm.interest_rate) : undefined,
        rate_type: debtForm.rate_type,
        term_months: debtForm.term_months ? Number(debtForm.term_months) : undefined,
        amortization_months: debtForm.amortization_months ? Number(debtForm.amortization_months) : undefined,
        io_period_months: debtForm.io_period_months ? Number(debtForm.io_period_months) : 0,
        origination_date: debtForm.origination_date || undefined,
        maturity_date: debtForm.maturity_date || undefined,
        ltv_covenant: debtForm.ltv_covenant ? Number(debtForm.ltv_covenant) : undefined,
        dscr_covenant: debtForm.dscr_covenant ? Number(debtForm.dscr_covenant) : undefined,
        notes: debtForm.notes || undefined,
        // CMHC fields
        is_cmhc_insured: debtForm.is_cmhc_insured,
        cmhc_insurance_premium_pct: debtForm.cmhc_insurance_premium_pct ? Number(debtForm.cmhc_insurance_premium_pct) : undefined,
        cmhc_application_fee: debtForm.cmhc_application_fee ? Number(debtForm.cmhc_application_fee) : undefined,
        cmhc_program: debtForm.cmhc_program || undefined,
        compounding_method: debtForm.compounding_method || "semi_annual",
        lender_fee_pct: debtForm.lender_fee_pct ? Number(debtForm.lender_fee_pct) : undefined,
      };
      await updateDebt.mutateAsync(payload);
      toast.success("Debt facility updated");
      setEditingDebtId(null);
      resetDebtForm();
    } catch (e: any) {
      console.error("Debt update error:", e?.response?.data || e?.message || e);
      toast.error(e?.response?.data?.detail || "Failed to update debt facility");
    }
  };

  const startEditDebt = (debt: DebtFacility) => {
    setDebtForm({
      lender_name: debt.lender_name ?? "", debt_type: debt.debt_type ?? "permanent_mortgage",
      commitment_amount: String(debt.commitment_amount ?? ""), drawn_amount: String(debt.drawn_amount ?? "0"),
      outstanding_balance: String(debt.outstanding_balance ?? ""),
      interest_rate: debt.interest_rate != null ? String(debt.interest_rate) : "",
      rate_type: debt.rate_type ?? "fixed",
      term_months: debt.term_months != null ? String(debt.term_months) : "",
      amortization_months: debt.amortization_months != null ? String(debt.amortization_months) : "",
      io_period_months: debt.io_period_months != null ? String(debt.io_period_months) : "0",
      origination_date: debt.origination_date ? String(debt.origination_date) : "",
      maturity_date: debt.maturity_date ? String(debt.maturity_date) : "",
      ltv_covenant: debt.ltv_covenant != null ? String(debt.ltv_covenant) : "",
      dscr_covenant: debt.dscr_covenant != null ? String(debt.dscr_covenant) : "",
      notes: debt.notes ?? "",
      // CMHC fields
      is_cmhc_insured: (debt as any).is_cmhc_insured ?? false,
      cmhc_insurance_premium_pct: (debt as any).cmhc_insurance_premium_pct != null ? String((debt as any).cmhc_insurance_premium_pct) : "",
      cmhc_application_fee: (debt as any).cmhc_application_fee != null ? String((debt as any).cmhc_application_fee) : "",
      cmhc_program: (debt as any).cmhc_program ?? "",
      compounding_method: (debt as any).compounding_method ?? "semi_annual",
      lender_fee_pct: (debt as any).lender_fee_pct != null ? String((debt as any).lender_fee_pct) : "",
    });
    setEditingDebtId(debt.debt_id);
  };

  return (
    <div className="space-y-6">
      {/* Phase indicator */}
      <div className="flex items-center gap-2">
        <div className={`h-8 w-1 rounded ${activePhase === "as_is" ? "bg-blue-600" : activePhase === "post_renovation" ? "bg-amber-500" : "bg-green-600"}`} />
        <h3 className="text-lg font-semibold">
          {activePhase === "as_is" ? "Acquisition Financing" : activePhase === "post_renovation" ? "Renovation Financing" : "Development Financing"}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${activePhase === "as_is" ? "bg-blue-100 text-blue-700" : activePhase === "post_renovation" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
          {(debtFacilities ?? []).length} facilit{(debtFacilities ?? []).length === 1 ? "y" : "ies"}
        </span>
      </div>

      {/* Lender Underwriting Summary */}
      <LenderUnderwritingSection propertyId={propertyId} />

      {/* Debt Summary KPIs */}
      {(debtFacilities ?? []).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500"><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground font-medium">Total Commitment</p><p className="text-lg font-bold">{formatCurrencyCompact(totalDebtCommitment)}</p><p className="text-xs text-muted-foreground">{(debtFacilities ?? []).length} facilit{(debtFacilities ?? []).length === 1 ? "y" : "ies"}</p></CardContent></Card>
          <Card className="border-l-4 border-l-amber-500"><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground font-medium">Outstanding Balance</p><p className="text-lg font-bold text-amber-700">{formatCurrencyCompact(totalDebtOutstanding)}</p><p className="text-xs text-muted-foreground">{totalDebtCommitment > 0 ? ((totalDebtOutstanding / totalDebtCommitment) * 100).toFixed(0) : 0}% drawn</p></CardContent></Card>
          <Card className="border-l-4 border-l-red-500"><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground font-medium">Annual Debt Service</p><p className="text-lg font-bold text-red-700">{totalAnnualDebtService > 0 ? formatCurrencyCompact(totalAnnualDebtService) : "—"}</p><p className="text-xs text-muted-foreground">{totalAnnualDebtService > 0 ? `${formatCurrencyCompact(totalAnnualDebtService / 12)}/mo` : "No active loans"}</p></CardContent></Card>
          <Card className="border-l-4 border-l-green-500"><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground font-medium">Wtd Avg Rate</p>{(() => { const active = (debtFacilities ?? []).filter((d: { outstanding_balance: number }) => d.outstanding_balance > 0); const totalBal = active.reduce((s: number, d: { outstanding_balance: number }) => s + d.outstanding_balance, 0); const wtdRate = totalBal > 0 ? active.reduce((s: number, d: { outstanding_balance: number; interest_rate: number | null }) => s + d.outstanding_balance * (d.interest_rate ?? 0), 0) / totalBal : 0; return (<><p className="text-lg font-bold">{wtdRate > 0 ? `${wtdRate.toFixed(2)}%` : "—"}</p><p className="text-xs text-muted-foreground">{active.length} active loan{active.length !== 1 ? "s" : ""}</p></>); })()}</CardContent></Card>
        </div>
      )}

      {/* Debt Lifecycle Alerts */}
      {(() => {
        const alerts: { type: "error" | "warning" | "info"; message: string }[] = [];
        const debts = (debtFacilities ?? []) as DebtFacility[];
        const now = new Date();

        for (const d of debts) {
          // Maturity alerts
          if (d.maturity_date) {
            const mat = new Date(d.maturity_date);
            const monthsToMaturity = (mat.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsToMaturity < 0) {
              alerts.push({ type: "error", message: `${d.lender_name}: Matured ${Math.abs(Math.round(monthsToMaturity))} months ago — needs refinancing or payoff` });
            } else if (monthsToMaturity < 6) {
              alerts.push({ type: "warning", message: `${d.lender_name}: Matures in ${Math.round(monthsToMaturity)} months — plan refinancing` });
            } else if (monthsToMaturity < 12) {
              alerts.push({ type: "info", message: `${d.lender_name}: Matures in ${Math.round(monthsToMaturity)} months` });
            }
          } else if (d.outstanding_balance > 0) {
            alerts.push({ type: "warning", message: `${d.lender_name}: No maturity date set` });
          }

          // IO period ending
          if (d.io_period_months > 0 && d.origination_date) {
            const orig = new Date(d.origination_date);
            const ioEnd = new Date(orig);
            ioEnd.setMonth(ioEnd.getMonth() + d.io_period_months);
            const monthsToIO = (ioEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsToIO > 0 && monthsToIO < 6) {
              alerts.push({ type: "warning", message: `${d.lender_name}: IO period ends in ${Math.round(monthsToIO)} months — payments will increase` });
            }
          }

          // Construction loan with no permanent takeout planned
          if (d.debt_type === "construction_loan" && d.outstanding_balance > 0) {
            const hasReplacement = debts.some(other => other.replaces_debt_id === d.debt_id);
            if (!hasReplacement) {
              alerts.push({ type: "warning", message: `${d.lender_name}: Construction loan has no permanent takeout facility configured` });
            }
          }

          // DSCR covenant check
          if (d.dscr_covenant && uwSummary?.dscr) {
            if (uwSummary.dscr < d.dscr_covenant) {
              alerts.push({ type: "error", message: `${d.lender_name}: DSCR ${uwSummary.dscr.toFixed(2)}x is below covenant of ${d.dscr_covenant}x` });
            }
          }

          // LTV covenant check
          if (d.ltv_covenant && uwSummary?.ltv) {
            if (uwSummary.ltv > d.ltv_covenant) {
              alerts.push({ type: "error", message: `${d.lender_name}: LTV ${uwSummary.ltv.toFixed(1)}% exceeds covenant of ${d.ltv_covenant}%` });
            }
          }
        }

        if (alerts.length === 0) return null;

        return (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardContent className="py-3 px-4 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Debt Alerts</p>
              {alerts.map((a, i) => (
                <div key={i} className={cn("flex items-start gap-2 text-xs rounded px-2 py-1",
                  a.type === "error" ? "text-red-700 bg-red-50" : a.type === "warning" ? "text-amber-700 bg-amber-50" : "text-blue-700 bg-blue-50"
                )}>
                  <span className="shrink-0 mt-0.5">{a.type === "error" ? "●" : a.type === "warning" ? "▲" : "ℹ"}</span>
                  <span>{a.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* Debt Flow — shows replacement chain */}
      {(() => {
        const debts = (debtFacilities ?? []) as DebtFacility[];
        const allDebts = (allDebtFacilities ?? []) as DebtFacility[];
        if (allDebts.length <= 1) return null;

        // Build the full chain for this property
        const chainSteps: { debt: DebtFacility; isActive: boolean }[] = [];
        // Find root debts (not replacing anything)
        const roots = allDebts.filter(d => !d.replaces_debt_id);
        for (const root of roots) {
          let current: DebtFacility | undefined = root;
          while (current) {
            const isInPhase = debts.some(d => d.debt_id === current!.debt_id);
            chainSteps.push({ debt: current, isActive: isInPhase });
            current = allDebts.find(d => d.replaces_debt_id === current!.debt_id);
          }
        }

        if (chainSteps.length <= 1) return null;

        return (
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Debt Transition Sequence</p>
              <div className="space-y-2">
                {chainSteps.map((step, i) => {
                  const d = step.debt;
                  const nextStep = i < chainSteps.length - 1 ? chainSteps[i + 1] : null;
                  const purposeLabel = d.debt_purpose === "construction" ? "Construction" :
                    d.debt_purpose === "refinancing" ? "Permanent Takeout" :
                    d.debt_purpose === "acquisition" ? "Acquisition" : (d.debt_purpose || "");
                  return (
                    <React.Fragment key={d.debt_id}>
                      <div className={cn(
                        "rounded-lg border px-4 py-3 flex items-center justify-between",
                        step.isActive
                          ? "border-primary bg-primary/5"
                          : "border-muted bg-muted/20 opacity-60"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                            step.isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                          )}>{i + 1}</div>
                          <div>
                            <p className={cn("font-medium text-sm", !step.isActive && "line-through")}>{d.lender_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {d.debt_type.replace(/_/g, " ")} · {purposeLabel}
                              {d.origination_date && ` · ${formatDate(d.origination_date)}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-semibold text-sm tabular-nums", step.isActive ? "" : "text-muted-foreground")}>{formatCurrencyCompact(d.commitment_amount)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {d.interest_rate ? `${Number(d.interest_rate).toFixed(2)}% ${d.rate_type}` : ""}
                            {d.term_months ? ` · ${d.term_months}mo` : ""}
                          </p>
                        </div>
                      </div>
                      {nextStep && (
                        <div className="flex items-center gap-2 pl-6 text-[10px] text-muted-foreground">
                          <div className="h-4 w-px bg-muted-foreground/30" />
                          <span>Pays off {d.lender_name} → replaced by {nextStep.debt.lender_name}</span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Add Debt Facility Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Dialog open={showAddDebt} onOpenChange={(open) => { setShowAddDebt(open); if (!open) resetDebtForm(); }}>
            {/* @ts-expect-error radix-ui asChild type */}
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Debt Facility</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />New Debt Facility</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateDebt} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1"><Label className="text-xs">Lender Name *</Label><Input value={debtForm.lender_name} onChange={(e) => setDebtForm(f => ({ ...f, lender_name: e.target.value }))} placeholder="e.g. ATB Financial" required /></div>
                  <div className="space-y-1"><Label className="text-xs">Debt Type *</Label><Select value={debtForm.debt_type} onValueChange={(v) => setDebtForm(f => ({ ...f, debt_type: v ?? "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="permanent_mortgage">Permanent Mortgage</SelectItem><SelectItem value="construction_loan">Construction Loan</SelectItem><SelectItem value="bridge_loan">Bridge Loan</SelectItem><SelectItem value="mezzanine">Mezzanine</SelectItem><SelectItem value="line_of_credit">Line of Credit</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Rate Type</Label><Select value={debtForm.rate_type} onValueChange={(v) => setDebtForm(f => ({ ...f, rate_type: v ?? "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="variable">Variable</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select></div>
                </div>
                <div className="border rounded-lg p-3 bg-blue-50/30 border-blue-200 space-y-3">
                  <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Amounts</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Commitment Amount ($) *</Label><Input type="number" step="0.01" value={debtForm.commitment_amount} onChange={(e) => setDebtForm(f => ({ ...f, commitment_amount: e.target.value }))} placeholder="2,400,000" required /></div>
                    <div className="space-y-1"><Label className="text-xs">Interest Rate (%)</Label><Input type="number" step="0.01" value={debtForm.interest_rate} onChange={(e) => setDebtForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="5.25" /></div>
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-green-50/30 border-green-200 space-y-3">
                  <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Loan Terms</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Term (months)</Label><Input type="number" value={debtForm.term_months} onChange={(e) => {
                      const term = e.target.value;
                      setDebtForm(f => {
                        const updated = { ...f, term_months: term };
                        if (f.origination_date && term) {
                          const d = new Date(f.origination_date + "T00:00:00");
                          d.setMonth(d.getMonth() + Number(term));
                          updated.maturity_date = d.toISOString().slice(0, 10);
                        }
                        return updated;
                      });
                    }} placeholder="60" /></div>
                    <div className="space-y-1"><Label className="text-xs">Amortization (months)</Label><Input type="number" value={debtForm.amortization_months} onChange={(e) => setDebtForm(f => ({ ...f, amortization_months: e.target.value }))} placeholder="300" /></div>
                    <div className="space-y-1"><Label className="text-xs">IO Period (months)</Label><Input type="number" value={debtForm.io_period_months} onChange={(e) => setDebtForm(f => ({ ...f, io_period_months: e.target.value }))} placeholder="0" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Origination Date</Label><Input type="date" value={debtForm.origination_date} onChange={(e) => {
                      const orig = e.target.value;
                      setDebtForm(f => {
                        const updated = { ...f, origination_date: orig };
                        if (orig && f.term_months) {
                          const d = new Date(orig + "T00:00:00");
                          d.setMonth(d.getMonth() + Number(f.term_months));
                          updated.maturity_date = d.toISOString().slice(0, 10);
                        }
                        return updated;
                      });
                    }} /></div>
                    <div className="space-y-1"><Label className="text-xs">Maturity Date</Label><Input type="date" value={debtForm.maturity_date} onChange={(e) => {
                      const mat = e.target.value;
                      setDebtForm(f => {
                        const updated = { ...f, maturity_date: mat };
                        if (f.origination_date && mat) {
                          const orig = new Date(f.origination_date + "T00:00:00");
                          const matDate = new Date(mat + "T00:00:00");
                          const months = (matDate.getFullYear() - orig.getFullYear()) * 12 + (matDate.getMonth() - orig.getMonth());
                          if (months > 0) updated.term_months = String(months);
                        }
                        return updated;
                      });
                    }} /></div>
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-amber-50/30 border-amber-200 space-y-3">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Covenants</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Max LTV (%)</Label><Input type="number" step="0.01" value={debtForm.ltv_covenant} onChange={(e) => setDebtForm(f => ({ ...f, ltv_covenant: e.target.value }))} placeholder="75.00" /></div>
                    <div className="space-y-1"><Label className="text-xs">Min DSCR (x)</Label><Input type="number" step="0.01" value={debtForm.dscr_covenant} onChange={(e) => setDebtForm(f => ({ ...f, dscr_covenant: e.target.value }))} placeholder="1.25" /></div>
                  </div>
                </div>
                {/* CMHC / Insured Mortgage Section */}
                <div className="border rounded-lg p-3 bg-purple-50/30 border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />CMHC / Insurance</p>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={debtForm.is_cmhc_insured} onChange={(e) => setDebtForm(f => ({ ...f, is_cmhc_insured: e.target.checked }))} className="rounded" />
                      CMHC Insured
                    </label>
                  </div>
                  {debtForm.is_cmhc_insured && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">CMHC Program</Label><Select value={debtForm.cmhc_program} onValueChange={(v) => setDebtForm(f => ({ ...f, cmhc_program: v ?? "" }))}><SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger><SelectContent><SelectItem value="Standard">Standard</SelectItem><SelectItem value="MLI Select">MLI Select</SelectItem><SelectItem value="Flex">Flex</SelectItem></SelectContent></Select></div>
                      <div className="space-y-1"><Label className="text-xs">Insurance Premium (%)</Label><Input type="number" step="0.25" value={debtForm.cmhc_insurance_premium_pct} onChange={(e) => setDebtForm(f => ({ ...f, cmhc_insurance_premium_pct: e.target.value }))} placeholder="4.00" /></div>
                      <div className="space-y-1"><Label className="text-xs">Application Fee ($)</Label><Input type="number" step="100" value={debtForm.cmhc_application_fee} onChange={(e) => setDebtForm(f => ({ ...f, cmhc_application_fee: e.target.value }))} placeholder="3,500" /></div>
                      <div className="space-y-1"><Label className="text-xs">Lender Fee (%)</Label><Input type="number" step="0.25" value={debtForm.lender_fee_pct} onChange={(e) => setDebtForm(f => ({ ...f, lender_fee_pct: e.target.value }))} placeholder="1.00" /></div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Compounding Method</Label><Select value={debtForm.compounding_method} onValueChange={(v) => setDebtForm(f => ({ ...f, compounding_method: v ?? "semi_annual" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="semi_annual">Semi-Annual (Canadian)</SelectItem><SelectItem value="monthly">Monthly (US)</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent></Select></div>
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea value={debtForm.notes} onChange={(e) => setDebtForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." rows={2} /></div>
                <Button type="submit" className="w-full" disabled={createDebt.isPending}>{createDebt.isPending ? "Adding..." : "Add Debt Facility"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Debt Facility Cards */}
      {!debtFacilities || debtFacilities.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Landmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm font-medium text-muted-foreground">No debt facilities recorded</p><p className="text-xs text-muted-foreground mt-1">Add a mortgage, construction loan, or other debt facility to track terms and amortization.</p></CardContent></Card>
      ) : (
        (debtFacilities as DebtFacility[]).map((debt) => (
          <Card key={debt.debt_id} className="overflow-hidden">
            {editingDebtId === debt.debt_id ? (
              <CardContent className="pt-6">
                <form onSubmit={handleUpdateDebt} className="space-y-4">
                  <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold">Edit Debt Facility</p><Button type="button" variant="ghost" size="sm" onClick={() => { setEditingDebtId(null); resetDebtForm(); }}>Cancel</Button></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1"><Label className="text-xs">Lender Name *</Label><Input value={debtForm.lender_name} onChange={(e) => setDebtForm(f => ({ ...f, lender_name: e.target.value }))} required /></div>
                    <div className="space-y-1"><Label className="text-xs">Debt Type</Label><Select value={debtForm.debt_type} onValueChange={(v) => setDebtForm(f => ({ ...f, debt_type: v ?? "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="permanent_mortgage">Permanent Mortgage</SelectItem><SelectItem value="construction_loan">Construction Loan</SelectItem><SelectItem value="bridge_loan">Bridge Loan</SelectItem><SelectItem value="mezzanine">Mezzanine</SelectItem><SelectItem value="line_of_credit">Line of Credit</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-xs">Rate Type</Label><Select value={debtForm.rate_type} onValueChange={(v) => setDebtForm(f => ({ ...f, rate_type: v ?? "" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="variable">Variable</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Commitment ($)</Label><Input type="number" step="0.01" value={debtForm.commitment_amount} onChange={(e) => setDebtForm(f => ({ ...f, commitment_amount: e.target.value }))} required /></div>
                    <div className="space-y-1"><Label className="text-xs">Drawn ($)</Label><Input type="number" step="0.01" value={debtForm.drawn_amount} onChange={(e) => setDebtForm(f => ({ ...f, drawn_amount: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Outstanding ($)</Label><Input type="number" step="0.01" value={debtForm.outstanding_balance} onChange={(e) => setDebtForm(f => ({ ...f, outstanding_balance: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Rate (%)</Label><Input type="number" step="0.01" value={debtForm.interest_rate} onChange={(e) => setDebtForm(f => ({ ...f, interest_rate: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Term (mo)</Label><Input type="number" value={debtForm.term_months} onChange={(e) => {
                      const term = e.target.value;
                      setDebtForm(f => {
                        const updated = { ...f, term_months: term };
                        // Auto-calc maturity from origination + term
                        if (f.origination_date && term) {
                          const orig = new Date(f.origination_date + "T00:00:00");
                          orig.setMonth(orig.getMonth() + Number(term));
                          updated.maturity_date = orig.toISOString().slice(0, 10);
                        }
                        return updated;
                      });
                    }} /></div>
                    <div className="space-y-1"><Label className="text-xs">Amort (mo)</Label><Input type="number" value={debtForm.amortization_months} onChange={(e) => setDebtForm(f => ({ ...f, amortization_months: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">IO (mo)</Label><Input type="number" value={debtForm.io_period_months} onChange={(e) => setDebtForm(f => ({ ...f, io_period_months: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Origination Date</Label><Input type="date" value={debtForm.origination_date} onChange={(e) => {
                      const orig = e.target.value;
                      setDebtForm(f => {
                        const updated = { ...f, origination_date: orig };
                        // Auto-calc maturity from origination + term
                        if (orig && f.term_months) {
                          const d = new Date(orig + "T00:00:00");
                          d.setMonth(d.getMonth() + Number(f.term_months));
                          updated.maturity_date = d.toISOString().slice(0, 10);
                        }
                        return updated;
                      });
                    }} /></div>
                    <div className="space-y-1"><Label className="text-xs">Maturity Date</Label><Input type="date" value={debtForm.maturity_date} onChange={(e) => {
                      const mat = e.target.value;
                      setDebtForm(f => {
                        const updated = { ...f, maturity_date: mat };
                        // Auto-calc term from origination to maturity
                        if (f.origination_date && mat) {
                          const orig = new Date(f.origination_date + "T00:00:00");
                          const matDate = new Date(mat + "T00:00:00");
                          const months = (matDate.getFullYear() - orig.getFullYear()) * 12 + (matDate.getMonth() - orig.getMonth());
                          if (months > 0) updated.term_months = String(months);
                        }
                        return updated;
                      });
                    }} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Max LTV Covenant (%)</Label><Input type="number" step="0.01" value={debtForm.ltv_covenant} onChange={(e) => setDebtForm(f => ({ ...f, ltv_covenant: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Min DSCR Covenant (x)</Label><Input type="number" step="0.01" value={debtForm.dscr_covenant} onChange={(e) => setDebtForm(f => ({ ...f, dscr_covenant: e.target.value }))} /></div>
                  </div>
                  {/* CMHC / Insured Mortgage Section */}
                  <div className="border rounded-lg p-3 bg-purple-50/30 border-purple-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />CMHC / Insurance</p>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={debtForm.is_cmhc_insured} onChange={(e) => setDebtForm(f => ({ ...f, is_cmhc_insured: e.target.checked }))} className="rounded" />
                        CMHC Insured
                      </label>
                    </div>
                    {debtForm.is_cmhc_insured && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">CMHC Program</Label><Select value={debtForm.cmhc_program} onValueChange={(v) => setDebtForm(f => ({ ...f, cmhc_program: v ?? "" }))}><SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger><SelectContent><SelectItem value="Standard">Standard</SelectItem><SelectItem value="MLI Select">MLI Select</SelectItem><SelectItem value="Flex">Flex</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-xs">Insurance Premium (%)</Label><Input type="number" step="0.25" value={debtForm.cmhc_insurance_premium_pct} onChange={(e) => setDebtForm(f => ({ ...f, cmhc_insurance_premium_pct: e.target.value }))} placeholder="4.00" /></div>
                        <div className="space-y-1"><Label className="text-xs">Application Fee ($)</Label><Input type="number" step="100" value={debtForm.cmhc_application_fee} onChange={(e) => setDebtForm(f => ({ ...f, cmhc_application_fee: e.target.value }))} placeholder="3,500" /></div>
                        <div className="space-y-1"><Label className="text-xs">Lender Fee (%)</Label><Input type="number" step="0.25" value={debtForm.lender_fee_pct} onChange={(e) => setDebtForm(f => ({ ...f, lender_fee_pct: e.target.value }))} placeholder="1.00" /></div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Compounding Method</Label><Select value={debtForm.compounding_method} onValueChange={(v) => setDebtForm(f => ({ ...f, compounding_method: v ?? "semi_annual" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="semi_annual">Semi-Annual (Canadian)</SelectItem><SelectItem value="monthly">Monthly (US)</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent></Select></div>
                    </div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea value={debtForm.notes} onChange={(e) => setDebtForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
                  <Button type="submit" className="w-full" disabled={updateDebt.isPending}>{updateDebt.isPending ? "Saving..." : "Save Changes"}</Button>
                </form>
              </CardContent>
            ) : (
              <>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">{debt.lender_name}</CardTitle>
                        <Badge variant={debt.status === "active" ? "default" : "secondary"} className="text-xs capitalize">{debt.status.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{debt.debt_type.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Banknote className="h-3 w-3" />{debt.rate_type} {debt.interest_rate != null ? `@ ${Number(debt.interest_rate).toFixed(2)}%` : ""}</span>
                        {debt.term_months && <span>{debt.term_months}mo term</span>}
                        {debt.amortization_months && <span>{debt.amortization_months}mo amortization</span>}
                        {(debt.io_period_months ?? 0) > 0 && <span>{debt.io_period_months}mo IO</span>}
                        {debt.origination_date && <span>Orig: {formatDate(debt.origination_date)}</span>}
                        {debt.maturity_date && <span>Mat: {formatDate(debt.maturity_date)}</span>}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-lg font-bold">{formatCurrency(debt.commitment_amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(debt.outstanding_balance)} outstanding</p>
                      </div>
                      {canEdit && (<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => startEditDebt(debt)}><Edit2 className="h-3.5 w-3.5" /></Button>)}
                    </div>
                  </div>
                </CardHeader>
                <div className="px-6 pb-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-2.5"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Drawn</p><p className="text-sm font-semibold">{formatCurrency(debt.drawn_amount)}</p></div>
                    <div className="bg-muted/50 rounded-lg p-2.5"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Available</p><p className="text-sm font-semibold">{formatCurrency(debt.commitment_amount - debt.drawn_amount)}</p></div>
                    <div className="bg-muted/50 rounded-lg p-2.5"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Est. Monthly Pmt</p><p className="text-sm font-semibold">{(() => { const bal = debt.outstanding_balance ?? 0; const rate = (debt.interest_rate ?? 0) / 100; const amort = debt.amortization_months ?? 0; if (bal <= 0 || rate <= 0) return "—"; const mr = rate / 12; if (amort > 0 && (debt.io_period_months ?? 0) <= 0) { const pmt = bal * (mr * Math.pow(1 + mr, amort)) / (Math.pow(1 + mr, amort) - 1); return formatCurrency(pmt); } return formatCurrency(bal * mr) + " (IO)"; })()}</p></div>
                    <div className="bg-muted/50 rounded-lg p-2.5"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Est. Annual DS</p><p className="text-sm font-semibold">{(() => { const bal = debt.outstanding_balance ?? 0; const rate = (debt.interest_rate ?? 0) / 100; const amort = debt.amortization_months ?? 0; if (bal <= 0 || rate <= 0) return "—"; const mr = rate / 12; if (amort > 0 && (debt.io_period_months ?? 0) <= 0) { const pmt = bal * (mr * Math.pow(1 + mr, amort)) / (Math.pow(1 + mr, amort) - 1); return formatCurrency(pmt * 12); } return formatCurrency(bal * rate); })()}</p></div>
                  </div>
                </div>
                {/* Lending Metrics */}
                {(() => {
                  const m = getMetrics(debt.debt_id);
                  if (!m) return null;
                  return (
                    <div className="px-6 pb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {m.ltv != null && (
                          <div className={cn("rounded-lg p-2.5 border", m.ltv > 80 ? "bg-red-50 border-red-200" : m.ltv > 75 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200")}>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">LTV</p>
                            <p className={cn("text-sm font-bold", m.ltv > 80 ? "text-red-700" : m.ltv > 75 ? "text-amber-700" : "text-green-700")}>{m.ltv.toFixed(1)}%</p>
                            <p className="text-[9px] text-muted-foreground">vs {m.ltv_basis}</p>
                          </div>
                        )}
                        {m.ltc != null && (
                          <div className={cn("rounded-lg p-2.5 border", m.ltc > 80 ? "bg-red-50 border-red-200" : m.ltc > 75 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200")}>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">LTC</p>
                            <p className={cn("text-sm font-bold", m.ltc > 80 ? "text-red-700" : m.ltc > 75 ? "text-amber-700" : "text-green-700")}>{m.ltc.toFixed(1)}%</p>
                            <p className="text-[9px] text-muted-foreground">vs {m.ltc_basis}</p>
                          </div>
                        )}
                        {m.dscr != null && (
                          <div className={cn("rounded-lg p-2.5 border", m.dscr < 1.0 ? "bg-red-50 border-red-200" : m.dscr < 1.2 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200")}>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">DSCR</p>
                            <p className={cn("text-sm font-bold", m.dscr < 1.0 ? "text-red-700" : m.dscr < 1.2 ? "text-amber-700" : "text-green-700")}>{m.dscr.toFixed(2)}x</p>
                            <p className="text-[9px] text-muted-foreground">NOI ${m.dscr_noi?.toLocaleString()}</p>
                          </div>
                        )}
                        {m.debt_yield != null && (
                          <div className={cn("rounded-lg p-2.5 border", m.debt_yield < 7 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200")}>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Debt Yield</p>
                            <p className={cn("text-sm font-bold", m.debt_yield < 7 ? "text-amber-700" : "text-green-700")}>{m.debt_yield.toFixed(1)}%</p>
                            <p className="text-[9px] text-muted-foreground">NOI / Balance</p>
                          </div>
                        )}
                      </div>
                      {/* Per-facility concerns */}
                      {m.concerns && m.concerns.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.concerns.map((c: any, ci: number) => (
                            <div key={ci} className={cn("flex items-start gap-1.5 text-[11px] rounded px-2 py-1",
                              c.severity === "high" ? "text-red-700 bg-red-50" : c.severity === "medium" ? "text-amber-700 bg-amber-50" : "text-blue-700 bg-blue-50"
                            )}>
                              <span className="shrink-0 mt-0.5">{c.severity === "high" ? "●" : c.severity === "medium" ? "▲" : "ℹ"}</span>
                              <span>{c.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {(debt.ltv_covenant || debt.dscr_covenant) && (
                  <div className="px-6 pb-3 flex flex-wrap gap-2">
                    {debt.ltv_covenant && (<span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200"><Shield className="h-3 w-3 mr-1" />LTV Covenant: {debt.ltv_covenant}%</span>)}
                    {debt.dscr_covenant && (<span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200"><Shield className="h-3 w-3 mr-1" />DSCR Covenant: {debt.dscr_covenant}x</span>)}
                  </div>
                )}
                {debt.notes && (<div className="px-6 pb-3"><p className="text-xs text-muted-foreground italic">{debt.notes}</p></div>)}
                <CardContent className="pt-0">
                  <button onClick={() => setExpandedDebtId(expandedDebtId === debt.debt_id ? null : debt.debt_id)} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                    {expandedDebtId === debt.debt_id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {expandedDebtId === debt.debt_id ? "Hide" : "View"} amortization schedule
                  </button>
                  {expandedDebtId === debt.debt_id && (<AmortizationPanel propertyId={propertyId} debtId={debt.debt_id} />)}
                </CardContent>
              </>
            )}
          </Card>
        ))
      )}

      {/* Cash Flow Impact Summary */}
      {(debtFacilities ?? []).length > 0 && property && (
        <Card className="border-t-4 border-t-emerald-500">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" />Cash Flow Impact Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead className="text-xs">Metric</TableHead><TableHead className="text-xs text-right">Annual</TableHead><TableHead className="text-xs text-right">Monthly</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(() => {
                    const purchasePrice = Number(property.purchase_price ?? property.current_market_value ?? 0);
                    // Use underwriting summary NOI (phase-aware) instead of raw property fields
                    const noi = uwSummary?.noi ?? 0;
                    const cashAfterDS = noi - totalAnnualDebtService;
                    const capRate = purchasePrice > 0 && noi > 0 ? (noi / purchasePrice) * 100 : 0;
                    const dscr = totalAnnualDebtService > 0 && noi > 0 ? noi / totalAnnualDebtService : 0;
                    const cashOnCash = (purchasePrice - totalDebtOutstanding) > 0 && cashAfterDS > 0 ? (cashAfterDS / (purchasePrice - totalDebtOutstanding)) * 100 : 0;
                    return (
                      <>
                        <TableRow><TableCell className="text-xs font-medium">Net Operating Income (NOI)</TableCell><TableCell className="text-xs text-right font-semibold">{noi > 0 ? formatCurrency(noi) : "—"}</TableCell><TableCell className="text-xs text-right">{noi > 0 ? formatCurrency(noi / 12) : "—"}</TableCell></TableRow>
                        <TableRow><TableCell className="text-xs font-medium text-red-700">Less: Total Debt Service</TableCell><TableCell className="text-xs text-right font-semibold text-red-700">{totalAnnualDebtService > 0 ? `(${formatCurrency(totalAnnualDebtService)})` : "—"}</TableCell><TableCell className="text-xs text-right text-red-700">{totalAnnualDebtService > 0 ? `(${formatCurrency(totalAnnualDebtService / 12)})` : "—"}</TableCell></TableRow>
                        <TableRow className="border-t-2 border-t-foreground/20"><TableCell className="text-xs font-bold">Cash Flow After Debt Service</TableCell><TableCell className={cn("text-xs text-right font-bold", cashAfterDS >= 0 ? "text-green-700" : "text-red-700")}>{noi > 0 ? formatCurrency(cashAfterDS) : "—"}</TableCell><TableCell className={cn("text-xs text-right", cashAfterDS >= 0 ? "text-green-700" : "text-red-700")}>{noi > 0 ? formatCurrency(cashAfterDS / 12) : "—"}</TableCell></TableRow>
                        <TableRow><TableCell colSpan={3} className="pt-4 pb-2"><div className="grid grid-cols-3 gap-4"><div className="text-center"><p className="text-[10px] text-muted-foreground font-medium uppercase">Cap Rate</p><p className="text-lg font-bold">{capRate > 0 ? `${capRate.toFixed(2)}%` : "—"}</p></div><div className="text-center"><p className="text-[10px] text-muted-foreground font-medium uppercase">DSCR</p><p className={cn("text-lg font-bold", dscr > 0 && dscr < 1.2 ? "text-red-700" : dscr >= 1.2 ? "text-green-700" : "")}>{dscr > 0 ? `${dscr.toFixed(2)}x` : "—"}</p></div><div className="text-center"><p className="text-[10px] text-muted-foreground font-medium uppercase">Cash-on-Cash</p><p className="text-lg font-bold">{cashOnCash > 0 ? `${cashOnCash.toFixed(1)}%` : "—"}</p></div></div></TableCell></TableRow>
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
