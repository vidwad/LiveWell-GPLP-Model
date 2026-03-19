"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus,
  Mail,
  FileCheck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

type OnboardingStatus =
  | "lead"
  | "invited"
  | "documents_pending"
  | "under_review"
  | "approved"
  | "active"
  | "suspended"
  | "rejected";

interface InvestorRecord {
  investor_id: number;
  name: string;
  email: string;
  phone?: string | null;
  entity_type?: string | null;
  onboarding_status: OnboardingStatus;
  [key: string]: unknown;
}

interface ChecklistItem {
  item_id: number;
  label: string;
  is_required: boolean;
  is_completed: boolean;
}

interface OnboardingDetail {
  investor: InvestorRecord;
  checklist: ChecklistItem[];
  completed_steps: number;
  total_steps: number;
  required_steps: number;
  completed_required: number;
  is_ready_for_approval: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

const STAGES: { key: OnboardingStatus; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { key: "lead", label: "Lead", color: "text-gray-700", bgColor: "bg-gray-100", borderColor: "border-gray-300" },
  { key: "invited", label: "Invited", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-300" },
  { key: "documents_pending", label: "Documents Pending", color: "text-yellow-700", bgColor: "bg-yellow-50", borderColor: "border-yellow-300" },
  { key: "under_review", label: "Under Review", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-300" },
  { key: "approved", label: "Approved", color: "text-green-700", bgColor: "bg-green-50", borderColor: "border-green-300" },
  { key: "active", label: "Active", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-300" },
  { key: "suspended", label: "Suspended", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-300" },
  { key: "rejected", label: "Rejected", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-300" },
];

const KANBAN_STAGES: OnboardingStatus[] = ["lead", "invited", "documents_pending", "under_review", "approved"];

const STAGE_ACTIONS: Record<string, { label: string; nextStatus: OnboardingStatus; icon: React.ElementType }> = {
  lead: { label: "Send Invite", nextStatus: "invited", icon: Mail },
  invited: { label: "Start Documents", nextStatus: "documents_pending", icon: FileCheck },
  documents_pending: { label: "Submit for Review", nextStatus: "under_review", icon: ShieldCheck },
  under_review: { label: "Approve", nextStatus: "approved", icon: CheckCircle2 },
  approved: { label: "Activate", nextStatus: "active", icon: CheckCircle2 },
};

const ENTITY_LABELS: Record<string, string> = {
  individual: "Individual",
  corporation: "Corporation",
  trust: "Trust",
  partnership: "Partnership",
};

// ── API helpers ──────────────────────────────────────────────────────

function fetchInvestors(): Promise<InvestorRecord[]> {
  return apiClient.get("/api/investment/investors").then((r) => {
    const data = r.data;
    if (Array.isArray(data)) return data;
    return data.items ?? [];
  });
}

function fetchOnboardingDetail(investorId: number): Promise<OnboardingDetail> {
  return apiClient.get(`/api/investor/investors/${investorId}/onboarding`).then((r) => r.data);
}

function transitionStatus(investorId: number, newStatus: string) {
  return apiClient.patch(`/api/investor/investors/${investorId}/onboarding/status`, { new_status: newStatus }).then((r) => r.data);
}

function updateChecklistItem(investorId: number, itemId: number, isCompleted: boolean) {
  return apiClient.patch(`/api/investor/investors/${investorId}/onboarding/checklist/${itemId}`, { is_completed: isCompleted }).then((r) => r.data);
}

// ── Main Page ────────────────────────────────────────────────────────

export default function InvestorOnboardingPage() {
  const queryClient = useQueryClient();
  const [selectedInvestorId, setSelectedInvestorId] = useState<number | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", email: "", phone: "", lp_id: "", indicated_amount: "", source: "", notes: "" });

  // Fetch all investors
  const { data: investors, isLoading: investorsLoading } = useQuery({
    queryKey: ["onboarding-investors"],
    queryFn: fetchInvestors,
  });

  // Fetch onboarding detail for selected investor
  const { data: onboardingDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["onboarding-detail", selectedInvestorId],
    queryFn: () => fetchOnboardingDetail(selectedInvestorId!),
    enabled: !!selectedInvestorId,
  });

  // Transition mutation
  const transitionMutation = useMutation({
    mutationFn: ({ investorId, newStatus }: { investorId: number; newStatus: string }) =>
      transitionStatus(investorId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-detail"] });
    },
  });

  // LP list for IOI dropdown
  const { data: lps } = useQuery({
    queryKey: ["lps-for-ioi"],
    queryFn: () => apiClient.get("/api/investment/lp").then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : d.items;
    }),
  });

  // Quick-add lead mutation
  const addLeadMutation = useMutation({
    mutationFn: (params: Record<string, string | number>) =>
      apiClient.post("/api/investor/leads/quick-add", null, { params }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
      setLeadForm({ name: "", email: "", phone: "", lp_id: "", indicated_amount: "", source: "", notes: "" });
      setShowAddLead(false);
    },
  });

  // Checklist mutation
  const checklistMutation = useMutation({
    mutationFn: ({ investorId, itemId, isCompleted }: { investorId: number; itemId: number; isCompleted: boolean }) =>
      updateChecklistItem(investorId, itemId, isCompleted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-detail", selectedInvestorId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
    },
  });

  // Group investors by status
  const grouped = useMemo(() => {
    const map: Record<OnboardingStatus, InvestorRecord[]> = {
      lead: [],
      invited: [],
      documents_pending: [],
      under_review: [],
      approved: [],
      active: [],
      suspended: [],
      rejected: [],
    };
    if (investors) {
      for (const inv of investors) {
        const status = inv.onboarding_status ?? "lead";
        if (map[status]) {
          map[status].push(inv);
        }
      }
    }
    return map;
  }, [investors]);

  const closeDrawer = useCallback(() => setSelectedInvestorId(null), []);

  if (investorsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Investor Onboarding</h1>
          <p className="text-muted-foreground">Manage the investor onboarding pipeline</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investor CRM & Onboarding</h1>
          <p className="text-muted-foreground">Pipeline from lead capture through to active investor</p>
        </div>
        <Button onClick={() => setShowAddLead(!showAddLead)} variant={showAddLead ? "secondary" : "default"}>
          <UserPlus className="h-4 w-4 mr-2" />
          {showAddLead ? "Cancel" : "Add Lead"}
        </Button>
      </div>

      {/* Quick-Add Lead Form */}
      {showAddLead && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Quick-Add Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name *</label>
                <input type="text" value={leadForm.name} onChange={e => setLeadForm(f => ({...f, name: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm" placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email *</label>
                <input type="email" value={leadForm.email} onChange={e => setLeadForm(f => ({...f, email: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm" placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone</label>
                <input type="tel" value={leadForm.phone} onChange={e => setLeadForm(f => ({...f, phone: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm" placeholder="403-555-1234" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Source</label>
                <select value={leadForm.source} onChange={e => setLeadForm(f => ({...f, source: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  <option value="referral">Referral</option>
                  <option value="website">Website</option>
                  <option value="event">Event</option>
                  <option value="cold_outreach">Cold Outreach</option>
                  <option value="existing_investor">Existing Investor</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Interested LP</label>
                <select value={leadForm.lp_id} onChange={e => setLeadForm(f => ({...f, lp_id: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm">
                  <option value="">No LP yet</option>
                  {(lps || []).map((lp: { lp_id: number; name: string }) => (
                    <option key={lp.lp_id} value={lp.lp_id}>{lp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Indicated Amount ($)</label>
                <input type="number" step="any" value={leadForm.indicated_amount}
                  onChange={e => setLeadForm(f => ({...f, indicated_amount: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm" placeholder="250,000" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <input type="text" value={leadForm.notes} onChange={e => setLeadForm(f => ({...f, notes: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm" placeholder="How did they hear about us?" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                onClick={() => {
                  const params: Record<string, string | number> = { name: leadForm.name, email: leadForm.email };
                  if (leadForm.phone) params.phone = leadForm.phone;
                  if (leadForm.source) params.source = leadForm.source;
                  if (leadForm.notes) params.notes = leadForm.notes;
                  if (leadForm.lp_id) params.lp_id = parseInt(leadForm.lp_id);
                  if (leadForm.indicated_amount) params.indicated_amount = parseFloat(leadForm.indicated_amount);
                  addLeadMutation.mutate(params);
                }}
                disabled={!leadForm.name || !leadForm.email || addLeadMutation.isPending}
                size="sm"
              >
                {addLeadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                Add Lead{leadForm.indicated_amount ? ` with $${parseInt(leadForm.indicated_amount).toLocaleString()} IOI` : ""}
              </Button>
              {addLeadMutation.isSuccess && (
                <span className="text-sm text-green-600 flex items-center"><CheckCircle2 className="h-4 w-4 mr-1" /> Lead added!</span>
              )}
              {addLeadMutation.isError && (
                <span className="text-sm text-red-600">Error adding lead. Check if email already exists.</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {STAGES.map((stage) => (
          <Card key={stage.key} className={`${stage.borderColor} border`}>
            <CardContent className="p-3">
              <p className={`text-[10px] font-medium uppercase tracking-wider ${stage.color}`}>
                {stage.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${stage.color}`}>
                {grouped[stage.key]?.length ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kanban Board + Drawer container */}
      <div className="relative flex gap-4">
        {/* Kanban Board */}
        <div className={`flex-1 overflow-x-auto transition-all ${selectedInvestorId ? "lg:mr-[420px]" : ""}`}>
          <div className="grid gap-4 lg:grid-cols-5" style={{ minWidth: "900px" }}>
            {KANBAN_STAGES.map((stageKey) => {
              const stageMeta = STAGES.find((s) => s.key === stageKey)!;
              const stageInvestors = grouped[stageKey] ?? [];

              return (
                <div key={stageKey} className="flex flex-col">
                  {/* Column header */}
                  <div className={`mb-3 rounded-lg px-3 py-2 ${stageMeta.bgColor}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${stageMeta.color}`}>
                        {stageMeta.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {stageInvestors.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Investor cards */}
                  <div className="space-y-2">
                    {stageInvestors.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        No investors
                      </div>
                    ) : (
                      stageInvestors.map((inv) => (
                        <InvestorKanbanCard
                          key={inv.investor_id}
                          investor={inv}
                          stage={stageKey}
                          isSelected={selectedInvestorId === inv.investor_id}
                          onSelect={() => setSelectedInvestorId(inv.investor_id)}
                          onTransition={(newStatus) =>
                            transitionMutation.mutate({ investorId: inv.investor_id, newStatus })
                          }
                          isTransitioning={transitionMutation.isPending}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Drawer */}
        {selectedInvestorId && (
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l bg-background shadow-lg lg:absolute lg:inset-y-auto lg:top-0 lg:h-full lg:w-[420px]">
            <InvestorDetailDrawer
              investorId={selectedInvestorId}
              detail={onboardingDetail ?? null}
              isLoading={detailLoading}
              onClose={closeDrawer}
              onTransition={(newStatus) =>
                transitionMutation.mutate({ investorId: selectedInvestorId, newStatus })
              }
              onChecklistToggle={(itemId, isCompleted) =>
                checklistMutation.mutate({ investorId: selectedInvestorId, itemId, isCompleted })
              }
              isTransitioning={transitionMutation.isPending}
              isChecklistUpdating={checklistMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Kanban Card ──────────────────────────────────────────────────────

function InvestorKanbanCard({
  investor,
  stage,
  isSelected,
  onSelect,
  onTransition,
  isTransitioning,
}: {
  investor: InvestorRecord;
  stage: OnboardingStatus;
  isSelected: boolean;
  onSelect: () => void;
  onTransition: (newStatus: string) => void;
  isTransitioning: boolean;
}) {
  const action = STAGE_ACTIONS[stage];
  const ActionIcon = action?.icon;

  // Fetch minimal onboarding detail for progress bar
  const { data: detail } = useQuery({
    queryKey: ["onboarding-detail", investor.investor_id],
    queryFn: () => fetchOnboardingDetail(investor.investor_id),
    staleTime: 60_000,
  });

  const progressPercent = detail ? Math.round((detail.completed_steps / Math.max(detail.total_steps, 1)) * 100) : 0;
  const canApprove = stage !== "under_review" || detail?.is_ready_for_approval;

  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onSelect}
    >
      <CardContent className="p-3 space-y-2">
        {/* Name & email */}
        <div>
          <p className="text-sm font-medium leading-tight truncate">{investor.name}</p>
          <p className="text-xs text-muted-foreground truncate">{investor.email}</p>
        </div>

        {/* Entity type badge */}
        {investor.entity_type && (
          <Badge variant="outline" className="text-[10px]">
            {ENTITY_LABELS[investor.entity_type] ?? investor.entity_type}
          </Badge>
        )}

        {/* Progress */}
        {detail && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Checklist</span>
              <span>{detail.completed_steps}/{detail.total_steps}</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        )}

        {/* Action button */}
        {action && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-7"
            disabled={isTransitioning || !canApprove}
            onClick={(e) => {
              e.stopPropagation();
              onTransition(action.nextStatus);
            }}
          >
            {isTransitioning ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : ActionIcon ? (
              <ActionIcon className="mr-1 h-3 w-3" />
            ) : null}
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Detail Drawer ────────────────────────────────────────────────────

function InvestorDetailDrawer({
  investorId,
  detail,
  isLoading,
  onClose,
  onTransition,
  onChecklistToggle,
  isTransitioning,
  isChecklistUpdating,
}: {
  investorId: number;
  detail: OnboardingDetail | null;
  isLoading: boolean;
  onClose: () => void;
  onTransition: (newStatus: string) => void;
  onChecklistToggle: (itemId: number, isCompleted: boolean) => void;
  isTransitioning: boolean;
  isChecklistUpdating: boolean;
}) {
  if (isLoading || !detail) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <Skeleton className="h-6 w-40" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  const investor = detail.investor;
  const currentStage = investor.onboarding_status;
  const currentStageMeta = STAGES.find((s) => s.key === currentStage);
  const action = STAGE_ACTIONS[currentStage];
  const canApprove = currentStage !== "under_review" || detail.is_ready_for_approval;
  const progressPercent = Math.round((detail.completed_steps / Math.max(detail.total_steps, 1)) * 100);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Drawer header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold truncate">{investor.name}</h2>
          <p className="text-sm text-muted-foreground truncate">{investor.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="ml-2 shrink-0">
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status & entity info */}
        <div className="flex flex-wrap items-center gap-2">
          {currentStageMeta && (
            <Badge className={`${currentStageMeta.bgColor} ${currentStageMeta.color} border ${currentStageMeta.borderColor}`}>
              {currentStageMeta.label}
            </Badge>
          )}
          {investor.entity_type && (
            <Badge variant="outline">
              {ENTITY_LABELS[investor.entity_type] ?? investor.entity_type}
            </Badge>
          )}
        </div>

        {/* Progress summary */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Onboarding Progress</span>
              <span className="text-muted-foreground">
                {detail.completed_steps}/{detail.total_steps} steps
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Required: {detail.completed_required}/{detail.required_steps}</span>
              {detail.is_ready_for_approval && (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready for approval
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Onboarding Checklist</h3>
          <div className="space-y-1">
            {detail.checklist.map((item) => (
              <label
                key={item.item_id}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={item.is_completed}
                  disabled={isChecklistUpdating}
                  onChange={(e) => onChecklistToggle(item.item_id, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className={`text-sm ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                    {item.label}
                  </span>
                  {item.is_required && (
                    <span className="ml-2 text-[10px] font-medium text-red-500">Required</span>
                  )}
                </div>
                {item.is_completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </label>
            ))}
            {detail.checklist.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No checklist items configured
              </p>
            )}
          </div>
        </div>

        {/* Status transition buttons */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Actions</h3>
          <div className="space-y-2">
            {action && (
              <Button
                className="w-full"
                disabled={isTransitioning || !canApprove}
                onClick={() => onTransition(action.nextStatus)}
              >
                {isTransitioning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <action.icon className="mr-2 h-4 w-4" />
                )}
                {action.label}
              </Button>
            )}

            {/* Reject / Suspend for stages that support it */}
            {(currentStage === "under_review" || currentStage === "documents_pending") && (
              <Button
                variant="destructive"
                className="w-full"
                disabled={isTransitioning}
                onClick={() => onTransition("rejected")}
              >
                {isTransitioning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Reject
              </Button>
            )}

            {currentStage === "active" && (
              <Button
                variant="destructive"
                className="w-full"
                disabled={isTransitioning}
                onClick={() => onTransition("suspended")}
              >
                {isTransitioning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Suspend
              </Button>
            )}
          </div>
        </div>

        {/* Timeline of stages */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pipeline Timeline</h3>
          <div className="relative space-y-0">
            {STAGES.filter((s) => !["suspended", "rejected"].includes(s.key)).map((stage, idx, arr) => {
              const isComplete = getStageIndex(currentStage) > idx;
              const isCurrent = stage.key === currentStage;
              const isFuture = !isComplete && !isCurrent;

              return (
                <div key={stage.key} className="flex items-start gap-3 pb-4 last:pb-0">
                  {/* Timeline dot & line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                        isComplete
                          ? "border-green-500 bg-green-500"
                          : isCurrent
                          ? `${stage.borderColor} ${stage.bgColor}`
                          : "border-gray-300 bg-white"
                      }`}
                    />
                    {idx < arr.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[16px] ${isComplete ? "bg-green-300" : "bg-gray-200"}`} />
                    )}
                  </div>
                  {/* Label */}
                  <span
                    className={`text-sm leading-tight ${
                      isComplete
                        ? "text-green-600 font-medium"
                        : isCurrent
                        ? `${stage.color} font-semibold`
                        : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                    {isCurrent && " (Current)"}
                    {isComplete && (
                      <CheckCircle2 className="ml-1 inline h-3 w-3 text-green-500" />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function getStageIndex(status: OnboardingStatus): number {
  const order: OnboardingStatus[] = ["lead", "invited", "documents_pending", "under_review", "approved", "active"];
  return order.indexOf(status);
}
