"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  AlertTriangle,
  Shield,
  ExternalLink,
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
import { investors as investorsApi, apiClient } from "@/lib/api";
import { Phone, Calendar, MessageSquare, Pencil } from "lucide-react";
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

// ── Payment & Compliance Section (editable by Admin) ───────────────
function PaymentComplianceSection({ sub }: { sub: Subscription }) {
  const queryClient = useQueryClient();
  const updateSub = useUpdateSubscription();

  const [complianceNotes, setComplianceNotes] = useState(sub.compliance_notes || "");
  const [saving, setSaving] = useState(false);

  // Payment ledger
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: "", payment_method: "wire", reference_number: "", received_date: "", cleared: false, source_description: "", notes: "" });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["sub-payments", sub.subscription_id],
    queryFn: () => apiClient.get(`/api/investment/subscriptions/${sub.subscription_id}/payments`).then(r => r.data),
  });

  const totalReceived = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalCleared = payments.filter((p: any) => p.cleared).reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const remaining = Number(sub.commitment_amount) - totalCleared;

  const addPayment = async () => {
    if (!newPayment.amount || !newPayment.received_date) { alert("Amount and date required"); return; }
    setSaving(true);
    try {
      await apiClient.post(`/api/investment/subscriptions/${sub.subscription_id}/payments`, newPayment);
      queryClient.invalidateQueries({ queryKey: ["sub-payments", sub.subscription_id] });
      queryClient.invalidateQueries({ queryKey: ["investor-subscriptions"] });
      setNewPayment({ amount: "", payment_method: "wire", reference_number: "", received_date: "", cleared: false, source_description: "", notes: "" });
      setShowAddPayment(false);
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed to add payment"); }
    finally { setSaving(false); }
  };

  const deletePayment = async (paymentId: number) => {
    if (!confirm("Delete this payment?")) return;
    await apiClient.delete(`/api/investment/subscriptions/payments/${paymentId}`);
    queryClient.invalidateQueries({ queryKey: ["sub-payments", sub.subscription_id] });
    queryClient.invalidateQueries({ queryKey: ["investor-subscriptions"] });
  };

  const toggleCleared = async (p: any) => {
    await apiClient.patch(`/api/investment/subscriptions/payments/${p.payment_id}`, { ...p, cleared: !p.cleared, cleared_date: !p.cleared ? new Date().toISOString().slice(0, 10) : null });
    queryClient.invalidateQueries({ queryKey: ["sub-payments", sub.subscription_id] });
    queryClient.invalidateQueries({ queryKey: ["investor-subscriptions"] });
  };

  const approveCompliance = () => {
    setSaving(true);
    updateSub.mutate(
      { subId: sub.subscription_id, lpId: sub.lp_id, data: { compliance_approved: true, compliance_approved_at: new Date().toISOString(), compliance_notes: complianceNotes || null } },
      { onSettled: () => setSaving(false), onError: () => alert("Failed to approve compliance") }
    );
  };

  const METHOD_LABELS: Record<string, string> = { wire: "Wire", etransfer: "E-Transfer", cheque: "Cheque", ach: "ACH", bank_draft: "Bank Draft" };

  return (
    <div className="mb-4 space-y-3">
      {/* Payment Ledger */}
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Payments
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Received: <span className="font-medium text-foreground">{formatCurrency(totalReceived)}</span></span>
            <span className="text-muted-foreground">Cleared: <span className="font-medium text-green-600">{formatCurrency(totalCleared)}</span></span>
            <span className="text-muted-foreground">Remaining: <span className={`font-medium ${remaining > 0 ? "text-amber-600" : "text-green-600"}`}>{formatCurrency(Math.max(remaining, 0))}</span></span>
          </div>
        </div>

        {/* Payment List */}
        {payments.length > 0 && (
          <div className="space-y-1 mb-2">
            {payments.map((p: any) => (
              <div key={p.payment_id} className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-xs ${p.cleared ? "bg-green-50/50 border-green-200" : "bg-amber-50/50 border-amber-200"}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleCleared(p)} className={`h-4 w-4 rounded border-2 flex items-center justify-center ${p.cleared ? "border-green-500 bg-green-50" : "border-gray-300"}`}>
                    {p.cleared && <Check className="h-2.5 w-2.5 text-green-600" />}
                  </button>
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                  <span className="text-muted-foreground">{METHOD_LABELS[p.payment_method] || p.payment_method}</span>
                  {p.reference_number && <span className="text-muted-foreground font-mono">#{p.reference_number}</span>}
                  {p.source_description && <span className="text-muted-foreground">({p.source_description})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{p.received_date}</span>
                  <button onClick={() => deletePayment(p.payment_id)} className="text-muted-foreground/50 hover:text-red-500"><Ban className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Payment Form */}
        {showAddPayment ? (
          <div className="rounded border border-blue-200 bg-blue-50/30 p-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground">Amount *</label>
                <input type="number" step="0.01" value={newPayment.amount} onChange={(e) => setNewPayment(p => ({...p, amount: e.target.value}))} placeholder="0.00" className="w-full rounded border bg-background px-2 py-1.5 text-xs" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground">Method</label>
                <select value={newPayment.payment_method} onChange={(e) => setNewPayment(p => ({...p, payment_method: e.target.value}))} className="w-full rounded border bg-background px-2 py-1.5 text-xs">
                  <option value="wire">Wire Transfer</option>
                  <option value="etransfer">E-Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="ach">ACH</option>
                  <option value="bank_draft">Bank Draft</option>
                </select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground">Date Received *</label>
                <input type="date" value={newPayment.received_date} onChange={(e) => setNewPayment(p => ({...p, received_date: e.target.value}))} className="w-full rounded border bg-background px-2 py-1.5 text-xs" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground">Reference #</label>
                <input type="text" value={newPayment.reference_number} onChange={(e) => setNewPayment(p => ({...p, reference_number: e.target.value}))} placeholder="Optional" className="w-full rounded border bg-background px-2 py-1.5 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground">Source</label>
                <input type="text" value={newPayment.source_description} onChange={(e) => setNewPayment(p => ({...p, source_description: e.target.value}))} placeholder="e.g. RBC account, TD Wire" className="w-full rounded border bg-background px-2 py-1.5 text-xs" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground">Notes</label>
                <input type="text" value={newPayment.notes} onChange={(e) => setNewPayment(p => ({...p, notes: e.target.value}))} placeholder="Optional" className="w-full rounded border bg-background px-2 py-1.5 text-xs" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={newPayment.cleared} onChange={(e) => setNewPayment(p => ({...p, cleared: e.target.checked}))} className="rounded" />
                Funds cleared
              </label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddPayment(false)}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={addPayment}>{saving ? "Adding..." : "Add Payment"}</Button>
              </div>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs w-full gap-1" onClick={() => setShowAddPayment(true)}>
            <Plus className="h-3 w-3" /> Record Payment
          </Button>
        )}
      </div>

      {/* Compliance Approval */}
      <div className={`rounded-md border p-3 ${sub.compliance_approved ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> Compliance Approval
        </p>
        {sub.compliance_approved ? (
          <div className="flex items-center gap-2 text-xs text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Approved</span>
            {sub.compliance_approved_at && <span>on {formatDate(sub.compliance_approved_at)}</span>}
            {sub.compliance_notes && <span className="text-muted-foreground">— {sub.compliance_notes}</span>}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span>Compliance has not been approved for this subscription</span>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-muted-foreground">Notes (optional)</label>
                <input type="text" value={complianceNotes} onChange={(e) => setComplianceNotes(e.target.value)} placeholder="KYC verified, accreditation confirmed..." className="w-full rounded border bg-background px-2 py-1.5 text-xs" />
              </div>
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1" disabled={saving} onClick={approveCompliance}>
                <CheckCircle2 className="h-3 w-3" />
                {saving ? "Approving..." : "Approve Compliance"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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

  // Compute effective step based on ACTUAL state, not just the status field
  const statusStepIdx = WORKFLOW_STEPS.findIndex((s) => s.status === sub.status);
  const isTerminal = ["closed", "rejected", "withdrawn", "cancelled"].includes(sub.status);
  const fullyFunded = Number(sub.funded_amount) >= Number(sub.commitment_amount) && Number(sub.funded_amount) > 0;
  const complianceOk = sub.compliance_approved === true;

  // Effective step: the highest step that is actually validated
  let effectiveStepIdx = statusStepIdx;
  if (!isTerminal && statusStepIdx >= 0) {
    // accepted (idx 3) requires compliance approval
    const acceptedIdx = WORKFLOW_STEPS.findIndex(s => s.status === "accepted");
    if (statusStepIdx >= acceptedIdx && !complianceOk) {
      effectiveStepIdx = Math.min(statusStepIdx, acceptedIdx - 1); // cap at under_review
    }
    // funded (idx 4) requires full funding
    const fundedIdx = WORKFLOW_STEPS.findIndex(s => s.status === "funded");
    if (statusStepIdx >= fundedIdx && !fullyFunded) {
      effectiveStepIdx = Math.min(effectiveStepIdx, fundedIdx - 1); // cap at accepted
    }
    // issued (idx 5) requires both compliance + funding
    const issuedIdx = WORKFLOW_STEPS.findIndex(s => s.status === "issued");
    if (statusStepIdx >= issuedIdx && (!complianceOk || !fullyFunded)) {
      effectiveStepIdx = Math.min(effectiveStepIdx, issuedIdx - 1);
    }
  }

  const currentStepIdx = effectiveStepIdx;
  const isComplete = sub.status === "issued" && complianceOk && fullyFunded;
  const nextAction = isComplete ? undefined : NEXT_ACTION[WORKFLOW_STEPS[currentStepIdx]?.status || sub.status];
  const progressPercent = isTerminal
    ? isComplete ? 100 : 0
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
          {isComplete ? (
            <Badge variant="default" className="bg-green-600">Issued</Badge>
          ) : isTerminal ? (
            <Badge variant="destructive">{statusLabel(sub.status)}</Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-300">
              Pending
            </Badge>
          )}
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

          {/* Payment & Compliance (Admin only — editable) */}
          {canManage && (
            <PaymentComplianceSection sub={sub} />
          )}

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
                      {/* @ts-expect-error radix-ui asChild type */}
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
                    {/* @ts-expect-error radix-ui asChild type */}
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

          {/* Status Summary */}
          <div className="border-t pt-4">
            {isComplete ? (
              <div className="rounded-md border border-green-300 bg-green-50 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-800">
                    Subscription complete. {sub.unit_quantity ? `${Number(sub.unit_quantity).toLocaleString()} units` : ""} issued to investor.
                  </p>
                </div>
              </div>
            ) : isTerminal ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-red-500" />
                  <p className="text-sm font-medium text-red-700">
                    Subscription {sub.status}. No units were issued.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800">
                    Subscription pending — currently at &ldquo;{statusLabel(sub.status)}&rdquo; stage.
                    {!sub.compliance_approved && " Compliance approval required."}
                    {Number(sub.funded_amount) < Number(sub.commitment_amount) && ` Funded ${formatCurrency(sub.funded_amount)} of ${formatCurrency(sub.commitment_amount)}.`}
                  </p>
                </div>
              </div>
            )}
          </div>
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
      {/* @ts-expect-error radix-ui asChild type */}
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

  const canManage = user?.role === "DEVELOPER" || user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";
  const isAdmin = canManage;

  // Compliance check (admin only)
  const { data: compliance } = useQuery({
    queryKey: ["investor-compliance", investorId],
    queryFn: () => apiClient.get(`/api/investor/investors/${investorId}/compliance`).then(r => r.data),
    enabled: isAdmin,
  });

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

      {/* Compliance Summary (Admin Only) */}
      {isAdmin && compliance && (
        <Card className={`mb-4 border-l-4 ${compliance.subscription_ready?.ready ? "border-l-green-500" : "border-l-amber-500"}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Compliance & Readiness</span>
              </div>
              <Link href={`/investor-onboarding?investor=${investorId}`}>
                <Button variant="outline" size="sm" className="text-xs gap-1">
                  <ExternalLink className="h-3 w-3" /> CRM Profile
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="text-center rounded-md border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Onboarding</p>
                <Badge variant={compliance.onboarding_status === "active" ? "default" : "secondary"} className="text-[10px] mt-0.5">
                  {compliance.onboarding_status?.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="text-center rounded-md border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Accreditation</p>
                <Badge variant={compliance.accredited_status === "accredited" ? "default" : compliance.accredited_status === "pending" ? "secondary" : "destructive"} className="text-[10px] mt-0.5">
                  {compliance.accredited_status}
                </Badge>
              </div>
              <div className="text-center rounded-md border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Checklist</p>
                <p className="text-sm font-bold mt-0.5">{compliance.checklist_progress}</p>
              </div>
              <div className="text-center rounded-md border p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Documents</p>
                <p className="text-sm font-bold mt-0.5">{compliance.documents_on_file?.length || 0}</p>
              </div>
            </div>
            {/* Warnings */}
            {(compliance.subscription_ready?.warnings?.length > 0 || compliance.funding_ready?.warnings?.length > 0 || compliance.issuance_ready?.warnings?.length > 0) && (
              <div className="space-y-1">
                {[
                  ...(compliance.subscription_ready?.warnings || []),
                  ...(compliance.funding_ready?.warnings || []).filter((w: string) => !(compliance.subscription_ready?.warnings || []).includes(w)),
                  ...(compliance.issuance_ready?.warnings || []).filter((w: string) => !(compliance.funding_ready?.warnings || []).includes(w)),
                ].map((warning: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
            {compliance.subscription_ready?.ready && compliance.funding_ready?.ready && compliance.issuance_ready?.ready && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>All compliance checks passed — ready for subscription, funding, and issuance</span>
              </div>
            )}
          </CardContent>
        </Card>
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
          <TabsTrigger value="crm">
            <Clock className="mr-1.5 h-4 w-4" />
            CRM Activity
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
        {/* ── CRM Activity Tab ────────────────────────────────── */}
        <TabsContent value="crm">
          <CRMActivityTab investorId={investorId} />
        </TabsContent>

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


// ── CRM Activity Tab (embedded in investor detail) ─────────────────────

const ACTIVITY_TYPES = [
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Calendar },
  { value: "note", label: "Note", icon: FileText },
  { value: "follow_up", label: "Follow-up", icon: Clock },
];

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  follow_up: Clock,
  document: FileText,
  status_change: Check,
  task: CheckCircle2,
};

function CRMActivityTab({ investorId }: { investorId: number }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    activity_type: "call",
    subject: "",
    body: "",
    outcome: "",
    follow_up_date: "",
    follow_up_notes: "",
    meeting_date: "",
    meeting_location: "",
    attendees: "",
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["crm-activities", investorId],
    queryFn: () => investorsApi.getActivities(investorId),
    enabled: !!investorId,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ["crm-followups", investorId],
    queryFn: () => investorsApi.getFollowUps(investorId),
    enabled: !!investorId,
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => investorsApi.createActivity(investorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities", investorId] });
      queryClient.invalidateQueries({ queryKey: ["crm-followups", investorId] });
      setForm({ activity_type: "call", subject: "", body: "", outcome: "", follow_up_date: "", follow_up_notes: "", meeting_date: "", meeting_location: "", attendees: "" });
      setShowForm(false);
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: (activityId: number) => investorsApi.updateActivity(activityId, { is_follow_up_done: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities", investorId] });
      queryClient.invalidateQueries({ queryKey: ["crm-followups", investorId] });
    },
  });

  const pendingFollowUps = followUps.filter((f: any) => !f.is_follow_up_done);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Quick stats + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{activities.length}</p>
            <p className="text-xs text-muted-foreground">Activities</p>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingFollowUps.length}</p>
            <p className="text-xs text-muted-foreground">Follow-ups</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/investor-onboarding">
            <Button variant="outline" size="sm">
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
              CRM Board
            </Button>
          </Link>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {showForm ? "Cancel" : "Log Activity"}
          </Button>
        </div>
      </div>

      {/* Log Activity Form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs">Type</Label>
                <Select value={form.activity_type} onValueChange={(v) => setForm((f) => ({ ...f, activity_type: v ?? "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <Label className="text-xs">Subject</Label>
                <Input className="mt-1" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Brief description" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea className="mt-1" rows={3} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Details of the interaction..." />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Outcome</Label>
                <Input className="mt-1" value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} placeholder="e.g. Left voicemail" />
              </div>
              <div>
                <Label className="text-xs">Follow-up Date</Label>
                <Input type="date" className="mt-1" value={form.follow_up_date} onChange={(e) => setForm((f) => ({ ...f, follow_up_date: e.target.value }))} />
              </div>
              {form.activity_type === "meeting" && (
                <>
                  <div>
                    <Label className="text-xs">Meeting Date</Label>
                    <Input type="datetime-local" className="mt-1" value={form.meeting_date} onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Location</Label>
                    <Input className="mt-1" value={form.meeting_location} onChange={(e) => setForm((f) => ({ ...f, meeting_location: e.target.value }))} placeholder="Office / Zoom" />
                  </div>
                </>
              )}
            </div>
            <Button size="sm" onClick={() => createMutation.mutate(form)} disabled={!form.subject || createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Activity"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Follow-ups */}
      {pendingFollowUps.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <Clock className="h-4 w-4" />
              Pending Follow-ups ({pendingFollowUps.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingFollowUps.map((fu: any) => {
              const isOverdue = fu.follow_up_date < today;
              return (
                <div key={fu.activity_id} className={`flex items-center justify-between rounded-md border p-2 ${isOverdue ? "border-red-300 bg-red-50" : "bg-white"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{fu.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {fu.follow_up_date} {isOverdue && <Badge variant="destructive" className="ml-1 text-[10px]">Overdue</Badge>}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => markDoneMutation.mutate(fu.activity_id)}>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Activity Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activities logged yet. Click "Log Activity" to start tracking interactions.</p>
          ) : (
            <div className="space-y-0">
              {activities.map((a: any, idx: number) => {
                const TypeIcon = ACTIVITY_ICONS[a.activity_type] || MessageSquare;
                const iconColors: Record<string, string> = {
                  call: "text-blue-600 bg-blue-50",
                  email: "text-purple-600 bg-purple-50",
                  meeting: "text-green-600 bg-green-50",
                  note: "text-gray-600 bg-gray-50",
                  follow_up: "text-amber-600 bg-amber-50",
                  status_change: "text-emerald-600 bg-emerald-50",
                };
                const color = iconColors[a.activity_type] || "text-gray-600 bg-gray-50";

                return (
                  <div key={a.activity_id} className="flex gap-3 py-3 border-b last:border-0">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      {idx < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{a.subject}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : ""}
                        </span>
                      </div>
                      {a.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>}
                      {a.outcome && (
                        <p className="text-xs mt-1">
                          <span className="font-medium">Outcome:</span> {a.outcome}
                        </p>
                      )}
                      {a.follow_up_date && (
                        <p className="text-xs text-amber-600 mt-1">
                          <Clock className="inline h-3 w-3 mr-0.5" />
                          Follow-up: {a.follow_up_date}
                          {a.is_follow_up_done && <Badge className="ml-1 text-[9px] bg-green-100 text-green-700">Done</Badge>}
                        </p>
                      )}
                      {a.created_by && <p className="text-[10px] text-muted-foreground mt-1">by {a.created_by}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
