"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BedDouble, Building2, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BedAlert {
  bed_id: number;
  bed_label: string;
  unit_number: string;
  monthly_rent: number;
  days_vacant: number;
  severity: "critical" | "warning" | "info" | "maintenance";
}

interface CommunityAlerts {
  community_id: number;
  community_name: string;
  city: string;
  alert_count: number;
  monthly_revenue_at_risk: number;
  beds: BedAlert[];
}

interface VacancyAlertsResponse {
  threshold_days: number;
  summary: {
    total_vacant_beds: number;
    communities_affected: number;
    total_monthly_revenue_at_risk: number;
    alerts_count: number;
  };
  communities: CommunityAlerts[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const severityConfig: Record<
  BedAlert["severity"],
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-800 border-red-300",
  },
  warning: {
    label: "Warning",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  info: {
    label: "Info",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  maintenance: {
    label: "Maintenance",
    className: "bg-orange-100 text-orange-800 border-orange-300",
  },
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function VacancyAlertsPage() {
  const [threshold, setThreshold] = useState(14);

  const { data, isLoading } = useQuery<VacancyAlertsResponse>({
    queryKey: ["vacancy-alerts", threshold],
    queryFn: () =>
      apiClient
        .get("/api/community/operations/vacancy-alerts", {
          params: { threshold_days: threshold },
        })
        .then((r) => r.data),
  });

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Vacancy Tracking &amp; Alerts
          </h1>
          <p className="text-muted-foreground">
            Monitor vacant beds across all communities and identify revenue at
            risk.
          </p>
        </div>

        {/* Threshold control */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="threshold"
            className="text-sm font-medium whitespace-nowrap"
          >
            Alert threshold (days):
          </label>
          <input
            id="threshold"
            type="number"
            min={1}
            max={365}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 14)}
            className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Vacant Beds
            </CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : (data?.summary?.total_vacant_beds ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Communities Affected
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : (data?.summary?.communities_affected ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Revenue at Risk
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading
                ? "..."
                : cad.format(data?.summary?.total_monthly_revenue_at_risk ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alert Count</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : (data?.summary?.alerts_count ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading vacancy alerts...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!data?.communities || data.communities.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BedDouble className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              No vacancy alerts found for the current threshold.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Community Alert Cards */}
      {!isLoading &&
        data?.communities?.map((community) => (
          <Card key={community.community_id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {community.community_name}
                <Badge variant="secondary" className="ml-auto">
                  {community.beds.length}{" "}
                  {community.beds.length === 1 ? "alert" : "alerts"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Bed</th>
                      <th className="pb-2 pr-4 font-medium">Unit</th>
                      <th className="pb-2 pr-4 font-medium">Monthly Rent</th>
                      <th className="pb-2 pr-4 font-medium">Days Vacant</th>
                      <th className="pb-2 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {community.beds.map((alert) => {
                      const sev = severityConfig[alert.severity];
                      return (
                        <tr
                          key={alert.bed_id}
                          className="border-b last:border-0"
                        >
                          <td className="py-2 pr-4 font-medium">
                            {alert.bed_label}
                          </td>
                          <td className="py-2 pr-4">{alert.unit_number}</td>
                          <td className="py-2 pr-4">
                            {cad.format(alert.monthly_rent)}
                          </td>
                          <td className="py-2 pr-4">{alert.days_vacant}</td>
                          <td className="py-2">
                            <Badge
                              variant="outline"
                              className={sev.className}
                            >
                              {sev.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
