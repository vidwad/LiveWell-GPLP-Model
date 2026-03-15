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
} from "@/hooks/usePortfolio";
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

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  prospect:     { label: "Prospect",     color: "text-slate-700",  bg: "bg-slate-100 border-slate-200" },
  acquisition:  { label: "Acquisition",  color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  interim:      { label: "Interim",      color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  construction: { label: "Construction", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  lease_up:     { label: "Lease-Up",     color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  stabilized:   { label: "Stabilized",   color: "text-green-700",  bg: "bg-green-50 border-green-200" },
};

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
  const [expandedDebtId, setExpandedDebtId] = useState<number | null>(null);

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
  });

  // Sale Scenarios
  const { data: saleScenarios } = useSaleScenarios(propertyId);
  const { mutateAsync: createSale, isPending: salePending } = useCreateSaleScenario(propertyId);
  const { mutateAsync: deleteSale } = useDeleteSaleScenario(propertyId);
  const [saleForm, setSaleForm] = useState({
    label: "Sale Scenario", assumed_sale_price: "", selling_costs_percent: "5",
    debt_payout: "", capital_gains_reserve: "0", notes: "",
  });

  // Plan form
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState<DevelopmentPlanCreate>({
    planned_units: 0, planned_beds: 0, planned_sqft: 0,
    estimated_construction_cost: 0, development_start_date: "", construction_duration_days: 0,
  });

  // Plan comparison
  const [compareMode, setCompareMode] = useState(false);
  const [comparePlanIds, setComparePlanIds] = useState<[number | null, number | null]>([null, null]);

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
      });
      toast.success("Refinance scenario saved");
      setRefiForm({ label: "Refinance Scenario", assumed_new_valuation: "", new_ltv_percent: "75", new_interest_rate: "", new_amortization_months: "300", existing_debt_payout: "", closing_costs: "0", notes: "" });
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
      });
      toast.success("Sale scenario saved");
      setSaleForm({ label: "Sale Scenario", assumed_sale_price: "", selling_costs_percent: "5", debt_payout: "", capital_gains_reserve: "0", notes: "" });
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
          Portfolio
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
            <TabsTrigger value="plans"><Layers className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Dev Plans</span></TabsTrigger>
            <TabsTrigger value="debt"><Landmark className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Debt</span></TabsTrigger>
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

        {/* ── Debt & Amortization ── */}
        <TabsContent value="debt" className="mt-6 space-y-4">
          {!debtFacilities || debtFacilities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Landmark className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No debt facilities recorded for this property.</p>
              </CardContent>
            </Card>
          ) : (
            debtFacilities.map((debt: {
              debt_id: number; lender_name: string; debt_type: string; status: string;
              commitment_amount: number; outstanding_balance: number; interest_rate: number | null;
              rate_type: string; term_months: number | null; maturity_date: string | null;
              amortization_months: number | null; io_period_months: number | null;
              ltv_covenant: number | null; dscr_covenant: number | null;
            }) => (
              <Card key={debt.debt_id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">{debt.lender_name}</CardTitle>
                        <Badge variant={debt.status === "active" ? "default" : "secondary"} className="text-xs">
                          {debt.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{debt.debt_type.replace(/_/g, " ")}</span>
                        <span>{debt.rate_type}</span>
                        {debt.interest_rate != null && <span>{Number(debt.interest_rate).toFixed(2)}%</span>}
                        {debt.term_months && <span>{debt.term_months}mo term</span>}
                        {debt.amortization_months && <span>{debt.amortization_months}mo amort</span>}
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-lg font-bold">{formatCurrency(debt.commitment_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(debt.outstanding_balance)} outstanding
                      </p>
                    </div>
                  </div>
                </CardHeader>

                {/* Covenant badges */}
                {(debt.ltv_covenant || debt.dscr_covenant) && (
                  <div className="px-6 pb-3 flex flex-wrap gap-2">
                    {debt.ltv_covenant && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        LTV Covenant: {debt.ltv_covenant}%
                      </span>
                    )}
                    {debt.dscr_covenant && (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                        DSCR Covenant: {debt.dscr_covenant}x
                      </span>
                    )}
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
              </Card>
            ))
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
                      <Label className="text-xs">Debt Service ($)</Label>
                      <Input type="number" value={projForm.annual_debt_service} onChange={(e) => setProjForm((f) => ({ ...f, annual_debt_service: e.target.value }))} placeholder="optional" />
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

          {/* Refinance Scenarios */}
          <section>
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              Refinance Scenarios
            </h3>
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
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
                        <Input type="number" value={refiForm.existing_debt_payout} onChange={(e) => setRefiForm((f) => ({ ...f, existing_debt_payout: e.target.value }))} placeholder="opt." />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Closing Costs ($)</Label>
                        <Input type="number" value={refiForm.closing_costs} onChange={(e) => setRefiForm((f) => ({ ...f, closing_costs: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={refiForm.notes} onChange={(e) => setRefiForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" />
                    </div>
                    <Button type="submit" className="w-full" disabled={refiPending}>
                      {refiPending ? "Saving…" : "Save Scenario"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Saved Refinance Scenarios</CardTitle>
                </CardHeader>
                <CardContent>
                  {!refiScenarios || refiScenarios.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No refinance scenarios yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Label</TableHead>
                            <TableHead className="text-right">Valuation</TableHead>
                            <TableHead className="text-right">LTV</TableHead>
                            <TableHead className="text-right">New Loan</TableHead>
                            <TableHead className="text-right">Net Proceeds</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {refiScenarios.map((s: { scenario_id: number; label: string; assumed_new_valuation: number; new_ltv_percent: number; new_loan_amount: number; net_proceeds: number; }) => (
                            <TableRow key={s.scenario_id}>
                              <TableCell className="font-medium">{s.label}</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.assumed_new_valuation)}</TableCell>
                              <TableCell className="text-right">{s.new_ltv_percent}%</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.new_loan_amount)}</TableCell>
                              <TableCell className={cn("text-right font-semibold", s.net_proceeds >= 0 ? "text-green-600" : "text-red-600")}>
                                {formatCurrency(s.net_proceeds)}
                              </TableCell>
                              <TableCell>
                                <button onClick={() => deleteRefi(s.scenario_id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                                  Delete
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Sale Scenarios */}
          <section>
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Sale Scenarios
            </h3>
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
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
                        <Input type="number" value={saleForm.debt_payout} onChange={(e) => setSaleForm((f) => ({ ...f, debt_payout: e.target.value }))} placeholder="opt." />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cap Gains Reserve ($)</Label>
                        <Input type="number" value={saleForm.capital_gains_reserve} onChange={(e) => setSaleForm((f) => ({ ...f, capital_gains_reserve: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={saleForm.notes} onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" />
                    </div>
                    <Button type="submit" className="w-full" disabled={salePending}>
                      {salePending ? "Saving…" : "Save Scenario"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Saved Sale Scenarios</CardTitle>
                </CardHeader>
                <CardContent>
                  {!saleScenarios || saleScenarios.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No sale scenarios yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Label</TableHead>
                            <TableHead className="text-right">Sale Price</TableHead>
                            <TableHead className="text-right">Selling Costs</TableHead>
                            <TableHead className="text-right">Net Proceeds</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saleScenarios.map((s: { scenario_id: number; label: string; assumed_sale_price: number; selling_costs: number; net_proceeds: number; }) => (
                            <TableRow key={s.scenario_id}>
                              <TableCell className="font-medium">{s.label}</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.assumed_sale_price)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.selling_costs)}</TableCell>
                              <TableCell className={cn("text-right font-semibold", s.net_proceeds >= 0 ? "text-green-600" : "text-red-600")}>
                                {formatCurrency(s.net_proceeds)}
                              </TableCell>
                              <TableCell>
                                <button onClick={() => deleteSale(s.scenario_id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                                  Delete
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
