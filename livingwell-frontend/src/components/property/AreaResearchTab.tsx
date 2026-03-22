"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin,
  Search,
  Home,
  DollarSign,
  Building2,
  Users,
  TrendingUp,
  AlertTriangle,
  Landmark,
  ArrowUpRight,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Target,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { ai } from "@/lib/api";
import { AreaResearchMap } from "@/components/property/AreaResearchMap";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ComparableSale {
  address: string;
  lat?: number;
  lng?: number;
  sale_price: number;
  sale_date: string;
  property_type: string;
  bedrooms: number;
  lot_size_sqft: number;
  price_per_sqft: number;
  notes: string;
}

interface ActiveListing {
  address: string;
  lat?: number;
  lng?: number;
  list_price: number;
  property_type: string;
  bedrooms: number;
  days_on_market: number;
  status: string;
}

interface ZoningInfo {
  current_zoning: string;
  zoning_description: string;
  max_density: string;
  max_height: string;
  setback_requirements: string;
  parking_requirements: string;
  permitted_uses: string[];
  discretionary_uses: string[];
}

interface RezoningActivity {
  location: string;
  lat?: number;
  lng?: number;
  from_zone: string;
  to_zone: string;
  status: string;
  application_date: string;
  description: string;
}

interface RentalMarket {
  average_rent_1br: number;
  average_rent_2br: number;
  average_rent_3br: number;
  average_rent_per_bed: number;
  vacancy_rate_pct: number;
  rent_trend: string;
  rent_growth_annual_pct: number;
  notes: string;
}

interface Demographics {
  population: number;
  median_household_income: number;
  median_age: number;
  population_growth_pct: number;
  major_employers: string[];
  transit_access: string;
  walk_score_estimate: number;
}

interface DevelopmentProject {
  project_name: string;
  location: string;
  lat?: number;
  lng?: number;
  type: string;
  units: number | null;
  status: string;
  estimated_completion: string;
  description: string;
}

interface MarketInsights {
  median_home_price: number;
  price_trend: string;
  price_growth_annual_pct: number;
  avg_days_on_market: number;
  absorption_rate: string;
  investment_grade: string;
  opportunity_score: number;
}

interface RiskItem {
  category: string;
  description: string;
  severity: string;
  mitigation: string;
}

interface RedevelopmentPotential {
  score: number;
  rationale: string;
  best_use_recommendation: string;
  estimated_arv: number;
  key_considerations: string[];
}

interface AreaResearchResult {
  address: string;
  city: string;
  radius_miles: number;
  subject_location?: { lat: number; lng: number };
  summary: string;
  comparable_sales?: ComparableSale[];
  active_listings?: ActiveListing[];
  zoning_info?: ZoningInfo;
  rezoning_activity?: RezoningActivity[];
  rental_market?: RentalMarket;
  demographics?: Demographics;
  development_activity?: DevelopmentProject[];
  market_insights?: MarketInsights;
  risks_and_considerations?: RiskItem[];
  redevelopment_potential?: RedevelopmentPotential;
}

/* ── Collapsible Section ───────────────────────────────────────────────── */

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-3 px-4"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {badge}
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>}
    </Card>
  );
}

/* ── Severity Badge ────────────────────────────────────────────────────── */

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  const colors =
    s === "high" || s === "critical"
      ? "bg-red-100 text-red-800 border-red-200"
      : s === "medium"
        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
        : "bg-green-100 text-green-800 border-green-200";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", colors)}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const colors = s.includes("approved") || s.includes("completed")
    ? "bg-green-100 text-green-800"
    : s.includes("pending") || s.includes("under")
      ? "bg-yellow-100 text-yellow-800"
      : s.includes("reduced")
        ? "bg-orange-100 text-orange-800"
        : "bg-blue-100 text-blue-800";
  return <Badge variant="outline" className={cn("text-[10px]", colors)}>{status}</Badge>;
}

/* ── Score Display ─────────────────────────────────────────────────────── */

function ScoreCircle({ score, max = 10, label }: { score: number; max?: number; label: string }) {
  const pct = (score / max) * 100;
  const color = pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("text-2xl font-bold", color)}>
        {score}<span className="text-sm text-muted-foreground">/{max}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ── Trend Display ─────────────────────────────────────────────────────── */

function TrendBadge({ trend }: { trend: string }) {
  const t = trend.toLowerCase();
  const isUp = t.includes("increas") || t.includes("appreciat");
  const isDown = t.includes("decreas") || t.includes("declin");
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs font-medium",
      isUp ? "text-green-600" : isDown ? "text-red-600" : "text-yellow-600"
    )}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : null}
      {trend}
    </span>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

interface AreaResearchTabProps {
  propertyId?: number;
  address?: string;
  city?: string;
  zoning?: string;
}

export function AreaResearchTab({ propertyId, address, city, zoning }: AreaResearchTabProps) {
  const [radius, setRadius] = useState(2);
  const [customAddress, setCustomAddress] = useState(address ?? "");
  const [customCity, setCustomCity] = useState(city ?? "");
  const [result, setResult] = useState<AreaResearchResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      ai.areaResearch({
        ...(propertyId ? { property_id: propertyId } : {}),
        address: customAddress || undefined,
        city: customCity || undefined,
        radius_miles: radius,
        zoning: zoning || undefined,
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success("Area research complete");
    },
    onError: () => {
      toast.error("Failed to generate area research");
    },
  });

  return (
    <div className="space-y-6">
      {/* ── Search Controls ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Area Research
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a comprehensive neighbourhood analysis including comparable sales,
            zoning, rental market data, demographics, and redevelopment potential.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {!propertyId && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={customAddress}
                    onChange={(e) => setCustomAddress(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="Calgary"
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Radius (miles)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0.5}
                  max={25}
                  step={0.5}
                  value={radius}
                  onChange={(e) => setRadius(parseFloat(e.target.value) || 2)}
                  className="w-24"
                />
                <div className="flex gap-1">
                  {[1, 2, 5, 10].map((r) => (
                    <Button
                      key={r}
                      variant={radius === r ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setRadius(r)}
                    >
                      {r}mi
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full sm:w-auto"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Researching Area...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Generate Area Research
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Results ──────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    {result.address}, {result.city} — {result.radius_miles} mile radius
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{result.summary}</p>
                </div>
              </div>

              {/* Quick stats row */}
              {(result.market_insights || result.redevelopment_potential) && (
                <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-blue-200">
                  {result.market_insights && (
                    <>
                      <div className="text-center">
                        <p className="text-lg font-bold">{formatCurrency(result.market_insights.median_home_price)}</p>
                        <p className="text-[10px] text-muted-foreground">Median Home Price</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{result.market_insights.avg_days_on_market}</p>
                        <p className="text-[10px] text-muted-foreground">Avg Days on Market</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{result.market_insights.investment_grade}</p>
                        <p className="text-[10px] text-muted-foreground">Investment Grade</p>
                      </div>
                    </>
                  )}
                  {result.redevelopment_potential && (
                    <div className="text-center">
                      <ScoreCircle score={result.redevelopment_potential.score} label="Redev. Potential" />
                    </div>
                  )}
                  {result.market_insights && (
                    <div className="text-center">
                      <ScoreCircle score={result.market_insights.opportunity_score} label="Opportunity" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interactive Map */}
          <AreaResearchMap
            subjectLocation={result.subject_location}
            address={result.address}
            city={result.city}
            radiusMiles={result.radius_miles}
            comparableSales={result.comparable_sales}
            activeListings={result.active_listings}
            rezoningActivity={result.rezoning_activity}
            developmentActivity={result.development_activity}
            rentalMarket={result.rental_market}
            marketInsights={result.market_insights}
            redevelopmentPotential={result.redevelopment_potential}
          />

          {/* Comparable Sales */}
          {result.comparable_sales && result.comparable_sales.length > 0 && (
            <Section title="Comparable Sales" icon={DollarSign} badge={
              <Badge variant="secondary" className="text-[10px]">{result.comparable_sales.length} comps</Badge>
            }>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Address</TableHead>
                      <TableHead className="text-xs text-right">Sale Price</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Beds</TableHead>
                      <TableHead className="text-xs text-right">$/sqft</TableHead>
                      <TableHead className="text-xs">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.comparable_sales.map((comp, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{comp.address}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{formatCurrency(comp.sale_price)}</TableCell>
                        <TableCell className="text-xs">{comp.sale_date}</TableCell>
                        <TableCell className="text-xs">{comp.property_type}</TableCell>
                        <TableCell className="text-xs text-right">{comp.bedrooms}</TableCell>
                        <TableCell className="text-xs text-right font-mono">${comp.price_per_sqft}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{comp.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Section>
          )}

          {/* Active Listings */}
          {result.active_listings && result.active_listings.length > 0 && (
            <Section title="Active Listings" icon={Home} badge={
              <Badge variant="secondary" className="text-[10px]">{result.active_listings.length} listings</Badge>
            }>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Address</TableHead>
                      <TableHead className="text-xs text-right">List Price</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Beds</TableHead>
                      <TableHead className="text-xs text-right">DOM</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.active_listings.map((listing, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{listing.address}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{formatCurrency(listing.list_price)}</TableCell>
                        <TableCell className="text-xs">{listing.property_type}</TableCell>
                        <TableCell className="text-xs text-right">{listing.bedrooms}</TableCell>
                        <TableCell className="text-xs text-right">{listing.days_on_market}</TableCell>
                        <TableCell><StatusBadge status={listing.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Section>
          )}

          {/* Zoning Information */}
          {result.zoning_info && (
            <Section title="Zoning Information" icon={Landmark}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Current Zoning</p>
                    <p className="text-sm font-semibold">{result.zoning_info.current_zoning}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{result.zoning_info.zoning_description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Max Density</p>
                      <p className="text-sm font-medium">{result.zoning_info.max_density}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max Height</p>
                      <p className="text-sm font-medium">{result.zoning_info.max_height}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Setbacks</p>
                      <p className="text-sm font-medium">{result.zoning_info.setback_requirements}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Parking</p>
                      <p className="text-sm font-medium">{result.zoning_info.parking_requirements}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Permitted Uses</p>
                    <div className="flex flex-wrap gap-1">
                      {result.zoning_info.permitted_uses.map((u, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{u}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Discretionary Uses</p>
                    <div className="flex flex-wrap gap-1">
                      {result.zoning_info.discretionary_uses.map((u, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{u}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Rezoning Activity */}
          {result.rezoning_activity && result.rezoning_activity.length > 0 && (
            <Section title="Rezoning Applications" icon={Landmark} defaultOpen={false}>
              <div className="space-y-3">
                {result.rezoning_activity.map((rz, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{rz.location}</p>
                      <StatusBadge status={rz.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {rz.from_zone} → {rz.to_zone} &middot; Applied {rz.application_date}
                    </p>
                    <p className="text-xs">{rz.description}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Rental Market */}
          {result.rental_market && (
            <Section title="Rental Market" icon={DollarSign}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold">{formatCurrency(result.rental_market.average_rent_1br)}</p>
                      <p className="text-[10px] text-muted-foreground">Avg 1BR Rent/mo</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold">{formatCurrency(result.rental_market.average_rent_2br)}</p>
                      <p className="text-[10px] text-muted-foreground">Avg 2BR Rent/mo</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold">{formatCurrency(result.rental_market.average_rent_3br)}</p>
                      <p className="text-[10px] text-muted-foreground">Avg 3BR Rent/mo</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center bg-blue-50">
                      <p className="text-lg font-bold text-blue-700">{formatCurrency(result.rental_market.average_rent_per_bed)}</p>
                      <p className="text-[10px] text-muted-foreground">Avg Per-Bed Rent</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Vacancy Rate</span>
                    <span className="text-sm font-semibold">{result.rental_market.vacancy_rate_pct}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Rent Trend</span>
                    <TrendBadge trend={result.rental_market.rent_trend} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Annual Rent Growth</span>
                    <span className="text-sm font-semibold">{result.rental_market.rent_growth_annual_pct}%</span>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground">{result.rental_market.notes}</p>
                </div>
              </div>
            </Section>
          )}

          {/* Demographics */}
          {result.demographics && (
            <Section title="Demographics & Accessibility" icon={Users} defaultOpen={false}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Population</p>
                      <p className="text-sm font-semibold">{result.demographics.population.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Median Age</p>
                      <p className="text-sm font-semibold">{result.demographics.median_age}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Median Income</p>
                      <p className="text-sm font-semibold">{formatCurrency(result.demographics.median_household_income)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pop. Growth</p>
                      <p className="text-sm font-semibold">{result.demographics.population_growth_pct}%/yr</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Walk Score (est.)</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            result.demographics.walk_score_estimate >= 70 ? "bg-green-500" :
                            result.demographics.walk_score_estimate >= 50 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${result.demographics.walk_score_estimate}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8">{result.demographics.walk_score_estimate}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Major Employers</p>
                    <div className="flex flex-wrap gap-1">
                      {result.demographics.major_employers.map((e, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{e}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transit Access</p>
                    <p className="text-sm">{result.demographics.transit_access}</p>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Development Activity */}
          {result.development_activity && result.development_activity.length > 0 && (
            <Section title="Nearby Development Activity" icon={Building2} defaultOpen={false} badge={
              <Badge variant="secondary" className="text-[10px]">{result.development_activity.length} projects</Badge>
            }>
              <div className="space-y-3">
                {result.development_activity.map((dev, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{dev.project_name}</p>
                      <StatusBadge status={dev.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dev.location} &middot; {dev.type}
                      {dev.units ? ` &middot; ${dev.units} units` : ""}
                      &middot; Est. {dev.estimated_completion}
                    </p>
                    <p className="text-xs">{dev.description}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Market Insights */}
          {result.market_insights && (
            <Section title="Market Insights" icon={BarChart3}>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{formatCurrency(result.market_insights.median_home_price)}</p>
                  <p className="text-[10px] text-muted-foreground">Median Home Price</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold flex items-center justify-center gap-1">
                    <TrendBadge trend={result.market_insights.price_trend} />
                  </p>
                  <p className="text-[10px] text-muted-foreground">Price Trend</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{result.market_insights.price_growth_annual_pct}%</p>
                  <p className="text-[10px] text-muted-foreground">Annual Growth</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{result.market_insights.avg_days_on_market}</p>
                  <p className="text-[10px] text-muted-foreground">Avg Days on Market</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{result.market_insights.absorption_rate}</p>
                  <p className="text-[10px] text-muted-foreground">Absorption Rate</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{result.market_insights.investment_grade}</p>
                  <p className="text-[10px] text-muted-foreground">Investment Grade</p>
                </div>
              </div>
            </Section>
          )}

          {/* Risks & Considerations */}
          {result.risks_and_considerations && result.risks_and_considerations.length > 0 && (
            <Section title="Risks & Considerations" icon={AlertTriangle} defaultOpen={false}>
              <div className="space-y-3">
                {result.risks_and_considerations.map((risk, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{risk.category}</Badge>
                        <p className="text-sm font-medium">{risk.description}</p>
                      </div>
                      <SeverityBadge severity={risk.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Mitigation:</span> {risk.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Redevelopment Potential */}
          {result.redevelopment_potential && (
            <Section title="Redevelopment Potential" icon={Target}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <ScoreCircle score={result.redevelopment_potential.score} label="Redev. Score" />
                    <div className="flex-1">
                      <p className="text-sm">{result.redevelopment_potential.rationale}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Best Use Recommendation</p>
                    <p className="text-sm font-semibold">{result.redevelopment_potential.best_use_recommendation}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated After-Renovation Value</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(result.redevelopment_potential.estimated_arv)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Key Considerations</p>
                  <ul className="space-y-1.5">
                    {result.redevelopment_potential.key_considerations.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <ChevronRight className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
