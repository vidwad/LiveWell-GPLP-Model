"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
// createPortal removed — using direct fixed overlay instead
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

type InvestorStatusType =
  | "new_lead"
  | "warm_lead"
  | "prospect"
  | "hot_prospect"
  | "investor"
  | "write_off";

interface InvestorRecord {
  investor_id: number;
  name: string;
  email: string;
  phone?: string | null;
  entity_type?: string | null;
  investor_status?: InvestorStatusType;
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

// Sales Pipeline stages (investor_status)
const STAGES: { key: string; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { key: "new_lead", label: "New Lead", color: "text-gray-700", bgColor: "bg-gray-100", borderColor: "border-gray-300" },
  { key: "warm_lead", label: "Warm Lead", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-300" },
  { key: "prospect", label: "Prospect", color: "text-yellow-700", bgColor: "bg-yellow-50", borderColor: "border-yellow-300" },
  { key: "hot_prospect", label: "Hot Prospect", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-300" },
  { key: "investor", label: "Investor", color: "text-green-700", bgColor: "bg-green-50", borderColor: "border-green-300" },
  { key: "write_off", label: "Write-off", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-300" },
];

const KANBAN_STAGES: string[] = ["new_lead", "warm_lead", "prospect", "hot_prospect", "investor"];

const STAGE_ACTIONS: Record<string, { label: string; nextStatus: string; icon: React.ElementType }> = {
  new_lead: { label: "Mark Warm", nextStatus: "warm_lead", icon: Mail },
  warm_lead: { label: "Mark Prospect", nextStatus: "prospect", icon: Phone },
  prospect: { label: "Mark Hot", nextStatus: "hot_prospect", icon: CheckCircle2 },
  hot_prospect: { label: "Convert to Investor", nextStatus: "investor", icon: ShieldCheck },
};

const ENTITY_LABELS: Record<string, string> = {
  individual: "Individual",
  corporation: "Corporation",
  trust: "Trust",
  partnership: "Partnership",
};

// ── API helpers ──────────────────────────────────────────────────────

function fetchInvestors(): Promise<InvestorRecord[]> {
  return apiClient.get("/api/investment/investors?limit=5000").then((r) => {
    const data = r.data;
    if (Array.isArray(data)) return data;
    return data.items ?? [];
  });
}

function fetchOnboardingDetail(investorId: number): Promise<OnboardingDetail> {
  return apiClient.get(`/api/investor/investors/${investorId}/onboarding`).then((r) => r.data);
}

function transitionStatus(investorId: number, newStatus: string) {
  // Use investor_status endpoint for sales pipeline transitions
  return apiClient.patch(`/api/investor/investors/${investorId}/status`, { investor_status: newStatus }).then((r) => r.data);
}

function transitionOnboardingStatus(investorId: number, newStatus: string) {
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
  const [viewMode, setViewMode] = useState<"kanban" | "table">("table");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch all investors
  const { data: investors, isLoading: investorsLoading } = useQuery({
    queryKey: ["onboarding-investors"],
    queryFn: fetchInvestors,
  });

  // Fetch user directory for assignment dropdown
  const { data: userDirectory = [] } = useQuery<Array<{ user_id: number; full_name: string; role: string }>>({
    queryKey: ["user-directory"],
    queryFn: () => apiClient.get("/api/auth/users/directory").then((r) => r.data),
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

  // Group investors by investor_status (sales pipeline)
  const grouped = useMemo(() => {
    const map: Record<string, InvestorRecord[]> = {
      new_lead: [],
      warm_lead: [],
      prospect: [],
      hot_prospect: [],
      investor: [],
      write_off: [],
    };
    if (investors) {
      for (const inv of investors) {
        const status = inv.investor_status ?? "new_lead";
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
      list = list.filter((inv) => (inv.investor_status ?? "new_lead") === statusFilter);
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
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "entity_type", label: "Entity Type" },
    { key: "jurisdiction", label: "Jurisdiction" },
    { key: "accredited_status", label: "Accredited Status" },
    { key: "exemption_type", label: "Exemption Type" },
    { key: "tax_id", label: "Tax ID" },
    { key: "banking_info", label: "Banking Info" },
    { key: "investor_status", label: "Pipeline Status" },
    { key: "onboarding_status", label: "Onboarding Status" },
    { key: "source", label: "Lead Source" },
    { key: "notes", label: "Notes" },
    { key: "indicated_amount", label: "Indicated Amount" },
  ];

  // ── CSV Export ──
  const handleExport = useCallback(() => {
    const list = investors ?? [];
    if (list.length === 0) return;
    const headers = ["investor_id", "name", "email", "phone", "address", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "investor_status", "onboarding_status", "notes", "onboarding_started_at", "onboarding_completed_at", "invited_at", "approved_at", "created_at"];
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
    console.log('[IMPORT] handleImport called with:', file.name);
    try {
      const text = await file.text();
      console.log('[IMPORT] File text length:', text.length, 'First 200 chars:', text.substring(0, 200));
      const allParsedRows = parseCsvFull(text);
      console.log('[IMPORT] Parsed rows:', allParsedRows.length);
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
      const fieldKeys = ["name", "email", "phone", "address", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "investor_status", "onboarding_status", "source", "notes", "indicated_amount"];
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

      console.log('[IMPORT] Headers:', headers);
      console.log('[IMPORT] Auto-mapping:', autoMapping);
      console.log('[IMPORT] Data rows:', allRows.length);
      setCsvHeaders(headers);
      setCsvPreviewRows(allRows.slice(0, 5));
      setCsvAllRows(allRows);
      setColumnMapping(autoMapping);
      console.log('[IMPORT] About to setShowMappingModal(true)');
      setShowMappingModal(true);
      console.log('[IMPORT] setShowMappingModal(true) called');
    } catch (err) {
      console.error('[IMPORT] ERROR:', err);
      alert("Failed to read CSV file: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  // ── CSV Import Step 2: Execute import with user-defined mapping ──
  const executeImport = useCallback(async () => {
    // Validate required fields are mapped
    const mappedFields = Object.values(columnMapping);
    if (!mappedFields.includes("name")) {
      alert("You must map the 'Name' column before importing.");
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
    let skippedDuplicates = 0;
    let failed = 0;

    for (const row of csvAllRows) {
      const name = row[fieldToCol["name"]] ?? "";
      if (!name) { failed++; continue; }

      const email = fieldToCol["email"] !== undefined ? (row[fieldToCol["email"]] ?? "") : "";
      // Skip rows with invalid email format (but allow empty email)
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { failed++; continue; }

      const body: Record<string, string | number> = { name };
      if (email) body.email = email;
      const optionalFields = ["phone", "address", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "investor_status", "onboarding_status", "source", "notes"];
      for (const field of optionalFields) {
        if (fieldToCol[field] !== undefined && row[fieldToCol[field]]) {
          body[field] = row[fieldToCol[field]];
        }
      }
      if (fieldToCol["indicated_amount"] !== undefined && row[fieldToCol["indicated_amount"]]) {
        body.indicated_amount = parseFloat(row[fieldToCol["indicated_amount"]]);
      }

      try {
        const resp = await apiClient.post("/api/investor/leads/quick-add", body);
        if (resp.data?.is_new === false) {
          skippedDuplicates++;
        } else {
          imported++;
        }
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
    const parts = [`${imported} new leads added`];
    if (skippedDuplicates > 0) parts.push(`${skippedDuplicates} duplicates skipped`);
    if (failed > 0) parts.push(`${failed} failed`);
    alert(`Import complete: ${parts.join(", ")}`);
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
              console.log('[IMPORT] onChange fired, files:', e.target.files?.length);
              const file = e.target.files?.[0];
              if (file) {
                console.log('[IMPORT] Calling handleImport with file:', file.name, file.size);
                handleImport(file);
              } else {
                console.log('[IMPORT] No file selected');
              }
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

      {/* Pipeline Summary Bar — click to filter */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {STAGES.map((stage) => {
          const isActive = statusFilter === stage.key;
          return (
            <Card
              key={stage.key}
              className={`${stage.borderColor} border cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-primary shadow-md" : ""}`}
              onClick={() => setStatusFilter(isActive ? "all" : stage.key)}
            >
              <CardContent className="p-3">
                <p className={`text-[10px] font-medium uppercase tracking-wider ${stage.color}`}>
                  {stage.label}
                </p>
                <p className={`mt-1 text-2xl font-bold ${stage.color}`}>
                  {grouped[stage.key]?.length ?? 0}
                </p>
              </CardContent>
            </Card>
          );
        })}
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
                          { key: "investor_status", label: "Status" },
                          { key: "assigned_users", label: "Assigned To" },
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
                          const status = inv.investor_status ?? "new_lead";
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
                                {(inv.assigned_users as Array<{user_id: number; user_name: string}>)?.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {(inv.assigned_users as Array<{user_id: number; user_name: string}>).map((u) => (
                                      <span key={u.user_id} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                                        {u.user_name?.split(" ")[0] || "?"}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {(() => {
                                  const requiresContact = !["new_lead", "warm_lead"].includes(status);
                                  const missingContact = requiresContact && (!inv.email && !inv.phone);
                                  return (
                                  <select
                                    value={status}
                                    className="rounded border px-2 py-1 text-xs bg-background min-w-[120px]"
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const newStatus = e.target.value;
                                      const needsContact = !["new_lead", "warm_lead"].includes(newStatus);
                                      if (needsContact && !inv.email && !inv.phone) {
                                        alert(`Cannot move to "${STAGES.find(s => s.key === newStatus)?.label}" without an email or phone number. Please update the contact details first.`);
                                        e.target.value = status;
                                        return;
                                      }
                                      transitionMutation.mutate({ investorId: inv.investor_id, newStatus });
                                    }}
                                    disabled={transitionMutation.isPending}
                                  >
                                    {STAGES.map((s) => (
                                      <option key={s.key} value={s.key}>{s.label}</option>
                                    ))}
                                  </select>
                                  );
                                })()}
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
          <div className={`fixed inset-y-0 right-0 z-40 border-l bg-background shadow-lg transition-all duration-200 overflow-y-auto ${drawerExpanded ? "w-full lg:w-[65%]" : "w-full max-w-md lg:w-[420px]"}`}>
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
              userDirectory={userDirectory}
            />
          </div>
        )}
      </div>

      {/* ── CSV Column Mapping Modal ── */}
      {showMappingModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
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
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">CSV Column</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Map To</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvHeaders.map((header: string, colIdx: number) => (
                      <tr key={colIdx} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{colIdx + 1}</td>
                        <td className="px-3 py-2 font-medium">{header}</td>
                        <td className="px-3 py-2">
                          <select
                            value={columnMapping[String(colIdx)] ?? ""}
                            onChange={(e) => {
                              const newMapping = { ...columnMapping };
                              if (e.target.value) {
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
                            {INVESTOR_FIELDS.map((f: any) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            {csvPreviewRows.slice(0, 3).map((row: string[], rIdx: number) => (
                              <span key={rIdx} className="text-xs text-muted-foreground max-w-[200px] block whitespace-pre-line line-clamp-2">
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
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
                <div className="font-medium mb-1">Mapping Summary</div>
                <div className="flex flex-wrap gap-2">
                  {INVESTOR_FIELDS.filter((f: any) => f.key).map((f: any) => {
                    const mappedCol = Object.entries(columnMapping).find(([, v]) => v === f.key);
                    const isMapped = !!mappedCol;
                    const isRequired = f.key === "name";
                    return (
                      <span
                        key={f.key}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                          isMapped ? "bg-green-100 text-green-800" : isRequired ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {isMapped ? <CheckCircle2 className="h-3 w-3" /> : isRequired ? <XCircle className="h-3 w-3" /> : null}
                        {f.label}
                        {isMapped && <span className="text-[10px] opacity-70">&larr; {csvHeaders[parseInt(mappedCol![0])]}</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground">Required fields marked with *. Unmapped columns will be skipped.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowMappingModal(false); setCsvHeaders([]); setCsvPreviewRows([]); setCsvAllRows([]); setColumnMapping({}); }}>Cancel</Button>
                <Button size="sm" onClick={executeImport} disabled={!Object.values(columnMapping).includes("name")}>
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
  stage: string;
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

type DrawerTab = "profile" | "activity" | "followups" | "documents";

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
  userDirectory = [],
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
  userDirectory?: Array<{ user_id: number; full_name: string; role: string }>;
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
    linkedin_url: "",
    risk_tolerance: "",
    re_knowledge: "",
    other_investments: "",
    income_range: "",
    net_worth_range: "",
    investment_goals: "",
    referral_source: "",
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
      linkedin_url: (inv.linkedin_url as string) || "",
      risk_tolerance: (inv.risk_tolerance as string) || "",
      re_knowledge: (inv.re_knowledge as string) || "",
      other_investments: (inv.other_investments as string) || "",
      income_range: (inv.income_range as string) || "",
      net_worth_range: (inv.net_worth_range as string) || "",
      investment_goals: (inv.investment_goals as string) || "",
      referral_source: (inv.referral_source as string) || "",
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
  const currentStage = investor.investor_status ?? "new_lead";
  const currentStageMeta = STAGES.find((s) => s.key === currentStage);
  const action = STAGE_ACTIONS[currentStage];
  const canApprove = true; // investor_status doesn't have doc approval gating
  const progressPercent = Math.round(
    (detail.completed_steps / Math.max(detail.total_steps, 1)) * 100
  );

  const TABS: { key: DrawerTab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "activity", label: "Activity Log" },
    { key: "followups", label: "Follow-ups" },
    { key: "documents", label: "Documents" },
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
                      <label className="text-xs text-muted-foreground">LinkedIn URL</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        placeholder="https://linkedin.com/in/..."
                        value={editForm.linkedin_url ?? ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, linkedin_url: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Risk Tolerance</label>
                      <select
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.risk_tolerance ?? ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, risk_tolerance: e.target.value }))}
                      >
                        <option value="">-- Select --</option>
                        <option value="conservative">Conservative</option>
                        <option value="moderate">Moderate</option>
                        <option value="aggressive">Aggressive</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">RE Knowledge</label>
                      <select
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.re_knowledge ?? ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, re_knowledge: e.target.value }))}
                      >
                        <option value="">-- Select --</option>
                        <option value="none">None</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="expert">Expert</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Income Range</label>
                      <select
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.income_range ?? ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, income_range: e.target.value }))}
                      >
                        <option value="">-- Select --</option>
                        <option value="under_100k">Under $100K</option>
                        <option value="100k_250k">$100K - $250K</option>
                        <option value="250k_500k">$250K - $500K</option>
                        <option value="500k_1m">$500K - $1M</option>
                        <option value="1m_plus">$1M+</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Net Worth Range</label>
                      <select
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.net_worth_range ?? ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, net_worth_range: e.target.value }))}
                      >
                        <option value="">-- Select --</option>
                        <option value="under_500k">Under $500K</option>
                        <option value="500k_1m">$500K - $1M</option>
                        <option value="1m_5m">$1M - $5M</option>
                        <option value="5m_10m">$5M - $10M</option>
                        <option value="10m_plus">$10M+</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Other Investments</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        placeholder="Stocks, bonds, crypto, private equity..."
                        value={editForm.other_investments ?? ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, other_investments: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Investment Goals</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        placeholder="Retirement, income, growth..."
                        value={editForm.investment_goals ?? ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, investment_goals: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Referral Source</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        placeholder="Who referred them or how they found us"
                        value={editForm.referral_source ?? ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, referral_source: e.target.value }))}
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
                      <p className="truncate">{(investor.email as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Phone</span>
                      <p>{(investor.phone as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Entity Type</span>
                      <p>{investor.entity_type ? (ENTITY_LABELS[investor.entity_type] ?? investor.entity_type) : "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Address</span>
                      <p className="whitespace-pre-line">{(investor.address as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Jurisdiction</span>
                      <p>{(investor.jurisdiction as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Accredited Status</span>
                      <p className="capitalize">{(investor.accredited_status as string) || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">LinkedIn</span>
                      {(investor.linkedin_url as string) ? (
                        <p><a href={investor.linkedin_url as string} target="_blank" rel="noopener" className="text-blue-600 hover:underline text-xs truncate block">{investor.linkedin_url as string}</a></p>
                      ) : <p className="text-muted-foreground">—</p>}
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Risk Tolerance</span>
                      <p className="capitalize">{(investor.risk_tolerance as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">RE Knowledge</span>
                      <p className="capitalize">{(investor.re_knowledge as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Income Range</span>
                      <p>{(investor.income_range as string) || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Net Worth</span>
                      <p>{(investor.net_worth_range as string) || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Other Investments</span>
                      <p className="text-xs">{(investor.other_investments as string) || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Investment Goals</span>
                      <p className="text-xs">{(investor.investment_goals as string) || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Referral Source</span>
                      <p className="text-xs">{(investor.referral_source as string) || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">Notes</span>
                      <p className="whitespace-pre-wrap text-xs">{(investor.notes as string) || "—"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Onboarding Progress + Actions */}
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

            {/* Status change */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Pipeline Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Current Status</label>
                  <select
                    value={currentStage}
                    className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                    disabled={isTransitioning}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      const needsContact = !["new_lead", "warm_lead"].includes(newStatus);
                      if (needsContact && !investor.email && !investor.phone) {
                        alert(`Cannot move to "${STAGES.find(s => s.key === newStatus)?.label}" without an email or phone number. Please update the contact details first.`);
                        return;
                      }
                      onTransition(newStatus);
                    }}
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {action && (
                  <Button
                    className="w-full"
                    disabled={isTransitioning}
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
              </CardContent>
            </Card>

            {/* Assigned To */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned To
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  {(investor.assigned_users as Array<{user_id: number; user_name: string}> || []).map((a: any) => (
                    <div key={a.user_id} className="flex items-center justify-between rounded border p-2">
                      <span className="text-sm">{a.user_name}</span>
                      <button
                        className="text-xs text-red-500 hover:text-red-700"
                        onClick={async () => {
                          try {
                            await apiClient.delete(`/api/investor/investors/${investor.investor_id}/assignments/${a.user_id}`);
                            queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
                            queryClient.invalidateQueries({ queryKey: ["onboarding-detail", investor.investor_id] });
                          } catch { alert("Failed to remove assignment"); }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <select
                      id={`assign-user-${investor.investor_id}`}
                      className="flex-1 rounded border bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">Add user...</option>
                      {userDirectory
                        .filter((u: any) => !(investor.assigned_users as Array<{user_id: number}> || []).some((a: any) => a.user_id === u.user_id))
                        .map((u: any) => (
                          <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>
                        ))
                      }
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const sel = document.getElementById(`assign-user-${investor.investor_id}`) as HTMLSelectElement;
                        const userId = parseInt(sel?.value);
                        if (!userId) return;
                        try {
                          await apiClient.post(`/api/investor/investors/${investor.investor_id}/assignments`, { user_id: userId });
                          queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
                          queryClient.invalidateQueries({ queryKey: ["onboarding-detail", investor.investor_id] });
                          sel.value = "";
                        } catch { alert("Failed to assign user"); }
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          </>
        )}

        {/* ================================================================
            TAB 2: ACTIVITY LOG
        ================================================================ */}
        {activeTab === "activity" && (
          <>
            {/* Schedule Follow-up Card */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <select className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" id={`fu-type-${investor.investor_id}`} defaultValue="call">
                      <option value="call">Phone Call</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Date</label>
                    <input type="date" className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" id={`fu-date-${investor.investor_id}`} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Time</label>
                    <input type="time" className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" id={`fu-time-${investor.investor_id}`} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Subject</label>
                    <input type="text" className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" placeholder="Optional" id={`fu-subject-${investor.investor_id}`} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Notes</label>
                    <input type="text" className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" placeholder="Optional notes" id={`fu-notes-${investor.investor_id}`} />
                  </div>
                  <div className="col-span-2">
                    <Button size="sm" className="w-full" onClick={async () => {
                      const fuType = (document.getElementById(`fu-type-${investor.investor_id}`) as HTMLSelectElement)?.value;
                      const fuDate = (document.getElementById(`fu-date-${investor.investor_id}`) as HTMLInputElement)?.value;
                      const fuTime = (document.getElementById(`fu-time-${investor.investor_id}`) as HTMLInputElement)?.value;
                      const fuSubject = (document.getElementById(`fu-subject-${investor.investor_id}`) as HTMLInputElement)?.value;
                      const fuNotes = (document.getElementById(`fu-notes-${investor.investor_id}`) as HTMLInputElement)?.value;
                      if (!fuDate) { alert("Please select a date"); return; }
                      try {
                        const resp = await apiClient.post(`/api/investor/investors/${investor.investor_id}/schedule-followup`, {
                          follow_up_type: fuType, follow_up_date: fuDate, follow_up_time: fuTime, subject: fuSubject, notes: fuNotes,
                        });
                        const gcalUrl = resp.data?.google_calendar_url;
                        if (gcalUrl && confirm(`Follow-up ${fuType} scheduled for ${fuDate}.\n\nAdd to Google Calendar?`)) {
                          window.open(gcalUrl, "_blank");
                        }
                        (document.getElementById(`fu-date-${investor.investor_id}`) as HTMLInputElement).value = "";
                        (document.getElementById(`fu-time-${investor.investor_id}`) as HTMLInputElement).value = "";
                        (document.getElementById(`fu-subject-${investor.investor_id}`) as HTMLInputElement).value = "";
                        (document.getElementById(`fu-notes-${investor.investor_id}`) as HTMLInputElement).value = "";
                        queryClient.invalidateQueries({ queryKey: ["crm-activities", investor.investor_id] });
                        queryClient.invalidateQueries({ queryKey: ["crm-followups", investor.investor_id] });
                      } catch { alert("Failed to schedule follow-up"); }
                    }}>
                      <Calendar className="h-3.5 w-3.5 mr-1.5" />
                      Schedule
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
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

            {/* Activity list — paginated (3 at a time) */}
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
              <ActivityListPaginated activities={activities as Array<Record<string, unknown>>} />
            )}

            {/* Onboarding Checklist */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Onboarding Checklist</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={progressPercent} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground">{detail.completed_steps}/{detail.total_steps}</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-1">
                  {detail.checklist.map((item) => (
                    <label
                      key={item.item_id}
                      className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/50 cursor-pointer"
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
                          {item.step_label || item.label}
                        </span>
                        {item.is_required && <span className="ml-2 text-[10px] font-medium text-red-500">Required</span>}
                        {item.document_id && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600">
                            <Paperclip className="h-2.5 w-2.5" /> Doc
                          </span>
                        )}
                      </div>
                      {item.is_completed ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </label>
                  ))}
                  {detail.checklist.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">No checklist items configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
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
        )}

        {/* ================================================================
            TAB 4: DOCUMENTS
        ================================================================ */}
        {activeTab === "documents" && (
          <InvestorDocumentsTab investorId={investorId} />
        )}
      </div>
    </div>
  );
}

// ── Investor Documents Tab ──────────────────────────────────────────────

const DOC_CATEGORIES = [
  { key: "information_package", label: "Information Package", group: "Onboarding" },
  { key: "indication_of_interest", label: "Indication of Interest", group: "Onboarding" },
  { key: "investor_id_document", label: "Photo ID (KYC)", group: "Onboarding" },
  { key: "proof_of_address", label: "Proof of Address", group: "Onboarding" },
  { key: "accreditation_certificate", label: "Accreditation Certificate", group: "Onboarding" },
  { key: "aml_kyc_report", label: "AML/KYC Report", group: "Onboarding" },
  { key: "subscription_agreement", label: "Subscription Agreement", group: "Investment" },
  { key: "partnership_agreement", label: "Partnership Agreement", group: "Investment" },
  { key: "banking_form", label: "Banking Information", group: "Account" },
  { key: "tax_form", label: "Tax Form (T5013 / W-8BEN)", group: "Account" },
  { key: "quarterly_report", label: "Quarterly Report", group: "Reporting" },
  { key: "investor_statement", label: "Investor Statement", group: "Reporting" },
  { key: "distribution_notice", label: "Distribution Notice", group: "Reporting" },
  { key: "other", label: "Other", group: "Other" },
];

function InvestorDocumentsTab({ investorId }: { investorId: number }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState("other");
  const [uploading, setUploading] = useState(false);

  const { data: documents = [], isLoading } = useQuery<Array<Record<string, any>>>({
    queryKey: ["investor-documents", investorId],
    queryFn: () => apiClient.get(`/api/investor/investors/${investorId}/documents`).then((r) => r.data),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", uploadType);
      await apiClient.post(`/api/investor/investors/${investorId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { document_type: uploadType },
      });
      queryClient.invalidateQueries({ queryKey: ["investor-documents", investorId] });
    } catch {
      alert("Failed to upload document");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Group documents by category
  const groups = useMemo(() => {
    const map: Record<string, typeof documents> = {};
    for (const doc of documents) {
      const group = DOC_CATEGORIES.find((c) => c.key === doc.document_type)?.group || "Other";
      if (!map[group]) map[group] = [];
      map[group].push(doc);
    }
    return map;
  }, [documents]);

  return (
    <div className="space-y-4">
      {/* Upload section */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex gap-2">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="flex-1 rounded border bg-background px-2 py-1.5 text-sm"
            >
              {DOC_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Template downloads */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold">Download Templates</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-2">
            {DOC_CATEGORIES.filter((c) => ["Onboarding", "Investment", "Account"].includes(c.group)).map((c) => (
              <button
                key={c.key}
                className="flex items-center gap-2 rounded border p-2 text-xs hover:bg-muted/50 transition-colors text-left"
                onClick={() => alert(`Template "${c.label}" download — templates can be uploaded to /uploads/templates/ on the server.`)}
              >
                <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Uploaded documents */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : documents.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        Object.entries(groups).map(([group, docs]) => (
          <Card key={group}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold">{group}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-1.5">
                {docs.map((doc: any) => (
                  <div key={doc.document_id} className="flex items-center justify-between rounded border p-2.5">
                    <div className="min-w-0 flex-1">
                      <a
                        href={doc.file_url?.startsWith("http") ? doc.file_url : `${apiClient.defaults.baseURL}${doc.file_url}`}
                        target="_blank"
                        rel="noopener"
                        className="text-sm font-medium text-blue-600 hover:underline truncate block"
                      >
                        {doc.title}
                      </a>
                      <p className="text-[10px] text-muted-foreground">
                        {DOC_CATEGORIES.find((c) => c.key === doc.document_type)?.label || doc.document_type}
                        {doc.upload_date && ` · ${new Date(doc.upload_date).toLocaleDateString()}`}
                      </p>
                    </div>
                    <button
                      className="text-xs text-red-500 hover:text-red-700 shrink-0 ml-2"
                      onClick={async () => {
                        if (!confirm("Delete this document?")) return;
                        try {
                          await apiClient.delete(`/api/investor/investors/${investorId}/documents/${doc.document_id}`);
                          queryClient.invalidateQueries({ queryKey: ["investor-documents", investorId] });
                        } catch { alert("Failed to delete"); }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// ── Paginated Activity List ──────────────────────────────────────────────
const ACTIVITIES_PAGE_SIZE = 3;

function ActivityListPaginated({ activities }: { activities: Array<Record<string, unknown>> }) {
  const [visibleCount, setVisibleCount] = useState(ACTIVITIES_PAGE_SIZE);
  const visible = activities.slice(0, visibleCount);
  const hasMore = visibleCount < activities.length;
  const hasPrev = visibleCount > ACTIVITIES_PAGE_SIZE;

  return (
    <div className="space-y-2">
      {visible.map((act) => {
        const Icon = ACTIVITY_ICONS[(act.activity_type as string) || "note"] || FileText;
        const ts = act.created_at ? new Date(act.created_at as string).toLocaleString() : "";
        return (
          <div key={act.id as number} className="flex gap-3 rounded-lg border p-3">
            <div className="mt-0.5 shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{act.subject as string}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {(act.activity_type as string) || "note"}
                </Badge>
              </div>
              {!!act.body && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{String(act.body)}</p>
              )}
              {!!act.outcome && (
                <p className="mt-0.5 text-xs">
                  <span className="text-muted-foreground">Outcome:</span> {String(act.outcome)}
                </p>
              )}
              <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{ts}</span>
                {!!act.created_by_name && <span>by {String(act.created_by_name)}</span>}
              </div>
            </div>
          </div>
        );
      })}
      {(hasMore || hasPrev) && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            Showing {Math.min(visibleCount, activities.length)} of {activities.length}
          </span>
          <div className="flex gap-2">
            {hasPrev && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setVisibleCount(ACTIVITIES_PAGE_SIZE)}>
                Show less
              </Button>
            )}
            {hasMore && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setVisibleCount((c) => c + ACTIVITIES_PAGE_SIZE)}>
                Show more
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getStageIndex(status: OnboardingStatus): number {
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
