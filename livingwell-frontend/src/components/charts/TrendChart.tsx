"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
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

  // Filter to only metrics present in the data
  const availableMetrics = activeMetrics.filter(m =>
    chartData.some((d: Record<string, unknown>) => d[m] !== undefined && d[m] !== null)
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>{title || "Trend"}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Loading trend data...
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
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => {
                const firstMetric = availableMetrics[0];
                const config = METRIC_CONFIG[firstMetric];
                return config ? fmt(v, config.format) : String(v);
              }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                const config = METRIC_CONFIG[name];
                return [config ? fmt(value, config.format) : value, config?.label || name];
              }}
              labelFormatter={(label) => `Period: ${label}`}
            />
            <Legend
              formatter={(value: string) => METRIC_CONFIG[value]?.label || value}
              iconSize={10}
              wrapperStyle={{ fontSize: 11 }}
            />
            {availableMetrics.map(metric => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={METRIC_CONFIG[metric]?.color || "#6b7280"}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
