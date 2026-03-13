"use client";

import { Building2, Users, Wrench, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useProperties } from "@/hooks/usePortfolio";
import { useCommunities, useMaintenanceRequests } from "@/hooks/useCommunities";
import { useInvestors, useInvestorDashboard } from "@/hooks/useInvestors";
import { useAuth } from "@/providers/AuthProvider";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STAGE_COLORS: Record<string, string> = {
  prospect: "#9ca3af",
  acquisition: "#f59e0b",
  interim_operation: "#f97316",
  planning: "#3b82f6",
  permit: "#a855f7",
  construction: "#8b5cf6",
  lease_up: "#06b6d4",
  stabilized: "#10b981",
  exit: "#6b7280",
};

const TYPE_COLORS = ["#10b981", "#3b82f6", "#f59e0b"];

const STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  in_progress: "#f59e0b",
  resolved: "#10b981",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: properties, isLoading: propsLoading } = useProperties();
  const { data: communities, isLoading: commsLoading } = useCommunities();
  const { data: maintenance, isLoading: maintLoading } = useMaintenanceRequests();
  const { data: investors, isLoading: invLoading } = useInvestors();
  const isInvestor = user?.role === "INVESTOR";
  const { data: dashboard } = useInvestorDashboard(isInvestor ? undefined : undefined);

  const openIssues = maintenance?.filter((m) => m.status === "open").length ?? 0;
  const isLoading = propsLoading || commsLoading || maintLoading;

  // Chart data derived from API results
  const stageData = properties
    ? Object.entries(
        properties.reduce<Record<string, number>>((acc, p) => {
          acc[p.development_stage] = (acc[p.development_stage] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([stage, count]) => ({ stage, count }))
    : [];

  const communityTypeData = communities
    ? Object.entries(
        communities.reduce<Record<string, number>>((acc, c) => {
          acc[c.community_type] = (acc[c.community_type] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([type, value]) => ({ name: type, value }))
    : [];

  const maintenanceData = maintenance
    ? [
        { status: "Open", count: maintenance.filter((m) => m.status === "open").length, fill: STATUS_COLORS.open },
        { status: "In Progress", count: maintenance.filter((m) => m.status === "in_progress").length, fill: STATUS_COLORS.in_progress },
        { status: "Resolved", count: maintenance.filter((m) => m.status === "resolved").length, fill: STATUS_COLORS.resolved },
      ].filter((d) => d.count > 0)
    : [];

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const showPortfolioCharts = user?.role !== "RESIDENT" && user?.role !== "INVESTOR";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground">Here&apos;s an overview of your portfolio.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {showPortfolioCharts && (
          <>
            <KpiCard
              label="Properties"
              value={properties?.length ?? 0}
              icon={Building2}
              description="Total portfolio"
            />
            <KpiCard
              label="Communities"
              value={communities?.length ?? 0}
              icon={Users}
              description="Active communities"
            />
          </>
        )}
        <KpiCard
          label="Open Issues"
          value={openIssues}
          icon={Wrench}
          description="Maintenance requests"
        />
        {(user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER") && !invLoading && (
          <KpiCard
            label="Investors"
            value={investors?.length ?? 0}
            icon={TrendingUp}
            description="Registered investors"
          />
        )}
        {isInvestor && dashboard && (
          <>
            <KpiCard
              label="Total Committed"
              value={formatCurrency(dashboard.total_committed)}
              icon={TrendingUp}
            />
            <KpiCard
              label="Total Funded"
              value={formatCurrency(dashboard.total_funded)}
              icon={TrendingUp}
            />
            <KpiCard
              label="Net Position"
              value={formatCurrency(dashboard.net_position)}
              icon={TrendingUp}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      {showPortfolioCharts && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Portfolio stage bar chart */}
          {stageData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Portfolio by Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stageData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(v) => [v, "Properties"]}
                      labelFormatter={(l) => String(l).charAt(0).toUpperCase() + String(l).slice(1)}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stageData.map((entry) => (
                        <Cell
                          key={entry.stage}
                          fill={STAGE_COLORS[entry.stage] ?? "#6b7280"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Community type pie chart */}
          {communityTypeData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Community Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={communityTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      dataKey="value"
                      nameKey="name"
                    >
                      {communityTypeData.map((entry, idx) => (
                        <Cell key={entry.name} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Maintenance status bar chart */}
          {maintenanceData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Maintenance Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={maintenanceData}
                    margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
                    layout="vertical"
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v) => [v, "Requests"]} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {maintenanceData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent maintenance */}
      {maintenance && maintenance.length > 0 && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Maintenance Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {maintenance.slice(0, 5).map((req) => (
                  <div
                    key={req.request_id}
                    className="flex items-start justify-between gap-4"
                  >
                    <p className="text-sm line-clamp-1 flex-1">{req.description}</p>
                    <Badge
                      variant={
                        req.status === "resolved"
                          ? "secondary"
                          : req.status === "in_progress"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {req.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Properties summary */}
      {properties && properties.length > 0 && showPortfolioCharts && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {properties.slice(0, 5).map((p) => (
                  <div key={p.property_id} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{p.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.city}, {p.province}
                      </p>
                    </div>
                    <Badge variant="outline">{p.development_stage}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
