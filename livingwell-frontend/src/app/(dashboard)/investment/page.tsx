"use client";

import { Landmark } from "lucide-react";
import { useGPs, useLPs } from "@/hooks/useInvestment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

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
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Landmark className="h-6 w-6" />
          Investment Structure
        </h1>
        <p className="text-muted-foreground">
          GP/LP entities, fund structure, and capital commitments
        </p>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gps.map((gp) => (
                  <TableRow key={gp.gp_id}>
                    <TableCell className="font-medium">{gp.name}</TableCell>
                    <TableCell>{gp.legal_name ?? "—"}</TableCell>
                    <TableCell>{gp.jurisdiction ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* LP Entities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limited Partnerships</CardTitle>
        </CardHeader>
        <CardContent>
          {!lps || lps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No LP entities.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target Raise</TableHead>
                  <TableHead>Vintage Year</TableHead>
                  <TableHead>Pref. Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lps.map((lp) => (
                  <TableRow key={lp.lp_id}>
                    <TableCell className="font-medium">{lp.name}</TableCell>
                    <TableCell>{lp.legal_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          lp.status === "operating"
                            ? "default"
                            : lp.status === "raising"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {lp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lp.target_raise ? formatCurrency(lp.target_raise) : "—"}
                    </TableCell>
                    <TableCell>{lp.vintage_year ?? "—"}</TableCell>
                    <TableCell>
                      {lp.preferred_return_rate
                        ? `${Number(lp.preferred_return_rate).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
