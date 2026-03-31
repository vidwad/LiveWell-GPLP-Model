"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pipeline as pipelineApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target,
  DollarSign,
  Users,
  TrendingUp,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new_lead: { label: "New Lead", color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-300" },
  warm_lead: { label: "Warm Lead", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300" },
  prospect: { label: "Prospect", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300" },
  hot_prospect: { label: "Hot Prospect", color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-300" },
  investor: { label: "Investor", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300" },
};

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: Calendar,
  note: FileText,
  follow_up: Calendar,
  document: FileText,
  task: CheckCircle2,
  status_change: ArrowRight,
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ── Page Component ───────────────────────────────────────────────────────

export default function PipelinePage() {
  const [contactSort, setContactSort] = useState<"stage" | "value" | "activity" | "days">("stage");

  const { data, isLoading } = useQuery({
    queryKey: ["my-pipeline"],
    queryFn: () => pipelineApi.getMyPipeline(),
  });

  const { data: activityImpact } = useQuery({
    queryKey: ["pipeline-activity-impact"],
    queryFn: () => pipelineApi.getActivityImpact(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const stages = data?.stages || [];
  const contacts = data?.contacts || [];
  const actMetrics = data?.activity_metrics || [];
  const totalPipeline = data?.total_pipeline_value || 0;
  const totalCommitted = data?.total_committed_value || 0;
  const totalFunded = data?.total_funded_value || 0;
  const totalContacts = data?.total_contacts || 0;

  // Sort contacts
  const sortedContacts = [...contacts].sort((a: any, b: any) => {
    if (contactSort === "value") return (b.estimated_value || 0) - (a.estimated_value || 0);
    if (contactSort === "activity") return (b.activity_count || 0) - (a.activity_count || 0);
    if (contactSort === "days") return (b.days_in_stage || 0) - (a.days_in_stage || 0);
    return 0; // default: already sorted by stage from backend
  });

  // Funnel widths (proportional to count, min 15%)
  const maxCount = Math.max(...stages.map((s: any) => s.count), 1);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          My Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal investor outreach funnel and conversion metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Total Contacts" value={String(totalContacts)} sub="Assigned to you" color="text-blue-600" />
        <KpiCard icon={Target} label="Pipeline Value" value={formatCurrency(totalPipeline)} sub="Probability-weighted" color="text-violet-600" />
        <KpiCard icon={DollarSign} label="Committed" value={formatCurrency(totalCommitted)} sub="Subscription commitments" color="text-amber-600" />
        <KpiCard icon={TrendingUp} label="Funded" value={formatCurrency(totalFunded)} sub="Capital received" color="text-emerald-600" />
      </div>

      {/* Pipeline Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {stages.map((stage: any, i: number) => {
            const cfg = STAGE_CONFIG[stage.stage] || STAGE_CONFIG.new_lead;
            const widthPct = Math.max(15, (stage.count / maxCount) * 100);
            const nextStage = stages[i + 1];
            return (
              <div key={stage.stage}>
                <div className="flex items-center gap-3">
                  {/* Funnel bar */}
                  <div
                    className={`relative rounded-lg ${cfg.bg} border ${cfg.border} py-3 px-4 transition-all`}
                    style={{ width: `${widthPct}%`, minWidth: 200 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {stage.count} contact{stage.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${cfg.color}`}>
                          {formatCurrency(stage.estimated_value)}
                        </span>
                        <span className="block text-[9px] text-muted-foreground">
                          {Math.round(stage.probability * 100)}% probability
                        </span>
                      </div>
                    </div>
                    {stage.ioi_total > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        IOI: {formatCurrency(stage.ioi_total)}
                        {stage.committed > 0 && ` | Committed: ${formatCurrency(stage.committed)}`}
                      </div>
                    )}
                  </div>
                  {/* Conversion arrow */}
                  {nextStage && stage.count > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <ArrowRight className="h-3 w-3" />
                      {nextStage.count > 0 ? `${Math.round((nextStage.count / stage.count) * 100)}%` : "0%"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {stages.every((s: any) => s.count === 0) && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No contacts assigned yet. Contacts will appear here as they&apos;re assigned to you.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Impact + Pipeline Value side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Activity Impact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activity Impact on Conversion</CardTitle>
            <p className="text-[10px] text-muted-foreground">Which activities correlate with converting leads to investors</p>
          </CardHeader>
          <CardContent>
            {(activityImpact || actMetrics).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No activity data yet.</p>
            ) : (
              <div className="space-y-2">
                {(activityImpact || []).map((a: any) => {
                  const Icon = ACTIVITY_ICONS[a.activity_type] || FileText;
                  return (
                    <div key={a.activity_type} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium capitalize">{a.activity_type.replace("_", " ")}</span>
                          <Badge variant="outline" className="text-[9px]">
                            {a.total_contacts} contacts
                          </Badge>
                        </div>
                        <div className="mt-1 h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(a.conversion_rate, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[9px] text-muted-foreground">
                            {a.converted_contacts} converted
                          </span>
                          <span className="text-[9px] font-medium text-emerald-600">
                            {a.conversion_rate}% conversion
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Value by Stage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline Value by Stage</CardTitle>
            <p className="text-[10px] text-muted-foreground">Raw IOI value vs. probability-weighted estimate</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stages.filter((s: any) => s.count > 0).map((stage: any) => {
                const cfg = STAGE_CONFIG[stage.stage] || STAGE_CONFIG.new_lead;
                const rawValue = stage.ioi_total || stage.count * 50000;
                const maxVal = Math.max(...stages.map((s: any) => s.ioi_total || s.count * 50000), 1);
                return (
                  <div key={stage.stage} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">{formatCurrency(rawValue)}</span>
                        <span className="text-xs font-bold ml-2">{formatCurrency(stage.estimated_value)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 h-3">
                      <div
                        className="bg-slate-200 rounded-sm"
                        style={{ width: `${(rawValue / maxVal) * 100}%` }}
                        title={`Raw: ${formatCurrency(rawValue)}`}
                      />
                      <div
                        className="bg-emerald-500 rounded-sm"
                        style={{ width: `${(stage.estimated_value / maxVal) * 100}%` }}
                        title={`Weighted: ${formatCurrency(stage.estimated_value)}`}
                      />
                    </div>
                    <div className="flex gap-3 text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-200 inline-block" /> Raw Value</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> Weighted ({Math.round(stage.probability * 100)}%)</span>
                    </div>
                  </div>
                );
              })}
              {stages.every((s: any) => s.count === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">No pipeline data yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Your Activity Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Your Outreach Activity</CardTitle>
          <p className="text-[10px] text-muted-foreground">Total activities performed on your assigned contacts</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {actMetrics.map((m: any) => {
              const Icon = ACTIVITY_ICONS[m.activity_type] || FileText;
              return (
                <div key={m.activity_type} className="rounded-lg border p-3 text-center space-y-1">
                  <Icon className="h-5 w-5 mx-auto text-muted-foreground" />
                  <p className="text-lg font-bold">{m.total_count}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{m.activity_type.replace("_", " ")}s</p>
                  <p className="text-[9px] text-muted-foreground">{m.contacts_touched} contacts</p>
                </div>
              );
            })}
            {actMetrics.length === 0 && (
              <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                No activities yet. Start reaching out to your contacts!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Pipeline Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Pipeline Contacts</CardTitle>
              <p className="text-[10px] text-muted-foreground">{contacts.length} contacts assigned to you</p>
            </div>
            <div className="flex gap-1">
              {(["stage", "value", "activity", "days"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setContactSort(s)}
                  className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                    contactSort === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {s === "stage" ? "Stage" : s === "value" ? "Value" : s === "activity" ? "Activity" : "Days"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <div className="py-8 text-center">
              <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No contacts in your pipeline yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contacts will appear here when they&apos;re assigned to you in the CRM.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Est. Value</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">IOI</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Committed</th>
                    <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Activities</th>
                    <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Days in Stage</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedContacts.map((c: any) => {
                    const cfg = STAGE_CONFIG[c.investor_status] || STAGE_CONFIG.new_lead;
                    const stale = c.days_in_stage > 14 && c.investor_status !== "investor";
                    return (
                      <tr
                        key={c.investor_id}
                        className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${stale ? "bg-red-50/30" : ""}`}
                        onClick={() => window.location.href = `/investor-onboarding?investor=${c.investor_id}`}
                      >
                        <td className="px-3 py-2.5">
                          <div>
                            <span className="font-medium">{c.name}</span>
                            {c.company && <span className="block text-[10px] text-muted-foreground">{c.company}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={`text-[9px] ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium">
                          {formatCurrency(c.estimated_value)}
                          <span className="block text-[9px] text-muted-foreground">{Math.round(c.probability * 100)}%</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                          {c.ioi_amount > 0 ? formatCurrency(c.ioi_amount) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                          {c.committed_amount > 0 ? formatCurrency(c.committed_amount) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-medium ${c.activity_count > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                            {c.activity_count}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={stale ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {c.days_in_stage}d
                          </span>
                          {stale && <Clock className="h-3 w-3 inline ml-0.5 text-red-400" />}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {c.last_activity_date
                            ? new Date(c.last_activity_date).toLocaleDateString([], { month: "short", day: "numeric" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">{label}</p>
            <p className="text-xl font-bold truncate">{value}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
