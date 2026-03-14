"use client";

import { useState } from "react";
import {
  GitBranch,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useProperties } from "@/hooks/usePortfolio";
import {
  useStageTransitions,
  useAllowedTransitions,
  useMilestones,
  useTransitionProperty,
  useCreateMilestone,
  useUpdateMilestone,
} from "@/hooks/useLifecycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DevelopmentStage, MilestoneStatus } from "@/types/lifecycle";

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

const STAGE_COLORS: Record<DevelopmentStage, string> = {
  prospect: "bg-gray-100 text-gray-700",
  acquisition: "bg-blue-100 text-blue-700",
  interim_operation: "bg-orange-100 text-orange-700",
  planning: "bg-indigo-100 text-indigo-700",
  permit: "bg-violet-100 text-violet-700",
  construction: "bg-amber-100 text-amber-700",
  lease_up: "bg-purple-100 text-purple-700",
  stabilized: "bg-green-100 text-green-700",
  exit: "bg-red-100 text-red-700",
};

const MILESTONE_ICONS: Record<MilestoneStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  in_progress: Clock,
  pending: Circle,
  skipped: AlertTriangle,
};

const MILESTONE_COLORS: Record<MilestoneStatus, string> = {
  completed: "text-green-600",
  in_progress: "text-blue-600",
  pending: "text-gray-400",
  skipped: "text-yellow-600",
};

export default function LifecyclePage() {
  const { data: properties, isLoading } = useProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [expandedTransitions, setExpandedTransitions] = useState(false);

  const selectedProperty = properties?.find(
    (p) => p.property_id === selectedPropertyId
  );

  if (!selectedPropertyId && properties && properties.length > 0) {
    setSelectedPropertyId(properties[0].property_id);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitBranch className="h-6 w-6" />
          Property Lifecycle
        </h1>
        <p className="text-muted-foreground">
          Stage transitions, milestones, and property development workflow
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {properties?.map((p) => (
              <button
                key={p.property_id}
                onClick={() => setSelectedPropertyId(p.property_id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPropertyId === p.property_id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div>{p.address}</div>
                <div className="text-xs opacity-75">{p.city}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedPropertyId && selectedProperty && (
        <>
          <StagePipeline
            propertyId={selectedPropertyId}
            currentStage={selectedProperty.development_stage as DevelopmentStage}
          />
          <MilestonesSection
            propertyId={selectedPropertyId}
            currentStage={selectedProperty.development_stage as DevelopmentStage}
          />
          <TransitionHistory
            propertyId={selectedPropertyId}
            expanded={expandedTransitions}
            onToggle={() => setExpandedTransitions(!expandedTransitions)}
          />
        </>
      )}
    </div>
  );
}

function StagePipeline({
  propertyId,
  currentStage,
}: {
  propertyId: number;
  currentStage: DevelopmentStage;
}) {
  const { data: allowed } = useAllowedTransitions(propertyId);
  const { mutateAsync: transition, isPending } = useTransitionProperty(propertyId);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [force, setForce] = useState(false);

  const currentIdx = STAGES.indexOf(currentStage);

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStage) return;
    try {
      await transition({
        to_stage: targetStage as DevelopmentStage,
        notes: notes || undefined,
        force,
      });
      toast.success(`Transitioned to ${targetStage.replace(/_/g, " ")}`);
      setTransitionOpen(false);
      setTargetStage("");
      setNotes("");
      setForce(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Transition failed");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Development Pipeline</CardTitle>
        {allowed && allowed.allowed_transitions && allowed.allowed_transitions.length > 0 && (
          <Dialog open={transitionOpen} onOpenChange={setTransitionOpen}>
            <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Advance Stage
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Advance Property Stage</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleTransition} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Stage</Label>
                  <Badge className={STAGE_COLORS[currentStage]}>
                    {currentStage.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label>Target Stage</Label>
                  <Select
                    value={targetStage}
                    onValueChange={(v) => setTargetStage(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowed.allowed_transitions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {targetStage &&
                  allowed.validation_requirements?.[targetStage] && (
                    <div className="rounded-md bg-amber-50 p-3 text-sm">
                      <p className="font-medium text-amber-800 mb-1">
                        Validation Requirements:
                      </p>
                      <ul className="list-disc pl-4 text-amber-700">
                        {allowed.validation_requirements?.[targetStage].map(
                          (req: string, i: number) => (
                            <li key={i}>{req}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for stage transition..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="force"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="force" className="text-sm text-muted-foreground">
                    Force transition (skip validation)
                  </Label>
                </div>
                <Button type="submit" disabled={isPending || !targetStage}>
                  {isPending ? "Transitioning..." : "Confirm Transition"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 flex-wrap">
          {STAGES.map((stage, idx) => {
            const isActive = stage === currentStage;
            const isPast = idx < currentIdx;
            return (
              <div key={stage} className="flex items-center">
                <div
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? STAGE_COLORS[stage] + " ring-2 ring-offset-1 ring-primary"
                      : isPast
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-50 text-gray-400"
                  }`}
                >
                  {isPast && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                  {stage.replace(/_/g, " ")}
                </div>
                {idx < STAGES.length - 1 && (
                  <ArrowRight
                    className={`mx-1 h-3 w-3 ${
                      isPast ? "text-green-400" : "text-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MilestonesSection({
  propertyId,
  currentStage,
}: {
  propertyId: number;
  currentStage: DevelopmentStage;
}) {
  const { data: milestones, isLoading } = useMilestones(propertyId);
  const { mutateAsync: createMilestone, isPending: creating } =
    useCreateMilestone(propertyId);
  const { mutateAsync: updateMilestone } = useUpdateMilestone(propertyId);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMilestone({
        title: newTitle,
        target_date: newDate,
        stage: currentStage,
        sort_order: (milestones?.length ?? 0) + 1,
      });
      toast.success("Milestone added");
      setAddOpen(false);
      setNewTitle("");
      setNewDate("");
    } catch {
      toast.error("Failed to add milestone");
    }
  };

  const handleStatusChange = async (
    milestoneId: number,
    status: MilestoneStatus
  ) => {
    try {
      const data: any = { status };
      if (status === "completed") {
        data.actual_date = new Date().toISOString().split("T")[0];
      }
      await updateMilestone({ milestoneId, data });
      toast.success("Milestone updated");
    } catch {
      toast.error("Failed to update milestone");
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full mb-6" />;

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Milestones</CardTitle>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
            <Plus className="mr-2 h-4 w-4" />
            Add Milestone
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Milestone</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Milestone title"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding..." : "Add Milestone"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!milestones || milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No milestones for this property.
          </p>
        ) : (
          <div className="space-y-3">
            {milestones.map((m) => {
              const Icon = MILESTONE_ICONS[m.status];
              return (
                <div
                  key={m.milestone_id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      MILESTONE_COLORS[m.status]
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{m.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {m.stage.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Target: {formatDate(m.target_date)}
                      {m.actual_date && (
                        <span className="ml-2 text-green-600">
                          Completed: {formatDate(m.actual_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Select
                    value={m.status}
                    onValueChange={(v) =>
                      v && handleStatusChange(m.milestone_id, v as MilestoneStatus)
                    }
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="skipped">Skipped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TransitionHistory({
  propertyId,
  expanded,
  onToggle,
}: {
  propertyId: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: transitions, isLoading } = useStageTransitions(propertyId);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader
        className="flex flex-row items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <CardTitle className="text-base">
          Transition History ({transitions?.length ?? 0})
        </CardTitle>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </CardHeader>
      {expanded && (
        <CardContent>
          {!transitions || transitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transitions recorded.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Validation</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transitions.map((t) => (
                  <TableRow key={t.transition_id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t.from_stage.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STAGE_COLORS[t.to_stage as DevelopmentStage] ?? ""}`}>
                        {t.to_stage.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(t.transitioned_at)}
                    </TableCell>
                    <TableCell>
                      {t.validation_passed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {t.notes ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
