"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { BarChart2, Building2, DollarSign, Home, TrendingUp, Users, Wrench } from "lucide-react";
import { useReportSummary } from "@/hooks/useReports";
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
