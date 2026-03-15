"use client";

import Link from "next/link";
import { Plus, Building2, Search, X, SlidersHorizontal, LayoutGrid, List } from "lucide-react";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { DevelopmentStage, Property } from "@/types/portfolio";
import { useState, useMemo } from "react";

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

/* ── helpers ──────────────────────────────────────────────────── */
function uniqueSorted(items: (string | null | undefined)[] | undefined): string[] {
  const set = new Set<string>();
  (items ?? []).forEach((v) => { if (v) set.add(v); });
  return Array.from(set).sort();
}

/* ── main page ────────────────────────────────────────────────── */
export default function PortfolioPage() {
  const { data: properties, isLoading } = useProperties();
  const { user } = useAuth();
  const canCreate =
    user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  /* filter state */
  const [search, setSearch] = useState("");
  const [lpFilter, setLpFilter] = useState<string>("all");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  /* derive unique option lists from data */
  const lpOptions = useMemo(
    () =>
      uniqueSorted(properties?.map((p) => p.lp_name)).map((name) => ({
        label: name,
        value: name,
      })),
    [properties],
  );

  const communityOptions = useMemo(
    () =>
      uniqueSorted(properties?.map((p) => p.community_name)).map((name) => ({
        label: name,
        value: name,
      })),
    [properties],
  );

  const cityOptions = useMemo(
    () =>
      uniqueSorted(properties?.map((p) => p.city)).map((name) => ({
        label: name,
        value: name,
      })),
    [properties],
  );

  /* apply filters */
  const filtered = useMemo(() => {
    if (!properties) return [];
    return properties.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${p.address} ${p.city} ${p.province} ${p.lp_name ?? ""} ${p.community_name ?? ""} ${p.zoning ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (lpFilter !== "all" && p.lp_name !== lpFilter) return false;
      if (communityFilter !== "all" && p.community_name !== communityFilter) return false;
      if (cityFilter !== "all" && p.city !== cityFilter) return false;
      if (stageFilter !== "all" && p.development_stage !== stageFilter) return false;
      return true;
    });
  }, [properties, search, lpFilter, communityFilter, cityFilter, stageFilter]);

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
          <LinkButton href="/portfolio/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </LinkButton>
        )}
      </div>

      {/* ── filter bar ────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          {/* row 1: search + view toggle */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by address, city, LP, community, zoning…"
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
            </div>
          </div>

          {/* row 2: dropdown filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
            </div>

            {/* LP Fund */}
            <Select value={lpFilter} onValueChange={setLpFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="LP Fund" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All LP Funds</SelectItem>
                {lpOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Community */}
            <Select value={communityFilter} onValueChange={setCommunityFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Community" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Communities</SelectItem>
                {communityOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* City */}
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cityOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Development Stage */}
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {ALL_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* clear button */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-sm"
              >
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
              {" "}
              &middot;{" "}
              <button onClick={clearFilters} className="underline hover:text-foreground">
                clear filters
              </button>
            </span>
          )}
        </p>
      )}

      {/* ── property cards ────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44" />
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
        /* ── grid view ──────────────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.property_id} href={`/portfolio/${p.property_id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                      {p.address}
                    </CardTitle>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[p.development_stage]}`}
                    >
                      {STAGE_LABELS[p.development_stage] ?? p.development_stage}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.city}, {p.province}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Price</span>
                      <span className="font-medium">
                        {p.purchase_price
                          ? formatCurrency(Number(p.purchase_price))
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Date</span>
                      <span>
                        {p.purchase_date ? formatDate(p.purchase_date) : "—"}
                      </span>
                    </div>
                    {p.zoning && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Zoning</span>
                        <Badge variant="outline">{p.zoning}</Badge>
                      </div>
                    )}
                    {p.lp_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">LP Fund</span>
                        <span className="text-xs font-medium truncate max-w-[140px]">
                          {p.lp_name}
                        </span>
                      </div>
                    )}
                    {p.community_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Community</span>
                        <span className="text-xs font-medium truncate max-w-[140px]">
                          {p.community_name}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        /* ── list / table view ──────────────────────────────── */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Address</th>
                  <th className="px-4 py-3 text-left font-medium">City</th>
                  <th className="px-4 py-3 text-left font-medium">Stage</th>
                  <th className="px-4 py-3 text-left font-medium">LP Fund</th>
                  <th className="px-4 py-3 text-left font-medium">Community</th>
                  <th className="px-4 py-3 text-right font-medium">Purchase Price</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Zoning</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.property_id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => {
                      window.location.href = `/portfolio/${p.property_id}`;
                    }}
                  >
                    <td className="px-4 py-3 font-medium">{p.address}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.city}, {p.province}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[p.development_stage]}`}
                      >
                        {STAGE_LABELS[p.development_stage] ?? p.development_stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.lp_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.community_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {p.purchase_price
                        ? formatCurrency(Number(p.purchase_price))
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.purchase_date ? formatDate(p.purchase_date) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.zoning ? (
                        <Badge variant="outline">{p.zoning}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
