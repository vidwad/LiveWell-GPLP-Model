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
import { DevPlansTab } from "@/components/property/DevPlansTab";
import { DebtFinancingTab } from "@/components/property/DebtFinancingTab";
import { ProjectionsTab } from "@/components/property/ProjectionsTab";
import { ExitScenariosTab } from "@/components/property/ExitScenariosTab";
import { PropertyDocumentsTab } from "@/components/property/PropertyDocumentsTab";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  Calculator,
  Building2,
  DollarSign,
  MapPin,
  Ruler,
  Landmark,
  TrendingUp,
  Layers,
  BarChart3,
  Activity,
  HardHat,
  Banknote,
  Image as ImageIcon,
  Upload,
  Loader2,
  ExternalLink,
  FolderOpen,
  Eye,
  Wrench,
} from "lucide-react";
import {
  useProperty,
  useDevelopmentPlans,
  useDeleteProperty,
  useDebtFacilities,
} from "@/hooks/usePortfolio";
import type { DebtFacility, DevelopmentPlan } from "@/types/portfolio";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatCurrencyCompact, formatDate, cn } from "@/lib/utils";

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
        <p className="text-sm sm:text-base lg:text-lg font-bold leading-tight whitespace-nowrap truncate" title={value}>{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const propertyId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const { data: property, isLoading, refetch: refetchProperty } = useProperty(propertyId);
  const { data: plans } = useDevelopmentPlans(propertyId);
  const { mutateAsync: deleteProperty, isPending: deletePending } = useDeleteProperty();
  const { data: debtFacilities } = useDebtFacilities(propertyId);

  const canEdit = user?.role === "DEVELOPER" || user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";
  const [activePhase, setActivePhase] = useState<"as_is" | "post_renovation" | "full_development">("as_is");

  /* ── Phase-aware debt filtering ── */
  const activePlan = (plans ?? []).find((p: DevelopmentPlan) => p.status === "active") ?? (plans ?? [])[0];

  // Map activePhase to the relevant plan_id
  const phasePlanId = (() => {
    if (activePhase === "as_is" || !plans || plans.length === 0) return null;
    // For post_renovation: find the kitchen/renovation plan (smaller unit count or first plan)
    // For full_development: find the full dev plan (larger unit count or last plan)
    const sortedPlans = [...plans].sort((a: DevelopmentPlan, b: DevelopmentPlan) => a.plan_id - b.plan_id);
    if (activePhase === "post_renovation") return sortedPlans[0]?.plan_id ?? null;
    if (activePhase === "full_development") return sortedPlans.length > 1 ? sortedPlans[sortedPlans.length - 1]?.plan_id : sortedPlans[0]?.plan_id ?? null;
    return null;
  })();

  // Filter debts based on active phase using development_plan_id and replaces_debt_id chain
  const phaseFilteredDebts: DebtFacility[] = (() => {
    const all = (debtFacilities ?? []) as DebtFacility[];
    if (all.length === 0) return [];

    if (activePhase === "as_is") {
      // Show only baseline debts (no development_plan_id) that aren't replaced by other baseline debts
      const baselineDebts = all.filter(d => !d.development_plan_id);
      return baselineDebts;
    }

    if (!phasePlanId) return all.filter(d => !d.development_plan_id);

    // For plan phases: show plan-specific debts, following the replacement chain
    const planDebts = all.filter(d => d.development_plan_id === phasePlanId);
    // Find which baseline debts are replaced by plan debts
    const replacedIds = new Set<number>();
    const collectReplaced = (debts: DebtFacility[]) => {
      for (const d of debts) {
        if (d.replaces_debt_id) replacedIds.add(d.replaces_debt_id);
      }
    };
    collectReplaced(planDebts);
    // Also check if plan debts replace each other (e.g., CMHC replaces construction loan)
    // Show only the final debt in each replacement chain
    const planDebtIds = new Set(planDebts.map(d => d.debt_id));
    const finalPlanDebts = planDebts.filter(d => !planDebtIds.has(d.replaces_debt_id ?? -1) || !planDebts.some(other => other.replaces_debt_id === d.debt_id));
    // Actually: show plan debts that are NOT replaced by another plan debt
    const replacedByPlanDebt = new Set<number>();
    for (const d of planDebts) {
      if (d.replaces_debt_id && planDebts.some(other => other.debt_id === d.replaces_debt_id)) {
        replacedByPlanDebt.add(d.replaces_debt_id);
      }
    }
    const activePlanDebts = planDebts.filter(d => !replacedByPlanDebt.has(d.debt_id));
    // Add baseline debts that aren't replaced
    const baselineDebts = all.filter(d => !d.development_plan_id && !replacedIds.has(d.debt_id));
    return [...activePlanDebts, ...baselineDebts];
  })();

  // Compute Canadian semi-annual compounding ADS
  const computeADS = (d: DebtFacility): number => {
    const bal = d.outstanding_balance ?? 0;
    const rate = (d.interest_rate ?? 0) / 100;
    const amort = d.amortization_months ?? 0;
    const io = d.io_period_months ?? 0;
    if (bal <= 0 || rate <= 0) return 0;
    const compounding = (d as any).compounding_method ?? "semi_annual";
    let monthlyRate: number;
    if (compounding === "semi_annual") {
      // Canadian mortgage: semi-annual compounding, monthly payments
      monthlyRate = Math.pow(1 + rate / 2, 1 / 6) - 1;
    } else {
      monthlyRate = rate / 12;
    }
    if (amort > 0 && io <= 0) {
      const pmt = bal * (monthlyRate * Math.pow(1 + monthlyRate, amort)) / (Math.pow(1 + monthlyRate, amort) - 1);
      return pmt * 12;
    }
    return bal * rate; // IO
  };

  const totalDebtCommitment = phaseFilteredDebts.reduce((s, d) => s + (d.commitment_amount ?? 0), 0);
  const totalDebtOutstanding = phaseFilteredDebts.reduce((s, d) => s + (d.outstanding_balance ?? 0), 0);
  const totalAnnualDebtService = phaseFilteredDebts.reduce((s, d) => s + computeADS(d), 0);

  /* ── Handlers ── */
  const handleDelete = async () => {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    try {
      await deleteProperty(propertyId);
      toast.success("Property deleted");
      router.push("/portfolio");
    } catch (e) { toast.error("Failed to delete property"); }
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
              {((property as Record<string, any>).community_focus || (property as Record<string, any>).lp_community_focus) && (
                <span className="flex items-center gap-1 text-purple-600 font-medium">
                  <Building2 className="h-3.5 w-3.5" />
                  {(property as Record<string, any>).community_focus || (property as Record<string, any>).lp_community_focus}
                </span>
              )}
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
          PHASE SELECTOR
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setActivePhase("as_is")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
            activePhase === "as_is"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          As-Is
        </button>
        <button
          onClick={() => setActivePhase("post_renovation")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
            activePhase === "post_renovation"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
          )}
        >
          <Wrench className="h-3.5 w-3.5" />
          Post-Renovation
        </button>
        <button
          onClick={() => setActivePhase("full_development")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
            activePhase === "full_development"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-white/50"
          )}
        >
          <HardHat className="h-3.5 w-3.5" />
          Full Development
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TABS
      ════════════════════════════════════════════════════════════════════════ */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="w-full sm:w-auto">
            <TabsTrigger value="overview"><Building2 className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Overview</span></TabsTrigger>
            <TabsTrigger value="photos"><ImageIcon className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Photos</span></TabsTrigger>
            <TabsTrigger value="area-research"><MapPin className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Area Research</span></TabsTrigger>
            <TabsTrigger value="units"><Ruler className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Units & Beds</span></TabsTrigger>
            <TabsTrigger value="revenue"><DollarSign className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Revenue</span></TabsTrigger>
            <TabsTrigger value="development"><Layers className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Development</span></TabsTrigger>
            <TabsTrigger value="debt"><Landmark className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Debt & Financing</span></TabsTrigger>
            <TabsTrigger value="financial"><Calculator className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Financial Analysis</span></TabsTrigger>
            <TabsTrigger value="documents"><FolderOpen className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Documents</span></TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview (includes Lifecycle) ── */}
        <TabsContent value="overview" className="mt-6">
          <OverviewTab
            property={property}
            activePlan={activePlan}
            totalDebtCommitment={totalDebtCommitment}
            totalDebtOutstanding={totalDebtOutstanding}
            debtFacilitiesCount={(debtFacilities ?? []).length}
            onPropertyUpdated={() => refetchProperty()}
            activePhase={activePhase}
          />
          {/* Lifecycle section at bottom of Overview */}
          <div className="mt-6">
            <LifecycleTab
              propertyId={propertyId}
              stage={stage}
              canEdit={canEdit}
              userRole={user?.role}
              activePhase={activePhase}
            />
          </div>
        </TabsContent>

        {/* ── Area Research ── */}
        <TabsContent value="area-research" className="mt-6">
          <AreaResearchTab
            propertyId={propertyId}
            address={property?.address}
            city={property?.city}
            zoning={property?.zoning ?? undefined}
            latitude={property?.latitude ? Number(property.latitude) : undefined}
            longitude={property?.longitude ? Number(property.longitude) : undefined}
          />
        </TabsContent>

        {/* ── Units & Beds ── */}
        <TabsContent value="units" className="mt-6">
          <UnitsBedsTab propertyId={propertyId} canEdit={canEdit} activePhase={activePhase} />
        </TabsContent>

        {/* ── Revenue (Rent Roll + Ancillary) ── */}
        <TabsContent value="revenue" className="mt-6">
          <RentRollTab propertyId={propertyId} canEdit={canEdit} property={property} activePhase={activePhase} />
        </TabsContent>

        {/* ── Development (Dev Plans + Construction Budget) ── */}
        <TabsContent value="development" className="mt-6">
          <DevPlansTab propertyId={propertyId} canEdit={canEdit} activePhase={activePhase} />
          <div className="mt-6 border-t pt-6">
            <ConstructionBudgetTab propertyId={propertyId} canEdit={canEdit} activePhase={activePhase} />
          </div>
        </TabsContent>

        {/* ── Debt & Financing ── */}
        <TabsContent value="debt" className="mt-6">
          <DebtFinancingTab
            propertyId={propertyId}
            canEdit={canEdit}
            property={property}
            totalDebtCommitment={totalDebtCommitment}
            totalDebtOutstanding={totalDebtOutstanding}
            totalAnnualDebtService={totalAnnualDebtService}
            activePhase={activePhase}
            phaseFilteredDebts={phaseFilteredDebts}
            phasePlanId={phasePlanId}
          />
        </TabsContent>

        {/* ── Financial Analysis (Pro Forma + Projections + Exit + Valuation) ── */}
        <TabsContent value="financial" className="mt-6">
          <FinancialAnalysisTab
            propertyId={propertyId}
            canEdit={canEdit}
            property={property}
            totalDebtOutstanding={totalDebtOutstanding}
            totalAnnualDebtService={totalAnnualDebtService}
            activePhase={activePhase}
            activePlan={activePlan}
            phaseFilteredDebts={phaseFilteredDebts}
            phasePlanId={phasePlanId}
          />
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents" className="mt-6">
          <PropertyDocumentsTab propertyId={propertyId} canEdit={canEdit} />
        </TabsContent>

        {/* ── Photos ── */}
        <TabsContent value="photos" className="mt-6">
          <PropertyPhotosTab propertyId={propertyId} />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ── Financial Analysis Tab (combines Pro Forma, Projections, Exit Scenarios, Valuation) ──

function FinancialAnalysisTab({
  propertyId, canEdit, property, totalDebtOutstanding, totalAnnualDebtService,
  activePhase, activePlan, phaseFilteredDebts, phasePlanId,
}: {
  propertyId: number; canEdit: boolean; property: Record<string, any>;
  totalDebtOutstanding: number; totalAnnualDebtService: number;
  activePhase: "as_is" | "post_renovation" | "full_development";
  activePlan: any; phaseFilteredDebts: any[]; phasePlanId: number | null;
}) {
  const [subTab, setSubTab] = React.useState<"proforma" | "projections" | "exit" | "valuation">("proforma");

  return (
    <div className="space-y-4">
      {/* Sub-tab selector */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {[
          { key: "proforma" as const, label: "Pro Forma", icon: Calculator },
          { key: "projections" as const, label: "Projections", icon: BarChart3 },
          { key: "exit" as const, label: "Exit Scenarios", icon: TrendingUp },
          { key: "valuation" as const, label: "Valuation", icon: Banknote },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              subTab === key
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {subTab === "proforma" && (
        <ProFormaTab propertyId={propertyId} activePhase={activePhase} />
      )}
      {subTab === "projections" && (
        <ProjectionsTab
          propertyId={propertyId}
          totalAnnualDebtService={totalAnnualDebtService}
          activePhase={activePhase}
          activePlan={activePlan}
          phaseFilteredDebts={phaseFilteredDebts}
          phasePlanId={phasePlanId}
        />
      )}
      {subTab === "exit" && (
        <ExitScenariosTab
          propertyId={propertyId}
          canEdit={canEdit}
          property={property}
          totalDebtOutstanding={totalDebtOutstanding}
          totalAnnualDebtService={totalAnnualDebtService}
          activePhase={activePhase}
        />
      )}
      {subTab === "valuation" && (
        <ValuationTab propertyId={propertyId} canEdit={canEdit} activePhase={activePhase} />
      )}
    </div>
  );
}

// ── Property Photos Tab ─────────────────────────────────────────────

function PropertyPhotosTab({ propertyId }: { propertyId: number }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["property-images", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/images`).then(r => r.data),
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [caption, setCaption] = React.useState("");
  const [category, setCategory] = React.useState("exterior");

  const uploaded = data?.uploaded || [];
  const listingPhotos = data?.listing_photos || [];
  const listingUrl = data?.listing_url;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", caption);
      formData.append("category", category);
      await apiClient.post(`/api/portfolio/properties/${propertyId}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      refetch();
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      alert("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!confirm("Delete this image?")) return;
    await apiClient.delete(`/api/portfolio/properties/images/${imageId}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload Property Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="rounded border bg-background px-2 py-1.5 text-sm">
                <option value="exterior">Exterior</option>
                <option value="interior">Interior</option>
                <option value="kitchen">Kitchen</option>
                <option value="bathroom">Bathroom</option>
                <option value="bedroom">Bedroom</option>
                <option value="yard">Yard</option>
                <option value="garage">Garage</option>
                <option value="basement">Basement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Caption (optional)</label>
              <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Front view, Kitchen renovation..." />
            </div>
            <Button variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Uploading...</> : <><Upload className="h-4 w-4 mr-1" /> Upload</>}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Photos */}
      {uploaded.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Property Photos ({uploaded.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {uploaded.map((img: any) => (
                <div key={img.image_id} className="relative group rounded-lg overflow-hidden border">
                  <img src={`${apiClient.defaults.baseURL}${img.file_url}`} alt={img.caption || "Property"} className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                    <div className="w-full p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs truncate">{img.caption || img.category}</p>
                      <button onClick={() => handleDelete(img.image_id)} className="text-red-300 hover:text-red-100 text-[10px] mt-0.5">Delete</button>
                    </div>
                  </div>
                  {img.is_primary && (
                    <span className="absolute top-1 left-1 text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded">Primary</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listing Reference Photos */}
      {(listingPhotos.length > 0 || listingUrl) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ExternalLink className="h-4 w-4" /> Listing Reference Photos
              </CardTitle>
              {listingUrl && (
                <a href={listingUrl} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline">
                  View Original Listing
                </a>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Reference images from the original listing (externally hosted)</p>
          </CardHeader>
          <CardContent>
            {listingPhotos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {listingPhotos.map((url: string, i: number) => (
                  <div key={i} className="rounded-lg overflow-hidden border">
                    <img src={url} alt={`Listing photo ${i + 1}`} className="w-full h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No listing photos extracted.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : uploaded.length === 0 && listingPhotos.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload property photos or import from a listing</p>
        </div>
      )}
    </div>
  );
}
