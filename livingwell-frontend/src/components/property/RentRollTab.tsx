"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Edit2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useRentRoll,
  useUpdateRentPricingMode,
  useUpdateAnnualRentIncrease,
  useUpdateBed,
  useCreateBed,
  useDeleteBed,
} from "@/hooks/usePortfolio";
import { AncillaryRevenueSection } from "@/components/property/AncillaryRevenueSection";
import type {
  Bed,
  Bedroom,
  RentRollUnit,
  RentRollPlanPhase,
  RentRollResponse,
  EscalationYear,
} from "@/types/portfolio";

interface RentRollTabProps {
  propertyId: number;
  canEdit: boolean;
  property: Record<string, any>;
  activePhase?: "as_is" | "post_renovation" | "full_development";
}

export function RentRollTab({ propertyId, canEdit, property, activePhase }: RentRollTabProps) {
  const { data: rentRollData } = useRentRoll(propertyId);
  const updatePricingMode = useUpdateRentPricingMode(propertyId);
  const updateAnnualRentIncrease = useUpdateAnnualRentIncrease(propertyId);
  const updateBedMutation = useUpdateBed(propertyId);
  const createBedMutation = useCreateBed(propertyId);
  const deleteBedMutation = useDeleteBed(propertyId);

  const [editingBedId, setEditingBedId] = useState<number | null>(null);
  const [editBedRent, setEditBedRent] = useState("");
  const [expandedRentUnit, setExpandedRentUnit] = useState<number | null>(null);
  const [rentIncreaseInput, setRentIncreaseInput] = useState("");
  const [addingBedToUnit, setAddingBedToUnit] = useState<number | null>(null);
  const [newBedRent, setNewBedRent] = useState("1400");
  const [newBedRoom, setNewBedRoom] = useState<number>(1);

  // Phase filtering: determine which sections to show
  const showBaseline = !activePhase || activePhase === "as_is";
  const showDevelopmentPlans = !activePhase || activePhase === "post_renovation" || activePhase === "full_development";

  return (
    <div className="space-y-6">
      {/* BASELINE (As-Acquired) */}
      {showBaseline && <>
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-1 bg-blue-600 rounded" />
          <h3 className="text-lg font-semibold">Baseline (As-Acquired)</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {rentRollData?.baseline?.pricing_mode?.replace("_", " ") || "by_bed"}
          </span>
        </div>

        {/* Baseline KPI Cards */}
        {(() => {
          const b = rentRollData?.baseline?.rent_roll;
          if (!b) return null;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card><CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Potential Monthly</p>
                <p className="text-xl font-bold text-green-700">${b.potential_monthly_rent?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">${(b.potential_annual_rent || 0).toLocaleString()}/yr</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Actual Monthly</p>
                <p className="text-xl font-bold">${b.actual_monthly_rent?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">${(b.actual_annual_rent || 0).toLocaleString()}/yr</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Vacancy Loss</p>
                <p className="text-xl font-bold text-red-600">${b.vacancy_loss_monthly?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{b.vacancy_rate}% vacancy</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Occupancy</p>
                <p className="text-xl font-bold">{b.occupied_beds}/{b.total_beds} beds</p>
                <p className="text-xs text-muted-foreground mt-1">{b.total_units} units</p>
              </CardContent></Card>
            </div>
          );
        })()}

        {/* Baseline Pricing Mode Selector */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Pricing Mode:</span>
                <Select
                  value={rentRollData?.baseline?.pricing_mode || "by_bed"}
                  onValueChange={(v) => updatePricingMode.mutate(v)}
                >
                  <SelectTrigger className="w-[160px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="by_unit">By Unit</SelectItem>
                    <SelectItem value="by_bedroom">By Bedroom</SelectItem>
                    <SelectItem value="by_bed">By Bed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Annual Rent Increase:</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.5"
                    className="w-20 h-8 text-sm"
                    value={rentIncreaseInput || (rentRollData?.baseline?.annual_rent_increase_pct ?? "")}
                    onChange={(e) => setRentIncreaseInput(e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-sm">%</span>
                  {rentIncreaseInput && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => {
                        updateAnnualRentIncrease.mutate(parseFloat(rentIncreaseInput));
                        setRentIncreaseInput("");
                      }}
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Baseline Unit Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Baseline Units</CardTitle>
          </CardHeader>
          <CardContent>
            {!rentRollData?.baseline?.rent_roll?.units?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No baseline units configured.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Unit</th>
                      <th className="text-left p-2 font-medium">Type</th>
                      <th className="text-center p-2 font-medium">Beds</th>
                      <th className="text-right p-2 font-medium">Potential/mo</th>
                      <th className="text-right p-2 font-medium">Actual/mo</th>
                      <th className="text-center p-2 font-medium">Vacancy</th>
                      <th className="text-center p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rentRollData.baseline.rent_roll.units || []).map((u: RentRollUnit) => (
                      <React.Fragment key={u.unit_id}>
                        <tr
                          className="border-t hover:bg-muted/30 cursor-pointer"
                          onClick={() => setExpandedRentUnit(expandedRentUnit === u.unit_id ? null : u.unit_id)}
                        >
                          <td className="p-2 font-medium">{u.unit_number}</td>
                          <td className="p-2 capitalize">{u.unit_type?.replace("_", " ")}</td>
                          <td className="p-2 text-center">{u.beds?.length || u.bed_count}</td>
                          <td className="p-2 text-right">${u.unit_potential_monthly?.toLocaleString()}</td>
                          <td className="p-2 text-right">${u.unit_actual_monthly?.toLocaleString()}</td>
                          <td className="p-2 text-center">
                            {u.unit_vacancy_count > 0 ? (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{u.unit_vacancy_count} vacant</span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Full</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {u.is_occupied ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Occupied</span>
                            ) : (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Vacant</span>
                            )}
                          </td>
                        </tr>
                        {expandedRentUnit === u.unit_id && (
                          <tr>
                            <td colSpan={7} className="bg-muted/20 p-3">
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  {rentRollData.baseline.pricing_mode === "by_bedroom" ? "Bedroom" : "Bed"} Detail — Unit {u.unit_number}
                                </p>
                                {rentRollData.baseline.pricing_mode === "by_bedroom" ? (
                                  u.bedrooms?.map((br: Bedroom, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between bg-white rounded p-2 border">
                                      <span className="text-sm">Bedroom {br.bedroom_number || idx + 1}</span>
                                      <span className="text-sm font-medium">${br.total_rent?.toLocaleString()}/mo</span>
                                      <span className="text-xs text-muted-foreground">{br.beds?.length || 0} bed(s)</span>
                                    </div>
                                  ))
                                ) : (
                                  u.beds?.map((bed: Bed) => (
                                    <div key={bed.bed_id} className="flex items-center justify-between bg-white rounded p-2 border">
                                      <span className="text-sm font-medium">{bed.bed_label}</span>
                                      <div className="flex items-center gap-2">
                                        {editingBedId === bed.bed_id ? (
                                          <div className="flex items-center gap-1">
                                            <Input
                                              type="number"
                                              className="w-24 h-7 text-sm"
                                              value={editBedRent}
                                              onChange={(e) => setEditBedRent(e.target.value)}
                                            />
                                            <Button
                                              size="sm"
                                              className="h-7 text-xs"
                                              onClick={() => {
                                                updateBedMutation.mutate({ bedId: bed.bed_id, data: { monthly_rent: parseFloat(editBedRent) } });
                                                setEditingBedId(null);
                                              }}
                                            >
                                              Save
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingBedId(null)}>Cancel</Button>
                                          </div>
                                        ) : (
                                          <>
                                            <span className="text-sm">${bed.monthly_rent?.toLocaleString()}/mo</span>
                                            {canEdit && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingBedId(bed.bed_id);
                                                  setEditBedRent(String(bed.monthly_rent));
                                                }}
                                              >
                                                <Edit2 className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        bed.status === "occupied" ? "bg-green-100 text-green-700" :
                                        bed.status === "available" ? "bg-amber-100 text-amber-700" :
                                        "bg-gray-100 text-gray-700"
                                      }`}>
                                        {bed.status}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ANCILLARY REVENUE — Baseline */}
      <AncillaryRevenueSection
        propertyId={propertyId}
        planId={null}
        canEdit={canEdit}
        label="Ancillary Revenue — Baseline"
      />
      </>}


      {/* DEVELOPMENT PLAN PHASES */}
      {showDevelopmentPlans && <>
      {((rentRollData as RentRollResponse | undefined)?.plan_phases || []).map((plan: RentRollPlanPhase, planIdx: number) => {
        const pr = plan.rent_roll;
        const comp = plan.comparison_vs_previous;
        const esc = plan.escalation_projection;
        return (
          <div key={plan.plan_id} className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-1 bg-emerald-600 rounded" />
              <h3 className="text-lg font-semibold">{plan.plan_label}</h3>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                {plan.plan_status?.replace("_", " ")}
              </span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {plan.pricing_mode?.replace("_", " ") || "by_bed"}
              </span>
              {plan.annual_rent_increase_pct > 0 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  +{plan.annual_rent_increase_pct}%/yr escalation
                </span>
              )}
            </div>

            {/* Timeline Info */}
            <Card className="mb-4 border-emerald-200">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Construction Start</p>
                    <p className="font-medium">{plan.development_start_date ? new Date(plan.development_start_date).toLocaleDateString() : "TBD"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Completion</p>
                    <p className="font-medium">{plan.estimated_completion_date ? new Date(plan.estimated_completion_date).toLocaleDateString() : "TBD"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Stabilization</p>
                    <p className="font-medium">{plan.estimated_stabilization_date ? new Date(plan.estimated_stabilization_date).toLocaleDateString() : "TBD"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Plan Debt</p>
                    <p className="font-medium">{plan.debt_count} facilit{plan.debt_count === 1 ? "y" : "ies"} — ${(plan.annual_debt_service || 0).toLocaleString()}/yr</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan KPI Cards */}
            {pr && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Card><CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Projected Monthly</p>
                  <p className="text-xl font-bold text-emerald-700">${pr.potential_monthly_rent?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">${(pr.potential_annual_rent || 0).toLocaleString()}/yr</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Units</p>
                  <p className="text-xl font-bold">{pr.total_units}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pr.total_beds} beds</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Avg Rent/Bed</p>
                  <p className="text-xl font-bold">${pr.total_beds > 0 ? Math.round(pr.potential_monthly_rent / pr.total_beds).toLocaleString() : 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">per month</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Debt Service</p>
                  <p className="text-xl font-bold text-red-600">${(plan.annual_debt_service || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">annual</p>
                </CardContent></Card>
              </div>
            )}

            {/* Comparison vs Previous Phase */}
            {comp && (
              <Card className="mb-4 border-amber-200 bg-amber-50/50">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm font-semibold mb-3">Revenue Comparison vs Baseline</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Previous Monthly</p>
                      <p className="font-medium">${comp.prev_monthly?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{comp.prev_units} units / {comp.prev_beds} beds</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Projected Monthly</p>
                      <p className="font-medium text-emerald-700">${comp.plan_monthly?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{comp.plan_units} units / {comp.plan_beds} beds</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Uplift</p>
                      <p className="font-bold text-emerald-700">+${comp.delta_monthly?.toLocaleString()}/mo</p>
                      <p className="text-xs text-emerald-600">+{comp.pct_change}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Uplift</p>
                      <p className="font-bold text-emerald-700">+${comp.delta_annual?.toLocaleString()}/yr</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Plan Unit Table */}
            {pr && pr.units?.length > 0 && (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Projected Units — {plan.plan_label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Unit</th>
                          <th className="text-left p-2 font-medium">Type</th>
                          <th className="text-center p-2 font-medium">Beds</th>
                          <th className="text-center p-2 font-medium">Bedrooms</th>
                          <th className="text-right p-2 font-medium">Projected/mo</th>
                          <th className="text-right p-2 font-medium">Sqft</th>
                          <th className="text-left p-2 font-medium">Floor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pr.units.map((u: RentRollUnit) => (
                          <React.Fragment key={u.unit_id}>
                            <tr
                              className="border-t hover:bg-muted/30 cursor-pointer"
                              onClick={() => setExpandedRentUnit(expandedRentUnit === u.unit_id ? null : u.unit_id)}
                            >
                              <td className="p-2 font-medium">{u.unit_number}</td>
                              <td className="p-2 capitalize">{u.unit_type?.replace("_", " ")}</td>
                              <td className="p-2 text-center">{u.beds?.length || u.bed_count}</td>
                              <td className="p-2 text-center">{u.bedroom_count || "-"}</td>
                              <td className="p-2 text-right font-medium">${u.unit_potential_monthly?.toLocaleString()}</td>
                              <td className="p-2 text-right">{u.sqft?.toLocaleString()}</td>
                              <td className="p-2">{u.floor}</td>
                            </tr>
                            {expandedRentUnit === u.unit_id && (
                              <tr>
                                <td colSpan={7} className="bg-muted/20 p-3">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-medium text-muted-foreground">
                                        {plan.pricing_mode === "by_bedroom" ? "Bedroom" : "Bed"} Detail — Unit {u.unit_number}
                                      </p>
                                      {canEdit && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setAddingBedToUnit(addingBedToUnit === u.unit_id ? null : u.unit_id);
                                            setNewBedRent("1400");
                                            setNewBedRoom(1);
                                          }}
                                        >
                                          <Plus className="h-3 w-3" /> Add Bed
                                        </Button>
                                      )}
                                    </div>

                                    {/* Add Bed Form */}
                                    {addingBedToUnit === u.unit_id && (() => {
                                      const bedroomCount = u.bedroom_count || 1;
                                      const bedrooms = u.bedrooms || [];
                                      return (
                                        <div className="bg-emerald-50 rounded p-3 border border-emerald-200 space-y-2">
                                          <div className="text-xs font-semibold text-emerald-800">Add Bed to Room</div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs font-medium">Room:</span>
                                              <select
                                                className="h-7 text-sm rounded border border-input bg-background px-2"
                                                value={newBedRoom}
                                                onChange={(e) => setNewBedRoom(parseInt(e.target.value))}
                                              >
                                                {Array.from({ length: bedroomCount }, (_, i) => i + 1).map((roomNum) => {
                                                  const roomBeds = bedrooms.find((br) => br.bedroom_number === roomNum);
                                                  const bedCount = roomBeds ? roomBeds.beds?.length || 0 : 0;
                                                  return (
                                                    <option key={roomNum} value={roomNum}>
                                                      Room {roomNum} ({bedCount} bed{bedCount !== 1 ? "s" : ""})
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs font-medium">Rent:</span>
                                              <Input
                                                type="number"
                                                className="w-24 h-7 text-sm"
                                                placeholder="Rent/mo"
                                                value={newBedRent}
                                                onChange={(e) => setNewBedRent(e.target.value)}
                                              />
                                            </div>
                                            <Button
                                              size="sm"
                                              className="h-7 text-xs"
                                              onClick={() => {
                                                const beds = u.beds || [];
                                                const nextNum = beds.length + 1;
                                                createBedMutation.mutate({
                                                  unitId: u.unit_id,
                                                  data: {
                                                    unit_id: u.unit_id,
                                                    bed_label: `${u.unit_number}-B${nextNum}`,
                                                    monthly_rent: parseFloat(newBedRent) || 1400,
                                                    rent_type: "private_pay",
                                                    bedroom_number: newBedRoom,
                                                    is_post_renovation: true,
                                                  },
                                                });
                                                setAddingBedToUnit(null);
                                              }}
                                            >
                                              <Save className="h-3 w-3 mr-1" /> Save
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingBedToUnit(null)}>
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Beds grouped by Room */}
                                    {(() => {
                                      const bedrooms = u.bedrooms || [];
                                      const bedroomCount = u.bedroom_count || bedrooms.length || 1;
                                      const rooms = Array.from({ length: bedroomCount }, (_, i) => {
                                        const roomNum = i + 1;
                                        const existing = bedrooms.find((br) => br.bedroom_number === roomNum);
                                        const roomBeds: Bed[] = existing
                                          ? (existing.beds || [])
                                          : ((u.beds || []).filter((b) => b.bedroom_number === roomNum));
                                        return { roomNum, beds: roomBeds };
                                      });
                                      return rooms.map(({ roomNum, beds: roomBeds }) => (
                                        <div key={roomNum} className="space-y-1">
                                          <div className="flex items-center gap-2 px-1">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                              Room {roomNum}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              ({roomBeds.length} bed{roomBeds.length !== 1 ? "s" : ""})
                                            </span>
                                            <div className="flex-1 border-t border-dashed" />
                                          </div>
                                          {roomBeds.map((bed: Bed) => (
                                            <div key={bed.bed_id} className="flex items-center justify-between bg-white rounded p-2 border ml-3">
                                              <span className="text-sm font-medium">{bed.bed_label}</span>
                                              <div className="flex items-center gap-2">
                                                {editingBedId === bed.bed_id ? (
                                                  <div className="flex items-center gap-1">
                                                    <Input
                                                      type="number"
                                                      className="w-24 h-7 text-sm"
                                                      value={editBedRent}
                                                      onChange={(e) => setEditBedRent(e.target.value)}
                                                    />
                                                    <Button
                                                      size="sm"
                                                      className="h-7 text-xs"
                                                      onClick={() => {
                                                        updateBedMutation.mutate({ bedId: bed.bed_id, data: { monthly_rent: parseFloat(editBedRent) } });
                                                        setEditingBedId(null);
                                                      }}
                                                    >
                                                      Save
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingBedId(null)}>Cancel</Button>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <span className="text-sm">${bed.monthly_rent?.toLocaleString()}/mo</span>
                                                    {canEdit && (
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setEditingBedId(bed.bed_id);
                                                          setEditBedRent(String(bed.monthly_rent));
                                                        }}
                                                      >
                                                        <Edit2 className="h-3 w-3" />
                                                      </Button>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground capitalize">{bed.rent_type?.replace("_", " ")}</span>
                                                {canEdit && u.beds?.length > 1 && (
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (confirm(`Remove bed ${bed.bed_label}?`)) {
                                                        deleteBedMutation.mutate(bed.bed_id);
                                                      }
                                                    }}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rent Escalation Projection */}
            {esc && esc.length > 0 && (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Rent Escalation Projection ({plan.annual_rent_increase_pct}%/yr)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Year</th>
                          <th className="text-right p-2 font-medium">Monthly Rent</th>
                          <th className="text-right p-2 font-medium">Annual Gross</th>
                          <th className="text-right p-2 font-medium">Cumulative Growth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {esc.map((yr: EscalationYear) => (
                          <tr key={yr.year} className="border-t">
                            <td className="p-2">{yr.year === 0 ? "Stabilization" : `Year ${yr.year}`}</td>
                            <td className="p-2 text-right">${yr.monthly?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="p-2 text-right">${yr.gross_annual?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="p-2 text-right text-emerald-600">
                              {yr.year === 0 ? "—" : `+${((yr.gross_annual / esc[0].gross_annual - 1) * 100).toFixed(1)}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ancillary Revenue for this Plan */}
            <AncillaryRevenueSection
              propertyId={propertyId}
              planId={plan.plan_id}
              canEdit={canEdit}
              label={`Ancillary Revenue — ${plan.plan_label}`}
            />

            {/* Cash Flow Summary for this Plan */}
            {pr && (
              <Card className="border-emerald-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Projected Cash Flow — {plan.plan_label as string}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Gross Potential Rent</span>
                      <span className="font-medium">${(pr.potential_annual_rent || 0).toLocaleString()}/yr</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Less: Vacancy ({pr.vacancy_rate || 0}%)</span>
                      <span>-${(pr.vacancy_loss_annual || 0).toLocaleString()}/yr</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Effective Gross Income</span>
                      <span>${(pr.actual_annual_rent || 0).toLocaleString()}/yr</span>
                    </div>
                    {Number((property as unknown as Record<string, unknown>)?.annual_expenses) > 0 && (
                      <>
                        <div className="flex justify-between text-red-600">
                          <span>Less: Operating Expenses</span>
                          <span>-${Number((property as unknown as Record<string, unknown>).annual_expenses).toLocaleString()}/yr</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Net Operating Income (NOI)</span>
                          <span>${(pr.actual_annual_rent - Number((property as unknown as Record<string, unknown>).annual_expenses)).toLocaleString()}/yr</span>
                        </div>
                      </>
                    )}
                    {plan.annual_debt_service > 0 && (
                      <>
                        <div className="flex justify-between text-red-600">
                          <span>Less: Debt Service ({plan.debt_count} facilit{plan.debt_count === 1 ? "y" : "ies"})</span>
                          <span>-${plan.annual_debt_service.toLocaleString()}/yr</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Cash Flow After Debt Service</span>
                          <span className={(pr.actual_annual_rent - Number((property as unknown as Record<string, unknown>)?.annual_expenses || 0) - plan.annual_debt_service) >= 0 ? "text-emerald-700" : "text-red-700"}>
                            ${(pr.actual_annual_rent - Number((property as unknown as Record<string, unknown>)?.annual_expenses || 0) - plan.annual_debt_service).toLocaleString()}/yr
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}

      {/* No Plans Message */}
      {(!rentRollData?.plan_phases || rentRollData.plan_phases.length === 0) && rentRollData?.baseline && (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-sm text-muted-foreground">No development plans configured yet. Create a development plan in the Dev Plans tab to see projected rent rolls.</p>
          </CardContent>
        </Card>
      )}
      </>}
    </div>
  );
}
