"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  CheckCircle2, Circle, AlertTriangle, ChevronRight, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SetupGuidanceProps {
  propertyId: number;
  onNavigateTab?: (tab: string) => void;
}

export function SetupGuidance({ propertyId, onNavigateTab }: SetupGuidanceProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["setup-status", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/setup-status`).then(r => r.data),
    enabled: propertyId > 0,
  });

  if (isLoading || !data) return null;

  const { progress_pct, required, recommended, complete } = data;
  const allDone = required.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Setup Completeness
          </CardTitle>
          <span className={cn(
            "text-sm font-bold tabular-nums",
            progress_pct >= 80 ? "text-green-600" : progress_pct >= 50 ? "text-amber-600" : "text-red-600"
          )}>
            {progress_pct}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              progress_pct >= 80 ? "bg-green-500" : progress_pct >= 50 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${progress_pct}%` }}
          />
        </div>

        {/* Required Items */}
        {required.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
              Required ({required.length})
            </p>
            <div className="space-y-1">
              {required.map((item: any, i: number) => (
                <button
                  key={i}
                  onClick={() => onNavigateTab?.(item.tab)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors group text-left"
                >
                  <Circle className="h-4 w-4 text-red-400 shrink-0" />
                  <span className="flex-1 text-foreground">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground capitalize opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.tab} tab
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Items */}
        {recommended.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
              Recommended ({recommended.length})
            </p>
            <div className="space-y-1">
              {recommended.map((item: any, i: number) => (
                <button
                  key={i}
                  onClick={() => onNavigateTab?.(item.tab)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors group text-left"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="flex-1 text-foreground/80">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground capitalize opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.tab} tab
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Complete Items (collapsible) */}
        {complete.length > 0 && (
          <details className="group">
            <summary className="text-xs font-semibold text-green-600 uppercase tracking-wider cursor-pointer select-none flex items-center gap-1">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              Complete ({complete.length})
            </summary>
            <div className="mt-2 space-y-1">
              {complete.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* All Done Message */}
        {allDone && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-800 dark:text-green-200">All required setup complete!</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Review recommended items above to improve your model.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
