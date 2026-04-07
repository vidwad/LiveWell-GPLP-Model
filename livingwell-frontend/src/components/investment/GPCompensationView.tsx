"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, AlertCircle, Banknote, Percent, Activity } from "lucide-react";

const fmt = (n: number | null | undefined) =>
  n != null
    ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n)
    : "—";
const fmtPct = (n: number | null | undefined, digits = 1) =>
  n != null ? `${Number(n).toFixed(digits)}%` : "—";

export interface GPCompensationData {
  lp_name?: string;
  hold_years: number;
  waterfall_mode: string;
  gp_compensation: {
    year_rows: any[];
    totals: {
      acquisition_fee: number;
      annual_management_fee: number;
      construction_management_fee: number;
      refinance_fee: number;
      disposition_fee: number;
      promote: number;
      total_fee_income: number;
      total_gp_take: number;
    };
    composition: {
      total_profit_pool: number;
      lp_share: number;
      gp_share: number;
      gp_pct_of_profit: number | null;
      gp_per_dollar_lp: number | null;
      gp_annual_yield_pct: number | null;
      fee_income_pct_of_gp_take: number | null;
      promote_pct_of_gp_take: number | null;
    };
  };
  gp_sensitivity: any[];
  fee_assumptions: any;
  summary: any;
}

interface Props {
  data: GPCompensationData;
}

export function GPCompensationView({ data }: Props) {
  const { gp_compensation: gp, gp_sensitivity: sens, fee_assumptions: fees, summary } = data;
  const yearRows = gp.year_rows || [];
  const totals = gp.totals;
  const comp = gp.composition;

  if (yearRows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No GP compensation data available — add properties and configure LP fee assumptions to populate this view.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── KPI BAND ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          label="Total GP Take"
          value={fmt(totals.total_gp_take)}
          sub={`Across ${data.hold_years} years`}
          color="text-emerald-700"
          border="border-l-emerald-500"
        />
        <KPI
          label="Total Promote"
          value={fmt(totals.promote)}
          sub={
            comp.promote_pct_of_gp_take != null
              ? `${comp.promote_pct_of_gp_take}% of GP take`
              : "Variable upside"
          }
          color="text-indigo-700"
          border="border-l-indigo-500"
        />
        <KPI
          label="GP % of Total Profit"
          value={fmtPct(comp.gp_pct_of_profit)}
          sub={comp.gp_pct_of_profit && comp.gp_pct_of_profit >= 25 ? "Healthy economics" : "Below typical"}
          color="text-purple-700"
          border="border-l-purple-500"
        />
        <KPI
          label="GP Annual Yield on LP $"
          value={fmtPct(comp.gp_annual_yield_pct)}
          sub="Effective annual GP draw"
          color="text-amber-700"
          border="border-l-amber-500"
        />
      </div>

      {/* ── 1. GP COMPENSATION BUILD-UP TABLE ─────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            GP Compensation Build-Up
            <Badge variant="outline" className="ml-1 text-[10px]">Year-by-year breakdown</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="py-2 pl-3 pr-2 text-left text-xs font-semibold sticky left-0 bg-slate-800">
                  Revenue Stream
                </th>
                {yearRows.map((y) => (
                  <th key={y.year_number} className="py-2 px-2 text-right text-xs font-semibold">
                    Year {y.year_number}
                    <div className="text-[9px] font-normal opacity-80">{y.calendar_year}</div>
                  </th>
                ))}
                <th className="py-2 px-2 text-right text-xs font-semibold border-l border-slate-600">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Recurring fee block */}
              <tr className="bg-slate-100">
                <td colSpan={yearRows.length + 2} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                  Contractual Fee Income (paid regardless of performance)
                </td>
              </tr>
              <FeeRow
                label="Acquisition Fee"
                hint={`${fees.acquisition_fee_pct}% of equity (one-time, Y1)`}
                values={yearRows.map((y) => y.acquisition_fee)}
                total={totals.acquisition_fee}
              />
              <FeeRow
                label="Annual Management Fee"
                hint={`${fees.annual_management_fee_pct}% of revenue (recurring)`}
                values={yearRows.map((y) => y.annual_management_fee)}
                total={totals.annual_management_fee}
              />
              <FeeRow
                label="Construction Mgmt Fee"
                hint={`${fees.construction_management_fee_pct}% of construction cost`}
                values={yearRows.map((y) => y.construction_management_fee)}
                total={totals.construction_management_fee}
              />
              <FeeRow
                label="Refinance Fee"
                hint={`${fees.refinancing_fee_pct}% of refi proceeds`}
                values={yearRows.map((y) => y.refinance_fee)}
                total={totals.refinance_fee}
              />
              <FeeRow
                label="Disposition / Brokerage Fee"
                hint={`${fees.selling_commission_pct}% of sale price (exit year)`}
                values={yearRows.map((y) => y.disposition_fee)}
                total={totals.disposition_fee}
              />
              <FeeRow
                label="Total Fee Income"
                values={yearRows.map((y) => y.fee_income_subtotal)}
                total={totals.total_fee_income}
                isSubtotal
                className="bg-blue-50 font-semibold"
              />

              {/* Performance / promote block */}
              <tr className="bg-slate-100">
                <td colSpan={yearRows.length + 2} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                  Performance Compensation (variable, paid only after LP hurdle)
                </td>
              </tr>
              <FeeRow
                label="Promote / Carried Interest"
                hint={`${fees.gp_promote_pct}% promote (${data.waterfall_mode === "european" ? "European waterfall" : "simple split"})`}
                values={yearRows.map((y) => y.promote)}
                total={totals.promote}
                className="bg-indigo-50/40"
              />

              {/* TOTAL ROW */}
              <FeeRow
                label="TOTAL GP TAKE"
                values={yearRows.map((y) => y.total_gp_take)}
                total={totals.total_gp_take}
                isSubtotal
                className="bg-emerald-100 font-bold text-emerald-900"
              />
              <tr className="text-[10px] text-muted-foreground italic">
                <td className="py-1 pl-3 pr-2">
                  Cumulative GP take
                </td>
                {yearRows.map((y, i) => (
                  <td key={i} className="py-1 px-2 text-right tabular-nums">
                    {fmt(y.cumulative_gp_take)}
                  </td>
                ))}
                <td className="py-1 px-2 text-right tabular-nums border-l">
                  {fmt(totals.total_gp_take)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── 2. PROMOTE COMPOSITION ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            Profit Pool Composition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <CompCell label="Total Profit Pool" value={fmt(comp.total_profit_pool)} sub="LP profit + GP take" />
            <CompCell
              label="LP Share"
              value={fmt(comp.lp_share)}
              sub={`${(100 - (comp.gp_pct_of_profit || 0)).toFixed(1)}% of pool`}
              color="text-blue-700"
            />
            <CompCell
              label="GP Share"
              value={fmt(comp.gp_share)}
              sub={`${comp.gp_pct_of_profit || 0}% of pool`}
              color="text-emerald-700"
            />
            <CompCell
              label="GP $ per $1 LP"
              value={comp.gp_per_dollar_lp != null ? `$${comp.gp_per_dollar_lp.toFixed(2)}` : "—"}
              sub="GP take / paid-in LP equity"
            />
          </div>

          {/* Visual stacked bar */}
          {comp.total_profit_pool > 0 && (
            <div className="space-y-1">
              <div className="flex h-7 rounded overflow-hidden border">
                <div
                  className="bg-blue-500 text-white text-[10px] flex items-center justify-center"
                  style={{ width: `${(comp.lp_share / comp.total_profit_pool) * 100}%` }}
                  title={`LP: ${fmt(comp.lp_share)}`}
                >
                  LP {(100 - (comp.gp_pct_of_profit || 0)).toFixed(0)}%
                </div>
                <div
                  className="bg-emerald-500 text-white text-[10px] flex items-center justify-center"
                  style={{ width: `${(comp.gp_share / comp.total_profit_pool) * 100}%` }}
                  title={`GP: ${fmt(comp.gp_share)}`}
                >
                  GP {(comp.gp_pct_of_profit || 0).toFixed(0)}%
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Industry benchmark: <strong>20-35% GP share</strong> of total profit is typical for value-add multifamily.
                {comp.gp_pct_of_profit != null && comp.gp_pct_of_profit < 20 && (
                  <span className="text-amber-700"> This deal is below the typical range — consider whether the operational lift justifies the GP economics.</span>
                )}
                {comp.gp_pct_of_profit != null && comp.gp_pct_of_profit > 35 && (
                  <span className="text-amber-700"> This deal is above the typical range — may face investor pushback.</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. PROMOTE SENSITIVITY ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Promote Sensitivity to NOI Variance
            <Badge variant="outline" className="ml-1 text-[10px]">Risk view</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="py-2 pl-3 pr-2 text-left">Scenario</th>
                <th className="py-2 px-2 text-right">Sale Price</th>
                <th className="py-2 px-2 text-right">Net Proceeds</th>
                <th className="py-2 px-2 text-right">Profit Pool</th>
                <th className="py-2 px-2 text-center">LP Hurdle</th>
                <th className="py-2 px-2 text-right">LP Distributions</th>
                <th className="py-2 px-2 text-right">GP Promote</th>
                <th className="py-2 px-2 text-right border-l border-slate-600">GP Total Take</th>
              </tr>
            </thead>
            <tbody>
              {sens.map((s, i) => {
                const isBase = s.noi_variance_pct === 0;
                return (
                  <tr key={i} className={cn(isBase && "bg-yellow-50 font-semibold")}>
                    <td className="py-2 pl-3 pr-2">
                      <span className={cn(
                        "inline-flex items-center gap-1",
                        s.color === "red" && "text-red-600",
                        s.color === "amber" && "text-amber-600",
                        s.color === "blue" && "text-blue-600",
                        s.color === "green" && "text-green-700",
                      )}>
                        {s.color === "red" || s.color === "amber" ? <TrendingDown className="h-3 w-3" /> : null}
                        {s.color === "blue" || s.color === "green" ? <TrendingUp className="h-3 w-3" /> : null}
                        {s.label}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmt(s.sale_price)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmt(s.net_proceeds)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmt(s.profit_pool)}</td>
                    <td className="py-2 px-2 text-center">
                      {s.lp_hurdle_met ? (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-300">✓ Met</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-300">✗ Missed</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{fmt(s.lp_distributions)}</td>
                    <td className={cn("py-2 px-2 text-right tabular-nums", !s.lp_hurdle_met && "text-red-600")}>
                      {fmt(s.gp_promote)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold border-l">{fmt(s.gp_total_take)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground italic mt-2 px-3">
            ⚠ <strong>Promote crush risk:</strong> If LP fails to receive return of capital
            {data.waterfall_mode === "european" ? " plus preferred return" : ""}, GP promote falls to zero.
            GP fee income remains contractual regardless of scenario.
          </p>
        </CardContent>
      </Card>

      {/* ── 4. FEE SCHEDULE FOOTER ─────────────────────────── */}
      <Card className="bg-muted/30">
        <CardContent className="pt-3 pb-3 px-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            LP Fee Schedule (configured on this LP)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[10px]">
            <Fact label="Acquisition Fee" value={`${fees.acquisition_fee_pct}%`} warn={fees.acquisition_fee_pct === 0} />
            <Fact label="Selling Commission" value={`${fees.selling_commission_pct}%`} warn={fees.selling_commission_pct === 0} />
            <Fact label="Annual Mgmt Fee" value={`${fees.annual_management_fee_pct}% of EGI`} warn={fees.annual_management_fee_pct === 0} />
            <Fact label="Construction Mgmt Fee" value={`${fees.construction_management_fee_pct}%`} warn={fees.construction_management_fee_pct === 0} />
            <Fact label="Refinancing Fee" value={`${fees.refinancing_fee_pct}%`} warn={fees.refinancing_fee_pct === 0} />
            <Fact label="LP / GP Profit Split" value={`${fees.lp_profit_share_pct}% / ${fees.gp_profit_share_pct}%`} />
            <Fact label="Preferred Return" value={`${fees.preferred_return_rate_pct}%`} />
            <Fact label="GP Promote" value={`${fees.gp_promote_pct}%`} />
          </div>
          {(fees.acquisition_fee_pct === 0 || fees.annual_management_fee_pct === 0) && (
            <div className="mt-2 flex items-start gap-2 text-[10px] text-amber-800">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>One or more fee rates are not configured on this LP. Edit the LP setup to populate them — the GP comp build-up will recalculate automatically.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, sub, color, border }: { label: string; value: string; sub?: string; color?: string; border?: string }) {
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

function FeeRow({
  label, hint, values, total, isSubtotal, className,
}: {
  label: string;
  hint?: string;
  values: number[];
  total: number;
  isSubtotal?: boolean;
  className?: string;
}) {
  return (
    <tr className={cn(className)}>
      <td className={cn("py-1.5 pl-3 pr-2 text-xs sticky left-0 bg-inherit", isSubtotal && "font-semibold")}>
        {label}
        {hint && <div className="text-[9px] text-muted-foreground italic font-normal">{hint}</div>}
      </td>
      {values.map((v, i) => (
        <td key={i} className="py-1.5 px-2 text-right tabular-nums text-xs">
          {v && v !== 0 ? fmt(v) : "—"}
        </td>
      ))}
      <td className="py-1.5 px-2 text-right tabular-nums text-xs font-semibold border-l">
        {total !== 0 ? fmt(total) : "—"}
      </td>
    </tr>
  );
}

function CompCell({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={cn("text-xl font-bold mt-0.5", color || "text-slate-700")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn(warn && "text-amber-700")}>
      <span className="text-muted-foreground">{label}:</span> <strong>{value}</strong>
    </div>
  );
}
