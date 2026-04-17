"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Building2, AlertTriangle, Calendar, TrendingUp,
  ChevronRight, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect", acquisition: "Acquisition", interim_operation: "Interim",
  planning: "Planning", construction: "Construction", lease_up: "Lease-Up",
  stabilized: "Stabilized", exit_planned: "Exit Planned", exit_marketed: "Marketed",
  exit_under_contract: "Under Contract", exit_closed: "Sold", exit: "Exit",
};

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-slate-200 text-slate-700",
  acquisition: "bg-purple-100 text-purple-700",
  interim_operation: "bg-blue-100 text-blue-700",
  planning: "bg-indigo-100 text-indigo-700",
  construction: "bg-orange-100 text-orange-700",
  lease_up: "bg-yellow-100 text-yellow-700",
  stabilized: "bg-green-100 text-green-700",
  exit_planned: "bg-emerald-100 text-emerald-700",
  exit_marketed: "bg-cyan-100 text-cyan-700",
  exit_under_contract: "bg-amber-100 text-amber-700",
  exit_closed: "bg-red-100 text-red-700",
  exit: "bg-red-100 text-red-700",
};

const BAR_COLORS: Record<string, string> = {
  interim: "bg-blue-400",
  construction: "bg-orange-400",
  lease_up: "bg-yellow-400",
  stabilized: "bg-green-400",
};

export default function LifecyclePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-timeline"],
    queryFn: () => apiClient.get("/api/portfolio/timeline").then(r => r.data),
  });

  // Compute timeline scale
  const { startYear, endYear, totalYears } = useMemo(() => {
    if (!data?.timeline_range) return { startYear: 2024, endYear: 2034, totalYears: 10 };
    const s = new Date(data.timeline_range.start).getFullYear();
    const e = new Date(data.timeline_range.end).getFullYear();
    return { startYear: s, endYear: Math.max(e, s + 5), totalYears: Math.max(e - s, 5) };
  }, [data]);

  const yearToPercent = (dateStr: string) => {
    const d = new Date(dateStr);
    const yearFrac = d.getFullYear() + d.getMonth() / 12 + d.getDate() / 365;
    return ((yearFrac - startYear) / totalYears) * 100;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const properties = data?.properties || [];
  const alerts = data?.alerts || [];
  const summary = data?.summary || {};

  // Group properties by LP
  const groupedByLp = useMemo(() => {
    const groups = new Map<string, { lp_id: number | null; lp_name: string; properties: any[] }>();
    for (const p of properties) {
      const key = p.lp_id ? `lp-${p.lp_id}` : "unassigned";
      const name = p.lp_name || "Unassigned (no LP)";
      if (!groups.has(key)) {
        groups.set(key, { lp_id: p.lp_id ?? null, lp_name: name, properties: [] });
      }
      groups.get(key)!.properties.push(p);
    }
    // Unassigned group sorts last; otherwise alphabetic by LP name
    return Array.from(groups.values()).sort((a, b) => {
      if (a.lp_id === null && b.lp_id !== null) return 1;
      if (b.lp_id === null && a.lp_id !== null) return -1;
      return a.lp_name.localeCompare(b.lp_name);
    });
  }, [properties]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Property Lifecycle</h1>
        <p className="text-muted-foreground">Timeline view of all properties from acquisition through exit</p>
      </div>

      {/* Summary Strip */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(summary.by_stage || {}).map(([stage, count]) => (
          <div key={stage} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", STAGE_COLORS[stage] || "bg-gray-100 text-gray-700")}>
            <span className="font-bold">{count as number}</span>
            {STAGE_LABELS[stage] || stage}
          </div>
        ))}
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-foreground">
          <span className="font-bold">{summary.total || 0}</span> Total Properties
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="py-3 px-4 space-y-1.5">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Timeline Alerts
            </p>
            {alerts.map((a: any, i: number) => (
              <div key={i} className={cn("flex items-start gap-2 text-xs rounded px-2 py-1",
                a.severity === "warning" ? "text-amber-700 bg-amber-50" : "text-blue-700 bg-blue-50"
              )}>
                <span className="shrink-0 mt-0.5">{a.severity === "warning" ? "▲" : "ℹ"}</span>
                <span><span className="font-medium">{a.property}:</span> {a.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Legend:</span>
        {[
          { label: "Interim", color: "bg-blue-400" },
          { label: "Construction", color: "bg-orange-400" },
          { label: "Lease-Up", color: "bg-yellow-400" },
          { label: "Stabilized", color: "bg-green-400" },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-6 rounded-full", l.color)} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-red-500 rounded" />
          Exit
        </span>
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardContent className="p-0">
          {/* Year headers */}
          <div className="flex border-b sticky top-0 bg-card z-10">
            <div className="w-56 shrink-0 px-4 py-2 text-xs font-medium text-muted-foreground border-r">
              Property
            </div>
            <div className="flex-1 relative">
              <div className="flex">
                {Array.from({ length: totalYears + 1 }, (_, i) => startYear + i).map(year => (
                  <div
                    key={year}
                    className="text-center text-[10px] font-medium text-muted-foreground py-2 border-r border-dashed"
                    style={{ width: `${100 / (totalYears + 1)}%` }}
                  >
                    {year}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Property rows grouped by LP */}
          {properties.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm">No properties found</p>
            </div>
          ) : (
            groupedByLp.flatMap((group) => [
              <div
                key={`group-${group.lp_id ?? "unassigned"}`}
                className="flex border-b bg-muted/40 sticky top-[33px] z-[5]"
              >
                <div className="w-56 shrink-0 px-4 py-2 border-r flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {group.lp_id ? (
                    <Link
                      href={`/investment/${group.lp_id}`}
                      className="text-xs font-semibold truncate hover:text-primary"
                      title={group.lp_name}
                    >
                      {group.lp_name}
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold truncate text-muted-foreground">
                      {group.lp_name}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
                    {group.properties.length}
                  </Badge>
                </div>
                <div className="flex-1" />
              </div>,
              ...group.properties.map((prop: any) => (
                <div key={prop.property_id} className="flex border-b hover:bg-muted/30 transition-colors group">
                {/* Property info */}
                <div className="w-56 shrink-0 px-4 py-3 border-r">
                  <Link href={`/portfolio/${prop.property_id}`} className="group/link">
                    <p className="text-sm font-medium truncate group-hover/link:text-primary transition-colors flex items-center gap-1">
                      {prop.address}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STAGE_COLORS[prop.stage])}>
                      {STAGE_LABELS[prop.stage] || prop.stage}
                    </Badge>
                    {prop.exit_year && (
                      <span className="text-[10px] text-muted-foreground">Exit {prop.exit_year}</span>
                    )}
                  </div>
                </div>

                {/* Timeline bars */}
                <div className="flex-1 relative py-2 px-1">
                  {/* Year grid lines */}
                  {Array.from({ length: totalYears + 1 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-r border-dashed border-muted"
                      style={{ left: `${(i / (totalYears + 1)) * 100}%` }}
                    />
                  ))}

                  {/* Today marker */}
                  {(() => {
                    const todayPct = yearToPercent(new Date().toISOString().slice(0, 10));
                    if (todayPct >= 0 && todayPct <= 100) {
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                          style={{ left: `${todayPct}%` }}
                        />
                      );
                    }
                    return null;
                  })()}

                  {/* Bars */}
                  <div className="relative h-7 flex items-center">
                    {(prop.bars || []).map((bar: any, bi: number) => {
                      const left = Math.max(0, yearToPercent(bar.start));
                      const right = Math.min(100, yearToPercent(bar.end));
                      const width = right - left;
                      if (width <= 0) return null;
                      return (
                        <div
                          key={bi}
                          className={cn(
                            "absolute h-5 rounded-full opacity-80 hover:opacity-100 transition-opacity cursor-default",
                            BAR_COLORS[bar.type] || "bg-gray-300"
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${bar.label}: ${bar.start} → ${bar.end}`}
                        >
                          {width > 8 && (
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white truncate px-1">
                              {bar.label}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Exit marker */}
                    {prop.exit_year && (() => {
                      const exitPct = yearToPercent(`${prop.exit_year}-06-30`);
                      if (exitPct >= 0 && exitPct <= 100) {
                        return (
                          <div
                            className="absolute h-7 w-1 bg-red-500 rounded-full z-10"
                            style={{ left: `${exitPct}%` }}
                            title={`Planned exit: ${prop.exit_year}`}
                          />
                        );
                      }
                      return null;
                    })()}

                    {/* Acquisition marker */}
                    {prop.acquisition_date && (() => {
                      const acqPct = yearToPercent(prop.acquisition_date);
                      if (acqPct >= 0 && acqPct <= 100) {
                        return (
                          <div
                            className="absolute h-3 w-3 rounded-full bg-purple-500 border-2 border-white z-10 -translate-x-1.5"
                            style={{ left: `${acqPct}%`, top: "50%", transform: "translate(-50%, -50%)" }}
                            title={`Acquired: ${prop.acquisition_date}`}
                          />
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
              )),
            ])
          )}
        </CardContent>
      </Card>
    </div>
  );
}
