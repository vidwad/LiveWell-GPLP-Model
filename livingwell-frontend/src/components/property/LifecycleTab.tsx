"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  SkipForward,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, cn } from "@/lib/utils";
import {
  useStageTransitions,
  useAllowedTransitions,
  useTransitionProperty,
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
} from "@/hooks/useLifecycle";
import type { StageTransition, PropertyMilestone, DevelopmentStage } from "@/types/lifecycle";

/* ── Stage helpers ── */

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  prospect:          { label: "Prospect",          color: "text-slate-700",  bg: "bg-slate-100 border-slate-200",  order: 0 },
  acquisition:       { label: "Acquisition",       color: "text-purple-700", bg: "bg-purple-50 border-purple-200", order: 1 },
  interim_operation: { label: "Interim Operation", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", order: 2 },
  planning:          { label: "Planning",          color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", order: 3 },
  construction:      { label: "Construction",      color: "text-orange-700", bg: "bg-orange-50 border-orange-200", order: 4 },
  lease_up:          { label: "Lease-Up",          color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    order: 5 },
  stabilized:        { label: "Stabilized",        color: "text-green-700",  bg: "bg-green-50 border-green-200",  order: 6 },
  exit:              { label: "Exit",              color: "text-red-700",    bg: "bg-red-50 border-red-200",      order: 7 },
};

const STAGE_ORDER = ["prospect", "acquisition", "interim_operation", "planning", "construction", "lease_up", "stabilized", "exit"];

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] ?? { label: stage, color: "text-gray-700", bg: "bg-gray-100 border-gray-200" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", cfg.bg, cfg.color)}>
      <span className={cn("h-2 w-2 rounded-full", cfg.color.replace("text-", "bg-"))} />
      {cfg.label}
    </span>
  );
}

interface LifecycleTabProps {
  propertyId: number;
  stage: string;
  canEdit: boolean;
  userRole?: string;
  activePhase?: "as_is" | "post_renovation" | "full_development";
}

export function LifecycleTab({ propertyId, stage, canEdit, userRole, activePhase = "as_is" }: LifecycleTabProps) {
  const { data: transitions } = useStageTransitions(propertyId);
  const { data: allowedTransitions } = useAllowedTransitions(propertyId);
  const transitionMutation = useTransitionProperty(propertyId);
  const { data: milestones } = useMilestones(propertyId);
  const createMilestone = useCreateMilestone(propertyId);
  const updateMilestone = useUpdateMilestone(propertyId);

  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [transitionForm, setTransitionForm] = useState({ to_stage: "", notes: "", force: false });
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ title: "", description: "", target_date: "", stage: "" });

  return (
    <div className="space-y-6">
      {/* Phase Context Banner */}
      {activePhase === "as_is" && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Activity className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-medium">As-Is Operations</span> — The property is operating in its current state.
              Use the stage pipeline below to track acquisition progress and plan future development milestones.
            </p>
          </CardContent>
        </Card>
      )}
      {activePhase === "post_renovation" && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Activity className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Renovation Phase</span> — Track renovation milestones and stage transitions
              as the property undergoes improvements.
            </p>
          </CardContent>
        </Card>
      )}
      {activePhase === "full_development" && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Activity className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-200">
              <span className="font-medium">Full Development</span> — Track the complete development lifecycle from
              planning through construction, lease-up, and stabilization.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stage Progress Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Development Stage Progress
            </CardTitle>
            {canEdit && allowedTransitions && (allowedTransitions as { allowed_transitions: string[] }).allowed_transitions?.length > 0 && (
              <Dialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
                {/* @ts-expect-error radix-ui asChild type */}
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <ArrowRight className="mr-1.5 h-4 w-4" />
                    Advance Stage
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Transition Property Stage</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await transitionMutation.mutateAsync({
                          to_stage: transitionForm.to_stage as DevelopmentStage,
                          notes: transitionForm.notes || undefined,
                          force: transitionForm.force,
                        });
                        toast.success("Stage transition successful");
                        setShowTransitionDialog(false);
                        setTransitionForm({ to_stage: "", notes: "", force: false });
                      } catch (err: unknown) {
                        const axiosErr = err as { response?: { data?: { detail?: { message?: string } | string } } };
                        const detail = axiosErr?.response?.data?.detail;
                        const msg = (typeof detail === "object" && detail !== null ? detail.message : detail) || "Transition failed";
                        toast.error(typeof msg === "string" ? msg : "Transition failed");
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Current Stage</Label>
                      <div><StageBadge stage={stage} /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Target Stage</Label>
                      <Select
                        value={transitionForm.to_stage}
                        onValueChange={(v) => setTransitionForm((f) => ({ ...f, to_stage: v ?? "" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select target stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {((allowedTransitions as { allowed_transitions: string[] })?.allowed_transitions ?? []).map((s: string) => (
                            <SelectItem key={s} value={s}>
                              {STAGE_CONFIG[s]?.label ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Textarea
                        value={transitionForm.notes}
                        onChange={(e) => setTransitionForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Reason for transition..."
                        rows={3}
                      />
                    </div>
                    {userRole === "GP_ADMIN" && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={transitionForm.force}
                          onChange={(e) => setTransitionForm((f) => ({ ...f, force: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        Force transition (skip validation)
                      </label>
                    )}
                    <Button type="submit" disabled={!transitionForm.to_stage || transitionMutation.isPending} className="w-full">
                      {transitionMutation.isPending ? "Transitioning..." : "Confirm Transition"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Visual Stage Pipeline */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STAGE_ORDER.map((s, i) => {
              const cfg = STAGE_CONFIG[s];
              const currentIdx = STAGE_ORDER.indexOf(stage);
              const isActive = s === stage;
              const isPast = i < currentIdx;
              const isFuture = i > currentIdx;
              return (
                <div key={s} className="flex items-center gap-1 shrink-0">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
                      isActive && cn(cfg.bg, cfg.color, "ring-2 ring-offset-1", cfg.color.replace("text-", "ring-")),
                      isPast && "bg-green-50 border-green-200 text-green-700",
                      isFuture && "bg-gray-50 border-gray-200 text-gray-400",
                    )}
                  >
                    {isPast && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {isActive && <Circle className="h-3.5 w-3.5 fill-current" />}
                    {isFuture && <Circle className="h-3.5 w-3.5" />}
                    {cfg.label}
                  </div>
                  {i < STAGE_ORDER.length - 1 && (
                    <ArrowRight className={cn("h-3.5 w-3.5 shrink-0", isPast ? "text-green-400" : "text-gray-300")} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transition History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Transition History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!transitions || (transitions as StageTransition[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No stage transitions recorded yet.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {(transitions as StageTransition[]).map((t) => (
                  <div key={t.transition_id} className="relative flex gap-4 pl-10">
                    <div className={cn(
                      "absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 bg-white",
                      t.validation_passed ? "border-green-500" : "border-amber-500"
                    )} />
                    <div className="flex-1 rounded-lg border bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StageBadge stage={t.from_stage} />
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <StageBadge stage={t.to_stage} />
                        {!t.validation_passed && (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">
                            Forced
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span>{formatDate(t.transitioned_at)}</span>
                        <span>by User #{t.transitioned_by}</span>
                      </div>
                      {t.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">"{t.notes}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Milestones
            </CardTitle>
            {canEdit && (
              <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
                {/* @ts-expect-error radix-ui asChild type */}
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Milestone
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Milestone</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await createMilestone.mutateAsync({
                          title: milestoneForm.title ?? "",
                          description: milestoneForm.description || undefined,
                          target_date: milestoneForm.target_date ?? "",
                          stage: (milestoneForm.stage || stage) as DevelopmentStage,
                        });
                        toast.success("Milestone added");
                        setShowMilestoneDialog(false);
                        setMilestoneForm({ title: "", description: "", target_date: "", stage: "" });
                      } catch (e) { toast.error("Failed to add milestone"); }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={milestoneForm.title}
                        onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Building Permit Approved"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Textarea
                        value={milestoneForm.description}
                        onChange={(e) => setMilestoneForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Details..."
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Target Date</Label>
                        <Input
                          type="date"
                          value={milestoneForm.target_date}
                          onChange={(e) => setMilestoneForm((f) => ({ ...f, target_date: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Stage</Label>
                        <Select
                          value={milestoneForm.stage || stage}
                          onValueChange={(v) => setMilestoneForm((f) => ({ ...f, stage: v ?? "" }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_ORDER.map((s) => (
                              <SelectItem key={s} value={s}>{STAGE_CONFIG[s]?.label ?? s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" disabled={!milestoneForm.title || createMilestone.isPending} className="w-full">
                      {createMilestone.isPending ? "Adding..." : "Add Milestone"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!milestones || (milestones as PropertyMilestone[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones defined yet. Add milestones to track key deliverables.</p>
          ) : (
            <div className="space-y-3">
              {STAGE_ORDER.filter((s) => (milestones as PropertyMilestone[]).some((m) => m.stage === s)).map((stageKey) => (
                <div key={stageKey}>
                  <div className="flex items-center gap-2 mb-2">
                    <StageBadge stage={stageKey} />
                  </div>
                  <div className="space-y-2 ml-2">
                    {(milestones as PropertyMilestone[]).filter((m) => m.stage === stageKey).map((m) => {
                      const statusIcon = {
                        completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                        in_progress: <Clock className="h-4 w-4 text-blue-500" />,
                        pending: <Circle className="h-4 w-4 text-gray-400" />,
                        overdue: <AlertCircle className="h-4 w-4 text-red-500" />,
                        skipped: <SkipForward className="h-4 w-4 text-gray-400" />,
                      }[m.status] ?? <Circle className="h-4 w-4 text-gray-400" />;
                      const statusColor = {
                        completed: "bg-green-50 border-green-200",
                        in_progress: "bg-blue-50 border-blue-200",
                        pending: "bg-white border-gray-200",
                        overdue: "bg-red-50 border-red-200",
                        skipped: "bg-gray-50 border-gray-200",
                      }[m.status] ?? "bg-white border-gray-200";
                      return (
                        <div key={m.milestone_id} className={cn("flex items-start gap-3 rounded-lg border p-3", statusColor)}>
                          <div className="mt-0.5">{statusIcon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{m.title}</p>
                              {canEdit && m.status !== "completed" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={async () => {
                                    try {
                                      const newStatus = m.status === "pending" ? "in_progress" : "completed";
                                      await updateMilestone.mutateAsync({
                                        milestoneId: m.milestone_id,
                                        data: {
                                          status: newStatus as "in_progress" | "completed",
                                          ...(newStatus === "completed" ? { actual_date: new Date().toISOString().split("T")[0] } : {}),
                                        },
                                      });
                                      toast.success(`Milestone marked as ${newStatus.replace("_", " ")}`);
                                    } catch (e) { toast.error("Failed to update milestone"); }
                                  }}
                                >
                                  {m.status === "pending" ? "Start" : "Complete"}
                                </Button>
                              )}
                            </div>
                            {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                              {m.target_date && <span>Target: {formatDate(m.target_date)}</span>}
                              {m.actual_date && <span className="text-green-600">Completed: {formatDate(m.actual_date)}</span>}
                              <span className="capitalize">{m.status.replace("_", " ")}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
