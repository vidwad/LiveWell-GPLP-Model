"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { BarChart2, Building2, DollarSign, Home, TrendingUp, Users, Wrench, AlertTriangle } from "lucide-react";
import { useReportSummary, useManagementPack } from "@/hooks/useReports";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/utils";

const STAGE_COLORS: Record<string, string> = {
  acquisition: "#f59e0b",
  planning: "#3b82f6",
  construction: "#8b5cf6",
  stabilized: "#10b981",
};
const TYPE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];
const STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  in_progress: "#f59e0b",
  resolved: "#10b981",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-lg font-semibold">{children}</h2>
  );
}

export default function ReportsPage() {
  const { data, isLoading } = useReportSummary();
  const { data: pack } = useManagementPack();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-6xl space-y-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart2 className="h-6 w-6 text-primary" />
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground">Platform-wide performance summary</p>
      </div>

      {/* KPI grid */}
      <section>
        <SectionHeading>Key Metrics</SectionHeading>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Properties" value={data.total_properties} icon={Building2} />
          <KpiCard label="Communities" value={data.total_communities} icon={Home} />
          <KpiCard label="Total Units" value={data.total_units} icon={Home} description={`${data.occupied_units} occupied`} />
          <KpiCard label="Occupancy Rate" value={`${data.occupancy_rate}%`} icon={Users} />
          <KpiCard label="Total Residents" value={data.total_residents} icon={Users} />
          <KpiCard label="Investors" value={data.total_investors} icon={TrendingUp} />
          <KpiCard label="Rent Collected" value={formatCurrency(data.total_rent_collected)} icon={DollarSign} />
          <KpiCard
            label="Maintenance Resolved"
            value={`${data.maintenance_resolution_rate}%`}
            icon={Wrench}
            description="Resolution rate"
          />
        </div>
      </section>

      {/* Capital summary */}
      <section>
        <SectionHeading>Capital Summary</SectionHeading>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Contributed", value: formatCurrency(data.total_funded) },
            { label: "Total Distributed", value: formatCurrency(data.total_distributed) },
            { label: "Net Deployed", value: formatCurrency(data.net_invested) },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Charts row 1: Occupancy + Stage */}
      <section>
        <SectionHeading>Portfolio Overview</SectionHeading>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Occupancy by community */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Occupancy by Community</CardTitle>
            </CardHeader>
            <CardContent>
              {data.community_occupancy.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.community_occupancy} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="occupied" fill="#10b981" radius={[4, 4, 0, 0]} name="Occupied" />
                    <Bar dataKey="vacant" fill="#e5e7eb" radius={[4, 4, 0, 0]} name="Vacant" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Portfolio stage breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Portfolio by Development Stage</CardTitle>
            </CardHeader>
            <CardContent>
              {data.stage_breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.stage_breakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="count"
                      nameKey="stage"
                    >
                      {data.stage_breakdown.map((entry) => (
                        <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? "#6b7280"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [v, String(name)]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Charts row 2: Revenue + Capital timeline */}
      <section>
        <SectionHeading>Financial Trends</SectionHeading>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Monthly rent revenue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Monthly Rent Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {data.monthly_revenue.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.monthly_revenue} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v) => [formatCurrency(v as number), "Revenue"]} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Capital timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Capital Contributions Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {data.capital_timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contribution data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.capital_timeline} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(v) => [formatCurrency(v as number), "Contributed"]} />
                    <Bar dataKey="contributed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Management Pack */}
      {pack && (
        <section>
          <SectionHeading>GP Management Pack</SectionHeading>
          <div className="space-y-4">
            {/* LP Summary */}
            {pack.lp_summary && pack.lp_summary.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">LP Fund Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-semibold text-muted-foreground">Fund</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Properties</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Total Value</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Total Debt</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Equity</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">NOI</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">LTV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pack.lp_summary.map((lp: {
                          lp_id: number;
                          lp_name: string;
                          property_count: number;
                          total_value: number;
                          total_debt: number;
                          total_equity: number;
                          total_noi: number;
                          portfolio_ltv: number;
                        }) => (
                          <tr key={lp.lp_id}>
                            <td className="py-2 font-medium">{lp.lp_name}</td>
                            <td className="py-2 text-right">{lp.property_count}</td>
                            <td className="py-2 text-right">{formatCurrency(lp.total_value)}</td>
                            <td className="py-2 text-right">{formatCurrency(lp.total_debt)}</td>
                            <td className="py-2 text-right">{formatCurrency(lp.total_equity)}</td>
                            <td className="py-2 text-right">{formatCurrency(lp.total_noi)}</td>
                            <td className="py-2 text-right">{Number(lp.portfolio_ltv).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Budget Issues */}
            {pack.budget_issues && pack.budget_issues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Budget Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-semibold text-muted-foreground">Community</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Year</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Budget</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Actual</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pack.budget_issues.map((issue: {
                          community_id: number;
                          community_name: string;
                          fiscal_year: number;
                          total_budget: number;
                          total_actual: number;
                          variance: number;
                        }, i: number) => (
                          <tr key={i}>
                            <td className="py-2 font-medium">{issue.community_name}</td>
                            <td className="py-2 text-right">{issue.fiscal_year}</td>
                            <td className="py-2 text-right">{formatCurrency(issue.total_budget)}</td>
                            <td className="py-2 text-right">{formatCurrency(issue.total_actual)}</td>
                            <td className="py-2 text-right text-red-600 font-semibold">
                              {formatCurrency(issue.variance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dev Update */}
            {pack.dev_update && pack.dev_update.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Development Update</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-semibold text-muted-foreground">Property</th>
                          <th className="pb-2 font-semibold text-muted-foreground">Stage</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Purchase Price</th>
                          <th className="pb-2 font-semibold text-muted-foreground text-right">Market Value</th>
                          <th className="pb-2 font-semibold text-muted-foreground">Active Plan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pack.dev_update.map((prop: {
                          property_id: number;
                          address: string;
                          city: string;
                          development_stage: string;
                          purchase_price: number | null;
                          current_market_value: number | null;
                          active_plan: string | null;
                        }) => (
                          <tr key={prop.property_id}>
                            <td className="py-2 font-medium">{prop.address}, {prop.city}</td>
                            <td className="py-2">
                              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                {prop.development_stage}
                              </span>
                            </td>
                            <td className="py-2 text-right">{prop.purchase_price ? formatCurrency(prop.purchase_price) : "—"}</td>
                            <td className="py-2 text-right">{prop.current_market_value ? formatCurrency(prop.current_market_value) : "—"}</td>
                            <td className="py-2 text-muted-foreground">{prop.active_plan ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Charts row 3: Maintenance + Community types */}
      <section>
        <SectionHeading>Operations</SectionHeading>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Maintenance by status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Maintenance Requests by Status</CardTitle>
            </CardHeader>
            <CardContent>
              {data.maintenance_by_status.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={data.maintenance_by_status}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v) => [v, "Requests"]} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {data.maintenance_by_status.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Community type distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Community Type Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {data.community_type_breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No communities yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data.community_type_breakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="count"
                      nameKey="type"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {data.community_type_breakdown.map((entry, idx) => (
                        <Cell key={entry.type} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
