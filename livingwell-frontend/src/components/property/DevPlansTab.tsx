"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Layers,
  GitCompare,
  Pencil,
  TrendingUp,
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
import { UnitConfigurator, unitConfigsToApiPayload, type UnitConfig } from "@/components/property/UnitConfigurator";
import { apiClient } from "@/lib/api";
import type { DevelopmentPlan, DevelopmentPlanCreate, EditPlanForm } from "@/types/portfolio";

interface DevPlansTabProps {
  propertyId: number;
  canEdit: boolean;
  activePhase?: "as_is" | "post_renovation" | "full_development";
}

export function DevPlansTab({ propertyId, canEdit, activePhase = "full_development" }: DevPlansTabProps) {
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
    <div className="space-y-6">
      {/* Phase Context Banner */}
      {activePhase === "as_is" && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4 px-4 flex items-start gap-3">
            <Layers className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Plan Your Future Development</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                The property is currently in the <Badge variant="outline" className="mx-1">As-Is</Badge> phase.
                You can create development plans now to model future scenarios — compare different unit mixes,
                construction costs, and projected returns before committing to a renovation or full development.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {activePhase === "post_renovation" && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Layers className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">Renovation Plans</span> — Define and compare renovation scenarios
              including unit upgrades, bed additions, and cost estimates.
            </p>
          </CardContent>
        </Card>
      )}

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
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Development Plan</DialogTitle>
                </DialogHeader>
                <AddPlanForm
                  propertyId={propertyId}
                  onCreated={() => setPlanOpen(false)}
                  createPlan={createPlan}
                  isPending={planPending}
                />
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
                    <TableHead className="text-right">Exit Year</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">IRR</TableHead>
                    <TableHead className="text-right">Equity Multiple</TableHead>
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
                      <TableCell className="text-right">{plan.exit_sale_year ?? "—"}</TableCell>
                      <TableCell className="text-right">{plan.exit_sale_price ? formatCurrency(Number(plan.exit_sale_price)) : "—"}</TableCell>
                      <TableCell className="text-right font-medium text-blue-600">{plan.exit_irr != null ? `${Number(plan.exit_irr).toFixed(1)}%` : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{plan.exit_equity_multiple != null ? `${Number(plan.exit_equity_multiple).toFixed(2)}x` : "—"}</TableCell>
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
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Development Plan</DialogTitle>
                </DialogHeader>
                <EditPlanForm
                  propertyId={propertyId}
                  planId={editingPlanId!}
                  form={editPlanForm}
                  setForm={setEditPlanForm}
                  onSave={handleSavePlan}
                  onCancel={() => setEditingPlanId(null)}
                  isPending={updatePlanPending}
                />
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
            // Exit projections
            { label: "───── Exit Projections ─────", a: "", b: "" },
            { label: "Exit Sale Year", a: planA.exit_sale_year ? String(planA.exit_sale_year) : "—", b: planB.exit_sale_year ? String(planB.exit_sale_year) : "—" },
            { label: "Exit NOI", a: planA.exit_noi ? formatCurrency(Number(planA.exit_noi)) : "—", b: planB.exit_noi ? formatCurrency(Number(planB.exit_noi)) : "—", diff: planA.exit_noi && planB.exit_noi ? formatCurrency(Number(planB.exit_noi) - Number(planA.exit_noi)) : undefined, diffColor: Number(planB.exit_noi || 0) >= Number(planA.exit_noi || 0) ? "text-green-600" : "text-red-600" },
            { label: "Exit Cap Rate", a: planA.exit_cap_rate ? `${Number(planA.exit_cap_rate).toFixed(2)}%` : "—", b: planB.exit_cap_rate ? `${Number(planB.exit_cap_rate).toFixed(2)}%` : "—" },
            { label: "Gross Sale Price", a: planA.exit_sale_price ? formatCurrency(Number(planA.exit_sale_price)) : "—", b: planB.exit_sale_price ? formatCurrency(Number(planB.exit_sale_price)) : "—", diff: planA.exit_sale_price && planB.exit_sale_price ? formatCurrency(Number(planB.exit_sale_price) - Number(planA.exit_sale_price)) : undefined, diffColor: Number(planB.exit_sale_price || 0) >= Number(planA.exit_sale_price || 0) ? "text-green-600" : "text-red-600" },
            { label: "Net Sale Proceeds", a: planA.exit_net_proceeds ? formatCurrency(Number(planA.exit_net_proceeds)) : "—", b: planB.exit_net_proceeds ? formatCurrency(Number(planB.exit_net_proceeds)) : "—", diff: planA.exit_net_proceeds && planB.exit_net_proceeds ? formatCurrency(Number(planB.exit_net_proceeds) - Number(planA.exit_net_proceeds)) : undefined, diffColor: Number(planB.exit_net_proceeds || 0) >= Number(planA.exit_net_proceeds || 0) ? "text-green-600" : "text-red-600" },
            { label: "IRR Through Sale", a: planA.exit_irr != null ? `${Number(planA.exit_irr).toFixed(1)}%` : "—", b: planB.exit_irr != null ? `${Number(planB.exit_irr).toFixed(1)}%` : "—", diff: planA.exit_irr != null && planB.exit_irr != null ? `${(Number(planB.exit_irr) - Number(planA.exit_irr)).toFixed(1)}%` : undefined, diffColor: Number(planB.exit_irr || 0) >= Number(planA.exit_irr || 0) ? "text-green-600" : "text-red-600" },
            { label: "Equity Multiple", a: planA.exit_equity_multiple != null ? `${Number(planA.exit_equity_multiple).toFixed(2)}x` : "—", b: planB.exit_equity_multiple != null ? `${Number(planB.exit_equity_multiple).toFixed(2)}x` : "—", diff: planA.exit_equity_multiple != null && planB.exit_equity_multiple != null ? `${(Number(planB.exit_equity_multiple) - Number(planA.exit_equity_multiple)).toFixed(2)}x` : undefined, diffColor: Number(planB.exit_equity_multiple || 0) >= Number(planA.exit_equity_multiple || 0) ? "text-green-600" : "text-red-600" },
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
    </div>
  );
}


// ── Add Plan Form with UnitConfigurator ──

function AddPlanForm({ propertyId, onCreated, createPlan, isPending }: {
  propertyId: number;
  onCreated: () => void;
  createPlan: any;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationDays, setDurationDays] = useState("180");
  const [planUnits, setPlanUnits] = useState<UnitConfig[]>([
    { unit_number: "Unit 101", unit_type: "2br", bedrooms: 2, bathrooms: 1, sqft: 750, floor: "Main",
      bedroom_configs: [{ bedroom_number: 1, beds: 2, rent_per_bed: 800 }, { bedroom_number: 2, beds: 2, rent_per_bed: 800 }] },
  ]);

  const totalBeds = planUnits.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds, 0), 0);
  const totalSqft = planUnits.reduce((s, u) => s + u.sqft, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createPlan({
        plan_name: name || undefined,
        planned_units: planUnits.length,
        planned_beds: totalBeds,
        planned_sqft: totalSqft,
        estimated_construction_cost: Number(cost) || 0,
        development_start_date: startDate || undefined,
        construction_duration_days: Number(durationDays) || 180,
      });
      // Configure units for the new plan
      const planId = result?.plan_id;
      if (planId) {
        const payload = unitConfigsToApiPayload(planUnits);
        await apiClient.post(`/api/portfolio/properties/${propertyId}/configure-units`, {
          plan_id: planId,
          units: payload.units,
          clear_existing: true,
        });
      }
      toast.success("Development plan created with units");
      onCreated();
    } catch { toast.error("Failed to create plan"); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2"><Label>Plan Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kitchen Renovation, Full 6-Plex" /></div>
        <div className="space-y-1"><Label>Est. Construction Cost ($)</Label><Input type="number" value={cost} onChange={e => setCost(e.target.value)} required /></div>
        <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div className="space-y-1"><Label>Duration (days)</Label><Input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} /></div>
      </div>

      <UnitConfigurator
        units={planUnits}
        onChange={setPlanUnits}
        defaultRentPerBed={800}
        label="Planned Unit & Bed Configuration"
      />

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating..." : "Create Plan"}
      </Button>
    </form>
  );
}


// ── Edit Plan Form with UnitConfigurator ──

function EditPlanForm({ propertyId, planId, form, setForm, onSave, onCancel, isPending }: {
  propertyId: number;
  planId: number;
  form: any;
  setForm: (fn: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [editUnits, setEditUnits] = useState<UnitConfig[]>([]);
  const [unitsLoaded, setUnitsLoaded] = useState(false);

  // Load existing units for this plan
  React.useEffect(() => {
    if (!planId || unitsLoaded) return;
    apiClient.get(`/api/portfolio/properties/${propertyId}/units?plan_id=${planId}`)
      .then(r => {
        const units = r.data || [];
        if (units.length > 0) {
          const configs: UnitConfig[] = units.map((u: any) => ({
            unit_number: u.unit_number,
            unit_type: u.unit_type || "shared",
            bedrooms: u.bedroom_count || u.bed_count || 1,
            bathrooms: 1,
            sqft: Number(u.sqft) || 0,
            floor: u.floor || "",
            bedroom_configs: (u.beds || []).reduce((acc: any[], b: any) => {
              const br = acc.find((x: any) => x.bedroom_number === (b.bedroom_number || 1));
              if (br) { br.beds += 1; }
              else { acc.push({ bedroom_number: b.bedroom_number || acc.length + 1, beds: 1, rent_per_bed: Number(b.monthly_rent) || 0 }); }
              return acc;
            }, [] as { bedroom_number: number; beds: number; rent_per_bed: number }[]),
          }));
          setEditUnits(configs);
        } else {
          setEditUnits([{
            unit_number: "Unit 101", unit_type: "2br", bedrooms: 2, bathrooms: 1, sqft: 750, floor: "Main",
            bedroom_configs: [{ bedroom_number: 1, beds: 1, rent_per_bed: 700 }, { bedroom_number: 2, beds: 1, rent_per_bed: 700 }],
          }]);
        }
        setUnitsLoaded(true);
      })
      .catch(() => setUnitsLoaded(true));
  }, [planId, propertyId, unitsLoaded]);

  const totalBeds = editUnits.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds, 0), 0);
  const totalSqft = editUnits.reduce((s, u) => s + u.sqft, 0);

  const handleSaveWithUnits = async () => {
    // Update plan totals from unit configs
    setForm((f: any) => ({ ...f, planned_units: editUnits.length, planned_beds: totalBeds, planned_sqft: totalSqft }));

    // Save plan metadata
    await onSave();

    // Then configure units
    try {
      const payload = unitConfigsToApiPayload(editUnits);
      await apiClient.post(`/api/portfolio/properties/${propertyId}/configure-units`, {
        plan_id: planId,
        units: payload.units,
        clear_existing: true,
      });
      toast.success("Units updated");
    } catch { toast.error("Plan saved but unit update failed"); }
  };

  const sf = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-4">
      {/* Plan Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2"><Label>Plan Name</Label><Input value={form.plan_name} onChange={e => sf("plan_name", e.target.value)} placeholder="e.g. 8-Plex Conversion" /></div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={String(form.status)} onValueChange={v => sf("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="superseded">Superseded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Est. Construction Cost ($)</Label><Input type="number" value={form.estimated_construction_cost} onChange={e => sf("estimated_construction_cost", Number(e.target.value))} /></div>
      </div>

      {/* Cost Breakdown */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost Breakdown</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1"><Label className="text-xs">Hard Costs</Label><Input type="number" value={form.hard_costs} onChange={e => sf("hard_costs", Number(e.target.value))} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Soft Costs</Label><Input type="number" value={form.soft_costs} onChange={e => sf("soft_costs", Number(e.target.value))} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Site Costs</Label><Input type="number" value={form.site_costs} onChange={e => sf("site_costs", Number(e.target.value))} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Financing</Label><Input type="number" value={form.financing_costs} onChange={e => sf("financing_costs", Number(e.target.value))} className="h-8 text-sm" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Contingency %</Label><Input type="number" value={form.contingency_percent} onChange={e => sf("contingency_percent", Number(e.target.value))} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Annual Rent Increase %</Label><Input type="number" value={form.annual_rent_increase_pct} onChange={e => sf("annual_rent_increase_pct", Number(e.target.value))} className="h-8 text-sm" /></div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={form.development_start_date} onChange={e => sf("development_start_date", e.target.value)} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Duration (days)</Label><Input type="number" value={form.construction_duration_days} onChange={e => sf("construction_duration_days", Number(e.target.value))} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Completion</Label><Input type="date" value={form.estimated_completion_date} onChange={e => sf("estimated_completion_date", e.target.value)} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Stabilization</Label><Input type="date" value={form.estimated_stabilization_date} onChange={e => sf("estimated_stabilization_date", e.target.value)} className="h-8 text-sm" /></div>
        </div>
      </div>

      {/* Unit & Bed Configuration */}
      <UnitConfigurator
        units={editUnits}
        onChange={setEditUnits}
        defaultRentPerBed={700}
        label="Planned Unit & Bed Configuration"
      />

      {/* Exit Assumptions */}
      <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 space-y-3">
        <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Exit Assumptions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1"><Label className="text-xs">Exit Year</Label><Input type="number" value={form.exit_sale_year || ""} onChange={e => sf("exit_sale_year", Number(e.target.value) || 0)} className="h-8 text-sm" placeholder="2032" /></div>
          <div className="space-y-1"><Label className="text-xs">Exit Cap (%)</Label><Input type="number" step="0.1" value={form.exit_cap_rate || ""} onChange={e => sf("exit_cap_rate", Number(e.target.value) || 0)} className="h-8 text-sm" placeholder="5.0" /></div>
          <div className="space-y-1"><Label className="text-xs">Exit NOI ($)</Label><Input type="number" value={form.exit_noi || ""} onChange={e => sf("exit_noi", Number(e.target.value) || 0)} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">IRR (%)</Label><Input type="number" step="0.1" value={form.exit_irr || ""} onChange={e => sf("exit_irr", Number(e.target.value) || 0)} className="h-8 text-sm" /></div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSaveWithUnits} disabled={isPending}>
          {isPending ? "Saving..." : "Save Plan & Units"}
        </Button>
      </div>
    </div>
  );
}
