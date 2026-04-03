"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Check,
  Database,
  MapPin,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, cn } from "@/lib/utils";
import { portfolio } from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface LookupResult {
  address: string;
  city: string;
  province: string;
  sources_used: string[];
  assessed_value: number | null;
  current_market_value: number | null;
  lot_size: number | null;
  zoning: string | null;
  max_buildable_area: number | null;
  floor_area_ratio: number | null;
  year_built: string | null;
  property_type: string | null;
  property_style: string | null;
  building_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garage: string | null;
  legal_description: string | null;
  neighbourhood: string | null;
  ward: string | null;
  roll_number: string | null;
  assessment_class: string | null;
  mls_number: string | null;
  list_price: number | null;
  last_sold_price: number | null;
  last_sold_date: string | null;
  days_on_market: number | null;
  listing_status: string | null;
  listing_url: string | null;
  tax_amount: number | null;
  tax_year: string | null;
  estimated_monthly_rent: number | null;
  estimated_rent_per_bed: number | null;
  latitude: number | null;
  longitude: number | null;
  recommended_units: number | null;
  estimated_cost_per_sqft: number | null;
  development_reasoning: string | null;
}

/* ── Applicable fields to property form ─────────────────────────────── */

interface ApplicableFields {
  assessed_value?: number;
  current_market_value?: number;
  lot_size?: number;
  zoning?: string;
  max_buildable_area?: number;
  floor_area_ratio?: number;
  year_built?: number;
  property_type?: string;
  property_style?: string;
  building_sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  garage?: string;
  neighbourhood?: string;
  ward?: string;
  legal_description?: string;
  latitude?: number;
  longitude?: number;
  roll_number?: string;
  assessment_class?: string;
  tax_amount?: number;
  tax_year?: number;
  mls_number?: string;
  list_price?: number;
  last_sold_price?: number;
  last_sold_date?: string;
}

/* ── Source Icon ────────────────────────────────────────────────────────── */

function SourceBadge({ source }: { source: string }) {
  const s = (source || "").toLowerCase();
  const isAI = s.includes("ai");
  const isMLS = s.includes("mls") || s.includes("repliers");
  const isCity = s.includes("city") || s.includes("calgary") || s.includes("edmonton");

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] gap-1",
        isAI && "bg-purple-100 text-purple-800",
        isMLS && "bg-blue-100 text-blue-800",
        isCity && "bg-green-100 text-green-800"
      )}
    >
      {isCity && <Database className="h-2.5 w-2.5" />}
      {isMLS && <ExternalLink className="h-2.5 w-2.5" />}
      {isAI && <Sparkles className="h-2.5 w-2.5" />}
      {source}
    </Badge>
  );
}

/* ── Data Row ──────────────────────────────────────────────────────────── */

function DataRow({
  label,
  value,
  format,
}: {
  label: string;
  value: string | number | null | undefined;
  format?: "currency" | "sqft" | "percent";
}) {
  if (value === null || value === undefined) return null;

  let formatted: string;
  if (format === "currency" && typeof value === "number") {
    formatted = formatCurrency(value);
  } else if (format === "sqft" && typeof value === "number") {
    formatted = `${value.toLocaleString()} sqft`;
  } else if (format === "percent" && typeof value === "number") {
    formatted = `${value}`;
  } else {
    formatted = String(value);
  }

  return (
    <div className="flex justify-between items-baseline py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold">{formatted}</span>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

interface PropertyLookupProps {
  address?: string;
  city?: string;
  province?: string;
  onApply?: (fields: ApplicableFields) => void;
  mode?: "button" | "inline";
}

export function PropertyLookup({
  address: initialAddress,
  city: initialCity,
  province: initialProvince,
  onApply,
  mode = "button",
}: PropertyLookupProps) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(initialAddress ?? "");
  const [city, setCity] = useState(initialCity ?? "Calgary");
  const [province, setProvince] = useState(initialProvince ?? "AB");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Sync with parent props when they change
  React.useEffect(() => { if (initialAddress) setAddress(initialAddress); }, [initialAddress]);
  React.useEffect(() => { if (initialCity) setCity(initialCity); }, [initialCity]);
  React.useEffect(() => { if (initialProvince) setProvince(initialProvince); }, [initialProvince]);

  const mutation = useMutation({
    mutationFn: () => portfolio.lookupProperty({ address, city, province }),
    onSuccess: (data: LookupResult) => {
      setResult(data);
      if (data.sources_used.length === 0) {
        toast.info("No external data found for this address");
      } else {
        toast.success(
          `Found data from ${data.sources_used.length} source${data.sources_used.length > 1 ? "s" : ""}`
        );
      }
    },
    onError: () => {
      toast.error("Property lookup failed");
    },
  });

  const handleApply = () => {
    if (!result || !onApply) return;

    const fields: ApplicableFields = {};
    if (result.assessed_value) fields.assessed_value = result.assessed_value;
    if (result.current_market_value) fields.current_market_value = result.current_market_value;
    if (result.lot_size) fields.lot_size = result.lot_size;
    if (result.zoning) fields.zoning = result.zoning;
    if (result.max_buildable_area) fields.max_buildable_area = result.max_buildable_area;
    if (result.floor_area_ratio) fields.floor_area_ratio = result.floor_area_ratio;
    if (result.year_built) fields.year_built = Number(result.year_built);
    if (result.property_type) fields.property_type = result.property_type;
    if (result.property_style) fields.property_style = result.property_style;
    if (result.building_sqft) fields.building_sqft = result.building_sqft;
    if (result.bedrooms) fields.bedrooms = result.bedrooms;
    if (result.bathrooms) fields.bathrooms = result.bathrooms;
    if (result.garage) fields.garage = result.garage;
    if (result.neighbourhood) fields.neighbourhood = result.neighbourhood;
    if (result.ward) fields.ward = result.ward;
    if (result.legal_description) fields.legal_description = result.legal_description;
    if (result.latitude) fields.latitude = result.latitude;
    if (result.longitude) fields.longitude = result.longitude;
    if (result.roll_number) fields.roll_number = result.roll_number;
    if (result.assessment_class) fields.assessment_class = result.assessment_class;
    if (result.tax_amount) fields.tax_amount = result.tax_amount;
    if (result.tax_year) fields.tax_year = Number(result.tax_year);
    if (result.mls_number) fields.mls_number = result.mls_number;
    if (result.list_price) fields.list_price = result.list_price;
    if (result.last_sold_price) fields.last_sold_price = result.last_sold_price;
    if (result.last_sold_date) fields.last_sold_date = result.last_sold_date;
    if (result.estimated_monthly_rent) (fields as Record<string, unknown>).estimated_monthly_rent = result.estimated_monthly_rent;

    onApply(fields);
    toast.success("Property fields updated from lookup data");
    setOpen(false);
  };

  // Count how many applicable fields have data
  const applicableCount = result
    ? [
        result.assessed_value, result.current_market_value, result.lot_size,
        result.zoning, result.max_buildable_area, result.floor_area_ratio,
        result.year_built, result.property_type, result.building_sqft,
        result.bedrooms, result.bathrooms, result.neighbourhood,
        result.legal_description, result.latitude, result.tax_amount,
        result.mls_number, result.list_price, result.last_sold_price,
      ].filter((v) => v !== null && v !== undefined).length
    : 0;

  const content = (
    <div className="space-y-4">
      {/* Search */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs">Address</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St NW"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City</Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Calgary"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Province</Label>
          <Input
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="AB"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !address.trim()}
          className="flex-1 sm:flex-initial"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Looking up...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Look Up Property
            </>
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground hidden sm:block">
          Searches municipal data, MLS (if configured), and AI estimates
        </p>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Sources */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Data from:</span>
            {result.sources_used.length > 0 ? (
              result.sources_used.map((src, i) => (
                <SourceBadge key={i} source={src} />
              ))
            ) : (
              <Badge variant="outline" className="text-[10px] text-gray-400">
                <AlertCircle className="h-2.5 w-2.5 mr-1" />
                No external data found
              </Badge>
            )}
          </div>

          {/* Development Plan Suggestions */}
          {(result.recommended_units || result.estimated_cost_per_sqft) && (
            <Card className="border-purple-200 bg-purple-50/30">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  AI Development Plan Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1">
                <DataRow label="Recommended Units" value={result.recommended_units} />
                <DataRow label="Est. Construction Cost" value={result.estimated_cost_per_sqft ? `$${result.estimated_cost_per_sqft}/sqft` : null} />
                {result.development_reasoning && (
                  <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
                    {result.development_reasoning}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Property Details */}
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-0">
                <DataRow label="Assessed Value" value={result.assessed_value} format="currency" />
                <DataRow label="Market Value" value={result.current_market_value} format="currency" />
                <DataRow label="Lot Size" value={result.lot_size} format="sqft" />
                <DataRow label="Building Size" value={result.building_sqft} format="sqft" />
                <DataRow label="Zoning" value={result.zoning} />
                <DataRow label="Max Buildable Area" value={result.max_buildable_area} format="sqft" />
                <DataRow label="FAR" value={result.floor_area_ratio} />
                <DataRow label="Year Built" value={result.year_built} />
                <DataRow label="Type" value={result.property_type} />
                <DataRow label="Style" value={result.property_style} />
                <DataRow label="Bedrooms" value={result.bedrooms} />
                <DataRow label="Bathrooms" value={result.bathrooms} />
                <DataRow label="Garage" value={result.garage} />
                <DataRow label="Neighbourhood" value={result.neighbourhood} />
                <DataRow label="Ward" value={result.ward} />
                <DataRow label="Legal" value={result.legal_description} />
                <DataRow label="Roll #" value={result.roll_number} />
                <DataRow label="Assessment Class" value={result.assessment_class} />
              </CardContent>
            </Card>

            {/* Market / MLS Data */}
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Market & Listing Data
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-0">
                <DataRow label="MLS #" value={result.mls_number} />
                <DataRow label="List Price" value={result.list_price} format="currency" />
                <DataRow label="Last Sold Price" value={result.last_sold_price} format="currency" />
                <DataRow label="Last Sold Date" value={result.last_sold_date} />
                <DataRow label="Days on Market" value={result.days_on_market} />
                <DataRow label="Status" value={result.listing_status} />
                {result.listing_url && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Listing</span>
                    <a
                      href={result.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}

                <Separator className="my-2" />

                <DataRow label="Tax Amount" value={result.tax_amount} format="currency" />
                <DataRow label="Tax Year" value={result.tax_year} />

                <Separator className="my-2" />

                <DataRow
                  label="Est. Monthly Rent"
                  value={result.estimated_monthly_rent}
                  format="currency"
                />
                <DataRow
                  label="Est. Rent Per Bed"
                  value={result.estimated_rent_per_bed}
                  format="currency"
                />
              </CardContent>
            </Card>
          </div>

          {/* Apply Button */}
          {onApply && applicableCount > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <div>
                <p className="text-sm font-medium">
                  {applicableCount} fields can be applied to the property
                </p>
                <p className="text-xs text-muted-foreground">
                  This will update assessed value, market value, lot size, zoning, buildable area,
                  and FAR
                </p>
              </div>
              <Button onClick={handleApply} className="gap-1.5">
                <Check className="h-4 w-4" />
                Apply to Property
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (mode === "inline") {
    return content;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* @ts-expect-error radix-ui asChild type */}
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Look Up Property Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Property Data Lookup
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
