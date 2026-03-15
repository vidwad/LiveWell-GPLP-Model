"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  DollarSign,
  Download,
  FileCheck,
  FileText,
  Mail,
  Plus,
  Send,
  Upload,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useInvestor,
  useInvestorDashboard,
  useInvestorDistributions,
  useInvestorSubscriptions,
} from "@/hooks/useInvestors";
import { useLPs, useTranches } from "@/hooks/useInvestment";
import { useUpdateSubscription, useCreateSubscription } from "@/hooks/useInvestment";
import { useAuth } from "@/providers/AuthProvider";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DocumentList } from "@/components/documents/DocumentList";
import { UploadDocumentModal } from "@/components/documents/UploadDocumentModal";
import type { Subscription, SubscriptionStatus } from "@/types/investment";

// ── Subscription Lifecycle ──────────────────────────────────────────
const WORKFLOW_STEPS: {
  status: SubscriptionStatus;
  label: string;
  icon: typeof Circle;
  description: string;
}[] = [
  {
    status: "draft",
    label: "Draft",
    icon: FileText,
    description: "Subscription created, documents being prepared",
  },
  {
    status: "submitted",
    label: "Docs Sent",
    icon: Send,
    description: "Subscription & LP documents emailed to investor",
  },
  {
    status: "under_review",
    label: "Under Review",
    icon: FileCheck,
    description: "Signed subscription forms received, under review",
  },
  {
    status: "accepted",
    label: "Accepted",
    icon: Check,
    description: "Subscription accepted, awaiting payment",
  },
  {
    status: "funded",
    label: "Funded",
    icon: Wallet,
    description: "Payment received and deposited to LP account",
  },
  {
    status: "issued",
    label: "Units Issued",
    icon: CheckCircle2,
    description: "LP units issued to investor, funds available to LP",
  },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  submitted: "bg-blue-50 text-blue-700 border-blue-300",
  under_review: "bg-amber-50 text-amber-700 border-amber-300",
  accepted: "bg-indigo-50 text-indigo-700 border-indigo-300",
  funded: "bg-emerald-50 text-emerald-700 border-emerald-300",
  issued: "bg-green-50 text-green-800 border-green-400",
  closed: "bg-gray-50 text-gray-600 border-gray-300",
  rejected: "bg-red-50 text-red-700 border-red-300",
  withdrawn: "bg-orange-50 text-orange-700 border-orange-300",
  cancelled: "bg-red-50 text-red-600 border-red-300",
};

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
};

const NEXT_ACTION: Record<string, { nextStatus: SubscriptionStatus; label: string; dateField: string }> = {
  draft: { nextStatus: "submitted", label: "Send Documents", dateField: "submitted_date" },
  submitted: { nextStatus: "under_review", label: "Mark Forms Received", dateField: "" },
  under_review: { nextStatus: "accepted", label: "Accept Subscription", dateField: "accepted_date" },
  accepted: { nextStatus: "funded", label: "Record Payment", dateField: "funded_date" },
  funded: { nextStatus: "issued", label: "Issue LP Units", dateField: "issued_date" },
};

const DIST_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  approved: "secondary",
  calculated: "outline",
  draft: "outline",
  published: "default",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Subscription Workflow Card ──────────────────────────────────────
function SubscriptionWorkflowCard({
  sub,
  investorId,
  canManage,
}: {
  sub: Subscription;
  investorId: number;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [fundedAmount, setFundedAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateSub = useUpdateSubscription();

  const currentStepIdx = WORKFLOW_STEPS.findIndex((s) => s.status === sub.status);
  const isTerminal = ["closed", "rejected", "withdrawn", "cancelled"].includes(sub.status);
  const isComplete = sub.status === "issued" || sub.status === "closed";
  const nextAction = NEXT_ACTION[sub.status];
  const progressPercent = isTerminal
    ? sub.status === "issued" || sub.status === "closed"
      ? 100
      : 0
    : Math.max(0, ((currentStepIdx + 1) / WORKFLOW_STEPS.length) * 100);

  function handleAdvance() {
    if (!nextAction) return;
    const data: Record<string, unknown> = {
      status: nextAction.nextStatus,
      notes: actionNotes || undefined,
    };
    if (nextAction.dateField) {
      data[nextAction.dateField] = new Date().toISOString().slice(0, 10);
    }
    if (nextAction.nextStatus === "funded") {
      data.funded_amount = fundedAmount ? Number(fundedAmount) : Number(sub.commitment_amount);
    }
    updateSub.mutate(
      { subId: sub.subscription_id, lpId: sub.lp_id, data },
      {
        onSuccess: () => {
          setActionNotes("");
          setFundedAmount("");
          setConfirmOpen(false);
        },
      }
    );
  }

  function handleCancel() {
    updateSub.mutate({
      subId: sub.subscription_id,
      lpId: sub.lp_id,
      data: { status: "cancelled" as SubscriptionStatus, notes: actionNotes || "Cancelled by GP" },
    });
  }

  return (
    <Card className={`border-l-4 ${isComplete ? "border-l-green-500" : isTerminal ? "border-l-red-400" : "border-l-blue-500"}`}>
      {/* Header */}
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{sub.lp_name}</span>
              {sub.tranche_name && (
                <Badge variant="outline" className="text-xs">
                  {sub.tranche_name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(sub.commitment_amount)} commitment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_BADGE_VARIANT[sub.status] ?? "outline"}>
            {statusLabel(sub.status)}
          </Badge>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {Math.round(progressPercent)}%
          </span>
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0">
          {/* Progress Pipeline */}
          <div className="mb-6">
            <Progress value={progressPercent} className="mb-4 h-2" />
            <div className="grid grid-cols-6 gap-1">
              {WORKFLOW_STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isPast = currentStepIdx > idx;
                const isCurrent = currentStepIdx === idx;
                const isFuture = currentStepIdx < idx;
                return (
                  <div key={step.status} className="text-center">
                    <div
                      className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        isPast
                          ? "border-green-500 bg-green-50 text-green-600"
                          : isCurrent
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-gray-200 bg-gray-50 text-gray-400"
                      }`}
                    >
                      {isPast ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <p
                      className={`text-[10px] leading-tight ${
                        isCurrent ? "font-semibold text-blue-700" : isPast ? "text-green-700" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Dates */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Submitted", date: sub.submitted_date },
              { label: "Accepted", date: sub.accepted_date },
              { label: "Funded", date: sub.funded_date },
              { label: "Issued", date: sub.issued_date },
            ].map(({ label, date }) => (
              <div key={label} className="rounded-md border p-2 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={`text-sm font-medium ${date ? "text-foreground" : "text-muted-foreground"}`}>
                  {date ? formatDate(date) : "Pending"}
                </p>
              </div>
            ))}
          </div>

          {/* Financial Details */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border bg-muted/30 p-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Commitment</p>
              <p className="text-sm font-bold">{formatCurrency(sub.commitment_amount)}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Funded</p>
              <p className="text-sm font-bold">{formatCurrency(sub.funded_amount)}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Issue Price</p>
              <p className="text-sm font-bold">{sub.issue_price ? formatCurrency(sub.issue_price) : "—"}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Units</p>
              <p className="text-sm font-bold">{sub.unit_quantity ? Number(sub.unit_quantity).toLocaleString() : "—"}</p>
            </div>
          </div>

          {/* Notes */}
          {sub.notes && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">Notes</p>
              <p className="text-sm text-amber-900">{sub.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          {canManage && nextAction && !isTerminal && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Next Step</p>
                  <p className="text-xs text-muted-foreground">
                    {WORKFLOW_STEPS.find((s) => s.status === nextAction.nextStatus)?.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  {sub.status !== "draft" && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Ban className="mr-1 h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Cancel Subscription</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to cancel this subscription for {sub.lp_name}?
                            This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                          <Label>Reason (optional)</Label>
                          <Textarea
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="Reason for cancellation..."
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="destructive" onClick={handleCancel} disabled={updateSub.isPending}>
                            Confirm Cancel
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <ArrowRight className="mr-1 h-3.5 w-3.5" />
                        {nextAction.label}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{nextAction.label}</DialogTitle>
                        <DialogDescription>
                          Advance subscription from &ldquo;{statusLabel(sub.status)}&rdquo; to &ldquo;{statusLabel(nextAction.nextStatus)}&rdquo;
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        {nextAction.nextStatus === "funded" && (
                          <div className="space-y-1">
                            <Label>Funded Amount</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={fundedAmount || sub.commitment_amount}
                              onChange={(e) => setFundedAmount(e.target.value)}
                              placeholder={sub.commitment_amount}
                            />
                            <p className="text-xs text-muted-foreground">
                              Commitment: {formatCurrency(sub.commitment_amount)}. Full upfront funding required.
                            </p>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label>Notes (optional)</Label>
                          <Textarea
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="Add notes about this action..."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAdvance} disabled={updateSub.isPending}>
                          {updateSub.isPending ? "Processing..." : "Confirm"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          )}

          {/* Terminal state message */}
          {isTerminal && !isComplete && (
            <div className="border-t pt-4">
              <div className={`rounded-md p-3 ${STATUS_COLORS[sub.status]}`}>
                <p className="text-sm font-medium">
                  This subscription has been {statusLabel(sub.status).toLowerCase()}.
                </p>
              </div>
            </div>
          )}

          {isComplete && (
            <div className="border-t pt-4">
              <div className="rounded-md border border-green-300 bg-green-50 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-800">
                    Subscription complete. {sub.unit_quantity ? `${Number(sub.unit_quantity).toLocaleString()} units` : ""} issued to investor.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── New Subscription Dialog ─────────────────────────────────────────
function NewSubscriptionDialog({
  investorId,
  investorName,
}: {
  investorId: number;
  investorName: string;
}) {
  const [open, setOpen] = useState(false);
  const [lpId, setLpId] = useState<number>(0);
  const [trancheId, setTrancheId] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [issuePrice, setIssuePrice] = useState("");
  const [notes, setNotes] = useState("");
  const { data: lps } = useLPs();
  const { data: tranches } = useTranches(lpId);
  const createSub = useCreateSubscription();

  function handleCreate() {
    if (!lpId || !amount) return;
    createSub.mutate(
      {
        lpId,
        data: {
          investor_id: investorId,
          lp_id: lpId,
          tranche_id: trancheId || undefined,
          commitment_amount: Number(amount),
          issue_price: issuePrice ? Number(issuePrice) : undefined,
          status: "draft",
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          setLpId(0);
          setTrancheId(0);
          setAmount("");
          setIssuePrice("");
          setNotes("");
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Subscription</DialogTitle>
          <DialogDescription>
            Create a new subscription for {investorName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>LP Fund *</Label>
            <Select value={lpId ? String(lpId) : ""} onValueChange={(v) => { setLpId(Number(v)); setTrancheId(0); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select LP Fund" />
              </SelectTrigger>
              <SelectContent>
                {lps?.map((lp) => (
                  <SelectItem key={lp.lp_id} value={String(lp.lp_id)}>
                    {lp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {lpId > 0 && tranches && tranches.length > 0 && (
            <div className="space-y-1">
              <Label>Tranche (optional)</Label>
              <Select value={trancheId ? String(trancheId) : "none"} onValueChange={(v) => setTrancheId(v === "none" ? 0 : Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Tranche" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific tranche</SelectItem>
                  {tranches.map((t) => (
                    <SelectItem key={t.tranche_id} value={String(t.tranche_id)}>
                      {t.tranche_name} ({statusLabel(t.status)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Commitment Amount *</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="250000.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Issue Price per Unit (optional)</Label>
            <Input
              type="number"
              step="0.01"
              value={issuePrice}
              onChange={(e) => setIssuePrice(e.target.value)}
              placeholder="1000.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={createSub.isPending || !lpId || !amount}>
            {createSub.isPending ? "Creating..." : "Create Subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
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
  const { data: subscriptions, isLoading: subsLoading } = useInvestorSubscriptions(investorId);
  const { data: distHistory } = useInvestorDistributions(investorId);

  const canManage = user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

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

  // Compute action items from subscriptions
  const actionItems = (subscriptions ?? []).filter(
    (s) => !["issued", "closed", "rejected", "withdrawn", "cancelled"].includes(s.status)
  );

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <LinkButton variant="ghost" size="sm" href="/investors" className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </LinkButton>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{investor.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{investor.email}</span>
              {investor.phone && <span>| {investor.phone}</span>}
              {investor.entity_type && (
                <Badge variant="outline">{statusLabel(investor.entity_type)}</Badge>
              )}
              {investor.accredited_status && (
                <Badge variant={investor.accredited_status === "accredited" ? "default" : "secondary"}>
                  {statusLabel(investor.accredited_status)}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/investor/investors/${investorId}/statement`;
              const token = localStorage.getItem("lwc_access_token");
              fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => r.blob())
                .then((blob) => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `statement_${investor.name.replace(/ /g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                });
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Statement
          </Button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Committed", value: formatCurrency(total_committed), color: "text-blue-600" },
          { label: "Total Funded", value: formatCurrency(total_funded), color: "text-indigo-600" },
          { label: "Distributions", value: formatCurrency(total_distributions), color: "text-green-600" },
          { label: "Net Position", value: formatCurrency(net_position), color: "text-emerald-700" },
          { label: "Subscriptions", value: String(subscription_count), color: "" },
          { label: "Action Items", value: String(actionItems.length), color: actionItems.length > 0 ? "text-amber-600" : "text-green-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Items Banner */}
      {actionItems.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">
              {actionItems.length} Subscription{actionItems.length !== 1 ? "s" : ""} Requiring Action
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {actionItems.map((s) => (
              <div key={s.subscription_id} className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs">
                <span className="font-medium">{s.lp_name}</span>
                <ArrowRight className="h-3 w-3 text-amber-500" />
                <span className="text-amber-700">{NEXT_ACTION[s.status]?.label ?? statusLabel(s.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManage && (
        <UploadDocumentModal
          investorId={investorId}
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions">
            <Wallet className="mr-1.5 h-4 w-4" />
            Subscriptions
            {actionItems.length > 0 && (
              <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {actionItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="distributions">
            <DollarSign className="mr-1.5 h-4 w-4" />
            Distributions
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-1.5 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="messages">
            <Mail className="mr-1.5 h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="mr-1.5 h-4 w-4" />
            Profile
          </TabsTrigger>
        </TabsList>

        {/* ── Subscriptions Tab ──────────────────────────────────── */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Subscription Lifecycle</h2>
              <p className="text-sm text-muted-foreground">
                Track each subscription from draft through to LP unit issuance
              </p>
            </div>
            {canManage && (
              <NewSubscriptionDialog investorId={investorId} investorName={investor.name} />
            )}
          </div>

          {subsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : !subscriptions || subscriptions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wallet className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No subscriptions yet</p>
                {canManage && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a new subscription to begin the onboarding process
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <SubscriptionWorkflowCard
                  key={sub.subscription_id}
                  sub={sub}
                  investorId={investorId}
                  canManage={canManage}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Distributions Tab ──────────────────────────────────── */}
        <TabsContent value="distributions">
          <Card>
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
                            <Badge variant="outline" className="text-xs">
                              {statusLabel(d.distribution_type)}
                            </Badge>
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
                      <TableRow className="border-t-2">
                        <TableCell colSpan={3} className="text-sm font-semibold">
                          Total Distributions
                        </TableCell>
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
        </TabsContent>

        {/* ── Documents Tab ──────────────────────────────────────── */}
        <TabsContent value="documents">
          <div className="space-y-4">
            {canManage && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload Document
                </Button>
              </div>
            )}
            <DocumentList investorId={investorId} />
          </div>
        </TabsContent>

        {/* ── Messages Tab ───────────────────────────────────────── */}
        <TabsContent value="messages">
          <Card>
            <CardHeader>
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
                    <div key={msg.message_id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{msg.subject}</p>
                        {!msg.is_read && <Badge variant="default">Unread</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{msg.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(msg.sent_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Profile Tab ────────────────────────────────────────── */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Investor Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Full Name", value: investor.name },
                  { label: "Email", value: investor.email },
                  { label: "Phone", value: investor.phone },
                  { label: "Address", value: investor.address },
                  { label: "Entity Type", value: investor.entity_type ? statusLabel(investor.entity_type) : null },
                  { label: "Accredited Status", value: investor.accredited_status ? statusLabel(investor.accredited_status) : null },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="text-sm">{value || "—"}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
