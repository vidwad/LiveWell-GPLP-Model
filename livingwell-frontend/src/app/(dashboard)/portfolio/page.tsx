"use client";

import Link from "next/link";
import {
  Plus, Building2, Search, X, SlidersHorizontal, LayoutGrid, List, MapPin,
  ArrowUpDown, DollarSign, TrendingUp, Home, BedDouble, ChevronDown, ChevronUp,
  Layers,
} from "lucide-react";
import { AddPropertyWizard } from "@/components/property/AddPropertyWizard";
import { useProperties } from "@/hooks/usePortfolio";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/utils";
import { DevelopmentStage, Property } from "@/types/portfolio";
import { useState, useMemo, useCallback, Fragment } from "react";

/* ── stage config ─────────────────────────────────────────────── */
const STAGE_COLORS: Record<DevelopmentStage, string> = {
  prospect: "bg-gray-100 text-gray-800",
  acquisition: "bg-blue-100 text-blue-800",
  interim_operation: "bg-cyan-100 text-cyan-800",
  planning: "bg-yellow-100 text-yellow-800",
  permit: "bg-violet-100 text-violet-800",
  construction: "bg-orange-100 text-orange-800",
  lease_up: "bg-purple-100 text-purple-800",
  stabilized: "bg-green-100 text-green-800",
  exit: "bg-gray-100 text-gray-800",
};

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  acquisition: "Acquisition",
  interim_operation: "Interim Operation",
  planning: "Planning",
  permit: "Permit",
  construction: "Construction",
  lease_up: "Lease-Up",
  stabilized: "Stabilized",
  exit: "Exit",
};

const ALL_STAGES: DevelopmentStage[] = [
  "prospect", "acquisition", "interim_operation", "planning",
  "permit", "construction", "lease_up", "stabilized", "exit",
];

/* ── sort options ─────────────────────────────────────────────── */
type SortKey = "address" | "city" | "stage" | "purchase_price" | "market_value" | "purchase_date" | "noi";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "stage", label: "Stage" },
  { key: "purchase_price", label: "Purchase Price" },
  { key: "market_value", label: "Market Value" },
  { key: "purchase_date", label: "Purchase Date" },
  { key: "noi", label: "NOI" },
];

/* ── helpers ──────────────────────────────────────────────────── */
function uniqueSorted(items: (string | null | undefined)[] | undefined): string[] {
  const set = new Set<string>();
  (items ?? []).forEach((v) => { if (v) set.add(v); });
  return Array.from(set).sort();
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v) || 0;
}

function computeNOI(p: Property): number {
  const rev = num(p.annual_revenue);
  const other = num(p.annual_other_income);
  const exp = num(p.annual_expenses);
  return rev + other - exp;
}

function computeCapRate(p: Property): number | null {
  const noi = computeNOI(p);
  const mv = num(p.current_market_value);
  if (noi <= 0 || mv <= 0) return null;
  return noi / mv;
}

/* Authoritative Calgary Citywide Rezoning for Housing status, sourced from
   the City's Home_Is_Here_Repeal_Parcels feature service via lookup_property.
   "Rezoning"     → parcel is proposed to be rezoned     (orange)
   "Not Rezoning" → parcel was not part of the citywide change (green) */
function calgaryZoningBadge(p: Property): { className: string; title: string } | null {
  const status = p.rezoning_status?.trim();
  if (!status) return null;
  if (status === "Rezoning") {
    return {
      className: "bg-orange-100 text-orange-800 border-orange-300",
      title: "Calgary Citywide Rezoning: this parcel is proposed to be rezoned",
    };
  }
  if (status === "Not Rezoning") {
    return {
      className: "bg-green-100 text-green-800 border-green-300",
      title: "Calgary Citywide Rezoning: this parcel was not part of the citywide rezoning for housing",
    };
  }
  return null;
}

/* ── main page ────────────────────────────────────────────────── */
export default function PortfolioPage() {
  const { data: properties, isLoading } = useProperties();
  const { user } = useAuth();
  const canCreate =
    user?.role === "DEVELOPER" || user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  /* filter state */
  const [search, setSearch] = useState("");
  const [lpFilter, setLpFilter] = useState<string>("all");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");

  /* sort state */
  const [sortKey, setSortKey] = useState<SortKey>("address");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  /* group state */
  const [groupByLp, setGroupByLp] = useState<boolean>(true);

  /* derive unique option lists from data */
  const lpOptions = useMemo(
    () => uniqueSorted(properties?.map((p) => p.lp_name)).map((name) => ({ label: name, value: name })),
    [properties],
  );
  const communityOptions = useMemo(
    () => uniqueSorted(properties?.map((p) => p.community_name)).map((name) => ({ label: name, value: name })),
    [properties],
  );
  const cityOptions = useMemo(
    () => uniqueSorted(properties?.map((p) => p.city)).map((name) => ({ label: name, value: name })),
    [properties],
  );

  /* apply filters */
  const filtered = useMemo(() => {
    if (!properties) return [];
    let result = properties.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${p.address} ${p.city} ${p.province} ${p.lp_name ?? ""} ${p.community_name ?? ""} ${p.zoning ?? ""} ${p.property_type ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (lpFilter !== "all" && p.lp_name !== lpFilter) return false;
      if (communityFilter !== "all" && p.community_name !== communityFilter) return false;
      if (cityFilter !== "all" && p.city !== cityFilter) return false;
      if (stageFilter !== "all" && p.development_stage !== stageFilter) return false;
      return true;
    });

    /* apply sorting */
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "address": cmp = a.address.localeCompare(b.address); break;
        case "city": cmp = a.city.localeCompare(b.city); break;
        case "stage": cmp = ALL_STAGES.indexOf(a.development_stage) - ALL_STAGES.indexOf(b.development_stage); break;
        case "purchase_price": cmp = num(a.purchase_price) - num(b.purchase_price); break;
        case "market_value": cmp = num(a.current_market_value) - num(b.current_market_value); break;
        case "purchase_date": cmp = (a.purchase_date ?? "").localeCompare(b.purchase_date ?? ""); break;
        case "noi": cmp = computeNOI(a) - computeNOI(b); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [properties, search, lpFilter, communityFilter, cityFilter, stageFilter, sortKey, sortDir]);

  /* group filtered results by LP (with "Unassigned" bucket) */
  const groupedByLp = useMemo(() => {
    const groups = new Map<string, Property[]>();
    const UNASSIGNED = "__unassigned__";
    filtered.forEach((p) => {
      const key = p.lp_name?.trim() ? p.lp_name : UNASSIGNED;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });
    // Sort: named LPs alphabetically, Unassigned last
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (a === UNASSIGNED) return 1;
        if (b === UNASSIGNED) return -1;
        return a.localeCompare(b);
      })
      .map(([key, items]) => ({
        key,
        label: key === UNASSIGNED ? "Unassigned" : key,
        items,
      }));
  }, [filtered]);

  const activeFilterCount = [lpFilter, communityFilter, cityFilter, stageFilter].filter(
    (v) => v !== "all",
  ).length + (search ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setLpFilter("all");
    setCommunityFilter("all");
    setCityFilter("all");
    setStageFilter("all");
  };

  /* per-group subtotals for header display */
  const groupSubtotal = (items: Property[]) => {
    const mv = items.reduce((s, p) => s + num(p.current_market_value), 0);
    const noi = items.reduce((s, p) => s + computeNOI(p), 0);
    return { mv, noi };
  };

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  /* ── portfolio KPI aggregation ────────────────────────────── */
  const kpis = useMemo(() => {
    const list = filtered.length > 0 ? filtered : [];
    const totalPurchaseValue = list.reduce((s, p) => s + num(p.purchase_price), 0);
    const totalMarketValue = list.reduce((s, p) => s + num(p.current_market_value), 0);
    const totalAssessedValue = list.reduce((s, p) => s + num(p.assessed_value), 0);
    const totalNOI = list.reduce((s, p) => s + computeNOI(p), 0);
    const totalUnits = list.reduce((s, p) => s + (p.bedrooms ?? 0), 0);
    const avgCapRate = totalMarketValue > 0 && totalNOI > 0 ? totalNOI / totalMarketValue : null;

    // Stage breakdown
    const stageCounts: Record<string, number> = {};
    list.forEach((p) => {
      stageCounts[p.development_stage] = (stageCounts[p.development_stage] || 0) + 1;
    });

    // City breakdown
    const cityCounts: Record<string, number> = {};
    list.forEach((p) => {
      cityCounts[p.city] = (cityCounts[p.city] || 0) + 1;
    });

    return {
      count: list.length,
      totalPurchaseValue,
      totalMarketValue,
      totalAssessedValue,
      totalNOI,
      totalUnits,
      avgCapRate,
      stageCounts,
      cityCounts,
    };
  }, [filtered]);

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-muted-foreground">
            Manage properties and development plans
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <AddPropertyWizard />
            <LinkButton href="/portfolio/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </LinkButton>
          </div>
        )}
      </div>

      {/* ── Portfolio KPI Strip ──────────────────────────────── */}
      {!isLoading && properties && properties.length > 0 && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Properties</span>
              </div>
              <p className="text-2xl font-bold">{kpis.count}</p>
              {activeFilterCount > 0 && (
                <p className="text-xs text-muted-foreground">of {properties.length} total</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Market Value</span>
              </div>
              <p className="text-2xl font-bold">{kpis.totalMarketValue > 0 ? formatCurrencyCompact(kpis.totalMarketValue) : "—"}</p>
              <p className="text-xs text-muted-foreground">
                Assessed: {kpis.totalAssessedValue > 0 ? formatCurrencyCompact(kpis.totalAssessedValue) : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Total NOI</span>
              </div>
              <p className="text-2xl font-bold">{kpis.totalNOI > 0 ? formatCurrencyCompact(kpis.totalNOI) : "—"}</p>
              <p className="text-xs text-muted-foreground">
                Avg Cap: {kpis.avgCapRate != null ? `${(kpis.avgCapRate * 100).toFixed(2)}%` : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">Total Cost</span>
              </div>
              <p className="text-2xl font-bold">{kpis.totalPurchaseValue > 0 ? formatCurrencyCompact(kpis.totalPurchaseValue) : "—"}</p>
              <p className="text-xs text-muted-foreground">
                Avg: {kpis.count > 0 && kpis.totalPurchaseValue > 0 ? formatCurrencyCompact(kpis.totalPurchaseValue / kpis.count) : "—"}/property
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <BedDouble className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Bedrooms</span>
              </div>
              <p className="text-2xl font-bold">{kpis.totalUnits > 0 ? kpis.totalUnits : "—"}</p>
              <p className="text-xs text-muted-foreground">
                Avg: {kpis.count > 0 && kpis.totalUnits > 0 ? (kpis.totalUnits / kpis.count).toFixed(1) : "—"}/property
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Home className="h-4 w-4 text-slate-600" />
                <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">By Stage</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(kpis.stageCounts).slice(0, 4).map(([stage, count]) => (
                  <span key={stage} className={`text-xs px-1.5 py-0.5 rounded-full ${STAGE_COLORS[stage as DevelopmentStage] || "bg-gray-100 text-gray-700"}`}>
                    {STAGE_LABELS[stage]?.substring(0, 4) ?? stage}: {count}
                  </span>
                ))}
                {Object.keys(kpis.stageCounts).length > 4 && (
                  <span className="text-xs text-muted-foreground">+{Object.keys(kpis.stageCounts).length - 4}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── filter bar ────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          {/* row 1: search + view toggle */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by address, city, LP, community, zoning, type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center rounded-md border">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-muted" : ""}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-muted" : ""}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`p-2 ${viewMode === "map" ? "bg-muted" : ""}`}
                title="Map view"
              >
                <MapPin className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* row 2: dropdown filters + sort */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
            </div>

            {/* LP Fund */}
            <Select value={lpFilter} onValueChange={(v) => setLpFilter(v ?? "")}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="LP Fund" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All LP Funds</SelectItem>
                {lpOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Community */}
            <Select value={communityFilter} onValueChange={(v) => setCommunityFilter(v ?? "")}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Community" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Communities</SelectItem>
                {communityOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* City */}
            <Select value={cityFilter} onValueChange={(v) => setCityFilter(v ?? "")}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cityOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Development Stage */}
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v ?? "")}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {ALL_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Separator */}
            <div className="h-6 w-px bg-border" />

            {/* Sort */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ArrowUpDown className="h-4 w-4" />
              <span>Sort</span>
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="p-2 rounded-md border hover:bg-muted"
              title={sortDir === "asc" ? "Ascending" : "Descending"}
            >
              {sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {/* Separator */}
            <div className="h-6 w-px bg-border" />

            {/* Group by LP toggle */}
            <button
              onClick={() => setGroupByLp((g) => !g)}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-md border text-sm hover:bg-muted ${
                groupByLp ? "bg-muted border-foreground/20" : ""
              }`}
              title="Group properties by LP fund"
            >
              <Layers className="h-4 w-4" />
              <span>Group by LP</span>
            </button>

            {/* clear button */}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-sm">
                <X className="mr-1 h-3 w-3" />
                Clear{activeFilterCount > 1 ? ` (${activeFilterCount})` : ""}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* result count */}
      {!isLoading && properties && properties.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Showing {filtered.length} of {properties.length} properties
          {activeFilterCount > 0 && (
            <span>
              {" "}&middot;{" "}
              <button onClick={clearFilters} className="underline hover:text-foreground">
                clear filters
              </button>
            </span>
          )}
        </p>
      )}

      {/* ── property views ────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : properties?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No properties yet</p>
          {canCreate && (
            <LinkButton href="/portfolio/new" className="mt-4">
              Add your first property
            </LinkButton>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">No matching properties</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters or search term.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
            Clear all filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* ── ENHANCED GRID VIEW ────────────────────────────── */
        (() => {
          const renderCard = (p: Property) => {
            const noi = computeNOI(p);
            const capRate = computeCapRate(p);
            const mv = num(p.current_market_value);
            const pp = num(p.purchase_price);
            const appreciation = pp > 0 && mv > 0 ? ((mv - pp) / pp) * 100 : null;

            return (
              <Link key={p.property_id} href={`/portfolio/${p.property_id}`}>
                <Card className="h-full cursor-pointer transition-all hover:shadow-md hover:border-blue-300 group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-tight truncate group-hover:text-blue-600 transition-colors">
                          {p.address}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {p.city}, {p.province}
                          {p.neighbourhood && <span className="text-xs"> · {p.neighbourhood}</span>}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[p.development_stage]}`}
                      >
                        {STAGE_LABELS[p.development_stage] ?? p.development_stage}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Financial metrics row */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground block">Market Value</span>
                        <span className="font-semibold text-blue-600">
                          {mv > 0 ? formatCurrencyCompact(mv) : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Purchase Price</span>
                        <span className="font-medium">
                          {pp > 0 ? formatCurrencyCompact(pp) : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">NOI</span>
                        <span className={`font-semibold ${noi > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                          {noi > 0 ? formatCurrencyCompact(noi) : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Cap Rate</span>
                        <span className="font-medium">
                          {capRate != null ? `${(capRate * 100).toFixed(2)}%` : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-dashed" />

                    {/* Property details row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {p.property_type && (
                        <Badge variant="outline" className="text-xs font-normal">{p.property_type}</Badge>
                      )}
                      {p.zoning && (() => {
                        const hl = calgaryZoningBadge(p);
                        return (
                          <Badge
                            variant="outline"
                            className={`text-xs font-normal ${hl?.className ?? "bg-violet-50"}`}
                            title={hl?.title}
                          >
                            {p.zoning}
                          </Badge>
                        );
                      })()}
                      {p.bedrooms != null && p.bedrooms > 0 && (
                        <span className="text-muted-foreground">{p.bedrooms} bed{p.bedrooms !== 1 ? "s" : ""}</span>
                      )}
                      {p.building_sqft && (
                        <span className="text-muted-foreground">{Number(p.building_sqft).toLocaleString()} sqft</span>
                      )}
                      {p.year_built && (
                        <span className="text-muted-foreground">Built {p.year_built}</span>
                      )}
                    </div>

                    {/* Bottom row: LP + Community + Appreciation */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {p.lp_name && (
                          <span className="truncate max-w-[100px] text-muted-foreground" title={p.lp_name}>
                            {p.lp_name}
                          </span>
                        )}
                        {p.community_name && (
                          <span className="truncate max-w-[100px] text-muted-foreground" title={p.community_name}>
                            · {p.community_name}
                          </span>
                        )}
                      </div>
                      {appreciation != null && (
                        <span className={`font-medium ${appreciation >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {appreciation >= 0 ? "+" : ""}{appreciation.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          };

          if (groupByLp) {
            return (
              <div className="space-y-6">
                {groupedByLp.map((g) => {
                  const sub = groupSubtotal(g.items);
                  return (
                    <div key={g.key}>
                      <div className="mb-3 flex items-baseline justify-between border-b pb-2">
                        <div className="flex items-baseline gap-2">
                          <Layers className="h-4 w-4 text-muted-foreground self-center" />
                          <h3 className="text-base font-semibold">{g.label}</h3>
                          <span className="text-xs text-muted-foreground">
                            {g.items.length} {g.items.length === 1 ? "property" : "properties"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          MV: <span className="font-medium text-foreground">{sub.mv > 0 ? formatCurrencyCompact(sub.mv) : "—"}</span>
                          <span className="mx-2">·</span>
                          NOI: <span className="font-medium text-foreground">{sub.noi > 0 ? formatCurrencyCompact(sub.noi) : "—"}</span>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {g.items.map(renderCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(renderCard)}
            </div>
          );
        })()
      ) : viewMode === "list" ? (
        /* ── ENHANCED LIST / TABLE VIEW ────────────────────── */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("address")}>
                    <span className="flex items-center gap-1">Address {sortKey === "address" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("city")}>
                    <span className="flex items-center gap-1">City {sortKey === "city" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("stage")}>
                    <span className="flex items-center gap-1">Stage {sortKey === "stage" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">LP Fund</th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("purchase_price")}>
                    <span className="flex items-center justify-end gap-1">Purchase {sortKey === "purchase_price" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("market_value")}>
                    <span className="flex items-center justify-end gap-1">Market Value {sortKey === "market_value" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort("noi")}>
                    <span className="flex items-center justify-end gap-1">NOI {sortKey === "noi" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Cap Rate</th>
                  <th className="px-4 py-3 text-left font-medium">Zoning</th>
                  <th className="px-4 py-3 text-center font-medium">Beds</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const renderRow = (p: Property) => {
                    const noi = computeNOI(p);
                    const capRate = computeCapRate(p);
                    return (
                      <tr
                        key={p.property_id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => { window.location.href = `/portfolio/${p.property_id}`; }}
                      >
                        <td className="px-4 py-3 font-medium">{p.address}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.city}, {p.province}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[p.development_stage]}`}>
                            {STAGE_LABELS[p.development_stage] ?? p.development_stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.property_type ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">{p.lp_name ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {num(p.purchase_price) > 0 ? formatCurrencyCompact(p.purchase_price!) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-blue-600">
                          {num(p.current_market_value) > 0 ? formatCurrencyCompact(p.current_market_value!) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          <span className={noi > 0 ? "text-green-600" : ""}>{noi > 0 ? formatCurrencyCompact(noi) : "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {capRate != null ? `${(capRate * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {p.zoning ? (() => {
                            const hl = calgaryZoningBadge(p);
                            return (
                              <Badge
                                variant="outline"
                                className={hl?.className}
                                title={hl?.title}
                              >
                                {p.zoning}
                              </Badge>
                            );
                          })() : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">{p.bedrooms ?? "—"}</td>
                      </tr>
                    );
                  };

                  if (groupByLp) {
                    return groupedByLp.map((g) => {
                      const sub = groupSubtotal(g.items);
                      return (
                        <Fragment key={g.key}>
                          <tr className="bg-muted/40 border-b">
                            <td colSpan={11} className="px-4 py-2">
                              <div className="flex items-baseline justify-between">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm font-semibold">{g.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {g.items.length} {g.items.length === 1 ? "property" : "properties"}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  MV: <span className="font-medium text-foreground">{sub.mv > 0 ? formatCurrencyCompact(sub.mv) : "—"}</span>
                                  <span className="mx-2">·</span>
                                  NOI: <span className="font-medium text-foreground">{sub.noi > 0 ? formatCurrencyCompact(sub.noi) : "—"}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {g.items.map(renderRow)}
                        </Fragment>
                      );
                    });
                  }

                  return filtered.map(renderRow);
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* ── MAP VIEW ──────────────────────────────────────── */
        <PropertyMapView properties={filtered} />
      )}
    </div>
  );
}

/* ── Map View Component ─────────────────────────────────────── */
function PropertyMapView({ properties }: { properties: Property[] }) {
  const geoProperties = properties.filter(
    (p) => p.latitude && p.longitude && Number(p.latitude) !== 0 && Number(p.longitude) !== 0,
  );

  if (geoProperties.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <MapPin className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">No location data available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Properties need latitude and longitude coordinates to appear on the map.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate center point
  const avgLat = geoProperties.reduce((s, p) => s + Number(p.latitude), 0) / geoProperties.length;
  const avgLng = geoProperties.reduce((s, p) => s + Number(p.longitude), 0) / geoProperties.length;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative w-full" style={{ height: "500px" }}>
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0, borderRadius: "0.5rem" }}
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
              Math.min(...geoProperties.map((p) => Number(p.longitude))) - 0.02
            },${
              Math.min(...geoProperties.map((p) => Number(p.latitude))) - 0.02
            },${
              Math.max(...geoProperties.map((p) => Number(p.longitude))) + 0.02
            },${
              Math.max(...geoProperties.map((p) => Number(p.latitude))) + 0.02
            }&layer=mapnik`}
          />
          {/* Property list overlay on map */}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border max-h-[460px] overflow-y-auto w-72">
            <div className="p-3 border-b sticky top-0 bg-white/95 backdrop-blur-sm rounded-t-lg">
              <p className="text-sm font-medium">{geoProperties.length} properties on map</p>
            </div>
            <div className="divide-y">
              {geoProperties.map((p) => (
                <Link
                  key={p.property_id}
                  href={`/portfolio/${p.property_id}`}
                  className="block p-3 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium truncate">{p.address}</p>
                  <p className="text-xs text-muted-foreground">{p.city}, {p.province}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STAGE_COLORS[p.development_stage]}`}>
                      {STAGE_LABELS[p.development_stage]}
                    </span>
                    {num(p.current_market_value) > 0 && (
                      <span className="text-xs font-medium text-blue-600">
                        {formatCurrencyCompact(p.current_market_value!)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
