"use client";

import React, { useState } from "react";
import { MapPin, DollarSign, Calendar, Building2, Landmark, TrendingUp, Pencil, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PropertyLookup } from "@/components/property/PropertyLookup";
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
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
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
          </CardContent>
        </Card>

        {/* Financial Snapshot */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Financial Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              {activePlan && (
                <>
                  <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Construction Cost</dt>
                    <dd className="font-medium text-right tabular-nums whitespace-nowrap">{activePlan.estimated_construction_cost ? formatCurrencyCompact(activePlan.estimated_construction_cost) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground shrink-0">Annual NOI</dt>
                    <dd className="font-semibold text-right text-green-600 tabular-nums whitespace-nowrap">{activePlan.projected_annual_noi ? formatCurrencyCompact(activePlan.projected_annual_noi) : "—"}</dd>
                  </div>
                </>
              )}
              {!activePlan && (
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Development Plan</dt>
                  <dd className="text-muted-foreground italic">No active plan</dd>
                </div>
              )}
            </dl>
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
