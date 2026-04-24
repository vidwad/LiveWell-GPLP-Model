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
import { ai, apiClient } from "@/lib/api";
import { FileText, Download } from "lucide-react";
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

interface DataSources {
  // New multi-city fields
  municipal_open_data?: boolean;
  municipal_source?: string;
  realtor_board?: string;
  realtor_web_search?: boolean;
  cmhc_web_search?: boolean;
  community_identified?: string | null;
  dev_permits_found?: number;
  bldg_permits_found?: number;
  // Legacy Calgary-only fields (backwards compat)
  calgary_open_data?: boolean;
  creb_web_search?: boolean;
}

interface AreaResearchResult {
  address: string;
  city: string;
  radius_miles: number;
  data_source?: string;
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
  data_sources?: DataSources;
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

/* ── Source Tag (shows where data came from) ──────────────────────────── */

function SourceTag({ type }: { type: "municipal" | "web_search" | "ai_analysis" | "cmhc" }) {
  const config = {
    municipal: { label: "Municipal Open Data", color: "bg-green-100 text-green-700 border-green-200", icon: "🏛️" },
    web_search: { label: "Web Search", color: "bg-amber-100 text-amber-700 border-amber-200", icon: "🔍" },
    ai_analysis: { label: "AI Analysis", color: "bg-purple-100 text-purple-700 border-purple-200", icon: "🤖" },
    cmhc: { label: "CMHC / Market Data", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "📊" },
  };
  const c = config[type];
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] font-medium", c.color)}>
      {c.icon} {c.label}
    </span>
  );
}

/* ── Severity Badge ────────────────────────────────────────────────────── */

function SeverityBadge({ severity }: { severity: string }) {
  const s = (severity || "low").toLowerCase();
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
  const s = (status || "").toLowerCase();
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
  const t = (trend || "stable").toLowerCase();
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
  latitude?: number;
  longitude?: number;
}

export function AreaResearchTab({ propertyId, address, city, zoning, latitude, longitude }: AreaResearchTabProps) {
  const [radius, setRadius] = useState(2);
  const [customAddress, setCustomAddress] = useState(address ?? "");
  const [customCity, setCustomCity] = useState(city ?? "");
  const [result, setResult] = useState<AreaResearchResult | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Load saved area research on mount
  React.useEffect(() => {
    if (!propertyId) return;
    setLoadingSaved(true);
    ai.getSavedAreaResearch(propertyId)
      .then((saved) => {
        if (saved?.data) {
          setResult(saved.data);
          setLastUpdated(saved.updated_at);
          if (saved.data.radius_miles) setRadius(saved.data.radius_miles);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, [propertyId]);

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
      setLastUpdated(new Date().toISOString());
      // Auto-save to database
      if (propertyId) {
        ai.saveAreaResearch(propertyId, { data, radius_miles: radius })
          .then(() => toast.success("Area research complete and saved"))
          .catch(() => toast.success("Area research complete (save failed)"));
      } else {
        toast.success("Area research complete");
      }
    },
    onError: () => {
      toast.error("Failed to generate area research");
    },
  });

  // ── PDF report generation (Manus primary, Claude fallback) ──────────────
  const [reportJobId, setReportJobId] = useState<number | null>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportEngine, setReportEngine] = useState<string | null>(null);

  React.useEffect(() => {
    if (!reportJobId || !propertyId) return;
    if (reportStatus === "completed" || reportStatus === "failed") return;
    const handle = setInterval(async () => {
      try {
        const { data } = await apiClient.get(
          `/api/portfolio/${propertyId}/area-report/${reportJobId}`,
        );
        setReportStatus(data.status);
        setReportEngine(data.engine);
        if (data.error) setReportError(data.error);
        if (data.status === "completed") {
          toast.success(`Report ready${data.engine ? ` (${data.engine})` : ""}`);
        } else if (data.status === "failed") {
          toast.error("Report generation failed");
        }
      } catch {
        // keep polling; transient errors happen
      }
    }, 4000);
    return () => clearInterval(handle);
  }, [reportJobId, reportStatus, propertyId]);

  const generateReport = async () => {
    if (!propertyId) return;
    try {
      setReportError(null);
      setReportEngine(null);
      const { data } = await apiClient.post(
        `/api/portfolio/${propertyId}/area-report/generate`,
      );
      setReportJobId(data.job_id);
      setReportStatus(data.status || "pending");
      toast.info("Generating report — this takes up to 8 minutes");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to start report");
    }
  };

  const downloadReport = () => {
    if (!propertyId || !reportJobId) return;
    window.open(
      `/api/portfolio/${propertyId}/area-report/${reportJobId}/pdf`,
      "_blank",
    );
  };

  const reportInFlight = reportStatus && !["completed", "failed"].includes(reportStatus);

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

          <div className="flex flex-wrap gap-2">
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
                  {result ? "Refresh Research" : "Generate Area Research"}
                </>
              )}
            </Button>

            {/* Print Report — only appears after research exists */}
            {result && propertyId && (
              <>
                {reportStatus === "completed" ? (
                  <Button
                    variant="outline"
                    onClick={downloadReport}
                    className="w-full sm:w-auto"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF Report
                    {reportEngine && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {reportEngine}
                      </Badge>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={generateReport}
                    disabled={!!reportInFlight}
                    className="w-full sm:w-auto"
                  >
                    {reportInFlight ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {reportStatus === "gathering"
                          ? "Gathering data..."
                          : reportStatus === "synthesizing"
                          ? "Synthesizing report..."
                          : reportStatus === "rendering"
                          ? "Rendering PDF..."
                          : "Preparing..."}
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Print Report
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
          {reportStatus === "failed" && reportError && (
            <p className="text-xs text-red-600 mt-2">Report failed: {reportError}</p>
          )}
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-2">
              <Clock className="inline h-3 w-3 mr-1" />
              Last updated: {new Date(lastUpdated).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {loadingSaved && (
            <p className="text-xs text-muted-foreground mt-2">
              <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
              Loading saved research...
            </p>
          )}
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

              {/* Data Sources */}
              {result.data_sources && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(result.data_sources.municipal_open_data || result.data_sources.calgary_open_data) && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-300">
                      {result.data_sources.municipal_source || "City of Calgary Open Data"}
                    </Badge>
                  )}
                  {(result.data_sources.realtor_web_search || result.data_sources.creb_web_search) && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                      {result.data_sources.realtor_board || "CREB"} / MLS
                    </Badge>
                  )}
                  {result.data_sources.cmhc_web_search && (
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300">
                      CMHC Rental Survey
                    </Badge>
                  )}
                  {result.data_sources.community_identified && (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-300">
                      {result.data_sources.community_identified}
                    </Badge>
                  )}
                  {(result.data_sources.dev_permits_found ?? 0) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {result.data_sources.dev_permits_found} dev permits
                    </Badge>
                  )}
                  {(result.data_sources.bldg_permits_found ?? 0) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {result.data_sources.bldg_permits_found} bldg permits
                    </Badge>
                  )}
                </div>
              )}

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
            subjectLocation={
              latitude && longitude
                ? { lat: latitude, lng: longitude }
                : result.subject_location
            }
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
              <div className="flex items-center gap-1.5"><SourceTag type="web_search" /><Badge variant="secondary" className="text-[10px]">{result.comparable_sales.length} comps</Badge></div>
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
              <div className="flex items-center gap-1.5"><SourceTag type="web_search" /><Badge variant="secondary" className="text-[10px]">{result.active_listings.length} listings</Badge></div>
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
            <Section title="Zoning Information" icon={Landmark} badge={<SourceTag type="municipal" />}>
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
            <Section title="Rezoning Applications" icon={Landmark} defaultOpen={false} badge={<SourceTag type="municipal" />}>
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
            <Section title="Rental Market" icon={DollarSign} badge={<SourceTag type="cmhc" />}>
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
            <Section title="Demographics & Accessibility" icon={Users} defaultOpen={false} badge={<SourceTag type="municipal" />}>
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
              <div className="flex items-center gap-1.5"><SourceTag type="municipal" /><Badge variant="secondary" className="text-[10px]">{result.development_activity.length} projects</Badge></div>
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
            <Section title="Market Insights" icon={BarChart3} badge={<SourceTag type="ai_analysis" />}>
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
            <Section title="Risks & Considerations" icon={AlertTriangle} defaultOpen={false} badge={<SourceTag type="ai_analysis" />}>
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
            <Section title="Redevelopment Potential" icon={Target} badge={<SourceTag type="ai_analysis" />}>
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

          {/* Walk Scores */}
          {result.walk_scores && (result.walk_scores.walk_score || result.walk_scores.transit_score) && (
            <Section title="Walk Score & Accessibility" icon={MapPin} badge={<SourceTag type="municipal" />}>
              <div className="grid grid-cols-3 gap-4">
                {result.walk_scores.walk_score != null && (
                  <div className="text-center rounded-lg border p-3">
                    <div className={cn("text-3xl font-bold", result.walk_scores.walk_score >= 70 ? "text-green-600" : result.walk_scores.walk_score >= 50 ? "text-amber-600" : "text-red-500")}>
                      {result.walk_scores.walk_score}
                    </div>
                    <p className="text-xs font-medium mt-1">Walk Score</p>
                    <p className="text-[10px] text-muted-foreground">{result.walk_scores.walk_description}</p>
                  </div>
                )}
                {result.walk_scores.transit_score != null && (
                  <div className="text-center rounded-lg border p-3">
                    <div className={cn("text-3xl font-bold", result.walk_scores.transit_score >= 70 ? "text-green-600" : result.walk_scores.transit_score >= 50 ? "text-amber-600" : "text-red-500")}>
                      {result.walk_scores.transit_score}
                    </div>
                    <p className="text-xs font-medium mt-1">Transit Score</p>
                    <p className="text-[10px] text-muted-foreground">{result.walk_scores.transit_description}</p>
                  </div>
                )}
                {result.walk_scores.bike_score != null && (
                  <div className="text-center rounded-lg border p-3">
                    <div className={cn("text-3xl font-bold", result.walk_scores.bike_score >= 70 ? "text-green-600" : result.walk_scores.bike_score >= 50 ? "text-amber-600" : "text-red-500")}>
                      {result.walk_scores.bike_score}
                    </div>
                    <p className="text-xs font-medium mt-1">Bike Score</p>
                    <p className="text-[10px] text-muted-foreground">{result.walk_scores.bike_description}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Nearby Amenities */}
          {result.nearby_amenities && Object.keys(result.nearby_amenities).some(k => (result.nearby_amenities[k] || []).length > 0) && (
            <Section title="Nearby Amenities" icon={MapPin} defaultOpen={false} badge={<SourceTag type="municipal" />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(result.nearby_amenities).map(([category, items]: [string, any]) => (
                  items && items.length > 0 && (
                    <div key={category} className="space-y-1">
                      <p className="text-xs font-semibold capitalize">{category}</p>
                      {items.slice(0, 3).map((place: any, i: number) => (
                        <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="truncate">{place.name}</span>
                          {place.rating && <span className="text-amber-500 shrink-0">★ {place.rating}</span>}
                        </div>
                      ))}
                    </div>
                  )
                ))}
              </div>
            </Section>
          )}

          {/* Crime & Safety */}
          {result.crime_safety && result.crime_safety.summary && (
            <Section title="Crime & Safety" icon={AlertTriangle} defaultOpen={false} badge={<SourceTag type="web_search" />}>
              <p className="text-xs text-muted-foreground">{result.crime_safety.summary}</p>
              {result.crime_safety.crime_rate_trend && (
                <p className="text-xs mt-1"><span className="font-medium">Trend:</span> {result.crime_safety.crime_rate_trend}</p>
              )}
              {result.crime_safety.notable_stats && result.crime_safety.notable_stats.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {result.crime_safety.notable_stats.map((stat: string, i: number) => (
                    <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                      <span className="text-muted-foreground/50 mt-0.5">•</span> {stat}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
