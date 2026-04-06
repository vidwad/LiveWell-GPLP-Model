"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCreateProperty } from "@/hooks/usePortfolio";
import { PropertyCreate, DevelopmentStage } from "@/types/portfolio";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Link as LinkIcon, Loader2, Sparkles } from "lucide-react";
import { api, apiClient } from "@/lib/api";
import { PropertyLookup } from "@/components/property/PropertyLookup";
import { PropertyImporter } from "@/components/property/PropertyImporter";

export default function NewPropertyPage() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateProperty();

  const [form, setForm] = useState<PropertyCreate>({
    address: "",
    city: "",
    province: "",
    purchase_date: "",
    purchase_price: 0,
    development_stage: "prospect",
  });

  const [lpOptions, setLpOptions] = useState<{ lp_id: number; name: string }[]>([]);
  const [communityOptions, setCommunityOptions] = useState<{ community_id: number; name: string }[]>([]);
  const [showBuildingDetails, setShowBuildingDetails] = useState(false);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [showMarketDetails, setShowMarketDetails] = useState(false);
  const [estimatedMonthlyRent, setEstimatedMonthlyRent] = useState(0);
  const [listingUrl, setListingUrl] = useState("");
  const [listingPhotoUrls, setListingPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    api.investment.getLPs().then((lps: any[]) => setLpOptions(lps.map(l => ({ lp_id: l.lp_id, name: l.name }))));
    api.communities.getAll().then((cs: any[]) => setCommunityOptions(cs.map(c => ({ community_id: c.community_id, name: c.name }))));
  }, []);

  const set = (k: keyof PropertyCreate, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Coerce numeric fields and strip empty optionals
      const payload = { ...form };
      const numericFields = [
        "purchase_price", "assessed_value", "current_market_value",
        "lot_size", "max_buildable_area", "building_sqft",
        "tax_amount", "list_price", "last_sold_price",
        "latitude", "longitude",
      ] as const;
      for (const f of numericFields) {
        const v = payload[f];
        (payload as Record<string, unknown>)[f] = v ? Number(v) : undefined;
      }
      // Strip empty date/string fields so backend doesn't get ""
      if (!payload.purchase_date) (payload as Record<string, unknown>).purchase_date = undefined;
      payload.lp_id = form.lp_id || undefined;
      payload.community_id = form.community_id || undefined;
      const prop = await mutateAsync(payload);

      // If we have lookup data with bedrooms, auto-initialize the unit structure
      if (form.bedrooms || form.building_sqft) {
        try {
          await api.portfolio.initializeUnits(prop.property_id, {
            bedrooms: Number(form.bedrooms) || 3,
            bathrooms: Number(form.bathrooms) || 1,
            building_sqft: Number(form.building_sqft) || 0,
            estimated_monthly_rent: estimatedMonthlyRent || 0,
          });
          toast.success("Property created with unit structure from lookup data");
        } catch {
          toast.success("Property created (units can be added manually)");
        }
      } else {
        toast.success("Property created");
      }

      // Save listing URL and photo URLs if from import
      if (listingUrl || listingPhotoUrls.length > 0) {
        try {
          await apiClient.post(`/api/portfolio/properties/${prop.property_id}/listing-photos`, null, {
            params: { listing_url: listingUrl, photo_urls: listingPhotoUrls },
          });
        } catch { /* best effort */ }
      }

      router.push(`/portfolio/${prop.property_id}`);
    } catch {
      toast.error("Failed to create property");
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <LinkButton variant="ghost" size="sm" href="/portfolio" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Properties
        </LinkButton>
        <h1 className="text-2xl font-bold">Add Property</h1>
      </div>

      {/* Import from URL or PDF */}
      <div className="mb-6">
        <PropertyImporter onImport={(data) => {
          setForm((f) => {
            const updated = { ...f };
            // Map all matching fields
            const fieldMap: Record<string, string> = {
              address: "address", city: "city", province: "province",
              list_price: "list_price", bedrooms: "bedrooms", bathrooms: "bathrooms",
              building_sqft: "building_sqft", lot_size: "lot_size", year_built: "year_built",
              property_type: "property_type", property_style: "property_style", garage: "garage",
              neighbourhood: "neighbourhood", zoning: "zoning", mls_number: "mls_number",
              tax_amount: "tax_amount", tax_year: "tax_year", latitude: "latitude",
              longitude: "longitude", last_sold_price: "last_sold_price",
              assessed_value: "assessed_value", postal_code: "postal_code",
              storeys: "storeys", building_type: "building_type",
              total_finished_area: "total_finished_area", foundation_type: "foundation_type",
              construction_material: "construction_material", exterior_finish: "exterior_finish",
              basement_type: "basement_type", heating_type: "heating_type",
              cooling_type: "cooling_type", flooring_types: "flooring_types",
              title_type: "title_type", parking_type: "parking_type",
              parking_spaces: "parking_spaces", frontage_m: "frontage_m",
              land_depth_m: "land_depth_m", walk_score: "walk_score",
              transit_score: "transit_score", listing_description: "listing_description",
              appliances: "appliances", structures: "structures",
              has_fencing: "has_fencing", room_dimensions: "room_dimensions",
            };
            for (const [src, dst] of Object.entries(fieldMap)) {
              if (data[src] != null) (updated as any)[dst] = data[src];
            }
            // Use list_price as purchase_price if not set
            if (data.list_price && !f.purchase_price) (updated as any).purchase_price = data.list_price;
            return updated;
          });
          setShowBuildingDetails(true);
          setShowLocationDetails(true);
          setShowMarketDetails(true);
          if (data._source_url) setListingUrl(data._source_url);
          if (data.image_urls && Array.isArray(data.image_urls)) setListingPhotoUrls(data.image_urls);
        }} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Toronto"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Input
                  value={form.province}
                  onChange={(e) => set("province", e.target.value)}
                  placeholder="ON"
                  required
                />
              </div>
            </div>

            {/* Property Data Lookup */}
            {form.address && form.city && (
              <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/30 p-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Auto-populate fields from municipal data, MLS, and AI estimates
                </p>
                <PropertyLookup
                  address={form.address}
                  city={form.city}
                  province={form.province}
                  onApply={(fields) => {
                    // Spread all non-null lookup fields into the form
                    const updates: Record<string, unknown> = {};
                    for (const [k, v] of Object.entries(fields)) {
                      if (v != null) updates[k] = v;
                    }
                    // Capture estimated rent separately (not a property field)
                    if ((fields as Record<string, unknown>).estimated_monthly_rent) {
                      setEstimatedMonthlyRent(Number((fields as Record<string, unknown>).estimated_monthly_rent));
                      delete updates.estimated_monthly_rent;
                    }
                    setForm((f) => ({ ...f, ...updates }));
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>LP Fund</Label>
                <Select
                  value={form.lp_id ? String(form.lp_id) : ""}
                  onValueChange={(v) => set("lp_id", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select LP Fund" />
                  </SelectTrigger>
                  <SelectContent>
                    {lpOptions.map((lp) => (
                      <SelectItem key={lp.lp_id} value={String(lp.lp_id)}>
                        {lp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Community</Label>
                <Select
                  value={form.community_id ? String(form.community_id) : ""}
                  onValueChange={(v) => set("community_id", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Community" />
                  </SelectTrigger>
                  <SelectContent>
                    {communityOptions.map((c) => (
                      <SelectItem key={c.community_id} value={String(c.community_id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => set("purchase_date", e.target.value)}
                  placeholder="Leave blank for prospects"
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase Price (CAD)</Label>
                <Input
                  type="number"
                  value={form.purchase_price || ""}
                  onChange={(e) => set("purchase_price", e.target.value)}
                  placeholder="1000000"
                  min={0}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assessed Value (CAD)</Label>
                <Input
                  type="number"
                  value={form.assessed_value || ""}
                  onChange={(e) => set("assessed_value", e.target.value)}
                  placeholder="600000"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Current Market Value (CAD)</Label>
                <Input
                  type="number"
                  value={form.current_market_value || ""}
                  onChange={(e) => set("current_market_value", e.target.value)}
                  placeholder="700000"
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lot Size (sqft, optional)</Label>
                <Input
                  type="number"
                  value={form.lot_size || ""}
                  onChange={(e) => set("lot_size", e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Buildable Area (sqft, optional)</Label>
                <Input
                  type="number"
                  value={form.max_buildable_area || ""}
                  onChange={(e) => set("max_buildable_area", e.target.value)}
                  placeholder="4000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zoning (optional)</Label>
                <Input
                  value={form.zoning || ""}
                  onChange={(e) => set("zoning", e.target.value)}
                  placeholder="R3"
                />
              </div>
              <div className="space-y-2">
                <Label>Development Stage</Label>
                <Select
                  value={form.development_stage}
                  onValueChange={(v) => set("development_stage", v as DevelopmentStage)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["prospect", "acquisition", "interim_operation", "planning", "construction", "lease_up", "stabilized", "exit"] as DevelopmentStage[]).map((s) => {
                      const labels: Record<string, string> = {
                        prospect: "Prospect", acquisition: "Acquisition", interim_operation: "Interim Operation",
                        planning: "Planning", construction: "Construction", lease_up: "Lease-Up",
                        stabilized: "Stabilized", exit: "Exit",
                      };
                      return (
                        <SelectItem key={s} value={s}>
                          {labels[s] ?? s}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* ── Building Details (collapsible) ── */}
            <button
              type="button"
              onClick={() => setShowBuildingDetails(!showBuildingDetails)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full pt-2"
            >
              {showBuildingDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Building Details
              {(form.year_built || form.property_type || form.bedrooms) && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">populated</span>
              )}
            </button>
            {showBuildingDetails && (
              <div className="space-y-4 pl-6 border-l-2 border-muted">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Year Built</Label>
                    <Input type="number" value={form.year_built || ""} onChange={(e) => set("year_built", e.target.value)} placeholder="2005" />
                  </div>
                  <div className="space-y-2">
                    <Label>Property Type</Label>
                    <Input value={form.property_type || ""} onChange={(e) => set("property_type", e.target.value)} placeholder="Single Family" />
                  </div>
                  <div className="space-y-2">
                    <Label>Style</Label>
                    <Input value={form.property_style || ""} onChange={(e) => set("property_style", e.target.value)} placeholder="Bungalow" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Building sqft</Label>
                    <Input type="number" value={form.building_sqft || ""} onChange={(e) => set("building_sqft", e.target.value)} placeholder="1800" />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Finished sqft</Label>
                    <Input type="number" value={(form as any).total_finished_area || ""} onChange={(e) => set("total_finished_area" as any, e.target.value)} placeholder="Incl. basement" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bedrooms</Label>
                    <Input type="number" value={form.bedrooms || ""} onChange={(e) => set("bedrooms", e.target.value)} placeholder="4" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bathrooms</Label>
                    <Input type="number" value={form.bathrooms || ""} onChange={(e) => set("bathrooms", e.target.value)} placeholder="2" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Storeys</Label>
                    <Input type="number" value={(form as any).storeys || ""} onChange={(e) => set("storeys" as any, e.target.value)} placeholder="1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Garage</Label>
                    <Input value={form.garage || ""} onChange={(e) => set("garage", e.target.value)} placeholder="Double Attached" />
                  </div>
                  <div className="space-y-2">
                    <Label>Parking Spaces</Label>
                    <Input type="number" value={(form as any).parking_spaces || ""} onChange={(e) => set("parking_spaces" as any, e.target.value)} placeholder="2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Parking Type</Label>
                    <Input value={(form as any).parking_type || ""} onChange={(e) => set("parking_type" as any, e.target.value)} placeholder="Parking Pad" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Basement Type</Label>
                    <Input value={(form as any).basement_type || ""} onChange={(e) => set("basement_type" as any, e.target.value)} placeholder="Full Finished" />
                  </div>
                  <div className="space-y-2">
                    <Label>Foundation</Label>
                    <Input value={(form as any).foundation_type || ""} onChange={(e) => set("foundation_type" as any, e.target.value)} placeholder="Poured Concrete" />
                  </div>
                  <div className="space-y-2">
                    <Label>Construction</Label>
                    <Input value={(form as any).construction_material || ""} onChange={(e) => set("construction_material" as any, e.target.value)} placeholder="Wood frame" />
                  </div>
                  <div className="space-y-2">
                    <Label>Exterior</Label>
                    <Input value={(form as any).exterior_finish || ""} onChange={(e) => set("exterior_finish" as any, e.target.value)} placeholder="Vinyl siding" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Heating</Label>
                    <Input value={(form as any).heating_type || ""} onChange={(e) => set("heating_type" as any, e.target.value)} placeholder="Forced air, Natural gas" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cooling</Label>
                    <Input value={(form as any).cooling_type || ""} onChange={(e) => set("cooling_type" as any, e.target.value)} placeholder="Central air" />
                  </div>
                  <div className="space-y-2">
                    <Label>Title Type</Label>
                    <Input value={(form as any).title_type || ""} onChange={(e) => set("title_type" as any, e.target.value)} placeholder="Freehold" />
                  </div>
                  <div className="space-y-2">
                    <Label>Postal Code</Label>
                    <Input value={(form as any).postal_code || ""} onChange={(e) => set("postal_code" as any, e.target.value)} placeholder="T3B0H5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frontage (m)</Label>
                    <Input type="number" step="0.01" value={(form as any).frontage_m || ""} onChange={(e) => set("frontage_m" as any, e.target.value)} placeholder="15.24" />
                  </div>
                  <div className="space-y-2">
                    <Label>Depth (m)</Label>
                    <Input type="number" step="0.01" value={(form as any).land_depth_m || ""} onChange={(e) => set("land_depth_m" as any, e.target.value)} placeholder="36.57" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Location & Municipal (collapsible) ── */}
            <button
              type="button"
              onClick={() => setShowLocationDetails(!showLocationDetails)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full"
            >
              {showLocationDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Location & Municipal Data
              {(form.neighbourhood || form.latitude || form.roll_number) && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">populated</span>
              )}
            </button>
            {showLocationDetails && (
              <div className="space-y-4 pl-6 border-l-2 border-muted">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Neighbourhood</Label>
                    <Input value={form.neighbourhood || ""} onChange={(e) => set("neighbourhood", e.target.value)} placeholder="Beltline" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ward</Label>
                    <Input value={form.ward || ""} onChange={(e) => set("ward", e.target.value)} placeholder="8" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Legal Description</Label>
                    <Input value={form.legal_description || ""} onChange={(e) => set("legal_description", e.target.value)} placeholder="Plan 1234AB Block 5 Lot 10" />
                  </div>
                  <div className="space-y-2">
                    <Label>Roll Number</Label>
                    <Input value={form.roll_number || ""} onChange={(e) => set("roll_number", e.target.value)} placeholder="0123456789" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input type="number" step="any" value={form.latitude || ""} onChange={(e) => set("latitude", e.target.value)} placeholder="51.0447" />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input type="number" step="any" value={form.longitude || ""} onChange={(e) => set("longitude", e.target.value)} placeholder="-114.0719" />
                  </div>
                  <div className="space-y-2">
                    <Label>Assessment Class</Label>
                    <Input value={form.assessment_class || ""} onChange={(e) => set("assessment_class", e.target.value)} placeholder="Residential" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tax Amount (CAD)</Label>
                    <Input type="number" value={form.tax_amount || ""} onChange={(e) => set("tax_amount", e.target.value)} placeholder="3500" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Year</Label>
                    <Input type="number" value={form.tax_year || ""} onChange={(e) => set("tax_year", e.target.value)} placeholder="2025" />
                  </div>
                </div>
              </div>
            )}

            {/* ── MLS / Market Data (collapsible) ── */}
            <button
              type="button"
              onClick={() => setShowMarketDetails(!showMarketDetails)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full"
            >
              {showMarketDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              MLS & Market Data
              {(form.mls_number || form.list_price || form.last_sold_price) && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">populated</span>
              )}
            </button>
            {showMarketDetails && (
              <div className="space-y-4 pl-6 border-l-2 border-muted">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>MLS Number</Label>
                    <Input value={form.mls_number || ""} onChange={(e) => set("mls_number", e.target.value)} placeholder="A2012345" />
                  </div>
                  <div className="space-y-2">
                    <Label>List Price (CAD)</Label>
                    <Input type="number" value={form.list_price || ""} onChange={(e) => set("list_price", e.target.value)} placeholder="550000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Last Sold Price (CAD)</Label>
                    <Input type="number" value={form.last_sold_price || ""} onChange={(e) => set("last_sold_price", e.target.value)} placeholder="500000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Sold Date</Label>
                    <Input type="date" value={form.last_sold_date || ""} onChange={(e) => set("last_sold_date", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Property"}
              </Button>
              <LinkButton variant="outline" href="/portfolio">Cancel</LinkButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Listing Import Card ──────────────────────────────────────────────

function ListingImportCard({ onImport }: { onImport: (data: Record<string, any>) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");

  const handleExtract = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const resp = await apiClient.post("/api/portfolio/extract-listing", { url: url.trim() });
      const data = resp.data?.extracted || {};
      if (Object.keys(data).length === 0) {
        setError("Could not extract property data from this URL. Try a different listing.");
        return;
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to extract listing data");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onImport({ ...result, _source_url: url });
      setResult(null);
      setUrl("");
    }
  };

  const fieldCount = result ? Object.keys(result).filter(k => result[k] != null).length : 0;

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          Import from Listing URL
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Paste a Realtor.ca, Zillow, or other listing URL to auto-fill property details using AI
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.realtor.ca/real-estate/..."
              className="pl-9"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleExtract(); } }}
            />
          </div>
          <Button onClick={handleExtract} disabled={loading || !url.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Extracting...</> : "Extract"}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>
        )}

        {result && (
          <div className="rounded-lg border bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-green-700">
                Found {fieldCount} fields from listing
              </span>
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={handleApply}>
                Apply to Form
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {result.address && <div><span className="text-muted-foreground">Address:</span> <span className="font-medium">{result.address}</span></div>}
              {result.city && <div><span className="text-muted-foreground">City:</span> <span className="font-medium">{result.city}</span></div>}
              {result.list_price && <div><span className="text-muted-foreground">Price:</span> <span className="font-medium">${Number(result.list_price).toLocaleString()}</span></div>}
              {result.bedrooms && <div><span className="text-muted-foreground">Beds:</span> <span className="font-medium">{result.bedrooms}</span></div>}
              {result.bathrooms && <div><span className="text-muted-foreground">Baths:</span> <span className="font-medium">{result.bathrooms}</span></div>}
              {result.building_sqft && <div><span className="text-muted-foreground">Sqft:</span> <span className="font-medium">{Number(result.building_sqft).toLocaleString()}</span></div>}
              {result.year_built && <div><span className="text-muted-foreground">Built:</span> <span className="font-medium">{result.year_built}</span></div>}
              {result.property_type && <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{result.property_type}</span></div>}
              {result.lot_size && <div><span className="text-muted-foreground">Lot:</span> <span className="font-medium">{Number(result.lot_size).toLocaleString()} sqft</span></div>}
              {result.neighbourhood && <div><span className="text-muted-foreground">Area:</span> <span className="font-medium">{result.neighbourhood}</span></div>}
              {result.mls_number && <div><span className="text-muted-foreground">MLS:</span> <span className="font-medium">{result.mls_number}</span></div>}
              {result.tax_amount && <div><span className="text-muted-foreground">Tax:</span> <span className="font-medium">${Number(result.tax_amount).toLocaleString()}/yr</span></div>}
            </div>
            {result.description && (
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{result.description}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
