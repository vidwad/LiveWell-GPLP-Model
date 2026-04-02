"use client";

import Link from "next/link";
import { Landmark, Plus, ArrowRight } from "lucide-react";
import { useGPs, useLPs } from "@/hooks/useInvestment";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  operating: "default",
  open_for_subscription: "secondary",
  partially_funded: "secondary",
  raising: "secondary",
  draft: "outline",
  under_review: "outline",
  approved: "outline",
  fully_funded: "default",
  winding_down: "destructive",
  dissolved: "destructive",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InvestmentPage() {
  const { data: gps, isLoading: gpsLoading } = useGPs();
  const { data: lps, isLoading: lpsLoading } = useLPs();
  const { canManageInvestments } = usePermissions();

  if (gpsLoading || lpsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Landmark className="h-6 w-6" />
            Investment Structure
          </h1>
          <p className="text-muted-foreground">
            GP/LP entities, fund structure, and capital commitments
          </p>
        </div>
        {canManageInvestments && (
          <Link href="/investment/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New LP
            </Button>
          </Link>
        )}
      </div>

      {/* GP Entities */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">General Partners</CardTitle>
        </CardHeader>
        <CardContent>
          {!gps || gps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No GP entities.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Contact Email</TableHead>
                  <TableHead>Mgmt Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gps.map((gp) => (
                  <TableRow key={gp.gp_id}>
                    <TableCell className="font-medium">{gp.legal_name}</TableCell>
                    <TableCell>{gp.contact_email ?? "—"}</TableCell>
                    <TableCell>
                      {gp.management_fee_percent
                        ? `${Number(gp.management_fee_percent).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* LP Entities — grouped by Active / Closed, sorted oldest to newest */}
      {(() => {
        const closedStatuses = new Set(["closed", "winding_down", "dissolved"]);
        const sortByDate = (a: any, b: any) => {
          const dateA = a.offering_date ? new Date(a.offering_date).getTime() : 0;
          const dateB = b.offering_date ? new Date(b.offering_date).getTime() : 0;
          return dateA - dateB;
        };
        const activeLPs = (lps || []).filter((lp: any) => !closedStatuses.has(lp.status)).sort(sortByDate);
        const closedLPs = (lps || []).filter((lp: any) => closedStatuses.has(lp.status)).sort(sortByDate);

        const renderLPTable = (items: any[], emptyMsg: string, showProgress = false) => (
          items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{emptyMsg}</p>
          ) : (
            <div className="space-y-3">
              {items.map((lp: any) => (
                <LPListCard key={lp.lp_id} lp={lp} showProgress={showProgress} />
              ))}
            </div>
          )
        );

        return (
          <>
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <CardTitle className="text-base">Active Limited Partnerships</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{activeLPs.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {renderLPTable(activeLPs, "No active LPs.", true)}
              </CardContent>
            </Card>

            {closedLPs.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    <CardTitle className="text-base">Closed Limited Partnerships</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{closedLPs.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {renderLPTable(closedLPs, "No closed LPs.")}
                </CardContent>
              </Card>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ── LP List Card with Capital Pipeline ──────────────────────────────

function LPListCard({ lp, showProgress }: { lp: any; showProgress: boolean }) {
  const { data: ioiSummary } = useQuery({
    queryKey: ["ioi-summary-list", lp.lp_id],
    queryFn: () => apiClient.get(`/api/investor/ioi/lp-summary/${lp.lp_id}`).then(r => r.data),
    enabled: showProgress,
    staleTime: 60000,
  });

  const target = Number(lp.target_raise || 0);
  const committed = Number(ioiSummary?.total_subscribed || 0);
  const funded = Number(ioiSummary?.total_funded || 0);
  const ioiTotal = Number(ioiSummary?.total_ioi_expressed || 0);
  const remaining = Math.max(target - committed, 0);

  const ioiPct = target > 0 ? Math.min(ioiTotal / target * 100, 100) : 0;
  const committedPct = target > 0 ? Math.min(committed / target * 100, 100) : 0;
  const fundedPct = target > 0 ? Math.min(funded / target * 100, 100) : 0;

  function fmtCompact(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  }

  return (
    <div
      className="rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => window.location.href = `/investment/${lp.lp_id}`}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/investment/${lp.lp_id}`} className="font-semibold text-sm hover:underline" onClick={e => e.stopPropagation()}>
                {lp.name}
              </Link>
              {lp.lp_number && <span className="text-xs text-muted-foreground">{lp.lp_number}</span>}
              <Badge variant={STATUS_VARIANT[lp.status] ?? "outline"} className="text-[10px]">
                {statusLabel(lp.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {lp.community_focus && <span>{lp.community_focus}</span>}
              {lp.offering_date && <span>Vintage {new Date(lp.offering_date).getFullYear()}</span>}
              {lp.preferred_return_rate && <span>Pref {Number(lp.preferred_return_rate).toFixed(1)}%</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-sm font-bold">{lp.target_raise ? formatCurrency(lp.target_raise) : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Target</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {showProgress && target > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {/* Progress bar */}
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            {ioiPct > 0 && <div className="absolute top-0 left-0 h-full bg-blue-200 rounded-full" style={{ width: `${ioiPct}%` }} />}
            {committedPct > 0 && <div className="absolute top-0 left-0 h-full bg-primary/40 rounded-full" style={{ width: `${committedPct}%` }} />}
            {fundedPct > 0 && <div className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: `${fundedPct}%` }} />}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            {ioiTotal > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-200" /> IOI {fmtCompact(ioiTotal)}</span>}
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary/40" /> Committed {fmtCompact(committed)}</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Funded {fmtCompact(funded)}</span>
            <span className="ml-auto font-medium">Remaining {fmtCompact(remaining)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
