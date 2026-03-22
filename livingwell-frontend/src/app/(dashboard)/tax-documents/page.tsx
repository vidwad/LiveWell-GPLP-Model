"use client";

import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  Users,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatCurrency, cn } from "@/lib/utils";
import { useTaxDocuments } from "@/hooks/useInvestors";

export default function TaxDocumentsPage() {
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(currentYear - 1);
  const { data, isLoading } = useTaxDocuments(taxYear);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const investors = data?.investors ?? [];
  const uploaded = data?.k1_uploaded ?? 0;
  const pending = data?.k1_pending ?? 0;
  const total = data?.total_investors ?? 0;
  const completionPct = total > 0 ? (uploaded / total) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">K-1 Tax Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track K-1 distribution status for all investors
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm">Tax Year:</Label>
          <Select value={String(taxYear)} onValueChange={(v) => setTaxYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Total Investors</p>
            <p className="text-xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">With funded subscriptions</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">K-1s Uploaded</p>
            <p className="text-xl font-bold text-green-700">{uploaded}</p>
            <p className="text-xs text-muted-foreground">{completionPct.toFixed(0)}% complete</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">K-1s Pending</p>
            <p className={cn("text-xl font-bold", pending > 0 ? "text-amber-700" : "text-green-700")}>{pending}</p>
            <p className="text-xs text-muted-foreground">
              {pending > 0 ? "Need to be uploaded" : "All done"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Completion</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold">{completionPct.toFixed(0)}%</p>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
              <div
                className={cn("h-full rounded-full", completionPct === 100 ? "bg-green-500" : "bg-blue-500")}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Investor Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investor K-1 Status — {taxYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {investors.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No investors with funded subscriptions found for {taxYear}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Investor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Fund(s)</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">Distributions</TableHead>
                    <TableHead>K-1 Status</TableHead>
                    <TableHead>Documents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investors.map((inv: {
                    investor_id: number;
                    investor_name: string;
                    email: string;
                    lp_names: string[];
                    capital_contributed: number;
                    distributions: number;
                    k1_status: string;
                    k1_documents: { document_id: number; title: string; is_viewed: boolean }[];
                  }) => (
                    <TableRow key={inv.investor_id}>
                      <TableCell className="font-medium">{inv.investor_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.email || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {inv.lp_names.map((name) => (
                            <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(inv.capital_contributed)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(inv.distributions)}</TableCell>
                      <TableCell>
                        {inv.k1_status === "uploaded" ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Uploaded
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv.k1_documents.length > 0 ? (
                          <div className="space-y-1">
                            {inv.k1_documents.map((doc) => (
                              <div key={doc.document_id} className="flex items-center gap-1 text-xs">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate max-w-[150px]">{doc.title}</span>
                                {doc.is_viewed && (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
