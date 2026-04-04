"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Home,
  HardHat,
  TrendingUp,
  Calendar,
  BarChart3,
  DollarSign,
  ArrowRight,
  Wrench,
  Upload,
  FileSpreadsheet,
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
import {
  usePropertyUnits,
  usePropertyUnitSummary,
  useCreatePropertyUnit,
  useDeletePropertyUnit,
  useImportRentRoll,
  useCreateBed,
  useDeleteBed,
} from "@/hooks/usePortfolio";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  PropertyUnit,
  Bed,
  UnitSummaryBase,
  RedevelopmentPhase,
  ValuationScenario,
  UnitMixEntry,
  FloorBreakdownEntry,
} from "@/types/portfolio";

interface UnitsBedsTabProps {
  propertyId: number;
  canEdit: boolean;
  activePhase?: "as_is" | "post_renovation" | "full_development";
}

export function UnitsBedsTab({ propertyId, canEdit, activePhase }: UnitsBedsTabProps) {
  const { data: units } = usePropertyUnits(propertyId);
  const { data: unitSummary } = usePropertyUnitSummary(propertyId);
  const createUnit = useCreatePropertyUnit(propertyId);
  const deleteUnit = useDeletePropertyUnit(propertyId);
  const importRentRoll = useImportRentRoll(propertyId);

  const createBed = useCreateBed(propertyId);
  const deleteBed = useDeleteBed(propertyId);

  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<{ created_units: number; created_beds: number; errors: string[] } | null>(null);
  const [addingBedToUnit, setAddingBedToUnit] = useState<number | null>(null);
  const [newBed, setNewBed] = useState({ bed_label: "", monthly_rent: "", rent_type: "per_bed", status: "available" });

  const baselineUnits = ((units ?? []) as PropertyUnit[]).filter((u) => !u.development_plan_id);
  const redevUnits = ((units ?? []) as PropertyUnit[]).filter((u) => u.development_plan_id);
  const bl = unitSummary?.baseline;
  const redevPhases = unitSummary?.redevelopment_phases ?? [];
  const hasRedev = unitSummary?.has_redevelopment;

  /* ── Shared unit row renderer ── */
  const renderUnitRow = (unit: PropertyUnit, colorClass: string = "") => (
    <div key={unit.unit_id} className={`border rounded-lg ${colorClass}`}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpandedUnit(expandedUnit === unit.unit_id ? null : unit.unit_id)}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium">Unit {unit.unit_number}</span>
          <Badge variant="outline" className="capitalize">{unit.unit_type.replace("_", " ")}</Badge>
          {unit.is_legal_suite && <Badge variant="secondary">Legal Suite</Badge>}
          {unit.floor && <span className="text-xs text-muted-foreground">{unit.floor}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{unit.bed_count} bed{unit.bed_count !== 1 ? "s" : ""} &middot; {parseFloat(unit.sqft).toLocaleString()} sqft</span>
          <Badge variant={unit.is_occupied ? "default" : "secondary"}>{unit.is_occupied ? "Occupied" : "Available"}</Badge>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this unit and all its beds?")) deleteUnit.mutate(unit.unit_id, { onSuccess: () => toast.success("Unit deleted") }); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          {expandedUnit === unit.unit_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </div>
      {expandedUnit === unit.unit_id && (
        <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
          {unit.beds && unit.beds.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground">
                <th className="pb-2">Bed</th><th className="pb-2 text-right">Monthly Rent</th><th className="pb-2">Rent Type</th><th className="pb-2">Status</th>{canEdit && <th className="pb-2 w-8"></th>}
              </tr></thead>
              <tbody>
                {unit.beds.map((bed: Bed) => (
                  <tr key={bed.bed_id} className="border-t">
                    <td className="py-2">{bed.bed_label}</td>
                    <td className="py-2 text-right">${Number(bed.monthly_rent).toLocaleString()}</td>
                    <td className="py-2 capitalize">{bed.rent_type.replace("_", " ")}</td>
                    <td className="py-2">
                      <Badge variant={bed.status === "occupied" ? "default" : bed.status === "available" ? "secondary" : "destructive"} className="capitalize">{bed.status}</Badge>
                    </td>
                    {canEdit && (
                      <td className="py-2">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { if (confirm(`Delete bed "${bed.bed_label}"?`)) deleteBed.mutate(bed.bed_id, { onSuccess: () => toast.success("Bed deleted") }); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {unit.beds && unit.beds.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">No beds in this unit yet.</p>
          )}
          {/* Add Bed */}
          {canEdit && (
            <>
              {addingBedToUnit === unit.unit_id ? (
                <div className="flex items-end gap-2 pt-2 border-t">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Bed Label</label>
                    <Input value={newBed.bed_label} onChange={(e) => setNewBed(p => ({ ...p, bed_label: e.target.value }))} placeholder="e.g. Bed A" className="h-8 text-sm" />
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Rent ($/mo)</label>
                    <Input type="number" value={newBed.monthly_rent} onChange={(e) => setNewBed(p => ({ ...p, monthly_rent: e.target.value }))} placeholder="0" className="h-8 text-sm" />
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <Select value={newBed.status} onValueChange={(v) => setNewBed(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" className="h-8" disabled={createBed.isPending} onClick={() => {
                    if (!newBed.bed_label.trim()) { toast.error("Bed label is required"); return; }
                    createBed.mutate({ unitId: unit.unit_id, data: { bed_label: newBed.bed_label, monthly_rent: Number(newBed.monthly_rent) || 0, rent_type: newBed.rent_type, status: newBed.status } }, {
                      onSuccess: () => { toast.success("Bed added"); setNewBed({ bed_label: "", monthly_rent: "", rent_type: "per_bed", status: "available" }); setAddingBedToUnit(null); },
                    });
                  }}>
                    {createBed.isPending ? "Adding..." : "Add"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setAddingBedToUnit(null)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setAddingBedToUnit(unit.unit_id); setNewBed({ bed_label: `Bed ${(unit.beds?.length ?? 0) + 1}`, monthly_rent: "", rent_type: "per_bed", status: "available" }); }}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Bed
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  /* ── Shared summary cards renderer ── */
  const renderSummaryCards = (s: UnitSummaryBase) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card><CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">Units</div>
        <div className="text-2xl font-bold">{s.total_units}</div>
        <div className="text-xs text-muted-foreground mt-1">{s.legal_suites} legal suite{s.legal_suites !== 1 ? "s" : ""}</div>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">Beds</div>
        <div className="text-2xl font-bold">{s.total_beds}</div>
        <div className="text-xs text-muted-foreground mt-1">{s.occupied_beds} occupied / {s.available_beds} available</div>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">Vacancy Rate</div>
        <div className={`text-2xl font-bold ${s.vacancy_rate > 10 ? "text-red-600" : "text-green-600"}`}>{s.vacancy_rate}%</div>
        <div className="text-xs text-muted-foreground mt-1">{s.total_sqft.toLocaleString()} sqft</div>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">Monthly Rent</div>
        <div className="text-2xl font-bold">${s.potential_monthly_rent.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground mt-1">${s.actual_monthly_rent.toLocaleString()} actual</div>
      </CardContent></Card>
    </div>
  );

  // Phase filtering: determine which sections to show
  const showBaseline = !activePhase || activePhase === "as_is";
  const showRedevelopment = !activePhase || activePhase === "post_renovation" || activePhase === "full_development";
  const showNetImpact = !activePhase || activePhase === "post_renovation" || activePhase === "full_development";

  /* ---- Shared unit mix + floor breakdown renderer ---- */
  const renderMixAndFloor = (s: UnitSummaryBase) => (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Unit Mix</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">Type</th><th className="pb-2 text-right">Units</th><th className="pb-2 text-right">Beds</th><th className="pb-2 text-right">Sqft</th>
            </tr></thead>
            <tbody>
              {Object.entries(s.unit_mix).map(([type, mix]: [string, UnitMixEntry]) => (
                <tr key={type} className="border-b last:border-0">
                  <td className="py-2 capitalize">{type.replace("_", " ")}</td>
                  <td className="py-2 text-right">{mix.count}</td>
                  <td className="py-2 text-right">{mix.beds}</td>
                  <td className="py-2 text-right">{mix.sqft.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Floor Breakdown</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">Floor</th><th className="pb-2 text-right">Units</th><th className="pb-2 text-right">Beds</th>
            </tr></thead>
            <tbody>
              {Object.entries(s.floor_breakdown).map(([floor, data]: [string, FloorBreakdownEntry]) => (
                <tr key={floor} className="border-b last:border-0">
                  <td className="py-2">{floor}</td>
                  <td className="py-2 text-right">{data.units}</td>
                  <td className="py-2 text-right">{data.beds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* SECTION 1: CURRENT OPERATIONS (Baseline / As-Acquired Units) */}
      {showBaseline && <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-1 bg-blue-600 rounded" />
          <Home className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Current Operations</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            As-Acquired &middot; {baselineUnits.length} unit{baselineUnits.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Active units currently in operation. These drive vacancy tracking, community management, and operating costs.
        </p>

        {bl && renderSummaryCards(bl)}
        {bl && <div className="mt-4">{renderMixAndFloor(bl)}</div>}

        {/* Baseline Unit List */}
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Baseline Units</CardTitle>
            {canEdit && (
              <div className="flex items-center gap-2">
              {/* CSV Import Dialog */}
              <Dialog open={showImport} onOpenChange={(open) => { setShowImport(open); if (!open) setImportResult(null); }}>
                {/* @ts-expect-error radix-ui asChild type */}
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-1" />Import CSV</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Import Rent Roll from CSV</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">Upload a CSV file with unit and bed data</p>
                      <input
                        type="file"
                        accept=".csv"
                        className="text-sm"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          importRentRoll.mutate(file, {
                            onSuccess: (result: { created_units: number; created_beds: number; errors: string[] }) => {
                              setImportResult(result);
                              toast.success(`Imported ${result.created_units} units and ${result.created_beds} beds`);
                            },
                            onError: () => toast.error("Import failed"),
                          });
                        }}
                      />
                    </div>
                    {importRentRoll.isPending && (
                      <div className="text-center py-2">
                        <p className="text-sm text-muted-foreground">Importing...</p>
                      </div>
                    )}
                    {importResult && (
                      <div className="rounded-lg border bg-green-50 border-green-200 p-3 space-y-2">
                        <p className="text-sm font-medium text-green-800">Import Complete</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p>Units created: <span className="font-bold">{importResult.created_units}</span></p>
                          <p>Beds created: <span className="font-bold">{importResult.created_beds}</span></p>
                        </div>
                        {importResult.errors.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-amber-700">{importResult.errors.length} warning(s):</p>
                            <ul className="text-xs text-amber-600 list-disc pl-4 mt-1">
                              {importResult.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                              {importResult.errors.length > 5 && <li>...and {importResult.errors.length - 5} more</li>}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="rounded-lg border bg-muted/50 p-3">
                      <p className="text-xs font-medium mb-1">Expected CSV columns:</p>
                      <p className="text-xs text-muted-foreground font-mono">unit_number, unit_type, bed_count, sqft, floor, monthly_rent, bed_label, bed_rent, bed_status, bedroom_count, is_legal_suite</p>
                      <p className="text-xs text-muted-foreground mt-1">unit_type values: studio, 1br, 2br, 3br, suite, shared</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showAddUnit} onOpenChange={setShowAddUnit}>
                {/* @ts-expect-error radix-ui asChild type */}
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Unit</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Unit</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createUnit.mutate({
                      unit_number: fd.get("unit_number") as string,
                      unit_type: fd.get("unit_type") as string,
                      bed_count: Number(fd.get("bed_count")),
                      sqft: Number(fd.get("sqft")),
                      floor: (fd.get("floor") as string) || null,
                      is_legal_suite: fd.get("is_legal_suite") === "on",
                      notes: (fd.get("notes") as string) || null,
                    }, {
                      onSuccess: () => { setShowAddUnit(false); toast.success("Unit added"); },
                      onError: () => toast.error("Failed to add unit"),
                    });
                  }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-sm font-medium">Unit Number *</label><input name="unit_number" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. 101" /></div>
                      <div><label className="text-sm font-medium">Type *</label>
                        <select name="unit_type" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                          <option value="shared">Shared</option>
                          <option value="1br">1 Bedroom</option>
                          <option value="2br">2 Bedroom</option>
                          <option value="3br">3 Bedroom</option>
                          <option value="studio">Studio</option>
                          <option value="suite">Suite</option>
                        </select>
                      </div>
                      <div><label className="text-sm font-medium">Bed Count *</label><input name="bed_count" type="number" min="1" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="2" /></div>
                      <div><label className="text-sm font-medium">Sqft *</label><input name="sqft" type="number" min="1" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="450" /></div>
                      <div><label className="text-sm font-medium">Floor</label><input name="floor" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="Main, Upper, Basement" /></div>
                      <div className="flex items-center gap-2 pt-6"><input name="is_legal_suite" type="checkbox" className="rounded" /><label className="text-sm">Legal Suite</label></div>
                    </div>
                    <div><label className="text-sm font-medium">Notes</label><textarea name="notes" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={2} /></div>
                    <Button type="submit" className="w-full" disabled={createUnit.isPending}>{createUnit.isPending ? "Adding..." : "Add Unit"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {baselineUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No baseline units configured. Add units to define the current bedroom and bed configuration.</p>
            ) : (
              <div className="space-y-3">
                {baselineUnits.map((unit) => renderUnitRow(unit))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>}

      {/* SECTION 2: REDEVELOPMENT PLAN (Planned Units) */}
      {showRedevelopment && hasRedev && redevPhases.map((phase: RedevelopmentPhase) => (
        <div key={phase.plan_id}>
          <div className="flex items-center gap-2 mb-4 mt-2">
            <div className="h-8 w-1 bg-amber-500 rounded" />
            <HardHat className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold">Redevelopment Plan</h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full capitalize">
              {phase.plan_status} &middot; {phase.total_units} planned unit{phase.total_units !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Plan context banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800">{phase.plan_name}</span>
            </div>
            <p className="text-sm text-amber-700 mb-2">
              These units are planned as part of the redevelopment and are <strong>not yet available</strong> for occupancy.
              They do not affect current vacancy rates, property management, or operating costs.
            </p>
            <div className="flex gap-6 text-sm text-amber-700">
              {phase.start_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Start: {phase.start_date}</span>
                </div>
              )}
              {phase.completion_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Target Completion: {phase.completion_date}</span>
                </div>
              )}
            </div>
          </div>

          {/* Redevelopment summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-amber-200">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Planned Units</div>
                <div className="text-2xl font-bold text-amber-700">{phase.total_units}</div>
                <div className="text-xs text-muted-foreground mt-1">{phase.legal_suites} legal suite{phase.legal_suites !== 1 ? "s" : ""}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Planned Beds</div>
                <div className="text-2xl font-bold text-amber-700">{phase.total_beds}</div>
                <div className="text-xs text-muted-foreground mt-1">Post-redevelopment capacity</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Planned Sqft</div>
                <div className="text-2xl font-bold text-amber-700">{phase.total_sqft.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Total planned area</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Projected Monthly Rent</div>
                <div className="text-2xl font-bold text-amber-700">${phase.potential_monthly_rent.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">At stabilization</div>
              </CardContent>
            </Card>
          </div>

          {/* Redevelopment unit mix & floor breakdown */}
          <div className="mt-4">{renderMixAndFloor(phase)}</div>

          {/* Redevelopment unit list */}
          <Card className="mt-4 border-amber-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardHat className="h-4 w-4 text-amber-600" />
                Planned Units
                <span className="text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Redevelopment</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {redevUnits.filter((u) => u.development_plan_id === phase.plan_id).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No planned units for this development phase.</p>
              ) : (
                <div className="space-y-3">
                  {redevUnits
                    .filter((u) => u.development_plan_id === phase.plan_id)
                    .map((unit) => renderUnitRow(unit, "border-amber-200 bg-amber-50/30"))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}

      {/* SECTION 3: NET IMPACT OF REDEVELOPMENT */}
      {showNetImpact && hasRedev && unitSummary?.net_impact && (() => {
        const ni = unitSummary.net_impact;
        const fmtDelta = (v: number) => {
          if (v > 0) return `+${v.toLocaleString()}`;
          if (v < 0) return v.toLocaleString();
          return "0";
        };
        const deltaColor = (v: number) => v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "text-muted-foreground";
        const arrowIcon = (v: number) => v > 0 ? "\u25B2" : v < 0 ? "\u25BC" : "\u2500";

        return (
          <div>
            <div className="flex items-center gap-2 mb-4 mt-2">
              <div className="h-8 w-1 bg-emerald-500 rounded" />
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold">Net Impact of Redevelopment</h3>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                Baseline &rarr; Post-Redevelopment
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              The current baseline units will be <strong>replaced</strong> by the redevelopment. The figures below show the net change in capacity, revenue, and estimated valuation.
            </p>

            {/* Delta Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <Card className="border-emerald-200">
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Units</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">{bl?.total_units ?? 0}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-lg font-bold">{ni.post_redev_units}</span>
                  </div>
                  <div className={`text-sm font-semibold mt-1 ${deltaColor(ni.delta_units)}`}>
                    {arrowIcon(ni.delta_units)} {fmtDelta(ni.delta_units)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200">
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Beds</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">{bl?.total_beds ?? 0}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-lg font-bold">{ni.post_redev_beds}</span>
                  </div>
                  <div className={`text-sm font-semibold mt-1 ${deltaColor(ni.delta_beds)}`}>
                    {arrowIcon(ni.delta_beds)} {fmtDelta(ni.delta_beds)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200">
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Sqft</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">{(bl?.total_sqft ?? 0).toLocaleString()}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-lg font-bold">{ni.post_redev_sqft.toLocaleString()}</span>
                  </div>
                  <div className={`text-sm font-semibold mt-1 ${deltaColor(ni.delta_sqft)}`}>
                    {arrowIcon(ni.delta_sqft)} {fmtDelta(ni.delta_sqft)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200">
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Rent</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">${(bl?.potential_monthly_rent ?? 0).toLocaleString()}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-lg font-bold">${ni.post_redev_monthly_rent.toLocaleString()}</span>
                  </div>
                  <div className={`text-sm font-semibold mt-1 ${deltaColor(ni.delta_monthly_rent)}`}>
                    {arrowIcon(ni.delta_monthly_rent)} ${fmtDelta(ni.delta_monthly_rent)}/mo
                  </div>
                </CardContent>
              </Card>
              <Card className="border-emerald-200">
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Annual NOI</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">${ni.baseline_annual_noi.toLocaleString()}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-lg font-bold">${ni.redev_annual_noi.toLocaleString()}</span>
                  </div>
                  <div className={`text-sm font-semibold mt-1 ${deltaColor(ni.delta_annual_noi)}`}>
                    {arrowIcon(ni.delta_annual_noi)} ${fmtDelta(ni.delta_annual_noi)}/yr
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue & NOI Comparison + Valuation Scenarios */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-600" />Revenue & NOI Comparison</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2">Metric</th>
                      <th className="pb-2 text-right">Baseline</th>
                      <th className="pb-2 text-right">Post-Redev</th>
                      <th className="pb-2 text-right">Change</th>
                    </tr></thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2">Annual Revenue</td>
                        <td className="py-2 text-right">${ni.baseline_annual_revenue.toLocaleString()}</td>
                        <td className="py-2 text-right">${ni.redev_annual_revenue.toLocaleString()}</td>
                        <td className={`py-2 text-right font-medium ${deltaColor(ni.redev_annual_revenue - ni.baseline_annual_revenue)}`}>
                          {fmtDelta(ni.redev_annual_revenue - ni.baseline_annual_revenue)}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Annual NOI</td>
                        <td className="py-2 text-right">${ni.baseline_annual_noi.toLocaleString()}</td>
                        <td className="py-2 text-right">${ni.redev_annual_noi.toLocaleString()}</td>
                        <td className={`py-2 text-right font-medium ${deltaColor(ni.delta_annual_noi)}`}>
                          {fmtDelta(ni.delta_annual_noi)}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2">Construction Cost</td>
                        <td className="py-2 text-right text-muted-foreground">&mdash;</td>
                        <td className="py-2 text-right">${ni.construction_cost.toLocaleString()}</td>
                        <td className="py-2 text-right text-muted-foreground">&mdash;</td>
                      </tr>
                      <tr>
                        <td className="py-2">Monthly Rent</td>
                        <td className="py-2 text-right">${(bl?.potential_monthly_rent ?? 0).toLocaleString()}</td>
                        <td className="py-2 text-right">${ni.post_redev_monthly_rent.toLocaleString()}</td>
                        <td className={`py-2 text-right font-medium ${deltaColor(ni.delta_monthly_rent)}`}>
                          {fmtDelta(ni.delta_monthly_rent)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />Estimated Valuation Impact
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Based on NOI / Cap Rate. Assumes 30% expense ratio where actuals are unavailable.</p>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2">Cap Rate</th>
                      <th className="pb-2 text-right">Baseline Value</th>
                      <th className="pb-2 text-right">Post-Redev Value</th>
                      <th className="pb-2 text-right">Increase</th>
                    </tr></thead>
                    <tbody>
                      {ni.valuation_scenarios.map((s: ValuationScenario) => (
                        <tr key={s.cap_rate} className="border-b last:border-0">
                          <td className="py-2 font-medium">{s.cap_rate}%</td>
                          <td className="py-2 text-right">${s.baseline_value.toLocaleString()}</td>
                          <td className="py-2 text-right">${s.post_redev_value.toLocaleString()}</td>
                          <td className={`py-2 text-right font-medium ${deltaColor(s.value_increase)}`}>
                            +${s.value_increase.toLocaleString()} ({s.value_increase_pct}%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* If no redevelopment, show the simple combined view */}
      {!hasRedev && unitSummary && (
        <>
          {renderSummaryCards(unitSummary)}
          {renderMixAndFloor(unitSummary)}
        </>
      )}
    </div>
  );
}
