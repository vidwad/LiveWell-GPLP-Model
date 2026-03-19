"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Sparkles, Loader2, ExternalLink, Save, Star, Search } from "lucide-react";

interface FundingOpportunity {
  funding_id: number;
  title: string;
  funding_source: string | null;
  operator_id: number | null;
  community_id: number | null;
  amount: number | null;
  status: "draft" | "submitted" | "awarded" | "denied" | "withdrawn";
  submission_deadline: string | null;
  reporting_deadline: string | null;
  awarded_amount: number | null;
  notes: string | null;
  created_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  awarded: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
  withdrawn: "bg-yellow-100 text-yellow-700",
};

const STATUS_OPTIONS = ["draft", "submitted", "awarded", "denied", "withdrawn"];

const EMPTY_FORM = {
  title: "",
  funding_source: "",
  amount: "",
  status: "draft",
  submission_deadline: "",
  reporting_deadline: "",
  awarded_amount: "",
  notes: "",
};

export default function FundingPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showResearch, setShowResearch] = useState(false);
  const [researchType, setResearchType] = useState("RecoverWell");
  const [researchCity, setResearchCity] = useState("Calgary");
  const [researchResults, setResearchResults] = useState<Record<string, unknown> | null>(null);

  const researchMutation = useMutation({
    mutationFn: (params: { community_type: string; city: string }) =>
      apiClient.post("/api/ai/research-funding", params).then(r => r.data),
    onSuccess: (data) => setResearchResults(data),
  });

  const saveOpportunitiesMutation = useMutation({
    mutationFn: (opps: object[]) =>
      apiClient.post("/api/ai/research-funding/save-opportunities", opps).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funding"] });
    },
  });

  const { data: opportunities = [], isLoading } = useQuery<FundingOpportunity[]>({
    queryKey: ["funding"],
    queryFn: () => apiClient.get("/api/operator/funding").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) =>
      apiClient.post("/api/operator/funding", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funding"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      apiClient.patch(`/api/operator/funding/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funding"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/operator/funding/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funding"] }),
  });

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowForm(false);
  };

  const openEdit = (opp: FundingOpportunity) => {
    setForm({
      title: opp.title,
      funding_source: opp.funding_source ?? "",
      amount: opp.amount?.toString() ?? "",
      status: opp.status,
      submission_deadline: opp.submission_deadline ?? "",
      reporting_deadline: opp.reporting_deadline ?? "",
      awarded_amount: opp.awarded_amount?.toString() ?? "",
      notes: opp.notes ?? "",
    });
    setEditId(opp.funding_id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      funding_source: form.funding_source || null,
      amount: form.amount ? parseFloat(form.amount) : null,
      status: form.status,
      submission_deadline: form.submission_deadline || null,
      reporting_deadline: form.reporting_deadline || null,
      awarded_amount: form.awarded_amount ? parseFloat(form.awarded_amount) : null,
      notes: form.notes || null,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = statusFilter === "all"
    ? opportunities
    : opportunities.filter((o) => o.status === statusFilter);

  const totalAwarded = opportunities
    .filter((o) => o.status === "awarded")
    .reduce((sum, o) => sum + (o.awarded_amount ?? o.amount ?? 0), 0);

  const totalPending = opportunities
    .filter((o) => o.status === "submitted")
    .reduce((sum, o) => sum + (o.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grant & Funding Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track grant applications, funding opportunities, and award statuses.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowResearch(!showResearch)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showResearch ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Research
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + New Opportunity
          </button>
        </div>
      </div>

      {/* AI Funding Research Panel */}
      {showResearch && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-purple-900">AI Grant Research</h2>
          </div>
          <p className="text-sm text-purple-700">
            Claude will search for relevant government grants, housing programs, and funding opportunities
            based on your community type and location.
          </p>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-purple-700">Community Type</label>
              <select value={researchType} onChange={e => setResearchType(e.target.value)}
                className="block mt-1 rounded-md border border-purple-300 px-3 py-2 text-sm bg-white">
                <option value="RecoverWell">RecoverWell (Sober Living)</option>
                <option value="StudyWell">StudyWell (Student Housing)</option>
                <option value="RetireWell">RetireWell (Seniors Housing)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-purple-700">City</label>
              <select value={researchCity} onChange={e => setResearchCity(e.target.value)}
                className="block mt-1 rounded-md border border-purple-300 px-3 py-2 text-sm bg-white">
                <option value="Calgary">Calgary</option>
                <option value="Edmonton">Edmonton</option>
                <option value="Red Deer">Red Deer</option>
                <option value="Lethbridge">Lethbridge</option>
                <option value="Medicine Hat">Medicine Hat</option>
              </select>
            </div>
            <button
              onClick={() => researchMutation.mutate({ community_type: researchType, city: researchCity })}
              disabled={researchMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {researchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {researchMutation.isPending ? "Researching..." : "Search for Grants"}
            </button>
          </div>

          {/* Research Results */}
          {researchResults && (
            <div className="space-y-4 mt-4">
              {/* Summary */}
              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm font-medium text-gray-900">{(researchResults as Record<string, unknown>).summary as string}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-600">
                  <span>Total potential: <strong>{(researchResults as Record<string, unknown>).total_potential as string}</strong></span>
                </div>
                {(researchResults.recommended_priority as string[] || []).length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-500">Priority: </span>
                    {(researchResults.recommended_priority as string[]).map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-full px-2 py-0.5 mr-1">
                        <Star className="h-3 w-3" /> {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Opportunities */}
              <div className="grid gap-3 md:grid-cols-2">
                {((researchResults.opportunities as Record<string, unknown>[]) || []).map((opp, i) => (
                  <div key={i} className="bg-white rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{opp.program_name as string}</h3>
                        <p className="text-xs text-gray-500">{opp.funding_source as string}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {Array.from({ length: Math.min(5, Math.ceil((opp.relevance_score as number || 0) / 2)) }).map((_, j) => (
                          <Star key={j} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        ))}
                        <span className="text-xs text-gray-400 ml-1">{opp.relevance_score as number}/10</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">{opp.description as string}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Amount:</span>
                        <span className="ml-1 font-medium">{opp.estimated_amount as string}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Type:</span>
                        <span className="ml-1 font-medium capitalize">{(opp.program_type as string || "").replace("_", " ")}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      <span className="font-medium">Eligibility:</span> {opp.eligibility_summary as string}
                    </div>
                    {opp.url_hint && (
                      <div className="flex items-center gap-1 text-xs text-purple-600">
                        <ExternalLink className="h-3 w-3" />
                        {opp.url_hint as string}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Save All button */}
              <div className="flex gap-2">
                <button
                  onClick={() => saveOpportunitiesMutation.mutate(researchResults.opportunities as object[])}
                  disabled={saveOpportunitiesMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saveOpportunitiesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save All as Draft Opportunities
                </button>
                {saveOpportunitiesMutation.isSuccess && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    Saved! Check your opportunities list below.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Opportunities</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{opportunities.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Awarded</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            ${totalAwarded.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pending (Submitted)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            ${totalPending.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", ...STATUS_OPTIONS].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize font-medium transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No funding opportunities found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Title", "Source", "Amount", "Status", "Submission Deadline", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((opp) => (
                  <tr key={opp.funding_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{opp.title}</td>
                    <td className="px-4 py-3 text-gray-500">{opp.funding_source ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {opp.status === "awarded" && opp.awarded_amount
                        ? `$${opp.awarded_amount.toLocaleString()} awarded`
                        : opp.amount
                        ? `$${opp.amount.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[opp.status]}`}>
                        {opp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {opp.submission_deadline ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(opp)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this opportunity?")) {
                              deleteMutation.mutate(opp.funding_id);
                            }
                          }}
                          className="text-red-500 hover:underline text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {editId ? "Edit Funding Opportunity" : "New Funding Opportunity"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Funding Source</label>
                  <input
                    value={form.funding_source}
                    onChange={(e) => setForm({ ...form, funding_source: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. CMHC, Province of Alberta"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Requested Amount ($)</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Awarded Amount ($)</label>
                  <input
                    type="number"
                    value={form.awarded_amount}
                    onChange={(e) => setForm({ ...form, awarded_amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Submission Deadline</label>
                  <input
                    type="date"
                    value={form.submission_deadline}
                    onChange={(e) => setForm({ ...form, submission_deadline: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reporting Deadline</label>
                  <input
                    type="date"
                    value={form.reporting_deadline}
                    onChange={(e) => setForm({ ...form, reporting_deadline: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {editId ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
