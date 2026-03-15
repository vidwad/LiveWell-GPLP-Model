"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import {
  useLP,
  useTranches,
  useSubscriptions,
  useHoldings,
  useTargetProperties,
  usePortfolioRollup,
  useDistributionEvents,
} from "@/hooks/useInvestment";
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
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

/* ── helpers ─────────────────────────────────────────────────────── */
function statusLabel(s: string) {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const LP_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  operating: "default",
  open_for_subscription: "secondary",
  partially_funded: "secondary",
  fully_funded: "default",
  draft: "outline",
  under_review: "outline",
  approved: "outline",
  tranche_closed: "default",
  winding_down: "destructive",
  dissolved: "destructive",
  raising: "secondary",
};

const SUB_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  submitted: "outline",
  under_review: "secondary",
  accepted: "secondary",
  funded: "default",
  issued: "default",
  closed: "default",
  rejected: "destructive",
  withdrawn: "destructive",
};

const TP_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  identified: "outline",
  underwriting: "secondary",
  approved_target: "secondary",
  under_offer: "default",
  acquired: "default",
  rejected: "destructive",
  dropped: "destructive",
};

function pct(num: string | null | undefined, denom: string | null | undefined) {
  const n = Number(num ?? 0);
  const d = Number(denom ?? 0);
  if (d === 0) return 0;
  return Math.min(100, (n / d) * 100);
}

function fmtPct(v: string | null | undefined) {
  if (!v) return "—";
  return `${Number(v).toFixed(1)}%`;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-CA");
}

function fmtNum(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("en-CA");
}

/* ── KPI Card ────────────────────────────────────────────────────── */
function KPI({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className="text-lg sm:text-xl font-bold tabular-nums whitespace-nowrap truncate">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
      )}
    </div>
  );
}

/* ── Detail Row ──────────────────────────────────────────────────── */
function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function LPDetailPage() {
  const params = useParams();
  const lpId = Number(params.lpId);
  const router = useRouter();

  const { data: lp, isLoading: lpLoading } = useLP(lpId);
  const { data: tranches } = useTranches(lpId);
  const { data: subscriptions } = useSubscriptions(lpId);
  const { data: holdings } = useHoldings(lpId);
  const { data: targetProperties } = useTargetProperties(lpId);
  const { data: rollup } = usePortfolioRollup(lpId);
  const { data: distributions } = useDistributionEvents(lpId);

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
        <Link href="/investment">
          <Button variant="ghost" className="mt-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </Link>
      </div>
    );
  }

  const fundedPct = pct(lp.total_funded, lp.target_raise);
  const committedPct = pct(lp.total_committed, lp.target_raise);

  return (
    <div className="max-w-6xl space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/investment"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Investment
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 flex-wrap">
              <Landmark className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              <span className="truncate">{lp.name}</span>
              {lp.lp_number && (
                <span className="text-sm font-normal text-muted-foreground">
                  {lp.lp_number}
                </span>
              )}
            </h1>
            {lp.legal_name && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {lp.legal_name}
              </p>
            )}
          </div>
          <Badge
            variant={LP_STATUS_VARIANT[lp.status] ?? "outline"}
            className="self-start sm:self-center text-xs"
          >
            {statusLabel(lp.status)}
          </Badge>
        </div>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI
          label="Target Raise"
          value={lp.target_raise ? formatCurrencyCompact(lp.target_raise) : "—"}
          icon={Target}
        />
        <KPI
          label="Committed"
          value={
            lp.total_committed
              ? formatCurrencyCompact(lp.total_committed)
              : "$0"
          }
          sub={`${committedPct.toFixed(0)}% of target`}
          icon={TrendingUp}
        />
        <KPI
          label="Funded"
          value={
            lp.total_funded ? formatCurrencyCompact(lp.total_funded) : "$0"
          }
          sub={`${fundedPct.toFixed(0)}% of target`}
          icon={DollarSign}
        />
        <KPI
          label="Investors"
          value={String(lp.investor_count ?? 0)}
          icon={Users}
        />
        <KPI
          label="Properties"
          value={String(lp.property_count ?? 0)}
          sub={`${lp.target_property_count ?? 0} pipeline`}
          icon={Building2}
        />
        <KPI
          label="Remaining"
          value={
            lp.remaining_capacity
              ? formatCurrencyCompact(lp.remaining_capacity)
              : "$0"
          }
          icon={Layers}
        />
      </div>

      {/* ── Funding Progress ──────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Funding Progress</span>
            <span className="font-medium tabular-nums">
              {lp.total_funded ? formatCurrency(lp.total_funded) : "$0"} /{" "}
              {lp.target_raise ? formatCurrency(lp.target_raise) : "—"}
            </span>
          </div>
          <div className="relative">
            <Progress value={fundedPct} className="h-3" />
            {committedPct > fundedPct && (
              <div
                className="absolute top-0 h-3 bg-primary/30 rounded-r-full"
                style={{
                  left: `${fundedPct}%`,
                  width: `${Math.min(committedPct - fundedPct, 100 - fundedPct)}%`,
                }}
              />
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              Funded ({fundedPct.toFixed(0)}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-primary/30" />
              Committed ({committedPct.toFixed(0)}%)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="w-full sm:w-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="tranches" className="text-xs sm:text-sm">
              Tranches
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="text-xs sm:text-sm">
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="holdings" className="text-xs sm:text-sm">
              Holdings
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs sm:text-sm">
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="projections" className="text-xs sm:text-sm">
              Projections
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview Tab ──────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Fund Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Fund Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <DRow label="Purpose / Community" value={lp.community_focus} />
                <DRow
                  label="City Focus"
                  value={lp.city_focus}
                />
                <DRow
                  label="Unit Price"
                  value={
                    lp.unit_price ? formatCurrency(lp.unit_price) : "—"
                  }
                />
                <DRow
                  label="Min Subscription"
                  value={
                    lp.minimum_subscription
                      ? formatCurrency(lp.minimum_subscription)
                      : "—"
                  }
                />
                <DRow
                  label="Min Raise"
                  value={
                    lp.minimum_raise ? formatCurrency(lp.minimum_raise) : "—"
                  }
                />
                <DRow
                  label="Max Raise"
                  value={
                    lp.maximum_raise ? formatCurrency(lp.maximum_raise) : "—"
                  }
                />
                <DRow label="Offering Date" value={fmtDate(lp.offering_date)} />
                <DRow label="Closing Date" value={fmtDate(lp.closing_date)} />
              </CardContent>
            </Card>

            {/* Fee & Return Structure */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Percent className="h-4 w-4" /> Fee & Return Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <DRow
                  label="Preferred Return"
                  value={fmtPct(lp.preferred_return_rate)}
                />
                <DRow
                  label="GP Promote"
                  value={fmtPct(lp.gp_promote_percent)}
                />
                <DRow
                  label="GP Catch-up"
                  value={fmtPct(lp.gp_catchup_percent)}
                />
                <DRow
                  label="Asset Mgmt Fee"
                  value={fmtPct(lp.asset_management_fee_percent)}
                />
                <DRow
                  label="Acquisition Fee"
                  value={fmtPct(lp.acquisition_fee_percent)}
                />
                <DRow
                  label="Formation Costs"
                  value={
                    lp.formation_costs
                      ? formatCurrency(lp.formation_costs)
                      : "—"
                  }
                />
                <DRow
                  label="Offering Costs"
                  value={
                    lp.offering_costs
                      ? formatCurrency(lp.offering_costs)
                      : "—"
                  }
                />
                <DRow
                  label="Reserve %"
                  value={fmtPct(lp.reserve_percent)}
                />
              </CardContent>
            </Card>

            {/* Capital Summary */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Capital Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Gross Subscriptions
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {lp.gross_subscriptions
                        ? formatCurrency(lp.gross_subscriptions)
                        : "$0"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Total Formation Costs
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {lp.total_formation_costs
                        ? formatCurrency(lp.total_formation_costs)
                        : "$0"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Reserve Allocations
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {lp.total_reserve_allocations
                        ? formatCurrency(lp.total_reserve_allocations)
                        : "$0"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Net Deployable
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {lp.net_deployable_capital
                        ? formatCurrency(lp.net_deployable_capital)
                        : "$0"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {lp.notes && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {lp.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Tranches Tab ──────────────────────────────────────── */}
        <TabsContent value="tranches" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Tranches / Closings</CardTitle>
            </CardHeader>
            <CardContent>
              {!tranches || tranches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tranches defined yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {tranches.map((t) => {
                    const tPct = pct(
                      t.total_subscribed,
                      t.target_amount
                    );
                    return (
                      <div
                        key={t.tranche_id}
                        className="rounded-lg border p-4 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-sm">
                              Tranche {t.tranche_number}
                              {t.tranche_name && ` — ${t.tranche_name}`}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {fmtDate(t.opening_date)} → {fmtDate(t.closing_date)}
                              {" · "}Issue Price:{" "}
                              {t.issue_price
                                ? formatCurrency(t.issue_price)
                                : "—"}
                            </p>
                          </div>
                          <Badge
                            variant={
                              t.status === "open"
                                ? "secondary"
                                : t.status === "closed"
                                ? "default"
                                : "outline"
                            }
                          >
                            {statusLabel(t.status)}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Subscribed
                            </span>
                            <span className="tabular-nums">
                              {t.total_subscribed
                                ? formatCurrency(t.total_subscribed)
                                : "$0"}{" "}
                              / {t.target_amount ? formatCurrency(t.target_amount) : "—"}
                            </span>
                          </div>
                          <Progress value={tPct} className="h-2" />
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Subscriptions
                            </p>
                            <p className="text-sm font-semibold">
                              {t.subscriptions_count}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Funded
                            </p>
                            <p className="text-sm font-semibold tabular-nums">
                              {t.total_funded
                                ? formatCurrencyCompact(t.total_funded)
                                : "$0"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Units
                            </p>
                            <p className="text-sm font-semibold tabular-nums">
                              {t.total_units ? fmtNum(t.total_units) : "0"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Subscriptions Tab ─────────────────────────────────── */}
        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {!subscriptions || subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No subscriptions yet.
                </p>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((s) => (
                        <TableRow key={s.subscription_id}>
                          <TableCell className="font-medium text-sm">
                            {s.investor_name ?? `#${s.investor_id}`}
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.tranche_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {formatCurrency(s.commitment_amount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {formatCurrency(s.funded_amount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {s.unit_quantity ? fmtNum(s.unit_quantity) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                SUB_STATUS_VARIANT[s.status] ?? "outline"
                              }
                              className="text-xs"
                            >
                              {statusLabel(s.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {fmtDate(s.submitted_date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Holdings Tab ──────────────────────────────────────── */}
        <TabsContent value="holdings" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              {!holdings || holdings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No holdings yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Investor</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Ownership</TableHead>
                        <TableHead className="text-right">Cost Basis</TableHead>
                        <TableHead className="text-right">
                          Unreturned Capital
                        </TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Issue Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((h) => (
                        <TableRow key={h.holding_id}>
                          <TableCell className="font-medium text-sm">
                            {h.investor_name ?? `#${h.investor_id}`}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {h.units_held ? fmtNum(h.units_held) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {fmtPct(h.ownership_percent)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {formatCurrency(h.cost_basis)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {formatCurrency(h.unreturned_capital)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={h.is_gp ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {h.is_gp ? "GP" : "LP"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {fmtDate(h.initial_issue_date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Target Properties Tab ─────────────────────────────── */}
        <TabsContent value="pipeline" className="mt-4">
          <div className="space-y-4">
            {!targetProperties || targetProperties.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    No target properties in the pipeline.
                  </p>
                </CardContent>
              </Card>
            ) : (
              targetProperties.map((tp) => (
                <Card key={tp.target_property_id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0" />
                          {tp.address}
                          {tp.city && `, ${tp.city}`}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tp.intended_community ?? "—"} · Zoning: {tp.zoning ?? "—"} · Lot:{" "}
                          {tp.lot_size ? `${fmtNum(tp.lot_size)} sqft` : "—"}
                        </p>
                      </div>
                      <Badge
                        variant={TP_STATUS_VARIANT[tp.status] ?? "outline"}
                        className="text-xs self-start"
                      >
                        {statusLabel(tp.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
                      {/* Acquisition */}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Est. Acquisition
                        </p>
                        <p className="font-semibold tabular-nums">
                          {tp.estimated_acquisition_price
                            ? formatCurrencyCompact(
                                tp.estimated_acquisition_price
                              )
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Construction Budget
                        </p>
                        <p className="font-semibold tabular-nums">
                          {tp.construction_budget
                            ? formatCurrencyCompact(tp.construction_budget)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Planned Units / Beds
                        </p>
                        <p className="font-semibold">
                          {tp.planned_units ?? "—"} / {tp.planned_beds ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Planned Sqft
                        </p>
                        <p className="font-semibold tabular-nums">
                          {tp.planned_sqft ? fmtNum(tp.planned_sqft) : "—"}
                        </p>
                      </div>

                      {/* Interim */}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Interim Revenue/mo
                        </p>
                        <p className="font-semibold tabular-nums">
                          {tp.interim_monthly_revenue
                            ? formatCurrency(tp.interim_monthly_revenue)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Interim Hold
                        </p>
                        <p className="font-semibold">
                          {tp.interim_hold_months
                            ? `${tp.interim_hold_months} months`
                            : "—"}
                        </p>
                      </div>

                      {/* Stabilized */}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Stabilized NOI
                        </p>
                        <p className="font-semibold tabular-nums">
                          {tp.stabilized_annual_noi
                            ? formatCurrencyCompact(tp.stabilized_annual_noi)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Stabilized Value
                        </p>
                        <p className="font-semibold tabular-nums">
                          {tp.stabilized_value
                            ? formatCurrencyCompact(tp.stabilized_value)
                            : "—"}
                        </p>
                      </div>

                      {/* Debt */}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Assumed Debt
                        </p>
                        <p className="font-semibold tabular-nums">
                          {tp.assumed_debt_amount
                            ? formatCurrencyCompact(tp.assumed_debt_amount)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          LTV / Rate
                        </p>
                        <p className="font-semibold">
                          {fmtPct(tp.assumed_ltv_percent)} /{" "}
                          {fmtPct(tp.assumed_interest_rate)}
                        </p>
                      </div>

                      {/* Timeline */}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Target Acquisition
                        </p>
                        <p className="font-semibold">
                          {fmtDate(tp.target_acquisition_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Target Stabilization
                        </p>
                        <p className="font-semibold">
                          {fmtDate(tp.target_stabilization_date)}
                        </p>
                      </div>
                    </div>
                    {tp.notes && (
                      <p className="text-xs text-muted-foreground mt-3 italic">
                        {tp.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Projections Tab ───────────────────────────────────── */}
        <TabsContent value="projections" className="mt-4">
          {!rollup ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No projection data available.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Target Portfolio Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" /> Target Portfolio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DRow
                    label="Pipeline Properties"
                    value={rollup.target_property_count}
                  />
                  <DRow
                    label="Total Acquisition Cost"
                    value={formatCurrency(
                      rollup.total_target_acquisition_cost
                    )}
                  />
                  <DRow
                    label="Total Construction Budget"
                    value={formatCurrency(
                      rollup.total_target_construction_budget
                    )}
                  />
                  <DRow
                    label="All-in Cost"
                    value={formatCurrency(rollup.total_target_all_in_cost)}
                  />
                  <DRow
                    label="Planned Units"
                    value={rollup.total_planned_units}
                  />
                  <DRow
                    label="Planned Beds"
                    value={rollup.total_planned_beds}
                  />
                </CardContent>
              </Card>

              {/* Projected Returns */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Projected Returns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DRow
                    label="Stabilized NOI"
                    value={
                      rollup.total_target_stabilized_noi
                        ? formatCurrency(rollup.total_target_stabilized_noi)
                        : "—"
                    }
                  />
                  <DRow
                    label="Stabilized Value"
                    value={
                      rollup.total_target_stabilized_value
                        ? formatCurrency(rollup.total_target_stabilized_value)
                        : "—"
                    }
                  />
                  <DRow
                    label="Total Debt"
                    value={
                      rollup.total_target_debt
                        ? formatCurrency(rollup.total_target_debt)
                        : "—"
                    }
                  />
                  <DRow
                    label="Equity Required"
                    value={
                      rollup.total_target_equity_required
                        ? formatCurrency(rollup.total_target_equity_required)
                        : "—"
                    }
                  />
                  <DRow
                    label="Projected LP Equity"
                    value={
                      rollup.projected_lp_equity_value
                        ? formatCurrency(rollup.projected_lp_equity_value)
                        : "—"
                    }
                  />
                  <DRow
                    label="Equity Multiple"
                    value={
                      rollup.projected_equity_multiple
                        ? `${Number(rollup.projected_equity_multiple).toFixed(2)}x`
                        : "—"
                    }
                  />
                  <DRow
                    label="Cash-on-Cash"
                    value={
                      rollup.projected_cash_on_cash
                        ? `${Number(rollup.projected_cash_on_cash).toFixed(1)}%`
                        : "—"
                    }
                  />
                </CardContent>
              </Card>

              {/* Actual Portfolio */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Actual Portfolio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Properties Owned
                      </p>
                      <p className="text-lg font-bold">
                        {rollup.actual_property_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Purchase Price
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        {rollup.total_actual_purchase_price
                          ? formatCurrencyCompact(
                              rollup.total_actual_purchase_price
                            )
                          : "$0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Current Market Value
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        {rollup.total_actual_market_value
                          ? formatCurrencyCompact(
                              rollup.total_actual_market_value
                            )
                          : "$0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Projected Portfolio Value
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        {rollup.projected_portfolio_value
                          ? formatCurrencyCompact(
                              rollup.projected_portfolio_value
                            )
                          : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
