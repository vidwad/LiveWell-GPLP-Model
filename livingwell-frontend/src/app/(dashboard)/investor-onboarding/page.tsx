"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
// createPortal removed — using direct fixed overlay instead
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, investors as investorsApi, twilio as twilioApi } from "@/lib/api";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
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
  MapPin,
  Linkedin,
  Sparkles,
  TrendingUp as TrendIcon,
  Mic,
  MicOff,
  PhoneOff,
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
  | "write_off"
  | "archived";

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
  { key: "archived", label: "Archived", color: "text-gray-400", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
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
  const [leadForm, setLeadForm] = useState({ first_name: "", last_name: "", email: "", phone: "", lp_id: "", indicated_amount: "", source: "", notes: "" });
  const [viewMode, setViewMode] = useState<"kanban" | "table">("table");
  const [sortField, setSortField] = useState<string>("first_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Fetch all investors
  const { data: investors, isLoading: investorsLoading } = useQuery({
    queryKey: ["onboarding-investors", showArchived],
    queryFn: () => apiClient.get(`/api/investment/investors?limit=5000${showArchived ? "&include_archived=true" : ""}`).then((r) => {
      const data = r.data;
      if (Array.isArray(data)) return data;
      return data.items ?? [];
    }),
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
      setLeadForm({ first_name: "", last_name: "", email: "", phone: "", lp_id: "", indicated_amount: "", source: "", notes: "" });
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
      archived: [],
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
      list = list.filter((inv: any) => (inv.investor_status ?? "new_lead") === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((inv: any) =>
        (inv.first_name || "").toLowerCase().includes(q) ||
        (inv.last_name || "").toLowerCase().includes(q) ||
        (inv.name || "").toLowerCase().includes(q) ||
        (inv.email || "").toLowerCase().includes(q) ||
        (inv.phone || "").toLowerCase().includes(q) ||
        (inv.mobile || "").toLowerCase().includes(q) ||
        (inv.company_name || "").toLowerCase().includes(q) ||
        (inv.city || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aVal = String(a[sortField] ?? "").toLowerCase();
      const bVal = String(b[sortField] ?? "").toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [investors, sortField, sortDir, statusFilter, searchQuery]);

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
    { key: "first_name", label: "First Name *", required: true },
    { key: "last_name", label: "Last Name *", required: true },
    { key: "company_name", label: "Company Name" },
    { key: "name", label: "Full Name (legacy)" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "mobile", label: "Mobile / Cell" },
    { key: "street_address", label: "Street Address" },
    { key: "street_address_2", label: "Address Line 2" },
    { key: "city", label: "City" },
    { key: "province", label: "Province" },
    { key: "postal_code", label: "Postal Code" },
    { key: "country", label: "Country" },
    { key: "address", label: "Full Address (legacy)" },
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
    const headers = ["investor_id", "first_name", "last_name", "company_name", "email", "phone", "mobile", "street_address", "street_address_2", "city", "province", "postal_code", "country", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "investor_status", "onboarding_status", "notes", "created_at"];
    const rows = list.map((inv: any) =>
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
      const fieldKeys = ["first_name", "last_name", "company_name", "name", "email", "phone", "mobile", "street_address", "street_address_2", "city", "province", "postal_code", "country", "address", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "investor_status", "onboarding_status", "source", "notes", "indicated_amount"];
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
    if (!mappedFields.includes("first_name") && !mappedFields.includes("name")) {
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
      // Use first_name if mapped, otherwise fall back to legacy name
      const name = row[fieldToCol["first_name"]] ?? row[fieldToCol["name"]] ?? "";
      if (!name) { failed++; continue; }

      const email = fieldToCol["email"] !== undefined ? (row[fieldToCol["email"]] ?? "") : "";
      // Skip rows with invalid email format (but allow empty email)
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { failed++; continue; }

      // Send as first_name if mapped, otherwise as legacy name
      const body: Record<string, string | number> = fieldToCol["first_name"] !== undefined
        ? { first_name: name }
        : { name };
      if (email) body.email = email;
      const optionalFields = ["last_name", "company_name", "phone", "mobile", "street_address", "street_address_2", "city", "province", "postal_code", "country", "address", "entity_type", "jurisdiction", "accredited_status", "exemption_type", "tax_id", "banking_info", "investor_status", "onboarding_status", "source", "notes"];
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
          {/* Show Archived toggle */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
            />
            Archived
          </label>
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
                <label className="text-xs font-medium text-muted-foreground">First Name *</label>
                <input type="text" value={leadForm.first_name} onChange={e => setLeadForm(f => ({...f, first_name: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm" placeholder="First name" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Last Name *</label>
                <input type="text" value={leadForm.last_name} onChange={e => setLeadForm(f => ({...f, last_name: e.target.value}))}
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm" placeholder="Last name" />
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
                  const params: Record<string, string | number> = { first_name: leadForm.first_name, last_name: leadForm.last_name };
                  if (leadForm.email) params.email = leadForm.email;
                  if (leadForm.phone) params.phone = leadForm.phone;
                  if (leadForm.source) params.source = leadForm.source;
                  if (leadForm.notes) params.notes = leadForm.notes;
                  if (leadForm.lp_id) params.lp_id = parseInt(leadForm.lp_id);
                  if (leadForm.indicated_amount) params.indicated_amount = parseFloat(leadForm.indicated_amount);
                  addLeadMutation.mutate(params);
                }}
                disabled={!leadForm.first_name || !leadForm.last_name || addLeadMutation.isPending}
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
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search name, email, phone, company..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rounded-md border px-2.5 py-1 pr-7 text-xs w-48 lg:w-64 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
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
                          { key: "first_name", label: "First Name" },
                          { key: "last_name", label: "Last Name *", required: true },
                          { key: "email", label: "Email" },
                          { key: "phone", label: "Phone" },
                          { key: "mobile", label: "Cell" },
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
                                selectedInvestorId === inv.investor_id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                              }`}
                              onClick={() => setSelectedInvestorId(inv.investor_id)}
                            >
                              <td className="px-3 py-2.5 font-medium">{(inv.first_name as string) || (inv.name as string) || "—"}</td>
                              <td className="px-3 py-2.5">{(inv.last_name as string) || "—"}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{inv.email}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{inv.phone || "—"}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{(inv.mobile as string) || "—"}</td>
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
                                      const needsContact = !["new_lead", "warm_lead", "write_off", "archived"].includes(newStatus);
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

      {/* ── Sticky Activity Stats Bar ── */}
      <CRMStatsBar />

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
                <Button size="sm" onClick={executeImport} disabled={!Object.values(columnMapping).includes("first_name") && !Object.values(columnMapping).includes("name")}>
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
          <p className="text-sm font-medium leading-tight truncate">{`${investor.first_name || investor.name || ""}${investor.last_name ? " " + investor.last_name : ""}`}</p>
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
  activity_type: "note",
  subject: "",
  body: "",
  outcome: "",
  follow_up_date: new Date().toISOString().slice(0, 10),
  follow_up_notes: "",
  meeting_date: "",
  meeting_location: "",
  meeting_attendees: "",
};

type DrawerTab = "profile" | "activity" | "followups" | "documents" | "comms";

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
  const [researchLoading, setResearchLoading] = useState<number | null>(null);
  const [researchResult, setResearchResult] = useState<{ summary: string; details: string; ttsAudioUrl?: string | null } | null>(null);

  // Load saved research from investor record
  useEffect(() => {
    if (detail?.investor) {
      const inv = detail.investor;
      if (inv.research_summary || inv.research_details) {
        setResearchResult({
          summary: (inv.research_summary as string) || "",
          details: (inv.research_details as string) || "",
          ttsAudioUrl: (inv.tts_audio_path as string) || null,
        });
      } else {
        setResearchResult(null);
      }
    }
  }, [detail]);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    email: "",
    phone: "",
    mobile: "",
    entity_type: "",
    street_address: "",
    street_address_2: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Canada",
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
      first_name: (inv.first_name as string) || "",
      last_name: (inv.last_name as string) || "",
      company_name: (inv.company_name as string) || "",
      email: inv.email || "",
      phone: (inv.phone as string) || "",
      mobile: (inv.mobile as string) || "",
      entity_type: (inv.entity_type as string) || "",
      street_address: (inv.street_address as string) || "",
      street_address_2: (inv.street_address_2 as string) || "",
      city: (inv.city as string) || "",
      province: (inv.province as string) || "",
      postal_code: (inv.postal_code as string) || "",
      country: (inv.country as string) || "Canada",
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
    const autoSubject = activityForm.subject.trim() || `${activityForm.activity_type.charAt(0).toUpperCase() + activityForm.activity_type.slice(1)} - ${new Date().toLocaleDateString()}`;
    const payload: Record<string, unknown> = {
      activity_type: activityForm.activity_type,
      subject: autoSubject,
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
    { key: "comms", label: "Comms" },
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
            <h2 className="text-lg font-semibold truncate">{`${investor.first_name || investor.name || ""}${investor.last_name ? " " + investor.last_name : ""}`}</h2>
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
                    <div>
                      <label className="text-xs text-muted-foreground">First Name</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, first_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Last Name</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, last_name: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Company / Trust Name</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.company_name}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, company_name: e.target.value }))}
                        placeholder="Business, trust, or corporation name"
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
                      <label className="text-xs text-muted-foreground">Mobile / Cell</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.mobile}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, mobile: e.target.value }))}
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
                      <label className="text-xs text-muted-foreground">Street Address</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.street_address}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, street_address: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Address Line 2</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        placeholder="Suite, unit, floor..."
                        value={editForm.street_address_2}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, street_address_2: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">City</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.city}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Province</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.province}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, province: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Postal Code</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.postal_code}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, postal_code: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Country</label>
                      <input
                        className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                        value={editForm.country}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, country: e.target.value }))}
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
                  <div className="space-y-4 text-sm">
                    {/* ── Contact Info ── */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3 w-3" /> Contact
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div>
                          <span className="text-[10px] text-muted-foreground">First Name</span>
                          <p className="font-medium truncate">{(investor.first_name as string) || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Last Name</span>
                          <p className="font-medium truncate">{(investor.last_name as string) || "—"}</p>
                        </div>
                        {(investor.company_name as string) && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground">Company / Trust</span>
                            <p className="font-medium">{investor.company_name as string}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] text-muted-foreground">Email</span>
                          {(investor.email as string) ? (
                            <p><a href={`mailto:${investor.email}`} className="text-blue-600 hover:underline truncate block">{investor.email as string}</a></p>
                          ) : <p className="text-muted-foreground">—</p>}
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Phone</span>
                          {(investor.phone as string) ? (
                            <div className="flex items-center gap-1">
                              <a href={`tel:${investor.phone}`} className="text-blue-600 hover:underline truncate">{investor.phone as string}</a>
                              <button onClick={() => { setActiveTab("comms"); }} title="Call / SMS" className="text-green-600 hover:text-green-700 shrink-0">
                                <Phone className="h-3 w-3" />
                              </button>
                            </div>
                          ) : <p className="text-muted-foreground">—</p>}
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Mobile</span>
                          {(investor.mobile as string) ? (
                            <div className="flex items-center gap-1">
                              <a href={`tel:${investor.mobile}`} className="text-blue-600 hover:underline truncate">{investor.mobile as string}</a>
                              <button onClick={() => { setActiveTab("comms"); }} title="Call / SMS" className="text-green-600 hover:text-green-700 shrink-0">
                                <Phone className="h-3 w-3" />
                              </button>
                            </div>
                          ) : <p className="text-muted-foreground">—</p>}
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Entity Type</span>
                          <p>{investor.entity_type ? (ENTITY_LABELS[investor.entity_type] ?? investor.entity_type) : "—"}</p>
                        </div>
                      </div>
                    </div>

                    {/* ── Address ── */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> Address
                      </h4>
                      <div>
                        <p className="font-medium">{(investor.street_address as string) || "—"}</p>
                        {(investor.street_address_2 as string) && <p>{investor.street_address_2 as string}</p>}
                        <p>
                          {[investor.city, investor.province, investor.postal_code].filter(Boolean).join(", ") || "—"}
                        </p>
                        <p className="text-muted-foreground">{(investor.country as string) || "Canada"}</p>
                      </div>
                      {/* Google Map */}
                      {((investor.street_address as string) || (investor.city as string)) && (
                        <details className="rounded border overflow-hidden">
                          <summary className="px-2.5 py-1.5 text-[10px] font-medium cursor-pointer hover:bg-muted/50 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> View on Map
                          </summary>
                          <iframe
                            width="100%"
                            height="180"
                            style={{ border: 0 }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.google.com/maps?q=${encodeURIComponent(
                              [investor.street_address, investor.street_address_2, investor.city, investor.province, investor.postal_code, investor.country || "Canada"].filter(Boolean).join(", ")
                            )}&output=embed`}
                          />
                        </details>
                      )}
                    </div>

                    {/* ── Compliance ── */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3 w-3" /> Compliance
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div>
                          <span className="text-[10px] text-muted-foreground">Jurisdiction</span>
                          <p>{(investor.jurisdiction as string) || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Accredited Status</span>
                          <Badge variant="outline" className="text-[10px] mt-0.5">{(investor.accredited_status as string) || "pending"}</Badge>
                        </div>
                      </div>
                    </div>
                    {/* ── LinkedIn & Research ── */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Linkedin className="h-3 w-3" /> LinkedIn & Research
                        </h4>
                        <div className="flex gap-1">
                          <button
                            className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                            onClick={async () => {
                              try {
                                const r = await apiClient.post(`/api/investor/investors/${investor.investor_id}/linkedin-search`);
                                if (r.data.found) {
                                  alert(`Found: ${r.data.linkedin_url}`);
                                  queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
                                  queryClient.invalidateQueries({ queryKey: ["onboarding-detail", investor.investor_id] });
                                } else {
                                  alert("LinkedIn profile not found. Try adding more details (email, location) and search again.");
                                }
                              } catch (e: any) { alert(e?.response?.data?.detail || "Search failed"); }
                            }}
                          >
                            Search
                          </button>
                          <button
                            className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                            disabled={!!researchLoading}
                            onClick={async () => {
                              setResearchLoading(investor.investor_id);
                              setResearchResult(null);
                              try {
                                const r = await apiClient.post(`/api/investor/investors/${investor.investor_id}/linkedin-fetch`);
                                setResearchResult({ summary: r.data.summary, details: r.data.research_details, ttsAudioUrl: r.data.tts_audio_url || null });
                                queryClient.invalidateQueries({ queryKey: ["onboarding-investors"] });
                                queryClient.invalidateQueries({ queryKey: ["onboarding-detail", investor.investor_id] });
                              } catch (e: any) { alert(e?.response?.data?.detail || "Research failed"); }
                              finally { setResearchLoading(null); }
                            }}
                          >
                            {researchLoading === investor.investor_id ? "Researching..." : "Research"}
                          </button>
                          {(investor.linkedin_url as string) && (
                            <a
                              href={investor.linkedin_url as string}
                              target="_blank"
                              rel="noopener"
                              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                      {(investor.linkedin_url as string) ? (
                        <p><a href={investor.linkedin_url as string} target="_blank" rel="noopener" className="text-blue-600 hover:underline text-xs truncate block">{investor.linkedin_url as string}</a></p>
                      ) : <p className="text-muted-foreground text-sm">—</p>}
                    </div>

                    {/* Research Progress & Results */}
                    {researchLoading === investor.investor_id && (
                      <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <span className="text-sm font-medium text-blue-700">Researching {`${investor.first_name || investor.name || ""}${investor.last_name ? " " + investor.last_name : ""}`}...</span>
                        </div>
                        <p className="text-xs text-blue-600">Searching LinkedIn, Google, company websites, professional directories, and news sources.</p>
                        <div className="h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                        </div>
                      </div>
                    )}

                    {researchResult && !researchLoading && (
                      <div className="col-span-2 space-y-3">
                        <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-xs font-semibold text-green-700">Research Summary</span>
                            </div>
                            <TTSButton text={researchResult.summary} cachedAudioUrl={researchResult.ttsAudioUrl} />
                          </div>
                          <p className="text-xs leading-relaxed">{researchResult.summary}</p>
                        </div>
                        <details className="rounded-lg border p-3">
                          <summary className="text-xs font-semibold cursor-pointer text-muted-foreground hover:text-foreground">
                            Full Research Details
                          </summary>
                          <div className="mt-2 text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground max-h-[300px] overflow-y-auto">
                            {researchResult.details}
                          </div>
                        </details>
                      </div>
                    )}

                    {/* ── Investor Profile ── */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <TrendIcon className="h-3 w-3" /> Investor Profile
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div>
                          <span className="text-[10px] text-muted-foreground">Risk Tolerance</span>
                          <p className="capitalize">{(investor.risk_tolerance as string) || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">RE Knowledge</span>
                          <p className="capitalize">{(investor.re_knowledge as string) || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Income Range</span>
                          <p>{(investor.income_range as string) || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Net Worth</span>
                          <p>{(investor.net_worth_range as string) || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground">Other Investments</span>
                          <p className="text-xs">{(investor.other_investments as string) || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground">Investment Goals</span>
                          <p className="text-xs">{(investor.investment_goals as string) || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground">Referral Source</span>
                          <p className="text-xs">{(investor.referral_source as string) || "—"}</p>
                        </div>
                      </div>
                    </div>

                    {/* ── Notes ── */}
                    {(investor.notes as string) && (
                      <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <FileText className="h-3 w-3" /> Notes
                        </h4>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">{investor.notes as string}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Onboarding Progress */}
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
            {/* Pipeline Status */}
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
                      const needsContact = !["new_lead", "warm_lead", "write_off", "archived"].includes(newStatus);
                      if (needsContact && !investor.email && !investor.phone) {
                        alert(`Cannot move to "${STAGES.find(s => s.key === newStatus)?.label}" without an email or phone number.`);
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
                  <Button className="w-full" disabled={isTransitioning} onClick={() => onTransition(action.nextStatus)}>
                    {isTransitioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <action.icon className="mr-2 h-4 w-4" />}
                    {action.label}
                  </Button>
                )}
                {currentStage === "write_off" && (
                  <Button variant="outline" className="w-full text-gray-500" disabled={isTransitioning}
                    onClick={() => { if (confirm("Archive this contact?")) onTransition("archived"); }}>
                    Archive Contact
                  </Button>
                )}
                {currentStage === "archived" && (
                  <Button variant="outline" className="w-full" disabled={isTransitioning} onClick={() => onTransition("write_off")}>
                    Restore from Archive
                  </Button>
                )}
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
                {showActivityForm ? "Cancel" : "Log New Activity"}
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
                      <label className="text-xs text-muted-foreground">Details</label>
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

                    {/* Record Call — appears when type is "call" */}
                    {activityForm.activity_type === "call" && (
                      <div className="col-span-2">
                        <InlineCallRecorder
                          investorId={investorId}
                          onTranscript={(text) => setActivityForm((f) => ({
                            ...f,
                            body: f.body ? f.body + "\n\n--- Call Transcript ---\n" + text : text,
                            subject: f.subject || `Call with ${investor.first_name || investor.name || ""}${investor.last_name ? " " + investor.last_name : ""}`,
                          }))}
                        />
                      </div>
                    )}

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
                  <div className="flex gap-2">
                    {activityForm.activity_type === "email" && (investor.email as string) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          const subject = encodeURIComponent(activityForm.subject || `Message from Living Well Communities`);
                          const body = encodeURIComponent(activityForm.body || "");
                          window.open(`mailto:${investor.email}?subject=${subject}&body=${body}`, "_blank");
                          // Auto-save the activity after opening email client
                          handleSubmitActivity();
                        }}
                        disabled={(!activityForm.subject.trim() && !activityForm.body.trim()) || createActivityMutation.isPending}
                      >
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        Send & Save
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={
                        (!activityForm.subject.trim() && !activityForm.body.trim()) || createActivityMutation.isPending
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
                  </div>
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
            {/* Tasks Section */}
            <InvestorTasksSection investorId={investorId} />
          </>
        )}

        {/* ================================================================
            TAB 4: DOCUMENTS
        ================================================================ */}
        {activeTab === "documents" && (
          <InvestorDocumentsTab investorId={investorId} />
        )}

        {/* ================================================================
            TAB 5: COMMUNICATIONS (Twilio SMS & Call History)
        ================================================================ */}
        {activeTab === "comms" && (
          <InvestorCommsTab investorId={investorId} investor={investor} />
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const visible = activities.slice(0, visibleCount);
  const hasMore = visibleCount < activities.length;
  const hasPrev = visibleCount > ACTIVITIES_PAGE_SIZE;

  return (
    <div className="space-y-2">
      {visible.map((act) => {
        const Icon = ACTIVITY_ICONS[(act.activity_type as string) || "note"] || FileText;
        const ts = act.created_at ? new Date(act.created_at as string).toLocaleString() : "";
        const actId = (act.activity_id ?? act.id) as number;
        const isExpanded = expandedId === actId;
        const bodyText = act.body ? String(act.body) : "";
        const hasLongBody = bodyText.length > 120;

        return (
          <div
            key={actId}
            className={`rounded-lg border p-3 transition-colors cursor-pointer hover:bg-muted/30 ${isExpanded ? "bg-muted/20 ring-1 ring-primary/20" : ""}`}
            onClick={() => setExpandedId(isExpanded ? null : actId)}
          >
            <div className="flex gap-3">
              <div className="mt-0.5 shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{act.subject as string}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {(act.activity_type as string) || "note"}
                  </Badge>
                  {hasLongBody && !isExpanded && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                </div>
                {bodyText && !isExpanded && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{bodyText}</p>
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

            {/* Expanded Details */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
                {bodyText && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Full Details</span>
                    <p className="mt-1 text-xs whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-md p-2.5 max-h-[300px] overflow-y-auto">
                      {bodyText}
                    </p>
                  </div>
                )}
                {!!act.outcome && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Outcome</span>
                    <p className="mt-0.5 text-xs">{String(act.outcome)}</p>
                  </div>
                )}
                {!!act.follow_up_date && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Follow-up</span>
                    <p className="mt-0.5 text-xs">
                      {new Date(act.follow_up_date as string).toLocaleDateString()}
                      {act.follow_up_notes ? ` — ${String(act.follow_up_notes)}` : ""}
                      {act.is_follow_up_done ? " ✓ Done" : ""}
                    </p>
                  </div>
                )}
                {!!act.meeting_date && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Meeting</span>
                    <p className="mt-0.5 text-xs">
                      {new Date(act.meeting_date as string).toLocaleString()}
                      {act.meeting_location ? ` at ${String(act.meeting_location)}` : ""}
                      {act.attendees ? ` — ${String(act.attendees)}` : ""}
                    </p>
                  </div>
                )}
                {(act.twilio_call_sid || act.twilio_sms_sid) && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Twilio Reference</span>
                    <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                      {(act.twilio_call_sid as string) || (act.twilio_sms_sid as string)}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setExpandedId(null)}
                  className="text-[10px] text-blue-600 hover:underline"
                >
                  Collapse
                </button>
              </div>
            )}
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

// ── Inline Call Recorder (inside Log Activity form) ──────────────────────

function InlineCallRecorder({ investorId, onTranscript }: { investorId: number; onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("file", blob, `call_${investorId}_${Date.now()}.webm`);
          const r = await apiClient.post(`/api/investor/investors/${investorId}/transcribe-call`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          onTranscript(r.data.transcript || "");
        } catch { alert("Failed to transcribe recording"); }
        finally { setTranscribing(false); }
      };
      recorder.start(1000);
      setMediaRecorder(recorder);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      alert("Microphone access denied. Please allow microphone access in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (transcribing) {
    return (
      <div className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50/50 p-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span className="text-xs text-blue-700">Transcribing with AI...</span>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="rounded border border-red-200 bg-red-50/50 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-600">Recording...</span>
          </div>
          <span className="text-xs font-mono tabular-nums">{formatTime(elapsed)}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-red-100 overflow-hidden">
          <div className="h-full bg-red-500 rounded-full animate-pulse" style={{ width: `${Math.min(100, (elapsed / 300) * 100)}%` }} />
        </div>
        <Button size="sm" className="w-full h-7 text-xs" variant="destructive" onClick={stopRecording}>
          ⏹ Stop & Transcribe
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" className="w-full h-7 text-xs" variant="outline" onClick={startRecording}>
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />
      Record Call & Transcribe
    </Button>
  );
}

// ── TTS Button (OpenAI natural voice with browser fallback) ──────────────

// ── Investor Tasks Section ────────────────────────────────────────────────

// ── CRM Stats Bar (sticky bottom) ────────────────────────────────────────

function CRMStatsBar() {
  const [expanded, setExpanded] = useState(false);

  const { data: stats } = useQuery<Record<string, any>>({
    queryKey: ["crm-stats"],
    queryFn: () => apiClient.get("/api/investor/crm-stats").then(r => r.data),
    refetchInterval: 60000, // refresh every minute
  });

  if (!stats) return null;

  const overdue = (stats.overdue_followups || 0) + (stats.overdue_tasks || 0);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:left-60">
      {/* Collapsed bar */}
      <div
        className={`flex items-center justify-between px-5 py-3.5 bg-card border-t-2 border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] cursor-pointer hover:bg-muted/40 transition-colors ${expanded ? "border-b" : ""}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-5 text-sm">
          <span className="font-bold text-foreground uppercase tracking-wider text-xs">Today</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-blue-500" />
              <span className="font-bold text-base">{stats.today?.calls || 0}</span>
              <span className="text-muted-foreground text-xs">calls</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-green-500" />
              <span className="font-bold text-base">{stats.today?.emails || 0}</span>
              <span className="text-muted-foreground text-xs">emails</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="font-bold text-base">{stats.today?.meetings || 0}</span>
              <span className="text-muted-foreground text-xs">meetings</span>
            </span>
          </div>
          <span className="h-5 w-px bg-border" />
          {overdue > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 font-semibold">
              <Clock className="h-4 w-4" />
              {overdue} overdue
            </span>
          )}
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold text-foreground">{stats.open_tasks || 0}</span> open tasks
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-medium">{expanded ? "▼ Hide" : "▲ Details"}</span>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="bg-card border-t px-4 py-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="grid grid-cols-3 gap-4 max-w-3xl">
            {/* Today */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Today</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-blue-500" /> Calls</span><span className="font-bold">{stats.today?.calls || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-green-500" /> Emails</span><span className="font-bold">{stats.today?.emails || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Users className="h-3 w-3 text-purple-500" /> Meetings</span><span className="font-bold">{stats.today?.meetings || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-gray-500" /> Notes</span><span className="font-bold">{stats.today?.notes || 0}</span></div>
                <div className="flex justify-between text-xs border-t pt-1 mt-1"><span className="font-medium">Total</span><span className="font-bold">{stats.today?.total || 0}</span></div>
              </div>
            </div>

            {/* This Week */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">This Week</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-blue-500" /> Calls</span><span className="font-bold">{stats.week?.calls || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-green-500" /> Emails</span><span className="font-bold">{stats.week?.emails || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Users className="h-3 w-3 text-purple-500" /> Meetings</span><span className="font-bold">{stats.week?.meetings || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-gray-500" /> Notes</span><span className="font-bold">{stats.week?.notes || 0}</span></div>
                <div className="flex justify-between text-xs border-t pt-1 mt-1"><span className="font-medium">Total</span><span className="font-bold">{stats.week?.total || 0}</span></div>
                <div className="flex justify-between text-xs text-blue-600"><span>New Leads</span><span className="font-bold">{stats.new_leads_week || 0}</span></div>
              </div>
            </div>

            {/* This Month */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">This Month</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-blue-500" /> Calls</span><span className="font-bold">{stats.month?.calls || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-green-500" /> Emails</span><span className="font-bold">{stats.month?.emails || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><Users className="h-3 w-3 text-purple-500" /> Meetings</span><span className="font-bold">{stats.month?.meetings || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-gray-500" /> Notes</span><span className="font-bold">{stats.month?.notes || 0}</span></div>
                <div className="flex justify-between text-xs border-t pt-1 mt-1"><span className="font-medium">Total</span><span className="font-bold">{stats.month?.total || 0}</span></div>
                <div className="flex justify-between text-xs text-blue-600"><span>New Leads</span><span className="font-bold">{stats.new_leads_month || 0}</span></div>
              </div>
            </div>
          </div>

          {/* Alerts row */}
          {overdue > 0 && (
            <div className="mt-3 flex items-center gap-4 text-xs">
              {stats.overdue_followups > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 px-2.5 py-1 font-medium">
                  <Clock className="h-3 w-3" /> {stats.overdue_followups} overdue follow-up{stats.overdue_followups !== 1 ? "s" : ""}
                </span>
              )}
              {stats.overdue_tasks > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-orange-50 text-orange-700 px-2.5 py-1 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> {stats.overdue_tasks} overdue task{stats.overdue_tasks !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InvestorTasksSection({ investorId }: { investorId: number }) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  const { data: tasks = [], isLoading } = useQuery<Array<Record<string, any>>>({
    queryKey: ["investor-tasks", investorId],
    queryFn: () => apiClient.get(`/api/investor/investors/${investorId}/tasks`).then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: { description: string; due_date?: string }) =>
      apiClient.post(`/api/investor/investors/${investorId}/tasks`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investor-tasks", investorId] });
      setNewTask("");
      setNewDueDate("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: number; isCompleted: boolean }) =>
      apiClient.patch(`/api/investor/investors/${investorId}/tasks/${taskId}`, { is_completed: isCompleted }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["investor-tasks", investorId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) =>
      apiClient.delete(`/api/investor/investors/${investorId}/tasks/${taskId}`).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["investor-tasks", investorId] }),
  });

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      await apiClient.post(`/api/investor/investors/${investorId}/tasks/suggest`);
      queryClient.invalidateQueries({ queryKey: ["investor-tasks", investorId] });
    } catch { alert("Failed to generate suggestions"); }
    finally { setSuggesting(false); }
  };

  const openTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 pb-3 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Tasks</CardTitle>
              <p className="text-[10px] text-muted-foreground">{openTasks.length} open · {completedTasks.length} done</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100"
            disabled={suggesting}
            onClick={handleSuggest}
          >
            {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {suggesting ? "Thinking..." : "AI Suggest"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Add task form */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                className="w-full rounded-lg border bg-background pl-3 pr-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="What needs to be done?"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTask.trim()) addMutation.mutate({ description: newTask.trim(), due_date: newDueDate || undefined });
                }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                className="flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-primary/20"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="h-8 px-4"
              disabled={!newTask.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate({ description: newTask.trim(), due_date: newDueDate || undefined })}
            >
              {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add Task"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-12 w-full rounded-lg" /><Skeleton className="h-12 w-full rounded-lg" /></div>
        ) : tasks.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-xs text-muted-foreground">No tasks yet</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add one above or click AI Suggest</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Open tasks */}
            {openTasks.map((t) => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date();
              return (
                <div
                  key={t.task_id}
                  className={`group flex items-start gap-3 rounded-lg border p-3 transition-all hover:shadow-sm ${
                    isOverdue ? "border-red-200 bg-red-50/40" : "hover:border-primary/30 hover:bg-primary/[0.02]"
                  }`}
                >
                  <button
                    onClick={() => toggleMutation.mutate({ taskId: t.task_id, isCompleted: true })}
                    className={`mt-0.5 h-[18px] w-[18px] rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                      isOverdue ? "border-red-300 hover:bg-red-100" : "border-gray-300 hover:border-primary hover:bg-primary/10"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{t.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {t.due_date && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0 ${
                          isOverdue ? "bg-red-100 text-red-700 font-medium" : "bg-muted text-muted-foreground"
                        }`}>
                          <Clock className="h-2.5 w-2.5" />
                          {isOverdue ? "Overdue: " : ""}{new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {t.source === "ai_suggested" && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] rounded-full bg-purple-50 text-purple-600 px-1.5 py-0">
                          <Sparkles className="h-2 w-2" /> AI
                        </span>
                      )}
                      {t.priority === "high" && (
                        <span className="inline-flex items-center text-[9px] rounded-full bg-orange-50 text-orange-600 px-1.5 py-0 font-medium">
                          ↑ High
                        </span>
                      )}
                      {t.priority === "low" && (
                        <span className="inline-flex items-center text-[9px] rounded-full bg-blue-50 text-blue-500 px-1.5 py-0">
                          ↓ Low
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0 mt-0.5"
                    onClick={() => { if (confirm("Delete this task?")) deleteMutation.mutate(t.task_id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Completed tasks */}
            {completedTasks.length > 0 && (
              <details className="mt-3 rounded-lg border border-dashed">
                <summary className="px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted/30 rounded-lg flex items-center gap-1.5 transition-colors">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {completedTasks.length} completed task{completedTasks.length !== 1 ? "s" : ""}
                </summary>
                <div className="px-1 pb-1 space-y-1">
                  {completedTasks.map((t) => (
                    <div key={t.task_id} className="group flex items-start gap-3 rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                      <button
                        onClick={() => toggleMutation.mutate({ taskId: t.task_id, isCompleted: false })}
                        className="mt-0.5 h-[18px] w-[18px] rounded-full border-2 border-green-400 bg-green-50 shrink-0 flex items-center justify-center"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm line-through text-muted-foreground/70">{t.description}</p>
                        {t.completed_date && (
                          <span className="text-[10px] text-muted-foreground/50">Done {new Date(t.completed_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0"
                        onClick={() => deleteMutation.mutate(t.task_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Sparkles icon import check ───────────────────────────────────────────

function TTSButton({ text, cachedAudioUrl }: { text: string; cachedAudioUrl?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClick = async () => {
    // If already playing, stop everything
    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setPlaying(false);
      return;
    }

    const baseUrl = apiClient.defaults.baseURL || "";

    // If we have a cached audio file, play it instantly (no API call needed)
    if (cachedAudioUrl) {
      try {
        const audio = new Audio(`${baseUrl}${cachedAudioUrl}`);
        audioRef.current = audio;
        audio.onended = () => { setPlaying(false); audioRef.current = null; };
        audio.onerror = () => { audioRef.current = null; setPlaying(false); };
        await audio.play();
        setPlaying(true);
        return;
      } catch {
        // Fall through to live TTS if cached file fails
      }
    }

    setLoading(true);
    try {
      // Use fetch for true streaming — audio starts as soon as first bytes arrive
      const token = typeof window !== "undefined" ? localStorage.getItem("lwc_access_token") : null;
      const resp = await fetch(`${baseUrl}/api/investor/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text, voice: "nova" }),
      });
      if (!resp.ok) throw new Error("TTS failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); audioRef.current = null; URL.revokeObjectURL(url); };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 0.95;
          u.onend = () => setPlaying(false);
          window.speechSynthesis.speak(u);
        }
        setPlaying(false);
      };
      setLoading(false);
      await audio.play();
      setPlaying(true);
    } catch {
      // Fallback to browser TTS
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.95;
        u.onend = () => setPlaying(false);
        window.speechSynthesis.speak(u);
        setPlaying(true);
      } else {
        alert("Text-to-speech not available");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="text-[10px] px-2 py-0.5 rounded bg-white border hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Loading..." : playing ? "⏹ Stop" : "🔊 Read Aloud"}
    </button>
  );
}

// ── Investor Communications Tab (Twilio SMS & Call History) ────────────

function InvestorCommsTab({ investorId, investor }: { investorId: number; investor: Record<string, unknown> }) {
  const queryClient = useQueryClient();
  const [commsView, setCommsView] = useState<"sms" | "calls">("sms");
  const [smsBody, setSmsBody] = useState("");
  const [smsToNumber, setSmsToNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [callToNumber, setCallToNumber] = useState("");
  const [callsPage, setCallsPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Browser calling via Twilio Voice SDK
  const twilioDevice = useTwilioDevice();

  // SMS thread
  const { data: smsThread = [], isLoading: smsLoading } = useQuery<Array<Record<string, any>>>({
    queryKey: ["twilio-sms", investorId],
    queryFn: () => twilioApi.getSmsThread(investorId),
    refetchInterval: 10000, // Auto-refresh every 10s
  });

  // Call logs
  const { data: callLogs = [], isLoading: callsLoading } = useQuery<Array<Record<string, any>>>({
    queryKey: ["twilio-calls", investorId],
    queryFn: () => twilioApi.getCallLogs(investorId),
  });

  // Twilio config status
  const { data: twilioStatus } = useQuery<Record<string, any>>({
    queryKey: ["twilio-status"],
    queryFn: () => twilioApi.getStatus(),
    staleTime: 60000,
  });

  // Auto-scroll SMS to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [smsThread]);

  const handleSendSms = async () => {
    if (!smsBody.trim()) return;
    setSending(true);
    try {
      await twilioApi.sendSms(investorId, smsBody.trim(), smsToNumber || undefined);
      setSmsBody("");
      queryClient.invalidateQueries({ queryKey: ["twilio-sms", investorId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-detail", investorId] });
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  // Initialize Twilio device when component mounts (for browser calling)
  useEffect(() => {
    if (twilioStatus?.voice_ready) {
      twilioDevice.init();
    }
    return () => {
      twilioDevice.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twilioStatus?.voice_ready]);

  const handleCall = async (toNumber?: string) => {
    const num = toNumber || phone || mobile;
    if (!num) {
      alert("No phone number available");
      return;
    }
    if (!twilioDevice.ready) {
      alert("Voice device is still initializing. Please try again in a moment.");
      return;
    }
    await twilioDevice.makeCall(num, investorId);
    // Auto-switch to Call History view
    setCommsView("calls");
    // Refresh call logs after a short delay
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["twilio-calls", investorId] });
    }, 3000);
  };

  // Format duration as mm:ss
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleTranscribe = async (callLogId: number) => {
    try {
      await twilioApi.transcribeCall(callLogId);
      queryClient.invalidateQueries({ queryKey: ["twilio-calls", investorId] });
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Transcription failed");
    }
  };

  const isConfigured = twilioStatus?.configured === true;
  const phone = (investor.phone as string) || "";
  const mobile = (investor.mobile as string) || "";
  const hasPhone = !!(phone || mobile);

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <Phone className="h-8 w-8 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium">Twilio Not Configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your Twilio Account SID, Auth Token, and Phone Number in
            <span className="font-medium"> Settings → API Keys</span> to enable calls and SMS.
          </p>
        </div>
      </div>
    );
  }

  const isInCall = ["connecting", "ringing", "open"].includes(twilioDevice.callState);

  return (
    <div className="space-y-3">
      {/* Active Call Banner */}
      {isInCall && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${
                twilioDevice.callState === "open" ? "bg-green-500 animate-pulse" :
                twilioDevice.callState === "ringing" ? "bg-yellow-500 animate-pulse" :
                "bg-blue-500 animate-pulse"
              }`} />
              <span className="text-sm font-semibold text-green-800">
                {twilioDevice.callState === "connecting" ? "Connecting..." :
                 twilioDevice.callState === "ringing" ? "Ringing..." :
                 "Call Active"}
              </span>
            </div>
            <span className="text-sm font-mono text-green-700">
              {twilioDevice.callState === "open" ? formatDuration(twilioDevice.duration) : ""}
            </span>
          </div>
          <p className="text-xs text-green-700">
            {twilioDevice.activeNumber}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={twilioDevice.isMuted ? "destructive" : "outline"}
              className="text-xs gap-1"
              onClick={() => twilioDevice.toggleMute()}
            >
              {twilioDevice.isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
              {twilioDevice.isMuted ? "Unmute" : "Mute"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs gap-1"
              onClick={() => {
                twilioDevice.hangUp();
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ["twilio-calls", investorId] });
                }, 2000);
              }}
            >
              <PhoneOff className="h-3 w-3" />
              Hang Up
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {twilioDevice.error && !isInCall && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {twilioDevice.error}
        </div>
      )}

      {/* Quick Actions — Call buttons */}
      {hasPhone && !isInCall && (
        <div className="flex gap-2">
          {[phone, mobile].filter(Boolean).map((num, i) => (
            <Button
              key={i}
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              disabled={isInCall || !twilioDevice.ready}
              onClick={() => handleCall(num)}
            >
              <Phone className="h-3 w-3" />
              Call {i === 0 && phone ? "Phone" : "Mobile"}
            </Button>
          ))}
          {!twilioDevice.ready && twilioStatus?.voice_ready && (
            <span className="text-[10px] text-muted-foreground self-center">Initializing mic...</span>
          )}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-1 border-b">
        {[
          { key: "sms" as const, label: "SMS", icon: MessageSquare, count: smsThread.length },
          { key: "calls" as const, label: "Call History", icon: Phone, count: callLogs.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setCommsView(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              commsView === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
            {t.count > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-[16px] justify-center">
                {t.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* SMS View */}
      {commsView === "sms" && (
        <div className="flex flex-col" style={{ minHeight: 300 }}>
          {/* Custom number input */}
          <div className="flex gap-2 items-center mb-2">
            <input
              value={smsToNumber}
              onChange={(e) => setSmsToNumber(e.target.value)}
              placeholder="Custom number (optional)"
              className="flex-1 rounded border bg-background px-2 py-1.5 text-xs"
            />
            {smsToNumber && (
              <button onClick={() => setSmsToNumber("")} className="text-[10px] text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
          </div>
          {!hasPhone && !smsToNumber ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-xs text-muted-foreground">No phone number on file. Add a phone/mobile or enter a custom number above.</p>
            </div>
          ) : (
            <>
              {/* Messages Thread */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto space-y-2 px-1 py-2 max-h-[350px] min-h-[200px]"
              >
                {smsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : smsThread.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MessageSquare className="h-6 w-6 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No messages yet. Send the first SMS below.</p>
                  </div>
                ) : (
                  smsThread.map((msg: Record<string, any>) => (
                    <div
                      key={msg.sms_log_id}
                      className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                          msg.direction === "outbound"
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        <div className={`flex items-center gap-1.5 mt-1 text-[9px] ${
                          msg.direction === "outbound" ? "text-blue-200" : "text-muted-foreground"
                        }`}>
                          <span>{new Date(msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          {msg.direction === "outbound" && (
                            <span className="capitalize">· {msg.status}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Compose */}
              <div className="border-t pt-2 mt-auto">
                <div className="flex gap-2">
                  <textarea
                    value={smsBody}
                    onChange={(e) => setSmsBody(e.target.value)}
                    placeholder="Type a message..."
                    rows={2}
                    maxLength={1600}
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendSms();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={sending || !smsBody.trim()}
                    onClick={handleSendSms}
                    className="self-end"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send"}
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1 text-right">
                  {smsBody.length}/160 {smsBody.length > 160 ? `(${Math.ceil(smsBody.length / 160)} segments)` : ""}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Call History View */}
      {commsView === "calls" && (
        <div className="space-y-2">
          {/* Quick dial */}
          {hasPhone && !isInCall && (
            <div className="flex gap-2 items-center">
              <input
                value={callToNumber}
                onChange={(e) => setCallToNumber(e.target.value)}
                placeholder="Custom number (optional)"
                className="flex-1 rounded border bg-background px-2 py-1.5 text-xs"
              />
              <Button size="sm" variant="outline" disabled={isInCall || !twilioDevice.ready} onClick={() => handleCall(callToNumber || undefined)}>
                <Phone className="h-3 w-3 mr-1" />Dial
              </Button>
            </div>
          )}

          {callsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : callLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="h-6 w-6 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No calls yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {callLogs.slice(0, callsPage * 3).map((call: Record<string, any>) => {
                const statusColors: Record<string, string> = {
                  completed: "bg-green-100 text-green-700",
                  "in-progress": "bg-blue-100 text-blue-700",
                  ringing: "bg-yellow-100 text-yellow-700",
                  initiated: "bg-gray-100 text-gray-700",
                  busy: "bg-orange-100 text-orange-700",
                  "no-answer": "bg-red-100 text-red-700",
                  canceled: "bg-gray-100 text-gray-500",
                  failed: "bg-red-100 text-red-700",
                };
                return (
                  <div key={call.call_log_id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className={`h-3.5 w-3.5 ${call.direction === "inbound" ? "rotate-[135deg] text-green-600" : "text-blue-600"}`} />
                        <span className="text-xs font-medium">
                          {call.direction === "outbound" ? `→ ${call.to_number}` : `← ${call.from_number}`}
                        </span>
                      </div>
                      <Badge className={`text-[9px] px-1.5 py-0 ${statusColors[call.status] || "bg-gray-100 text-gray-600"}`}>
                        {call.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{new Date(call.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {call.duration_seconds != null && (
                        <span>{Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, "0")}</span>
                      )}
                    </div>
                    {/* Transcript */}
                    {call.transcript ? (
                      <details className="mt-1">
                        <summary className="text-[10px] font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                          View Transcript
                        </summary>
                        <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground bg-muted/30 rounded p-2 max-h-[150px] overflow-y-auto">
                          {call.transcript}
                        </p>
                      </details>
                    ) : call.recording_url && call.transcription_status !== "completed" ? (
                      <button
                        onClick={() => handleTranscribe(call.call_log_id)}
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        {call.transcription_status === "pending" ? "Transcribing..." : "Transcribe Recording"}
                      </button>
                    ) : null}
                    {/* Play recording */}
                    {call.recording_url && (
                      <audio
                        src={call.recording_url.startsWith("http") ? call.recording_url : `https://api.twilio.com${call.recording_url}.mp3`}
                        controls
                        className="w-full h-7 mt-1"
                      />
                    )}
                  </div>
                );
              })}
              {/* Pagination */}
              {callLogs.length > callsPage * 3 && (
                <button
                  onClick={() => setCallsPage((p) => p + 1)}
                  className="w-full text-center text-xs text-blue-600 hover:underline py-1.5"
                >
                  Show More ({callLogs.length - callsPage * 3} more)
                </button>
              )}
              {callsPage > 1 && (
                <button
                  onClick={() => setCallsPage(1)}
                  className="w-full text-center text-xs text-muted-foreground hover:underline py-1"
                >
                  Show Less
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Schedule Follow-up — always visible below SMS or Call History */}
      <Card className="mt-3">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Schedule Follow-up
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" id={`fu-type-${investorId}`} defaultValue="call">
                <option value="call">Phone Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <input type="date" className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" id={`fu-date-${investorId}`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Time</label>
              <input type="time" className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" id={`fu-time-${investorId}`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Subject</label>
              <input type="text" className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" placeholder="Optional" id={`fu-subject-${investorId}`} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <input type="text" className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm" placeholder="Optional notes" id={`fu-notes-${investorId}`} />
            </div>
            <div className="col-span-2">
              <Button size="sm" className="w-full" onClick={async () => {
                const fuType = (document.getElementById(`fu-type-${investorId}`) as HTMLSelectElement)?.value;
                const fuDate = (document.getElementById(`fu-date-${investorId}`) as HTMLInputElement)?.value;
                const fuTime = (document.getElementById(`fu-time-${investorId}`) as HTMLInputElement)?.value;
                const fuSubject = (document.getElementById(`fu-subject-${investorId}`) as HTMLInputElement)?.value;
                const fuNotes = (document.getElementById(`fu-notes-${investorId}`) as HTMLInputElement)?.value;
                if (!fuDate) { alert("Please select a date"); return; }
                try {
                  const resp = await apiClient.post(`/api/investor/investors/${investorId}/schedule-followup`, {
                    follow_up_type: fuType, follow_up_date: fuDate, follow_up_time: fuTime, subject: fuSubject, notes: fuNotes,
                  });
                  const gcalUrl = resp.data?.google_calendar_url;
                  if (gcalUrl && confirm(`Follow-up ${fuType} scheduled for ${fuDate}.\n\nAdd to Google Calendar?`)) {
                    window.open(gcalUrl, "_blank");
                  }
                  (document.getElementById(`fu-date-${investorId}`) as HTMLInputElement).value = "";
                  (document.getElementById(`fu-time-${investorId}`) as HTMLInputElement).value = "";
                  (document.getElementById(`fu-subject-${investorId}`) as HTMLInputElement).value = "";
                  (document.getElementById(`fu-notes-${investorId}`) as HTMLInputElement).value = "";
                  queryClient.invalidateQueries({ queryKey: ["crm-activities", investorId] });
                  queryClient.invalidateQueries({ queryKey: ["crm-followups", investorId] });
                } catch { alert("Failed to schedule follow-up"); }
              }}>
                <Calendar className="h-3.5 w-3.5 mr-1.5" /> Schedule
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
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
