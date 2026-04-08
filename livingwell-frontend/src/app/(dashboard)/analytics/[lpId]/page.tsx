"use client";

import React, { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, BarChart3, Building2, Coins, Gauge, Landmark, TrendingUp,
  Users, AlertCircle, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number | null | undefined) =>
  n != null
    ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n)
    : "—";

const fmtCompact = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtPct = (n: number | null | undefined, digits = 1) =>
  n != null ? `${n.toFixed(digits)}%` : "—";

const fmtMultiple = (n: number | null | undefined) =>
  n != null ? `${n.toFixed(2)}x` : "—";

const fmtNum = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("en-CA").format(Math.round(n)) : "—";

const STAGE_BADGE: Record<string, { label: string; color: string }> = {
  prospect:          { label: "Prospect",          color: "bg-slate-100 text-slate-700" },
  acquisition:       { label: "Acquisition",       color: "bg-purple-50 text-purple-700" },
  interim_operation: { label: "Interim Operation", color: "bg-yellow-50 text-yellow-700" },
  planning:          { label: "Planning",          color: "bg-indigo-50 text-indigo-700" },
  construction:      { label: "Construction",      color: "bg-orange-50 text-orange-700" },
  lease_up:          { label: "Lease-Up",          color: "bg-blue-50 text-blue-700" },
  stabilized:        { label: "Stabilized",        color: "bg-green-50 text-green-700" },
  exit:              { label: "Exit",              color: "bg-red-50 text-red-700" },
};

/* ════════════════════════════════════════════════════════════════════════ */
/*  PAGE                                                                     */
/* ════════════════════════════════════════════════════════════════════════ */

export default function LPAnalyticsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lpId = Number(params.lpId);

  const { data: lp } = useQuery({
    queryKey: ["lp-entity", lpId],
    queryFn: () => apiClient.get(`/api/investment/lp/${lpId}`).then((r) => r.data),
    enabled: lpId > 0,
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/analytics")} className="mb-2 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Portfolio Analytics
        </Button>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{lp?.name || "LP Performance"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Performance and realized results &middot; Backward-looking view
              {lp?.status && (
                <Badge variant="outline" className="ml-2 text-[10px]">{lp.status}</Badge>
              )}
            </p>
          </div>
          <Link
            href={`/investment/${lpId}`}
            className="text-xs px-3 py-1.5 rounded border border-input bg-background hover:bg-muted"
          >
            View LP Setup &amp; Forecast →
          </Link>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="property-performance" className="text-xs sm:text-sm">Property Performance</TabsTrigger>
          <TabsTrigger value="realized-cashflow" className="text-xs sm:text-sm">Realized Cash Flow</TabsTrigger>
          <TabsTrigger value="debt-position" className="text-xs sm:text-sm">Debt Position</TabsTrigger>
          <TabsTrigger value="investor-performance" className="text-xs sm:text-sm">Investor Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab lpId={lpId} />
        </TabsContent>
        <TabsContent value="property-performance" className="mt-4">
          <PropertyPerformanceTab lpId={lpId} />
        </TabsContent>
        <TabsContent value="realized-cashflow" className="mt-4">
          <RealizedCashFlowTab lpId={lpId} />
        </TabsContent>
        <TabsContent value="debt-position" className="mt-4">
          <DebtPositionTab lpId={lpId} />
        </TabsContent>
        <TabsContent value="investor-performance" className="mt-4">
          <InvestorPerformanceTab lpId={lpId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Shared "no actuals yet" placeholder                                      */
/* ════════════════════════════════════════════════════════════════════════ */

function NoActualsHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-muted-foreground italic mt-1 flex items-center gap-1">
      <AlertCircle className="h-3 w-3" />
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  TAB 1: OVERVIEW — KPI dashboard                                          */
/* ════════════════════════════════════════════════════════════════════════ */

function OverviewTab({ lpId }: { lpId: number }) {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["lp-realized-kpis", lpId],
    queryFn: () => apiClient.get(`/api/investment/lp/${lpId}/realized-kpis`).then((r) => r.data),
    enabled: lpId > 0,
  });

  if (isLoading || !kpis) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  const ds = kpis.data_sufficiency || {};
  const cap = kpis.capital || {};
  const dist = kpis.distributions || {};
  const val = kpis.valuation || {};
  const m = kpis.metrics || {};

  return (
    <div className="space-y-6">
      {/* Data sufficiency banner */}
      {!ds.is_complete && ds.missing && ds.missing.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Limited actual data recorded</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Performance metrics will populate as you record real activity. Currently missing: {ds.missing.join(", ")}.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capital block */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Capital Activity</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            label="Committed"
            value={fmt(cap.total_committed)}
            sub="Investor commitments"
            color="text-slate-700"
            border="border-l-slate-400"
          />
          <KPICard
            label="Funded / Paid-in"
            value={fmt(cap.total_funded)}
            sub={cap.funding_pct != null ? `${cap.funding_pct}% of committed` : "—"}
            color="text-blue-700"
            border="border-l-blue-500"
            warn={!ds.has_funded_capital ? "No subscriptions recorded" : undefined}
          />
          <KPICard
            label="Deployed"
            value={fmt(cap.total_deployed)}
            sub={cap.deployment_pct != null ? `${cap.deployment_pct}% of funded` : "—"}
            color="text-orange-700"
            border="border-l-orange-500"
          />
          <KPICard
            label="Undeployed"
            value={fmt(cap.undeployed_capital)}
            sub="Reserve / dry powder"
            color="text-amber-700"
            border="border-l-amber-500"
          />
        </div>
      </div>

      {/* Returns block */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Performance to Date</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            label="Current NAV"
            value={fmt(val.current_nav)}
            sub={val.paid_in_capital ? `vs ${fmtCompact(val.paid_in_capital)} paid in` : "—"}
            color="text-green-700"
            border="border-l-green-500"
            warn={!ds.has_nav ? "NAV not yet computed" : undefined}
          />
          <KPICard
            label="Distributions Paid"
            value={fmt(dist.total_paid_to_date)}
            sub={dist.distribution_count > 0 ? `${dist.distribution_count} events` : "None yet"}
            color="text-purple-700"
            border="border-l-purple-500"
            warn={!ds.has_distributions ? "No distributions recorded" : undefined}
          />
          <KPICard
            label="DPI"
            value={fmtMultiple(m.dpi)}
            sub="Distributions ÷ Paid-in"
            color="text-indigo-700"
            border="border-l-indigo-500"
            tooltip="Realized cash returned to investors as a multiple of capital paid in. 1.0x = full return of capital."
          />
          <KPICard
            label="TVPI"
            value={fmtMultiple(m.tvpi)}
            sub="(NAV + Distributions) ÷ Paid-in"
            color="text-emerald-700"
            border="border-l-emerald-500"
            tooltip="Total value to paid-in. Combines realized distributions and current NAV against capital paid in."
          />
        </div>
      </div>

      {/* RVPI / Annualized */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="RVPI"
          value={fmtMultiple(m.rvpi)}
          sub="Residual value ÷ Paid-in"
          color="text-teal-700"
          border="border-l-teal-500"
          tooltip="Unrealized value still in the fund as a multiple of capital paid in."
        />
        <KPICard
          label="Annualized Return*"
          value={fmtPct(m.annualized_return_approx_pct)}
          sub={kpis.years_since_inception ? `${kpis.years_since_inception} yrs since inception` : "—"}
          color="text-rose-700"
          border="border-l-rose-500"
          tooltip="*Approximation. Computed from TVPI and years since inception. NOT a true time-weighted IRR — that requires dated cash flows."
        />
        <KPICard
          label="Inception Date"
          value={kpis.inception_date || "—"}
          sub="LP fund start"
          color="text-slate-700"
          border="border-l-slate-400"
        />
        <KPICard
          label="As Of"
          value={kpis.as_of}
          sub="Snapshot date"
          color="text-slate-700"
          border="border-l-slate-400"
        />
      </div>

      {/* Approximation footnote */}
      <Card className="bg-muted/30">
        <CardContent className="pt-3 pb-3 px-4">
          <p className="text-[10px] text-muted-foreground italic">
            <strong>*Annualized Return</strong> is an approximation derived from TVPI and elapsed years
            since inception. A defensible time-weighted IRR requires dated capital-call and
            distribution cash flows. Once those are recorded, the calculation will switch to
            a true money-weighted IRR automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  label, value, sub, color, border, warn, tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  border?: string;
  warn?: string;
  tooltip?: string;
}) {
  return (
    <Card className={cn("border-l-4", border || "border-l-slate-400")} title={tooltip}>
      <CardContent className="pt-3 pb-3 px-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-2xl font-bold mt-0.5", color || "text-slate-700")}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        {warn && <NoActualsHint>{warn}</NoActualsHint>}
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  TAB 2: PROPERTY PERFORMANCE                                              */
/* ════════════════════════════════════════════════════════════════════════ */

function PropertyPerformanceTab({ lpId }: { lpId: number }) {
  const { data: properties, isLoading } = useQuery({
    queryKey: ["lp-properties", lpId],
    queryFn: () =>
      apiClient.get(`/api/portfolio/properties?lp_id=${lpId}`).then((r) => r.data?.items || r.data?.data || r.data || []),
    enabled: lpId > 0,
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading properties…</div>;
  const props = (properties || []) as any[];

  if (props.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No properties are linked to this LP yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Aggregate totals
  const totals = props.reduce(
    (acc, p) => ({
      purchase_price: acc.purchase_price + (Number(p.purchase_price) || 0),
      market_value: acc.market_value + (Number(p.current_market_value) || 0),
      annual_revenue: acc.annual_revenue + (Number(p.annual_revenue) || 0),
      annual_expenses: acc.annual_expenses + (Number(p.annual_expenses) || 0),
    }),
    { purchase_price: 0, market_value: 0, annual_revenue: 0, annual_expenses: 0 }
  );
  const portfolioNoi = totals.annual_revenue - totals.annual_expenses;
  const portfolioCapRate = totals.market_value > 0 ? (portfolioNoi / totals.market_value) * 100 : null;
  const totalAppreciation = totals.market_value - totals.purchase_price;
  const appreciationPct = totals.purchase_price > 0 ? (totalAppreciation / totals.purchase_price) * 100 : null;

  return (
    <div className="space-y-4">
      {/* Portfolio rollup */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard label="Properties" value={fmtNum(props.length)} color="text-slate-700" border="border-l-slate-400" />
        <KPICard label="Cost Basis" value={fmtCompact(totals.purchase_price)} color="text-blue-700" border="border-l-blue-500" />
        <KPICard label="Current Value" value={fmtCompact(totals.market_value)} color="text-green-700" border="border-l-green-500" />
        <KPICard
          label="Appreciation"
          value={fmtCompact(totalAppreciation)}
          sub={appreciationPct != null ? `${appreciationPct.toFixed(1)}%` : "—"}
          color={totalAppreciation >= 0 ? "text-emerald-700" : "text-red-600"}
          border={totalAppreciation >= 0 ? "border-l-emerald-500" : "border-l-red-500"}
        />
        <KPICard
          label="Portfolio Cap Rate"
          value={fmtPct(portfolioCapRate, 2)}
          sub={fmtCompact(portfolioNoi) + " NOI"}
          color="text-amber-700"
          border="border-l-amber-500"
        />
      </div>

      {/* Per-property performance table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Property Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Property</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Cost Basis</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                  <TableHead className="text-right">Δ Value</TableHead>
                  <TableHead className="text-right">NOI</TableHead>
                  <TableHead className="text-right">Cap Rate</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.map((p) => {
                  const cost = Number(p.purchase_price) || 0;
                  const mv = Number(p.current_market_value) || 0;
                  const delta = mv - cost;
                  const deltaPct = cost > 0 ? (delta / cost) * 100 : null;
                  const noi = (Number(p.annual_revenue) || 0) - (Number(p.annual_expenses) || 0);
                  const capRate = mv > 0 ? (noi / mv) * 100 : null;
                  const stageCfg = STAGE_BADGE[p.development_stage] || { label: p.development_stage || "—", color: "bg-gray-100 text-gray-700" };
                  return (
                    <TableRow
                      key={p.property_id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => (window.location.href = `/portfolio/${p.property_id}`)}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">{p.address}</div>
                        <div className="text-[10px] text-muted-foreground">{p.city}, {p.province}</div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", stageCfg.color)}>
                          {stageCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{cost > 0 ? fmt(cost) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-blue-600">{mv > 0 ? fmt(mv) : "—"}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", delta >= 0 ? "text-green-600" : "text-red-600")}>
                        {mv > 0 && cost > 0 ? `${delta >= 0 ? "+" : ""}${fmt(delta)}` : "—"}
                        {deltaPct != null && <div className="text-[10px]">{deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{noi > 0 ? fmt(noi) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{capRate != null ? `${capRate.toFixed(2)}%` : "—"}</TableCell>
                      <TableCell className="text-right">
                        {mv > 0 && cost > 0 && delta >= 0 ? (
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">on track</Badge>
                        ) : mv > 0 && delta < 0 ? (
                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700">below cost</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">no data</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  TAB 3: REALIZED CASH FLOW                                                */
/* ════════════════════════════════════════════════════════════════════════ */

function RealizedCashFlowTab({ lpId }: { lpId: number }) {
  const { data: distributions, isLoading } = useQuery({
    queryKey: ["lp-distributions", lpId],
    queryFn: () =>
      apiClient.get(`/api/investment/lp/${lpId}/distributions`).then((r) => {
        const raw = r.data;
        if (Array.isArray(raw)) return raw;
        return raw?.items || raw?.data || raw?.results || [];
      }),
    enabled: lpId > 0,
  });

  const dists = (Array.isArray(distributions) ? distributions : []) as any[];
  const totalDistributed = dists.reduce((s, d) => s + (Number(d.total_amount) || Number(d.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPICard
          label="Total Distributions Paid"
          value={fmt(totalDistributed)}
          sub={`${dists.length} events`}
          color="text-purple-700"
          border="border-l-purple-500"
        />
        <KPICard
          label="Capital Calls Issued"
          value="—"
          sub="Coming soon"
          color="text-blue-700"
          border="border-l-blue-500"
          warn="Capital call ledger not implemented yet"
        />
        <KPICard
          label="Net Realized Position"
          value={fmt(totalDistributed)}
          sub="Distributions − Calls"
          color={totalDistributed >= 0 ? "text-green-700" : "text-red-600"}
          border={totalDistributed >= 0 ? "border-l-green-500" : "border-l-red-500"}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Distribution Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-muted-foreground">Loading…</div>
          ) : dists.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No distribution events recorded yet. They will appear here when the LP starts paying distributions to investors.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dists.map((d, i) => (
                    <TableRow key={d.distribution_event_id || i}>
                      <TableCell className="text-xs">
                        {d.distribution_date || d.event_date || d.created_at?.slice(0, 10) || "—"}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{d.distribution_type || "—"}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{d.status || "—"}</Badge></TableCell>
                      <TableCell className="text-sm">{d.description || d.notes || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {fmt(Number(d.total_amount) || Number(d.amount) || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-3 pb-3 px-4">
          <p className="text-[11px] text-muted-foreground italic">
            For the budgeted (forecast) cash flow timeline, see the <Link href={`/investment/${lpId}`} className="underline">LP Setup page → Portfolio Cash Flow tab</Link>.
            This page will show the variance once both budget and actuals are populated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  TAB 4: DEBT POSITION                                                     */
/* ════════════════════════════════════════════════════════════════════════ */

function DebtPositionTab({ lpId }: { lpId: number }) {
  // We re-use the per-property properties query and let the user drill in for debt detail.
  const { data: properties } = useQuery({
    queryKey: ["lp-properties", lpId],
    queryFn: () =>
      apiClient.get(`/api/portfolio/properties?lp_id=${lpId}`).then((r) => r.data?.items || r.data?.data || r.data || []),
    enabled: lpId > 0,
  });

  const props = (properties || []) as any[];

  // Per-property aggregate debt query
  const propIds = props.map((p) => p.property_id);
  const debtQueries = useQuery({
    queryKey: ["lp-debt-rollup", lpId, propIds.join(",")],
    queryFn: async () => {
      if (propIds.length === 0) return [];
      const all = await Promise.all(
        propIds.map((id) =>
          apiClient.get(`/api/portfolio/properties/${id}/debt`).then((r) => ({ property_id: id, debts: r.data || [] })).catch(() => ({ property_id: id, debts: [] })),
        ),
      );
      return all;
    },
    enabled: propIds.length > 0,
  });

  const allDebts: any[] = [];
  (debtQueries.data || []).forEach((entry: any) => {
    entry.debts.forEach((d: any) => allDebts.push({ ...d, property_id: entry.property_id }));
  });

  const totalCommitment = allDebts.reduce((s, d) => s + (Number(d.commitment_amount) || 0), 0);
  const totalOutstanding = allDebts.reduce((s, d) => s + (Number(d.outstanding_balance) || 0), 0);
  const wtdRate = totalOutstanding > 0
    ? allDebts.reduce((s, d) => s + (Number(d.outstanding_balance) || 0) * (Number(d.interest_rate) || 0), 0) / totalOutstanding
    : 0;
  const totalMarketValue = props.reduce((s, p) => s + (Number(p.current_market_value) || 0), 0);
  const portfolioLtv = totalMarketValue > 0 ? (totalOutstanding / totalMarketValue) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Commitment" value={fmtCompact(totalCommitment)} color="text-slate-700" border="border-l-slate-400" sub={`${allDebts.length} facilities`} />
        <KPICard label="Outstanding Balance" value={fmtCompact(totalOutstanding)} color="text-amber-700" border="border-l-amber-500" sub={totalCommitment > 0 ? `${((totalOutstanding / totalCommitment) * 100).toFixed(0)}% drawn` : "—"} />
        <KPICard label="Wtd Avg Rate" value={wtdRate > 0 ? `${wtdRate.toFixed(2)}%` : "—"} color="text-blue-700" border="border-l-blue-500" sub="Across active facilities" />
        <KPICard label="Portfolio LTV" value={fmtPct(portfolioLtv)} color="text-red-700" border="border-l-red-500" sub={`vs ${fmtCompact(totalMarketValue)} market value`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Debt Facilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allDebts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No debt facilities recorded across this LP's properties.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Lender</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amort</TableHead>
                    <TableHead>Maturity</TableHead>
                    <TableHead>Property</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDebts.map((d, i) => {
                    const prop = props.find((p) => p.property_id === d.property_id);
                    return (
                      <TableRow key={d.debt_id || i}>
                        <TableCell className="font-medium text-sm">{d.lender_name || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{d.debt_type || "—"}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCompact(Number(d.commitment_amount) || 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCompact(Number(d.outstanding_balance) || 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.interest_rate != null ? `${Number(d.interest_rate).toFixed(2)}%` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.amortization_months ? `${d.amortization_months}mo` : "—"}</TableCell>
                        <TableCell className="text-xs">{d.maturity_date || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {prop ? (
                            <Link href={`/portfolio/${d.property_id}`} className="text-primary hover:underline">
                              {prop.address}
                            </Link>
                          ) : `#${d.property_id}`}
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
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  TAB 5: INVESTOR PERFORMANCE                                              */
/* ════════════════════════════════════════════════════════════════════════ */

function InvestorPerformanceTab({ lpId }: { lpId: number }) {
  const { data: subs, isLoading } = useQuery({
    queryKey: ["lp-subscriptions", lpId],
    queryFn: () =>
      apiClient.get(`/api/investment/lp/${lpId}/subscriptions`).then((r) => {
        const raw = r.data;
        if (Array.isArray(raw)) return raw;
        return raw?.items || raw?.data || raw?.results || [];
      }),
    enabled: lpId > 0,
  });

  const rows = (Array.isArray(subs) ? subs : []) as any[];
  const totalCommitted = rows.reduce((s, r) => s + (Number(r.committed_amount) || 0), 0);
  const totalFunded = rows.reduce((s, r) => s + (Number(r.funded_amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPICard label="Investors" value={fmtNum(rows.length)} color="text-slate-700" border="border-l-slate-400" />
        <KPICard label="Total Committed" value={fmtCompact(totalCommitted)} color="text-blue-700" border="border-l-blue-500" />
        <KPICard label="Total Funded" value={fmtCompact(totalFunded)} color="text-green-700" border="border-l-green-500" sub={totalCommitted > 0 ? `${((totalFunded / totalCommitted) * 100).toFixed(0)}% funded` : "—"} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Investor Returns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No subscriptions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Investor</TableHead>
                    <TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">Funded</TableHead>
                    <TableHead className="text-right">Distributions Received</TableHead>
                    <TableHead className="text-right">Current NAV Share</TableHead>
                    <TableHead className="text-right">Net Position</TableHead>
                    <TableHead className="text-right">Realized Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const committed = Number(r.committed_amount) || 0;
                    const funded = Number(r.funded_amount) || 0;
                    // Distributions per investor + NAV-share are tracked elsewhere; show "—" until wired
                    return (
                      <TableRow key={r.subscription_id || i}>
                        <TableCell className="font-medium text-sm">{r.investor_name || r.investor_id || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(committed)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(funded)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <NoActualsHint>
            Per-investor distribution allocation and NAV-share calculation will populate once distribution events are recorded.
          </NoActualsHint>
        </CardContent>
      </Card>
    </div>
  );
}
