"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GitBranch,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, cn } from "@/lib/utils";
import type { Property } from "@/types/portfolio";
import type {
  DevelopmentStage,
  MilestoneStatus,
  PropertyMilestone,
  StageTransition,
} from "@/types/lifecycle";

// ── Stage ordering and colors ────────────────────────────────────────

const STAGES: DevelopmentStage[] = [
  "prospect",
  "acquisition",
  "interim_operation",
  "planning",
  "permit",
  "construction",
  "lease_up",
  "stabilized",
  "exit",
];

const STAGE_BAR_COLORS: Record<DevelopmentStage, string> = {
  prospect: "bg-gray-400",
  acquisition: "bg-blue-500",
  interim_operation: "bg-yellow-500",
  planning: "bg-purple-500",
  permit: "bg-violet-500",
  construction: "bg-orange-500",
  lease_up: "bg-teal-500",
  stabilized: "bg-green-500",
  exit: "bg-red-500",
};

const STAGE_BADGE_COLORS: Record<DevelopmentStage, string> = {
  prospect: "bg-gray-100 text-gray-700",
  acquisition: "bg-blue-100 text-blue-700",
  interim_operation: "bg-yellow-100 text-yellow-700",
  planning: "bg-purple-100 text-purple-700",
  permit: "bg-violet-100 text-violet-700",
  construction: "bg-orange-100 text-orange-700",
  lease_up: "bg-teal-100 text-teal-700",
  stabilized: "bg-green-100 text-green-700",
  exit: "bg-red-100 text-red-700",
};

const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  pending: "bg-gray-400",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  skipped: "bg-gray-400",
};

const MILESTONE_STATUS_RING: Record<MilestoneStatus, string> = {
  pending: "ring-gray-400",
  in_progress: "ring-blue-500",
  completed: "ring-green-500",
  skipped: "ring-gray-300",
};

// ── Data hooks ───────────────────────────────────────────────────────

function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: () =>
      apiClient
        .get<Property[]>("/api/portfolio/properties")
        .then((r) => r.data),
  });
}

function usePropertyMilestones(propertyId: number | null) {
  return useQuery({
    queryKey: ["timeline-milestones", propertyId],
    queryFn: () =>
      apiClient
        .get<PropertyMilestone[]>(
          `/api/lifecycle/properties/${propertyId}/milestones`
        )
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

function usePropertyTransitions(propertyId: number | null) {
  return useQuery({
    queryKey: ["timeline-transitions", propertyId],
    queryFn: () =>
      apiClient
        .get<StageTransition[]>(
          `/api/lifecycle/properties/${propertyId}/transitions`
        )
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

// ── Helper ───────────────────────────────────────────────────────────

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ");
}

// ── Main Page ────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { data: properties, isLoading: loadingProps } = useProperties();
  const [filterPropertyId, setFilterPropertyId] = useState<string>("all");

  const filteredProperties =
    filterPropertyId === "all"
      ? properties
      : properties?.filter(
          (p) => p.property_id === Number(filterPropertyId)
        );

  if (loadingProps) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitBranch className="h-6 w-6" />
          Lifecycle Timeline
        </h1>
        <p className="text-muted-foreground">
          Visualize property lifecycle stages, milestones, and transitions
        </p>
      </div>

      {/* Filter + Legend */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-64">
          <label className="mb-1 block text-sm font-medium">
            Filter by Property
          </label>
          <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
            <SelectTrigger>
              <SelectValue placeholder="All properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties?.map((p) => (
                <SelectItem key={p.property_id} value={String(p.property_id)}>
                  {p.address} - {p.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Legend */}
        <StageLegend />
      </div>

      {/* Timeline Cards */}
      {!filteredProperties || filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No properties found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProperties.map((property) => (
            <PropertyTimelineCard
              key={property.property_id}
              property={property}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stage Legend ──────────────────────────────────────────────────────

function StageLegend() {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Stage Legend
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {STAGES.map((stage) => (
            <div key={stage} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block h-3 w-3 rounded-sm",
                  STAGE_BAR_COLORS[stage]
                )}
              />
              <span className="text-xs capitalize">{stageLabel(stage)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-full">
            Milestone Status
          </p>
          {(
            [
              ["pending", "Pending", "bg-gray-400"],
              ["in_progress", "In Progress", "bg-blue-500"],
              ["completed", "Completed", "bg-green-500"],
              ["skipped", "Skipped", "bg-gray-400 opacity-50"],
            ] as const
          ).map(([, label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className={cn("inline-block h-2.5 w-2.5 rounded-full", color)}
              />
              <span className="text-xs">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Property Timeline Card ───────────────────────────────────────────

function PropertyTimelineCard({ property }: { property: Property }) {
  const { data: milestones, isLoading: loadingMilestones } =
    usePropertyMilestones(property.property_id);
  const { data: transitions, isLoading: loadingTransitions } =
    usePropertyTransitions(property.property_id);

  const currentStage = (property.development_stage ?? "prospect") as DevelopmentStage;
  const currentIdx = STAGES.indexOf(currentStage);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <CardTitle className="truncate">
            {property.address}
          </CardTitle>
          <span className="text-sm text-muted-foreground shrink-0">
            {property.city}
          </span>
        </div>
        <Badge className={cn("shrink-0 capitalize", STAGE_BADGE_COLORS[currentStage])}>
          {stageLabel(currentStage)}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Horizontal Stage Progress Bar */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Stage Progression
          </p>
          <div className="flex h-7 w-full overflow-hidden rounded-md border">
            {STAGES.map((stage, idx) => {
              const isPast = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const isFuture = idx > currentIdx;
              return (
                <div
                  key={stage}
                  className={cn(
                    "relative flex items-center justify-center text-[10px] font-medium text-white transition-all",
                    isPast || isCurrent
                      ? STAGE_BAR_COLORS[stage]
                      : "bg-gray-100 text-gray-400",
                    isCurrent && "ring-2 ring-inset ring-white/50"
                  )}
                  style={{ flex: 1 }}
                  title={`${stageLabel(stage)}${
                    isCurrent ? " (current)" : isPast ? " (completed)" : ""
                  }`}
                >
                  <span className="hidden sm:inline truncate px-0.5">
                    {stageLabel(stage)}
                  </span>
                  {isCurrent && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-white shadow" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Prospect</span>
            <span>Exit</span>
          </div>
        </div>

        {/* Gantt-Style Milestone Chart */}
        {!loadingMilestones && milestones && milestones.length > 0 && (() => {
          const sorted = [...milestones]
            .filter((m) => m.target_date)
            .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());
          if (sorted.length === 0) return null;

          const dates = sorted.map((m) => new Date(m.target_date).getTime());
          const actualDates = sorted
            .filter((m) => m.actual_date)
            .map((m) => new Date(m.actual_date!).getTime());
          const allDates = [...dates, ...actualDates];
          const minDate = Math.min(...allDates);
          const maxDate = Math.max(...allDates);
          const today = Date.now();
          const rangeStart = Math.min(minDate, today) - 30 * 24 * 3600 * 1000;
          const rangeEnd = Math.max(maxDate, today) + 30 * 24 * 3600 * 1000;
          const totalRange = rangeEnd - rangeStart;

          const pct = (d: number) => ((d - rangeStart) / totalRange) * 100;
          const todayPct = pct(today);

          // Generate month markers
          const monthMarkers: { label: string; pct: number }[] = [];
          const startMonth = new Date(rangeStart);
          startMonth.setDate(1);
          startMonth.setMonth(startMonth.getMonth() + 1);
          while (startMonth.getTime() < rangeEnd) {
            monthMarkers.push({
              label: startMonth.toLocaleString("default", { month: "short", year: "2-digit" }),
              pct: pct(startMonth.getTime()),
            });
            startMonth.setMonth(startMonth.getMonth() + 1);
          }

          return (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Milestone Timeline
              </p>
              <div className="rounded-lg border bg-muted/20 p-3 overflow-x-auto">
                {/* Month headers */}
                <div className="relative h-5 mb-1" style={{ minWidth: 600 }}>
                  {monthMarkers.map((m, i) => (
                    <span
                      key={i}
                      className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                      style={{ left: `${m.pct}%` }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>

                {/* Gantt rows */}
                <div className="relative space-y-1" style={{ minWidth: 600 }}>
                  {/* Today line */}
                  {todayPct > 0 && todayPct < 100 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                      style={{ left: `${todayPct}%` }}
                    >
                      <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-bold text-red-500 bg-white px-1 rounded">
                        Today
                      </span>
                    </div>
                  )}

                  {sorted.map((m) => {
                    const targetPct = pct(new Date(m.target_date).getTime());
                    const actualPct = m.actual_date ? pct(new Date(m.actual_date).getTime()) : null;
                    const statusColor = MILESTONE_STATUS_COLORS[m.status];
                    const stageColor = m.stage ? STAGE_BAR_COLORS[m.stage as DevelopmentStage] : "bg-gray-300";

                    return (
                      <div key={m.milestone_id} className="relative flex items-center h-7">
                        {/* Stage color bar background */}
                        <div className="absolute inset-y-0 left-0 right-0 rounded-sm bg-gray-50" />

                        {/* Target date marker */}
                        <div
                          className="absolute flex items-center"
                          style={{ left: `${targetPct}%` }}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full border-2 border-white shadow-sm -translate-x-1/2",
                              m.status === "completed" ? "bg-green-500" :
                              m.status === "in_progress" ? "bg-blue-500" :
                              m.status === "skipped" ? "bg-gray-300" : "bg-gray-400"
                            )}
                            title={`${m.title} — Target: ${m.target_date}${m.actual_date ? ` | Actual: ${m.actual_date}` : ""}`}
                          />
                        </div>

                        {/* Actual date marker (diamond) */}
                        {actualPct !== null && (
                          <div
                            className="absolute"
                            style={{ left: `${actualPct}%` }}
                          >
                            <div
                              className="h-3 w-3 bg-green-600 rotate-45 -translate-x-1/2 border border-white shadow-sm"
                              title={`Completed: ${m.actual_date}`}
                            />
                          </div>
                        )}

                        {/* Connect target to actual with line */}
                        {actualPct !== null && Math.abs(actualPct - targetPct) > 0.5 && (
                          <div
                            className={cn(
                              "absolute h-0.5 top-1/2",
                              actualPct > targetPct ? "bg-red-300" : "bg-green-300"
                            )}
                            style={{
                              left: `${Math.min(targetPct, actualPct)}%`,
                              width: `${Math.abs(actualPct - targetPct)}%`,
                            }}
                          />
                        )}

                        {/* Label */}
                        <span
                          className="absolute text-[10px] font-medium truncate max-w-[120px] pointer-events-none"
                          style={{
                            left: `${Math.min(targetPct + 1, 85)}%`,
                            top: "50%",
                            transform: "translateY(-50%)",
                          }}
                        >
                          {m.title}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-full bg-gray-400 border border-white" />
                    Target Date
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 bg-green-600 rotate-45" />
                    Actual Date
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-0.5 w-4 bg-red-300" />
                    Late
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-0.5 w-4 bg-green-300" />
                    Early
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Milestones List */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Milestone Details
          </p>
          {loadingMilestones ? (
            <Skeleton className="h-16 w-full" />
          ) : !milestones || milestones.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No milestones recorded
            </p>
          ) : (
            <div className="relative ml-3 border-l-2 border-gray-200 pl-4 space-y-3">
              {milestones
                .sort(
                  (a, b) =>
                    new Date(a.target_date).getTime() -
                    new Date(b.target_date).getTime()
                )
                .map((m) => (
                  <MilestoneItem key={m.milestone_id} milestone={m} />
                ))}
            </div>
          )}
        </div>

        {/* Transitions */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            Stage Transitions
          </p>
          {loadingTransitions ? (
            <Skeleton className="h-12 w-full" />
          ) : !transitions || transitions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No transitions recorded
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transitions
                .sort(
                  (a, b) =>
                    new Date(a.transitioned_at).getTime() -
                    new Date(b.transitioned_at).getTime()
                )
                .map((t) => (
                  <TransitionChip key={t.transition_id} transition={t} />
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Milestone Item ───────────────────────────────────────────────────

function MilestoneItem({ milestone }: { milestone: PropertyMilestone }) {
  const StatusIcon =
    milestone.status === "completed"
      ? CheckCircle2
      : milestone.status === "in_progress"
      ? Clock
      : milestone.status === "skipped"
      ? AlertCircle
      : Clock;

  const dotColor = MILESTONE_STATUS_COLORS[milestone.status];
  const isSkipped = milestone.status === "skipped";

  return (
    <div className="relative">
      {/* Dot on the timeline line */}
      <span
        className={cn(
          "absolute -left-[21px] top-1 h-3 w-3 rounded-full ring-2 ring-white",
          dotColor,
          isSkipped && "opacity-50"
        )}
      />
      <div className="flex items-start gap-2">
        <StatusIcon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            milestone.status === "completed"
              ? "text-green-500"
              : milestone.status === "in_progress"
              ? "text-blue-500"
              : milestone.status === "skipped"
              ? "text-gray-400"
              : "text-gray-400"
          )}
        />
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-medium leading-tight",
              isSkipped && "line-through text-muted-foreground"
            )}
          >
            {milestone.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Target: {formatDate(milestone.target_date)}</span>
            {milestone.actual_date && (
              <span className="text-green-600">
                Completed: {formatDate(milestone.actual_date)}
              </span>
            )}
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 capitalize"
            >
              {stageLabel(milestone.stage)}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Transition Chip ──────────────────────────────────────────────────

function TransitionChip({ transition }: { transition: StageTransition }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs">
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] px-1.5 py-0 h-4 capitalize",
          STAGE_BADGE_COLORS[transition.from_stage as DevelopmentStage]
        )}
      >
        {stageLabel(transition.from_stage)}
      </Badge>
      <span className="text-muted-foreground">&rarr;</span>
      <Badge
        className={cn(
          "text-[10px] px-1.5 py-0 h-4 capitalize",
          STAGE_BADGE_COLORS[transition.to_stage as DevelopmentStage]
        )}
      >
        {stageLabel(transition.to_stage)}
      </Badge>
      <span className="ml-1 text-muted-foreground">
        {formatDate(transition.transitioned_at)}
      </span>
      {transition.validation_passed ? (
        <CheckCircle2 className="h-3 w-3 text-green-500" />
      ) : (
        <AlertCircle className="h-3 w-3 text-amber-500" />
      )}
    </div>
  );
}
