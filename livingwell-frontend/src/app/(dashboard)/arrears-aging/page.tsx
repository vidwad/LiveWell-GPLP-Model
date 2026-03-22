"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  DollarSign,
  Clock,
  Users,
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
import { useArrearsAging } from "@/hooks/useReports";

const BUCKET_LABELS: Record<string, { label: string; color: string; severity: string }> = {
  "0-30": { label: "0-30 Days", color: "bg-green-100 text-green-700 border-green-200", severity: "low" },
  "31-60": { label: "31-60 Days", color: "bg-amber-100 text-amber-700 border-amber-200", severity: "medium" },
  "61-90": { label: "61-90 Days", color: "bg-orange-100 text-orange-700 border-orange-200", severity: "high" },
  "91-120": { label: "91-120 Days", color: "bg-red-100 text-red-700 border-red-200", severity: "critical" },
  "120+": { label: "120+ Days", color: "bg-red-200 text-red-800 border-red-300", severity: "critical" },
};

const BUCKET_ORDER = ["0-30", "31-60", "61-90", "91-120", "120+"];

export default function ArrearsAgingPage() {
  const { data, isLoading } = useArrearsAging();
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const buckets = data?.buckets ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Arrears Aging Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Outstanding rent arrears broken down by aging bucket
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Total Outstanding</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(data?.total_outstanding ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{data?.total_records ?? 0} records</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">60+ Days</p>
            <p className="text-xl font-bold text-orange-700">
              {formatCurrency(
                (buckets["61-90"]?.total ?? 0) +
                (buckets["91-120"]?.total ?? 0) +
                (buckets["120+"]?.total ?? 0)
              )}
            </p>
            <p className="text-xs text-muted-foreground">Needs escalation</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-700">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">120+ Days</p>
            <p className="text-xl font-bold text-red-800">
              {formatCurrency(buckets["120+"]?.total ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {buckets["120+"]?.count ?? 0} record{(buckets["120+"]?.count ?? 0) !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Bucket Cards */}
      <div className="grid grid-cols-5 gap-3">
        {BUCKET_ORDER.map((key) => {
          const bucket = buckets[key];
          const cfg = BUCKET_LABELS[key];
          if (!bucket) return (
            <Card key={key} className="border-dashed">
              <CardContent className="pt-4 pb-3 px-3 text-center">
                <p className="text-xs font-medium text-muted-foreground">{cfg.label}</p>
                <p className="text-lg font-bold text-muted-foreground">$0</p>
                <p className="text-[10px] text-muted-foreground">0 records</p>
              </CardContent>
            </Card>
          );

          return (
            <Card
              key={key}
              className={cn("cursor-pointer transition-all border", expandedBucket === key ? "ring-2 ring-blue-400" : "", cfg.color)}
              onClick={() => setExpandedBucket(expandedBucket === key ? null : key)}
            >
              <CardContent className="pt-4 pb-3 px-3 text-center">
                <p className="text-xs font-medium">{cfg.label}</p>
                <p className="text-lg font-bold">{formatCurrency(bucket.total)}</p>
                <p className="text-[10px]">{bucket.count} record{bucket.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expanded Bucket Detail */}
      {expandedBucket && buckets[expandedBucket] && buckets[expandedBucket].records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {BUCKET_LABELS[expandedBucket].label} — Detail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Resident</TableHead>
                    <TableHead>Community</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Days Overdue</TableHead>
                    <TableHead>Follow-Up</TableHead>
                    <TableHead>Next Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets[expandedBucket].records.map((r) => (
                    <TableRow key={r.arrears_id}>
                      <TableCell className="font-medium">{r.resident_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.community_name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-red-700">
                        {formatCurrency(r.amount_overdue)}
                      </TableCell>
                      <TableCell className="text-sm">{r.due_date ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold text-red-600">
                        {r.days_overdue}d
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.follow_up_action ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.follow_up_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.total_records === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <DollarSign className="h-10 w-10 text-green-500/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No outstanding arrears. All accounts current.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
