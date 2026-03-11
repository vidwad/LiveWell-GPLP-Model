"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  useMaintenanceRequests,
  useCreateMaintenanceRequest,
  useUpdateMaintenanceStatus,
} from "@/hooks/useCommunities";
import { useProperties } from "@/hooks/usePortfolio";
import { useAuth } from "@/providers/AuthProvider";
import { MaintenanceRequest, MaintenanceStatus } from "@/types/community";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, cn } from "@/lib/utils";

const COLUMNS: { status: MaintenanceStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In Progress" },
  { status: "resolved", label: "Resolved" },
];

const STATUS_BADGE: Record<MaintenanceStatus, string> = {
  open: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
};

export default function MaintenancePage() {
  const { user } = useAuth();
  const { data: requests, isLoading } = useMaintenanceRequests();
  const { data: properties } = useProperties();
  const { mutateAsync: create, isPending: createPending } = useCreateMaintenanceRequest();
  const { mutateAsync: updateStatus } = useUpdateMaintenanceStatus();

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    property_id: 0,
    description: "",
  });

  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);

  const canUpdate =
    user?.role === "GP_ADMIN" ||
    user?.role === "OPERATIONS_MANAGER" ||
    user?.role === "PROPERTY_MANAGER";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create(newForm);
      toast.success("Request submitted");
      setNewOpen(false);
      setNewForm({ property_id: 0, description: "" });
    } catch {
      toast.error("Failed to submit request");
    }
  };

  const handleStatusChange = async (status: MaintenanceStatus) => {
    if (!selected) return;
    try {
      await updateStatus({ id: selected.request_id, status });
      toast.success("Status updated");
      setSelected(null);
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground">Track and manage maintenance requests</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger className={cn(buttonVariants())}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Maintenance Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select
                  value={String(newForm.property_id)}
                  onValueChange={(v) =>
                    setNewForm((f) => ({ ...f, property_id: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property…" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((p) => (
                      <SelectItem key={p.property_id} value={String(p.property_id)}>
                        {p.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newForm.description}
                  onChange={(e) =>
                    setNewForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Describe the issue…"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={createPending || !newForm.property_id}
              >
                {createPending ? "Submitting…" : "Submit"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map(({ status, label }) => {
          const colItems = requests?.filter((r) => r.status === status) ?? [];
          return (
            <div key={status}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold">{label}</h2>
                <Badge variant="secondary">{colItems.length}</Badge>
              </div>
              <div className="space-y-3">
                {colItems.map((req) => (
                  <Card
                    key={req.request_id}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => setSelected(req)}
                  >
                    <CardContent className="p-4">
                      <p className="text-sm line-clamp-2">{req.description}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(req.created_at)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Prop #{req.property_id}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {colItems.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No {label.toLowerCase()} requests
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Request #{selected.request_id}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="mt-1 text-sm">{selected.description}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="mt-1 text-sm font-medium">
                    {properties?.find((p) => p.property_id === selected.property_id)?.address ??
                      `#${selected.property_id}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="mt-1 text-sm">{formatDate(selected.created_at)}</p>
                </div>
                {selected.resolved_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Resolved</p>
                    <p className="mt-1 text-sm">{formatDate(selected.resolved_at)}</p>
                  </div>
                )}
                {canUpdate && (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Update Status</p>
                    <div className="flex gap-2">
                      {COLUMNS.filter((c) => c.status !== selected.status).map(({ status, label }) => (
                        <Button
                          key={status}
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(status)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
