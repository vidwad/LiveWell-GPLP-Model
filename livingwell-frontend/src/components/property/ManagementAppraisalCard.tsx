"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Download, Mail, Sparkles, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "Queued",
  building_subject: "Building subject package",
  syncing_files: "Syncing property documents",
  researching: "Running public market research",
  synthesizing: "Synthesizing valuation draft",
  rendering: "Rendering PDF",
  emailing: "Emailing report",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

interface Job {
  id: number;
  property_id: number;
  status: string;
  error: string | null;
  draft_version: number;
  has_pdf: boolean;
  has_research: boolean;
  reviewer_status: string;
  deliver_to_email: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

const TERMINAL = new Set(["completed", "failed"]);

export function ManagementAppraisalCard({ propertyId }: { propertyId: number }) {
  const qc = useQueryClient();
  const [emailOverride, setEmailOverride] = useState("");

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["valuation-reports", propertyId],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/properties/${propertyId}/valuation-reports`)
        .then((r) => r.data),
    enabled: propertyId > 0,
    // Auto-poll every 4s while any job is non-terminal
    refetchInterval: (q) => {
      const data = q.state.data as Job[] | undefined;
      if (!data || data.length === 0) return false;
      return data.some((j) => !TERMINAL.has(j.status)) ? 4000 : false;
    },
  });

  const startMutation = useMutation({
    mutationFn: (email: string | null) =>
      apiClient
        .post(`/api/portfolio/properties/${propertyId}/valuation-reports`, {
          deliver_to_email: email || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success("Report generation started — running in the background");
      qc.invalidateQueries({ queryKey: ["valuation-reports", propertyId] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to start report"),
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: number) =>
      apiClient.delete(`/api/portfolio/valuation-reports/${jobId}`).then((r) => r.data),
    onSuccess: () => {
      toast.success("Report deleted");
      qc.invalidateQueries({ queryKey: ["valuation-reports", propertyId] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Failed to delete report"),
  });

  const emailMutation = useMutation({
    mutationFn: ({ jobId, to }: { jobId: number; to: string | null }) =>
      apiClient
        .post(`/api/portfolio/valuation-reports/${jobId}/email`, { to_email: to })
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Emailed to ${data.delivered_to}`);
      qc.invalidateQueries({ queryKey: ["valuation-reports", propertyId] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || "Email failed"),
  });

  const handleEmail = (jobId: number, currentTo: string | null) => {
    const defaultAddr = currentTo || "";
    const to = window.prompt(
      "Email this report to:",
      defaultAddr,
    );
    if (to === null) return;  // user cancelled
    const trimmed = to.trim();
    if (!trimmed) {
      toast.error("Email address required");
      return;
    }
    emailMutation.mutate({ jobId, to: trimmed });
  };

  const handleDelete = (jobId: number, version: number) => {
    if (window.confirm(`Delete report v${version}? This removes the PDF and all artifacts permanently.`)) {
      deleteMutation.mutate(jobId);
    }
  };

  const downloadPdf = (jobId: number) => {
    window.open(
      `${apiClient.defaults.baseURL || ""}/api/portfolio/valuation-reports/${jobId}/download`,
      "_blank"
    );
  };

  const latest = jobs?.[0];
  const inProgress = latest && !TERMINAL.has(latest.status);

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          Management Appraisal Report
          <Badge variant="outline" className="ml-2 text-[10px]">
            AI-assisted draft
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Generates a comprehensive valuation draft using a two-pass AI workflow:
          public market research followed by private synthesis against your
          deterministic property data and uploaded documents. Runs in the
          background and emails the completed PDF when ready.
        </p>

        {/* Start controls */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Email PDF to (optional)</label>
            <input
              type="email"
              placeholder="defaults to your account email"
              value={emailOverride}
              onChange={(e) => setEmailOverride(e.target.value)}
              className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
            />
          </div>
          <Button
            onClick={() => startMutation.mutate(emailOverride || null)}
            disabled={startMutation.isPending || !!inProgress}
            className="gap-2"
          >
            {startMutation.isPending || inProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {inProgress ? STATUS_LABELS[latest!.status] || latest!.status : "Starting…"}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate Draft Report
              </>
            )}
          </Button>
        </div>

        {/* Job history */}
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : jobs && jobs.length > 0 ? (
          <div className="border rounded">
            <div className="grid grid-cols-12 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
              <div className="col-span-2">Version</div>
              <div className="col-span-4">Status</div>
              <div className="col-span-3">Created</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>
            {jobs.map((j) => (
              <div
                key={j.id}
                className="grid grid-cols-12 items-center px-3 py-2 text-xs border-b last:border-b-0"
              >
                <div className="col-span-2 font-medium">v{j.draft_version}</div>
                <div className="col-span-4">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px]",
                      STATUS_COLOR[j.status] || "bg-blue-100 text-blue-700"
                    )}
                  >
                    {!TERMINAL.has(j.status) && <Loader2 className="h-3 w-3 animate-spin" />}
                    {j.status === "failed" && <AlertTriangle className="h-3 w-3" />}
                    {STATUS_LABELS[j.status] || j.status}
                  </span>
                  {j.delivered_at && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-green-600">
                      <Mail className="h-3 w-3" /> emailed
                    </span>
                  )}
                  {j.error && j.status === "failed" && (
                    <p className="text-[10px] text-red-600 mt-0.5 line-clamp-2" title={j.error}>
                      {j.error.split("\n")[0]}
                    </p>
                  )}
                </div>
                <div className="col-span-3 text-muted-foreground">
                  {new Date(j.created_at).toLocaleString("en-CA", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="col-span-3 text-right flex items-center justify-end gap-1">
                  {j.has_pdf && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => downloadPdf(j.id)}
                      title="Download PDF"
                    >
                      <Download className="h-3 w-3" /> PDF
                    </Button>
                  )}
                  {j.has_pdf && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => handleEmail(j.id, j.deliver_to_email)}
                      disabled={emailMutation.isPending}
                      title={`Email this report${j.deliver_to_email ? ` (last sent to ${j.deliver_to_email})` : ""}`}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(j.id, j.draft_version)}
                    disabled={deleteMutation.isPending}
                    title="Delete this report"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No reports generated yet. Click <strong>Generate Draft Report</strong> to start.
          </p>
        )}

        <p className="text-[10px] text-muted-foreground italic border-t pt-2">
          ⚠ This is an AI-assisted internal draft, not a licensed or certified
          appraisal. Always have a qualified human reviewer validate before
          relying on conclusions.
        </p>
      </CardContent>
    </Card>
  );
}
