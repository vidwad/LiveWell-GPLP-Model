"use client";

import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Building2,
  Users,
  DollarSign,
  Home,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import { useTrendAnalysis } from "@/hooks/useReports";
import { useFundPerformance } from "@/hooks/useReports";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function formatCompact(val: number) {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function TrendsPage() {
  const { data, isLoading } = useTrendAnalysis();
  const { data: fundData } = useFundPerformance();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const monthlyRevenue = data?.monthly_revenue ?? [];
  const capitalTimeline = data?.capital_timeline ?? [];
  const stageBreakdown = data?.stage_breakdown ?? [];
  const communityOccupancy = data?.community_occupancy ?? [];
  const communityTypes = data?.community_type_breakdown ?? [];
  const maintenanceStatus = data?.maintenance_by_status ?? [];
  const funds = fundData?.funds ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trend Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historical trends for revenue, occupancy, capital, and operations
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Properties</p>
            <p className="text-xl font-bold">{data?.total_properties ?? 0}</p>
            <p className="text-xs text-muted-foreground">{data?.total_communities ?? 0} communities</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Occupancy Rate</p>
            <p className="text-xl font-bold text-green-700">
              {data?.occupancy_rate ? `${(data.occupancy_rate * 100).toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {data?.occupied_units ?? 0} / {data?.total_units ?? 0} beds
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Rent Collected</p>
            <p className="text-xl font-bold">{formatCompact(data?.total_rent_collected ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Total to date</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Capital Deployed</p>
            <p className="text-xl font-bold">{formatCompact(data?.total_funded ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{data?.total_investors ?? 0} investors</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      {monthlyRevenue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monthly Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  fill="#10b981"
                  fillOpacity={0.3}
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capital Timeline */}
        {capitalTimeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Capital Deployment Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={capitalTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="contributed" name="Capital Deployed" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Occupancy by Community */}
        {communityOccupancy.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4" />
                Occupancy by Community
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={communityOccupancy} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="occupied" name="Occupied" stackId="a" fill="#10b981" />
                  <Bar dataKey="vacant" name="Vacant" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Stage Breakdown */}
        {stageBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Properties by Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stageBreakdown}
                    dataKey="count"
                    nameKey="stage"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ stage, count }) => `${stage} (${count})`}
                  >
                    {stageBreakdown.map((_: unknown, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Fund Performance Comparison */}
        {funds.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Fund NOI Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funds.map((f: Record<string, unknown>) => ({
                  name: f.lp_name,
                  NOI: f.total_noi,
                  Value: f.total_value,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="NOI" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Value" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
