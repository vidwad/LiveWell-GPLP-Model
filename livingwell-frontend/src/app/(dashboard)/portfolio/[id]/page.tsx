"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Banknote,
  Shield,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatCurrencyCompact, formatDate, cn } from "@/lib/utils";
import { DevelopmentPlan, DevelopmentPlanCreate } from "@/types/portfolio";

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
  const [projResults, setProjResults] = useState<Array<Record<string, unknown>> | null>(null);
  const [projForm, setProjForm] = useState({
    planned_units: "", monthly_rent_per_unit: "", annual_expense_ratio: "35",
    vacancy_rate_stabilized: "5", construction_start_date: "", construction_months: "18",
    lease_up_months: "12", annual_debt_service: "", exit_cap_rate: "5.5",
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

  // Plan comparison
  const [compareMode, setCompareMode] = useState(false);
  const [comparePlanIds, setComparePlanIds] = useState<[number | null, number | null]>([null, null]);

  // Units & Beds
  const { data: units } = usePropertyUnits(propertyId);
  const { data: unitSummary } = usePropertyUnitSummary(propertyId);
  const createUnit = useCreatePropertyUnit(propertyId);
  const deleteUnit = useDeletePropertyUnit(propertyId);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);

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

  /* ── Handlers ── */
  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
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
    } catch { toast.error("Failed to add debt facility"); }
  };

  const handleUpdateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebtId) return;
    try {
      const payload: Record<string, unknown> = {
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
    } catch { toast.error("Failed to update debt facility"); }
  };

  const startEditDebt = (debt: Record<string, unknown>) => {
    setDebtForm({
      lender_name: String(debt.lender_name ?? ""),
      debt_type: String(debt.debt_type ?? "permanent_mortgage"),
      commitment_amount: String(debt.commitment_amount ?? ""),
      drawn_amount: String(debt.drawn_amount ?? "0"),
      outstanding_balance: String(debt.outstanding_balance ?? ""),
      interest_rate: debt.interest_rate != null ? String(debt.interest_rate) : "",
      rate_type: String(debt.rate_type ?? "fixed"),
      term_months: debt.term_months != null ? String(debt.term_months) : "",
      amortization_months: debt.amortization_months != null ? String(debt.amortization_months) : "",
      io_period_months: debt.io_period_months != null ? String(debt.io_period_months) : "0",
      origination_date: debt.origination_date ? String(debt.origination_date) : "",
      maturity_date: debt.maturity_date ? String(debt.maturity_date) : "",
      ltv_covenant: debt.ltv_covenant != null ? String(debt.ltv_covenant) : "",
      dscr_covenant: debt.dscr_covenant != null ? String(debt.dscr_covenant) : "",
      notes: String(debt.notes ?? ""),
    });
    setEditingDebtId(Number(debt.debt_id));
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
    } catch { toast.error("Failed to add plan"); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    try {
      await deleteProperty(propertyId);
      toast.success("Property deleted");
      router.push("/portfolio");
    } catch { toast.error("Failed to delete property"); }
  };

  const handleRunProjection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const input = {
        planned_units: Number(projForm.planned_units),
        monthly_rent_per_unit: Number(projForm.monthly_rent_per_unit),
        annual_expense_ratio: Number(projForm.annual_expense_ratio) / 100,
        vacancy_rate_stabilized: Number(projForm.vacancy_rate_stabilized) / 100,
        construction_start_date: projForm.construction_start_date || undefined,
        construction_months: Number(projForm.construction_months),
        lease_up_months: Number(projForm.lease_up_months),
        annual_debt_service: projForm.annual_debt_service ? Number(projForm.annual_debt_service) : undefined,
        exit_cap_rate: Number(projForm.exit_cap_rate) / 100,
      };
      const result = await runProjection(input);
      setProjResults((result as { projections?: Array<Record<string, unknown>> }).projections ?? (result as Array<Record<string, unknown>>));
      toast.success("Projection complete");
    } catch { toast.error("Failed to run projection"); }
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
    } catch { toast.error("Failed to save refinance scenario"); }
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
    } catch { toast.error("Failed to save sale scenario"); }
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
            <TabsTrigger value="plans"><Layers className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Dev Plans</span></TabsTrigger>
            <TabsTrigger value="debt"><Landmark className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Debt & Financing</span></TabsTrigger>
            <TabsTrigger value="projections"><BarChart3 className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Projections</span></TabsTrigger>
            <TabsTrigger value="exit"><TrendingUp className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Exit Scenarios</span></TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Property Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-0 text-sm">
                  <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Address</dt>
                    <dd className="font-medium text-right">{property.address}, {property.city}</dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Province</dt>
                    <dd className="font-medium text-right">{property.province}</dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Zoning</dt>
                    <dd className="font-medium text-right">{property.zoning ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Lot Size</dt>
                    <dd className="font-medium text-right">{property.lot_size ? `${Number(property.lot_size).toLocaleString()} sqft` : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Max Buildable</dt>
                    <dd className="font-medium text-right">{property.max_buildable_area ? `${Number(property.max_buildable_area).toLocaleString()} sqft` : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Floor Area Ratio</dt>
                    <dd className="font-medium text-right">{property.floor_area_ratio ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 py-2.5">
                    <dt className="text-muted-foreground shrink-0">Purchase Date</dt>
                    <dd className="font-medium text-right">{property.purchase_date ? formatDate(property.purchase_date) : "—"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Financial Snapshot */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Financial Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-0 text-sm">
                  <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Purchase Price</dt>
                    <dd className="font-medium text-right tabular-nums whitespace-nowrap">{property.purchase_price ? formatCurrencyCompact(property.purchase_price) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Assessed Value</dt>
                    <dd className="font-medium text-right tabular-nums whitespace-nowrap">{property.assessed_value ? formatCurrencyCompact(property.assessed_value) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Market Value</dt>
                    <dd className="font-medium text-right text-blue-600 tabular-nums whitespace-nowrap">{property.current_market_value ? formatCurrencyCompact(property.current_market_value) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Total Debt</dt>
                    <dd className="font-medium text-right tabular-nums whitespace-nowrap">{totalDebtCommitment > 0 ? formatCurrencyCompact(totalDebtCommitment) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Outstanding</dt>
                    <dd className="font-medium text-right text-amber-600 tabular-nums whitespace-nowrap">{totalDebtOutstanding > 0 ? formatCurrencyCompact(totalDebtOutstanding) : "$0"}</dd>
                  </div>
                  {activePlan && (
                    <>
                      <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                        <dt className="text-muted-foreground shrink-0">Construction Cost</dt>
                        <dd className="font-medium text-right tabular-nums whitespace-nowrap">{activePlan.estimated_construction_cost ? formatCurrencyCompact(activePlan.estimated_construction_cost) : "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2.5">
                        <dt className="text-muted-foreground shrink-0">Annual NOI</dt>
                        <dd className="font-semibold text-right text-green-600 tabular-nums whitespace-nowrap">{activePlan.projected_annual_noi ? formatCurrencyCompact(activePlan.projected_annual_noi) : "—"}</dd>
                      </div>
                    </>
                  )}
                  {!activePlan && (
                    <div className="flex justify-between py-2">
                      <dt className="text-muted-foreground">Development Plan</dt>
                      <dd className="text-muted-foreground italic">No active plan</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Development Plan Summary (if exists) */}
          {activePlan && (
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Active Development Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Units</p>
                    <p className="text-lg font-bold">{activePlan.planned_units}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Beds</p>
                    <p className="text-lg font-bold">{activePlan.planned_beds}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sqft</p>
                    <p className="text-lg font-bold">{Number(activePlan.planned_sqft).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cost / sqft</p>
                    <p className="text-lg font-bold">{activePlan.cost_per_sqft ? `$${Number(activePlan.cost_per_sqft).toFixed(0)}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-lg font-bold">{activePlan.development_start_date ? formatDate(activePlan.development_start_date) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completion</p>
                    <p className="text-lg font-bold">{activePlan.estimated_completion_date ? formatDate(activePlan.estimated_completion_date) : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Lifecycle ── */}
        <TabsContent value="lifecycle" className="mt-6 space-y-6">
          {/* Stage Progress Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Development Stage Progress
                </CardTitle>
                {canEdit && allowedTransitions && (allowedTransitions as any).allowed_transitions?.length > 0 && (
                  <Dialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <ArrowRight className="mr-1.5 h-4 w-4" />
                        Advance Stage
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Transition Property Stage</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          try {
                            await transitionMutation.mutateAsync({
                              to_stage: transitionForm.to_stage as any,
                              notes: transitionForm.notes || undefined,
                              force: transitionForm.force,
                            });
                            toast.success("Stage transition successful");
                            setShowTransitionDialog(false);
                            setTransitionForm({ to_stage: "", notes: "", force: false });
                          } catch (err: any) {
                            const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || "Transition failed";
                            toast.error(typeof msg === "string" ? msg : "Transition failed");
                          }
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label>Current Stage</Label>
                          <div><StageBadge stage={stage} /></div>
                        </div>
                        <div className="space-y-2">
                          <Label>Target Stage</Label>
                          <Select
                            value={transitionForm.to_stage}
                            onValueChange={(v) => setTransitionForm((f) => ({ ...f, to_stage: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select target stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {((allowedTransitions as any)?.allowed_transitions ?? []).map((s: string) => (
                                <SelectItem key={s} value={s}>
                                  {STAGE_CONFIG[s]?.label ?? s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes (optional)</Label>
                          <Textarea
                            value={transitionForm.notes}
                            onChange={(e) => setTransitionForm((f) => ({ ...f, notes: e.target.value }))}
                            placeholder="Reason for transition..."
                            rows={3}
                          />
                        </div>
                        {user?.role === "GP_ADMIN" && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={transitionForm.force}
                              onChange={(e) => setTransitionForm((f) => ({ ...f, force: e.target.checked }))}
                              className="rounded border-gray-300"
                            />
                            Force transition (skip validation)
                          </label>
                        )}
                        <Button type="submit" disabled={!transitionForm.to_stage || transitionMutation.isPending} className="w-full">
                          {transitionMutation.isPending ? "Transitioning..." : "Confirm Transition"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Visual Stage Pipeline */}
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {STAGE_ORDER.map((s, i) => {
                  const cfg = STAGE_CONFIG[s];
                  const currentIdx = STAGE_ORDER.indexOf(stage);
                  const isActive = s === stage;
                  const isPast = i < currentIdx;
                  const isFuture = i > currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-1 shrink-0">
                      <div
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
                          isActive && cn(cfg.bg, cfg.color, "ring-2 ring-offset-1", cfg.color.replace("text-", "ring-")),
                          isPast && "bg-green-50 border-green-200 text-green-700",
                          isFuture && "bg-gray-50 border-gray-200 text-gray-400",
                        )}
                      >
                        {isPast && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {isActive && <Circle className="h-3.5 w-3.5 fill-current" />}
                        {isFuture && <Circle className="h-3.5 w-3.5" />}
                        {cfg.label}
                      </div>
                      {i < STAGE_ORDER.length - 1 && (
                        <ArrowRight className={cn("h-3.5 w-3.5 shrink-0", isPast ? "text-green-400" : "text-gray-300")} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Transition History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Transition History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!transitions || (transitions as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">No stage transitions recorded yet.</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {(transitions as any[]).map((t: any) => (
                      <div key={t.transition_id} className="relative flex gap-4 pl-10">
                        <div className={cn(
                          "absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 bg-white",
                          t.validation_passed ? "border-green-500" : "border-amber-500"
                        )} />
                        <div className="flex-1 rounded-lg border bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <StageBadge stage={t.from_stage} />
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <StageBadge stage={t.to_stage} />
                            {!t.validation_passed && (
                              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">
                                Forced
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span>{formatDate(t.transitioned_at)}</span>
                            <span>by User #{t.transitioned_by}</span>
                          </div>
                          {t.notes && (
                            <p className="text-sm text-muted-foreground mt-2 italic">"{t.notes}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  Milestones
                </CardTitle>
                {canEdit && (
                  <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add Milestone
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Milestone</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          try {
                            await createMilestone.mutateAsync({
                              title: milestoneForm.title,
                              description: milestoneForm.description || undefined,
                              target_date: milestoneForm.target_date || undefined,
                              stage: (milestoneForm.stage || stage) as any,
                            });
                            toast.success("Milestone added");
                            setShowMilestoneDialog(false);
                            setMilestoneForm({ title: "", description: "", target_date: "", stage: "" });
                          } catch { toast.error("Failed to add milestone"); }
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            value={milestoneForm.title}
                            onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="e.g. Building Permit Approved"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description (optional)</Label>
                          <Textarea
                            value={milestoneForm.description}
                            onChange={(e) => setMilestoneForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Details..."
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Target Date</Label>
                            <Input
                              type="date"
                              value={milestoneForm.target_date}
                              onChange={(e) => setMilestoneForm((f) => ({ ...f, target_date: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Stage</Label>
                            <Select
                              value={milestoneForm.stage || stage}
                              onValueChange={(v) => setMilestoneForm((f) => ({ ...f, stage: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STAGE_ORDER.map((s) => (
                                  <SelectItem key={s} value={s}>{STAGE_CONFIG[s]?.label ?? s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button type="submit" disabled={!milestoneForm.title || createMilestone.isPending} className="w-full">
                          {createMilestone.isPending ? "Adding..." : "Add Milestone"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!milestones || (milestones as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones defined yet. Add milestones to track key deliverables.</p>
              ) : (
                <div className="space-y-3">
                  {/* Group milestones by stage */}
                  {STAGE_ORDER.filter((s) => (milestones as any[]).some((m: any) => m.stage === s)).map((stageKey) => (
                    <div key={stageKey}>
                      <div className="flex items-center gap-2 mb-2">
                        <StageBadge stage={stageKey} />
                      </div>
                      <div className="space-y-2 ml-2">
                        {(milestones as any[]).filter((m: any) => m.stage === stageKey).map((m: any) => {
                          const statusIcon = {
                            completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                            in_progress: <Clock className="h-4 w-4 text-blue-500" />,
                            pending: <Circle className="h-4 w-4 text-gray-400" />,
                            overdue: <AlertCircle className="h-4 w-4 text-red-500" />,
                            skipped: <SkipForward className="h-4 w-4 text-gray-400" />,
                          }[m.status] ?? <Circle className="h-4 w-4 text-gray-400" />;
                          const statusColor = {
                            completed: "bg-green-50 border-green-200",
                            in_progress: "bg-blue-50 border-blue-200",
                            pending: "bg-white border-gray-200",
                            overdue: "bg-red-50 border-red-200",
                            skipped: "bg-gray-50 border-gray-200",
                          }[m.status] ?? "bg-white border-gray-200";
                          return (
                            <div key={m.milestone_id} className={cn("flex items-start gap-3 rounded-lg border p-3", statusColor)}>
                              <div className="mt-0.5">{statusIcon}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">{m.title}</p>
                                  {canEdit && m.status !== "completed" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={async () => {
                                        try {
                                          const newStatus = m.status === "pending" ? "in_progress" : "completed";
                                          await updateMilestone.mutateAsync({
                                            milestoneId: m.milestone_id,
                                            data: {
                                              status: newStatus as any,
                                              ...(newStatus === "completed" ? { actual_date: new Date().toISOString().split("T")[0] } : {}),
                                            },
                                          });
                                          toast.success(`Milestone marked as ${newStatus.replace("_", " ")}`);
                                        } catch { toast.error("Failed to update milestone"); }
                                      }}
                                    >
                                      {m.status === "pending" ? "Start" : "Complete"}
                                    </Button>
                                  )}
                                </div>
                                {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                                  {m.target_date && <span>Target: {formatDate(m.target_date)}</span>}
                                  {m.actual_date && <span className="text-green-600">Completed: {formatDate(m.actual_date)}</span>}
                                  <span className="capitalize">{m.status.replace("_", " ")}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Units & Beds ── */}
        <TabsContent value="units" className="mt-6 space-y-6">
          {/* Summary Cards */}
          {unitSummary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Total Units</div>
                  <div className="text-2xl font-bold">{unitSummary.total_units}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {unitSummary.legal_suites} legal suite{unitSummary.legal_suites !== 1 ? "s" : ""}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Total Beds</div>
                  <div className="text-2xl font-bold">{unitSummary.total_beds}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {unitSummary.occupied_beds} occupied / {unitSummary.available_beds} available
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Vacancy Rate</div>
                  <div className={`text-2xl font-bold ${unitSummary.vacancy_rate > 10 ? "text-red-600" : "text-green-600"}`}>
                    {unitSummary.vacancy_rate}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {unitSummary.total_sqft.toLocaleString()} total sqft
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">Monthly Rent</div>
                  <div className="text-2xl font-bold">${unitSummary.potential_monthly_rent.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${unitSummary.actual_monthly_rent.toLocaleString()} actual
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Unit Mix & Floor Breakdown */}
          {unitSummary && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Unit Mix</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2">Type</th><th className="pb-2 text-right">Units</th><th className="pb-2 text-right">Beds</th><th className="pb-2 text-right">Sqft</th>
                    </tr></thead>
                    <tbody>
                      {Object.entries(unitSummary.unit_mix).map(([type, mix]: [string, any]) => (
                        <tr key={type} className="border-b last:border-0">
                          <td className="py-2 capitalize">{type.replace("_", " ")}</td>
                          <td className="py-2 text-right">{mix.count}</td>
                          <td className="py-2 text-right">{mix.beds}</td>
                          <td className="py-2 text-right">{mix.sqft.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Floor Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2">Floor</th><th className="pb-2 text-right">Units</th><th className="pb-2 text-right">Beds</th>
                    </tr></thead>
                    <tbody>
                      {Object.entries(unitSummary.floor_breakdown).map(([floor, data]: [string, any]) => (
                        <tr key={floor} className="border-b last:border-0">
                          <td className="py-2">{floor}</td>
                          <td className="py-2 text-right">{data.units}</td>
                          <td className="py-2 text-right">{data.beds}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Unit List with Beds */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Units</CardTitle>
              {canEdit && (
                <Dialog open={showAddUnit} onOpenChange={setShowAddUnit}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Unit</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Unit</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      createUnit.mutate({
                        unit_number: fd.get("unit_number") as string,
                        unit_type: fd.get("unit_type") as string,
                        bed_count: Number(fd.get("bed_count")),
                        sqft: Number(fd.get("sqft")),
                        floor: (fd.get("floor") as string) || null,
                        is_legal_suite: fd.get("is_legal_suite") === "on",
                        notes: (fd.get("notes") as string) || null,
                      }, {
                        onSuccess: () => { setShowAddUnit(false); toast.success("Unit added"); },
                        onError: () => toast.error("Failed to add unit"),
                      });
                    }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium">Unit Number *</label><input name="unit_number" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. 101" /></div>
                        <div><label className="text-sm font-medium">Type *</label>
                          <select name="unit_type" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                            <option value="shared">Shared</option>
                            <option value="1br">1 Bedroom</option>
                            <option value="2br">2 Bedroom</option>
                            <option value="3br">3 Bedroom</option>
                            <option value="studio">Studio</option>
                            <option value="suite">Suite</option>
                          </select>
                        </div>
                        <div><label className="text-sm font-medium">Bed Count *</label><input name="bed_count" type="number" min="1" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="2" /></div>
                        <div><label className="text-sm font-medium">Sqft *</label><input name="sqft" type="number" min="1" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="450" /></div>
                        <div><label className="text-sm font-medium">Floor</label><input name="floor" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="Main, Upper, Basement" /></div>
                        <div className="flex items-center gap-2 pt-6"><input name="is_legal_suite" type="checkbox" className="rounded" /><label className="text-sm">Legal Suite</label></div>
                      </div>
                      <div><label className="text-sm font-medium">Notes</label><textarea name="notes" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={2} /></div>
                      <Button type="submit" className="w-full" disabled={createUnit.isPending}>{createUnit.isPending ? "Adding..." : "Add Unit"}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!units || units.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No units configured yet. Add units to define the bedroom and bed configuration for this property.</p>
              ) : (
                <div className="space-y-3">
                  {units.map((unit: any) => (
                    <div key={unit.unit_id} className="border rounded-lg">
                      <div
                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedUnit(expandedUnit === unit.unit_id ? null : unit.unit_id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">Unit {unit.unit_number}</span>
                          <Badge variant="outline" className="capitalize">{unit.unit_type.replace("_", " ")}</Badge>
                          {unit.is_legal_suite && <Badge variant="secondary">Legal Suite</Badge>}
                          {unit.floor && <span className="text-xs text-muted-foreground">{unit.floor}</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{unit.bed_count} bed{unit.bed_count !== 1 ? "s" : ""} &middot; {parseFloat(unit.sqft).toLocaleString()} sqft</span>
                          <Badge variant={unit.is_occupied ? "default" : "secondary"}>{unit.is_occupied ? "Occupied" : "Available"}</Badge>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); if (confirm("Delete this unit and all its beds?")) deleteUnit.mutate(unit.unit_id, { onSuccess: () => toast.success("Unit deleted") }); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          {expandedUnit === unit.unit_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </div>
                      {expandedUnit === unit.unit_id && unit.beds && unit.beds.length > 0 && (
                        <div className="border-t px-4 py-3 bg-muted/30">
                          <table className="w-full text-sm">
                            <thead><tr className="text-left text-muted-foreground">
                              <th className="pb-2">Bed</th><th className="pb-2 text-right">Monthly Rent</th><th className="pb-2">Rent Type</th><th className="pb-2">Status</th>
                            </tr></thead>
                            <tbody>
                              {unit.beds.map((bed: any) => (
                                <tr key={bed.bed_id} className="border-t">
                                  <td className="py-2">{bed.bed_label}</td>
                                  <td className="py-2 text-right">${parseFloat(bed.monthly_rent).toLocaleString()}</td>
                                  <td className="py-2 capitalize">{bed.rent_type.replace("_", " ")}</td>
                                  <td className="py-2">
                                    <Badge variant={bed.status === "occupied" ? "default" : bed.status === "available" ? "secondary" : "destructive"} className="capitalize">
                                      {bed.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Development Plans ── */}
        <TabsContent value="plans" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Development Plans</CardTitle>
              <div className="flex items-center gap-2">
                {plans && plans.length >= 2 && (
                  <Button
                    variant={compareMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCompareMode(!compareMode);
                      if (!compareMode && plans.length >= 2) {
                        setComparePlanIds([plans[0].plan_id, plans[1].plan_id]);
                      }
                    }}
                  >
                    <GitCompare className="mr-1.5 h-4 w-4" />
                    {compareMode ? "Exit Compare" : "Compare"}
                  </Button>
                )}
                {canEdit && (
                <Dialog open={planOpen} onOpenChange={setPlanOpen}>
                  <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Plan
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Development Plan</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddPlan} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Planned Units</Label>
                          <Input type="number" value={planForm.planned_units || ""} onChange={(e) => setPlanForm((f) => ({ ...f, planned_units: Number(e.target.value) }))} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Beds</Label>
                          <Input type="number" value={planForm.planned_beds || ""} onChange={(e) => setPlanForm((f) => ({ ...f, planned_beds: Number(e.target.value) }))} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Sqft</Label>
                          <Input type="number" value={planForm.planned_sqft || ""} onChange={(e) => setPlanForm((f) => ({ ...f, planned_sqft: Number(e.target.value) }))} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Est. Construction Cost</Label>
                          <Input type="number" value={planForm.estimated_construction_cost || ""} onChange={(e) => setPlanForm((f) => ({ ...f, estimated_construction_cost: Number(e.target.value) }))} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input type="date" value={planForm.development_start_date} onChange={(e) => setPlanForm((f) => ({ ...f, development_start_date: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (days)</Label>
                          <Input type="number" value={planForm.construction_duration_days || ""} onChange={(e) => setPlanForm((f) => ({ ...f, construction_duration_days: Number(e.target.value) }))} required />
                        </div>
                      </div>
                      <Button type="submit" disabled={planPending} className="w-full sm:w-auto">
                        {planPending ? "Adding…" : "Add Plan"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              </div>
            </CardHeader>
            <CardContent>
              {!plans || plans.length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No development plans yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Add a plan to track units, costs, and timelines.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Beds</TableHead>
                        <TableHead className="text-right">Sqft</TableHead>
                        <TableHead className="text-right">Est. Cost</TableHead>
                        <TableHead className="text-right">Cost/sqft</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Completion</TableHead>
                        <TableHead className="text-right">Proj. NOI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan: DevelopmentPlan) => (
                        <TableRow key={plan.plan_id}>
                          <TableCell>
                            <Badge variant={plan.status === "active" ? "default" : "secondary"} className="text-xs">
                              {plan.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{plan.planned_units}</TableCell>
                          <TableCell className="text-right">{plan.planned_beds}</TableCell>
                          <TableCell className="text-right">{Number(plan.planned_sqft).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{plan.estimated_construction_cost ? formatCurrency(Number(plan.estimated_construction_cost)) : "—"}</TableCell>
                          <TableCell className="text-right">{plan.cost_per_sqft ? `$${Number(plan.cost_per_sqft).toFixed(0)}` : "—"}</TableCell>
                          <TableCell>{plan.development_start_date ? formatDate(plan.development_start_date) : "—"}</TableCell>
                          <TableCell>{plan.estimated_completion_date ? formatDate(plan.estimated_completion_date) : "—"}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">{plan.projected_annual_noi ? formatCurrency(Number(plan.projected_annual_noi)) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* ── Comparison View ── */}
              {compareMode && plans && plans.length >= 2 && (() => {
                const planA = plans.find((p: DevelopmentPlan) => p.plan_id === comparePlanIds[0]);
                const planB = plans.find((p: DevelopmentPlan) => p.plan_id === comparePlanIds[1]);
                if (!planA || !planB) return null;

                const rows: { label: string; a: string; b: string; diff?: string; diffColor?: string }[] = [
                  { label: "Version", a: `v${planA.version ?? planA.plan_id}`, b: `v${planB.version ?? planB.plan_id}` },
                  { label: "Status", a: planA.status, b: planB.status },
                  {
                    label: "Planned Units", a: String(planA.planned_units), b: String(planB.planned_units),
                    diff: String(planB.planned_units - planA.planned_units),
                    diffColor: planB.planned_units >= planA.planned_units ? "text-green-600" : "text-red-600",
                  },
                  {
                    label: "Planned Beds", a: String(planA.planned_beds), b: String(planB.planned_beds),
                    diff: String(planB.planned_beds - planA.planned_beds),
                    diffColor: planB.planned_beds >= planA.planned_beds ? "text-green-600" : "text-red-600",
                  },
                  {
                    label: "Planned Sqft", a: Number(planA.planned_sqft).toLocaleString(), b: Number(planB.planned_sqft).toLocaleString(),
                    diff: (Number(planB.planned_sqft) - Number(planA.planned_sqft)).toLocaleString(),
                    diffColor: Number(planB.planned_sqft) >= Number(planA.planned_sqft) ? "text-green-600" : "text-red-600",
                  },
                  {
                    label: "Est. Construction Cost",
                    a: planA.estimated_construction_cost ? formatCurrency(Number(planA.estimated_construction_cost)) : "—",
                    b: planB.estimated_construction_cost ? formatCurrency(Number(planB.estimated_construction_cost)) : "—",
                    diff: planA.estimated_construction_cost && planB.estimated_construction_cost
                      ? formatCurrency(Number(planB.estimated_construction_cost) - Number(planA.estimated_construction_cost))
                      : undefined,
                    diffColor: Number(planB.estimated_construction_cost || 0) <= Number(planA.estimated_construction_cost || 0) ? "text-green-600" : "text-red-600",
                  },
                  {
                    label: "Cost per Sqft",
                    a: planA.cost_per_sqft ? `$${Number(planA.cost_per_sqft).toFixed(0)}` : "—",
                    b: planB.cost_per_sqft ? `$${Number(planB.cost_per_sqft).toFixed(0)}` : "—",
                  },
                  {
                    label: "Hard Costs",
                    a: planA.hard_costs ? formatCurrency(Number(planA.hard_costs)) : "—",
                    b: planB.hard_costs ? formatCurrency(Number(planB.hard_costs)) : "—",
                  },
                  {
                    label: "Soft Costs",
                    a: planA.soft_costs ? formatCurrency(Number(planA.soft_costs)) : "—",
                    b: planB.soft_costs ? formatCurrency(Number(planB.soft_costs)) : "—",
                  },
                  {
                    label: "Projected Annual NOI",
                    a: planA.projected_annual_noi ? formatCurrency(Number(planA.projected_annual_noi)) : "—",
                    b: planB.projected_annual_noi ? formatCurrency(Number(planB.projected_annual_noi)) : "—",
                    diff: planA.projected_annual_noi && planB.projected_annual_noi
                      ? formatCurrency(Number(planB.projected_annual_noi) - Number(planA.projected_annual_noi))
                      : undefined,
                    diffColor: Number(planB.projected_annual_noi || 0) >= Number(planA.projected_annual_noi || 0) ? "text-green-600" : "text-red-600",
                  },
                  {
                    label: "Start Date",
                    a: planA.development_start_date ? formatDate(planA.development_start_date) : "—",
                    b: planB.development_start_date ? formatDate(planB.development_start_date) : "—",
                  },
                  {
                    label: "Est. Completion",
                    a: planA.estimated_completion_date ? formatDate(planA.estimated_completion_date) : "—",
                    b: planB.estimated_completion_date ? formatDate(planB.estimated_completion_date) : "—",
                  },
                ];

                return (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs">Plan A:</Label>
                      <select
                        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        value={comparePlanIds[0] ?? ""}
                        onChange={(e) => setComparePlanIds([Number(e.target.value), comparePlanIds[1]])}
                      >
                        {plans.map((p: DevelopmentPlan) => (
                          <option key={p.plan_id} value={p.plan_id}>
                            v{p.version ?? p.plan_id} — {p.status} ({p.planned_units} units)
                          </option>
                        ))}
                      </select>
                      <Label className="text-xs">Plan B:</Label>
                      <select
                        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        value={comparePlanIds[1] ?? ""}
                        onChange={(e) => setComparePlanIds([comparePlanIds[0], Number(e.target.value)])}
                      >
                        {plans.map((p: DevelopmentPlan) => (
                          <option key={p.plan_id} value={p.plan_id}>
                            v{p.version ?? p.plan_id} — {p.status} ({p.planned_units} units)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[180px]">Metric</TableHead>
                            <TableHead className="text-right">Plan A</TableHead>
                            <TableHead className="text-right">Plan B</TableHead>
                            <TableHead className="text-right">Difference</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.label}>
                              <TableCell className="text-sm font-medium">{row.label}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{row.a}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{row.b}</TableCell>
                              <TableCell className={cn("text-right text-sm tabular-nums font-medium", row.diffColor)}>
                                {row.diff !== undefined ? (Number(row.diff.replace(/[^\d.-]/g, "")) > 0 ? "+" : "") + row.diff : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Debt & Financing ── */}
        <TabsContent value="debt" className="mt-6 space-y-6">

          {/* Debt Summary KPIs */}
          {(debtFacilities ?? []).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground font-medium">Total Commitment</p>
                  <p className="text-lg font-bold">{formatCurrencyCompact(totalDebtCommitment)}</p>
                  <p className="text-xs text-muted-foreground">{(debtFacilities ?? []).length} facilit{(debtFacilities ?? []).length === 1 ? "y" : "ies"}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground font-medium">Outstanding Balance</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrencyCompact(totalDebtOutstanding)}</p>
                  <p className="text-xs text-muted-foreground">{totalDebtCommitment > 0 ? ((totalDebtOutstanding / totalDebtCommitment) * 100).toFixed(0) : 0}% drawn</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground font-medium">Annual Debt Service</p>
                  <p className="text-lg font-bold text-red-700">{totalAnnualDebtService > 0 ? formatCurrencyCompact(totalAnnualDebtService) : "—"}</p>
                  <p className="text-xs text-muted-foreground">{totalAnnualDebtService > 0 ? `${formatCurrencyCompact(totalAnnualDebtService / 12)}/mo` : "No active loans"}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-xs text-muted-foreground font-medium">Wtd Avg Rate</p>
                  {(() => {
                    const active = (debtFacilities ?? []).filter((d: { outstanding_balance: number }) => d.outstanding_balance > 0);
                    const totalBal = active.reduce((s: number, d: { outstanding_balance: number }) => s + d.outstanding_balance, 0);
                    const wtdRate = totalBal > 0 ? active.reduce((s: number, d: { outstanding_balance: number; interest_rate: number | null }) => s + d.outstanding_balance * (d.interest_rate ?? 0), 0) / totalBal : 0;
                    return (
                      <>
                        <p className="text-lg font-bold">{wtdRate > 0 ? `${wtdRate.toFixed(2)}%` : "—"}</p>
                        <p className="text-xs text-muted-foreground">{active.length} active loan{active.length !== 1 ? "s" : ""}</p>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Add Debt Facility Button */}
          {canEdit && (
            <div className="flex justify-end">
              <Dialog open={showAddDebt} onOpenChange={(open) => { setShowAddDebt(open); if (!open) resetDebtForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Debt Facility</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />New Debt Facility</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateDebt} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Lender Name *</Label>
                        <Input value={debtForm.lender_name} onChange={(e) => setDebtForm(f => ({ ...f, lender_name: e.target.value }))} placeholder="e.g. ATB Financial" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Debt Type *</Label>
                        <Select value={debtForm.debt_type} onValueChange={(v) => setDebtForm(f => ({ ...f, debt_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="permanent_mortgage">Permanent Mortgage</SelectItem>
                            <SelectItem value="construction_loan">Construction Loan</SelectItem>
                            <SelectItem value="bridge_loan">Bridge Loan</SelectItem>
                            <SelectItem value="mezzanine">Mezzanine</SelectItem>
                            <SelectItem value="line_of_credit">Line of Credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rate Type</Label>
                        <Select value={debtForm.rate_type} onValueChange={(v) => setDebtForm(f => ({ ...f, rate_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="variable">Variable</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="border rounded-lg p-3 bg-blue-50/30 border-blue-200 space-y-3">
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Amounts</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Commitment Amount ($) *</Label>
                          <Input type="number" step="0.01" value={debtForm.commitment_amount} onChange={(e) => setDebtForm(f => ({ ...f, commitment_amount: e.target.value }))} placeholder="2,400,000" required />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Interest Rate (%)</Label>
                          <Input type="number" step="0.01" value={debtForm.interest_rate} onChange={(e) => setDebtForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="5.25" />
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-3 bg-green-50/30 border-green-200 space-y-3">
                      <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Loan Terms</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Term (months)</Label>
                          <Input type="number" value={debtForm.term_months} onChange={(e) => setDebtForm(f => ({ ...f, term_months: e.target.value }))} placeholder="60" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Amortization (months)</Label>
                          <Input type="number" value={debtForm.amortization_months} onChange={(e) => setDebtForm(f => ({ ...f, amortization_months: e.target.value }))} placeholder="300" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">IO Period (months)</Label>
                          <Input type="number" value={debtForm.io_period_months} onChange={(e) => setDebtForm(f => ({ ...f, io_period_months: e.target.value }))} placeholder="0" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Origination Date</Label>
                          <Input type="date" value={debtForm.origination_date} onChange={(e) => setDebtForm(f => ({ ...f, origination_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Maturity Date</Label>
                          <Input type="date" value={debtForm.maturity_date} onChange={(e) => setDebtForm(f => ({ ...f, maturity_date: e.target.value }))} />
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-3 bg-amber-50/30 border-amber-200 space-y-3">
                      <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Covenants</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Max LTV (%)</Label>
                          <Input type="number" step="0.01" value={debtForm.ltv_covenant} onChange={(e) => setDebtForm(f => ({ ...f, ltv_covenant: e.target.value }))} placeholder="75.00" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Min DSCR (x)</Label>
                          <Input type="number" step="0.01" value={debtForm.dscr_covenant} onChange={(e) => setDebtForm(f => ({ ...f, dscr_covenant: e.target.value }))} placeholder="1.25" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Textarea value={debtForm.notes} onChange={(e) => setDebtForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes about this facility..." rows={2} />
                    </div>

                    <Button type="submit" className="w-full" disabled={createDebt.isPending}>
                      {createDebt.isPending ? "Adding..." : "Add Debt Facility"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Debt Facility Cards */}
          {!debtFacilities || debtFacilities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Landmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No debt facilities recorded</p>
                <p className="text-xs text-muted-foreground mt-1">Add a mortgage, construction loan, or other debt facility to track terms and amortization.</p>
              </CardContent>
            </Card>
          ) : (
            (debtFacilities as Array<{
              debt_id: number; lender_name: string; debt_type: string; status: string;
              commitment_amount: number; drawn_amount: number; outstanding_balance: number;
              interest_rate: number | null; rate_type: string; term_months: number | null;
              maturity_date: string | null; origination_date: string | null;
              amortization_months: number | null; io_period_months: number | null;
              ltv_covenant: number | null; dscr_covenant: number | null; notes: string | null;
            }>).map((debt) => (
              <Card key={debt.debt_id} className="overflow-hidden">
                {/* Edit mode */}
                {editingDebtId === debt.debt_id ? (
                  <CardContent className="pt-6">
                    <form onSubmit={handleUpdateDebt} className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold">Edit Debt Facility</p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingDebtId(null); resetDebtForm(); }}>Cancel</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Lender Name *</Label>
                          <Input value={debtForm.lender_name} onChange={(e) => setDebtForm(f => ({ ...f, lender_name: e.target.value }))} required />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Debt Type</Label>
                          <Select value={debtForm.debt_type} onValueChange={(v) => setDebtForm(f => ({ ...f, debt_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="permanent_mortgage">Permanent Mortgage</SelectItem>
                              <SelectItem value="construction_loan">Construction Loan</SelectItem>
                              <SelectItem value="bridge_loan">Bridge Loan</SelectItem>
                              <SelectItem value="mezzanine">Mezzanine</SelectItem>
                              <SelectItem value="line_of_credit">Line of Credit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Rate Type</Label>
                          <Select value={debtForm.rate_type} onValueChange={(v) => setDebtForm(f => ({ ...f, rate_type: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed</SelectItem>
                              <SelectItem value="variable">Variable</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Commitment ($)</Label>
                          <Input type="number" step="0.01" value={debtForm.commitment_amount} onChange={(e) => setDebtForm(f => ({ ...f, commitment_amount: e.target.value }))} required />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Drawn ($)</Label>
                          <Input type="number" step="0.01" value={debtForm.drawn_amount} onChange={(e) => setDebtForm(f => ({ ...f, drawn_amount: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Outstanding ($)</Label>
                          <Input type="number" step="0.01" value={debtForm.outstanding_balance} onChange={(e) => setDebtForm(f => ({ ...f, outstanding_balance: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Rate (%)</Label>
                          <Input type="number" step="0.01" value={debtForm.interest_rate} onChange={(e) => setDebtForm(f => ({ ...f, interest_rate: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Term (mo)</Label>
                          <Input type="number" value={debtForm.term_months} onChange={(e) => setDebtForm(f => ({ ...f, term_months: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Amort (mo)</Label>
                          <Input type="number" value={debtForm.amortization_months} onChange={(e) => setDebtForm(f => ({ ...f, amortization_months: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">IO (mo)</Label>
                          <Input type="number" value={debtForm.io_period_months} onChange={(e) => setDebtForm(f => ({ ...f, io_period_months: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Origination Date</Label>
                          <Input type="date" value={debtForm.origination_date} onChange={(e) => setDebtForm(f => ({ ...f, origination_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Maturity Date</Label>
                          <Input type="date" value={debtForm.maturity_date} onChange={(e) => setDebtForm(f => ({ ...f, maturity_date: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Max LTV Covenant (%)</Label>
                          <Input type="number" step="0.01" value={debtForm.ltv_covenant} onChange={(e) => setDebtForm(f => ({ ...f, ltv_covenant: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Min DSCR Covenant (x)</Label>
                          <Input type="number" step="0.01" value={debtForm.dscr_covenant} onChange={(e) => setDebtForm(f => ({ ...f, dscr_covenant: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Notes</Label>
                        <Textarea value={debtForm.notes} onChange={(e) => setDebtForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                      </div>
                      <Button type="submit" className="w-full" disabled={updateDebt.isPending}>
                        {updateDebt.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </form>
                  </CardContent>
                ) : (
                  /* View mode */
                  <>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base">{debt.lender_name}</CardTitle>
                            <Badge variant={debt.status === "active" ? "default" : "secondary"} className="text-xs capitalize">
                              {debt.status.replace(/_/g, " ")}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {debt.debt_type.replace(/_/g, " ")}
                            </Badge>
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
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(debt.outstanding_balance)} outstanding
                            </p>
                          </div>
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => startEditDebt(debt as unknown as Record<string, unknown>)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Loan Details Grid */}
                    <div className="px-6 pb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-muted/50 rounded-lg p-2.5">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Drawn</p>
                          <p className="text-sm font-semibold">{formatCurrency(debt.drawn_amount)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Available</p>
                          <p className="text-sm font-semibold">{formatCurrency(debt.commitment_amount - debt.drawn_amount)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Est. Monthly Pmt</p>
                          <p className="text-sm font-semibold">
                            {(() => {
                              const bal = debt.outstanding_balance ?? 0;
                              const rate = (debt.interest_rate ?? 0) / 100;
                              const amort = debt.amortization_months ?? 0;
                              if (bal <= 0 || rate <= 0) return "—";
                              const mr = rate / 12;
                              if (amort > 0 && (debt.io_period_months ?? 0) <= 0) {
                                const pmt = bal * (mr * Math.pow(1 + mr, amort)) / (Math.pow(1 + mr, amort) - 1);
                                return formatCurrency(pmt);
                              }
                              return formatCurrency(bal * mr) + " (IO)";
                            })()}
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2.5">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Est. Annual DS</p>
                          <p className="text-sm font-semibold">
                            {(() => {
                              const bal = debt.outstanding_balance ?? 0;
                              const rate = (debt.interest_rate ?? 0) / 100;
                              const amort = debt.amortization_months ?? 0;
                              if (bal <= 0 || rate <= 0) return "—";
                              const mr = rate / 12;
                              if (amort > 0 && (debt.io_period_months ?? 0) <= 0) {
                                const pmt = bal * (mr * Math.pow(1 + mr, amort)) / (Math.pow(1 + mr, amort) - 1);
                                return formatCurrency(pmt * 12);
                              }
                              return formatCurrency(bal * rate);
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Covenant badges */}
                    {(debt.ltv_covenant || debt.dscr_covenant) && (
                      <div className="px-6 pb-3 flex flex-wrap gap-2">
                        {debt.ltv_covenant && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            <Shield className="h-3 w-3 mr-1" />LTV Covenant: {debt.ltv_covenant}%
                          </span>
                        )}
                        {debt.dscr_covenant && (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                            <Shield className="h-3 w-3 mr-1" />DSCR Covenant: {debt.dscr_covenant}x
                          </span>
                        )}
                      </div>
                    )}

                    {debt.notes && (
                      <div className="px-6 pb-3">
                        <p className="text-xs text-muted-foreground italic">{debt.notes}</p>
                      </div>
                    )}

                    <CardContent className="pt-0">
                      <button
                        onClick={() => setExpandedDebtId(expandedDebtId === debt.debt_id ? null : debt.debt_id)}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                      >
                        {expandedDebtId === debt.debt_id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {expandedDebtId === debt.debt_id ? "Hide" : "View"} amortization schedule
                      </button>
                      {expandedDebtId === debt.debt_id && (
                        <AmortizationPanel propertyId={propertyId} debtId={debt.debt_id} />
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            ))
          )}

          {/* Cash Flow Impact Summary */}
          {(debtFacilities ?? []).length > 0 && property && (
            <Card className="border-t-4 border-t-emerald-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Cash Flow Impact Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Metric</TableHead>
                        <TableHead className="text-xs text-right">Annual</TableHead>
                        <TableHead className="text-xs text-right">Monthly</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const purchasePrice = property.purchase_price ?? property.current_market_value ?? 0;
                        const noi = property.annual_revenue ? property.annual_revenue - (property.annual_expenses ?? 0) : 0;
                        const cashAfterDS = noi - totalAnnualDebtService;
                        const capRate = purchasePrice > 0 && noi > 0 ? (noi / purchasePrice) * 100 : 0;
                        const dscr = totalAnnualDebtService > 0 && noi > 0 ? noi / totalAnnualDebtService : 0;
                        const cashOnCash = (purchasePrice - totalDebtOutstanding) > 0 && cashAfterDS > 0 ? (cashAfterDS / (purchasePrice - totalDebtOutstanding)) * 100 : 0;
                        return (
                          <>
                            <TableRow>
                              <TableCell className="text-xs font-medium">Net Operating Income (NOI)</TableCell>
                              <TableCell className="text-xs text-right font-semibold">{noi > 0 ? formatCurrency(noi) : "—"}</TableCell>
                              <TableCell className="text-xs text-right">{noi > 0 ? formatCurrency(noi / 12) : "—"}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-xs font-medium text-red-700">Less: Total Debt Service</TableCell>
                              <TableCell className="text-xs text-right font-semibold text-red-700">{totalAnnualDebtService > 0 ? `(${formatCurrency(totalAnnualDebtService)})` : "—"}</TableCell>
                              <TableCell className="text-xs text-right text-red-700">{totalAnnualDebtService > 0 ? `(${formatCurrency(totalAnnualDebtService / 12)})` : "—"}</TableCell>
                            </TableRow>
                            <TableRow className="border-t-2 border-t-foreground/20">
                              <TableCell className="text-xs font-bold">Cash Flow After Debt Service</TableCell>
                              <TableCell className={cn("text-xs text-right font-bold", cashAfterDS >= 0 ? "text-green-700" : "text-red-700")}>
                                {noi > 0 ? formatCurrency(cashAfterDS) : "—"}
                              </TableCell>
                              <TableCell className={cn("text-xs text-right", cashAfterDS >= 0 ? "text-green-700" : "text-red-700")}>
                                {noi > 0 ? formatCurrency(cashAfterDS / 12) : "—"}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={3} className="pt-4 pb-2">
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Cap Rate</p>
                                    <p className="text-lg font-bold">{capRate > 0 ? `${capRate.toFixed(2)}%` : "—"}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase">DSCR</p>
                                    <p className={cn("text-lg font-bold", dscr > 0 && dscr < 1.2 ? "text-red-700" : dscr >= 1.2 ? "text-green-700" : "")}>{dscr > 0 ? `${dscr.toFixed(2)}x` : "—"}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Cash-on-Cash</p>
                                    <p className="text-lg font-bold">{cashOnCash > 0 ? `${cashOnCash.toFixed(1)}%` : "—"}</p>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Projections ── */}
        <TabsContent value="projections" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Projection Inputs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRunProjection} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Planned Units</Label>
                      <Input type="number" value={projForm.planned_units} onChange={(e) => setProjForm((f) => ({ ...f, planned_units: e.target.value }))} placeholder="10" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rent / Unit ($)</Label>
                      <Input type="number" value={projForm.monthly_rent_per_unit} onChange={(e) => setProjForm((f) => ({ ...f, monthly_rent_per_unit: e.target.value }))} placeholder="2200" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Expense Ratio (%)</Label>
                      <Input type="number" step="0.1" value={projForm.annual_expense_ratio} onChange={(e) => setProjForm((f) => ({ ...f, annual_expense_ratio: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vacancy Rate (%)</Label>
                      <Input type="number" step="0.1" value={projForm.vacancy_rate_stabilized} onChange={(e) => setProjForm((f) => ({ ...f, vacancy_rate_stabilized: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Construction Start</Label>
                    <Input type="date" value={projForm.construction_start_date} onChange={(e) => setProjForm((f) => ({ ...f, construction_start_date: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Construction (mo)</Label>
                      <Input type="number" value={projForm.construction_months} onChange={(e) => setProjForm((f) => ({ ...f, construction_months: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lease-Up (mo)</Label>
                      <Input type="number" value={projForm.lease_up_months} onChange={(e) => setProjForm((f) => ({ ...f, lease_up_months: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Annual Debt Service ($)</Label>
                      <div className="flex gap-1.5">
                        <Input type="number" value={projForm.annual_debt_service} onChange={(e) => setProjForm((f) => ({ ...f, annual_debt_service: e.target.value }))} placeholder={totalAnnualDebtService > 0 ? `Est: ${Math.round(totalAnnualDebtService).toLocaleString()}` : "optional"} />
                        {totalAnnualDebtService > 0 && !projForm.annual_debt_service && (
                          <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setProjForm(f => ({ ...f, annual_debt_service: String(Math.round(totalAnnualDebtService)) }))}>
                            Auto-fill
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Exit Cap (%)</Label>
                      <Input type="number" step="0.1" value={projForm.exit_cap_rate} onChange={(e) => setProjForm((f) => ({ ...f, exit_cap_rate: e.target.value }))} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={projPending}>
                    {projPending ? "Running…" : "Run 10-Year Projection"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div>
              {!projResults ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Fill in the inputs and run a projection to see year-by-year results.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Year-by-Year Projection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Year</TableHead>
                            <TableHead>Phase</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">NOI</TableHead>
                            <TableHead className="text-right">Debt Svc</TableHead>
                            <TableHead className="text-right">Cash Flow</TableHead>
                            <TableHead className="text-right">Cumulative</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projResults.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{String(row.year ?? i + 1)}</TableCell>
                              <TableCell>
                                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", PHASE_COLORS[String(row.phase ?? "")] ?? "bg-gray-100 text-gray-700")}>
                                  {String(row.phase ?? "—").replace("_", "-")}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{row.gross_revenue != null ? formatCurrency(row.gross_revenue as number) : "—"}</TableCell>
                              <TableCell className="text-right font-medium">{row.noi != null ? formatCurrency(row.noi as number) : "—"}</TableCell>
                              <TableCell className="text-right">{row.annual_debt_service != null ? formatCurrency(row.annual_debt_service as number) : "—"}</TableCell>
                              <TableCell className={cn("text-right font-semibold", (row.cash_flow as number) < 0 ? "text-red-600" : "text-green-600")}>
                                {row.cash_flow != null ? formatCurrency(row.cash_flow as number) : "—"}
                              </TableCell>
                              <TableCell className={cn("text-right", (row.cumulative_cash_flow as number) < 0 ? "text-red-600" : "text-green-600")}>
                                {row.cumulative_cash_flow != null ? formatCurrency(row.cumulative_cash_flow as number) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Exit Scenarios ── */}
        <TabsContent value="exit" className="mt-6 space-y-8">

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* Refinance Scenarios                                          */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <section>
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              Refinance Scenarios
            </h3>
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              {/* ── Create Form ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">New Refinance Scenario</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateRefi} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input value={refiForm.label} onChange={(e) => setRefiForm((f) => ({ ...f, label: e.target.value }))} />
                    </div>

                    {/* Timing & Event Linkage */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Timing & Event Linkage
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Expected Date</Label>
                          <Input type="date" value={refiForm.expected_date} onChange={(e) => setRefiForm((f) => ({ ...f, expected_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Hold Period (mo)</Label>
                          <Input type="number" value={refiForm.hold_period_months} onChange={(e) => setRefiForm((f) => ({ ...f, hold_period_months: e.target.value }))} placeholder="e.g. 24" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Linked Event</Label>
                        <Select value={refiForm.linked_event} onValueChange={(v) => setRefiForm((f) => ({ ...f, linked_event: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select trigger event" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="construction_completion">Construction Completion</SelectItem>
                            <SelectItem value="lease_up_complete">Lease-Up Complete</SelectItem>
                            <SelectItem value="stabilization">Stabilization</SelectItem>
                            <SelectItem value="interim_operation_end">Interim Operation End</SelectItem>
                            <SelectItem value="planning_approval">Planning Approval</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(milestones ?? []).length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs">Link to Milestone</Label>
                          <Select value={refiForm.linked_milestone_id} onValueChange={(v) => setRefiForm((f) => ({ ...f, linked_milestone_id: v }))}>
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

                    {/* Deal Terms */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Valuation ($)</Label>
                        <Input type="number" value={refiForm.assumed_new_valuation} onChange={(e) => setRefiForm((f) => ({ ...f, assumed_new_valuation: e.target.value }))} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">LTV (%)</Label>
                        <Input type="number" step="0.1" value={refiForm.new_ltv_percent} onChange={(e) => setRefiForm((f) => ({ ...f, new_ltv_percent: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Rate (%)</Label>
                        <Input type="number" step="0.01" value={refiForm.new_interest_rate} onChange={(e) => setRefiForm((f) => ({ ...f, new_interest_rate: e.target.value }))} placeholder="opt." />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Amort (mo)</Label>
                        <Input type="number" value={refiForm.new_amortization_months} onChange={(e) => setRefiForm((f) => ({ ...f, new_amortization_months: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Debt Payout ($)</Label>
                        <div className="flex gap-1.5">
                          <Input type="number" value={refiForm.existing_debt_payout} onChange={(e) => setRefiForm((f) => ({ ...f, existing_debt_payout: e.target.value }))} placeholder={totalDebtOutstanding > 0 ? `Current: ${totalDebtOutstanding.toLocaleString()}` : "opt."} />
                          {totalDebtOutstanding > 0 && !refiForm.existing_debt_payout && (
                            <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setRefiForm(f => ({ ...f, existing_debt_payout: String(totalDebtOutstanding) }))}>
                              Auto-fill
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Closing Costs ($)</Label>
                        <Input type="number" value={refiForm.closing_costs} onChange={(e) => setRefiForm((f) => ({ ...f, closing_costs: e.target.value }))} />
                      </div>
                    </div>

                    {/* ROI Inputs */}
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" /> ROI Projection Inputs
                      </p>
                      {(() => {
                        const computedEquity = (property?.purchase_price ?? 0) - totalDebtOutstanding;
                        const computedNOI = (property?.annual_revenue ?? 0) - (property?.annual_expenses ?? 0);
                        return (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Total Equity ($)</Label>
                              <div className="flex gap-1.5">
                                <Input type="number" value={refiForm.total_equity_invested} onChange={(e) => setRefiForm((f) => ({ ...f, total_equity_invested: e.target.value }))} placeholder={computedEquity > 0 ? `Est: ${Math.round(computedEquity).toLocaleString()}` : "e.g. 200000"} />
                                {computedEquity > 0 && !refiForm.total_equity_invested && (
                                  <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setRefiForm(f => ({ ...f, total_equity_invested: String(Math.round(computedEquity)) }))}>Auto</Button>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Annual NOI at Refi ($)</Label>
                              <div className="flex gap-1.5">
                                <Input type="number" value={refiForm.annual_noi_at_refi} onChange={(e) => setRefiForm((f) => ({ ...f, annual_noi_at_refi: e.target.value }))} placeholder={computedNOI > 0 ? `Est: ${Math.round(computedNOI).toLocaleString()}` : "e.g. 72000"} />
                                {computedNOI > 0 && !refiForm.annual_noi_at_refi && (
                                  <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setRefiForm(f => ({ ...f, annual_noi_at_refi: String(Math.round(computedNOI)) }))}>Auto</Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={refiForm.notes} onChange={(e) => setRefiForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" />
                    </div>
                    <Button type="submit" className="w-full" disabled={refiPending}>
                      {refiPending ? "Saving\u2026" : "Save Scenario"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* ── Saved Refinance Scenarios ── */}
              <div className="space-y-4">
                {!refiScenarios || refiScenarios.length === 0 ? (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-sm text-muted-foreground text-center">No refinance scenarios yet. Create one to see projected ROI metrics.</p>
                    </CardContent>
                  </Card>
                ) : (
                  (refiScenarios as Array<{ scenario_id: number; label: string; assumed_new_valuation: number; new_ltv_percent: number; new_loan_amount: number; net_proceeds: number; expected_date?: string; linked_event?: string; linked_milestone_title?: string; hold_period_months?: number; total_equity_invested?: number; annual_noi_at_refi?: number; equity_multiple?: number; cash_on_cash_return?: number; annualized_roi?: number; existing_debt_payout?: number; closing_costs?: number; new_interest_rate?: number; new_amortization_months?: number; notes?: string }>).map((s) => (
                    <Card key={s.scenario_id} className="overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer" onClick={() => setExpandedRefi(expandedRefi === s.scenario_id ? null : s.scenario_id)}>
                        <div className="flex items-center gap-3">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">{s.label}</span>
                          {s.expected_date && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(s.expected_date + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                            </Badge>
                          )}
                          {s.linked_event && (
                            <Badge variant="secondary" className="text-xs">
                              {s.linked_event.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-sm font-bold", s.net_proceeds >= 0 ? "text-green-600" : "text-red-600")}>
                            {formatCurrency(s.net_proceeds)} net
                          </span>
                          {expandedRefi === s.scenario_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </div>

                      {expandedRefi === s.scenario_id && (
                        <CardContent className="pt-4 space-y-4">
                          {/* Deal Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground">Valuation</p>
                              <p className="text-sm font-bold">{formatCurrency(s.assumed_new_valuation)}</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground">New Loan ({s.new_ltv_percent}% LTV)</p>
                              <p className="text-sm font-bold">{formatCurrency(s.new_loan_amount)}</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground">Debt Payout</p>
                              <p className="text-sm font-bold">{formatCurrency(s.existing_debt_payout ?? 0)}</p>
                            </div>
                            <div className={cn("text-center p-3 rounded-lg", s.net_proceeds >= 0 ? "bg-green-50" : "bg-red-50")}>
                              <p className="text-xs text-muted-foreground">Net Proceeds</p>
                              <p className={cn("text-sm font-bold", s.net_proceeds >= 0 ? "text-green-700" : "text-red-700")}>{formatCurrency(s.net_proceeds)}</p>
                            </div>
                          </div>

                          {/* ROI Metrics */}
                          {(s.equity_multiple || s.cash_on_cash_return || s.annualized_roi) && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
                              <p className="text-xs font-semibold text-emerald-700 mb-3 flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5" /> Projected ROI Metrics
                              </p>
                              <div className="grid grid-cols-3 gap-4">
                                {s.equity_multiple != null && (
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-emerald-700">{s.equity_multiple}x</p>
                                    <p className="text-xs text-muted-foreground">Equity Multiple</p>
                                  </div>
                                )}
                                {s.cash_on_cash_return != null && (
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-emerald-700">{s.cash_on_cash_return}%</p>
                                    <p className="text-xs text-muted-foreground">Cash-on-Cash</p>
                                  </div>
                                )}
                                {s.annualized_roi != null && (
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-emerald-700">{s.annualized_roi}%</p>
                                    <p className="text-xs text-muted-foreground">Annualized ROI</p>
                                  </div>
                                )}
                              </div>
                              {s.hold_period_months && (
                                <p className="text-xs text-muted-foreground text-center mt-2">
                                  Based on {s.hold_period_months} month hold period
                                  {s.total_equity_invested ? ` with ${formatCurrency(s.total_equity_invested)} equity invested` : ""}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Timeline */}
                          {(s.expected_date || s.linked_event || s.linked_milestone_title) && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
                              <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" /> Timeline & Event Linkage
                              </p>
                              <div className="flex flex-wrap gap-4 text-sm">
                                {s.expected_date && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Expected Date: </span>
                                    <span className="font-medium">{new Date(s.expected_date + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</span>
                                  </div>
                                )}
                                {s.linked_event && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Trigger Event: </span>
                                    <span className="font-medium capitalize">{s.linked_event.replace(/_/g, " ")}</span>
                                  </div>
                                )}
                                {s.linked_milestone_title && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Linked Milestone: </span>
                                    <span className="font-medium">{s.linked_milestone_title}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {s.notes && <p className="text-xs text-muted-foreground italic">{s.notes}</p>}

                          <div className="flex justify-end">
                            <button onClick={() => deleteRefi(s.scenario_id)} className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center gap-1">
                              <Trash2 className="h-3 w-3" /> Delete Scenario
                            </button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* Sale Scenarios                                               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <section>
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Sale Scenarios
            </h3>
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              {/* ── Create Form ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">New Sale Scenario</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateSale} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input value={saleForm.label} onChange={(e) => setSaleForm((f) => ({ ...f, label: e.target.value }))} />
                    </div>

                    {/* Timing & Event Linkage */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Timing & Event Linkage
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Expected Date</Label>
                          <Input type="date" value={saleForm.expected_date} onChange={(e) => setSaleForm((f) => ({ ...f, expected_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Hold Period (mo)</Label>
                          <Input type="number" value={saleForm.hold_period_months} onChange={(e) => setSaleForm((f) => ({ ...f, hold_period_months: e.target.value }))} placeholder="e.g. 60" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Linked Event</Label>
                        <Select value={saleForm.linked_event} onValueChange={(v) => setSaleForm((f) => ({ ...f, linked_event: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select trigger event" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="construction_completion">Construction Completion</SelectItem>
                            <SelectItem value="lease_up_complete">Lease-Up Complete</SelectItem>
                            <SelectItem value="stabilization">Stabilization</SelectItem>
                            <SelectItem value="interim_operation_end">Interim Operation End</SelectItem>
                            <SelectItem value="planning_approval">Planning Approval</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(milestones ?? []).length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs">Link to Milestone</Label>
                          <Select value={saleForm.linked_milestone_id} onValueChange={(v) => setSaleForm((f) => ({ ...f, linked_milestone_id: v }))}>
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

                    {/* Deal Terms */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Sale Price ($)</Label>
                        <Input type="number" value={saleForm.assumed_sale_price} onChange={(e) => setSaleForm((f) => ({ ...f, assumed_sale_price: e.target.value }))} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Selling Costs (%)</Label>
                        <Input type="number" step="0.1" value={saleForm.selling_costs_percent} onChange={(e) => setSaleForm((f) => ({ ...f, selling_costs_percent: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Debt Payout ($)</Label>
                        <div className="flex gap-1.5">
                          <Input type="number" value={saleForm.debt_payout} onChange={(e) => setSaleForm((f) => ({ ...f, debt_payout: e.target.value }))} placeholder={totalDebtOutstanding > 0 ? `Current: ${totalDebtOutstanding.toLocaleString()}` : "opt."} />
                          {totalDebtOutstanding > 0 && !saleForm.debt_payout && (
                            <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setSaleForm(f => ({ ...f, debt_payout: String(totalDebtOutstanding) }))}>
                              Auto-fill
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cap Gains Reserve ($)</Label>
                        <Input type="number" value={saleForm.capital_gains_reserve} onChange={(e) => setSaleForm((f) => ({ ...f, capital_gains_reserve: e.target.value }))} />
                      </div>
                    </div>

                    {/* ROI Inputs */}
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" /> ROI Projection Inputs
                      </p>
                      {(() => {
                        const computedEquity = (property?.purchase_price ?? 0) - totalDebtOutstanding;
                        const computedNOI = (property?.annual_revenue ?? 0) - (property?.annual_expenses ?? 0);
                        const computedCashFlow = computedNOI - totalAnnualDebtService;
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Total Equity ($)</Label>
                                <div className="flex gap-1.5">
                                  <Input type="number" value={saleForm.total_equity_invested} onChange={(e) => setSaleForm((f) => ({ ...f, total_equity_invested: e.target.value }))} placeholder={computedEquity > 0 ? `Est: ${Math.round(computedEquity).toLocaleString()}` : "e.g. 200000"} />
                                  {computedEquity > 0 && !saleForm.total_equity_invested && (
                                    <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setSaleForm(f => ({ ...f, total_equity_invested: String(Math.round(computedEquity)) }))}>Auto</Button>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Annual NOI at Sale ($)</Label>
                                <div className="flex gap-1.5">
                                  <Input type="number" value={saleForm.annual_noi_at_sale} onChange={(e) => setSaleForm((f) => ({ ...f, annual_noi_at_sale: e.target.value }))} placeholder={computedNOI > 0 ? `Est: ${Math.round(computedNOI).toLocaleString()}` : "e.g. 78000"} />
                                  {computedNOI > 0 && !saleForm.annual_noi_at_sale && (
                                    <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setSaleForm(f => ({ ...f, annual_noi_at_sale: String(Math.round(computedNOI)) }))}>Auto</Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Avg Annual Cash Flow After DS ($)</Label>
                              <div className="flex gap-1.5">
                                <Input type="number" value={saleForm.annual_cash_flow} onChange={(e) => setSaleForm((f) => ({ ...f, annual_cash_flow: e.target.value }))} placeholder={computedCashFlow > 0 ? `Est: ${Math.round(computedCashFlow).toLocaleString()}` : "e.g. 28000"} />
                                {computedCashFlow > 0 && !saleForm.annual_cash_flow && (
                                  <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setSaleForm(f => ({ ...f, annual_cash_flow: String(Math.round(computedCashFlow)) }))}>Auto</Button>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}

                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={saleForm.notes} onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" />
                    </div>
                    <Button type="submit" className="w-full" disabled={salePending}>
                      {salePending ? "Saving\u2026" : "Save Scenario"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* ── Saved Sale Scenarios ── */}
              <div className="space-y-4">
                {!saleScenarios || saleScenarios.length === 0 ? (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-sm text-muted-foreground text-center">No sale scenarios yet. Create one to see projected ROI and cash flow metrics.</p>
                    </CardContent>
                  </Card>
                ) : (
                  (saleScenarios as Array<{ scenario_id: number; label: string; assumed_sale_price: number; selling_costs_percent: number; selling_costs: number; debt_payout?: number; capital_gains_reserve?: number; net_proceeds: number; expected_date?: string; linked_event?: string; linked_milestone_title?: string; hold_period_months?: number; total_equity_invested?: number; annual_noi_at_sale?: number; annual_cash_flow?: number; total_return?: number; equity_multiple?: number; irr_estimate?: number; cash_on_cash_return?: number; cap_rate?: number; notes?: string }>).map((s) => (
                    <Card key={s.scenario_id} className="overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer" onClick={() => setExpandedSale(expandedSale === s.scenario_id ? null : s.scenario_id)}>
                        <div className="flex items-center gap-3">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">{s.label}</span>
                          {s.expected_date && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(s.expected_date + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                            </Badge>
                          )}
                          {s.linked_event && (
                            <Badge variant="secondary" className="text-xs">
                              {s.linked_event.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-sm font-bold", s.net_proceeds >= 0 ? "text-green-600" : "text-red-600")}>
                            {formatCurrency(s.net_proceeds)} net
                          </span>
                          {expandedSale === s.scenario_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </div>

                      {expandedSale === s.scenario_id && (
                        <CardContent className="pt-4 space-y-4">
                          {/* Deal Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground">Sale Price</p>
                              <p className="text-sm font-bold">{formatCurrency(s.assumed_sale_price)}</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground">Selling Costs ({s.selling_costs_percent}%)</p>
                              <p className="text-sm font-bold">{formatCurrency(s.selling_costs)}</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-muted/30">
                              <p className="text-xs text-muted-foreground">Debt Payout</p>
                              <p className="text-sm font-bold">{formatCurrency(s.debt_payout ?? 0)}</p>
                            </div>
                            <div className={cn("text-center p-3 rounded-lg", s.net_proceeds >= 0 ? "bg-green-50" : "bg-red-50")}>
                              <p className="text-xs text-muted-foreground">Net Proceeds</p>
                              <p className={cn("text-sm font-bold", s.net_proceeds >= 0 ? "text-green-700" : "text-red-700")}>{formatCurrency(s.net_proceeds)}</p>
                            </div>
                          </div>

                          {/* ROI Metrics */}
                          {(s.total_return != null || s.equity_multiple != null || s.irr_estimate != null || s.cap_rate != null) && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
                              <p className="text-xs font-semibold text-emerald-700 mb-3 flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5" /> Projected ROI & Cash Flow
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {s.total_return != null && (
                                  <div className="text-center">
                                    <p className={cn("text-xl font-bold", s.total_return >= 0 ? "text-emerald-700" : "text-red-600")}>{formatCurrency(s.total_return)}</p>
                                    <p className="text-xs text-muted-foreground">Total Return</p>
                                  </div>
                                )}
                                {s.equity_multiple != null && (
                                  <div className="text-center">
                                    <p className="text-xl font-bold text-emerald-700">{s.equity_multiple}x</p>
                                    <p className="text-xs text-muted-foreground">Equity Multiple</p>
                                  </div>
                                )}
                                {s.irr_estimate != null && (
                                  <div className="text-center">
                                    <p className="text-xl font-bold text-emerald-700">{s.irr_estimate}%</p>
                                    <p className="text-xs text-muted-foreground">Est. IRR</p>
                                  </div>
                                )}
                                {s.cash_on_cash_return != null && (
                                  <div className="text-center">
                                    <p className="text-xl font-bold text-emerald-700">{s.cash_on_cash_return}%</p>
                                    <p className="text-xs text-muted-foreground">Cash-on-Cash</p>
                                  </div>
                                )}
                                {s.cap_rate != null && (
                                  <div className="text-center">
                                    <p className="text-xl font-bold text-emerald-700">{s.cap_rate}%</p>
                                    <p className="text-xs text-muted-foreground">Cap Rate</p>
                                  </div>
                                )}
                              </div>
                              {s.hold_period_months && (
                                <p className="text-xs text-muted-foreground text-center mt-2">
                                  Based on {s.hold_period_months} month hold ({(s.hold_period_months / 12).toFixed(1)} yr)
                                  {s.total_equity_invested ? ` | ${formatCurrency(s.total_equity_invested)} equity` : ""}
                                  {s.annual_cash_flow ? ` | ${formatCurrency(s.annual_cash_flow)}/yr cash flow` : ""}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Timeline */}
                          {(s.expected_date || s.linked_event || s.linked_milestone_title) && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
                              <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" /> Timeline & Event Linkage
                              </p>
                              <div className="flex flex-wrap gap-4 text-sm">
                                {s.expected_date && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Expected Date: </span>
                                    <span className="font-medium">{new Date(s.expected_date + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</span>
                                  </div>
                                )}
                                {s.linked_event && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Trigger Event: </span>
                                    <span className="font-medium capitalize">{s.linked_event.replace(/_/g, " ")}</span>
                                  </div>
                                )}
                                {s.linked_milestone_title && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Linked Milestone: </span>
                                    <span className="font-medium">{s.linked_milestone_title}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {s.notes && <p className="text-xs text-muted-foreground italic">{s.notes}</p>}

                          <div className="flex justify-end">
                            <button onClick={() => deleteSale(s.scenario_id)} className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center gap-1">
                              <Trash2 className="h-3 w-3" /> Delete Scenario
                            </button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
