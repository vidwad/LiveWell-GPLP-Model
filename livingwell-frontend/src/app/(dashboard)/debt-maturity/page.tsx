"use client";

import React from "react";
import {
  Landmark,
  AlertTriangle,
  Clock,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useDebtMaturity, DebtMaturityItem } from "@/hooks/useReports";

const URGENCY_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  past_due: { label: "Past Due", color: "text-red-700", bgColor: "bg-red-100 border-red-200", icon: XCircle },
  critical: { label: "< 90 Days", color: "text-red-600", bgColor: "bg-red-50 border-red-200", icon: AlertTriangle },
  warning: { label: "< 6 Months", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", icon: AlertCircle },
  upcoming: { label: "< 12 Months", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", icon: Clock },
  normal: { label: "> 12 Months", color: "text-green-600", bgColor: "bg-green-50 border-green-200", icon: CheckCircle2 },
  unknown: { label: "No Date", color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200", icon: Calendar },
};

const DEBT_TYPE_LABELS: Record<string, string> = {
  permanent_mortgage: "Permanent Mortgage",
  construction_loan: "Construction Loan",
  bridge_loan: "Bridge Loan",
  mezzanine: "Mezzanine",
  line_of_credit: "Line of Credit",
};

function formatCompact(val: number) {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function formatDaysToMaturity(days: number | null): string {
  if (days === null) return "—";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

export default function DebtMaturityPage() {
  const { data, isLoading } = useDebtMaturity();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const summary = data?.summary;
  const facilities = data?.facilities ?? [];

  // Group by urgency for the timeline view
  const urgencyGroups = facilities.reduce<Record<string, DebtMaturityItem[]>>((acc, f) => {
    if (!acc[f.urgency]) acc[f.urgency] = [];
    acc[f.urgency].push(f);
    return acc;
  }, {});

  // Group by year for the calendar view
  const yearGroups = facilities
    .filter((f) => f.maturity_date)
    .reduce<Record<string, DebtMaturityItem[]>>((acc, f) => {
      const year = f.maturity_date!.slice(0, 4);
      if (!acc[year]) acc[year] = [];
      acc[year].push(f);
      return acc;
    }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Debt Maturity Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track loan maturities, rate resets, and refinancing deadlines
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Active Facilities</p>
            <p className="text-xl font-bold">{summary?.total_facilities ?? 0}</p>
            <p className="text-xs text-muted-foreground">Debt facilities</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Total Outstanding</p>
            <p className="text-xl font-bold">{formatCompact(summary?.total_outstanding ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Across portfolio</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Maturing &lt; 6 Mo</p>
            <p className="text-xl font-bold text-amber-700">
              {formatCompact(summary?.maturing_within_6mo ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Needs refinancing</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Maturing &lt; 12 Mo</p>
            <p className="text-xl font-bold text-orange-700">
              {formatCompact(summary?.maturing_within_12mo ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">Plan ahead</p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", (summary?.past_due_count ?? 0) > 0 ? "border-l-red-500" : "border-l-green-500")}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Past Due</p>
            <p className={cn("text-xl font-bold", (summary?.past_due_count ?? 0) > 0 ? "text-red-700" : "text-green-700")}>
              {summary?.past_due_count ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">
              {(summary?.past_due_count ?? 0) > 0 ? "Requires immediate action" : "All current"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Urgency Timeline */}
      <div className="space-y-3">
        {["past_due", "critical", "warning", "upcoming", "normal", "unknown"].map((urgency) => {
          const items = urgencyGroups[urgency];
          if (!items || items.length === 0) return null;
          const cfg = URGENCY_CONFIG[urgency];
          const Icon = cfg.icon;
          const groupTotal = items.reduce((s, i) => s + i.outstanding_balance, 0);

          return (
            <Card key={urgency} className={cn("border", cfg.bgColor)}>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className={cn("text-sm flex items-center gap-2", cfg.color)}>
                  <Icon className="h-4 w-4" />
                  {cfg.label}
                  <Badge variant="outline" className="ml-1 text-xs">
                    {items.length} facilit{items.length === 1 ? "y" : "ies"}
                  </Badge>
                  <span className="ml-auto font-normal text-xs">
                    {formatCompact(groupTotal)} outstanding
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <div className="grid gap-2">
                  {items.map((f) => (
                    <div
                      key={f.debt_id}
                      className="flex items-center justify-between rounded-lg border bg-white/60 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{f.address}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.lender_name} — {DEBT_TYPE_LABELS[f.debt_type] ?? f.debt_type}
                            {f.lp_name && <span className="ml-2">({f.lp_name})</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-muted-foreground">Outstanding</p>
                          <p className="font-medium tabular-nums">{formatCurrency(f.outstanding_balance)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Rate</p>
                          <p className="font-medium tabular-nums">
                            {f.interest_rate ? `${f.interest_rate}%` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Matures</p>
                          <p className={cn("font-medium tabular-nums", cfg.color)}>
                            {f.maturity_date ?? "No date"}
                          </p>
                        </div>
                        <div className="w-16 text-right">
                          <p className={cn("text-sm font-bold", cfg.color)}>
                            {formatDaysToMaturity(f.days_to_maturity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Yearly Breakdown */}
      {Object.keys(yearGroups).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maturity by Year</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(yearGroups)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([year, items]) => {
                  const total = items.reduce((s, i) => s + i.outstanding_balance, 0);
                  return (
                    <Card key={year} className="border">
                      <CardContent className="pt-3 pb-3 px-3 text-center">
                        <p className="text-lg font-bold">{year}</p>
                        <p className="text-sm font-medium text-amber-700">{formatCompact(total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {items.length} facilit{items.length === 1 ? "y" : "ies"}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Table */}
      {facilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Active Debt Facilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Property</TableHead>
                    <TableHead>Lender</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Originated</TableHead>
                    <TableHead>Matures</TableHead>
                    <TableHead className="text-right">Time Left</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilities.map((f) => {
                    const cfg = URGENCY_CONFIG[f.urgency];
                    return (
                      <TableRow key={f.debt_id}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{f.address}</p>
                            {f.lp_name && (
                              <p className="text-xs text-muted-foreground">{f.lp_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{f.lender_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {DEBT_TYPE_LABELS[f.debt_type] ?? f.debt_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(f.outstanding_balance)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.interest_rate ? `${f.interest_rate}% ${f.rate_type}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {f.origination_date ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {f.maturity_date ?? "—"}
                        </TableCell>
                        <TableCell className={cn("text-right text-sm font-bold", cfg.color)}>
                          {formatDaysToMaturity(f.days_to_maturity)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={f.urgency === "past_due" ? "destructive" : f.urgency === "critical" ? "destructive" : "outline"}
                            className="text-xs"
                          >
                            {cfg.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {facilities.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No active debt facilities found. Add debt facilities to properties to track maturities.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
