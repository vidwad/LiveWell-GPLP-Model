"use client";

import React, { useState, useRef, useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, ChevronDown, ChevronRight, Layers, Calendar,
  DollarSign, Trash2, GripHorizontal, Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useDevelopmentPlans, useCreatePlan, useUpdatePlan, useDeletePlan,
} from "@/hooks/usePortfolio";
import { UnitConfigurator, unitConfigsToApiPayload, type UnitConfig } from "@/components/property/UnitConfigurator";
import { ConstructionBudgetTab } from "@/components/property/ConstructionBudgetTab";
import type { DevelopmentPlan } from "@/types/portfolio";

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n) : "—";

interface StrategyTabProps {
  propertyId: number;
  canEdit: boolean;
  property: Record<string, any>;
}

export function StrategyTab({ propertyId, canEdit, property }: StrategyTabProps) {
  const qc = useQueryClient();
  const { data: plans } = useDevelopmentPlans(propertyId);
  const { mutateAsync: createPlan, isPending: creating } = useCreatePlan(propertyId);
  const { mutateAsync: updatePlan } = useUpdatePlan(propertyId);
  const { mutateAsync: deletePlan } = useDeletePlan(propertyId);

  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  const sortedPlans = [...(plans ?? [])].sort((a: DevelopmentPlan, b: DevelopmentPlan) => {
    const da = a.development_start_date || "9999";
    const db2 = b.development_start_date || "9999";
    return da < db2 ? -1 : da > db2 ? 1 : 0;
  });

  // Timeline bounds
  const purchaseDate = property?.purchase_date ? new Date(property.purchase_date) : new Date();
  const exitYear = (() => {
    // Try to get from plans or default to purchase + 7
    return purchaseDate.getFullYear() + 10;
  })();
  const timelineStart = new Date(purchaseDate.getFullYear(), 0, 1);
  const timelineEnd = new Date(exitYear + 1, 0, 1);
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();

  const dateToPercent = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return Math.max(0, Math.min(100, ((date.getTime() - timelineStart.getTime()) / totalMs) * 100));
  };

  const percentToDate = (pct: number) => {
    const ms = timelineStart.getTime() + (pct / 100) * totalMs;
    return new Date(ms);
  };

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  const handleAddPlan = async () => {
    const nextStart = new Date();
    nextStart.setMonth(nextStart.getMonth() + 3);
    try {
      await createPlan({
        plan_name: `Development Plan ${(plans?.length || 0) + 1}`,
        planned_units: 1, planned_beds: 4, planned_sqft: 1200,
        estimated_construction_cost: 100000,
        development_start_date: formatDate(nextStart),
        construction_duration_days: 180,
      });
      toast.success("Plan added");
    } catch { toast.error("Failed to add plan"); }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm("Delete this development plan?")) return;
    try {
      await deletePlan(planId);
      toast.success("Plan deleted");
      if (expandedPlanId === planId) setExpandedPlanId(null);
    } catch { toast.error("Failed to delete"); }
  };

  // Years for grid
  const startYear = timelineStart.getFullYear();
  const endYear = timelineEnd.getFullYear();
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            Master Plan
          </h3>
          <p className="text-sm text-muted-foreground">Development timeline and plan details for this property.</p>
        </div>
        {canEdit && (
          <Button onClick={handleAddPlan} disabled={creating} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />{creating ? "Adding..." : "Add Plan"}
          </Button>
        )}
      </div>

      {/* ═══ STRATEGY TIMELINE (Gantt) ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Strategy Timeline</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {/* Year grid */}
          <div className="relative">
            <div className="flex mb-1">
              {years.map(y => (
                <div key={y} className="text-center text-[10px] text-muted-foreground border-r border-dashed last:border-0" style={{ width: `${100 / years.length}%` }}>
                  {y}
                </div>
              ))}
            </div>

            {/* Timeline area */}
            <div className="relative h-auto min-h-[60px] bg-muted/20 rounded-lg border overflow-hidden">
              {/* Year grid lines */}
              {years.map((y, i) => (
                <div key={y} className="absolute top-0 bottom-0 border-r border-dashed border-muted" style={{ left: `${((i + 1) / years.length) * 100}%` }} />
              ))}

              {/* Today marker */}
              <div className="absolute top-0 bottom-0 w-px bg-red-400 z-20" style={{ left: `${dateToPercent(new Date())}%` }} />

              {/* Purchase marker */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-purple-500 z-10 rounded" style={{ left: `${dateToPercent(purchaseDate)}%` }} title={`Purchased: ${formatDate(purchaseDate)}`} />

              {/* As-Is bar */}
              {(() => {
                const firstPlanStart = sortedPlans.find((p: DevelopmentPlan) => p.development_start_date)?.development_start_date;
                const asIsEnd = firstPlanStart ? dateToPercent(firstPlanStart) : dateToPercent(new Date());
                const asIsStart = dateToPercent(purchaseDate);
                const width = asIsEnd - asIsStart;
                if (width <= 0) return null;
                return (
                  <div className="absolute h-6 top-2 bg-blue-400/70 rounded-full z-5" style={{ left: `${asIsStart}%`, width: `${width}%` }}>
                    {width > 5 && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white">As-Is</span>}
                  </div>
                );
              })()}

              {/* Plan bars (draggable) */}
              {sortedPlans.map((plan: DevelopmentPlan, pi: number) => (
                <DraggablePlanBar
                  key={plan.plan_id}
                  plan={plan}
                  index={pi}
                  dateToPercent={dateToPercent}
                  percentToDate={percentToDate}
                  formatDate={formatDate}
                  totalPlans={sortedPlans.length}
                  onUpdate={async (startDate, durationDays) => {
                    try {
                      await updatePlan({
                        planId: plan.plan_id,
                        data: {
                          development_start_date: startDate,
                          construction_duration_days: durationDays,
                        },
                      });
                    } catch { toast.error("Failed to update timeline"); }
                  }}
                  canEdit={canEdit}
                />
              ))}

              {/* Spacer for vertical height */}
              <div style={{ height: `${Math.max(60, (sortedPlans.length + 1) * 28 + 10)}px` }} />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-4 bg-blue-400 rounded-full" /> As-Is</span>
              <span className="flex items-center gap-1"><span className="h-2 w-4 bg-orange-400 rounded-full" /> Construction</span>
              <span className="flex items-center gap-1"><span className="h-2 w-4 bg-yellow-400 rounded-full" /> Lease-Up</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-red-400" /> Today</span>
              <span className="flex items-center gap-1"><span className="h-3 w-0.5 bg-purple-500 rounded" /> Purchase</span>
              {canEdit && <span className="ml-auto italic">Drag bars to adjust timing</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ PLAN CARDS ═══ */}
      {sortedPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No development plans yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add a plan to define your renovation or development strategy.</p>
          </CardContent>
        </Card>
      ) : (
        sortedPlans.map((plan: DevelopmentPlan) => (
          <PlanCard
            key={plan.plan_id}
            plan={plan}
            propertyId={propertyId}
            canEdit={canEdit}
            expanded={expandedPlanId === plan.plan_id}
            onToggle={() => setExpandedPlanId(expandedPlanId === plan.plan_id ? null : plan.plan_id)}
            onDelete={() => handleDeletePlan(plan.plan_id)}
            onUpdate={updatePlan}
          />
        ))
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// Draggable Plan Bar
// ═══════════════════════════════════════════════════════════════════════

function DraggablePlanBar({
  plan, index, dateToPercent, percentToDate, formatDate, totalPlans, onUpdate, canEdit,
}: {
  plan: DevelopmentPlan;
  index: number;
  dateToPercent: (d: Date | string) => number;
  percentToDate: (pct: number) => Date;
  formatDate: (d: Date) => string;
  totalPlans: number;
  onUpdate: (startDate: string, durationDays: number) => Promise<void>;
  canEdit: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, startPct: 0, widthPct: 0 });

  const startDate = plan.development_start_date;
  if (!startDate) return null;

  const durationDays = plan.construction_duration_days || (plan.construction_duration_months ? plan.construction_duration_months * 30 : 180);
  const endDate = new Date(new Date(startDate).getTime() + durationDays * 86400000);
  const leaseUpMonths = (plan as any).lease_up_months || 6;
  const leaseUpEnd = new Date(endDate.getTime() + leaseUpMonths * 30 * 86400000);

  const barLeft = dateToPercent(startDate);
  const barWidth = dateToPercent(endDate) - barLeft;
  const leaseWidth = dateToPercent(leaseUpEnd) - dateToPercent(endDate);
  const top = 2 + (index + 1) * 28;

  const handlePointerDown = useCallback((e: React.PointerEvent, type: "move" | "resize") => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    containerRef.current = barRef.current?.parentElement ?? null;
    setDragging(type);
    setDragStart({
      x: e.clientX,
      startPct: barLeft,
      widthPct: barWidth,
    });
  }, [canEdit, barLeft, barWidth]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaPct = ((e.clientX - dragStart.x) / rect.width) * 100;

    if (dragging === "move") {
      const newLeft = Math.max(0, Math.min(100 - dragStart.widthPct, dragStart.startPct + deltaPct));
      const newStart = percentToDate(newLeft);
      if (barRef.current) {
        barRef.current.style.left = `${newLeft}%`;
      }
    } else if (dragging === "resize") {
      const newWidth = Math.max(2, dragStart.widthPct + deltaPct);
      if (barRef.current) {
        barRef.current.style.width = `${newWidth}%`;
      }
    }
  }, [dragging, dragStart, percentToDate]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaPct = ((e.clientX - dragStart.x) / rect.width) * 100;

    if (dragging === "move") {
      const newLeft = Math.max(0, Math.min(100 - dragStart.widthPct, dragStart.startPct + deltaPct));
      const newStart = percentToDate(newLeft);
      await onUpdate(formatDate(newStart), durationDays);
    } else if (dragging === "resize") {
      const newWidth = Math.max(2, dragStart.widthPct + deltaPct);
      const newEnd = percentToDate(dragStart.startPct + newWidth);
      const newDuration = Math.round((newEnd.getTime() - new Date(startDate).getTime()) / 86400000);
      await onUpdate(startDate, Math.max(30, newDuration));
    }

    setDragging(null);
  }, [dragging, dragStart, percentToDate, formatDate, onUpdate, durationDays, startDate]);

  return (
    <>
      {/* Construction bar */}
      <div
        ref={barRef}
        className={cn(
          "absolute h-6 bg-orange-400/80 rounded-full z-10 flex items-center",
          canEdit && "cursor-grab",
          dragging === "move" && "cursor-grabbing opacity-70",
        )}
        style={{ left: `${barLeft}%`, width: `${barWidth}%`, top: `${top}px` }}
        onPointerDown={e => handlePointerDown(e, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title={`${plan.plan_name}: ${startDate} → ${formatDate(endDate)} (${durationDays} days)`}
      >
        {barWidth > 8 && (
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white truncate px-2">
            {plan.plan_name || "Plan"}
          </span>
        )}
        {/* Resize handle */}
        {canEdit && (
          <div
            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize rounded-r-full hover:bg-orange-600/50 flex items-center justify-center"
            onPointerDown={e => handlePointerDown(e, "resize")}
          >
            <GripHorizontal className="h-2.5 w-2.5 text-white/70" />
          </div>
        )}
      </div>
      {/* Lease-up bar */}
      {leaseWidth > 0 && (
        <div
          className="absolute h-6 bg-yellow-400/60 rounded-full z-5"
          style={{ left: `${dateToPercent(endDate)}%`, width: `${leaseWidth}%`, top: `${top}px` }}
          title={`Lease-up: ${formatDate(endDate)} → ${formatDate(leaseUpEnd)}`}
        >
          {leaseWidth > 5 && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-yellow-800">Lease-Up</span>}
        </div>
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// Expandable Plan Card
// ═══════════════════════════════════════════════════════════════════════

function PlanCard({
  plan, propertyId, canEdit, expanded, onToggle, onDelete, onUpdate,
}: {
  plan: DevelopmentPlan;
  propertyId: number;
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: any;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [planUnits, setPlanUnits] = useState<UnitConfig[]>([]);
  const [unitsLoaded, setUnitsLoaded] = useState(false);

  // Load existing units for this plan when expanded
  React.useEffect(() => {
    if (!expanded || unitsLoaded) return;
    apiClient.get(`/api/portfolio/properties/${propertyId}/units?plan_id=${plan.plan_id}`)
      .then(r => {
        const units = r.data || [];
        if (units.length > 0) {
          const configs: UnitConfig[] = units.map((u: any) => {
            const brMap = new Map<number, { beds: number; rent_per_bed: number }>();
            for (const b of (u.beds || [])) {
              const br = b.bedroom_number || 1;
              if (!brMap.has(br)) brMap.set(br, { beds: 0, rent_per_bed: Number(b.monthly_rent) || 0 });
              const entry = brMap.get(br)!;
              entry.rent_per_bed = (entry.rent_per_bed * entry.beds + (Number(b.monthly_rent) || 0)) / (entry.beds + 1);
              entry.beds += 1;
            }
            if (brMap.size === 0) {
              const n = u.bedroom_count || u.bed_count || 1;
              for (let i = 1; i <= n; i++) brMap.set(i, { beds: 1, rent_per_bed: 700 });
            }
            return {
              unit_number: u.unit_number, unit_type: u.unit_type || "shared",
              bedrooms: brMap.size, bathrooms: 1, sqft: Number(u.sqft) || 0,
              floor: u.floor || "Main",
              bedroom_configs: Array.from(brMap.entries()).sort((a, b) => a[0] - b[0])
                .map(([br, cfg]) => ({ bedroom_number: br, beds: cfg.beds, rent_per_bed: Math.round(cfg.rent_per_bed) })),
            };
          });
          setPlanUnits(configs);
        } else {
          setPlanUnits([{
            unit_number: "Unit 101", unit_type: "2br", bedrooms: 2, bathrooms: 1, sqft: 750, floor: "Main",
            bedroom_configs: [{ bedroom_number: 1, beds: 1, rent_per_bed: 700 }, { bedroom_number: 2, beds: 1, rent_per_bed: 700 }],
          }]);
        }
        setUnitsLoaded(true);
      })
      .catch(() => setUnitsLoaded(true));
  }, [expanded, plan.plan_id, propertyId, unitsLoaded]);

  const handleSaveUnits = async () => {
    try {
      const payload = unitConfigsToApiPayload(planUnits);
      await apiClient.post(`/api/portfolio/properties/${propertyId}/configure-units`, {
        plan_id: plan.plan_id, units: payload.units, clear_existing: true,
      });
      // Update plan totals
      const totalBeds = planUnits.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds, 0), 0);
      await onUpdate({ planId: plan.plan_id, data: { planned_units: planUnits.length, planned_beds: totalBeds, planned_sqft: planUnits.reduce((s, u) => s + u.sqft, 0) } });
      toast.success("Units saved");
    } catch { toast.error("Failed to save units"); }
  };

  // Initialize form when expanded
  React.useEffect(() => {
    if (expanded) {
      setForm({
        plan_name: plan.plan_name || "",
        description: (plan as any).description || "",
        development_start_date: plan.development_start_date || "",
        construction_duration_days: plan.construction_duration_days || 180,
        lease_up_months: (plan as any).lease_up_months || 6,
        estimated_construction_cost: Number(plan.estimated_construction_cost) || 0,
        hard_costs: Number(plan.hard_costs) || 0,
        soft_costs: Number(plan.soft_costs) || 0,
        site_costs: Number(plan.site_costs) || 0,
        financing_costs: Number(plan.financing_costs) || 0,
        contingency_percent: Number(plan.contingency_percent) || 10,
        projected_annual_revenue: Number(plan.projected_annual_revenue) || 0,
        projected_annual_noi: Number(plan.projected_annual_noi) || 0,
        annual_rent_increase_pct: Number(plan.annual_rent_increase_pct) || 3,
        exit_sale_year: (plan as any).exit_sale_year || "",
        exit_cap_rate: Number((plan as any).exit_cap_rate) || "",
        exit_noi: Number((plan as any).exit_noi) || "",
        exit_irr: Number((plan as any).exit_irr) || "",
        exit_equity_multiple: Number((plan as any).exit_equity_multiple) || "",
      });
      setDirty(false);
    }
  }, [expanded, plan]);

  const sf = (key: string, val: any) => {
    setForm(f => ({ ...f, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      const data: Record<string, any> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== "" && v !== null && v !== undefined) data[k] = v;
      }
      await onUpdate({ planId: plan.plan_id, data });
      toast.success("Plan updated");
      setDirty(false);
    } catch { toast.error("Failed to save"); }
  };

  const durationDays = plan.construction_duration_days || 0;
  const durationMonths = (plan as any).construction_duration_months || Math.round(durationDays / 30);
  const totalCost = Number(plan.estimated_construction_cost) || 0;

  return (
    <Card className={cn("transition-all", expanded && "ring-2 ring-primary/20")}>
      {/* Collapsed header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{plan.plan_name || `Plan v${plan.version}`}</p>
            {(plan as any).description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{(plan as any).description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {plan.development_start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{plan.development_start_date}</span>}
              {durationMonths > 0 && <span>{durationMonths} months</span>}
              <span>{plan.planned_units} units &middot; {plan.planned_beds} beds</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tabular-nums">{fmt(totalCost)}</span>
          {canEdit && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={e => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded content — two columns */}
      {expanded && (
        <div className="border-t px-4 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: Plan Details */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan Details</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1"><Label className="text-xs">Plan Name</Label><Input value={form.plan_name} onChange={e => sf("plan_name", e.target.value)} className="h-8 text-sm" /></div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Description</Label>
                  <textarea
                    value={form.description || ""}
                    onChange={e => sf("description", e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px] resize-y"
                    placeholder="Describe what this plan involves — e.g., full kitchen renovation with new cabinets, countertops, appliances, and flooring..."
                  />
                </div>
                <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={form.development_start_date} onChange={e => sf("development_start_date", e.target.value)} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Duration (days)</Label><Input type="number" value={form.construction_duration_days} onChange={e => sf("construction_duration_days", Number(e.target.value))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Lease-Up (months)</Label><Input type="number" value={form.lease_up_months} onChange={e => sf("lease_up_months", Number(e.target.value))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Rent Increase %/yr</Label><Input type="number" step="0.1" value={form.annual_rent_increase_pct} onChange={e => sf("annual_rent_increase_pct", Number(e.target.value))} className="h-8 text-sm" /></div>
              </div>

              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Configuration</p>
              <UnitConfigurator
                units={planUnits}
                onChange={setPlanUnits}
                defaultRentPerBed={700}
              />
              <Button onClick={handleSaveUnits} size="sm" variant="outline" className="w-full">
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Unit Configuration
              </Button>

              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exit Assumptions</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Exit Year</Label><Input type="number" value={form.exit_sale_year} onChange={e => sf("exit_sale_year", Number(e.target.value))} className="h-8 text-sm" placeholder="2032" /></div>
                <div className="space-y-1"><Label className="text-xs">Exit Cap (%)</Label><Input type="number" step="0.1" value={form.exit_cap_rate} onChange={e => sf("exit_cap_rate", Number(e.target.value))} className="h-8 text-sm" placeholder="5.0" /></div>
                <div className="space-y-1"><Label className="text-xs">Exit NOI ($)</Label><Input type="number" value={form.exit_noi} onChange={e => sf("exit_noi", Number(e.target.value))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Target IRR (%)</Label><Input type="number" step="0.1" value={form.exit_irr} onChange={e => sf("exit_irr", Number(e.target.value))} className="h-8 text-sm" /></div>
              </div>

              {dirty && canEdit && (
                <Button onClick={handleSave} size="sm" className="w-full">
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save Plan Details
                </Button>
              )}
            </div>

            {/* RIGHT COLUMN: Construction Budget & Draws */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Construction Budget & Draws</p>
              <ConstructionBudgetTab
                propertyId={propertyId}
                canEdit={canEdit}
                activePhase="full_development"
                planId={plan.plan_id}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
