"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  BedDouble,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OccupancyData {
  total_beds: number;
  occupied: number;
  available: number;
  maintenance: number;
  reserved: number;
  occupancy_rate: number;
  monthly_potential_rent: number;
  monthly_occupied_rent: number;
}

interface RevenueData {
  total_billed: number;
  collected: number;
  pending: number;
  overdue: number;
  meal_plan_revenue: number;
  collection_rate: number;
  payment_count: number;
}

interface ExpenseData {
  total_expenses: number;
  by_category: Record<string, number>;
  expense_count: number;
}

interface BudgetComparison {
  has_budget: boolean;
  budgeted_revenue?: number;
  budgeted_expenses?: number;
  budgeted_noi?: number;
  actual_revenue?: number;
  actual_expenses?: number;
  actual_noi?: number;
  revenue_variance?: number;
  expense_variance?: number;
  noi_variance?: number;
}

interface PnlSummary {
  gross_revenue: number;
  collected_revenue: number;
  total_expenses: number;
  noi: number;
  revenue_per_occupied_bed: number;
  expense_ratio: number;
}

interface CommunityPnl {
  community_id: number;
  community_name: string;
  city: string;
  province: string;
  year: number;
  month: number | null;
  occupancy: OccupancyData;
  revenue: RevenueData;
  expenses: ExpenseData;
  budget_comparison: BudgetComparison;
  summary: PnlSummary;
}

interface PortfolioSummary {
  year: number;
  community_count: number;
  communities: CommunityPnl[];
  portfolio_totals: {
    total_beds: number;
    occupied_beds: number;
    gross_revenue: number;
    collected_revenue: number;
    total_expenses: number;
    noi: number;
    occupancy_rate: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmt = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KPI({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
          {sub && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {trend === "up" && (
                <ArrowUpRight className="h-3 w-3 text-green-600" />
              )}
              {trend === "down" && (
                <ArrowDownRight className="h-3 w-3 text-red-600" />
              )}
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Community P&L Card                                                 */
/* ------------------------------------------------------------------ */

function CommunityCard({ pnl }: { pnl: CommunityPnl }) {
  const { occupancy: occ, summary: s, expenses: exp, budget_comparison: bud } = pnl;
  const expCategories = Object.entries(exp.by_category).sort(
    ([, a], [, b]) => b - a
  );
  const maxExp = expCategories.length > 0 ? expCategories[0][1] : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{pnl.community_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {pnl.city}, {pnl.province}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-green-700">
              {fmt(s.noi)}
            </p>
            <p className="text-xs text-muted-foreground">Net Operating Income</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Occupancy */}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Bed Occupancy</span>
            <span className="font-bold tabular-nums">
              {occ.occupied}/{occ.total_beds} ({fmtPct(occ.occupancy_rate)})
            </span>
          </div>
          <Progress value={occ.occupancy_rate} className="h-2.5" />
          <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Occupied: {occ.occupied}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              Available: {occ.available}
            </span>
            {occ.maintenance > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                Maintenance: {occ.maintenance}
              </span>
            )}
          </div>
        </div>

        {/* P&L Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Collected Revenue</p>
            <p className="text-lg font-bold tabular-nums">{fmt(s.collected_revenue)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtPct(pnl.revenue.collection_rate)} collection rate
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-lg font-bold tabular-nums">{fmt(s.total_expenses)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtPct(s.expense_ratio)} of revenue
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Rev / Occupied Bed</p>
            <p className="text-lg font-bold tabular-nums">
              {fmt(s.revenue_per_occupied_bed)}
            </p>
            <p className="text-xs text-muted-foreground">monthly average</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Monthly Potential</p>
            <p className="text-lg font-bold tabular-nums">
              {fmt(occ.monthly_potential_rent)}
            </p>
            <p className="text-xs text-muted-foreground">at full occupancy</p>
          </div>
        </div>

        {/* Expense Breakdown */}
        {expCategories.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Expense Breakdown</p>
            <div className="space-y-2">
              {expCategories.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize">
                      {cat.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium tabular-nums">{fmt(amt)}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-red-400"
                      style={{ width: `${(amt / maxExp) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget vs Actual */}
        {bud.has_budget && (
          <div>
            <p className="mb-2 text-sm font-medium">Budget vs Actual</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-1.5 font-medium">Metric</th>
                    <th className="pb-1.5 text-right font-medium">Budget</th>
                    <th className="pb-1.5 text-right font-medium">Actual</th>
                    <th className="pb-1.5 text-right font-medium">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-1.5">Revenue</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fmt(bud.budgeted_revenue ?? 0)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fmt(bud.actual_revenue ?? 0)}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        (bud.revenue_variance ?? 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {fmt(bud.revenue_variance ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5">Expenses</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fmt(bud.budgeted_expenses ?? 0)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fmt(bud.actual_expenses ?? 0)}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        (bud.expense_variance ?? 0) <= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {fmt(bud.expense_variance ?? 0)}
                    </td>
                  </tr>
                  <tr className="font-medium">
                    <td className="py-1.5">NOI</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fmt(bud.budgeted_noi ?? 0)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fmt(bud.actual_noi ?? 0)}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        (bud.noi_variance ?? 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {fmt(bud.noi_variance ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function OperationsPage() {
  const [year, setYear] = useState(2025);

  const { data, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ["operations-summary", year],
    queryFn: async () => {
      const res = await apiClient.get(
        `/api/community/operations/portfolio-summary?year=${year}`
      );
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totals = data?.portfolio_totals;
  const communities = data?.communities ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interim Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            P&L, occupancy, and expense analysis across all communities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Year:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
      </div>

      {/* Portfolio KPIs */}
      {totals && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <KPI
            label="Communities"
            value={String(data?.community_count ?? 0)}
            icon={Building2}
          />
          <KPI
            label="Total Beds"
            value={`${totals.occupied_beds}/${totals.total_beds}`}
            sub={`${fmtPct(totals.occupancy_rate)} occupancy`}
            icon={BedDouble}
            trend={totals.occupancy_rate >= 90 ? "up" : "down"}
          />
          <KPI
            label="Gross Revenue"
            value={fmtCompact(totals.gross_revenue)}
            icon={DollarSign}
          />
          <KPI
            label="Collected"
            value={fmtCompact(totals.collected_revenue)}
            sub={
              totals.gross_revenue > 0
                ? `${fmtPct(
                    (totals.collected_revenue / totals.gross_revenue) * 100
                  )} rate`
                : ""
            }
            icon={TrendingUp}
            trend="up"
          />
          <KPI
            label="Expenses"
            value={fmtCompact(totals.total_expenses)}
            icon={TrendingDown}
          />
          <KPI
            label="Portfolio NOI"
            value={fmtCompact(totals.noi)}
            sub={
              totals.collected_revenue > 0
                ? `${fmtPct(
                    (totals.noi / totals.collected_revenue) * 100
                  )} margin`
                : ""
            }
            icon={BarChart3}
            trend={totals.noi > 0 ? "up" : "down"}
          />
        </div>
      )}

      {/* Community Cards */}
      <Tabs defaultValue="all">
        <TabsList variant="line">
          <TabsTrigger value="all">All Communities</TabsTrigger>
          {communities.map((c) => (
            <TabsTrigger key={c.community_id} value={String(c.community_id)}>
              {c.community_name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {communities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No operations data available for {year}.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {communities.map((c) => (
                <CommunityCard key={c.community_id} pnl={c} />
              ))}
            </div>
          )}
        </TabsContent>

        {communities.map((c) => (
          <TabsContent
            key={c.community_id}
            value={String(c.community_id)}
            className="mt-4"
          >
            <CommunityCard pnl={c} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
