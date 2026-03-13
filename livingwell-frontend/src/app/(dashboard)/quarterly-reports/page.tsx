"use client";

import { useState } from "react";
import {
  FileText,
  Plus,
  Eye,
  Send,
  ArrowLeft,
  Clock,
  CheckCircle2,
  FileEdit,
} from "lucide-react";
import { useLPs } from "@/hooks/useInvestment";
import {
  useQuarterlyReports,
  useGenerateReport,
  useUpdateReport,
} from "@/hooks/useLifecycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { QuarterlyReport, QuarterlyReportStatus } from "@/types/lifecycle";

const STATUS_CONFIG: Record<
  QuarterlyReportStatus,
  { icon: typeof FileEdit; color: string; label: string }
> = {
  draft: { icon: FileEdit, color: "bg-gray-100 text-gray-700", label: "Draft" },
  review: { icon: Clock, color: "bg-amber-100 text-amber-700", label: "In Review" },
  published: {
    icon: CheckCircle2,
    color: "bg-green-100 text-green-700",
    label: "Published",
  },
};

export default function QuarterlyReportsPage() {
  const { data: lps, isLoading: lpsLoading } = useLPs();
  const [selectedLpId, setSelectedLpId] = useState<number | null>(null);
  const [viewingReport, setViewingReport] = useState<QuarterlyReport | null>(null);

  if (!selectedLpId && lps && lps.length > 0) {
    setSelectedLpId(lps[0].lp_id);
  }

  if (lpsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (viewingReport) {
    return (
      <ReportViewer
        report={viewingReport}
        lpId={selectedLpId!}
        onBack={() => setViewingReport(null)}
      />
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileText className="h-6 w-6" />
          Quarterly Reports
        </h1>
        <p className="text-muted-foreground">
          Generate, review, and publish quarterly investor reports
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {lps?.map((lp) => (
              <button
                key={lp.lp_id}
                onClick={() => setSelectedLpId(lp.lp_id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedLpId === lp.lp_id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div>{lp.name}</div>
                <div className="text-xs opacity-75">{lp.status}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedLpId && (
        <ReportsList lpId={selectedLpId} onView={(r) => setViewingReport(r)} />
      )}
    </div>
  );
}

function ReportsList({
  lpId,
  onView,
}: {
  lpId: number;
  onView: (r: QuarterlyReport) => void;
}) {
  const { data: reports, isLoading } = useQuarterlyReports(lpId);
  const { mutateAsync: generate, isPending: generating } = useGenerateReport(lpId);
  const [genOpen, setGenOpen] = useState(false);
  const [genQuarter, setGenQuarter] = useState("1");
  const [genYear, setGenYear] = useState("2026");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await generate({
        quarter: Number(genQuarter),
        year: Number(genYear),
      });
      toast.success("Quarterly report generated");
      setGenOpen(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to generate report");
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Reports</CardTitle>
        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Report
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Quarterly Report</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quarter</Label>
                  <Select value={genQuarter} onValueChange={(v) => v && setGenQuarter(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Q1</SelectItem>
                      <SelectItem value="2">Q2</SelectItem>
                      <SelectItem value="3">Q3</SelectItem>
                      <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={genYear} onValueChange={(v) => v && setGenYear(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                This will auto-generate a report from current portfolio data
                including revenue, expenses, NOI, and property updates.
              </p>
              <Button type="submit" disabled={generating}>
                {generating ? "Generating..." : "Generate Report"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!reports || reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quarterly reports yet. Generate your first report.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const cfg = STATUS_CONFIG[r.status];
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={r.report_id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${cfg.color}`}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{r.period_label}</p>
                      <p className="text-xs text-muted-foreground">
                        Generated {r.generated_at ? formatDate(r.generated_at) : "\u2014"}
                        {r.published_at && (
                          <span> · Published {formatDate(r.published_at)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p>
                        NOI:{" "}
                        <span className="font-medium">
                          {formatCurrency(r.net_operating_income)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Revenue: {formatCurrency(r.total_revenue)}
                      </p>
                    </div>
                    <Badge className={cfg.color}>{cfg.label}</Badge>
                    <Button size="sm" variant="outline" onClick={() => onView(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportViewer({
  report,
  lpId,
  onBack,
}: {
  report: QuarterlyReport;
  lpId: number;
  onBack: () => void;
}) {
  const { mutateAsync: updateReport, isPending } = useUpdateReport(lpId);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(report.executive_summary ?? "");
  const [commentary, setCommentary] = useState(report.market_commentary ?? "");

  const handlePublish = async () => {
    try {
      await updateReport({
        reportId: report.report_id,
        data: { status: "published" },
      });
      toast.success("Report published");
      onBack();
    } catch {
      toast.error("Failed to publish report");
    }
  };

  const handleSave = async () => {
    try {
      await updateReport({
        reportId: report.report_id,
        data: {
          executive_summary: summary,
          market_commentary: commentary,
        },
      });
      toast.success("Report updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update report");
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Button>
          <h1 className="text-2xl font-bold">{report.period_label} Report</h1>
        </div>
        <div className="flex gap-2">
          {report.status !== "published" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                <FileEdit className="mr-2 h-4 w-4" />
                {editing ? "Cancel" : "Edit"}
              </Button>
              <Button size="sm" onClick={handlePublish} disabled={isPending}>
                <Send className="mr-2 h-4 w-4" />
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">{formatCurrency(report.total_revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold">{formatCurrency(report.total_expenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Net Operating Income</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(report.net_operating_income)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Distributions</p>
            <p className="text-xl font-bold">{formatCurrency(report.total_distributions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Portfolio Value</p>
            <p className="text-xl font-bold">{formatCurrency(report.portfolio_value)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Portfolio LTV</p>
            <p className="text-xl font-bold">{Number(report.portfolio_ltv).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
              />
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                Save Changes
              </Button>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              {report.executive_summary ? (
                <p className="whitespace-pre-wrap">{report.executive_summary}</p>
              ) : (
                <p className="text-muted-foreground italic">No executive summary provided.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market Commentary</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                rows={4}
              />
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                Save Changes
              </Button>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              {report.market_commentary ? (
                <p className="whitespace-pre-wrap">{report.market_commentary}</p>
              ) : (
                <p className="text-muted-foreground italic">No market commentary provided.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
