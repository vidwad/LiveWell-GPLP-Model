"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ProFormaTab } from "@/components/property/ProFormaTab";
import { AreaResearchTab } from "@/components/property/AreaResearchTab";
import { ConstructionBudgetTab } from "@/components/property/ConstructionBudgetTab";
import { ValuationTab } from "@/components/property/ValuationTab";
import { OverviewTab } from "@/components/property/OverviewTab";
import { LifecycleTab } from "@/components/property/LifecycleTab";
import { UnitsBedsTab } from "@/components/property/UnitsBedsTab";
import { RentRollTab } from "@/components/property/RentRollTab";
import { DebtFinancingTab } from "@/components/property/DebtFinancingTab";
import { DevPlansTab } from "@/components/property/DevPlansTab";
import { ProjectionsTab } from "@/components/property/ProjectionsTab";
import { ExitScenariosTab } from "@/components/property/ExitScenariosTab";
import { PropertyLookup } from "@/components/property/PropertyLookup";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calculator,
  ChevronDown,
  ChevronRight,
  Building2,
  DollarSign,
  MapPin,
  Ruler,
  Landmark,
  TrendingUp,
  Calendar,
  Layers,
  BarChart3,
  GitCompare,
  Activity,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  AlertCircle,
  SkipForward,
  Edit2,
  Pencil,
  Save,
  X,
  Banknote,
  Shield,
  Users,
  HardHat,
  Home,
  Wrench,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import {
  useProperty,
  useDevelopmentPlans,
  useCreatePlan,
  useDeleteProperty,
  useDebtFacilities,
  useAmortizationSchedule,
  useRunProjection,
  useRefinanceScenarios,
  useCreateRefinanceScenario,
  useDeleteRefinanceScenario,
  useSaleScenarios,
  useCreateSaleScenario,
  useDeleteSaleScenario,
  usePropertyUnits,
  usePropertyUnitSummary,
  useCreatePropertyUnit,
  useDeletePropertyUnit,
  useCreateDebtFacility,
  useUpdateDebtFacility,
  useRentRoll,
  useUpdateRentPricingMode,
  useUpdateAnnualRentIncrease,
  useUpdateBed,
  useUpdatePlan,
  useDeletePlan,
  useCreateBed,
  useDeleteBed,
  useUpdatePropertyUnit,
  useImportRentRoll,
} from "@/hooks/usePortfolio";
import {
  useStageTransitions,
  useAllowedTransitions,
  useTransitionProperty,
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
} from "@/hooks/useLifecycle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/providers/AuthProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatCurrencyCompact, formatDate, cn } from "@/lib/utils";
import {
  DevelopmentPlan,
  DevelopmentPlanCreate,
  DebtFacility,
  ProjectionResult,
  ProjectionRow,
  ProjectionSummary,
  ProjectionInput,
  ProjectionFees,
  PropertyUnit,
  Bed,
  Bedroom,
  UnitSummaryBase,
  UnitSummaryResponse,
  RedevelopmentPhase,
  ValuationScenario,
  RentRollResponse,
  RentRollUnit,
  RentRollPlanPhase,
  RentRollComparison,
  EscalationYear,
  RentRollData,
  UnitMixEntry,
  FloorBreakdownEntry,
  EditPlanForm,
} from "@/types/portfolio";
import type { StageTransition, PropertyMilestone, DevelopmentStage } from "@/types/lifecycle";

/* ── Stage helpers ──────────────────────────────────────────────────────────── */

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  prospect:          { label: "Prospect",          color: "text-slate-700",  bg: "bg-slate-100 border-slate-200",  order: 0 },
  acquisition:       { label: "Acquisition",       color: "text-purple-700", bg: "bg-purple-50 border-purple-200", order: 1 },
  interim_operation: { label: "Interim Operation", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", order: 2 },
  planning:          { label: "Planning",          color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", order: 3 },
  construction:      { label: "Construction",      color: "text-orange-700", bg: "bg-orange-50 border-orange-200", order: 4 },
  lease_up:          { label: "Lease-Up",          color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    order: 5 },
  stabilized:        { label: "Stabilized",        color: "text-green-700",  bg: "bg-green-50 border-green-200",  order: 6 },
  exit:              { label: "Exit",              color: "text-red-700",    bg: "bg-red-50 border-red-200",      order: 7 },
};

const STAGE_ORDER = ["prospect", "acquisition", "interim_operation", "planning", "construction", "lease_up", "stabilized", "exit"];

const PHASE_COLORS: Record<string, string> = {
  interim:      "bg-yellow-100 text-yellow-800",
  construction: "bg-orange-100 text-orange-800",
  lease_up:     "bg-blue-100 text-blue-800",
  stabilized:   "bg-green-100 text-green-800",
};

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] ?? { label: stage, color: "text-gray-700", bg: "bg-gray-100 border-gray-200" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", cfg.bg, cfg.color)}>
      <span className={cn("h-2 w-2 rounded-full", cfg.color.replace("text-", "bg-"))} />
      {cfg.label}
    </span>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────────────── */

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border bg-white p-3 sm:p-4 shadow-sm min-w-0">
      <div className={cn("flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg", accent ?? "bg-slate-100 text-slate-600")}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] sm:text-xs font-medium text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm sm:text-base lg:text-lg font-bold leading-tight whitespace-nowrap">{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Amortization Panel ─────────────────────────────────────────────────────── */

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
          <button
            key={y}
            onClick={() => setYears(y)}
            className={cn(
              "px-3 py-1 text-xs rounded-full border transition-colors font-medium",
              years === y
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white hover:bg-muted border-border"
            )}
          >
            {y}yr
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wide">Annual Summary</p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Opening Bal.</TableHead>
                <TableHead className="text-right">Payment</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Closing Bal.</TableHead>
              </TableRow>
            </TableHeader>
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

      <button
        onClick={() => setShowMonthly((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
      >
        {showMonthly ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {showMonthly ? "Hide" : "Show"} monthly schedule
      </button>

      {showMonthly && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>#</TableHead>
                <TableHead>Yr</TableHead>
                <TableHead>Mo</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Payment</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((row) => (
                <TableRow key={row.period}>
                  <TableCell className="text-muted-foreground">{row.period}</TableCell>
                  <TableCell>{row.year}</TableCell>
                  <TableCell>{row.month}</TableCell>
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

/* ── Main Page ──────────────────────────────────────────────────────────────── */

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const propertyId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const { data: property, isLoading } = useProperty(propertyId);
  const { data: plans } = useDevelopmentPlans(propertyId);
  const { mutateAsync: createPlan, isPending: planPending } = useCreatePlan(propertyId);
  const { mutateAsync: updatePlan, isPending: updatePlanPending } = useUpdatePlan(propertyId);
  const { mutateAsync: deletePlan } = useDeletePlan(propertyId);
  const { mutateAsync: deleteProperty, isPending: deletePending } = useDeleteProperty();

  // Debt & Amortization
  const { data: debtFacilities } = useDebtFacilities(propertyId);
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
  });
  const resetDebtForm = () => setDebtForm({
    lender_name: "", debt_type: "permanent_mortgage", commitment_amount: "",
    drawn_amount: "0", outstanding_balance: "", interest_rate: "",
    rate_type: "fixed", term_months: "", amortization_months: "",
    io_period_months: "0", origination_date: "", maturity_date: "",
    ltv_covenant: "", dscr_covenant: "", notes: "",
  });

  // Projections
  const { mutateAsync: runProjection, isPending: projPending } = useRunProjection(propertyId);
  const [projResults, setProjResults] = useState<ProjectionResult | null>(null);
  const [projForm, setProjForm] = useState({
    planned_units: "", monthly_rent_per_unit: "", annual_expense_ratio: "35",
    vacancy_rate: "5", annual_rent_increase: "3", expense_growth_rate: "2",
    construction_start_date: "", construction_months: "9",
    lease_up_months: "6", annual_debt_service: "", exit_cap_rate: "5.5",
    disposition_cost_pct: "2", total_equity_invested: "", debt_balance_at_exit: "",
    carrying_cost_annual: "",
    // LP Fee parameters
    management_fee_rate: "2.5", construction_mgmt_fee_rate: "1.5",
    construction_budget: "", selling_commission_rate: "10",
    offering_cost: "250000", acquisition_fee_rate: "2",
    acquisition_cost: "", gross_raise: "",
    refinancing_fee_rate: "2.5", refinance_amount: "",
    turnover_fee_rate: "2", property_fmv_at_turnover: "",
    lp_profit_share: "70", gp_profit_share: "30",
  });

  // Refinance Scenarios
  const { data: refiScenarios } = useRefinanceScenarios(propertyId);
  const { mutateAsync: createRefi, isPending: refiPending } = useCreateRefinanceScenario(propertyId);
  const { mutateAsync: deleteRefi } = useDeleteRefinanceScenario(propertyId);
  const [refiForm, setRefiForm] = useState({
    label: "Refinance Scenario", assumed_new_valuation: "", new_ltv_percent: "75",
    new_interest_rate: "", new_amortization_months: "300", existing_debt_payout: "",
    closing_costs: "0", notes: "",
    expected_date: "", linked_event: "", linked_milestone_id: "",
    total_equity_invested: "", annual_noi_at_refi: "", hold_period_months: "",
  });
  const [expandedRefi, setExpandedRefi] = useState<number | null>(null);

  // Sale Scenarios
  const { data: saleScenarios } = useSaleScenarios(propertyId);
  const { mutateAsync: createSale, isPending: salePending } = useCreateSaleScenario(propertyId);
  const { mutateAsync: deleteSale } = useDeleteSaleScenario(propertyId);
  const [saleForm, setSaleForm] = useState({
    label: "Sale Scenario", assumed_sale_price: "", selling_costs_percent: "5",
    debt_payout: "", capital_gains_reserve: "0", notes: "",
    expected_date: "", linked_event: "", linked_milestone_id: "",
    total_equity_invested: "", annual_noi_at_sale: "", hold_period_months: "",
    annual_cash_flow: "",
  });
  const [expandedSale, setExpandedSale] = useState<number | null>(null);

  // Plan form
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState<DevelopmentPlanCreate>({
    planned_units: 0, planned_beds: 0, planned_sqft: 0,
    estimated_construction_cost: 0, development_start_date: "", construction_duration_days: 0,
  });

  // Plan editing state
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editPlanForm, setEditPlanForm] = useState<EditPlanForm>({
    plan_name: "", status: "", planned_units: 0, planned_beds: 0, planned_sqft: 0,
    estimated_construction_cost: 0, development_start_date: "", construction_duration_days: 0,
    hard_costs: 0, soft_costs: 0, site_costs: 0, financing_costs: 0,
    contingency_percent: 0, cost_per_sqft: 0,
    projected_annual_revenue: 0, projected_annual_noi: 0,
    estimated_completion_date: "", estimated_stabilization_date: "",
    rent_pricing_mode: "", annual_rent_increase_pct: 0,
  });

  const startEditingPlan = (plan: DevelopmentPlan) => {
    setEditingPlanId(plan.plan_id);
    setEditPlanForm({
      plan_name: plan.plan_name || "",
      status: plan.status || "draft",
      planned_units: plan.planned_units,
      planned_beds: plan.planned_beds,
      planned_sqft: Number(plan.planned_sqft) || 0,
      estimated_construction_cost: Number(plan.estimated_construction_cost) || 0,
      hard_costs: Number(plan.hard_costs) || 0,
      soft_costs: Number(plan.soft_costs) || 0,
      site_costs: Number(plan.site_costs) || 0,
      financing_costs: Number(plan.financing_costs) || 0,
      contingency_percent: Number(plan.contingency_percent) || 0,
      cost_per_sqft: Number(plan.cost_per_sqft) || 0,
      projected_annual_revenue: Number(plan.projected_annual_revenue) || 0,
      projected_annual_noi: Number(plan.projected_annual_noi) || 0,
      development_start_date: plan.development_start_date || "",
      construction_duration_days: plan.construction_duration_days || 0,
      estimated_completion_date: plan.estimated_completion_date || "",
      estimated_stabilization_date: plan.estimated_stabilization_date || "",
      rent_pricing_mode: plan.rent_pricing_mode || "by_bed",
      annual_rent_increase_pct: Number(plan.annual_rent_increase_pct) || 0,
    });
  };

  const handleSavePlan = async () => {
    if (!editingPlanId) return;
    try {
      const data: Record<string, string | number | undefined> = {};
      for (const [key, value] of Object.entries(editPlanForm)) {
        if (value !== "" && value !== 0) data[key] = value;
        else if (key === "plan_name" && value === "") continue;
        else data[key] = value || undefined;
      }
      await updatePlan({ planId: editingPlanId, data });
      toast.success("Development plan updated");
      setEditingPlanId(null);
    } catch (e) { toast.error("Failed to update plan"); }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm("Delete this development plan? This cannot be undone.")) return;
    try {
      await deletePlan(planId);
      toast.success("Development plan deleted");
    } catch (e) { toast.error("Failed to delete plan"); }
  };

  // Plan comparison
  const [compareMode, setCompareMode] = useState(false);
  const [comparePlanIds, setComparePlanIds] = useState<[number | null, number | null]>([null, null]);

  // Units & Beds
  const { data: units } = usePropertyUnits(propertyId);
  const { data: unitSummary } = usePropertyUnitSummary(propertyId);
  const createUnit = useCreatePropertyUnit(propertyId);
  const deleteUnit = useDeletePropertyUnit(propertyId);
  const importRentRoll = useImportRentRoll(propertyId);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<{ created_units: number; created_beds: number; errors: string[] } | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);

  // Rent Roll — multi-phase response: { baseline, plan_phases[], comparison, escalation }
  const { data: rentRollData } = useRentRoll(propertyId);
  const updatePricingMode = useUpdateRentPricingMode(propertyId);
  const updateAnnualRentIncrease = useUpdateAnnualRentIncrease(propertyId);
  const updateBedMutation = useUpdateBed(propertyId);
  const createBedMutation = useCreateBed(propertyId);
  const deleteBedMutation = useDeleteBed(propertyId);
  const updateUnitMutation = useUpdatePropertyUnit(propertyId);
  const [editingBedId, setEditingBedId] = useState<number | null>(null);
  const [editBedRent, setEditBedRent] = useState("");
  const [expandedRentUnit, setExpandedRentUnit] = useState<number | null>(null);
  const [rentIncreaseInput, setRentIncreaseInput] = useState("");
  const [addingBedToUnit, setAddingBedToUnit] = useState<number | null>(null);
  const [newBedRent, setNewBedRent] = useState("1400");
  const [newBedRoom, setNewBedRoom] = useState<number>(1);

  // Lifecycle
  const { data: transitions } = useStageTransitions(propertyId);
  const { data: allowedTransitions } = useAllowedTransitions(propertyId);
  const transitionMutation = useTransitionProperty(propertyId);
  const { data: milestones } = useMilestones(propertyId);
  const createMilestone = useCreateMilestone(propertyId);
  const updateMilestone = useUpdateMilestone(propertyId);
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [transitionForm, setTransitionForm] = useState({ to_stage: "", notes: "", force: false });
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ title: "", description: "", target_date: "", stage: "" });

  const canEdit = user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  /* ── Computed values ── */
  const totalDebtCommitment = (debtFacilities ?? []).reduce(
    (sum: number, d: { commitment_amount: number }) => sum + (d.commitment_amount ?? 0), 0
  );
  const totalDebtOutstanding = (debtFacilities ?? []).reduce(
    (sum: number, d: { outstanding_balance: number }) => sum + (d.outstanding_balance ?? 0), 0
  );
  const activePlan = (plans ?? []).find((p: { status: string }) => p.status === "active") ?? (plans ?? [])[0];

  // Backward-compatible rentRoll alias: prefer the last plan phase, fall back to baseline
  const rentRoll = (() => {
    const phases = rentRollData?.plan_phases;
    if (phases && phases.length > 0) {
      const last = phases[phases.length - 1];
      return last.rent_roll ?? null;
    }
    return rentRollData?.baseline?.rent_roll ?? null;
  })();

  /* ── Handlers ── */
  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<DebtFacility> & { lender_name: string; debt_type: string; commitment_amount: number } = {
        lender_name: debtForm.lender_name,
        debt_type: debtForm.debt_type,
        commitment_amount: Number(debtForm.commitment_amount),
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
        debtId: editingDebtId,
        lender_name: debtForm.lender_name,
        debt_type: debtForm.debt_type,
        status: "active",
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
      };
      await updateDebt.mutateAsync(payload);
      toast.success("Debt facility updated");
      setEditingDebtId(null);
      resetDebtForm();
    } catch (e) { toast.error("Failed to update debt facility"); }
  };

  const startEditDebt = (debt: DebtFacility) => {
    setDebtForm({
      lender_name: debt.lender_name ?? "",
      debt_type: debt.debt_type ?? "permanent_mortgage",
      commitment_amount: String(debt.commitment_amount ?? ""),
      drawn_amount: String(debt.drawn_amount ?? "0"),
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
    });
    setEditingDebtId(debt.debt_id);
  };

  // Computed: total annual debt service (rough estimate from all active facilities)
  const totalAnnualDebtService = (debtFacilities ?? []).reduce((sum: number, d: { outstanding_balance: number; interest_rate: number | null; amortization_months: number | null; io_period_months: number | null }) => {
    const bal = d.outstanding_balance ?? 0;
    const rate = (d.interest_rate ?? 0) / 100;
    const amort = d.amortization_months ?? 0;
    const io = d.io_period_months ?? 0;
    if (bal <= 0 || rate <= 0) return sum;
    const monthlyRate = rate / 12;
    if (amort > 0 && io <= 0) {
      const pmt = bal * (monthlyRate * Math.pow(1 + monthlyRate, amort)) / (Math.pow(1 + monthlyRate, amort) - 1);
      return sum + pmt * 12;
    }
    // IO or construction loan: interest only
    return sum + bal * rate;
  }, 0);

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPlan(planForm);
      toast.success("Development plan added");
      setPlanOpen(false);
    } catch (e) { toast.error("Failed to add plan"); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    try {
      await deleteProperty(propertyId);
      toast.success("Property deleted");
      router.push("/portfolio");
    } catch (e) { toast.error("Failed to delete property"); }
  };

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
      };
      const result = await runProjection(input) as ProjectionResult;
      setProjResults(result);
      toast.success("Projection complete");
    } catch (e) { toast.error("Failed to run projection"); }
  };

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

  /* ── Loading / Not Found ── */
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!property) return <p className="text-muted-foreground">Property not found.</p>;

  const stage = property.development_stage ?? "prospect";

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════════════════════════ */}
      <div>
        <LinkButton variant="ghost" size="sm" href="/portfolio" className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Properties
        </LinkButton>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{property.address}</h1>
              <StageBadge stage={stage} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {property.city}, {property.province}
              </span>
              {property.lp_name && (
                <span className="flex items-center gap-1">
                  <Landmark className="h-3.5 w-3.5" />
                  {property.lp_name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LinkButton variant="outline" size="sm" href={`/portfolio/${propertyId}/model`}>
              <Calculator className="mr-1.5 h-4 w-4" />
              Financial Model
            </LinkButton>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deletePending} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          KPI STRIP
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={DollarSign}
          label="Purchase Price"
          value={property.purchase_price ? formatCurrencyCompact(property.purchase_price) : "—"}
          sub={property.purchase_date ? `Acquired ${formatDate(property.purchase_date)}` : undefined}
          accent="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          icon={TrendingUp}
          label="Market Value"
          value={property.current_market_value ? formatCurrencyCompact(property.current_market_value) : "—"}
          sub={property.assessed_value ? `Assessed: ${formatCurrencyCompact(property.assessed_value)}` : undefined}
          accent="bg-blue-50 text-blue-600"
        />
        <KpiCard
          icon={Landmark}
          label="Total Debt"
          value={totalDebtCommitment > 0 ? formatCurrencyCompact(totalDebtCommitment) : "—"}
          sub={totalDebtOutstanding > 0 ? `${formatCurrencyCompact(totalDebtOutstanding)} out.` : `${(debtFacilities ?? []).length} facilities`}
          accent="bg-amber-50 text-amber-600"
        />
        <KpiCard
          icon={Ruler}
          label="Lot Size"
          value={property.lot_size ? `${Number(property.lot_size).toLocaleString()} sqft` : "—"}
          sub={property.floor_area_ratio ? `FAR: ${property.floor_area_ratio}` : undefined}
          accent="bg-violet-50 text-violet-600"
        />
        <KpiCard
          icon={Layers}
          label="Zoning"
          value={property.zoning ?? "—"}
          sub={property.max_buildable_area ? `Max: ${Number(property.max_buildable_area).toLocaleString()} sqft` : undefined}
          accent="bg-rose-50 text-rose-600"
        />
        <KpiCard
          icon={Building2}
          label="Dev. Plan"
          value={activePlan ? `${activePlan.planned_units} units` : "—"}
          sub={activePlan?.projected_annual_noi ? `NOI: ${formatCurrencyCompact(activePlan.projected_annual_noi)}` : undefined}
          accent="bg-cyan-50 text-cyan-600"
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TABS
      ════════════════════════════════════════════════════════════════════════ */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="w-full sm:w-auto">
            <TabsTrigger value="overview"><Building2 className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Overview</span></TabsTrigger>
            <TabsTrigger value="lifecycle"><Activity className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Lifecycle</span></TabsTrigger>
            <TabsTrigger value="units"><Ruler className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Units & Beds</span></TabsTrigger>
            <TabsTrigger value="rentroll"><DollarSign className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Rent Roll</span></TabsTrigger>
            <TabsTrigger value="plans"><Layers className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Dev Plans</span></TabsTrigger>
            <TabsTrigger value="construction"><HardHat className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Construction</span></TabsTrigger>
            <TabsTrigger value="debt"><Landmark className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Debt & Financing</span></TabsTrigger>
            <TabsTrigger value="projections"><BarChart3 className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Projections</span></TabsTrigger>
            <TabsTrigger value="exit"><TrendingUp className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Exit Scenarios</span></TabsTrigger>
            <TabsTrigger value="valuation"><Banknote className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Valuation</span></TabsTrigger>
            <TabsTrigger value="proforma"><Calculator className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Pro Forma</span></TabsTrigger>
            <TabsTrigger value="area-research"><MapPin className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Area Research</span></TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-6">
          <OverviewTab
            property={property}
            activePlan={activePlan}
            totalDebtCommitment={totalDebtCommitment}
            totalDebtOutstanding={totalDebtOutstanding}
            debtFacilitiesCount={(debtFacilities ?? []).length}
          />
        </TabsContent>

        {/* ── Lifecycle ── */}
        <TabsContent value="lifecycle" className="mt-6 space-y-6">
          <LifecycleTab propertyId={propertyId} stage={property.development_stage} canEdit={canEdit} />
        </TabsContent>

        {/* ── Units & Beds ── */}
        <TabsContent value="units" className="mt-6 space-y-6">
          <UnitsBedsTab propertyId={propertyId} canEdit={canEdit} />
        </TabsContent>

        {/* ── Rent Roll ── */}
        <TabsContent value="rentroll" className="mt-6 space-y-6">
          <RentRollTab propertyId={propertyId} canEdit={canEdit} property={property} />
        </TabsContent>

        {/* ── Development Plans ── */}
        <TabsContent value="plans" className="mt-6">
          <DevPlansTab propertyId={propertyId} canEdit={canEdit} />
        </TabsContent>

        {/* ── Construction Budget vs Actual ── */}
        <TabsContent value="construction" className="mt-6">
          <ConstructionBudgetTab propertyId={propertyId} canEdit={canEdit} />
        </TabsContent>

        {/* ── Debt & Financing ── */}
        <TabsContent value="debt" className="mt-6 space-y-6">
          <DebtFinancingTab
            propertyId={propertyId}
            canEdit={canEdit}
            property={property}
            totalDebtCommitment={totalDebtCommitment}
            totalDebtOutstanding={totalDebtOutstanding}
            totalAnnualDebtService={totalAnnualDebtService}
          />
        </TabsContent>

        {/* ── Projections ── */}
        <TabsContent value="projections" className="mt-6">
          <ProjectionsTab propertyId={propertyId} totalAnnualDebtService={totalAnnualDebtService} />
        </TabsContent>

        {/* ── Exit Scenarios ── */}
        <TabsContent value="exit" className="mt-6 space-y-8">
          <ExitScenariosTab
            propertyId={propertyId}
            property={property}
            totalDebtOutstanding={totalDebtOutstanding}
            totalAnnualDebtService={totalAnnualDebtService}
          />
        </TabsContent>

        {/* ── Valuation Tab ── */}
        <TabsContent value="valuation" className="mt-6">
          <ValuationTab propertyId={propertyId} canEdit={canEdit} />
        </TabsContent>

        {/* ── Pro Forma Tab ── */}
        <TabsContent value="proforma" className="mt-4">
          <ProFormaTab propertyId={propertyId} />
        </TabsContent>

        {/* ── Area Research Tab ── */}
        <TabsContent value="area-research" className="mt-4">
          <AreaResearchTab
            propertyId={propertyId}
            address={property?.address}
            city={property?.city}
            zoning={property?.zoning}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
