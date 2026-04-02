"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Filter,
  Grid3X3,
  List,
  Plus,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useInvestorSummaries, useInvestorDashboard } from "@/hooks/useInvestors";
import { useLPs } from "@/hooks/useInvestment";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import type { InvestorSummary } from "@/types/investor";

// ── Helpers ─────────────────────────────────────────────────────────
function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  submitted: "secondary",
  under_review: "secondary",
  accepted: "default",
  funded: "default",
  issued: "default",
  closed: "outline",
  rejected: "destructive",
  withdrawn: "destructive",
  cancelled: "destructive",
  pending_compliance: "secondary",
  pending_payment: "secondary",
};

const STATUS_COLORS: Record<string, string> = {
  issued: "bg-green-100 text-green-700",
  pending_compliance: "bg-amber-100 text-amber-700",
  pending_payment: "bg-amber-100 text-amber-700",
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-blue-100 text-blue-700",
  accepted: "bg-indigo-100 text-indigo-700",
  funded: "bg-emerald-100 text-emerald-700",
};

const ENTITY_LABELS: Record<string, string> = {
  individual: "Individual",
  corporation: "Corporation",
  trust: "Trust",
  partnership: "Partnership",
};

const ACCREDITED_LABELS: Record<string, string> = {
  accredited: "Accredited",
  non_accredited: "Non-Accredited",
  pending: "Pending",
};

type SortField = "name" | "total_committed" | "total_funded" | "subscription_count" | "active_subscriptions";
type SortDir = "asc" | "desc";

// ── Main Page ───────────────────────────────────────────────────────
export default function InvestorsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isInvestor = user?.role === "INVESTOR";

  // Investors see their own dashboard directly
  const { data: dashboard } = useInvestorDashboard(
    isInvestor ? undefined : undefined
  );

  useEffect(() => {
    if (isInvestor && dashboard) {
      router.replace(`/investors/${dashboard.investor.investor_id}`);
    }
  }, [isInvestor, dashboard, router]);

  const { data: investors, isLoading } = useInvestorSummaries();
  const { data: lps } = useLPs();
  const canCreate = user?.role === "DEVELOPER" || user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  // ── Filter state ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [lpFilter, setLpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // subscription status
  const [accreditedFilter, setAccreditedFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all"); // "action_needed" | "all"
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── Derived data ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!investors) return [];
    let list = [...investors];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.name.toLowerCase().includes(q) ||
          inv.email.toLowerCase().includes(q) ||
          (inv.phone && inv.phone.includes(q)) ||
          inv.lp_names.some((lp) => lp.toLowerCase().includes(q))
      );
    }

    // LP filter
    if (lpFilter !== "all") {
      list = list.filter((inv) => inv.lp_names.includes(lpFilter));
    }

    // Latest subscription status filter
    if (statusFilter !== "all") {
      list = list.filter((inv) => inv.latest_status === statusFilter);
    }

    // Accredited status filter
    if (accreditedFilter !== "all") {
      list = list.filter((inv) => inv.accredited_status === accreditedFilter);
    }

    // Entity type filter
    if (entityFilter !== "all") {
      list = list.filter((inv) => inv.entity_type === entityFilter);
    }

    // Action items filter
    if (actionFilter === "action_needed") {
      list = list.filter((inv) => inv.active_subscriptions > 0);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "total_committed":
          cmp = Number(a.total_committed) - Number(b.total_committed);
          break;
        case "total_funded":
          cmp = Number(a.total_funded) - Number(b.total_funded);
          break;
        case "subscription_count":
          cmp = a.subscription_count - b.subscription_count;
          break;
        case "active_subscriptions":
          cmp = a.active_subscriptions - b.active_subscriptions;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [investors, search, lpFilter, statusFilter, accreditedFilter, entityFilter, actionFilter, sortField, sortDir]);

  // Split into active, pending, and non-active
  // Active: compliance approved + fully funded + active holding
  // Non-active: all subscriptions are in terminal states (closed/rejected/cancelled) — past investor
  // Pending: everyone else — investor status granted, working through the process
  const terminalStatuses = new Set(["closed", "rejected", "withdrawn", "cancelled"]);
  const activeInvestors = useMemo(() => filtered.filter((inv) => inv.is_active), [filtered]);
  const nonActiveInvestors = useMemo(() => filtered.filter((inv) =>
    !inv.is_active && inv.subscription_count > 0 && inv.latest_status != null && terminalStatuses.has(inv.latest_status)
  ), [filtered]);
  const pendingInvestors = useMemo(() => filtered.filter((inv) =>
    !inv.is_active && !(inv.subscription_count > 0 && inv.latest_status != null && terminalStatuses.has(inv.latest_status))
  ), [filtered]);
  const [showSection, setShowSection] = useState<"active" | "pending" | "non-active">("active");
  const displayInvestors = showSection === "active" ? activeInvestors : showSection === "pending" ? pendingInvestors : nonActiveInvestors;

  // Unique LP names for filter dropdown
  const allLpNames = useMemo(() => {
    if (!investors) return [];
    const names = new Set<string>();
    investors.forEach((inv) => inv.lp_names.forEach((lp) => names.add(lp)));
    return Array.from(names).sort();
  }, [investors]);

  // Unique entity types
  const allEntityTypes = useMemo(() => {
    if (!investors) return [];
    const types = new Set<string>();
    investors.forEach((inv) => { if (inv.entity_type) types.add(inv.entity_type); });
    return Array.from(types).sort();
  }, [investors]);

  // Unique subscription statuses
  const allStatuses = useMemo(() => {
    if (!investors) return [];
    const statuses = new Set<string>();
    investors.forEach((inv) => { if (inv.latest_status) statuses.add(inv.latest_status); });
    return Array.from(statuses).sort();
  }, [investors]);

  // Count active filters
  const activeFilterCount = [
    search.trim() !== "",
    lpFilter !== "all",
    statusFilter !== "all",
    accreditedFilter !== "all",
    entityFilter !== "all",
    actionFilter !== "all",
  ].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setLpFilter("all");
    setStatusFilter("all");
    setAccreditedFilter("all");
    setEntityFilter("all");
    setActionFilter("all");
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  // KPI totals
  const totalInvestors = investors?.length ?? 0;
  const totalCommitted = investors?.reduce((s, i) => s + Number(i.total_committed), 0) ?? 0;
  const totalFunded = investors?.reduce((s, i) => s + Number(i.total_funded), 0) ?? 0;
  const totalActionItems = investors?.reduce((s, i) => s + i.active_subscriptions, 0) ?? 0;

  if (isInvestor) {
    return (
      <div className="flex items-center justify-center py-20">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investors</h1>
          <p className="text-muted-foreground">Manage LP investors, subscriptions, and capital</p>
        </div>
        <LinkButton href="/investor-onboarding" variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add via CRM
        </LinkButton>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Investors</p>
            <p className="mt-1 text-xl font-bold">{totalInvestors}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Committed</p>
            <p className="mt-1 text-xl font-bold text-blue-600">{formatCurrencyCompact(totalCommitted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Funded</p>
            <p className="mt-1 text-xl font-bold text-indigo-600">{formatCurrencyCompact(totalFunded)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Action Items</p>
            <p className={`mt-1 text-xl font-bold ${totalActionItems > 0 ? "text-amber-600" : "text-green-600"}`}>
              {totalActionItems}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone, LP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* LP Fund Filter */}
          <Select value={lpFilter} onValueChange={(v) => setLpFilter(v ?? "")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="LP Fund" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All LP Funds</SelectItem>
              {allLpNames.map((lp) => (
                <SelectItem key={lp} value={lp}>
                  {lp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {allStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Action Items Filter */}
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v ?? "")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Action Items" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Investors</SelectItem>
              <SelectItem value="action_needed">Action Needed</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none px-2"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none px-2"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Second row: additional filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={accreditedFilter} onValueChange={(v) => setAccreditedFilter(v ?? "")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Accreditation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accreditation</SelectItem>
              <SelectItem value="accredited">Accredited</SelectItem>
              <SelectItem value="non_accredited">Non-Accredited</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v ?? "")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entity Types</SelectItem>
              {allEntityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {ENTITY_LABELS[t] ?? statusLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Results count and clear */}
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {displayInvestors.length} of {filtered.length} investors
            </span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                <X className="mr-1 h-3 w-3" />
                Clear {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Active / Pending / Non-Active Toggle */}
      <div className="flex items-center gap-1 mb-4 border-b">
        <button
          onClick={() => setShowSection("active")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            showSection === "active"
              ? "border-emerald-500 text-emerald-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Active Investors
          <Badge variant="secondary" className="text-[10px] px-1.5">{activeInvestors.length}</Badge>
        </button>
        <button
          onClick={() => setShowSection("pending")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            showSection === "pending"
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Pending Investors
          <Badge variant="secondary" className="text-[10px] px-1.5">{pendingInvestors.length}</Badge>
        </button>
        <button
          onClick={() => setShowSection("non-active")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            showSection === "non-active"
              ? "border-slate-500 text-slate-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          Non-Active Investors
          <Badge variant="secondary" className="text-[10px] px-1.5">{nonActiveInvestors.length}</Badge>
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : displayInvestors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {activeFilterCount > 0 ? (
            <>
              <Filter className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No investors match your filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear all filters
              </Button>
            </>
          ) : (
            <>
              <Users className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No investors yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first investor to get started
              </p>
            </>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* ── Table View ──────────────────────────────────────────── */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("name")}
                    >
                      <span className="flex items-center">
                        Investor
                        <SortIcon field="name" />
                      </span>
                    </TableHead>
                    <TableHead>LP Funds</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Accreditation</TableHead>
                    <TableHead>Missing Docs</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right"
                      onClick={() => toggleSort("total_committed")}
                    >
                      <span className="flex items-center justify-end">
                        Committed
                        <SortIcon field="total_committed" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right"
                      onClick={() => toggleSort("total_funded")}
                    >
                      <span className="flex items-center justify-end">
                        Funded
                        <SortIcon field="total_funded" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-center"
                      onClick={() => toggleSort("subscription_count")}
                    >
                      <span className="flex items-center justify-center">
                        Subs
                        <SortIcon field="subscription_count" />
                      </span>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-center"
                      onClick={() => toggleSort("active_subscriptions")}
                    >
                      <span className="flex items-center justify-center">
                        Actions
                        <SortIcon field="active_subscriptions" />
                      </span>
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayInvestors.map((inv) => (
                    <TableRow
                      key={inv.investor_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/investors/${inv.investor_id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{inv.name}</p>
                          <p className="text-xs text-muted-foreground">{inv.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {inv.lp_names.length > 0 ? (
                            inv.lp_names.map((lp) => (
                              <Badge key={lp} variant="outline" className="text-[10px]">
                                {lp.replace("Living Well ", "").replace(" LP", "")}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ENTITY_LABELS[inv.entity_type ?? ""] ?? "—"}
                      </TableCell>
                      <TableCell>
                        {inv.compliance_approved ? (
                          <Badge variant="default" className="text-[10px] bg-green-100 text-green-700">Approved</Badge>
                        ) : inv.accredited_status === "accredited" ? (
                          <Badge variant="default" className="text-[10px]">Accredited</Badge>
                        ) : (
                          <Badge variant={inv.accredited_status === "pending" ? "secondary" : "outline"} className="text-[10px]">
                            {ACCREDITED_LABELS[inv.accredited_status] ?? inv.accredited_status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {inv.missing_docs_count > 0 ? (
                          <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700">
                            {inv.missing_docs_count}
                          </Badge>
                        ) : (
                          <span className="text-xs text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatCurrency(inv.total_committed)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatCurrency(inv.total_funded)}
                      </TableCell>
                      <TableCell className="text-center text-sm">{inv.subscription_count}</TableCell>
                      <TableCell>
                        {inv.latest_status ? (
                          <Badge
                            variant={STATUS_BADGE_VARIANT[inv.latest_status] ?? "outline"}
                            className={`text-[10px] ${STATUS_COLORS[inv.latest_status] || ""}`}
                          >
                            {inv.latest_status === "pending_compliance" ? "Pending Compliance" :
                             inv.latest_status === "pending_payment" ? "Pending Payment" :
                             statusLabel(inv.latest_status)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {inv.active_subscriptions > 0 ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">
                            <AlertCircle className="mr-0.5 h-3 w-3" />
                            {inv.active_subscriptions}
                          </Badge>
                        ) : (
                          <span className="text-xs text-green-600">Done</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/investor-onboarding?investor=${inv.investor_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 whitespace-nowrap"
                          >
                            CRM
                          </Link>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── Grid View ───────────────────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayInvestors.map((inv) => (
            <Link key={inv.investor_id} href={`/investors/${inv.investor_id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{inv.name}</CardTitle>
                    {inv.active_subscriptions > 0 && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">
                        <AlertCircle className="mr-0.5 h-3 w-3" />
                        {inv.active_subscriptions} action{inv.active_subscriptions !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{inv.email}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {/* LP Funds */}
                    <div className="flex flex-wrap gap-1">
                      {inv.lp_names.map((lp) => (
                        <Badge key={lp} variant="outline" className="text-[10px]">
                          {lp}
                        </Badge>
                      ))}
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Committed</p>
                        <p className="text-sm font-semibold">{formatCurrencyCompact(inv.total_committed)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Funded</p>
                        <p className="text-sm font-semibold">{formatCurrencyCompact(inv.total_funded)}</p>
                      </div>
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between border-t pt-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={inv.accredited_status === "accredited" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {ACCREDITED_LABELS[inv.accredited_status] ?? inv.accredited_status}
                        </Badge>
                        {inv.entity_type && (
                          <span className="text-[10px] text-muted-foreground">
                            {ENTITY_LABELS[inv.entity_type]}
                          </span>
                        )}
                      </div>
                      {inv.latest_status && (
                        <Badge
                          variant={STATUS_BADGE_VARIANT[inv.latest_status] ?? "outline"}
                          className={`text-[10px] ${STATUS_COLORS[inv.latest_status] || ""}`}
                        >
                          {inv.latest_status === "pending_compliance" ? "Pending Compliance" :
                           inv.latest_status === "pending_payment" ? "Pending Payment" :
                           statusLabel(inv.latest_status)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
