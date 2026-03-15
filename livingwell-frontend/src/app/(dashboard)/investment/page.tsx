"use client";

import Link from "next/link";
import { Landmark, Plus, ArrowRight } from "lucide-react";
import { useGPs, useLPs } from "@/hooks/useInvestment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

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

      {/* LP Entities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Limited Partnerships</CardTitle>
        </CardHeader>
        <CardContent>
          {!lps || lps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No LP entities.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Focus</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Target Raise</TableHead>
                    <TableHead>Vintage</TableHead>
                    <TableHead>Pref. Return</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lps.map((lp) => (
                    <TableRow key={lp.lp_id} className="group">
                      <TableCell className="font-medium">
                        <Link
                          href={`/investment/${lp.lp_id}`}
                          className="hover:underline"
                        >
                          {lp.name}
                        </Link>
                        {lp.lp_number && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {lp.lp_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lp.community_focus ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[lp.status] ?? "outline"}>
                          {statusLabel(lp.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {lp.target_raise
                          ? formatCurrency(lp.target_raise)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {lp.offering_date
                          ? new Date(lp.offering_date).getFullYear()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {lp.preferred_return_rate
                          ? `${Number(lp.preferred_return_rate).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/investment/${lp.lp_id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
