"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, DollarSign, Calendar, Building2, Landmark, TrendingUp, Pencil, Loader2, Sparkles, RefreshCw, AlertTriangle, Target, ChevronRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PropertyLookup } from "@/components/property/PropertyLookup";
import { PropertyImporter } from "@/components/property/PropertyImporter";
import { formatCurrencyCompact, formatDate } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import type { DevelopmentPlan } from "@/types/portfolio";

const STAGES = [
  "prospect", "acquisition", "interim_operation", "planning",
  "permit", "construction", "lease_up", "stabilized", "exit",
];

interface OverviewTabProps {
  property: Record<string, any>;
  activePlan: DevelopmentPlan | undefined;
  totalDebtCommitment: number;
  totalDebtOutstanding: number;
  debtFacilitiesCount: number;
  onPropertyUpdated?: () => void;
  activePhase?: "as_is" | "post_renovation" | "full_development";
}

function EditPropertyDialog({ property, onSaved }: { property: Record<string, any>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    address: property.address || "",
    city: property.city || "",
    province: property.province || "",
    zoning: property.zoning || "",
    lot_size: property.lot_size || "",
    max_buildable_area: property.max_buildable_area || "",
    floor_area_ratio: property.floor_area_ratio || "",
    purchase_date: property.purchase_date || "",
    purchase_price: property.purchase_price || "",
    assessed_value: property.assessed_value || "",
    current_market_value: property.current_market_value || "",
    development_stage: property.development_stage || "prospect",
    property_type: property.property_type || "",
    year_built: property.year_built || "",
    building_sqft: property.building_sqft || "",
    bedrooms: property.bedrooms || "",
    bathrooms: property.bathrooms || "",
    garage: property.garage || "",
    neighbourhood: property.neighbourhood || "",
    legal_description: property.legal_description || "",
    latitude: property.latitude || "",
    longitude: property.longitude || "",
    last_sold_price: property.last_sold_price || "",
    last_sold_date: property.last_sold_date || "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      // Only send changed, non-empty fields
      for (const [k, v] of Object.entries(form)) {
        if (v === "" || v === null || v === undefined) continue;
        const numericFields = ["lot_size", "max_buildable_area", "floor_area_ratio", "purchase_price", "assessed_value", "current_market_value", "building_sqft", "bedrooms", "bathrooms", "latitude", "longitude", "last_sold_price", "year_built"];
        if (numericFields.includes(k)) {
          payload[k] = Number(v) || undefined;
        } else {
          payload[k] = v;
        }
      }
      await apiClient.patch(`/api/portfolio/properties/${property.property_id}`, payload);

      // Auto-initialize units if bedrooms changed and no units exist yet
      const bedrooms = Number(form.bedrooms) || 0;
      if (bedrooms > 0) {
        try {
          await apiClient.post(`/api/portfolio/properties/${property.property_id}/initialize-units`, {
            bedrooms,
            bathrooms: Number(form.bathrooms) || 1,
            building_sqft: Number(form.building_sqft) || 0,
          });
          toast.success("Property updated with unit structure");
        } catch {
          // Units may already exist — that's fine
          toast.success("Property updated");
        }
      } else {
        toast.success("Property updated");
      }
      setOpen(false);
      onSaved();
    } catch {
      toast.error("Failed to update property");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* @ts-expect-error radix-ui asChild type */}
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Address */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stage</Label>
              <Select value={form.development_stage} onValueChange={(v) => set("development_stage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Province</Label><Input value={form.province} onChange={(e) => set("province", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Neighbourhood</Label><Input value={form.neighbourhood} onChange={(e) => set("neighbourhood", e.target.value)} /></div>
          </div>
          {/* Land */}
          <p className="text-xs font-semibold text-muted-foreground pt-2">Land & Zoning</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Zoning</Label><Input value={form.zoning} onChange={(e) => set("zoning", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Lot Size (sqft)</Label><Input type="number" value={form.lot_size} onChange={(e) => set("lot_size", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Max Buildable (sqft)</Label><Input type="number" value={form.max_buildable_area} onChange={(e) => set("max_buildable_area", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">FAR</Label><Input type="number" step="any" value={form.floor_area_ratio} onChange={(e) => set("floor_area_ratio", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Legal Description</Label><Input value={form.legal_description} onChange={(e) => set("legal_description", e.target.value)} /></div>
          </div>
          {/* Financial */}
          <p className="text-xs font-semibold text-muted-foreground pt-2">Financial</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Purchase Price</Label><Input type="number" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Assessed Value</Label><Input type="number" value={form.assessed_value} onChange={(e) => set("assessed_value", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Market Value</Label><Input type="number" value={form.current_market_value} onChange={(e) => set("current_market_value", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Last Sold Price</Label><Input type="number" value={form.last_sold_price} onChange={(e) => set("last_sold_price", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Last Sold Date</Label><Input type="date" value={form.last_sold_date} onChange={(e) => set("last_sold_date", e.target.value)} /></div>
          </div>
          {/* Building */}
          <p className="text-xs font-semibold text-muted-foreground pt-2">Building</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Type</Label><Input value={form.property_type} onChange={(e) => set("property_type", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Year Built</Label><Input type="number" value={form.year_built} onChange={(e) => set("year_built", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Sqft</Label><Input type="number" value={form.building_sqft} onChange={(e) => set("building_sqft", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Garage</Label><Input value={form.garage} onChange={(e) => set("garage", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Bedrooms</Label><Input type="number" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Bathrooms</Label><Input type="number" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} /></div>
          </div>
          {/* Save */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OverviewTab({
  property,
  activePlan,
  totalDebtCommitment,
  totalDebtOutstanding,
  debtFacilitiesCount,
  onPropertyUpdated,
  activePhase,
}: OverviewTabProps) {
  const phaseLabel = activePhase === "as_is" ? "As-Is" : activePhase === "post_renovation" ? "Post-Renovation" : activePhase === "full_development" ? "Full Development" : null;

  // Fetch exit forecast and acquisition baseline for overview KPIs
  const { data: exitForecast } = useQuery({
    queryKey: ["exit-forecast", property.property_id],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${property.property_id}/exit-forecast`).then(r => r.data),
    enabled: property.property_id > 0,
  });
  const { data: acqBaseline } = useQuery({
    queryKey: ["acquisition-baseline", property.property_id],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${property.property_id}/acquisition-baseline`).then(r => r.data),
    enabled: property.property_id > 0,
  });

  const saleStatusColors: Record<string, string> = {
    planned: "bg-slate-100 text-slate-700 border-slate-200",
    marketed: "bg-blue-100 text-blue-700 border-blue-200",
    under_contract: "bg-amber-100 text-amber-700 border-amber-200",
    sold: "bg-green-100 text-green-700 border-green-200",
  };

  return (
    <div className="space-y-6">
      {/* Investment Summary — Key Returns Snapshot */}
      <InvestmentSummaryCard propertyId={property.property_id} />

      {/* Import from URL or PDF */}
      <PropertyImporter compact onImport={async (data) => {
        try {
          const payload: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(data)) {
            if (v != null && !k.startsWith("_") && k !== "image_urls" && k !== "room_dimensions") {
              payload[k] = typeof v === "number" || typeof v === "boolean" ? v : String(v);
            }
          }
          if (data.room_dimensions && typeof data.room_dimensions === "string") {
            payload.room_dimensions = data.room_dimensions;
          }
          await apiClient.patch(`/api/portfolio/properties/${property.property_id}`, payload);
          onPropertyUpdated?.();
          toast.success("Property updated from import");
        } catch {
          toast.error("Failed to update property");
        }
      }} />

      {/* AI Preliminary Property Assessment */}
      <AIPropertyAssessment propertyId={property.property_id} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Property Details */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Property Details
              </CardTitle>
              <div className="flex items-center gap-2">
                <EditPropertyDialog property={property} onSaved={() => onPropertyUpdated?.()} />
                <PropertyLookup
                  address={property.address}
                  city={property.city}
                  province={property.province}
                  onApply={async (fields) => {
                    try {
                      const payload: Record<string, unknown> = {};
                      const numericFields = ["assessed_value", "current_market_value", "lot_size", "max_buildable_area", "floor_area_ratio", "building_sqft", "bedrooms", "bathrooms", "latitude", "longitude", "tax_amount", "list_price", "last_sold_price", "year_built"];
                      for (const [k, v] of Object.entries(fields)) {
                        if (v == null) continue;
                        payload[k] = numericFields.includes(k) ? Number(v) : v;
                      }
                      await apiClient.patch(`/api/portfolio/properties/${property.property_id}`, payload);

                      // Auto-initialize units if bedrooms data is available and no units exist yet
                      const bedrooms = Number(fields.bedrooms) || 0;
                      if (bedrooms > 0) {
                        try {
                          const rentFields = fields as Record<string, unknown>;
                          await apiClient.post(`/api/portfolio/properties/${property.property_id}/initialize-units`, {
                            bedrooms,
                            bathrooms: Number(fields.bathrooms) || 1,
                            building_sqft: Number(fields.building_sqft) || 0,
                            estimated_monthly_rent: Number(rentFields.estimated_monthly_rent) || 0,
                          });
                          toast.success("Property updated with unit structure from lookup data");
                        } catch {
                          // Units may already exist — that's fine
                          toast.success("Property updated from lookup data");
                        }
                      } else {
                        toast.success("Property updated from lookup data");
                      }
                      onPropertyUpdated?.();
                    } catch {
                      toast.error("Failed to update property");
                    }
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-0 text-sm">
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Address</dt>
                <dd className="font-medium text-right">{property.address}, {property.city}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Province</dt>
                <dd className="font-medium text-right">{property.province}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Zoning</dt>
                <dd className="font-medium text-right">{property.zoning ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Lot Size</dt>
                <dd className="font-medium text-right">{property.lot_size ? `${Number(property.lot_size).toLocaleString()} sqft` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Max Buildable</dt>
                <dd className="font-medium text-right">{property.max_buildable_area ? `${Number(property.max_buildable_area).toLocaleString()} sqft` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Floor Area Ratio</dt>
                <dd className="font-medium text-right">{property.floor_area_ratio ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5">
                <dt className="text-muted-foreground shrink-0">Purchase Date</dt>
                <dd className="font-medium text-right">{property.purchase_date ? formatDate(property.purchase_date) : "—"}</dd>
              </div>
            </dl>
            {property.listing_description && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Listing Description</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{property.listing_description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Snapshot */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Financial Snapshot
              {phaseLabel && (
                <Badge variant="secondary" className="ml-2 text-xs">{phaseLabel}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* LP Fund & Stage Assignment */}
            <PropertyAssignmentSection property={property} onUpdated={onPropertyUpdated} />

            <dl className="space-y-0 text-sm">
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Purchase Price</dt>
                <dd className="font-medium text-right tabular-nums whitespace-nowrap">{property.purchase_price ? formatCurrencyCompact(property.purchase_price) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Assessed Value</dt>
                <dd className="font-medium text-right tabular-nums whitespace-nowrap">{property.assessed_value ? formatCurrencyCompact(property.assessed_value) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Market Value</dt>
                <dd className="font-medium text-right text-blue-600 tabular-nums whitespace-nowrap">{property.current_market_value ? formatCurrencyCompact(property.current_market_value) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Total Debt</dt>
                <dd className="font-medium text-right tabular-nums whitespace-nowrap">{totalDebtCommitment > 0 ? formatCurrencyCompact(totalDebtCommitment) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Outstanding</dt>
                <dd className="font-medium text-right text-amber-600 tabular-nums whitespace-nowrap">{totalDebtOutstanding > 0 ? formatCurrencyCompact(totalDebtOutstanding) : "$0"}</dd>
              </div>
              {/* Show construction cost only for development phases or when no phase filter */}
              {(!activePhase || activePhase === "full_development" || activePhase === "post_renovation") && activePlan && (
                <>
                  <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Construction Cost</dt>
                    <dd className="font-medium text-right tabular-nums whitespace-nowrap">{activePlan.estimated_construction_cost ? formatCurrencyCompact(activePlan.estimated_construction_cost) : "\u2014"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground shrink-0">Projected NOI</dt>
                    <dd className="font-semibold text-right text-green-600 tabular-nums whitespace-nowrap">{activePlan.projected_annual_noi ? formatCurrencyCompact(activePlan.projected_annual_noi) : "\u2014"}</dd>
                  </div>
                </>
              )}
              {(!activePhase || activePhase === "full_development" || activePhase === "post_renovation") && !activePlan && (
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Development Plan</dt>
                  <dd className="text-muted-foreground italic">No active plan</dd>
                </div>
              )}
            </dl>

            {/* Exit KPIs */}
            {(exitForecast?.exists || acqBaseline?.exists) && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Target className="h-3 w-3" /> Exit & Returns
                </p>
                <dl className="space-y-0 text-sm">
                  <div className="flex justify-between gap-4 py-2 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Target Exit Year</dt>
                    <dd className="font-medium text-right">
                      {exitForecast?.forecast_sale_year ?? acqBaseline?.target_sale_year ?? "—"}
                    </dd>
                  </div>
                  {exitForecast?.forecast_sale_price && (
                    <div className="flex justify-between gap-4 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground shrink-0">Projected Sale Price</dt>
                      <dd className="font-medium text-right tabular-nums text-blue-600">{formatCurrencyCompact(exitForecast.forecast_sale_price)}</dd>
                    </div>
                  )}
                  {exitForecast?.forecast_net_proceeds && (
                    <div className="flex justify-between gap-4 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground shrink-0">Net Proceeds</dt>
                      <dd className="font-semibold text-right tabular-nums text-green-600">{formatCurrencyCompact(exitForecast.forecast_net_proceeds)}</dd>
                    </div>
                  )}
                  {(exitForecast?.forecast_irr || acqBaseline?.target_irr) && (
                    <div className="flex justify-between gap-4 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground shrink-0">Forecast IRR</dt>
                      <dd className="font-bold text-right text-green-700">
                        {exitForecast?.forecast_irr != null ? `${Number(exitForecast.forecast_irr).toFixed(1)}%` : acqBaseline?.target_irr != null ? `${Number(acqBaseline.target_irr).toFixed(1)}% (target)` : "—"}
                      </dd>
                    </div>
                  )}
                  {exitForecast?.sale_status && (
                    <div className="flex justify-between gap-4 py-2">
                      <dt className="text-muted-foreground shrink-0">Sale Status</dt>
                      <dd>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${saleStatusColors[exitForecast.sale_status] || "bg-gray-100 text-gray-700"}`}>
                          {exitForecast.sale_status.replace(/_/g, " ")}
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Property Specifications & Municipal Data */}
      {(property.year_built || property.property_type || property.bedrooms || property.neighbourhood || property.tax_amount || property.mls_number) && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Building Specifications */}
          {(property.year_built || property.property_type || property.building_sqft || property.bedrooms) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Building Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-0 text-sm">
                  {property.property_type && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="font-medium text-right">{property.property_type}</dd>
                    </div>
                  )}
                  {property.property_style && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Style</dt>
                      <dd className="font-medium text-right">{property.property_style}</dd>
                    </div>
                  )}
                  {property.year_built && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Year Built</dt>
                      <dd className="font-medium text-right">{property.year_built}</dd>
                    </div>
                  )}
                  {property.building_sqft && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Building Size</dt>
                      <dd className="font-medium text-right">{Number(property.building_sqft).toLocaleString()} sqft</dd>
                    </div>
                  )}
                  {(property.bedrooms != null || property.bathrooms != null) && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Bed / Bath</dt>
                      <dd className="font-medium text-right">{property.bedrooms ?? "—"} / {property.bathrooms ?? "—"}</dd>
                    </div>
                  )}
                  {property.garage && (
                    <div className="flex justify-between gap-2 py-2">
                      <dt className="text-muted-foreground">Garage</dt>
                      <dd className="font-medium text-right">{property.garage}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Municipal / Location */}
          {(property.neighbourhood || property.ward || property.legal_description || property.roll_number) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  Municipal Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-0 text-sm">
                  {property.neighbourhood && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Neighbourhood</dt>
                      <dd className="font-medium text-right">{property.neighbourhood}</dd>
                    </div>
                  )}
                  {property.ward && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Ward</dt>
                      <dd className="font-medium text-right">{property.ward}</dd>
                    </div>
                  )}
                  {property.assessment_class && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Assessment Class</dt>
                      <dd className="font-medium text-right">{property.assessment_class}</dd>
                    </div>
                  )}
                  {property.roll_number && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Roll #</dt>
                      <dd className="font-medium text-right font-mono text-xs">{property.roll_number}</dd>
                    </div>
                  )}
                  {property.legal_description && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Legal</dt>
                      <dd className="font-medium text-right text-xs max-w-[180px] truncate" title={property.legal_description}>{property.legal_description}</dd>
                    </div>
                  )}
                  {property.tax_amount && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Tax Amount</dt>
                      <dd className="font-medium text-right">{formatCurrencyCompact(property.tax_amount)}{property.tax_year ? ` (${property.tax_year})` : ""}</dd>
                    </div>
                  )}
                  {(property.latitude && property.longitude) && (
                    <div className="flex justify-between gap-2 py-2">
                      <dt className="text-muted-foreground">Coordinates</dt>
                      <dd className="font-medium text-right font-mono text-xs">{Number(property.latitude).toFixed(5)}, {Number(property.longitude).toFixed(5)}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* MLS / Market Data */}
          {(property.mls_number || property.list_price || property.last_sold_price) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Market Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-0 text-sm">
                  {property.mls_number && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">MLS #</dt>
                      <dd className="font-medium text-right font-mono">{property.mls_number}</dd>
                    </div>
                  )}
                  {property.list_price && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">List Price</dt>
                      <dd className="font-medium text-right">{formatCurrencyCompact(property.list_price)}</dd>
                    </div>
                  )}
                  {property.last_sold_price && (
                    <div className="flex justify-between gap-2 py-2 border-b border-dashed">
                      <dt className="text-muted-foreground">Last Sold</dt>
                      <dd className="font-medium text-right">{formatCurrencyCompact(property.last_sold_price)}</dd>
                    </div>
                  )}
                  {property.last_sold_date && (
                    <div className="flex justify-between gap-2 py-2">
                      <dt className="text-muted-foreground">Sold Date</dt>
                      <dd className="font-medium text-right">{formatDate(property.last_sold_date)}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Extended Property Details (expandable) */}
      {(property.basement_type || property.foundation_type || property.heating_type ||
        property.parking_type || property.title_type || property.frontage_m ||
        property.walk_score || property.listing_description || property.room_dimensions ||
        property.total_finished_area || property.storeys || property.exterior_finish) && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground py-2">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            Extended Property Details
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
              {[property.basement_type, property.foundation_type, property.heating_type,
                property.parking_type, property.title_type, property.listing_description,
                property.walk_score, property.room_dimensions, property.total_finished_area,
                property.exterior_finish, property.construction_material, property.cooling_type,
                property.flooring_types, property.appliances, property.structures,
                property.postal_code, property.frontage_m, property.storeys,
              ].filter(Boolean).length} fields
            </span>
          </summary>
          <div className="grid gap-6 lg:grid-cols-3 mt-4">
            {/* Construction & Structure */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Construction & Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-0 text-sm">
                  {property.total_finished_area && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Total Finished Area</dt>
                      <dd className="font-medium text-right text-xs">{Number(property.total_finished_area).toLocaleString()} sqft</dd>
                    </div>
                  )}
                  {property.storeys && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Storeys</dt>
                      <dd className="font-medium text-right text-xs">{property.storeys}</dd>
                    </div>
                  )}
                  {property.basement_type && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Basement</dt>
                      <dd className="font-medium text-right text-xs">{property.basement_type}</dd>
                    </div>
                  )}
                  {property.foundation_type && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Foundation</dt>
                      <dd className="font-medium text-right text-xs">{property.foundation_type}</dd>
                    </div>
                  )}
                  {property.construction_material && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Construction</dt>
                      <dd className="font-medium text-right text-xs">{property.construction_material}</dd>
                    </div>
                  )}
                  {property.exterior_finish && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Exterior</dt>
                      <dd className="font-medium text-right text-xs">{property.exterior_finish}</dd>
                    </div>
                  )}
                  {property.flooring_types && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Flooring</dt>
                      <dd className="font-medium text-right text-xs">{property.flooring_types}</dd>
                    </div>
                  )}
                  {property.title_type && (
                    <div className="flex justify-between gap-2 py-1.5">
                      <dt className="text-muted-foreground text-xs">Title</dt>
                      <dd className="font-medium text-right text-xs">{property.title_type}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Systems & Parking */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Systems & Parking</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-0 text-sm">
                  {property.heating_type && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Heating</dt>
                      <dd className="font-medium text-right text-xs">{property.heating_type}</dd>
                    </div>
                  )}
                  {property.cooling_type && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Cooling</dt>
                      <dd className="font-medium text-right text-xs">{property.cooling_type}</dd>
                    </div>
                  )}
                  {property.parking_type && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Parking Type</dt>
                      <dd className="font-medium text-right text-xs">{property.parking_type}</dd>
                    </div>
                  )}
                  {property.parking_spaces && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Parking Spaces</dt>
                      <dd className="font-medium text-right text-xs">{property.parking_spaces}</dd>
                    </div>
                  )}
                  {property.frontage_m && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Frontage</dt>
                      <dd className="font-medium text-right text-xs">{Number(property.frontage_m).toFixed(1)}m ({(Number(property.frontage_m) * 3.281).toFixed(0)}&apos;)</dd>
                    </div>
                  )}
                  {property.land_depth_m && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Depth</dt>
                      <dd className="font-medium text-right text-xs">{Number(property.land_depth_m).toFixed(1)}m ({(Number(property.land_depth_m) * 3.281).toFixed(0)}&apos;)</dd>
                    </div>
                  )}
                  {property.appliances && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Appliances</dt>
                      <dd className="font-medium text-right text-xs max-w-[160px] truncate" title={property.appliances}>{property.appliances}</dd>
                    </div>
                  )}
                  {property.structures && (
                    <div className="flex justify-between gap-2 py-1.5">
                      <dt className="text-muted-foreground text-xs">Structures</dt>
                      <dd className="font-medium text-right text-xs">{property.structures}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Scores & Listing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Scores & Listing</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-0 text-sm">
                  {property.postal_code && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Postal Code</dt>
                      <dd className="font-medium text-right text-xs">{property.postal_code}</dd>
                    </div>
                  )}
                  {property.walk_score && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Walk Score</dt>
                      <dd className="font-medium text-right text-xs">{property.walk_score}/100</dd>
                    </div>
                  )}
                  {property.transit_score && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Transit Score</dt>
                      <dd className="font-medium text-right text-xs">{property.transit_score}/100</dd>
                    </div>
                  )}
                  {property.bike_score && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Bike Score</dt>
                      <dd className="font-medium text-right text-xs">{property.bike_score}/100</dd>
                    </div>
                  )}
                  {property.has_fencing && (
                    <div className="flex justify-between gap-2 py-1.5 border-b border-dashed">
                      <dt className="text-muted-foreground text-xs">Fencing</dt>
                      <dd className="font-medium text-right text-xs">Yes</dd>
                    </div>
                  )}
                </dl>
                {/* Listing description moved to Property Details card */}
              </CardContent>
            </Card>
          </div>

          {/* Room Dimensions */}
          {property.room_dimensions && (() => {
            try {
              const rooms = typeof property.room_dimensions === "string" ? JSON.parse(property.room_dimensions) : property.room_dimensions;
              if (!Array.isArray(rooms) || rooms.length === 0) return null;
              const levels = [...new Set(rooms.map((r: any) => r.level))];
              return (
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Room Dimensions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {levels.map((level: string) => (
                        <div key={level}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{level}</p>
                          <dl className="space-y-0 text-sm">
                            {rooms.filter((r: any) => r.level === level).map((r: any, i: number) => (
                              <div key={i} className="flex justify-between gap-2 py-1 border-b border-dashed last:border-0">
                                <dt className="text-xs">{r.room}</dt>
                                <dd className="text-xs text-muted-foreground tabular-nums">{r.width_ft} x {r.length_ft} ft</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            } catch { return null; }
          })()}
        </details>
      )}

      {/* Development Plan Summary (if exists) */}
      {activePlan && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Active Development Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Units</p>
                <p className="text-lg font-bold">{activePlan.planned_units}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Beds</p>
                <p className="text-lg font-bold">{activePlan.planned_beds}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sqft</p>
                <p className="text-lg font-bold">{Number(activePlan.planned_sqft).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cost / sqft</p>
                <p className="text-lg font-bold">{activePlan.cost_per_sqft ? `$${Number(activePlan.cost_per_sqft).toFixed(0)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-lg font-bold">{activePlan.development_start_date ? formatDate(activePlan.development_start_date) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completion</p>
                <p className="text-lg font-bold">{activePlan.estimated_completion_date ? formatDate(activePlan.estimated_completion_date) : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


// ── AI Preliminary Property Assessment ──────────────────────────────

// ── Investment Summary Card ─────────────────────────────────────────

function InvestmentSummaryCard({ propertyId }: { propertyId: number }) {
  const [data, setData] = React.useState<Record<string, any> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiClient.get(`/api/portfolio/properties/${propertyId}/investment-summary`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return <div className="h-32 bg-muted/30 rounded-lg animate-pulse" />;
  if (!data) return null;

  const fmt = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : "—";
  const pct = (n: number | null | undefined) => n != null ? `${n}%` : "—";

  const dscr_color = !data.dscr ? "text-muted-foreground" : data.dscr >= 1.5 ? "text-green-600" : data.dscr >= 1.2 ? "text-blue-600" : data.dscr >= 1.0 ? "text-amber-600" : "text-red-600";
  const ltv_color = !data.ltv ? "text-muted-foreground" : data.ltv <= 65 ? "text-green-600" : data.ltv <= 75 ? "text-blue-600" : data.ltv <= 80 ? "text-amber-600" : "text-red-600";

  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Investment Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Returns Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border bg-white p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">NOI</p>
            <p className="text-lg font-bold text-green-700">{fmt(data.noi)}</p>
            <p className="text-[9px] text-muted-foreground">Annual</p>
          </div>
          <div className="rounded-lg border bg-white p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">DSCR</p>
            <p className={`text-lg font-bold ${dscr_color}`}>{data.dscr ? `${data.dscr}x` : "—"}</p>
            <p className="text-[9px] text-muted-foreground">{data.dscr ? (data.dscr >= 1.25 ? "Healthy" : data.dscr >= 1.0 ? "Tight" : "Distressed") : "No debt"}</p>
          </div>
          <div className="rounded-lg border bg-white p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">Cap Rate</p>
            <p className="text-lg font-bold text-indigo-700">{pct(data.cap_rate)}</p>
            <p className="text-[9px] text-muted-foreground">Current</p>
          </div>
          <div className="rounded-lg border bg-white p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">LTV</p>
            <p className={`text-lg font-bold ${ltv_color}`}>{pct(data.ltv)}</p>
            <p className="text-[9px] text-muted-foreground">{data.ltv ? (data.ltv <= 75 ? "Conservative" : "Elevated") : "—"}</p>
          </div>
          <div className="rounded-lg border bg-white p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">Cash-on-Cash</p>
            <p className="text-lg font-bold text-emerald-700">{pct(data.cash_on_cash)}</p>
            <p className="text-[9px] text-muted-foreground">Annual</p>
          </div>
          <div className="rounded-lg border bg-white p-2.5 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-medium">Debt Yield</p>
            <p className="text-lg font-bold">{pct(data.debt_yield)}</p>
            <p className="text-[9px] text-muted-foreground">NOI / Debt</p>
          </div>
        </div>

        {/* Cash Flow Waterfall */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="rounded border p-2 bg-white">
            <p className="text-[9px] text-muted-foreground">Gross Potential Rent</p>
            <p className="font-bold">{fmt(data.baseline_annual_gpr)}</p>
          </div>
          <div className="rounded border p-2 bg-white">
            <p className="text-[9px] text-muted-foreground">+ Ancillary Revenue</p>
            <p className="font-bold">{fmt(data.annual_ancillary)}</p>
          </div>
          <div className="rounded border p-2 bg-white">
            <p className="text-[9px] text-muted-foreground">EGI (after vacancy)</p>
            <p className="font-bold">{fmt(data.egi)}</p>
          </div>
          <div className="rounded border p-2 bg-white">
            <p className="text-[9px] text-muted-foreground">- Operating Expenses</p>
            <p className="font-bold text-red-600">({fmt(data.total_opex)})</p>
            {data.expense_ratio && <p className="text-[8px] text-muted-foreground">{data.expense_ratio}% ratio</p>}
          </div>
          <div className="rounded border p-2 bg-green-50 border-green-200">
            <p className="text-[9px] text-green-700 font-medium">= NOI</p>
            <p className="font-bold text-green-700">{fmt(data.noi)}</p>
          </div>
        </div>

        {/* Capital Stack + Development */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded border p-2 bg-white">
            <p className="text-[9px] text-muted-foreground">Purchase Price</p>
            <p className="font-bold">{fmt(data.purchase_price)}</p>
          </div>
          <div className="rounded border p-2 bg-white">
            <p className="text-[9px] text-muted-foreground">Total Debt</p>
            <p className="font-bold">{fmt(data.total_debt_outstanding)}</p>
          </div>
          <div className="rounded border p-2 bg-white">
            <p className="text-[9px] text-muted-foreground">Equity</p>
            <p className="font-bold">{fmt(data.total_equity)}</p>
          </div>
          <div className="rounded border p-2 bg-white">
            <p className="text-[9px] text-muted-foreground">Break-Even Occ.</p>
            <p className="font-bold">{pct(data.breakeven_occupancy)}</p>
          </div>
        </div>

        {/* Development Metrics (if applicable) */}
        {data.has_development_plan && (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50/30 p-3">
            <p className="text-[10px] font-semibold uppercase text-cyan-700 mb-2">Development Metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div>
                <p className="text-[9px] text-muted-foreground">Dev Cost</p>
                <p className="font-bold">{fmt(data.dev_total_cost)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Total Investment</p>
                <p className="font-bold">{fmt(data.total_investment)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Yield on Cost</p>
                <p className="font-bold text-cyan-700">{pct(data.yield_on_cost)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">LTC</p>
                <p className="font-bold">{pct(data.ltc)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Stabilized NOI</p>
                <p className="font-bold text-green-700">{fmt(data.projected_stabilized_noi)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Risk Flags */}
        {data.risk_flags && data.risk_flags.length > 0 && (
          <div className="space-y-1">
            {data.risk_flags.map((flag: any, i: number) => (
              <div key={i} className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-1.5 ${
                flag.severity === "critical" ? "bg-red-100 text-red-800" :
                flag.severity === "high" ? "bg-red-50 text-red-700" :
                flag.severity === "medium" ? "bg-amber-50 text-amber-700" :
                "bg-blue-50 text-blue-700"
              }`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{flag.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


/* ── Professional markdown renderer for AI content ── */
function renderMarkdownPro(md: string): string {
  // Pre-process: aggressively collapse all blank lines in the document.
  // The AI puts blank lines between every bullet/item — strip them all,
  // then re-add paragraph breaks only where truly needed.
  const lines = md.split("\n");
  const collapsed: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Skip fully blank lines — we'll add paragraph breaks via ## headers and --- only
    if (trimmed === "") {
      // Keep blank line only if next non-blank line is a header, HR, or paragraph start
      // (i.e. not a list item or continuation)
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      const next = j < lines.length ? lines[j].trim() : "";
      const prev = collapsed.length > 0 ? collapsed[collapsed.length - 1].trim() : "";
      // Insert a single blank line before headers, HRs, and after non-list paragraphs
      if (
        next.startsWith("##") || next.startsWith("---") ||
        (!prev.startsWith("-") && !prev.startsWith("*") && !prev.match(/^\d+\./) &&
         !next.startsWith("-") && !next.startsWith("*") && !next.match(/^\d+\./) &&
         prev !== "" && next !== "")
      ) {
        collapsed.push("");
      }
      continue;
    }
    collapsed.push(line);
  }

  const text = collapsed.join("\n");

  return text
    // Headers
    .replace(/^#### (.+)$/gm, '<h5 class="text-xs font-semibold text-foreground mt-2 mb-0.5">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 class="text-[13px] font-semibold text-foreground mt-2 mb-0.5">$1</h4>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Numbered lists
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal text-[13px] leading-snug">$2</li>')
    // Bullet/dash lists
    .replace(/^[-*] (.+)$/gm, '<li class="ml-5 list-disc text-[13px] leading-snug">$1</li>')
    // Wrap consecutive <li> — clean any stray <br/> between them
    .replace(/((?:<li[^>]*>.*?<\/li>(?:\s|<br\/>)*)+)/g, (match) => {
      const cleaned = match.replace(/<br\/>/g, "").replace(/\n/g, "");
      if (cleaned.includes("list-decimal")) return `<ol class="my-0.5">${cleaned}</ol>`;
      return `<ul class="my-0.5">${cleaned}</ul>`;
    })
    // Horizontal rules
    .replace(/^---+$/gm, '<hr class="my-2 border-border/60" />')
    // Double newlines → paragraph break
    .replace(/\n{2,}/g, '</p><p class="text-[13px] leading-snug text-muted-foreground mb-1">')
    // Single newlines
    .replace(/\n/g, "<br/>");
}

/* ── LP Fund & Stage Assignment (inline in Financial Snapshot) ── */

const DEV_STAGES = [
  { value: "prospect", label: "Prospect" },
  { value: "acquisition", label: "Acquisition" },
  { value: "pre_development", label: "Pre-Development" },
  { value: "construction", label: "Construction" },
  { value: "lease_up", label: "Lease-Up" },
  { value: "stabilized", label: "Stabilized" },
  { value: "disposition", label: "Disposition" },
];

function PropertyAssignmentSection({ property, onUpdated }: { property: Record<string, any>; onUpdated?: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: lps } = useQuery<any[]>({
    queryKey: ["lps"],
    queryFn: () => apiClient.get("/api/investment/lp").then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d.items ?? [];
    }),
  });
  const { data: communities } = useQuery<any[]>({
    queryKey: ["communities"],
    queryFn: () => apiClient.get("/api/community/communities").then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d.items ?? [];
    }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiClient.patch(`/api/portfolio/properties/${property.property_id}`, payload).then(r => r.data),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["property", property.property_id] });
      onUpdated?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to update");
    },
  });

  const currentLpId = property.lp_id ? String(property.lp_id) : "";
  const currentStage = property.development_stage || "prospect";
  const currentCommunityId = property.community_id ? String(property.community_id) : "";
  const currentLp = (lps || []).find((lp: any) => lp.lp_id === property.lp_id);
  const currentCommunity = (communities || []).find((c: any) => c.community_id === property.community_id);
  const stageLabel = DEV_STAGES.find(s => s.value === currentStage)?.label || currentStage;

  return (
    <div className="mb-4 pb-4 border-b">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Landmark className="h-3 w-3" /> Fund & Stage
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] px-2 text-muted-foreground"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Done" : <><Pencil className="h-3 w-3 mr-1" /> Edit</>}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">LP Fund</Label>
              <Select
                value={currentLpId || "__none__"}
                onValueChange={(v) => {
                  const lpId = v === "__none__" ? null : Number(v);
                  saveMutation.mutate({ lp_id: lpId });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassigned —</SelectItem>
                  {(lps || []).map((lp: any) => (
                    <SelectItem key={lp.lp_id} value={String(lp.lp_id)}>
                      {lp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Community</Label>
              <Select
                value={currentCommunityId || "__none__"}
                onValueChange={(v) => {
                  const cId = v === "__none__" ? null : Number(v);
                  saveMutation.mutate({ community_id: cId });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassigned —</SelectItem>
                  {(communities || []).map((c: any) => (
                    <SelectItem key={c.community_id} value={String(c.community_id)}>
                      {c.name} ({c.community_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Development Stage</Label>
              <Select
                value={currentStage}
                onValueChange={(v) => {
                  saveMutation.mutate({ development_stage: v });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEV_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : (
        <dl className="text-sm space-y-0">
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-muted-foreground shrink-0">LP Fund</dt>
            <dd className="font-medium text-right">{currentLp?.name || <span className="text-muted-foreground italic">Unassigned</span>}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-muted-foreground shrink-0">Community</dt>
            <dd className="font-medium text-right">{currentCommunity?.name || <span className="text-muted-foreground italic">Unassigned</span>}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-muted-foreground shrink-0">Stage</dt>
            <dd className="font-medium text-right capitalize">{stageLabel}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function AIPropertyAssessment({ propertyId }: { propertyId: number }) {
  const [assessment, setAssessment] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState("");

  React.useEffect(() => {
    apiClient.get(`/api/portfolio/properties/${propertyId}/ai-assessment`)
      .then(resp => { if (resp.data) setAssessment(resp.data); })
      .catch(() => {})
      .finally(() => setLoadingInitial(false));
  }, [propertyId]);

  const generateAssessment = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await apiClient.post(`/api/portfolio/properties/${propertyId}/ai-assessment`);
      setAssessment(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to generate assessment");
    } finally {
      setLoading(false);
    }
  };

  const [expanded, setExpanded] = useState(false);

  // Parse assessment into numbered sections
  const sections = React.useMemo(() => {
    if (!assessment?.assessment) return [];
    const text = assessment.assessment;
    // Split on ## followed by a digit (section headers)
    const parts = text.split(/(?=## \d)/);
    return parts.map((section: string, idx: number) => {
      const lines = section.trim().split("\n");
      const rawTitle = lines[0]?.replace(/^##\s*/, "").trim() || "";
      // Extract number and title
      const match = rawTitle.match(/^(\d+)\.\s*(.*)/);
      const num = match ? match[1] : String(idx + 1);
      const title = match ? match[2] : rawTitle;
      const body = lines.slice(1).join("\n").trim();
      return { num, title, body };
    }).filter((s: { title: string; body: string }) => s.title && s.body);
  }, [assessment]);

  // executiveSections / detailSections no longer needed — collapsed shows truncated first section

  const communityLabel = assessment?.community_type
    ? assessment.community_type.charAt(0).toUpperCase() + assessment.community_type.slice(1)
    : "";

  return (
    <Card className="border-purple-200/60 shadow-sm overflow-hidden">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className="h-4 w-4" />
              <h3 className="text-sm font-bold tracking-wide uppercase">
                AI Preliminary Property Assessment
              </h3>
            </div>
            {assessment && (
              <p className="text-[11px] text-purple-200">
                {assessment.data_available} data points analyzed
                {assessment.data_missing > 0 && <> · {assessment.data_missing} missing</>}
                {assessment.generated_at && <> · Generated {new Date(assessment.generated_at).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</>}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs gap-1.5 bg-white/15 hover:bg-white/25 text-white border-white/20"
            disabled={loading}
            onClick={generateAssessment}
          >
            {loading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</>
            ) : assessment ? (
              <><RefreshCw className="h-3 w-3" /> Regenerate</>
            ) : (
              <><Sparkles className="h-3 w-3" /> Generate Assessment</>
            )}
          </Button>
        </div>
        {communityLabel && (
          <div className="mt-2">
            <span className="inline-flex items-center text-[10px] font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
              {communityLabel}
            </span>
          </div>
        )}
      </div>

      <CardContent className="p-0">
        {/* Empty state */}
        {!assessment && !loading && !error && (
          <div className="px-5 py-8 text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-3 text-purple-300" />
            <p className="text-sm font-medium text-muted-foreground">No assessment generated yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Generate an AI-powered preliminary assessment that covers property suitability,
              renovation opportunities, development potential, and zoning analysis.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3 border border-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 py-12 justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            <div>
              <p className="text-sm font-medium">Generating comprehensive assessment...</p>
              <p className="text-xs text-muted-foreground">Analyzing property data, zoning, and market context. This may take 15-30 seconds.</p>
            </div>
          </div>
        )}

        {assessment && !loading && (
          <div>
            {/* Calgary Zoning / Rezoning Status Banner */}
            {assessment.zoning_lookup && (
              <div className="px-5 pt-4">
                {(() => {
                  const addr = assessment.zoning_lookup?.address || "";
                  const mapUrl = `https://thecityofcalgary.maps.arcgis.com/apps/instant/lookup/index.html?appid=356547836fa6409dbec74a1dc8d6bd7c#find=${encodeURIComponent(addr)}`;
                  return assessment.zoning_lookup.found ? (
                    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-red-200">
                          <AlertTriangle className="h-4 w-4 text-red-700" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-red-900">
                              Proposed Citywide Zoning Change
                            </p>
                            <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-red-700 hover:text-red-900 underline font-medium shrink-0">
                              View on Map ↗
                            </a>
                          </div>
                          <p className="text-[12px] text-red-800 mt-1.5">
                            This parcel is <strong>proposed to be rezoned</strong> as part of the repeal of citywide rezoning.
                          </p>
                          {assessment.zoning_lookup.address && (
                            <p className="text-[11px] text-red-700 mt-1">
                              Parcel Address: <strong>{assessment.zoning_lookup.address}</strong>
                            </p>
                          )}
                          {assessment.zoning_lookup.legal_description && (
                            <p className="text-[11px] text-red-700 mt-0.5">
                              Legal Description: {assessment.zoning_lookup.legal_description}
                            </p>
                          )}
                          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { label: "Current Zoning", value: assessment.zoning_lookup.current_land_use },
                              { label: "Proposed Rezoning To", value: assessment.zoning_lookup.proposed_land_use },
                              { label: "Rezoning Status", value: assessment.zoning_lookup.rezoning_status },
                              { label: "Transit-Oriented", value: assessment.zoning_lookup.in_tod ? "Yes" : "No" },
                            ].map((item) => (
                              <div key={item.label} className="bg-white/70 rounded px-2.5 py-1.5 border border-red-200">
                                <p className="text-[10px] text-red-600 uppercase tracking-wider">{item.label}</p>
                                <p className="text-sm font-bold text-red-900">{item.value || "—"}</p>
                              </div>
                            ))}
                          </div>
                          {assessment.zoning_lookup.community && (
                            <p className="text-[11px] text-red-600 mt-2">
                              Community: <strong>{assessment.zoning_lookup.community}</strong> · Ward {assessment.zoning_lookup.ward}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-green-200">
                          <CheckCircle2 className="h-4 w-4 text-green-700" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-green-900">Proposed Citywide Zoning Change</p>
                            <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-green-700 hover:text-green-900 underline font-medium shrink-0">
                              Verify on Map ↗
                            </a>
                          </div>
                          <p className="text-[12px] text-green-800 mt-1.5">
                            This parcel was <strong>not part of the citywide rezoning for housing</strong>.
                          </p>
                          {assessment.zoning_lookup.address && (
                            <p className="text-[11px] text-green-700 mt-1">
                              Parcel Address: <strong>{assessment.zoning_lookup.address}</strong>
                            </p>
                          )}
                          {assessment.zoning_lookup.legal_description && (
                            <p className="text-[11px] text-green-700 mt-0.5">
                              Legal Description: {assessment.zoning_lookup.legal_description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Collapsed preview — max ~2 inches, first section only */}
            {!expanded && sections.length > 0 && (
              <div className="px-5 pt-3 pb-1">
                <div className="relative max-h-[120px] overflow-hidden">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold shrink-0">
                      {sections[0].num}
                    </span>
                    <h4 className="text-sm font-bold text-foreground">{sections[0].title}</h4>
                  </div>
                  <div className="pl-7">
                    <div className="text-[13px] text-muted-foreground leading-snug"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownPro(sections[0].body) }}
                    />
                  </div>
                  {/* Fade overlay */}
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                </div>
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 mt-1 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50/50 transition-colors font-medium rounded"
                >
                  <ChevronRight className="h-4 w-4" />
                  Read Full Assessment ({sections.length} sections)
                </button>
              </div>
            )}

            {/* Expanded — all sections */}
            {expanded && sections.length > 0 && (
              <div className="border-t border-border/40">
                <div className="px-5 py-4 space-y-4">
                  {sections.map((section: { num: string; title: string; body: string }) => (
                    <div key={section.num} className={Number(section.num) > 2 ? "border-l-2 border-purple-200 pl-4" : ""}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold shrink-0">
                          {section.num}
                        </span>
                        <h4 className="text-sm font-bold text-foreground">{section.title}</h4>
                      </div>
                      <div className={Number(section.num) <= 2 ? "pl-7" : ""}>
                        <div className="text-[13px] text-muted-foreground leading-snug"
                          dangerouslySetInnerHTML={{ __html: renderMarkdownPro(section.body) }}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Missing Data */}
                  {assessment.missing_fields && assessment.missing_fields.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 mt-3">
                      <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Additional data that would strengthen this assessment:
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {assessment.missing_fields.map((f: string) => (
                          <span key={f} className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setExpanded(false)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Collapse
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="bg-muted/30 px-5 py-2.5 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground italic">
                This assessment is AI-generated based on available property data and should be used for preliminary evaluation only.
                Always verify findings through professional inspection, legal review, and municipal records before making investment decisions.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
