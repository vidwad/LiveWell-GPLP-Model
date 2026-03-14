"use client";

import { useState } from "react";
import { useTurnovers, useCreateTurnover, useUpdateTurnover } from "@/hooks/useOperator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { Plus, ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const STATUS_COLUMNS = ["scheduled", "in_progress", "ready", "completed"] as const;
type TurnoverStatus = typeof STATUS_COLUMNS[number];

const STATUS_COLORS: Record<TurnoverStatus, string> = {
  scheduled: "bg-gray-100 text-gray-700 border-gray-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ready: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_HEADER_COLORS: Record<TurnoverStatus, string> = {
  scheduled: "bg-gray-50 border-gray-200",
  in_progress: "bg-yellow-50 border-yellow-200",
  ready: "bg-blue-50 border-blue-200",
  completed: "bg-green-50 border-green-200",
};

interface Turnover {
  turnover_id: number;
  unit_id: number | null;
  community_id: number | null;
  status: TurnoverStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  cleaning_done: boolean;
  painting_done: boolean;
  repairs_done: boolean;
  inspection_done: boolean;
  keys_returned: boolean;
  notes: string | null;
}

const EMPTY_FORM = {
  unit_id: "",
  community_id: "",
  scheduled_date: "",
  notes: "",
};

const CHECKLIST_FIELDS: { key: keyof Turnover; label: string }[] = [
  { key: "cleaning_done", label: "Cleaning" },
  { key: "painting_done", label: "Painting" },
  { key: "repairs_done", label: "Repairs" },
  { key: "inspection_done", label: "Inspection" },
  { key: "keys_returned", label: "Keys Returned" },
];

export default function TurnoversPage() {
  const { data: turnovers = [], isLoading } = useTurnovers();
  const { mutateAsync: createTurnover, isPending: createPending } = useCreateTurnover();
  const { mutateAsync: updateTurnover } = useUpdateTurnover();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTurnover({
      unit_id: form.unit_id ? Number(form.unit_id) : null,
      community_id: form.community_id ? Number(form.community_id) : null,
      scheduled_date: form.scheduled_date || null,
      notes: form.notes || null,
    });
    setForm({ ...EMPTY_FORM });
    setCreateOpen(false);
  };

  const handleStatusChange = async (t: Turnover, newStatus: TurnoverStatus) => {
    await updateTurnover({
      id: t.turnover_id,
      data: {
        status: newStatus,
        ...(newStatus === "completed" ? { completed_date: new Date().toISOString().slice(0, 10) } : {}),
      },
    });
  };

  const handleChecklistToggle = async (t: Turnover, field: keyof Turnover) => {
    await updateTurnover({
      id: t.turnover_id,
      data: { [field]: !t[field] },
    });
  };

  const byStatus = (status: TurnoverStatus) =>
    (turnovers as Turnover[]).filter((t) => t.status === status);

  const counts = STATUS_COLUMNS.reduce(
    (acc, s) => ({ ...acc, [s]: byStatus(s).length }),
    {} as Record<TurnoverStatus, number>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="h-6 w-6 text-primary" />
            Unit Turnovers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track unit turnover workflows from scheduling to completion.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className={cn(buttonVariants())}>
            <Plus className="mr-2 h-4 w-4" />
            New Turnover
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Unit Turnover</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unit ID (optional)</Label>
                  <Input
                    type="number"
                    value={form.unit_id}
                    onChange={(e) => setForm((f) => ({ ...f, unit_id: e.target.value }))}
                    placeholder="e.g. 42"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Community ID (optional)</Label>
                  <Input
                    type="number"
                    value={form.community_id}
                    onChange={(e) => setForm((f) => ({ ...f, community_id: e.target.value }))}
                    placeholder="e.g. 1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Scheduled Date</Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPending}>
                  {createPending ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {STATUS_COLUMNS.map((s) => (
          <Card key={s} className={cn("border", STATUS_HEADER_COLORS[s])}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground capitalize">
                {s.replace("_", " ")}
              </p>
              <p className="text-2xl font-bold mt-1">{counts[s]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        /* Kanban board */
        <div className="grid grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((status) => (
            <div key={status} className="flex flex-col gap-2">
              <div className={cn("rounded-lg border px-3 py-2 text-sm font-semibold capitalize", STATUS_HEADER_COLORS[status])}>
                {status.replace("_", " ")} ({counts[status]})
              </div>
              <div className="space-y-2 min-h-[8rem]">
                {byStatus(status).map((t) => (
                  <Card key={t.turnover_id} className="shadow-sm">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <p className="text-xs font-semibold">
                            {t.unit_id ? `Unit #${t.unit_id}` : "Unassigned Unit"}
                          </p>
                          {t.community_id && (
                            <p className="text-xs text-muted-foreground">Community #{t.community_id}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={cn("text-xs shrink-0", STATUS_COLORS[t.status])}>
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>

                      {t.scheduled_date && (
                        <p className="text-xs text-muted-foreground">
                          Scheduled: {formatDate(t.scheduled_date)}
                        </p>
                      )}
                      {t.completed_date && (
                        <p className="text-xs text-muted-foreground">
                          Completed: {formatDate(t.completed_date)}
                        </p>
                      )}

                      {/* Checklist */}
                      <div className="space-y-0.5">
                        {CHECKLIST_FIELDS.map(({ key, label }) => (
                          <label
                            key={key}
                            className="flex items-center gap-1.5 cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={!!t[key]}
                              onChange={() => handleChecklistToggle(t, key)}
                              className="h-3 w-3"
                            />
                            <span className={t[key] ? "line-through text-muted-foreground" : ""}>{label}</span>
                          </label>
                        ))}
                      </div>

                      {t.notes && (
                        <p className="text-xs text-muted-foreground italic">{t.notes}</p>
                      )}

                      {/* Status advance buttons */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {STATUS_COLUMNS.filter((s) => s !== t.status).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(t, s)}
                            className="text-xs px-1.5 py-0.5 rounded border hover:bg-muted capitalize"
                          >
                            → {s.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {byStatus(status).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center pt-4">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
