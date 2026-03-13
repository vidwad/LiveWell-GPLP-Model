'use client';

import { Building2, Users, Wrench, TrendingUp, DollarSign, Activity, PieChart as PieChartIcon, FileText, Home } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useProperties, usePortfolioReturns } from "@/hooks/usePortfolio";
import { useCommunities, useMaintenanceRequests } from "@/hooks/useCommunities";
import { useInvestors, useInvestorDashboard } from "@/hooks/useInvestors";
import { useFundPerformance } from "@/hooks/useReports";
import { useAuth } from "@/providers/AuthProvider";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentList } from "@/components/documents/DocumentList";

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
  const { data: report } = useFundPerformance();
  const isInvestor = user?.role === "INVESTOR";
  const isPropertyManager = user?.role === "PROPERTY_MANAGER";
  const isResident = user?.role === "RESIDENT";
  const isGPLike = user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";
  const { data: dashboard } = useInvestorDashboard(isInvestor ? undefined : undefined);
  const { data: returnsData } = usePortfolioReturns();

  const openIssues = maintenance?.filter((m) => m.status === "open").length ?? 0;
  const isLoading = propsLoading || commsLoading || maintLoading;

  // Fund performance aggregates
  const totalValue = report?.funds.reduce((sum, f) => sum + f.total_value, 0) || 0;
  const totalNOI = report?.funds.reduce((sum, f) => sum + f.total_noi, 0) || 0;
  const totalDebt = report?.funds.reduce((sum, f) => sum + f.total_debt, 0) || 0;
  const blendedLTV = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

  const capitalStackData = report?.funds.map(f => ({
    name: f.lp_name.replace('Living Well ', '').replace(' LP', ''),
    Equity: f.total_equity,
    Debt: f.total_debt,
  })) || [];

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
  const isGPAdmin = user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  const portfolioXIRR = returnsData?.portfolio_xirr_percent;
  const portfolioEM = returnsData?.portfolio_equity_multiple;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {isGPAdmin ? "GP Dashboard" : `Welcome back${user?.full_name ? `, ${user.full_name}` : ""}`}
        </h1>
        <p className="text-muted-foreground">
          {isGPAdmin ? "Platform-wide portfolio performance and metrics." : "Here's an overview of your portfolio."}
        </p>
      </div>

      {/* GP Admin Fund Performance KPIs */}
      {isGPAdmin && report && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(totalValue / 1000000).toFixed(2)}M</div>
              <p className="text-xs text-muted-foreground">Across {properties?.length || 0} properties</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estimated Annual NOI</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(totalNOI / 1000).toFixed(1)}k</div>
              <p className="text-xs text-muted-foreground">Run-rate based on current plans</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blended LTV</CardTitle>
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blendedLTV.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Total Debt: ${(totalDebt / 1000000).toFixed(2)}M</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Funds</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{report?.funds.length || 0}</div>
              <p className="text-xs text-muted-foreground">LP Entities under management</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* GP Admin Returns KPIs (XIRR + Equity Multiple) */}
      {isGPAdmin && returnsData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio XIRR</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {portfolioXIRR != null ? `${portfolioXIRR.toFixed(1)}%` : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">Extended IRR across all funds</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equity Multiple</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {portfolioEM != null ? `${portfolioEM.toFixed(2)}x` : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">Total distributions / capital invested</p>
            </CardContent>
          </Card>
          {returnsData.funds.slice(0, 2).map((fund: any) => (
            <Card key={fund.lp_id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate">
                  {fund.lp_name.replace("Living Well ", "").replace(" LP", "")}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {fund.xirr_percent != null ? `${fund.xirr_percent.toFixed(1)}%` : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  EM: {fund.equity_multiple != null ? `${fund.equity_multiple.toFixed(2)}x` : "N/A"} ·{" "}
                  {fund.investor_count} investors
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* GP Admin Capital Stack Chart + Fund Performance */}
      {isGPAdmin && report && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mb-6">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Capital Stack by Fund</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={capitalStackData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value / 1000000}M`} />
                    <Tooltip formatter={(value: any) => `$${(Number(value) / 1000000).toFixed(2)}M`} />
                    <Legend />
                    <Bar dataKey="Debt" stackId="a" fill="#94a3b8" />
                    <Bar dataKey="Equity" stackId="a" fill="#0f172a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Fund Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {report?.funds.map((fund) => (
                  <div key={fund.lp_id} className="flex items-center">
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">{fund.lp_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {fund.property_count} Properties
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">LTV: {fund.portfolio_ltv.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">
                        DSCR: {fund.portfolio_dscr ? `${fund.portfolio_dscr.toFixed(2)}x` : 'N/A'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Operational KPI row (existing) */}
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
        {isGPAdmin && !invLoading && (
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
              label="Total Distributions"
              value={formatCurrency(dashboard.total_distributions)}
              icon={DollarSign}
            />
            <KpiCard
              label="Net Position"
              value={formatCurrency(dashboard.net_position)}
              icon={Activity}
            />
          </>
        )}
        {isPropertyManager && (
          <>
            <KpiCard
              label="My Properties"
              value={properties?.length ?? 0}
              icon={Building2}
              description="Assigned properties"
            />
            <KpiCard
              label="Communities"
              value={communities?.length ?? 0}
              icon={Users}
              description="Active communities"
            />
            <KpiCard
              label="Open Issues"
              value={openIssues}
              icon={Wrench}
              description="Maintenance requests"
            />
          </>
        )}
        {isResident && (
          <KpiCard
            label="Open Maintenance"
            value={openIssues}
            icon={Wrench}
            description="Your open requests"
          />
        )}
      </div>

      {/* Operational Charts row */}
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

      {/* ── INVESTOR Dashboard ───────────────────────────────────── */}
      {isInvestor && dashboard && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Investment summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Investment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Subscriptions", value: dashboard.subscription_count },
                { label: "Holdings", value: dashboard.holding_count },
                { label: "Capital Committed", value: formatCurrency(dashboard.total_committed) },
                { label: "Capital Funded", value: formatCurrency(dashboard.total_funded) },
                { label: "Distributions Received", value: formatCurrency(dashboard.total_distributions) },
                { label: "Net Position", value: formatCurrency(dashboard.net_position) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Investor documents */}
          {dashboard.investor.investor_id && (
            <DocumentList investorId={dashboard.investor.investor_id} />
          )}
        </div>
      )}

      {/* ── PROPERTY MANAGER Dashboard ───────────────────────────── */}
      {isPropertyManager && (
        <div className="mt-6 space-y-4">
          {properties && properties.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  My Assigned Properties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {properties.map((p) => (
                    <div key={p.property_id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{p.address}</p>
                        <p className="text-xs text-muted-foreground">{p.city}, {p.province}</p>
                      </div>
                      <Badge variant="outline">{p.development_stage?.replace(/_/g, " ")}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {maintenance && maintenance.filter(m => m.status !== "resolved").length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Open Maintenance Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {maintenance.filter(m => m.status !== "resolved").slice(0, 10).map((req) => (
                    <div key={req.request_id} className="flex items-start justify-between gap-4">
                      <p className="text-sm flex-1 line-clamp-1">{req.description}</p>
                      <Badge variant={req.status === "in_progress" ? "default" : "destructive"}>
                        {req.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── RESIDENT Dashboard ───────────────────────────────────── */}
      {isResident && (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4" />
                Your Community
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Welcome to Living Well Communities. Use the Maintenance link in the sidebar to submit
                or check on service requests.
              </p>
            </CardContent>
          </Card>
          {maintenance && maintenance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Your Maintenance Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {maintenance.slice(0, 5).map((req) => (
                    <div key={req.request_id} className="flex items-start justify-between gap-4">
                      <p className="text-sm flex-1 line-clamp-1">{req.description}</p>
                      <Badge
                        variant={req.status === "resolved" ? "secondary" : req.status === "in_progress" ? "default" : "destructive"}
                      >
                        {req.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
