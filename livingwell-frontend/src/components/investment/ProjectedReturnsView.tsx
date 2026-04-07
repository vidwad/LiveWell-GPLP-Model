"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, AlertCircle, Camera, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LPInvestorProforma, type ProformaData } from "./LPInvestorProforma";
import { GPCompensationView, type GPCompensationData } from "./GPCompensationView";

const fmt = (n: number | null | undefined) =>
  n != null
    ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n)
    : "—";
const fmtMultiple = (n: number | null | undefined) => (n != null ? `${Number(n).toFixed(2)}x` : "—");
const fmtPct = (n: number | null | undefined) => (n != null ? `${Number(n).toFixed(1)}%` : "—");

interface Props {
  lpId: number;
  projectionType: "lp" | "gp"; // determines whether we render LP or GP results from the same waterfall payload
}

interface SnapshotRow {
  snapshot_id: number;
  lp_id: number;
  tranche_id: number;
  projection_type: string;
  captured_at: string;
  capture_trigger: string;
  label: string | null;
  notes: string | null;
  headline_kpis: any;
}

const LIVE_VALUE = "__live__";

export function ProjectedReturnsView({ lpId, projectionType }: Props) {
  const qc = useQueryClient();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>(LIVE_VALUE);
  const [waterfallMode, setWaterfallMode] = useState<"simple_split" | "european">("simple_split");

  const deleteSnapshot = useMutation({
    mutationFn: (snapshotId: number) =>
      apiClient.delete(`/api/investment/snapshots/${snapshotId}`),
    onSuccess: () => {
      // Invalidate both projection_type lists since we may have removed the
      // paired LP or GP row
      qc.invalidateQueries({ queryKey: ["lp-snapshots", lpId, "lp"] });
      qc.invalidateQueries({ queryKey: ["lp-snapshots", lpId, "gp"] });
      setSelectedSnapshotId(LIVE_VALUE);
    },
  });

  // Live investor pro forma — full year-by-year LP return projection
  const { data: liveProforma } = useQuery<ProformaData>({
    queryKey: ["lp-investor-proforma", lpId, waterfallMode],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/lp/${lpId}/investor-proforma?waterfall_mode=${waterfallMode}`)
        .then((r) => r.data),
    enabled: selectedSnapshotId === LIVE_VALUE && lpId > 0,
  });

  // List of all snapshots for this LP, filtered to projection type
  const { data: snapshots } = useQuery<SnapshotRow[]>({
    queryKey: ["lp-snapshots", lpId, projectionType],
    queryFn: () =>
      apiClient
        .get(`/api/investment/lp/${lpId}/snapshots?projection_type=${projectionType}`)
        .then((r) => r.data || []),
    enabled: lpId > 0,
  });

  // Live portfolio cash flow (used when "Live" is selected)
  const { data: livePortfolio, isLoading: liveLoading } = useQuery({
    queryKey: ["lp-portfolio-cashflow", lpId],
    queryFn: () =>
      apiClient.get(`/api/portfolio/lp/${lpId}/portfolio-cashflow`).then((r) => r.data),
    enabled: selectedSnapshotId === LIVE_VALUE && lpId > 0,
  });

  // Single-snapshot fetch (used when a frozen snapshot is selected)
  const { data: snapshotDetail, isLoading: snapLoading } = useQuery({
    queryKey: ["snapshot", selectedSnapshotId],
    queryFn: () =>
      apiClient.get(`/api/investment/snapshots/${selectedSnapshotId}`).then((r) => r.data),
    enabled: selectedSnapshotId !== LIVE_VALUE,
  });

  const isLive = selectedSnapshotId === LIVE_VALUE;
  const isLoading = isLive ? liveLoading : snapLoading;

  // Pull the relevant numbers based on whether we are viewing live or snapshot
  const view = useMemo(() => {
    if (isLive) {
      // Live: we don't have a waterfall split for live data; show portfolio cash flow returns directly
      // The PORTFOLIO endpoint already returns pre-fee, pre-promote returns. For "live" view we're showing
      // the same thing whether the user toggles LP or GP — since we don't have a frozen waterfall yet.
      // We badge the page so the user knows this is the pre-split number.
      const r = livePortfolio?.returns || {};
      return {
        kind: "live" as const,
        title: isLive ? "Live model (current)" : "",
        captured_at: null as string | null,
        trigger: null as string | null,
        notes: null as string | null,
        is_pre_split: true,
        primary: {
          total_return: r.total_return,
          equity_multiple: r.equity_multiple,
          annualized_roi: r.annualized_roi,
          paid_in: r.total_equity_invested,
          total_distributed: r.total_cash_returned,
        },
        portfolio_cashflow: livePortfolio,
      };
    }

    // Snapshot view: pull from the frozen payload
    const payload = snapshotDetail?.payload || {};
    const split = payload.waterfall_split || {};
    const results = projectionType === "lp" ? split.lp_results : split.gp_results;
    return {
      kind: "snapshot" as const,
      title: snapshotDetail?.label || "Snapshot",
      captured_at: snapshotDetail?.captured_at,
      trigger: snapshotDetail?.capture_trigger,
      notes: snapshotDetail?.notes,
      is_pre_split: false,
      primary: {
        total_return: results?.total_distributions,
        equity_multiple: results?.equity_multiple,
        annualized_roi: results?.annualized_return_pct,
        paid_in: results?.paid_in_capital ?? split.waterfall_inputs?.paid_in_capital,
        total_distributed: results?.total_distributions,
      },
      portfolio_cashflow: payload.portfolio_cashflow,
      waterfall_split: split,
      tranche: payload.tranche,
    };
  }, [isLive, livePortfolio, snapshotDetail, projectionType]);

  return (
    <div className="space-y-4">
      {/* ── Snapshot selector + status badge ───────────────── */}
      <Card>
        <CardContent className="pt-4 pb-4 px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">View:</label>
              <select
                value={selectedSnapshotId}
                onChange={(e) => setSelectedSnapshotId(e.target.value)}
                className="text-sm h-9 px-3 rounded border border-input bg-background min-w-[280px]"
              >
                <option value={LIVE_VALUE}>📈 Live (current model)</option>
                {(snapshots || []).map((s) => (
                  <option key={s.snapshot_id} value={String(s.snapshot_id)}>
                    🔒 {s.label || `Snapshot ${s.snapshot_id}`} —{" "}
                    {new Date(s.captured_at).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </option>
                ))}
              </select>
              {snapshots && snapshots.length === 0 && (
                <span className="text-[11px] text-muted-foreground italic">
                  No snapshots captured yet
                </span>
              )}
              {/* Delete button — only when a snapshot is selected */}
              {selectedSnapshotId !== LIVE_VALUE && (
                <button
                  type="button"
                  onClick={() => {
                    const sid = Number(selectedSnapshotId);
                    const sel = (snapshots || []).find((s) => s.snapshot_id === sid);
                    const label = sel?.label || `Snapshot ${sid}`;
                    if (
                      window.confirm(
                        `Delete this snapshot?\n\n"${label}"\n\nThis only deletes the ${projectionType.toUpperCase()} side. The paired ${projectionType === "lp" ? "GP" : "LP"} snapshot from the same capture event must be deleted separately.`,
                      )
                    ) {
                      deleteSnapshot.mutate(sid);
                    }
                  }}
                  disabled={deleteSnapshot.isPending}
                  className="text-[10px] px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
                  title="Delete this snapshot (Developer / GP Admin only)"
                >
                  <Trash2 className="h-3 w-3" />
                  {deleteSnapshot.isPending ? "Deleting…" : "Delete"}
                </button>
              )}
              {/* Waterfall toggle (live mode only) */}
              {selectedSnapshotId === LIVE_VALUE && (
                <div className="flex items-center gap-1.5 ml-2 border-l pl-3">
                  <label className="text-[10px] text-muted-foreground font-medium">Waterfall:</label>
                  <div className="flex items-center rounded border bg-background">
                    <button
                      type="button"
                      onClick={() => setWaterfallMode("simple_split")}
                      className={cn(
                        "px-2 py-1 text-[10px]",
                        waterfallMode === "simple_split" ? "bg-slate-700 text-white" : "hover:bg-muted",
                      )}
                      title="Simple LP/GP split of capital appreciation (matches typical syndicator deck)"
                    >
                      Simple Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaterfallMode("european")}
                      className={cn(
                        "px-2 py-1 text-[10px] border-l",
                        waterfallMode === "european" ? "bg-slate-700 text-white" : "hover:bg-muted",
                      )}
                      title="European 4-tier waterfall: ROC → Pref → Catch-up → Carry"
                    >
                      European
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              {isLive ? (
                <Badge variant="outline" className="text-[11px] gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Live model — recomputed on every load
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] gap-1 bg-amber-50 text-amber-800 border-amber-300">
                  <Lock className="h-3 w-3" />
                  Frozen at {view.captured_at?.slice(0, 10)} ({view.trigger})
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Live-mode warning when viewing GP tab ─────────── */}
      {isLive && projectionType === "gp" && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <strong>Live view shows the pre-split portfolio cash flow only.</strong>{" "}
                The GP-specific projection (promote, catch-up, fees) is materialized only when a snapshot is captured.
                To see the live GP projection, capture a snapshot from the Tranches tab — even an interim one.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading projection…</div>
      ) : !view.primary ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No projection data available for this view.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Headline KPI cards ───────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              label={projectionType === "lp" ? "LP Total Distributions" : "GP Total Take"}
              value={fmt(view.primary.total_distributed)}
              sub={projectionType === "lp" ? `vs ${fmt(view.primary.paid_in)} paid in` : "promote + catch-up"}
              color="text-green-700"
              border="border-l-green-500"
            />
            <KPICard
              label={projectionType === "lp" ? "LP Equity Multiple" : "GP Multiple"}
              value={fmtMultiple(view.primary.equity_multiple)}
              sub={projectionType === "lp" ? "Distributions / Paid-in" : "GP put up no equity"}
              color="text-indigo-700"
              border="border-l-indigo-500"
            />
            <KPICard
              label="Annualized Return"
              value={fmtPct(view.primary.annualized_roi)}
              sub="Compounded annually"
              color="text-purple-700"
              border="border-l-purple-500"
            />
            <KPICard
              label="Net Profit"
              value={fmt(view.kind === "snapshot" && view.primary.total_distributed != null && view.primary.paid_in != null && projectionType === "lp"
                ? view.primary.total_distributed - view.primary.paid_in
                : view.primary.total_distributed)}
              sub={projectionType === "lp" ? "After return of capital" : "All GP take is profit"}
              color="text-emerald-700"
              border="border-l-emerald-500"
            />
          </div>

          {/* ── Waterfall tier breakdown (snapshot only) ─── */}
          {view.kind === "snapshot" && (view as any).waterfall_split && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Waterfall Tier Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
                  <TierBlock label="Tier 1 — Return of Capital" value={(view as any).waterfall_split.tier_breakdown?.tier1_return_of_capital} all="LP" />
                  <TierBlock label="Tier 2 — Preferred Return" value={(view as any).waterfall_split.tier_breakdown?.tier2_preferred_return} all="LP" />
                  <TierBlock
                    label="Tier 3 — GP Catch-up"
                    value={
                      projectionType === "lp"
                        ? (view as any).waterfall_split.tier_breakdown?.tier3_lp_share
                        : (view as any).waterfall_split.tier_breakdown?.tier3_gp_share
                    }
                  />
                  <TierBlock
                    label="Tier 4 — Carry Split"
                    value={
                      projectionType === "lp"
                        ? (view as any).waterfall_split.tier_breakdown?.tier4_lp_share
                        : (view as any).waterfall_split.tier_breakdown?.tier4_gp_share
                    }
                  />
                </div>
                <div className="mt-3 pt-3 border-t text-[10px] text-muted-foreground">
                  <strong>Waterfall inputs:</strong>{" "}
                  {(view as any).waterfall_split.waterfall_inputs?.preferred_return_rate_pct}% pref &middot;{" "}
                  {(view as any).waterfall_split.waterfall_inputs?.gp_promote_pct}% promote &middot;{" "}
                  {(view as any).waterfall_split.waterfall_inputs?.gp_catchup_pct}% catch-up &middot;{" "}
                  {(view as any).waterfall_split.waterfall_inputs?.lp_split_pct}% LP carry split &middot;{" "}
                  {(view as any).waterfall_split.waterfall_inputs?.hold_years}-year hold
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Snapshot context (when frozen) ────────────── */}
          {view.kind === "snapshot" && (view as any).tranche && (
            <Card className="bg-muted/30">
              <CardContent className="pt-3 pb-3 px-4">
                <p className="text-[11px] text-muted-foreground italic">
                  This is the projection that was shown to investors who subscribed under{" "}
                  <strong>{(view as any).tranche.tranche_name || `Tranche ${(view as any).tranche.tranche_number}`}</strong>
                  {(view as any).tranche.closing_date && <> at its close on <strong>{(view as any).tranche.closing_date}</strong></>}.
                  All numbers are frozen as of the capture date and will not change even if the underlying model is updated.
                  {view.notes && <span className="block mt-1">Notes: {view.notes}</span>}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Full investor pro forma ─────────────────────────── */}
      {(() => {
        // Pull proforma from either live endpoint or the snapshot's frozen payload
        const snapshotProforma = (snapshotDetail as any)?.payload?.investor_proforma;
        const proformaData: ProformaData | null = isLive
          ? (liveProforma as ProformaData) || null
          : snapshotProforma || null;

        if (!proformaData) {
          if (!isLive && snapshotDetail) {
            return (
              <Card className="border-amber-300 bg-amber-50/40">
                <CardContent className="pt-3 pb-3 px-4">
                  <p className="text-[11px] text-amber-900">
                    <strong>This snapshot was captured before the investor pro forma was available.</strong>{" "}
                    Snapshots taken from now on will include the full year-by-year LP investor pro forma.
                    Switch to <em>Live</em> view above to see the current pro forma.
                  </p>
                </CardContent>
              </Card>
            );
          }
          return null;
        }
        // GP tab gets the GP-focused compensation view; LP tab gets the
        // institutional investor pro forma.
        if (projectionType === "gp") {
          // GP view needs gp_compensation + gp_sensitivity which live on the
          // same proforma payload
          const gpData = proformaData as unknown as GPCompensationData;
          if (!(gpData as any).gp_compensation) {
            return (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">GP compensation data not available in this snapshot.</p>
                </CardContent>
              </Card>
            );
          }
          return <GPCompensationView data={gpData} />;
        }
        return <LPInvestorProforma data={proformaData} />;
      })()}

      {!snapshots || snapshots.length === 0 ? (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-3 pb-3 px-4">
            <p className="text-[11px] text-blue-900">
              <strong>How frozen snapshots work:</strong> When you close a tranche, the system
              automatically captures the LP and GP projections at that moment. You can also manually
              capture a snapshot from the Tranches tab. Each snapshot preserves the exact projection
              an investor saw on Day 1, even years later.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function KPICard({
  label, value, sub, color, border,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  border?: string;
}) {
  return (
    <Card className={cn("border-l-4", border || "border-l-slate-400")}>
      <CardContent className="pt-3 pb-3 px-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-2xl font-bold mt-0.5", color || "text-slate-700")}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function TierBlock({ label, value, all }: { label: string; value: number | null | undefined; all?: string }) {
  return (
    <div className="rounded border bg-card p-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-semibold tabular-nums mt-0.5">{fmt(value)}</p>
      {all && <p className="text-[9px] text-muted-foreground mt-0.5">→ all to {all}</p>}
    </div>
  );
}
