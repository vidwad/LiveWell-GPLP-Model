"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Settings2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { useVarianceAlerts, VarianceAlertCommunity, VarianceAlertItem } from "@/hooks/useReports";

const ALERT_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  expense_overrun: { label: "Expense Overrun", icon: TrendingUp, color: "text-red-600" },
  revenue_shortfall: { label: "Revenue Shortfall", icon: TrendingDown, color: "text-amber-600" },
  noi_shortfall: { label: "NOI Shortfall", icon: DollarSign, color: "text-orange-600" },
};

export default function VarianceAlertsPage() {
  const [threshold, setThreshold] = useState(10);
  const { data, isLoading } = useVarianceAlerts(threshold);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget Variance Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Communities where actuals deviate from budget beyond threshold
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Threshold:</Label>
          <Input
            type="number"
            className="w-20"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            min={1}
            max={100}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Total Alerts</p>
            <p className="text-xl font-bold">{data?.total_alerts ?? 0}</p>
            <p className="text-xs text-muted-foreground">Above {threshold}% threshold</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-700">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">High Severity</p>
            <p className={cn("text-xl font-bold", (data?.high_severity ?? 0) > 0 ? "text-red-700" : "text-green-700")}>
              {data?.high_severity ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Over {threshold * 2}% variance</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Medium Severity</p>
            <p className="text-xl font-bold text-amber-700">{data?.medium_severity ?? 0}</p>
            <p className="text-xs text-muted-foreground">{threshold}%-{threshold * 2}% variance</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Communities Affected</p>
            <p className="text-xl font-bold">{data?.communities_affected ?? 0}</p>
            <p className="text-xs text-muted-foreground">With variance alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards */}
      {data?.alerts && data.alerts.length > 0 ? (
        <div className="space-y-4">
          {data.alerts.map((community: VarianceAlertCommunity) => (
            <Card key={community.budget_id} className="border-l-4 border-l-red-400">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {community.community_name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {community.period_label} — {community.year}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {community.alerts.map((alert: VarianceAlertItem, idx: number) => {
                    const cfg = ALERT_TYPE_LABELS[alert.type] ?? { label: alert.type, icon: AlertTriangle, color: "text-gray-600" };
                    const Icon = cfg.icon;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-4 py-3",
                          alert.severity === "high" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn("h-5 w-5", cfg.color)} />
                          <div>
                            <p className={cn("text-sm font-medium", cfg.color)}>{alert.message}</p>
                            <p className="text-xs text-muted-foreground">
                              Budget: {formatCurrency(alert.budgeted)} | Actual: {formatCurrency(alert.actual)}
                            </p>
                          </div>
                        </div>
                        <Badge variant={alert.severity === "high" ? "destructive" : "outline"} className="text-xs">
                          {alert.severity}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-green-300 bg-green-50/30">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertTriangle className="h-10 w-10 text-green-500/40 mx-auto mb-3" />
            <p className="text-sm text-green-700">
              No budget variances exceed the {threshold}% threshold. All communities on track.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
