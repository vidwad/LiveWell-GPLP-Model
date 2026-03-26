"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, investors as investorsApi } from "@/lib/api";
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
  Paperclip,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
  Phone,
  FileText,
  Users,
  Calendar,
  Pencil,
  Save,
  Trash2,
  MessageSquare,
  Maximize2,
  Minimize2,
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
  step_name: string;
  step_label: string;
  label?: string;  // alias for step_label
  is_required: boolean;
  is_completed: boolean;
  document_id: number | null;
  notes: string | null;
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
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    mutationFn: (data: Record<string, string | number>) =>
      apiClient.post("/api/investor/leads/quick-add", data).then(r => r.data),
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

  // Sorted & filtered list for table view
  const sortedInvestors = useMemo(() => {
    let list = investors ?? [];
    if (statusFilter !== "all") {
      list = list.filter((inv) => (inv.onboarding_status ?? "lead") === statusFilter);
    }
    return [...list].sort((a, b) => {
      const aVal = String(a[sortField] ?? "").toLowerCase();
      const bVal = String(b[sortField] ?? "").toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [investors, sortField, sortDir, statusFilter]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  const closeDrawer = useCallback(() => { setSelectedInvestorId(null); setDrawerExpanded(false); }, []);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // ── CSV Mapping Modal State ──
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
  const [csvAllRows, setCsvAllRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const INVESTOR_FIELDS = [
    { key: "", label: "-- Skip --" },
    { key: "name", label: "Name *", required: true },
    { key: "email", label: "Email *", required: true },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "entity_type", label: "Entity Type" },
    { key: "jurisdiction", label: "Jurisdiction" },
    { key: "accredited_status", label: "Accredited Status" },
    { key: "exemption_type", label: "Exemption Type" },
    { key: "tax_id", label: "Tax ID" },
    { key: "banking_info", label: "Banking Info" },
    { key: "onboarding_status", label: "Onboarding Status" },
    { key: "source", label: "Lead Source" },
    { key: "notes", label: "Notes" },
    { key: "indicated_amount", label: "Indicated Amount" },
  ];

  // ── CSV Export ──
  const handleExport = useCallback(() => {
    const list = investors ?? [];
    if (list.length === 0) return;
    const headers = ["investor_id", "name", "email", "phone", "address", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "onboarding_status", "notes", "onboarding_started_at", "onboarding_completed_at", "invited_at", "approved_at", "created_at"];
    const rows = list.map((inv) =>
      headers.map((h) => {
        const val = inv[h] ?? "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `investor_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [investors]);

  // ── Full RFC-4180 CSV parser (handles multi-line quoted fields, commas, newlines) ──
  function parseCsvFull(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          // Check for escaped quote ("")
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
        // Any character inside quotes (including newlines) is part of the field
        field += ch;
        i++;
        continue;
      }

      // Not in quotes
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ',') {
        row.push(field.trim());
        field = "";
        i++;
        continue;
      }
      if (ch === '\r') {
        // Skip \r, handle \r\n as single newline
        i++;
        continue;
      }
      if (ch === '\n') {
        row.push(field.trim());
        field = "";
        if (row.some((cell) => cell !== "")) {
          rows.push(row);
        }
        row = [];
        i++;
        continue;
      }
      field += ch;
      i++;
    }

    // Push last field and row
    row.push(field.trim());
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }

    return rows;
  }

  // ── CSV Import Step 1: Parse file and open mapping modal ──
  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const allParsedRows = parseCsvFull(text);
      if (allParsedRows.length < 2) {
        alert("CSV file must have a header row and at least one data row.");
        return;
      }

      // First row is headers
      const headers = allParsedRows[0].map((h) => h.replace(/['"]/g, "").trim());

      // Remaining rows are data
      const allRows = allParsedRows.slice(1);

      // Auto-map columns by matching header names
      const autoMapping: Record<string, string> = {};
      const fieldKeys = ["name", "email", "phone", "address", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "onboarding_status", "source", "notes", "indicated_amount"];
      headers.forEach((h, idx) => {
        const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, "_");
        for (const fk of fieldKeys) {
          if (normalized === fk || normalized.includes(fk) || fk.includes(normalized)) {
            if (!Object.values(autoMapping).includes(fk)) {
              autoMapping[String(idx)] = fk;
              break;
            }
          }
        }
      });

      setCsvHeaders(headers);
      setCsvPreviewRows(allRows.slice(0, 5));
      setCsvAllRows(allRows);
      setColumnMapping(autoMapping);
      setShowMappingModal(true);
    } catch (err) {
      alert("Failed to read CSV file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  // ── CSV Import Step 2: Execute import with user-defined mapping ──
  const executeImport = useCallback(async () => {
    // Validate required fields are mapped
    const mappedFields = Object.values(columnMapping);
    if (!mappedFields.includes("name") || !mappedFields.includes("email")) {
      alert("You must map both 'Name' and 'Email' columns before importing.");
      return;
    }

    setShowMappingModal(false);
    setImporting(true);

    // Build reverse mapping: field -> column index
    const fieldToCol: Record<string, number> = {};
    for (const [colIdx, field] of Object.entries(columnMapping)) {
      if (field) fieldToCol[field] = parseInt(colIdx);
    }

    let imported = 0;
    let failed = 0;

    for (const row of csvAllRows) {
      const name = row[fieldToCol["name"]] ?? "";
      const email = row[fieldToCol["email"]] ?? "";
      if (!name || !email) { failed++; continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { failed++; continue; }

      const body: Record<string, string | number> = { name, email };
      const optionalFields = ["phone", "address", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "onboarding_status", "source", "notes"];
      for (const field of optionalFields) {
        if (fieldToCol[field] !== undefined && row[fieldToCol[field]]) {
          body[field] = row[fieldToCol[field]];
        }
      }
      if (fieldToCol["indicated_amount"] !== undefined && row[fieldToCol["indicated_amount"]]) {
        body.indicated_amount = parseFloat(row[fieldToCol["indicated_amount"]]);
      }

      try {
        await apiClient.post("/api/investor/leads/quick-add", body);
        imported++;
      } catch {
        failed++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
    setImporting(false);
    setCsvAllRows([]);
    setCsvPreviewRows([]);
    setCsvHeaders([]);
    setColumnMapping({});
    alert(`Import complete: ${imported} added, ${failed} failed (duplicates or errors)`);
  }, [columnMapping, csvAllRows, queryClient]);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Investor CRM & Onboarding</h1>
          <p className="text-muted-foreground">Pipeline from lead capture through to active investor</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "kanban" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
          {/* Import/Export */}
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!investors?.length}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
          <Button onClick={() => setShowAddLead(!showAddLead)} variant={showAddLead ? "secondary" : "default"}>
            <UserPlus className="h-4 w-4 mr-2" />
            {showAddLead ? "Cancel" : "Add Lead"}
          </Button>
        </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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

      {/* Board / Table + Drawer container */}
      <div className="relative flex gap-4">
        {/* Main content area */}
        <div className={`flex-1 overflow-x-auto transition-all ${selectedInvestorId ? (drawerExpanded ? "lg:mr-[65%]" : "lg:mr-[420px]") : ""}`}>

          {/* ── TABLE VIEW ── */}
          {viewMode === "table" && (
            <Card>
              <CardContent className="p-0">
                {/* Filter bar */}
                <div className="flex items-center gap-3 p-3 border-b">
                  <span className="text-xs font-medium text-muted-foreground">Filter:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-md border px-2 py-1 text-xs"
                  >
                    <option value="all">All Statuses ({investors?.length ?? 0})</option>
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label} ({grouped[s.key]?.length ?? 0})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {sortedInvestors.length} investor{sortedInvestors.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {[
                          { key: "name", label: "Name" },
                          { key: "email", label: "Email" },
                          { key: "phone", label: "Phone" },
                          { key: "entity_type", label: "Entity" },
                          { key: "onboarding_status", label: "Status" },
                        ].map((col) => (
                          <th
                            key={col.key}
                            className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                            onClick={() => toggleSort(col.key)}
                          >
                            <span className="flex items-center gap-1">
                              {col.label}
                              <SortIcon field={col.key} />
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedInvestors.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                            No investors match the current filter.
                          </td>
                        </tr>
                      ) : (
                        sortedInvestors.map((inv) => {
                          const status = inv.onboarding_status ?? "lead";
                          const stageMeta = STAGES.find((s) => s.key === status);
                          const action = STAGE_ACTIONS[status];
                          return (
                            <tr
                              key={inv.investor_id}
                              className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                                selectedInvestorId === inv.investor_id ? "bg-primary/5" : ""
                              }`}
                              onClick={() => setSelectedInvestorId(inv.investor_id)}
                            >
                              <td className="px-3 py-2.5 font-medium">{inv.name}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{inv.email}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{inv.phone || "—"}</td>
                              <td className="px-3 py-2.5">
                                {inv.entity_type ? (
                                  <span className="text-xs">{ENTITY_LABELS[inv.entity_type] ?? inv.entity_type}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageMeta?.bgColor} ${stageMeta?.color}`}>
                                  {stageMeta?.label ?? status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                {action && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      transitionMutation.mutate({ investorId: inv.investor_id, newStatus: action.nextStatus });
                                    }}
                                    disabled={transitionMutation.isPending}
                                  >
                                    {action.label}
                                    <ChevronRight className="ml-1 h-3 w-3" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── KANBAN VIEW ── */}
          {viewMode === "kanban" && (
            <div className="grid gap-4 lg:grid-cols-5" style={{ minWidth: "min(900px, max(100%, 600px))" }}>
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
          )}
        </div>

        {/* Detail Drawer */}
        {selectedInvestorId && (
          <div className={`fixed inset-y-0 right-0 z-40 w-full border-l bg-background shadow-lg transition-all duration-200 ${drawerExpanded ? "lg:absolute lg:inset-y-auto lg:top-0 lg:h-full lg:w-[65%]" : "max-w-md lg:absolute lg:inset-y-auto lg:top-0 lg:h-full lg:w-[420px]"}`}>
            <InvestorDetailDrawer
              investorId={selectedInvestorId}
              detail={onboardingDetail ?? null}
              isLoading={detailLoading}
              onClose={closeDrawer}
              isExpanded={drawerExpanded}
              onToggleExpand={() => setDrawerExpanded((e) => !e)}
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

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  follow_up: Calendar,
};

const ACTIVITY_TYPE_OPTIONS = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "follow_up", label: "Follow-up" },
];

const EMPTY_ACTIVITY_FORM = {
  activity_type: "call",
  subject: "",
  body: "",
  outcome: "",
  follow_up_date: "",
  follow_up_notes: "",
  meeting_date: "",
  meeting_location: "",
  meeting_attendees: "",
};

type DrawerTab = "profile" | "activity" | "followups";

function InvestorDetailDrawer({
  investorId,
  detail,
  isLoading,
  onClose,
  onTransition,
  onChecklistToggle,
  isTransitioning,
  isChecklistUpdating,
  isExpanded,
  onToggleExpand,
}: {
  investorId: number;
  detail: OnboardingDetail | null;
  isLoading: boolean;
  onClose: () => void;
  onTransition: (newStatus: string) => void;
  onChecklistToggle: (itemId: number, isCompleted: boolean) => void;
  isTransitioning: boolean;
  isChecklistUpdating: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DrawerTab>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    entity_type: "",
    address: "",
    jurisdiction: "",
    accredited_status: "",
    notes: "",
  });
  const [activityForm, setActivityForm] = useState({ ...EMPTY_ACTIVITY_FORM });
  const [showActivityForm, setShowActivityForm] = useState(false);

  // --- Activities query ---
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["investor-activities", investorId],
    queryFn: () => investorsApi.getActivities(investorId),
    enabled: activeTab === "activity",
  });

  // --- Follow-ups query ---
  const { data: followUps = [], isLoading: followUpsLoading } = useQuery({
    queryKey: ["investor-followups", investorId],
    queryFn: () => investorsApi.getFollowUps(investorId),
    enabled: activeTab === "followups",
  });

  // --- Mutations ---
  const editMutation = useMutation({
    mutationFn: (data: object) => investorsApi.editInvestor(investorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-detail", investorId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
      setIsEditing(false);
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: (data: object) => investorsApi.createActivity(investorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investor-activities", investorId] });
      queryClient.invalidateQueries({ queryKey: ["investor-followups", investorId] });
      setActivityForm({ ...EMPTY_ACTIVITY_FORM });
      setShowActivityForm(false);
    },
  });

  const markFollowUpDoneMutation = useMutation({
    mutationFn: (activityId: number) =>
      investorsApi.updateActivity(activityId, { is_follow_up_done: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investor-followups", investorId] });
      queryClient.invalidateQueries({ queryKey: ["investor-activities", investorId] });
    },
  });

  // --- Handlers ---
  const startEditing = useCallback(() => {
    if (!detail) return;
    const inv = detail.investor;
    setEditForm({
      name: inv.name || "",
      email: inv.email || "",
      phone: (inv.phone as string) || "",
      entity_type: (inv.entity_type as string) || "",
      address: (inv.address as string) || "",
      jurisdiction: (inv.jurisdiction as string) || "",
      accredited_status: (inv.accredited_status as string) || "",
      notes: (inv.notes as string) || "",
    });
    setIsEditing(true);
  }, [detail]);

  const handleSaveProfile = useCallback(() => {
    editMutation.mutate(editForm);
  }, [editMutation, editForm]);

  const handleSubmitActivity = useCallback(() => {
    const payload: Record<string, unknown> = {
      activity_type: activityForm.activity_type,
      subject: activityForm.subject,
      body: activityForm.body || null,
      outcome: activityForm.outcome || null,
      follow_up_date: activityForm.follow_up_date || null,
      follow_up_notes: activityForm.follow_up_notes || null,
    };
    if (activityForm.activity_type === "meeting") {
      payload.meeting_date = activityForm.meeting_date || null;
      payload.meeting_location = activityForm.meeting_location || null;
      payload.meeting_attendees = activityForm.meeting_attendees || null;
    }
    createActivityMutation.mutate(payload);
  }, [createActivityMutation, activityForm]);

  // --- Loading skeleton ---
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
  const progressPercent = Math.round(
    (detail.completed_steps / Math.max(detail.total_steps, 1)) * 100
  );

  const TABS: { key: DrawerTab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "activity", label: "Activity Log" },
    { key: "followups", label: "Follow-ups" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 border-b">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold truncate">{investor.name}</h2>
            <p className="text-xs text-muted-foreground truncate">{investor.email}</p>
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {onToggleExpand && (
              <Button variant="ghost" size="sm" onClick={onToggleExpand} title={isExpanded ? "Collapse" : "Expand"}>
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ================================================================
            TAB 1: PROFILE
        ================================================================ */}
        {activeTab === "profile" && (
          <>
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              {currentStageMeta && (
                <Badge
                  className={`${currentStageMeta.bgColor} ${currentStageMeta.color} border ${currentStageMeta.borderColor}`}
                >
                  {currentStageMeta.label}
                </Badge>
              )}
              {investor.entity_type && (
                <Badge variant="outline">
                  {ENTITY_LABELS[investor.entity_type] ?? investor.entity_type}
                </Badge>
              )}
            </div>

            {/* Editable profile card */}
            <Card>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Investor Details</CardTitle>
                {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={startEditing}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={handleSaveProfile}
                      disabled={editMutation.isPending}
                    >
                      {editMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      disabled={editMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-muted-foreground">Name</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-muted-foreground">Email</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Phone</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Entity Type</label>
                      <select
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.entity_type}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, entity_type: e.target.value }))
                        }
                      >
                        <option value="">-- Select --</option>
                        <option value="individual">Individual</option>
                        <option value="corporation">Corporation</option>
                        <option value="trust">Trust</option>
                        <option value="partnership">Partnership</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Address</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.address}
                        onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Jurisdiction</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.jurisdiction}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, jurisdiction: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Accredited Status</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.accredited_status}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, accredited_status: e.target.value }))
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Notes</label>
                      <textarea
                        rows={3}
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm resize-none"
                        value={editForm.notes}
                        onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Name</span>
                      <p className="truncate">{investor.name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Email</span>
                      <p className="truncate">{investor.email}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Phone</span>
                      <p>{(investor.phone as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Entity Type</span>
                      <p>
                        {investor.entity_type
                          ? ENTITY_LABELS[investor.entity_type] ?? investor.entity_type
                          : "—"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Address</span>
                      <p>{(investor.address as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Jurisdiction</span>
                      <p>{(investor.jurisdiction as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Accredited Status</span>
                      <p>{(investor.accredited_status as string) || "—"}</p>
                    </div>
                    {(investor.notes as string) && (
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">Notes</span>
                        <p className="whitespace-pre-wrap text-xs">{investor.notes as string}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Onboarding status + transition */}
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
                  <span>
                    Required: {detail.completed_required}/{detail.required_steps}
                  </span>
                  {detail.is_ready_for_approval && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Ready for approval
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status transition buttons */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Actions</h3>
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

            {/* Checklist */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Onboarding Checklist</h3>
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
                      <span
                        className={`text-sm ${
                          item.is_completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.step_label || item.label}
                      </span>
                      {item.is_required && (
                        <span className="ml-2 text-[10px] font-medium text-red-500">Required</span>
                      )}
                      {item.document_id && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600">
                          <Paperclip className="h-2.5 w-2.5" />
                          Doc attached
                        </span>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {item.notes}
                        </p>
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
          </>
        )}

        {/* ================================================================
            TAB 2: ACTIVITY LOG
        ================================================================ */}
        {activeTab === "activity" && (
          <>
            {/* Log activity toggle */}
            <div>
              <Button
                size="sm"
                variant={showActivityForm ? "secondary" : "default"}
                onClick={() => setShowActivityForm((v) => !v)}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                {showActivityForm ? "Cancel" : "Log Activity"}
              </Button>
            </div>

            {/* Log activity form */}
            {showActivityForm && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-muted-foreground">Type</label>
                      <select
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={activityForm.activity_type}
                        onChange={(e) =>
                          setActivityForm((f) => ({ ...f, activity_type: e.target.value }))
                        }
                      >
                        {ACTIVITY_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-muted-foreground">Subject</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={activityForm.subject}
                        onChange={(e) =>
                          setActivityForm((f) => ({ ...f, subject: e.target.value }))
                        }
                        placeholder="Brief subject..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Body</label>
                      <textarea
                        rows={3}
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm resize-none"
                        value={activityForm.body}
                        onChange={(e) =>
                          setActivityForm((f) => ({ ...f, body: e.target.value }))
                        }
                        placeholder="Details..."
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-muted-foreground">Outcome</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={activityForm.outcome}
                        onChange={(e) =>
                          setActivityForm((f) => ({ ...f, outcome: e.target.value }))
                        }
                        placeholder="Result of activity..."
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-muted-foreground">Follow-up Date</label>
                      <input
                        type="date"
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={activityForm.follow_up_date}
                        onChange={(e) =>
                          setActivityForm((f) => ({ ...f, follow_up_date: e.target.value }))
                        }
                      />
                    </div>
                    {activityForm.follow_up_date && (
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Follow-up Notes</label>
                        <input
                          className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                          value={activityForm.follow_up_notes}
                          onChange={(e) =>
                            setActivityForm((f) => ({ ...f, follow_up_notes: e.target.value }))
                          }
                          placeholder="What to follow up on..."
                        />
                      </div>
                    )}

                    {/* Meeting-specific fields */}
                    {activityForm.activity_type === "meeting" && (
                      <>
                        <div>
                          <label className="text-xs text-muted-foreground">Meeting Date</label>
                          <input
                            type="datetime-local"
                            className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                            value={activityForm.meeting_date}
                            onChange={(e) =>
                              setActivityForm((f) => ({ ...f, meeting_date: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Location</label>
                          <input
                            className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                            value={activityForm.meeting_location}
                            onChange={(e) =>
                              setActivityForm((f) => ({
                                ...f,
                                meeting_location: e.target.value,
                              }))
                            }
                            placeholder="Location..."
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground">Attendees</label>
                          <input
                            className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                            value={activityForm.meeting_attendees}
                            onChange={(e) =>
                              setActivityForm((f) => ({
                                ...f,
                                meeting_attendees: e.target.value,
                              }))
                            }
                            placeholder="Comma-separated names..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={
                      !activityForm.subject.trim() || createActivityMutation.isPending
                    }
                    onClick={handleSubmitActivity}
                  >
                    {createActivityMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1" />
                    )}
                    Save Activity
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Activity list */}
            {activitiesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (activities as Array<Record<string, unknown>>).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No activities logged yet.
              </p>
            ) : (
              <div className="space-y-2">
                {(activities as Array<Record<string, unknown>>).map((act) => {
                  const Icon =
                    ACTIVITY_ICONS[(act.activity_type as string) || "note"] || FileText;
                  const ts = act.created_at
                    ? new Date(act.created_at as string).toLocaleString()
                    : "";
                  return (
                    <div
                      key={act.id as number}
                      className="flex gap-3 rounded-lg border p-3"
                    >
                      <div className="mt-0.5 shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {act.subject as string}
                          </span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {(act.activity_type as string) || "note"}
                          </Badge>
                        </div>
                        {!!act.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {String(act.body)}
                          </p>
                        )}
                        {!!act.outcome && (
                          <p className="mt-0.5 text-xs">
                            <span className="text-muted-foreground">Outcome:</span>{" "}
                            {String(act.outcome)}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>{ts}</span>
                          {!!act.created_by_name && (
                            <span>by {String(act.created_by_name)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ================================================================
            TAB 3: FOLLOW-UPS
        ================================================================ */}
        {activeTab === "followups" && (
          <>
            {followUpsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (followUps as Array<Record<string, unknown>>).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No pending follow-ups.
              </p>
            ) : (
              <div className="space-y-2">
                {(followUps as Array<Record<string, unknown>>).map((fu) => {
                  const fuDate = fu.follow_up_date
                    ? new Date(fu.follow_up_date as string)
                    : null;
                  const isOverdue =
                    fuDate && !fu.is_follow_up_done && fuDate < new Date();
                  return (
                    <div
                      key={(fu.id as number) || (fu.activity_id as number)}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${
                        isOverdue ? "border-red-300 bg-red-50/50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!fu.is_follow_up_done}
                        disabled={markFollowUpDoneMutation.isPending}
                        onChange={() =>
                          markFollowUpDoneMutation.mutate(
                            (fu.id as number) || (fu.activity_id as number)
                          )
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium truncate ${
                              fu.is_follow_up_done
                                ? "line-through text-muted-foreground"
                                : ""
                            }`}
                          >
                            {(fu.subject as string) || "Follow-up"}
                          </span>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-[10px] shrink-0">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        {!!fu.follow_up_notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {String(fu.follow_up_notes)}
                          </p>
                        )}
                        {fuDate && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            <Calendar className="inline h-3 w-3 mr-0.5" />
                            {fuDate.toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}      </div>

      {/* ── CSV Column Mapping Modal ── */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold">Map CSV Columns</h2>
                <p className="text-sm text-muted-foreground">
                  {csvAllRows.length} row{csvAllRows.length !== 1 ? "s" : ""} detected. Map each CSV column to the correct investor field.
                </p>
              </div>
              <button
                onClick={() => { setShowMappingModal(false); setCsvHeaders([]); setCsvPreviewRows([]); setCsvAllRows([]); setColumnMapping({}); }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none px-2"
              >
                &times;
              </button>
            </div>

            {/* Mapping Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">CSV Column</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Map To</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Preview (first rows)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvHeaders.map((header, colIdx) => (
                      <tr key={colIdx} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{colIdx + 1}</td>
                        <td className="px-3 py-2 font-medium">{header}</td>
                        <td className="px-3 py-2">
                          <select
                            value={columnMapping[String(colIdx)] ?? ""}
                            onChange={(e) => {
                              const newMapping = { ...columnMapping };
                              if (e.target.value) {
                                // Remove any other column mapped to this field
                                for (const k of Object.keys(newMapping)) {
                                  if (newMapping[k] === e.target.value) delete newMapping[k];
                                }
                                newMapping[String(colIdx)] = e.target.value;
                              } else {
                                delete newMapping[String(colIdx)];
                              }
                              setColumnMapping(newMapping);
                            }}
                            className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
                          >
                            {INVESTOR_FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            {csvPreviewRows.slice(0, 3).map((row, rIdx) => (
                              <span key={rIdx} className="text-xs text-muted-foreground truncate max-w-[200px] block">
                                {row[colIdx] ?? <span className="italic">empty</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mapping Summary */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
                <div className="font-medium mb-1">Mapping Summary</div>
                <div className="flex flex-wrap gap-2">
                  {INVESTOR_FIELDS.filter(f => f.key).map((f) => {
                    const mappedCol = Object.entries(columnMapping).find(([, v]) => v === f.key);
                    const isMapped = !!mappedCol;
                    const isRequired = f.key === "name" || f.key === "email";
                    return (
                      <span
                        key={f.key}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                          isMapped
                            ? "bg-green-100 text-green-800"
                            : isRequired
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {isMapped ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : isRequired ? (
                          <XCircle className="h-3 w-3" />
                        ) : null}
                        {f.label}
                        {isMapped && (
                          <span className="text-[10px] opacity-70">
                            &larr; {csvHeaders[parseInt(mappedCol![0])]}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Required fields marked with *. Unmapped columns will be skipped.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowMappingModal(false); setCsvHeaders([]); setCsvPreviewRows([]); setCsvAllRows([]); setColumnMapping({}); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={executeImport}
                  disabled={!Object.values(columnMapping).includes("name") || !Object.values(columnMapping).includes("email")}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Import {csvAllRows.length} Row{csvAllRows.length !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────ion getStageIndex(status: OnboardingStatus): number {
  const order: OnboardingStatus[] = [
    "lead",
    "invited",
    "documents_pending",
    "under_review",
    "approved",
    "active",
  ];
  return order.indexOf(status);
}
