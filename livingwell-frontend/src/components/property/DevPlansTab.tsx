"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Layers,
  GitCompare,
  Pencil,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  useDevelopmentPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
} from "@/hooks/usePortfolio";
import type { DevelopmentPlan, DevelopmentPlanCreate, EditPlanForm } from "@/types/portfolio";

interface DevPlansTabProps {
  propertyId: number;
  canEdit: boolean;
}

export function DevPlansTab({ propertyId, canEdit }: DevPlansTabProps) {
  const { data: plans } = useDevelopmentPlans(propertyId);
  const { mutateAsync: createPlan, isPending: planPending } = useCreatePlan(propertyId);
  const { mutateAsync: updatePlan, isPending: updatePlanPending } = useUpdatePlan(propertyId);
  const { mutateAsync: deletePlan } = useDeletePlan(propertyId);

  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState<DevelopmentPlanCreate>({
    planned_units: 0, planned_beds: 0, planned_sqft: 0,
    estimated_construction_cost: 0, development_start_date: "", construction_duration_days: 0,
  });

  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editPlanForm, setEditPlanForm] = useState<EditPlanForm>({
    plan_name: "", status: "", planned_units: 0, planned_beds: 0, planned_sqft: 0,
    estimated_construction_cost: 0, development_start_date: "", construction_duration_days: 0,
    hard_costs: 0, soft_costs: 0, site_costs: 0, financing_costs: 0,
    contingency_percent: 0, cost_per_sqft: 0,
    projected_annual_revenue: 0, projected_annual_noi: 0,
    estimated_completion_date: "", estimated_stabilization_date: "",
    rent_pricing_mode: "", annual_rent_increase_pct: 0,
  });

  const [compareMode, setCompareMode] = useState(false);
  const [comparePlanIds, setComparePlanIds] = useState<[number | null, number | null]>([null, null]);

  const startEditingPlan = (plan: DevelopmentPlan) => {
    setEditingPlanId(plan.plan_id);
    setEditPlanForm({
      plan_name: plan.plan_name || "",
      status: plan.status || "draft",
      planned_units: plan.planned_units,
      planned_beds: plan.planned_beds,
      planned_sqft: Number(plan.planned_sqft) || 0,
      estimated_construction_cost: Number(plan.estimated_construction_cost) || 0,
      hard_costs: Number(plan.hard_costs) || 0,
      soft_costs: Number(plan.soft_costs) || 0,
      site_costs: Number(plan.site_costs) || 0,
      financing_costs: Number(plan.financing_costs) || 0,
      contingency_percent: Number(plan.contingency_percent) || 0,
      cost_per_sqft: Number(plan.cost_per_sqft) || 0,
      projected_annual_revenue: Number(plan.projected_annual_revenue) || 0,
      projected_annual_noi: Number(plan.projected_annual_noi) || 0,
      development_start_date: plan.development_start_date || "",
      construction_duration_days: plan.construction_duration_days || 0,
      estimated_completion_date: plan.estimated_completion_date || "",
      estimated_stabilization_date: plan.estimated_stabilization_date || "",
      rent_pricing_mode: plan.rent_pricing_mode || "by_bed",
      annual_rent_increase_pct: Number(plan.annual_rent_increase_pct) || 0,
    });
  };

  const handleSavePlan = async () => {
    if (!editingPlanId) return;
    try {
      const data: Record<string, string | number | undefined> = {};
      for (const [key, value] of Object.entries(editPlanForm)) {
        if (value !== "" && value !== 0) data[key] = value;
        else if (key === "plan_name" && value === "") continue;
        else data[key] = value || undefined;
      }
      await updatePlan({ planId: editingPlanId, data });
      toast.success("Development plan updated");
      setEditingPlanId(null);
    } catch (e) { toast.error("Failed to update plan"); }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm("Delete this development plan? This cannot be undone.")) return;
    try {
      await deletePlan(planId);
      toast.success("Development plan deleted");
    } catch (e) { toast.error("Failed to delete plan"); }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPlan(planForm);
      toast.success("Development plan added");
      setPlanOpen(false);
    } catch (e) { toast.error("Failed to add plan"); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Development Plans</CardTitle>
        <div className="flex items-center gap-2">
          {plans && plans.length >= 2 && (
            <Button
              variant={compareMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setCompareMode(!compareMode);
                if (!compareMode && plans.length >= 2) {
                  setComparePlanIds([plans[0].plan_id, plans[1].plan_id]);
                }
              }}
            >
              <GitCompare className="mr-1.5 h-4 w-4" />
              {compareMode ? "Exit Compare" : "Compare"}
            </Button>
          )}
          {canEdit && (
            <Dialog open={planOpen} onOpenChange={setPlanOpen}>
              <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Plan
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Development Plan</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPlan} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Planned Units</Label>
                      <Input type="number" value={planForm.planned_units || ""} onChange={(e) => setPlanForm((f) => ({ ...f, planned_units: Number(e.target.value) }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Planned Beds</Label>
                      <Input type="number" value={planForm.planned_beds || ""} onChange={(e) => setPlanForm((f) => ({ ...f, planned_beds: Number(e.target.value) }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Planned Sqft</Label>
                      <Input type="number" value={planForm.planned_sqft || ""} onChange={(e) => setPlanForm((f) => ({ ...f, planned_sqft: Number(e.target.value) }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Est. Construction Cost</Label>
                      <Input type="number" value={planForm.estimated_construction_cost || ""} onChange={(e) => setPlanForm((f) => ({ ...f, estimated_construction_cost: Number(e.target.value) }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={planForm.development_start_date} onChange={(e) => setPlanForm((f) => ({ ...f, development_start_date: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (days)</Label>
                      <Input type="number" value={planForm.construction_duration_days || ""} onChange={(e) => setPlanForm((f) => ({ ...f, construction_duration_days: Number(e.target.value) }))} required />
                    </div>
                  </div>
                  <Button type="submit" disabled={planPending} className="w-full sm:w-auto">
                    {planPending ? "Adding\u2026" : "Add Plan"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!plans || plans.length === 0 ? (
          <div className="text-center py-8">
            <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No development plans yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add a plan to track units, costs, and timelines.</p>
          </div>
        ) : (
          <React.Fragment>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Beds</TableHead>
                    <TableHead className="text-right">Sqft</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                    <TableHead className="text-right">Cost/sqft</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead className="text-right">Proj. NOI</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan: DevelopmentPlan) => (
                    <TableRow key={plan.plan_id}>
                      <TableCell className="font-medium">{plan.plan_name || `Plan v${plan.version}`}</TableCell>
                      <TableCell>
                        <Badge variant={plan.status === "active" ? "default" : "secondary"} className="text-xs">
                          {plan.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{plan.planned_units}</TableCell>
                      <TableCell className="text-right">{plan.planned_beds}</TableCell>
                      <TableCell className="text-right">{Number(plan.planned_sqft).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{plan.estimated_construction_cost ? formatCurrency(Number(plan.estimated_construction_cost)) : "—"}</TableCell>
                      <TableCell className="text-right">{plan.cost_per_sqft ? `$${Number(plan.cost_per_sqft).toFixed(0)}` : "—"}</TableCell>
                      <TableCell>{plan.development_start_date ? formatDate(plan.development_start_date) : "—"}</TableCell>
                      <TableCell>{plan.estimated_completion_date ? formatDate(plan.estimated_completion_date) : "—"}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{plan.projected_annual_noi ? formatCurrency(Number(plan.projected_annual_noi)) : "—"}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditingPlan(plan)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeletePlan(plan.plan_id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Edit Plan Dialog */}
            <Dialog open={editingPlanId !== null} onOpenChange={(open) => { if (!open) setEditingPlanId(null); }}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Development Plan</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Plan Name</Label>
                      <Input value={editPlanForm.plan_name} onChange={(e) => setEditPlanForm((f) => ({ ...f, plan_name: e.target.value }))} placeholder="e.g. 8-Plex Conversion" />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={String(editPlanForm.status)} onValueChange={(v) => setEditPlanForm((f) => ({ ...f, status: v ?? "" }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="superseded">Superseded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Pricing Mode</Label>
                      <Select value={String(editPlanForm.rent_pricing_mode)} onValueChange={(v) => setEditPlanForm((f) => ({ ...f, rent_pricing_mode: v ?? "" }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="by_bed">By Bed</SelectItem>
                          <SelectItem value="by_unit">By Unit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Planned Units</Label><Input type="number" value={editPlanForm.planned_units} onChange={(e) => setEditPlanForm((f) => ({ ...f, planned_units: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Planned Beds</Label><Input type="number" value={editPlanForm.planned_beds} onChange={(e) => setEditPlanForm((f) => ({ ...f, planned_beds: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Planned Sqft</Label><Input type="number" value={editPlanForm.planned_sqft} onChange={(e) => setEditPlanForm((f) => ({ ...f, planned_sqft: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Est. Construction Cost</Label><Input type="number" value={editPlanForm.estimated_construction_cost} onChange={(e) => setEditPlanForm((f) => ({ ...f, estimated_construction_cost: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Hard Costs</Label><Input type="number" value={editPlanForm.hard_costs} onChange={(e) => setEditPlanForm((f) => ({ ...f, hard_costs: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Soft Costs</Label><Input type="number" value={editPlanForm.soft_costs} onChange={(e) => setEditPlanForm((f) => ({ ...f, soft_costs: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Site Costs</Label><Input type="number" value={editPlanForm.site_costs} onChange={(e) => setEditPlanForm((f) => ({ ...f, site_costs: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Financing Costs</Label><Input type="number" value={editPlanForm.financing_costs} onChange={(e) => setEditPlanForm((f) => ({ ...f, financing_costs: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Contingency %</Label><Input type="number" value={editPlanForm.contingency_percent} onChange={(e) => setEditPlanForm((f) => ({ ...f, contingency_percent: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Annual Rent Increase %</Label><Input type="number" value={editPlanForm.annual_rent_increase_pct} onChange={(e) => setEditPlanForm((f) => ({ ...f, annual_rent_increase_pct: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Proj. Annual Revenue</Label><Input type="number" value={editPlanForm.projected_annual_revenue} onChange={(e) => setEditPlanForm((f) => ({ ...f, projected_annual_revenue: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Proj. Annual NOI</Label><Input type="number" value={editPlanForm.projected_annual_noi} onChange={(e) => setEditPlanForm((f) => ({ ...f, projected_annual_noi: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={editPlanForm.development_start_date} onChange={(e) => setEditPlanForm((f) => ({ ...f, development_start_date: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Duration (days)</Label><Input type="number" value={editPlanForm.construction_duration_days} onChange={(e) => setEditPlanForm((f) => ({ ...f, construction_duration_days: Number(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Est. Completion Date</Label><Input type="date" value={editPlanForm.estimated_completion_date} onChange={(e) => setEditPlanForm((f) => ({ ...f, estimated_completion_date: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Est. Stabilization Date</Label><Input type="date" value={editPlanForm.estimated_stabilization_date} onChange={(e) => setEditPlanForm((f) => ({ ...f, estimated_stabilization_date: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setEditingPlanId(null)}>Cancel</Button>
                    <Button onClick={handleSavePlan} disabled={updatePlanPending}>
                      {updatePlanPending ? "Saving\u2026" : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </React.Fragment>
        )}

        {/* Comparison View */}
        {compareMode && plans && plans.length >= 2 && (() => {
          const planA = plans.find((p: DevelopmentPlan) => p.plan_id === comparePlanIds[0]);
          const planB = plans.find((p: DevelopmentPlan) => p.plan_id === comparePlanIds[1]);
          if (!planA || !planB) return null;

          const rows: { label: string; a: string; b: string; diff?: string; diffColor?: string }[] = [
            { label: "Version", a: `v${planA.version ?? planA.plan_id}`, b: `v${planB.version ?? planB.plan_id}` },
            { label: "Status", a: planA.status, b: planB.status },
            { label: "Planned Units", a: String(planA.planned_units), b: String(planB.planned_units), diff: String(planB.planned_units - planA.planned_units), diffColor: planB.planned_units >= planA.planned_units ? "text-green-600" : "text-red-600" },
            { label: "Planned Beds", a: String(planA.planned_beds), b: String(planB.planned_beds), diff: String(planB.planned_beds - planA.planned_beds), diffColor: planB.planned_beds >= planA.planned_beds ? "text-green-600" : "text-red-600" },
            { label: "Planned Sqft", a: Number(planA.planned_sqft).toLocaleString(), b: Number(planB.planned_sqft).toLocaleString(), diff: (Number(planB.planned_sqft) - Number(planA.planned_sqft)).toLocaleString(), diffColor: Number(planB.planned_sqft) >= Number(planA.planned_sqft) ? "text-green-600" : "text-red-600" },
            { label: "Est. Construction Cost", a: planA.estimated_construction_cost ? formatCurrency(Number(planA.estimated_construction_cost)) : "—", b: planB.estimated_construction_cost ? formatCurrency(Number(planB.estimated_construction_cost)) : "—", diff: planA.estimated_construction_cost && planB.estimated_construction_cost ? formatCurrency(Number(planB.estimated_construction_cost) - Number(planA.estimated_construction_cost)) : undefined, diffColor: Number(planB.estimated_construction_cost || 0) <= Number(planA.estimated_construction_cost || 0) ? "text-green-600" : "text-red-600" },
            { label: "Cost per Sqft", a: planA.cost_per_sqft ? `$${Number(planA.cost_per_sqft).toFixed(0)}` : "—", b: planB.cost_per_sqft ? `$${Number(planB.cost_per_sqft).toFixed(0)}` : "—" },
            { label: "Hard Costs", a: planA.hard_costs ? formatCurrency(Number(planA.hard_costs)) : "—", b: planB.hard_costs ? formatCurrency(Number(planB.hard_costs)) : "—" },
            { label: "Soft Costs", a: planA.soft_costs ? formatCurrency(Number(planA.soft_costs)) : "—", b: planB.soft_costs ? formatCurrency(Number(planB.soft_costs)) : "—" },
            { label: "Projected Annual NOI", a: planA.projected_annual_noi ? formatCurrency(Number(planA.projected_annual_noi)) : "—", b: planB.projected_annual_noi ? formatCurrency(Number(planB.projected_annual_noi)) : "—", diff: planA.projected_annual_noi && planB.projected_annual_noi ? formatCurrency(Number(planB.projected_annual_noi) - Number(planA.projected_annual_noi)) : undefined, diffColor: Number(planB.projected_annual_noi || 0) >= Number(planA.projected_annual_noi || 0) ? "text-green-600" : "text-red-600" },
            { label: "Start Date", a: planA.development_start_date ? formatDate(planA.development_start_date) : "—", b: planB.development_start_date ? formatDate(planB.development_start_date) : "—" },
            { label: "Est. Completion", a: planA.estimated_completion_date ? formatDate(planA.estimated_completion_date) : "—", b: planB.estimated_completion_date ? formatDate(planB.estimated_completion_date) : "—" },
          ];

          return (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-xs">Plan A:</Label>
                <select className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={comparePlanIds[0] ?? ""} onChange={(e) => setComparePlanIds([Number(e.target.value), comparePlanIds[1]])}>
                  {plans.map((p: DevelopmentPlan) => (
                    <option key={p.plan_id} value={p.plan_id}>v{p.version ?? p.plan_id} — {p.status} ({p.planned_units} units)</option>
                  ))}
                </select>
                <Label className="text-xs">Plan B:</Label>
                <select className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={comparePlanIds[1] ?? ""} onChange={(e) => setComparePlanIds([comparePlanIds[0], Number(e.target.value)])}>
                  {plans.map((p: DevelopmentPlan) => (
                    <option key={p.plan_id} value={p.plan_id}>v{p.version ?? p.plan_id} — {p.status} ({p.planned_units} units)</option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[180px]">Metric</TableHead>
                      <TableHead className="text-right">Plan A</TableHead>
                      <TableHead className="text-right">Plan B</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="text-sm font-medium">{row.label}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{row.a}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{row.b}</TableCell>
                        <TableCell className={cn("text-right text-sm tabular-nums font-medium", row.diffColor)}>
                          {row.diff !== undefined ? (Number(row.diff.replace(/[^\d.-]/g, "")) > 0 ? "+" : "") + row.diff : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
