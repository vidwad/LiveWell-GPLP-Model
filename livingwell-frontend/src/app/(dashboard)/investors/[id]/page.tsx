"use client";

import { useState } from "react";
import { ArrowLeft, DollarSign, Download, FileText, Mail, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInvestorDashboard, useInvestorDistributions } from "@/hooks/useInvestors";
import { useAuth } from "@/providers/AuthProvider";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DocumentList } from "@/components/documents/DocumentList";
import { UploadDocumentModal } from "@/components/documents/UploadDocumentModal";

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const DIST_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  approved: "secondary",
  calculated: "outline",
  draft: "outline",
  published: "default",
};

export default function InvestorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const investorId = Number(id);
  const { user } = useAuth();

  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: dashboard, isLoading } = useInvestorDashboard(investorId);
  const { data: distHistory } = useInvestorDistributions(investorId);

  const canUpload = user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!dashboard) return <p>Investor not found.</p>;

  const {
    investor,
    total_committed,
    total_funded,
    total_distributions,
    net_position,
    subscription_count,
    holding_count,
    documents,
    messages,
  } = dashboard;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <LinkButton variant="ghost" size="sm" href="/investors" className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </LinkButton>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{investor.name}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/investor/investors/${investorId}/statement`;
              const token = localStorage.getItem("lwc_access_token");
              fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.blob())
                .then(blob => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `statement_${investor.name.replace(/ /g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                });
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Statement
          </Button>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>{investor.email}</span>
          {investor.entity_type && (
            <Badge variant="outline">{investor.entity_type}</Badge>
          )}
          {investor.accredited_status && (
            <Badge variant={investor.accredited_status === "accredited" ? "default" : "secondary"}>
              {investor.accredited_status}
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total Committed", value: formatCurrency(total_committed) },
          { label: "Total Funded", value: formatCurrency(total_funded) },
          { label: "Total Distributions", value: formatCurrency(total_distributions) },
          { label: "Net Position", value: formatCurrency(net_position) },
          { label: "Subscriptions / Holdings", value: `${subscription_count} / ${holding_count}` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canUpload && (
        <UploadDocumentModal
          investorId={investorId}
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {/* Distribution History */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Distribution History
          </CardTitle>
          {distHistory && distHistory.distributions.length > 0 && (
            <Badge variant="default" className="text-xs">
              {distHistory.distributions.length} distribution{distHistory.distributions.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {!distHistory || distHistory.distributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No distributions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>LP Fund</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distHistory.distributions.map((d) => (
                    <TableRow key={d.allocation_id}>
                      <TableCell className="text-sm font-medium">{d.period_label}</TableCell>
                      <TableCell className="text-sm">{d.lp_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{statusLabel(d.distribution_type)}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">
                        {formatCurrency(d.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={DIST_STATUS_VARIANT[d.event_status] ?? "outline"} className="text-xs">
                          {statusLabel(d.event_status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.paid_date ? formatDate(d.paid_date) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={3} className="text-sm font-semibold">Total Distributions</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-bold">
                      {formatCurrency(distHistory.total_distributions)}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Documents */}
        <div>
          {canUpload && (
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => setUploadOpen(true)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Document
              </button>
            </div>
          )}
          <DocumentList investorId={investorId} />
        </div>

        {/* Messages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!messages || messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.message_id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{msg.subject}</p>
                      {!msg.is_read && <Badge variant="default">Unread</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {msg.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(msg.sent_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
