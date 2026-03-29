"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface TrendChartProps {
  entityType: "community" | "lp";
  entityId: number;
  title?: string;
  months?: number;
  metrics?: string[];
  height?: number;
}

const METRIC_CONFIG: Record<string, { label: string; color: string; format: "currency" | "percent" | "number" }> = {
  occupancy_rate: { label: "Occupancy %", color: "#10b981", format: "percent" },
  collected_revenue: { label: "Revenue", color: "#3b82f6", format: "currency" },
  gross_revenue: { label: "Gross Revenue", color: "#6366f1", format: "currency" },
  total_expenses: { label: "Expenses", color: "#ef4444", format: "currency" },
  noi: { label: "NOI", color: "#f59e0b", format: "currency" },
  nav: { label: "NAV", color: "#8b5cf6", format: "currency" },
  nav_per_unit: { label: "NAV/Unit", color: "#06b6d4", format: "currency" },
  total_funded: { label: "Funded Capital", color: "#3b82f6", format: "currency" },
  capital_deployed: { label: "Capital Deployed", color: "#10b981", format: "currency" },
  total_debt: { label: "Total Debt", color: "#ef4444", format: "currency" },
  portfolio_ltv: { label: "LTV %", color: "#f97316", format: "percent" },
  total_distributions: { label: "Distributions", color: "#a855f7", format: "currency" },
  occupied_beds: { label: "Occupied Beds", color: "#10b981", format: "number" },
  total_beds: { label: "Total Beds", color: "#94a3b8", format: "number" },
};

const DEFAULT_COMMUNITY_METRICS = ["occupancy_rate", "collected_revenue", "noi"];
const DEFAULT_LP_METRICS = ["nav", "total_funded", "capital_deployed"];

const fmt = (value: number, format: string) => {
  if (format === "currency") {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (format === "percent") return `${value.toFixed(1)}%`;
  return value.toFixed(0);
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm px-3 py-2.5 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => {
        const config = METRIC_CONFIG[entry.dataKey];
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{config?.label || entry.dataKey}:</span>
            <span className="font-semibold">{config ? fmt(entry.value, config.format) : entry.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TrendChart({
  entityType,
  entityId,
  title,
  months = 12,
  metrics,
  height = 300,
}: TrendChartProps) {
  const url = entityType === "community"
    ? `/api/community/communities/${entityId}/trend`
    : `/api/investment/lp/${entityId}/trend`;

  const { data, isLoading } = useQuery({
    queryKey: ["trend", entityType, entityId, months],
    queryFn: () => apiClient.get(url, { params: { months } }).then(r => r.data),
    enabled: entityId > 0,
  });

  const chartData = data?.data || [];
  const activeMetrics = metrics || (entityType === "community" ? DEFAULT_COMMUNITY_METRICS : DEFAULT_LP_METRICS);

  const availableMetrics = activeMetrics.filter(m =>
    chartData.some((d: Record<string, unknown>) => d[m] !== undefined && d[m] !== null)
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>{title || "Trend"}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm text-muted-foreground">Loading trend data...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader><CardTitle>{title || "Trend"}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            No trend data available. Capture monthly snapshots to build history.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || `${entityType === "community" ? "Community" : "LP"} Trend (${chartData.length} months)`}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              {availableMetrics.map(metric => (
                <linearGradient key={metric} id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={METRIC_CONFIG[metric]?.color || "#6b7280"} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={METRIC_CONFIG[metric]?.color || "#6b7280"} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => {
                const firstMetric = availableMetrics[0];
                const config = METRIC_CONFIG[firstMetric];
                return config ? fmt(v, config.format) : String(v);
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value: string) => METRIC_CONFIG[value]?.label || value}
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            {availableMetrics.map(metric => (
              <Area
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={METRIC_CONFIG[metric]?.color || "#6b7280"}
                strokeWidth={2}
                fill={`url(#grad-${metric})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
