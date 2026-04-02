"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import React, { useState, useCallback, useEffect } from "react";
import { TrendChart } from "@/components/charts/TrendChart";
import {
  ArrowLeft,
  Landmark,
  TrendingUp,
  Target,
  BarChart3,
  Users,
  Layers,
  Building2,
  DollarSign,
  Calendar,
  MapPin,
  Percent,
  Hash,
  FileText,
  Plus,
  Pencil,
  ArrowRightLeft,
} from "lucide-react";
import {
  useLP,
  useLPs,
  useTranches,
  useSubscriptions,
  useHoldings,
  useTargetProperties,
  usePortfolioRollup,
  useDistributionEvents,
  useInvestors,
  useCreateTranche,
  useUpdateTranche,
  useCreateSubscription,
  useUpdateSubscription,
  useCreateHolding,
  useUpdateHolding,
  useCreateTargetProperty,
  useUpdateTargetProperty,
  useDeleteTargetProperty,
  useConvertTargetProperty,
  useUpdateLP,
  useComputeWaterfall,
} from "@/hooks/useInvestment";
import { usePropertiesByLp } from "@/hooks/usePortfolio";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { WaterfallResult } from "@/types/investment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/providers/AuthProvider";

/* ── helpers ─────────────────────────────────────────────────────── */
function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const LP_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  operating: "default", open_for_subscription: "secondary", partially_funded: "secondary",
  fully_funded: "default", draft: "outline", under_review: "outline", approved: "outline",
  tranche_closed: "default", winding_down: "destructive", dissolved: "destructive", raising: "secondary",
};
const SUB_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", submitted: "outline", under_review: "secondary", accepted: "secondary",
  funded: "default", issued: "default", closed: "default", rejected: "destructive", withdrawn: "destructive",
};
const TP_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  identified: "outline", underwriting: "secondary", approved_target: "secondary",
  under_offer: "default", acquired: "default", rejected: "destructive", dropped: "destructive",
};

function pct(num: string | null | undefined, denom: string | null | undefined) {
  const n = Number(num ?? 0), d = Number(denom ?? 0);
  return d === 0 ? 0 : Math.min(100, (n / d) * 100);
}
function fmtPct(v: string | null | undefined) { return v ? `${Number(v).toFixed(1)}%` : "—"; }
function fmtDate(v: string | null | undefined) { return v ? new Date(v).toLocaleDateString("en-CA") : "—"; }
function fmtNum(v: string | number | null | undefined) { return v === null || v === undefined ? "—" : Number(v).toLocaleString("en-CA"); }

/* ── KPI Card ────────────────────────────────────────────────────── */
function KPI({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon?: React.ElementType }) {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className="text-lg sm:text-xl font-bold tabular-nums whitespace-nowrap truncate">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

/* ── Detail Row ──────────────────────────────────────────────────── */
function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

/* ── Form Field helper ───────────────────────────────────────────── */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs mb-1">{label}</Label>
      {children}
    </div>
  );
}

/* ── Generic form state helpers ──────────────────────────────────── */
type FormState = Record<string, string>;

function useFormDialog<T extends FormState>(defaults: T) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<T>(defaults);
  const [editId, setEditId] = useState<number | null>(null);

  const openCreate = useCallback(() => {
    setForm({ ...defaults });
    setEditId(null);
    setOpen(true);
  }, [defaults]);

  const openEdit = useCallback((id: number, values: Partial<T>) => {
    setForm({ ...defaults, ...values });
    setEditId(id);
    setOpen(true);
  }, [defaults]);

  const set = useCallback((key: keyof T, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  return { open, setOpen, form, editId, openCreate, openEdit, set, isEdit: editId !== null };
}

/* ================================================================= */
/*  MAIN PAGE                                                        */
/* ================================================================= */
export default function LPDetailPage() {
  const params = useParams();
  const lpId = Number(params.lpId);
  const router = useRouter();

  /* ── queries ─────────────────────────────────────────────────── */
  const { data: lp, isLoading: lpLoading, error: lpError } = useLP(lpId);
  if (lpError) console.error("LP load error:", lpError);
  const { data: tranches } = useTranches(lpId);
  const { data: subscriptions } = useSubscriptions(lpId);
  const { data: holdings } = useHoldings(lpId);
  const { data: targetProperties } = useTargetProperties(lpId);
  const { data: rollup } = usePortfolioRollup(lpId);
  const { data: distributions } = useDistributionEvents(lpId);
  const { data: investors } = useInvestors();
  const { data: ioiSummary } = useQuery({
    queryKey: ["ioi-summary", lpId],
    queryFn: () => apiClient.get(`/api/investor/ioi/lp-summary/${lpId}`).then(r => r.data),
    enabled: !!lpId,
  });
  const { canEdit } = usePermissions();
  const { user } = useAuth();

  /* ── mutations ───────────────────────────────────────────────── */
  const updateLP = useUpdateLP();
  const createTranche = useCreateTranche();
  const updateTranche = useUpdateTranche();
  const createSubscription = useCreateSubscription();
  const updateSubscription = useUpdateSubscription();
  const createHolding = useCreateHolding();
  const updateHolding = useUpdateHolding();
  const createTargetProperty = useCreateTargetProperty();
  const updateTargetProperty = useUpdateTargetProperty();
  const deleteTargetProperty = useDeleteTargetProperty();
  const convertTargetProperty = useConvertTargetProperty();
  const computeWaterfall = useComputeWaterfall();

  /* ── waterfall state ────────────────────────────────────────── */
  const [waterfallAmount, setWaterfallAmount] = useState("");
  const [waterfallResult, setWaterfallResult] = useState<WaterfallResult | null>(null);

  /* ── P&L and NAV state ─────────────────────────────────────── */
  const [pnlYear, setPnlYear] = useState(new Date().getFullYear());
  const [pnlData, setPnlData] = useState<any>(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [navData, setNavData] = useState<any>(null);
  const [navLoading, setNavLoading] = useState(false);

  useEffect(() => {
    if (!lpId) return;
    setNavLoading(true);
    import("@/lib/api").then(({ investment }) => {
      investment.getLpNav(lpId).then(setNavData).finally(() => setNavLoading(false));
    });
  }, [lpId]);

  function fetchPnl() {
    setPnlLoading(true);
    import("@/lib/api").then(({ investment }) => {
      investment.getLpPnl(lpId, pnlYear).then(setPnlData).finally(() => setPnlLoading(false));
    });
  }

  useEffect(() => {
    if (lpId) fetchPnl();
  }, [lpId, pnlYear]);

  function handleRunWaterfall() {
    const amt = Number(waterfallAmount);
    if (!amt || amt <= 0) return;
    computeWaterfall.mutate({ lpId, distributableAmount: amt }, {
      onSuccess: (data) => setWaterfallResult(data),
    });
  }

  /* ── form dialogs ────────────────────────────────────────────── */
  const lpForm = useFormDialog({
    name: "", legal_name: "", lp_number: "", city_focus: "", community_focus: "",
    purpose_type: "", status: "", unit_price: "", minimum_subscription: "",
    target_raise: "", minimum_raise: "", maximum_raise: "",
    offering_date: "", closing_date: "", formation_costs: "", offering_costs: "",
    reserve_percent: "", preferred_return_rate: "", gp_promote_percent: "",
    gp_catchup_percent: "", asset_management_fee_percent: "", acquisition_fee_percent: "",
    selling_commission_percent: "", construction_management_fee_percent: "",
    refinancing_fee_percent: "", turnover_replacement_fee_percent: "",
    lp_profit_share_percent: "", gp_profit_share_percent: "",
    notes: "",
  });

  const trancheForm = useFormDialog({
    tranche_number: "", tranche_name: "", opening_date: "", closing_date: "",
    status: "draft", issue_price: "", target_amount: "", target_units: "", notes: "",
  });

  const subForm = useFormDialog({
    investor_id: "", tranche_id: "", commitment_amount: "", funded_amount: "",
    issue_price: "", unit_quantity: "", status: "draft", submitted_date: "", notes: "",
  });

  const holdingForm = useFormDialog({
    investor_id: "", subscription_id: "", units_held: "", average_issue_price: "",
    total_capital_contributed: "", initial_issue_date: "", ownership_percent: "",
    cost_basis: "", unreturned_capital: "", unpaid_preferred: "", is_gp: "false",
  });

  const tpForm = useFormDialog({
    address: "", city: "", province: "AB", intended_community: "", status: "identified",
    estimated_acquisition_price: "", lot_size: "", zoning: "",
    current_sqft: "", current_bedrooms: "", current_bathrooms: "", current_condition: "",
    current_assessed_value: "",
    interim_monthly_revenue: "", interim_monthly_expenses: "", interim_occupancy_percent: "",
    interim_hold_months: "",
    planned_units: "", planned_beds: "", planned_sqft: "",
    construction_budget: "", hard_costs: "", soft_costs: "", contingency_percent: "",
    construction_duration_months: "",
    stabilized_monthly_revenue: "", stabilized_monthly_expenses: "", stabilized_occupancy_percent: "",
    stabilized_annual_noi: "", stabilized_cap_rate: "", stabilized_value: "",
    assumed_ltv_percent: "", assumed_interest_rate: "", assumed_amortization_months: "",
    assumed_debt_amount: "",
    target_acquisition_date: "", target_completion_date: "", target_stabilization_date: "",
    notes: "",
  });

  /* ── submit handlers ─────────────────────────────────────────── */
  function numOrUndef(v: string) { const n = Number(v); return v && !isNaN(n) ? n : undefined; }
  function strOrUndef(v: string) { return v || undefined; }

  function handleLPSave() {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(lpForm.form)) {
      if (v) {
        if (["unit_price","minimum_subscription","target_raise","minimum_raise","maximum_raise",
             "formation_costs","offering_costs","reserve_percent","preferred_return_rate",
             "gp_promote_percent","gp_catchup_percent","asset_management_fee_percent",
             "acquisition_fee_percent","selling_commission_percent","construction_management_fee_percent",
             "refinancing_fee_percent","turnover_replacement_fee_percent",
             "lp_profit_share_percent","gp_profit_share_percent"].includes(k)) {
          data[k] = Number(v);
        } else {
          data[k] = v;
        }
      }
    }
    updateLP.mutate({ id: lpId, data: data as any }, { onSuccess: () => lpForm.setOpen(false) });
  }

  function handleTrancheSave() {
    const f = trancheForm.form;
    const payload: any = {
      lp_id: lpId,
      tranche_name: strOrUndef(f.tranche_name),
      tranche_number: numOrUndef(f.tranche_number),
      opening_date: strOrUndef(f.opening_date),
      closing_date: strOrUndef(f.closing_date),
      status: f.status || "draft",
      issue_price: numOrUndef(f.issue_price),
      target_amount: numOrUndef(f.target_amount),
      target_units: numOrUndef(f.target_units),
      notes: strOrUndef(f.notes),
    };
    if (trancheForm.isEdit) {
      updateTranche.mutate({ trancheId: trancheForm.editId!, lpId, data: payload }, { onSuccess: () => trancheForm.setOpen(false) });
    } else {
      createTranche.mutate({ lpId, data: payload }, { onSuccess: () => trancheForm.setOpen(false) });
    }
  }

  function handleSubSave() {
    const f = subForm.form;
    if (!f.investor_id) { alert("Please select an investor"); return; }
    if (!f.tranche_id) { alert("Please select a tranche"); return; }
    if (!f.commitment_amount || Number(f.commitment_amount) <= 0) { alert("Please enter a commitment amount"); return; }

    const commitment = Number(f.commitment_amount);
    const issuePrice = Number(f.issue_price) || Number(lp?.unit_price) || 1000;
    // Auto-calculate units if not provided
    const unitQty = f.unit_quantity ? Number(f.unit_quantity) : Math.round((commitment / issuePrice) * 10000) / 10000;

    const payload: any = {
      investor_id: Number(f.investor_id),
      lp_id: lpId,
      tranche_id: Number(f.tranche_id),
      commitment_amount: commitment,
      funded_amount: subForm.isEdit ? numOrUndef(f.funded_amount) : 0,
      issue_price: issuePrice,
      unit_quantity: unitQty,
      status: subForm.isEdit ? (f.status || "draft") : "draft",
      submitted_date: strOrUndef(f.submitted_date),
      notes: strOrUndef(f.notes),
    };
    if (subForm.isEdit) {
      updateSubscription.mutate({ subId: subForm.editId!, lpId, data: payload }, { onSuccess: () => subForm.setOpen(false) });
    } else {
      createSubscription.mutate({ lpId, data: payload }, { onSuccess: () => subForm.setOpen(false) });
    }
  }

  function handleHoldingSave() {
    const f = holdingForm.form;
    const payload: any = {
      investor_id: Number(f.investor_id),
      subscription_id: numOrUndef(f.subscription_id),
      units_held: numOrUndef(f.units_held),
      average_issue_price: numOrUndef(f.average_issue_price),
      total_capital_contributed: numOrUndef(f.total_capital_contributed),
      initial_issue_date: strOrUndef(f.initial_issue_date),
      ownership_percent: Number(f.ownership_percent || 0),
      cost_basis: Number(f.cost_basis || 0),
      unreturned_capital: Number(f.unreturned_capital || 0),
      unpaid_preferred: Number(f.unpaid_preferred || 0),
      is_gp: f.is_gp === "true",
    };
    if (holdingForm.isEdit) {
      updateHolding.mutate({ holdingId: holdingForm.editId!, lpId, data: payload }, { onSuccess: () => holdingForm.setOpen(false) });
    } else {
      createHolding.mutate({ lpId, data: payload }, { onSuccess: () => holdingForm.setOpen(false) });
    }
  }

  function handleTPSave() {
    const f = tpForm.form;
    const payload: any = {};
    for (const [k, v] of Object.entries(f)) {
      if (!v) continue;
      if (["estimated_acquisition_price","lot_size","current_sqft","current_assessed_value",
           "interim_monthly_revenue","interim_monthly_expenses","interim_occupancy_percent",
           "planned_sqft","construction_budget","hard_costs","soft_costs","contingency_percent",
           "stabilized_monthly_revenue","stabilized_monthly_expenses","stabilized_occupancy_percent",
           "stabilized_annual_noi","stabilized_cap_rate","stabilized_value",
           "assumed_ltv_percent","assumed_interest_rate","assumed_debt_amount"].includes(k)) {
        payload[k] = Number(v);
      } else if (["current_bedrooms","current_bathrooms","interim_hold_months","planned_units",
                   "planned_beds","construction_duration_months","assumed_amortization_months"].includes(k)) {
        payload[k] = parseInt(v);
      } else {
        payload[k] = v;
      }
    }
    if (tpForm.isEdit) {
      updateTargetProperty.mutate({ tpId: tpForm.editId!, lpId, data: payload }, { onSuccess: () => tpForm.setOpen(false) });
    } else {
      createTargetProperty.mutate({ lpId, data: payload }, { onSuccess: () => tpForm.setOpen(false) });
    }
  }

  /* ── loading / not found ─────────────────────────────────────── */
  if (lpLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!lp) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">LP not found.</p>
        {lpError && <p className="text-xs text-red-500 mt-1">{String((lpError as any)?.response?.data?.detail || lpError)}</p>}
        <Link href="/investment"><Button variant="ghost" className="mt-2"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button></Link>
      </div>
    );
  }

  const fundedPct = pct(lp.total_funded, lp.target_raise);
  const committedPct = pct(lp.total_committed, lp.target_raise);

  return (
    <div className="max-w-6xl space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div>
        <Link href="/investment" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Investment
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 flex-wrap">
              <Landmark className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              <span className="truncate">{lp.name}</span>
              {lp.lp_number && <span className="text-sm font-normal text-muted-foreground">{lp.lp_number}</span>}
            </h1>
            {lp.legal_name && <p className="text-sm text-muted-foreground mt-0.5 truncate">{lp.legal_name}</p>}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge variant={LP_STATUS_VARIANT[lp.status] ?? "outline"} className="text-xs">{statusLabel(lp.status)}</Badge>
            {canEdit && <Button variant="outline" size="sm" onClick={() => {
              lpForm.openEdit(lpId, {
                name: lp.name || "", legal_name: lp.legal_name || "", lp_number: lp.lp_number || "",
                city_focus: lp.city_focus || "", community_focus: lp.community_focus || "",
                purpose_type: lp.purpose_type || "", status: lp.status || "",
                unit_price: lp.unit_price || "", minimum_subscription: lp.minimum_subscription || "",
                target_raise: lp.target_raise || "", minimum_raise: lp.minimum_raise || "",
                maximum_raise: lp.maximum_raise || "",
                offering_date: lp.offering_date || "", closing_date: lp.closing_date || "",
                formation_costs: lp.formation_costs || "", offering_costs: lp.offering_costs || "",
                reserve_percent: lp.reserve_percent || "",
                preferred_return_rate: lp.preferred_return_rate || "",
                gp_promote_percent: lp.gp_promote_percent || "",
                gp_catchup_percent: lp.gp_catchup_percent || "",
                asset_management_fee_percent: lp.asset_management_fee_percent || "",
                acquisition_fee_percent: lp.acquisition_fee_percent || "",
                selling_commission_percent: lp.selling_commission_percent || "",
                construction_management_fee_percent: lp.construction_management_fee_percent || "",
                refinancing_fee_percent: lp.refinancing_fee_percent || "",
                turnover_replacement_fee_percent: lp.turnover_replacement_fee_percent || "",
                lp_profit_share_percent: lp.lp_profit_share_percent || "",
                gp_profit_share_percent: lp.gp_profit_share_percent || "",
                notes: lp.notes || "",
              });
            }}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit LP
            </Button>}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPI label="Target Raise" value={lp.target_raise ? formatCurrencyCompact(lp.target_raise) : "—"} icon={Target} />
        <KPI label="IOI Interest" value={ioiSummary?.total_ioi_expressed ? formatCurrencyCompact(String(ioiSummary.total_ioi_expressed)) : "$0"} sub={ioiSummary?.ioi_count ? `${ioiSummary.ioi_count} investors` : undefined} icon={FileText} />
        <KPI label="Committed" value={lp.total_committed ? formatCurrencyCompact(lp.total_committed) : "$0"} sub={`${committedPct.toFixed(0)}% of target`} icon={TrendingUp} />
        <KPI label="Funded" value={lp.total_funded ? formatCurrencyCompact(lp.total_funded) : "$0"} sub={`${fundedPct.toFixed(0)}% of target`} icon={DollarSign} />
        <KPI label="Investors" value={String(lp.investor_count ?? 0)} icon={Users} />
        <KPI label="Properties" value={String(lp.property_count ?? 0)} sub={`${lp.target_property_count ?? 0} pipeline`} icon={Building2} />
        <KPI label="Remaining" value={lp.remaining_capacity ? formatCurrencyCompact(lp.remaining_capacity) : "$0"} icon={Layers} />
      </div>

      {/* ── Funding Progress ──────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-2">
          {/* IOI → Committed → Funded progress */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Capital Pipeline</span>
            <span className="font-medium tabular-nums">
              {lp.total_funded ? formatCurrency(lp.total_funded) : "$0"} funded / {lp.target_raise ? formatCurrency(lp.target_raise) : "—"} target
            </span>
          </div>
          {(() => {
            const target = Number(lp.target_raise || 0);
            const ioiPct = target > 0 && ioiSummary?.total_ioi_expressed ? Math.min(Number(ioiSummary.total_ioi_expressed) / target * 100, 100) : 0;
            return (
              <>
                <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                  {/* IOI layer (lightest) */}
                  {ioiPct > 0 && (
                    <div className="absolute top-0 left-0 h-full bg-blue-200 rounded-full" style={{ width: `${ioiPct}%` }} />
                  )}
                  {/* Committed layer */}
                  {committedPct > 0 && (
                    <div className="absolute top-0 left-0 h-full bg-primary/40 rounded-full" style={{ width: `${Math.min(committedPct, 100)}%` }} />
                  )}
                  {/* Funded layer (darkest) */}
                  {fundedPct > 0 && (
                    <div className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: `${Math.min(fundedPct, 100)}%` }} />
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {ioiPct > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-200" /> IOI ({ioiPct.toFixed(0)}%)</span>}
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary/40" /> Committed ({committedPct.toFixed(0)}%)</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-primary" /> Funded ({fundedPct.toFixed(0)}%)</span>
                  <span className="ml-auto font-medium">Remaining: {lp.remaining_capacity ? formatCurrency(lp.remaining_capacity) : "$0"}</span>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="w-full sm:w-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="tranches" className="text-xs sm:text-sm">Tranches</TabsTrigger>
            <TabsTrigger value="subscriptions" className="text-xs sm:text-sm">Subscriptions</TabsTrigger>
            <TabsTrigger value="holdings" className="text-xs sm:text-sm">Holdings</TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs sm:text-sm">Pipeline</TabsTrigger>
            <TabsTrigger value="projections" className="text-xs sm:text-sm">Projections</TabsTrigger>
            <TabsTrigger value="pnl" className="text-xs sm:text-sm">P&L</TabsTrigger>
            <TabsTrigger value="nav" className="text-xs sm:text-sm">NAV</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview Tab ──────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            {/* Fund Details + Fee & Return Structure side by side on large screens */}
            <div className="grid gap-4 2xl:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Fund Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Purpose / Community" value={lp.community_focus} />
                  <DRow label="City Focus" value={lp.city_focus} />
                  <DRow label="Unit Price" value={lp.unit_price ? formatCurrency(lp.unit_price) : "—"} />
                  <DRow label="Min Subscription" value={lp.minimum_subscription ? formatCurrency(lp.minimum_subscription) : "—"} />
                  <DRow label="Min Raise" value={lp.minimum_raise ? formatCurrency(lp.minimum_raise) : "—"} />
                  <DRow label="Max Raise" value={lp.maximum_raise ? formatCurrency(lp.maximum_raise) : "—"} />
                  <DRow label="Offering Date" value={fmtDate(lp.offering_date)} />
                  <DRow label="Closing Date" value={fmtDate(lp.closing_date)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Percent className="h-4 w-4" /> Return Structure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Preferred Return" value={fmtPct(lp.preferred_return_rate)} />
                  <DRow label="GP Promote" value={fmtPct(lp.gp_promote_percent)} />
                  <DRow label="GP Catch-up" value={fmtPct(lp.gp_catchup_percent)} />
                  <DRow label="Reserve %" value={fmtPct(lp.reserve_percent)} />
                  <DRow label="Formation Costs" value={lp.formation_costs ? formatCurrency(lp.formation_costs) : "—"} />
                </CardContent>
              </Card>
            </div>

            {/* LP Fee Schedule — full structured display per Section 3 of LP Agreement */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> LP Fee Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Selling Commission */}
                  <div className="border rounded-lg p-3 bg-amber-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">Selling Commission</p>
                        <p className="text-xs text-muted-foreground">Rate: {fmtPct(lp.selling_commission_percent)} of Gross Capital Raise</p>
                        <p className="text-xs text-muted-foreground">Trigger: Upon capital raise / offering</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Calculated Amount</p>
                        <p className="text-sm font-semibold tabular-nums">{lp.gross_subscriptions && lp.selling_commission_percent ? formatCurrency(Number(lp.gross_subscriptions) * (Number(lp.selling_commission_percent) / 100)) : "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Offering / Setup Cost */}
                  <div className="border rounded-lg p-3 bg-amber-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">Offering / Setup Cost</p>
                        <p className="text-xs text-muted-foreground">Type: Fixed Amount</p>
                        <p className="text-xs text-muted-foreground">Trigger: Upon LP formation / offering</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-sm font-semibold tabular-nums">{lp.offering_costs ? formatCurrency(lp.offering_costs) : "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Acquisition / Closing Fee */}
                  <div className="border rounded-lg p-3 bg-blue-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">Acquisition / Closing Fee</p>
                        <p className="text-xs text-muted-foreground">Rate: {fmtPct(lp.acquisition_fee_percent)} of Acquisition Cost</p>
                        <p className="text-xs text-muted-foreground">Trigger: Upon acquisition / closing</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Calculated Amount</p>
                        <p className="text-sm font-semibold tabular-nums">Per property</p>
                      </div>
                    </div>
                  </div>

                  {/* Ongoing Management Fee */}
                  <div className="border rounded-lg p-3 bg-green-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">Ongoing Management Fee</p>
                        <p className="text-xs text-muted-foreground">Rate: {fmtPct(lp.asset_management_fee_percent)} of Gross Revenues</p>
                        <p className="text-xs text-muted-foreground">Trigger: Ongoing — interim and stabilized operations</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Calculated Amount</p>
                        <p className="text-sm font-semibold tabular-nums">See Projections</p>
                      </div>
                    </div>
                  </div>

                  {/* Construction Management Fee */}
                  <div className="border rounded-lg p-3 bg-purple-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">Construction Management Fee</p>
                        <p className="text-xs text-muted-foreground">Rate: {fmtPct(lp.construction_management_fee_percent)} of Construction Budget</p>
                        <p className="text-xs text-muted-foreground">Trigger: During redevelopment / construction</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Calculated Amount</p>
                        <p className="text-sm font-semibold tabular-nums">Per property plan</p>
                      </div>
                    </div>
                  </div>

                  {/* Refinancing Fee */}
                  <div className="border rounded-lg p-3 bg-red-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">Refinancing Fee</p>
                        <p className="text-xs text-muted-foreground">Rate: {fmtPct(lp.refinancing_fee_percent)} of Refinance Amount</p>
                        <p className="text-xs text-muted-foreground">Trigger: Upon refinancing event</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Calculated Amount</p>
                        <p className="text-sm font-semibold tabular-nums">If applicable</p>
                      </div>
                    </div>
                  </div>

                  {/* Turnover / Replacement Fee */}
                  <div className="border rounded-lg p-3 bg-orange-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">Turnover / Replacement Fee</p>
                        <p className="text-xs text-muted-foreground">Rate: {fmtPct(lp.turnover_replacement_fee_percent)} of Fair Market Value</p>
                        <p className="text-xs text-muted-foreground">Trigger: Upon property turnover / replacement</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Calculated Amount</p>
                        <p className="text-sm font-semibold tabular-nums">If applicable</p>
                      </div>
                    </div>
                  </div>

                  {/* Profit Sharing */}
                  <div className="border rounded-lg p-3 bg-indigo-50/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">Profit Sharing After Priority Return / Hurdle</p>
                        <p className="text-xs text-muted-foreground">LP Share: {lp.lp_profit_share_percent ?? 70}% / GP Share: {lp.gp_profit_share_percent ?? 30}%</p>
                        <p className="text-xs text-muted-foreground">Trigger: After preferred return / hurdle stage</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Applied to</p>
                        <p className="text-sm font-semibold tabular-nums">All distributions</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Capital Summary — full width, 2x3 grid */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Capital Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Gross Subscriptions</p>
                    <p className="text-sm font-semibold tabular-nums">{lp.gross_subscriptions ? formatCurrency(lp.gross_subscriptions) : "$0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Formation Costs</p>
                    <p className="text-sm font-semibold tabular-nums">{lp.total_formation_costs ? formatCurrency(lp.total_formation_costs) : "$0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reserve Allocations</p>
                    <p className="text-sm font-semibold tabular-nums">{lp.total_reserve_allocations ? formatCurrency(lp.total_reserve_allocations) : "$0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Deployable</p>
                    <p className="text-sm font-semibold tabular-nums">{lp.net_deployable_capital ? formatCurrency(lp.net_deployable_capital) : "$0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Capital Deployed</p>
                    <p className="text-sm font-semibold tabular-nums">{lp.capital_deployed ? formatCurrency(lp.capital_deployed) : "$0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Capital Available</p>
                    <p className="text-sm font-semibold tabular-nums text-green-600">{lp.capital_available ? formatCurrency(lp.capital_available) : "$0"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {lp.notes && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{lp.notes}</p></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Tranches Tab ──────────────────────────────────────── */}
        <TabsContent value="tranches" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Tranches / Closings</h3>
            {canEdit && <Button size="sm" onClick={trancheForm.openCreate}><Plus className="h-3.5 w-3.5 mr-1" /> Add Tranche</Button>}
          </div>
          {!tranches || tranches.length === 0 ? (
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No tranches defined yet.</p></CardContent></Card>
          ) : (
            <div className="space-y-4">
              {tranches.map((t) => {
                const tPct = pct(t.total_subscribed, t.target_amount);
                return (
                  <Card key={t.tranche_id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm">Tranche {t.tranche_number}{t.tranche_name && ` — ${t.tranche_name}`}</h3>
                          <p className="text-xs text-muted-foreground">{fmtDate(t.opening_date)} → {fmtDate(t.closing_date)} · Issue Price: {t.issue_price ? formatCurrency(t.issue_price) : "—"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={t.status === "open" ? "secondary" : t.status === "closed" ? "default" : "outline"}>{statusLabel(t.status)}</Badge>
                          {canEdit && <Button variant="ghost" size="sm" onClick={() => trancheForm.openEdit(t.tranche_id, {
                            tranche_number: String(t.tranche_number), tranche_name: t.tranche_name || "",
                            opening_date: t.opening_date || "", closing_date: t.closing_date || "",
                            status: t.status, issue_price: t.issue_price || "",
                            target_amount: t.target_amount || "", target_units: t.target_units || "",
                            notes: t.notes || "",
                          })}><Pencil className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Subscribed</span>
                          <span className="tabular-nums">{t.total_subscribed ? formatCurrency(t.total_subscribed) : "$0"} / {t.target_amount ? formatCurrency(t.target_amount) : "—"}</span>
                        </div>
                        <Progress value={tPct} className="h-2" />
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div><p className="text-xs text-muted-foreground">Subscriptions</p><p className="text-sm font-semibold">{t.subscriptions_count}</p></div>
                        <div><p className="text-xs text-muted-foreground">Funded</p><p className="text-sm font-semibold tabular-nums">{t.total_funded ? formatCurrencyCompact(t.total_funded) : "$0"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Units</p><p className="text-sm font-semibold tabular-nums">{t.total_units ? fmtNum(t.total_units) : "0"}</p></div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Subscriptions Tab ─────────────────────────────────── */}
        <TabsContent value="subscriptions" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Subscriptions</h3>
            {canEdit && <Button size="sm" onClick={subForm.openCreate}><Plus className="h-3.5 w-3.5 mr-1" /> Add Subscription</Button>}
          </div>
          <Card>
            <CardContent className="pt-4">
              {!subscriptions || subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Investor</TableHead>
                        <TableHead>Tranche</TableHead>
                        <TableHead className="text-right">Commitment</TableHead>
                        <TableHead className="text-right">Funded</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(subscriptions || []).map((s: any) => {
                        // Compute effective status based on compliance + payment
                        const complianceOk = s?.compliance_approved === true;
                        const fullyFunded = Number(s?.funded_amount || 0) >= Number(s?.commitment_amount || 0) && Number(s?.funded_amount || 0) > 0;
                        const rawStatus = s?.status || "draft";
                        let effectiveStatus = rawStatus;
                        if (["accepted", "funded", "issued"].includes(rawStatus)) {
                          if (!complianceOk) effectiveStatus = "pending_compliance";
                          else if (!fullyFunded) effectiveStatus = "pending_payment";
                          else if (rawStatus === "issued" && complianceOk && fullyFunded) effectiveStatus = "issued";
                        }
                        const effectiveLabel = effectiveStatus === "pending_compliance" ? "Pending Compliance"
                          : effectiveStatus === "pending_payment" ? "Pending Payment"
                          : statusLabel(effectiveStatus);
                        const effectiveVariant = effectiveStatus.startsWith("pending_") ? "secondary" as const : (SUB_STATUS_VARIANT[effectiveStatus] ?? "outline") as "default" | "secondary" | "outline" | "destructive";
                        const effectiveColor = effectiveStatus.startsWith("pending_") ? "bg-amber-100 text-amber-700" : "";

                        return (
                        <TableRow key={s.subscription_id}>
                          <TableCell className="font-medium text-sm">{s.investor_name ?? `#${s.investor_id}`}</TableCell>
                          <TableCell className="text-sm">{s.tranche_name ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatCurrency(s.commitment_amount)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatCurrency(s.funded_amount)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{s.unit_quantity ? fmtNum(s.unit_quantity) : "—"}</TableCell>
                          <TableCell><Badge variant={effectiveVariant} className={`text-xs ${effectiveColor}`}>{effectiveLabel}</Badge></TableCell>
                          <TableCell className="text-sm">{fmtDate(s.submitted_date)}</TableCell>
                          <TableCell>
                            {canEdit && <Button variant="ghost" size="sm" onClick={() => subForm.openEdit(s.subscription_id, {
                              investor_id: String(s.investor_id), tranche_id: s.tranche_id ? String(s.tranche_id) : "",
                              commitment_amount: s.commitment_amount, funded_amount: s.funded_amount,
                              issue_price: s.issue_price || "", unit_quantity: s.unit_quantity || "",
                              status: s.status, submitted_date: s.submitted_date || "", notes: s.notes || "",
                            })}><Pencil className="h-3.5 w-3.5" /></Button>}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Holdings Tab ──────────────────────────────────────── */}
        <TabsContent value="holdings" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Unit-Based Holdings</h3>
            {user?.role === "DEVELOPER" && <Button size="sm" variant="outline" onClick={holdingForm.openCreate}><Plus className="h-3.5 w-3.5 mr-1" /> Add Holding</Button>}
            <p className="text-[10px] text-muted-foreground">Holdings are created automatically when subscriptions are issued</p>
          </div>

          {/* Unit Summary KPIs */}
          {holdings && holdings.length > 0 && (() => {
            const totalUnits = holdings.reduce((s: any, h: any) => s + Number(h.units_held || 0), 0);
            const totalCost = holdings.reduce((s: any, h: any) => s + Number(h.cost_basis || 0), 0);
            const totalUnreturned = holdings.reduce((s: any, h: any) => s + Number(h.unreturned_capital || 0), 0);
            const authorized = Number(lp?.total_units_authorized || 0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPI label="Total Units Outstanding" value={fmtNum(totalUnits)} sub={authorized ? `of ${fmtNum(authorized)} authorized` : undefined} icon={Hash} />
                <KPI label="Total Cost Basis" value={formatCurrencyCompact(String(totalCost))} icon={DollarSign} />
                <KPI label="Total Unreturned Capital" value={formatCurrencyCompact(String(totalUnreturned))} icon={TrendingUp} />
                <KPI label="Unit Price" value={lp?.unit_price ? formatCurrency(lp.unit_price) : "—"} sub="per LP unit" icon={Landmark} />
              </div>
            );
          })()}

          <Card>
            <CardContent className="pt-4">
              {!holdings || holdings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No holdings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Investor</TableHead>
                        <TableHead className="text-right">Units Held</TableHead>
                        <TableHead className="text-right">Avg Issue Price</TableHead>
                        <TableHead className="text-right">Ownership %</TableHead>
                        <TableHead className="text-right">Cost Basis</TableHead>
                        <TableHead className="text-right">Unreturned Capital</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((h: any) => (
                        <TableRow key={h.holding_id}>
                          <TableCell className="font-medium text-sm">{h.investor_name ?? `#${h.investor_id}`}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-semibold">{fmtNum(h.units_held)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatCurrency(h.average_issue_price)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{fmtPct(h.ownership_percent)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatCurrency(h.cost_basis)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatCurrency(h.unreturned_capital)}</TableCell>
                          <TableCell><Badge variant={h.is_gp ? "secondary" : "outline"} className="text-xs">{h.is_gp ? "GP" : "LP"}</Badge></TableCell>
                          <TableCell className="text-sm">{fmtDate(h.initial_issue_date)}</TableCell>
                          <TableCell>
                            {canEdit && <Button variant="ghost" size="sm" onClick={() => holdingForm.openEdit(h.holding_id, {
                              investor_id: String(h.investor_id), subscription_id: h.subscription_id ? String(h.subscription_id) : "",
                              units_held: h.units_held || "", average_issue_price: h.average_issue_price || "",
                              total_capital_contributed: h.total_capital_contributed || "",
                              initial_issue_date: h.initial_issue_date || "",
                              ownership_percent: h.ownership_percent, cost_basis: h.cost_basis,
                              unreturned_capital: h.unreturned_capital, unpaid_preferred: h.unpaid_preferred,
                              is_gp: String(h.is_gp),
                            })}><Pencil className="h-3.5 w-3.5" /></Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell className="text-sm">Total</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{fmtNum(holdings.reduce((s: any, h: any) => s + Number(h.units_held || 0), 0))}</TableCell>
                        <TableCell className="text-right text-sm">—</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{fmtPct(String(holdings.reduce((s: any, h: any) => s + Number(h.ownership_percent || 0), 0).toFixed(4)))}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{formatCurrency(String(holdings.reduce((s: any, h: any) => s + Number(h.cost_basis || 0), 0)))}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{formatCurrency(String(holdings.reduce((s: any, h: any) => s + Number(h.unreturned_capital || 0), 0)))}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-2 italic">Ownership % and Cost Basis are computed dynamically from units held. Units are the primary equity tracking method.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pipeline (Target Properties) Tab ──────────────────── */}
        <TabsContent value="pipeline" className="mt-4 space-y-6">
          {/* ── Owned Properties ── */}
          <OwnedPropertiesSection lpId={lpId} />

          {/* ── Target Properties ── */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Target Properties (Pipeline)</h3>
            {canEdit && <Button size="sm" onClick={tpForm.openCreate}><Plus className="h-3.5 w-3.5 mr-1" /> Add Target Property</Button>}
          </div>
          {!targetProperties || targetProperties.length === 0 ? (
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No target properties in the pipeline.</p></CardContent></Card>
          ) : (
            targetProperties.map((tp) => (
              <Card key={tp.target_property_id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />{tp.address}{tp.city && `, ${tp.city}`}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{tp.intended_community ?? "—"} · Zoning: {tp.zoning ?? "—"} · Lot: {tp.lot_size ? `${fmtNum(tp.lot_size)} sqft` : "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      <Badge variant={TP_STATUS_VARIANT[tp.status] ?? "outline"} className="text-xs">{statusLabel(tp.status)}</Badge>
                      {canEdit && <Button variant="ghost" size="sm" onClick={() => tpForm.openEdit(tp.target_property_id, {
                        address: tp.address || "", city: tp.city || "", province: tp.province || "AB",
                        intended_community: tp.intended_community || "", status: tp.status,
                        estimated_acquisition_price: tp.estimated_acquisition_price || "",
                        lot_size: tp.lot_size || "", zoning: tp.zoning || "",
                        current_sqft: tp.current_sqft || "", current_bedrooms: tp.current_bedrooms != null ? String(tp.current_bedrooms) : "",
                        current_bathrooms: tp.current_bathrooms != null ? String(tp.current_bathrooms) : "",
                        current_condition: tp.current_condition || "", current_assessed_value: tp.current_assessed_value || "",
                        interim_monthly_revenue: tp.interim_monthly_revenue || "",
                        interim_monthly_expenses: tp.interim_monthly_expenses || "",
                        interim_occupancy_percent: tp.interim_occupancy_percent || "",
                        interim_hold_months: tp.interim_hold_months != null ? String(tp.interim_hold_months) : "",
                        planned_units: tp.planned_units != null ? String(tp.planned_units) : "",
                        planned_beds: tp.planned_beds != null ? String(tp.planned_beds) : "",
                        planned_sqft: tp.planned_sqft || "",
                        construction_budget: tp.construction_budget || "", hard_costs: tp.hard_costs || "",
                        soft_costs: tp.soft_costs || "", contingency_percent: tp.contingency_percent || "",
                        construction_duration_months: tp.construction_duration_months != null ? String(tp.construction_duration_months) : "",
                        stabilized_monthly_revenue: tp.stabilized_monthly_revenue || "",
                        stabilized_monthly_expenses: tp.stabilized_monthly_expenses || "",
                        stabilized_occupancy_percent: tp.stabilized_occupancy_percent || "",
                        stabilized_annual_noi: tp.stabilized_annual_noi || "",
                        stabilized_cap_rate: tp.stabilized_cap_rate || "", stabilized_value: tp.stabilized_value || "",
                        assumed_ltv_percent: tp.assumed_ltv_percent || "", assumed_interest_rate: tp.assumed_interest_rate || "",
                        assumed_amortization_months: tp.assumed_amortization_months != null ? String(tp.assumed_amortization_months) : "",
                        assumed_debt_amount: tp.assumed_debt_amount || "",
                        target_acquisition_date: tp.target_acquisition_date || "",
                        target_completion_date: tp.target_completion_date || "",
                        target_stabilization_date: tp.target_stabilization_date || "",
                        notes: tp.notes || "",
                      })}><Pencil className="h-3.5 w-3.5" /></Button>}
                      {canEdit && !tp.converted_property_id && tp.status !== "acquired" && (
                        <Button variant="outline" size="sm" onClick={() => {
                          if (confirm(`Convert "${tp.address}" to an actual property? This will create a new property record.`)) {
                            convertTargetProperty.mutate({ tpId: tp.target_property_id, lpId });
                          }
                        }}>
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Convert
                        </Button>
                      )}
                      {tp.converted_property_id && (
                        <Badge variant="default" className="text-xs">Converted → #{tp.converted_property_id}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Est. Acquisition</p><p className="font-semibold tabular-nums">{tp.estimated_acquisition_price ? formatCurrencyCompact(tp.estimated_acquisition_price) : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Construction Budget</p><p className="font-semibold tabular-nums">{tp.construction_budget ? formatCurrencyCompact(tp.construction_budget) : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Planned Units / Beds</p><p className="font-semibold">{tp.planned_units ?? "—"} / {tp.planned_beds ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Planned Sqft</p><p className="font-semibold tabular-nums">{tp.planned_sqft ? fmtNum(tp.planned_sqft) : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Interim Revenue/mo</p><p className="font-semibold tabular-nums">{tp.interim_monthly_revenue ? formatCurrency(tp.interim_monthly_revenue) : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Interim Hold</p><p className="font-semibold">{tp.interim_hold_months ? `${tp.interim_hold_months} months` : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Estimated Stabilized NOI</p><p className="font-semibold tabular-nums">{tp.stabilized_annual_noi ? formatCurrencyCompact(tp.stabilized_annual_noi) : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Estimated Stabilized Value</p><p className="font-semibold tabular-nums">{tp.stabilized_value ? formatCurrencyCompact(tp.stabilized_value) : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Assumed Debt</p><p className="font-semibold tabular-nums">{tp.assumed_debt_amount ? formatCurrencyCompact(tp.assumed_debt_amount) : "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">LTV / Rate</p><p className="font-semibold">{fmtPct(tp.assumed_ltv_percent)} / {fmtPct(tp.assumed_interest_rate)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Target Acquisition</p><p className="font-semibold">{fmtDate(tp.target_acquisition_date)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Target Stabilization</p><p className="font-semibold">{fmtDate(tp.target_stabilization_date)}</p></div>
                  </div>
                  {tp.notes && <p className="text-xs text-muted-foreground mt-3 italic">{tp.notes}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Projections Tab ───────────────────────────────────── */}
        <TabsContent value="projections" className="mt-4">
          {!rollup ? (
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No projection data available.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Projected Target Portfolio <Badge variant="outline" className="text-[10px] ml-1">ESTIMATED</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Pipeline Properties" value={rollup.target_property_count} />
                  <DRow label="Total Est. Acquisition Cost" value={formatCurrency(rollup.total_target_acquisition_cost)} />
                  <DRow label="Total Est. Construction Budget" value={formatCurrency(rollup.total_target_construction_budget)} />
                  <DRow label="Total Est. All-in Cost" value={formatCurrency(rollup.total_target_all_in_cost)} />
                  <DRow label="Planned Units" value={rollup.total_planned_units} />
                  <DRow label="Planned Beds" value={rollup.total_planned_beds} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Projected Returns <Badge variant="outline" className="text-[10px] ml-1">ESTIMATED</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Projected Stabilized NOI" value={rollup.total_target_stabilized_noi ? formatCurrency(rollup.total_target_stabilized_noi) : "—"} />
                  <DRow label="Projected Stabilized Value" value={rollup.total_target_stabilized_value ? formatCurrency(rollup.total_target_stabilized_value) : "—"} />
                  <DRow label="Projected Total Debt" value={rollup.total_target_debt ? formatCurrency(rollup.total_target_debt) : "—"} />
                  <DRow label="Projected Equity Required" value={rollup.total_target_equity_required ? formatCurrency(rollup.total_target_equity_required) : "—"} />
                  <DRow label="Projected LP Equity Value" value={rollup.projected_lp_equity_value ? formatCurrency(rollup.projected_lp_equity_value) : "—"} />
                  <DRow label="Projected Equity Multiple" value={rollup.projected_equity_multiple ? `${Number(rollup.projected_equity_multiple).toFixed(2)}x` : "—"} />
                  <DRow label="Projected Cash-on-Cash" value={rollup.projected_cash_on_cash ? `${Number(rollup.projected_cash_on_cash).toFixed(1)}%` : "—"} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Actual Portfolio <Badge variant="default" className="text-[10px] ml-1">ACTUAL</Badge></CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-muted-foreground">Properties Owned</p><p className="text-lg font-bold">{rollup.actual_property_count}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total Purchase Price</p><p className="text-lg font-bold tabular-nums">{rollup.total_actual_purchase_price ? formatCurrencyCompact(rollup.total_actual_purchase_price) : "$0"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Current Market Value</p><p className="text-lg font-bold tabular-nums">{rollup.total_actual_market_value ? formatCurrencyCompact(rollup.total_actual_market_value) : "$0"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Projected Portfolio Value</p><p className="text-lg font-bold tabular-nums">{rollup.projected_portfolio_value ? formatCurrencyCompact(rollup.projected_portfolio_value) : "—"}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Combined Expected Portfolio <Badge variant="outline" className="text-[10px] ml-1">BLENDED</Badge></CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-muted-foreground">Total Properties (Actual + Pipeline)</p><p className="text-lg font-bold">{rollup.actual_property_count + rollup.target_property_count}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total Planned Units</p><p className="text-lg font-bold">{rollup.total_planned_units}</p></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Combined Portfolio Value</p>
                      <p className="text-lg font-bold tabular-nums">
                        {formatCurrencyCompact(String(Number(rollup.total_actual_market_value || 0) + Number(rollup.total_target_stabilized_value || 0)))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Combined Annual NOI</p>
                      <p className="text-lg font-bold tabular-nums">
                        {rollup.total_target_stabilized_noi ? formatCurrencyCompact(rollup.total_target_stabilized_noi) : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Waterfall Simulator */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Distribution Waterfall Simulator
                    <Badge variant="outline" className="text-[10px] ml-1">EUROPEAN STYLE</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Enter a hypothetical distributable amount to see how it flows through the 4-tier waterfall: Return of Capital → Preferred Return → GP Catch-up → Carried Interest.</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3 mb-4">
                    <div className="flex-1 max-w-xs">
                      <Label className="text-xs mb-1">Distributable Amount ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g. 500000"
                        value={waterfallAmount}
                        onChange={(e) => setWaterfallAmount(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleRunWaterfall} disabled={computeWaterfall.isPending || !waterfallAmount}>
                      {computeWaterfall.isPending ? "Computing..." : "Run Waterfall"}
                    </Button>
                  </div>

                  {waterfallResult && (() => {
                    const da = waterfallResult.distributable_amount;
                    const tierData = [
                      { key: 1, label: "Return of Capital", amount: waterfallResult.tier1_total },
                      { key: 2, label: "Preferred Return", amount: waterfallResult.tier2_total },
                      { key: 3, label: "GP Catch-up", amount: waterfallResult.tier3_total },
                      { key: 4, label: "Carried Interest", amount: waterfallResult.tier4_total },
                    ];
                    const totalUnitsAll = waterfallResult.allocations.reduce((s, a) => s + a.units_held, 0);
                    return (
                    <div className="space-y-4">
                      {/* Tier Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {tierData.map((tier) => (
                          <div key={tier.key} className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">{tier.label}</p>
                            <p className="text-lg font-bold tabular-nums">{formatCurrencyCompact(String(tier.amount))}</p>
                            <p className="text-xs text-muted-foreground">{da > 0 ? (tier.amount / da * 100).toFixed(1) : "0.0"}% of total</p>
                          </div>
                        ))}
                      </div>

                      {/* Per-Holding Allocations */}
                      {waterfallResult.allocations.length > 0 && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Investor</TableHead>
                                <TableHead className="text-right">Units</TableHead>
                                <TableHead className="text-right">Ownership</TableHead>
                                <TableHead className="text-right">Return of Capital</TableHead>
                                <TableHead className="text-right">Preferred Return</TableHead>
                                <TableHead className="text-right">GP Catch-up</TableHead>
                                <TableHead className="text-right">Carry Split</TableHead>
                                <TableHead className="text-right font-semibold">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {waterfallResult.allocations.map((a) => (
                                <TableRow key={a.holding_id}>
                                  <TableCell className="text-sm font-medium">{a.investor_name}</TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">{fmtNum(a.units_held)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">{totalUnitsAll > 0 ? ((a.units_held / totalUnitsAll) * 100).toFixed(1) : "0.0"}%</TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">{formatCurrency(String(a.tier1_roc))}</TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">{formatCurrency(String(a.tier2_preferred))}</TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">{formatCurrency(String(a.tier3_catchup))}</TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">{formatCurrency(String(a.tier4_carry))}</TableCell>
                                  <TableCell className="text-right tabular-nums text-sm font-semibold">{formatCurrency(String(a.total))}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground italic">
                        Waterfall: European style (whole-fund). LPs receive all capital back + {lp?.preferred_return_rate ?? "8"}% preferred return before GP carry of {lp?.gp_promote_percent ?? "20"}%.
                      </p>
                    </div>
                  );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── P&L Tab ──────────────────────────────────────────── */}
        <TabsContent value="pnl" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <Label className="text-sm">Year:</Label>
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={pnlYear}
              onChange={(e) => setPnlYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {pnlLoading ? (
            <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
          ) : !pnlData ? (
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No P&L data available.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Revenue Summary</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Total Billed" value={formatCurrency(pnlData.revenue?.total_billed)} />
                  <DRow label="Collected" value={formatCurrency(pnlData.revenue?.collected)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Expense Summary</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Total Expenses" value={formatCurrency(pnlData.expenses?.total_expenses)} />
                  <DRow label="Expense Ratio" value={pnlData.summary?.expense_ratio ? `${Number(pnlData.summary.expense_ratio).toFixed(1)}%` : "—"} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Landmark className="h-4 w-4" /> Debt Service & Fees</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Annual Debt Service" value={formatCurrency(pnlData.debt_service?.annual_debt_service)} />
                  <DRow label="Annual Mgmt Fee" value={formatCurrency(pnlData.management_fees?.annual_fee)} />
                  <DRow label="Mgmt Fee Rate" value={pnlData.management_fees?.fee_percent ? `${Number(pnlData.management_fees.fee_percent).toFixed(1)}%` : "—"} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Bottom Line</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="NOI" value={formatCurrency(pnlData.summary?.noi)} />
                  <DRow label="Cash Flow After Debt" value={formatCurrency(pnlData.summary?.cash_flow_after_debt)} />
                  <DRow label="Cash Flow After Fees" value={formatCurrency(pnlData.summary?.cash_flow_after_fees)} />
                </CardContent>
              </Card>
              {pnlData.communities?.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Community Breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Community</TableHead>
                            <TableHead className="text-right">LP Properties</TableHead>
                            <TableHead className="text-right">LP Share</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Expenses</TableHead>
                            <TableHead className="text-right">NOI</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pnlData.communities.map((c: any) => (
                            <TableRow key={c.community_id}>
                              <TableCell className="text-sm font-medium">{c.community_name}</TableCell>
                              <TableCell className="text-right text-sm">{c.lp_property_count}/{c.total_property_count}</TableCell>
                              <TableCell className="text-right text-sm">{Number(c.lp_share_percent).toFixed(0)}%</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{formatCurrency(c.revenue_collected)}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{formatCurrency(c.expenses)}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm font-medium">{formatCurrency(c.noi)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── NAV Tab ──────────────────────────────────────────── */}
        <TabsContent value="nav" className="mt-4">
          {navLoading ? (
            <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
          ) : !navData ? (
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No NAV data available.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Landmark className="h-4 w-4" /> Net Asset Value</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Fund NAV</p>
                      <p className="text-2xl font-bold tabular-nums">{formatCurrencyCompact(navData.nav)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">NAV per Unit</p>
                      <p className="text-2xl font-bold tabular-nums">{formatCurrency(navData.nav_per_unit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Original Unit Price</p>
                      <p className="text-2xl font-bold tabular-nums">{formatCurrency(navData.original_unit_price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Premium / Discount</p>
                      <p className={`text-2xl font-bold tabular-nums ${Number(navData.nav_premium_discount_percent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(navData.nav_premium_discount_percent) >= 0 ? '+' : ''}{Number(navData.nav_premium_discount_percent).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> NAV Components</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Total Property Value" value={formatCurrency(navData.components?.total_property_value)} />
                  <DRow label="Cash & Reserves" value={formatCurrency(navData.components?.cash_and_reserves)} />
                  <DRow label="Outstanding Debt" value={`(${formatCurrency(navData.components?.total_outstanding_debt)})`} />
                  <DRow label="Accrued Mgmt Fees" value={`(${formatCurrency(navData.components?.accrued_management_fees)})`} />
                  <div className="flex justify-between py-1.5 border-t-2 border-border mt-1">
                    <span className="text-sm font-semibold">Net Asset Value</span>
                    <span className="text-sm font-bold">{formatCurrency(navData.nav)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Hash className="h-4 w-4" /> Unit Summary</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <DRow label="Units Outstanding" value={fmtNum(navData.total_units_outstanding)} />
                  <DRow label="NAV per Unit" value={formatCurrency(navData.nav_per_unit)} />
                  <DRow label="Original Unit Price" value={formatCurrency(navData.original_unit_price)} />
                  <DRow label="Premium/Discount" value={`${Number(navData.nav_premium_discount_percent) >= 0 ? '+' : ''}${Number(navData.nav_premium_discount_percent).toFixed(1)}%`} />
                </CardContent>
              </Card>
              {navData.properties?.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Property Valuations</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Property</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {navData.properties.map((p: any) => (
                            <TableRow key={p.property_id}>
                              <TableCell className="text-sm font-medium">{p.address}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{formatCurrency(p.value)}</TableCell>
                              <TableCell className="text-sm">
                                <Badge variant="outline" className="text-[10px]">{p.value_source?.replace(/_/g, ' ').toUpperCase()}</Badge>
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
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================= */}
      {/*  DIALOGS                                                          */}
      {/* ================================================================= */}

      {/* ── Edit LP Dialog ──────────────────────────────────────── */}
      <Dialog open={lpForm.open} onOpenChange={lpForm.setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit LP Fund</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fund Name" className="col-span-2"><Input required value={lpForm.form.name} onChange={(e) => lpForm.set("name", e.target.value)} /></Field>
            <Field label="Legal Name"><Input value={lpForm.form.legal_name} onChange={(e) => lpForm.set("legal_name", e.target.value)} /></Field>
            <Field label="LP Number"><Input value={lpForm.form.lp_number} onChange={(e) => lpForm.set("lp_number", e.target.value)} /></Field>
            <Field label="City Focus"><Input value={lpForm.form.city_focus} onChange={(e) => lpForm.set("city_focus", e.target.value)} /></Field>
            <Field label="Community Focus"><Input value={lpForm.form.community_focus} onChange={(e) => lpForm.set("community_focus", e.target.value)} /></Field>
            <Field label="Status">
              <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={lpForm.form.status} onChange={(e) => lpForm.set("status", e.target.value)}>
                {["draft","under_review","approved","open_for_subscription","partially_funded","tranche_closed","fully_funded","operating","winding_down","dissolved"].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </Field>
            <Field label="Unit Price"><Input type="number" min={0} step="0.01" value={lpForm.form.unit_price} onChange={(e) => lpForm.set("unit_price", e.target.value)} /></Field>
            <Field label="Min Subscription"><Input type="number" min={0} step="0.01" value={lpForm.form.minimum_subscription} onChange={(e) => lpForm.set("minimum_subscription", e.target.value)} /></Field>
            <Field label="Target Raise"><Input type="number" min={0} step="0.01" value={lpForm.form.target_raise} onChange={(e) => lpForm.set("target_raise", e.target.value)} /></Field>
            <Field label="Min Raise"><Input type="number" min={0} step="0.01" value={lpForm.form.minimum_raise} onChange={(e) => lpForm.set("minimum_raise", e.target.value)} /></Field>
            <Field label="Max Raise"><Input type="number" min={0} step="0.01" value={lpForm.form.maximum_raise} onChange={(e) => lpForm.set("maximum_raise", e.target.value)} /></Field>
            <Field label="Offering Date"><Input type="date" value={lpForm.form.offering_date} onChange={(e) => lpForm.set("offering_date", e.target.value)} /></Field>
            <Field label="Closing Date"><Input type="date" value={lpForm.form.closing_date} onChange={(e) => lpForm.set("closing_date", e.target.value)} /></Field>
            <Field label="Formation Costs"><Input type="number" min={0} step="0.01" value={lpForm.form.formation_costs} onChange={(e) => lpForm.set("formation_costs", e.target.value)} /></Field>
            <Field label="Offering Costs"><Input type="number" min={0} step="0.01" value={lpForm.form.offering_costs} onChange={(e) => lpForm.set("offering_costs", e.target.value)} /></Field>
            <Field label="Reserve %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.reserve_percent} onChange={(e) => lpForm.set("reserve_percent", e.target.value)} /></Field>
            <Field label="Preferred Return %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.preferred_return_rate} onChange={(e) => lpForm.set("preferred_return_rate", e.target.value)} /></Field>
            <Field label="GP Promote %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.gp_promote_percent} onChange={(e) => lpForm.set("gp_promote_percent", e.target.value)} /></Field>
            <Field label="GP Catch-up %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.gp_catchup_percent} onChange={(e) => lpForm.set("gp_catchup_percent", e.target.value)} /></Field>
            <Field label="Asset Mgmt Fee %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.asset_management_fee_percent} onChange={(e) => lpForm.set("asset_management_fee_percent", e.target.value)} /></Field>
            <Field label="Acquisition Fee %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.acquisition_fee_percent} onChange={(e) => lpForm.set("acquisition_fee_percent", e.target.value)} /></Field>
            <Field label="Selling Commission %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.selling_commission_percent} onChange={(e) => lpForm.set("selling_commission_percent", e.target.value)} /></Field>
            <Field label="Construction Mgmt Fee %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.construction_management_fee_percent} onChange={(e) => lpForm.set("construction_management_fee_percent", e.target.value)} /></Field>
            <Field label="Refinancing Fee %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.refinancing_fee_percent} onChange={(e) => lpForm.set("refinancing_fee_percent", e.target.value)} /></Field>
            <Field label="Turnover Fee %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.turnover_replacement_fee_percent} onChange={(e) => lpForm.set("turnover_replacement_fee_percent", e.target.value)} /></Field>
            <Field label="LP Profit Share %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.lp_profit_share_percent} onChange={(e) => lpForm.set("lp_profit_share_percent", e.target.value)} /></Field>
            <Field label="GP Profit Share %"><Input type="number" min={0} max={100} step="0.01" value={lpForm.form.gp_profit_share_percent} onChange={(e) => lpForm.set("gp_profit_share_percent", e.target.value)} /></Field>
            <Field label="Notes" className="col-span-2"><textarea className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm min-h-[60px]" value={lpForm.form.notes} onChange={(e) => lpForm.set("notes", e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleLPSave} disabled={updateLP.isPending}>{updateLP.isPending ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tranche Dialog ──────────────────────────────────────── */}
      <Dialog open={trancheForm.open} onOpenChange={trancheForm.setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{trancheForm.isEdit ? "Edit Tranche" : "Add Tranche"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tranche #"><Input type="number" value={trancheForm.form.tranche_number} onChange={(e) => trancheForm.set("tranche_number", e.target.value)} /></Field>
            <Field label="Name"><Input value={trancheForm.form.tranche_name} onChange={(e) => trancheForm.set("tranche_name", e.target.value)} /></Field>
            <Field label="Opening Date"><Input type="date" value={trancheForm.form.opening_date} onChange={(e) => trancheForm.set("opening_date", e.target.value)} /></Field>
            <Field label="Closing Date"><Input type="date" value={trancheForm.form.closing_date} onChange={(e) => trancheForm.set("closing_date", e.target.value)} /></Field>
            <Field label="Status">
              <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={trancheForm.form.status} onChange={(e) => trancheForm.set("status", e.target.value)}>
                {["draft","open","closed","cancelled"].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </Field>
            <Field label="Issue Price"><Input type="number" min={0} step="0.01" value={trancheForm.form.issue_price} onChange={(e) => trancheForm.set("issue_price", e.target.value)} /></Field>
            <Field label="Target Amount"><Input type="number" min={0} step="0.01" value={trancheForm.form.target_amount} onChange={(e) => trancheForm.set("target_amount", e.target.value)} /></Field>
            <Field label="Target Units"><Input type="number" min={0} value={trancheForm.form.target_units} onChange={(e) => trancheForm.set("target_units", e.target.value)} /></Field>
            <Field label="Notes" className="col-span-2"><textarea className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm min-h-[60px]" value={trancheForm.form.notes} onChange={(e) => trancheForm.set("notes", e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleTrancheSave} disabled={createTranche.isPending || updateTranche.isPending}>
              {(createTranche.isPending || updateTranche.isPending) ? "Saving..." : trancheForm.isEdit ? "Save Changes" : "Create Tranche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Subscription Dialog ─────────────────────────────────── */}
      <Dialog open={subForm.open} onOpenChange={subForm.setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{subForm.isEdit ? "Edit Subscription" : "Add Subscription"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Investor *" className="col-span-2">
              <select required className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={subForm.form.investor_id} onChange={(e) => subForm.set("investor_id", e.target.value)}>
                <option value="">Select investor...</option>
                {investors?.map(inv => <option key={inv.investor_id} value={inv.investor_id}>{inv.name}</option>)}
              </select>
            </Field>
            <Field label="Tranche *">
              <select required className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={subForm.form.tranche_id} onChange={(e) => subForm.set("tranche_id", e.target.value)}>
                <option value="">Select tranche...</option>
                {tranches?.filter(t => t.status === "open" || subForm.isEdit).map(t => (
                  <option key={t.tranche_id} value={t.tranche_id}>
                    Tranche {t.tranche_number}{t.tranche_name ? ` — ${t.tranche_name}` : ""} ({t.status})
                  </option>
                ))}
              </select>
            </Field>
            {subForm.isEdit && (
              <Field label="Status">
                <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={subForm.form.status} onChange={(e) => subForm.set("status", e.target.value)}>
                  {["draft","submitted","under_review","accepted","funded","issued","closed","rejected","withdrawn"].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </Field>
            )}
            <Field label="Commitment Amount *"><Input required type="number" min={0} step="0.01" value={subForm.form.commitment_amount} onChange={(e) => subForm.set("commitment_amount", e.target.value)} placeholder={lp?.minimum_subscription ? `Min $${Number(lp.minimum_subscription).toLocaleString()}` : "0.00"} /></Field>
            <Field label="Issue Price *"><Input required type="number" min={0} step="0.01" value={subForm.form.issue_price} onChange={(e) => subForm.set("issue_price", e.target.value)} placeholder={lp?.unit_price ? String(lp.unit_price) : "0.00"} /></Field>
            <Field label="Unit Quantity">
              <Input type="number" min={0} step="0.0001" value={subForm.form.unit_quantity} onChange={(e) => subForm.set("unit_quantity", e.target.value)} placeholder="Auto-calculated if blank" />
              <p className="text-[9px] text-muted-foreground mt-0.5">Commitment ÷ Issue Price = Units</p>
            </Field>
            {subForm.isEdit && (
              <Field label="Funded Amount"><Input type="number" min={0} step="0.01" value={subForm.form.funded_amount} onChange={(e) => subForm.set("funded_amount", e.target.value)} /></Field>
            )}
            <Field label="Notes" className="col-span-2"><textarea className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm min-h-[60px]" value={subForm.form.notes} onChange={(e) => subForm.set("notes", e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleSubSave} disabled={createSubscription.isPending || updateSubscription.isPending}>
              {(createSubscription.isPending || updateSubscription.isPending) ? "Saving..." : subForm.isEdit ? "Save Changes" : "Create Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Holding Dialog ──────────────────────────────────────── */}
      <Dialog open={holdingForm.open} onOpenChange={holdingForm.setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{holdingForm.isEdit ? "Edit Holding" : "Add Holding"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Investor" className="col-span-2">
              <select required className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={holdingForm.form.investor_id} onChange={(e) => holdingForm.set("investor_id", e.target.value)}>
                <option value="">Select investor...</option>
                {investors?.map(inv => <option key={inv.investor_id} value={inv.investor_id}>{inv.name}</option>)}
              </select>
            </Field>
            <Field label="Units Held"><Input type="number" min={0} value={holdingForm.form.units_held} onChange={(e) => holdingForm.set("units_held", e.target.value)} /></Field>
            <Field label="Avg Issue Price"><Input type="number" min={0} step="0.01" value={holdingForm.form.average_issue_price} onChange={(e) => holdingForm.set("average_issue_price", e.target.value)} /></Field>
            <Field label="Ownership %"><Input type="number" min={0} max={100} step="0.01" value={holdingForm.form.ownership_percent} onChange={(e) => holdingForm.set("ownership_percent", e.target.value)} /></Field>
            <Field label="Cost Basis"><Input type="number" min={0} step="0.01" value={holdingForm.form.cost_basis} onChange={(e) => holdingForm.set("cost_basis", e.target.value)} /></Field>
            <Field label="Unreturned Capital"><Input type="number" min={0} step="0.01" value={holdingForm.form.unreturned_capital} onChange={(e) => holdingForm.set("unreturned_capital", e.target.value)} /></Field>
            <Field label="Unpaid Preferred"><Input type="number" min={0} step="0.01" value={holdingForm.form.unpaid_preferred} onChange={(e) => holdingForm.set("unpaid_preferred", e.target.value)} /></Field>
            <Field label="Issue Date"><Input type="date" value={holdingForm.form.initial_issue_date} onChange={(e) => holdingForm.set("initial_issue_date", e.target.value)} /></Field>
            <Field label="GP Holding?">
              <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={holdingForm.form.is_gp} onChange={(e) => holdingForm.set("is_gp", e.target.value)}>
                <option value="false">No (LP)</option>
                <option value="true">Yes (GP)</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleHoldingSave} disabled={createHolding.isPending || updateHolding.isPending}>
              {(createHolding.isPending || updateHolding.isPending) ? "Saving..." : holdingForm.isEdit ? "Save Changes" : "Create Holding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Target Property Dialog ──────────────────────────────── */}
      <Dialog open={tpForm.open} onOpenChange={tpForm.setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{tpForm.isEdit ? "Edit Target Property" : "Add Target Property"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Identity</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Address" className="col-span-2 sm:col-span-3"><Input required value={tpForm.form.address} onChange={(e) => tpForm.set("address", e.target.value)} /></Field>
                <Field label="City"><Input value={tpForm.form.city} onChange={(e) => tpForm.set("city", e.target.value)} /></Field>
                <Field label="Province"><Input value={tpForm.form.province} onChange={(e) => tpForm.set("province", e.target.value)} /></Field>
                <Field label="Community"><Input value={tpForm.form.intended_community} onChange={(e) => tpForm.set("intended_community", e.target.value)} /></Field>
                <Field label="Status">
                  <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={tpForm.form.status} onChange={(e) => tpForm.set("status", e.target.value)}>
                    {["identified","underwriting","approved_target","under_offer","acquired","rejected","dropped"].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </Field>
                <Field label="Zoning"><Input value={tpForm.form.zoning} onChange={(e) => tpForm.set("zoning", e.target.value)} /></Field>
                <Field label="Lot Size (sqft)"><Input type="number" min={0} value={tpForm.form.lot_size} onChange={(e) => tpForm.set("lot_size", e.target.value)} /></Field>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Acquisition & Current State</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Est. Acquisition Price"><Input type="number" min={0} step="0.01" value={tpForm.form.estimated_acquisition_price} onChange={(e) => tpForm.set("estimated_acquisition_price", e.target.value)} /></Field>
                <Field label="Current Sqft"><Input type="number" min={0} value={tpForm.form.current_sqft} onChange={(e) => tpForm.set("current_sqft", e.target.value)} /></Field>
                <Field label="Bedrooms"><Input type="number" min={0} value={tpForm.form.current_bedrooms} onChange={(e) => tpForm.set("current_bedrooms", e.target.value)} /></Field>
                <Field label="Bathrooms"><Input type="number" min={0} value={tpForm.form.current_bathrooms} onChange={(e) => tpForm.set("current_bathrooms", e.target.value)} /></Field>
                <Field label="Condition"><Input value={tpForm.form.current_condition} onChange={(e) => tpForm.set("current_condition", e.target.value)} placeholder="good / fair / poor" /></Field>
                <Field label="Assessed Value"><Input type="number" min={0} step="0.01" value={tpForm.form.current_assessed_value} onChange={(e) => tpForm.set("current_assessed_value", e.target.value)} /></Field>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Interim Operating</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Monthly Revenue"><Input type="number" min={0} step="0.01" value={tpForm.form.interim_monthly_revenue} onChange={(e) => tpForm.set("interim_monthly_revenue", e.target.value)} /></Field>
                <Field label="Monthly Expenses"><Input type="number" min={0} step="0.01" value={tpForm.form.interim_monthly_expenses} onChange={(e) => tpForm.set("interim_monthly_expenses", e.target.value)} /></Field>
                <Field label="Occupancy %"><Input type="number" min={0} max={100} step="0.01" value={tpForm.form.interim_occupancy_percent} onChange={(e) => tpForm.set("interim_occupancy_percent", e.target.value)} /></Field>
                <Field label="Hold Months"><Input type="number" min={0} value={tpForm.form.interim_hold_months} onChange={(e) => tpForm.set("interim_hold_months", e.target.value)} /></Field>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Redevelopment</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Planned Units"><Input type="number" min={0} value={tpForm.form.planned_units} onChange={(e) => tpForm.set("planned_units", e.target.value)} /></Field>
                <Field label="Planned Beds"><Input type="number" min={0} value={tpForm.form.planned_beds} onChange={(e) => tpForm.set("planned_beds", e.target.value)} /></Field>
                <Field label="Planned Sqft"><Input type="number" min={0} value={tpForm.form.planned_sqft} onChange={(e) => tpForm.set("planned_sqft", e.target.value)} /></Field>
                <Field label="Construction Budget"><Input type="number" min={0} step="0.01" value={tpForm.form.construction_budget} onChange={(e) => tpForm.set("construction_budget", e.target.value)} /></Field>
                <Field label="Hard Costs"><Input type="number" min={0} step="0.01" value={tpForm.form.hard_costs} onChange={(e) => tpForm.set("hard_costs", e.target.value)} /></Field>
                <Field label="Soft Costs"><Input type="number" min={0} step="0.01" value={tpForm.form.soft_costs} onChange={(e) => tpForm.set("soft_costs", e.target.value)} /></Field>
                <Field label="Contingency %"><Input type="number" min={0} max={100} step="0.01" value={tpForm.form.contingency_percent} onChange={(e) => tpForm.set("contingency_percent", e.target.value)} /></Field>
                <Field label="Duration (months)"><Input type="number" min={0} value={tpForm.form.construction_duration_months} onChange={(e) => tpForm.set("construction_duration_months", e.target.value)} /></Field>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stabilized Pro Forma</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Monthly Revenue"><Input type="number" min={0} step="0.01" value={tpForm.form.stabilized_monthly_revenue} onChange={(e) => tpForm.set("stabilized_monthly_revenue", e.target.value)} /></Field>
                <Field label="Monthly Expenses"><Input type="number" min={0} step="0.01" value={tpForm.form.stabilized_monthly_expenses} onChange={(e) => tpForm.set("stabilized_monthly_expenses", e.target.value)} /></Field>
                <Field label="Occupancy %"><Input type="number" min={0} max={100} step="0.01" value={tpForm.form.stabilized_occupancy_percent} onChange={(e) => tpForm.set("stabilized_occupancy_percent", e.target.value)} /></Field>
                <Field label="Annual NOI"><Input type="number" min={0} step="0.01" value={tpForm.form.stabilized_annual_noi} onChange={(e) => tpForm.set("stabilized_annual_noi", e.target.value)} /></Field>
                <Field label="Cap Rate %"><Input type="number" min={0} max={100} step="0.01" value={tpForm.form.stabilized_cap_rate} onChange={(e) => tpForm.set("stabilized_cap_rate", e.target.value)} /></Field>
                <Field label="Stabilized Value"><Input type="number" min={0} step="0.01" value={tpForm.form.stabilized_value} onChange={(e) => tpForm.set("stabilized_value", e.target.value)} /></Field>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Debt Assumptions</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="LTV %"><Input type="number" min={0} max={100} step="0.01" value={tpForm.form.assumed_ltv_percent} onChange={(e) => tpForm.set("assumed_ltv_percent", e.target.value)} /></Field>
                <Field label="Interest Rate %"><Input type="number" min={0} max={100} step="0.01" value={tpForm.form.assumed_interest_rate} onChange={(e) => tpForm.set("assumed_interest_rate", e.target.value)} /></Field>
                <Field label="Amortization (mo)"><Input type="number" min={0} value={tpForm.form.assumed_amortization_months} onChange={(e) => tpForm.set("assumed_amortization_months", e.target.value)} /></Field>
                <Field label="Debt Amount"><Input type="number" min={0} step="0.01" value={tpForm.form.assumed_debt_amount} onChange={(e) => tpForm.set("assumed_debt_amount", e.target.value)} /></Field>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Target Acquisition"><Input type="date" value={tpForm.form.target_acquisition_date} onChange={(e) => tpForm.set("target_acquisition_date", e.target.value)} /></Field>
                <Field label="Target Completion"><Input type="date" value={tpForm.form.target_completion_date} onChange={(e) => tpForm.set("target_completion_date", e.target.value)} /></Field>
                <Field label="Target Stabilization"><Input type="date" value={tpForm.form.target_stabilization_date} onChange={(e) => tpForm.set("target_stabilization_date", e.target.value)} /></Field>
              </div>
            </div>
            <Field label="Notes"><textarea className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm min-h-[60px]" value={tpForm.form.notes} onChange={(e) => tpForm.set("notes", e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleTPSave} disabled={createTargetProperty.isPending || updateTargetProperty.isPending}>
              {(createTargetProperty.isPending || updateTargetProperty.isPending) ? "Saving..." : tpForm.isEdit ? "Save Changes" : "Create Target Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Owned Properties Section (used in Pipeline tab) ─────────────── */
const STAGE_BADGE: Record<string, { label: string; color: string }> = {
  prospect:          { label: "Prospect",          color: "bg-slate-100 text-slate-700 border-slate-200" },
  acquisition:       { label: "Acquisition",       color: "bg-purple-50 text-purple-700 border-purple-200" },
  interim_operation: { label: "Interim Operation", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  planning:          { label: "Planning",          color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  construction:      { label: "Construction",      color: "bg-orange-50 text-orange-700 border-orange-200" },
  lease_up:          { label: "Lease-Up",          color: "bg-blue-50 text-blue-700 border-blue-200" },
  stabilized:        { label: "Stabilized",        color: "bg-green-50 text-green-700 border-green-200" },
  exit:              { label: "Exit",              color: "bg-red-50 text-red-700 border-red-200" },
};

function OwnedPropertiesSection({ lpId }: { lpId: number }) {
  const { data: properties, isLoading } = usePropertiesByLp(lpId);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        Owned Properties
        {properties && <Badge variant="secondary" className="text-xs">{properties.length}</Badge>}
      </h3>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !properties || properties.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No properties are currently linked to this LP fund.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {properties.map((p) => {
            const stageCfg = STAGE_BADGE[p.development_stage] ?? { label: p.development_stage, color: "bg-gray-100 text-gray-700 border-gray-200" };
            return (
              <Link key={p.property_id} href={`/portfolio/${p.property_id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{p.address}</p>
                        <p className="text-xs text-muted-foreground">{p.city}, {p.province}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${stageCfg.color}`}>
                        {stageCfg.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Purchase Price</span>
                        <p className="font-medium tabular-nums">{p.purchase_price ? formatCurrencyCompact(Number(p.purchase_price)) : "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Market Value</span>
                        <p className="font-medium tabular-nums">{p.current_market_value ? formatCurrencyCompact(Number(p.current_market_value)) : "—"}</p>
                      </div>
                      {p.community_name && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Community</span>
                          <p className="font-medium">{p.community_name}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* LP Trend Charts */}
      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        <TrendChart
          entityType="lp"
          entityId={lpId}
          title="NAV & Capital Trend"
          metrics={["nav", "total_funded", "capital_deployed"]}
        />
        <TrendChart
          entityType="lp"
          entityId={lpId}
          title="Debt & Distributions"
          metrics={["total_debt", "total_distributions"]}
        />
      </div>
    </div>
  );
}
