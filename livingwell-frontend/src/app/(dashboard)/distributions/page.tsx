"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign,
  CheckCircle2,
  Send,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type {
  LPEntity,
  WaterfallResult,
  DistributionEvent,
} from "@/types/investment";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  calculated: "bg-blue-100 text-blue-700",
  approved: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  published: "bg-purple-100 text-purple-700",
};

function statusBadge(status: string) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Select LP & Preview", icon: DollarSign },
  { label: "Create Distribution", icon: Clock },
  { label: "Approve & Pay", icon: CheckCircle2 },
  { label: "History", icon: Send },
] as const;

function Stepper({
  current,
  onStep,
}: {
  current: number;
  onStep: (i: number) => void;
}) {
  return (
    <nav className="flex items-center justify-between">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => onStep(i)}
              className={`flex flex-col items-center gap-1.5 transition-colors ${
                active
                  ? "text-blue-600"
                  : done
                    ? "text-green-600"
                    : "text-gray-400"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : done
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-gray-300 bg-white text-gray-400"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span className="hidden text-xs font-medium sm:block">
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 h-0.5 flex-1 rounded ${
                  i < current ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DistributionsPage() {
  const qc = useQueryClient();

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedLpId, setSelectedLpId] = useState<number | null>(null);
  const [distributableAmount, setDistributableAmount] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [notes, setNotes] = useState("");

  // Results kept in state between steps
  const [waterfallResult, setWaterfallResult] =
    useState<WaterfallResult | null>(null);
  const [createdEvent, setCreatedEvent] = useState<DistributionEvent | null>(
    null,
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────
  const { data: lps = [], isLoading: lpsLoading } = useQuery<LPEntity[]>({
    queryKey: ["lps"],
    queryFn: () =>
      apiClient
        .get("/api/investment/lp")
        .then((r) => (Array.isArray(r.data) ? r.data : r.data.items)),
  });

  const {
    data: distributions = [],
    isLoading: distLoading,
    refetch: refetchDistributions,
  } = useQuery<DistributionEvent[]>({
    queryKey: ["distributions", selectedLpId],
    enabled: !!selectedLpId,
    queryFn: () =>
      apiClient
        .get(`/api/investment/lp/${selectedLpId}/distributions`)
        .then((r) => (Array.isArray(r.data) ? r.data : r.data.items)),
  });

  // ── Mutations ──────────────────────────────────────────────────────
  const waterfallMutation = useMutation({
    mutationFn: ({
      lpId,
      amount,
    }: {
      lpId: number;
      amount: number;
    }) =>
      apiClient
        .post<WaterfallResult>(`/api/investment/lp/${lpId}/waterfall`, {
          distributable_amount: amount,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setWaterfallResult(data);
      flash("Waterfall preview generated successfully.");
    },
  });

  const createDistMutation = useMutation({
    mutationFn: ({
      lpId,
      payload,
    }: {
      lpId: number;
      payload: { distributable_amount: number; period_label: string; notes: string };
    }) =>
      apiClient
        .post(`/api/investment/lp/${lpId}/distributions/create-from-waterfall`, payload)
        .then((r) => r.data),
    onSuccess: (data) => {
      setCreatedEvent(data);
      qc.invalidateQueries({ queryKey: ["distributions", selectedLpId] });
      flash(
        `Distribution created (Event #${data.event_id}, ${data.allocations?.length ?? 0} allocations).`,
      );
      setStep(2);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (eventId: number) =>
      apiClient
        .patch(`/api/investment/distributions/${eventId}/approve`)
        .then((r) => r.data),
    onSuccess: (data) => {
      setCreatedEvent(data);
      qc.invalidateQueries({ queryKey: ["distributions", selectedLpId] });
      flash("Distribution approved.");
    },
  });

  const payMutation = useMutation({
    mutationFn: (eventId: number) =>
      apiClient
        .patch(`/api/investment/distributions/${eventId}/pay`)
        .then((r) => r.data),
    onSuccess: (data) => {
      setCreatedEvent(data);
      qc.invalidateQueries({ queryKey: ["distributions", selectedLpId] });
      flash(
        `Distribution marked as paid. ${data.holdings_updated ?? ""} holdings updated.`,
      );
    },
  });

  const publishMutation = useMutation({
    mutationFn: (eventId: number) =>
      apiClient
        .patch(`/api/investment/distributions/${eventId}/publish`)
        .then((r) => r.data),
    onSuccess: (data) => {
      setCreatedEvent(data);
      qc.invalidateQueries({ queryKey: ["distributions", selectedLpId] });
      flash("Distribution published.");
      setStep(3);
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────
  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }

  const anyMutating =
    waterfallMutation.isPending ||
    createDistMutation.isPending ||
    approveMutation.isPending ||
    payMutation.isPending ||
    publishMutation.isPending;

  const mutationError =
    waterfallMutation.error ||
    createDistMutation.error ||
    approveMutation.error ||
    payMutation.error ||
    publishMutation.error;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <DollarSign className="h-6 w-6" />
          Distribution Management
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Preview waterfall, create distributions, approve, pay, and publish.
        </p>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="pt-2">
          <Stepper current={step} onStep={setStep} />
        </CardContent>
      </Card>

      {/* Success / Error banners */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {mutationError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(mutationError as Error).message ??
            "Something went wrong. Please try again."}
        </div>
      )}

      {/* ── Step 0 — Select LP & Preview ─────────────────────────────── */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 — Select LP &amp; Preview Waterfall</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* LP selector */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">
                  LP Fund
                </label>
                {lpsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading funds...
                  </div>
                ) : (
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={selectedLpId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLpId(v ? Number(v) : null);
                      setWaterfallResult(null);
                      setCreatedEvent(null);
                    }}
                  >
                    <option value="">Select an LP fund...</option>
                    {lps.map((lp) => (
                      <option key={lp.lp_id} value={lp.lp_id}>
                        {lp.fund_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">
                  Distributable Amount (CAD)
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={distributableAmount}
                  onChange={(e) => setDistributableAmount(e.target.value)}
                />
              </div>
            </div>

            <Button
              disabled={
                !selectedLpId ||
                !distributableAmount ||
                Number(distributableAmount) <= 0 ||
                waterfallMutation.isPending
              }
              onClick={() =>
                waterfallMutation.mutate({
                  lpId: selectedLpId!,
                  amount: Number(distributableAmount),
                })
              }
            >
              {waterfallMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Preview Waterfall
            </Button>

            {/* Waterfall results */}
            {waterfallResult && (
              <div className="mt-4 space-y-4">
                {/* Tier summary */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      label: "T1 Return of Capital",
                      value: waterfallResult.tier1_total,
                    },
                    {
                      label: "T2 Preferred Return",
                      value: waterfallResult.tier2_total,
                    },
                    {
                      label: "T3 GP Catch-up",
                      value: waterfallResult.tier3_total,
                    },
                    {
                      label: "T4 Carried Interest",
                      value: waterfallResult.tier4_total,
                    },
                  ].map((t) => (
                    <div
                      key={t.label}
                      className="rounded-lg border bg-gray-50 p-3 text-center"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        {t.label}
                      </p>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {cad.format(t.value)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Per-holder allocation table */}
                {waterfallResult.allocations.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          {[
                            "Investor",
                            "GP?",
                            "Units",
                            "T1 ROC",
                            "T2 Pref",
                            "T3 Catch-up",
                            "T4 Carry",
                            "Total",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {waterfallResult.allocations.map((a) => (
                          <tr
                            key={a.holding_id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-3 py-2 font-medium text-gray-900">
                              {a.investor_name}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {a.is_gp ? "Yes" : "No"}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {a.units_held}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {cad.format(a.tier1_roc)}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {cad.format(a.tier2_preferred)}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {cad.format(a.tier3_catchup)}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {cad.format(a.tier4_carry)}
                            </td>
                            <td className="px-3 py-2 font-semibold text-gray-900">
                              {cad.format(a.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => setStep(1)}>
                    Continue to Create Distribution
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 1 — Create Distribution ─────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 — Create Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!waterfallResult ? (
              <div className="flex items-center gap-2 text-sm text-yellow-700">
                <AlertCircle className="h-4 w-4" />
                Please preview the waterfall first (Step 1).
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Creating distribution for{" "}
                  <span className="font-semibold">
                    {lps.find((l) => l.lp_id === selectedLpId)?.fund_name}
                  </span>{" "}
                  with distributable amount of{" "}
                  <span className="font-semibold">
                    {cad.format(Number(distributableAmount))}
                  </span>
                  .
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700">
                      Period Label
                    </label>
                    <Input
                      placeholder="e.g. Q1 2026"
                      value={periodLabel}
                      onChange={(e) => setPeriodLabel(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">
                    Notes
                  </label>
                  <Textarea
                    placeholder="Optional notes for this distribution..."
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <Button
                  disabled={
                    !periodLabel.trim() || createDistMutation.isPending
                  }
                  onClick={() =>
                    createDistMutation.mutate({
                      lpId: selectedLpId!,
                      payload: {
                        distributable_amount: Number(distributableAmount),
                        period_label: periodLabel.trim(),
                        notes: notes.trim(),
                      },
                    })
                  }
                >
                  {createDistMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Distribution
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2 — Approve & Pay ────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 — Approve &amp; Pay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!createdEvent ? (
              <div className="flex items-center gap-2 text-sm text-yellow-700">
                <AlertCircle className="h-4 w-4" />
                No distribution created yet. Please complete Step 2 first.
              </div>
            ) : (
              <>
                {/* Event overview */}
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Event ID
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        #{createdEvent.event_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Period
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {createdEvent.period_label}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Amount
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {cad.format(Number(createdEvent.total_distributable))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Status
                      </p>
                      <div className="mt-0.5">
                        {statusBadge(createdEvent.status)}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Allocations
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {createdEvent.allocations?.length ?? 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={
                      createdEvent.status !== "draft" ||
                      approveMutation.isPending ||
                      anyMutating
                    }
                    onClick={() =>
                      approveMutation.mutate(createdEvent.event_id)
                    }
                  >
                    {approveMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Approve
                  </Button>

                  <Button
                    variant="outline"
                    disabled={
                      createdEvent.status !== "approved" ||
                      payMutation.isPending ||
                      anyMutating
                    }
                    onClick={() => payMutation.mutate(createdEvent.event_id)}
                  >
                    {payMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <DollarSign className="mr-1.5 h-4 w-4" />
                    Pay
                  </Button>

                  <Button
                    variant="outline"
                    disabled={
                      createdEvent.status !== "paid" ||
                      publishMutation.isPending ||
                      anyMutating
                    }
                    onClick={() =>
                      publishMutation.mutate(createdEvent.event_id)
                    }
                  >
                    {publishMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Send className="mr-1.5 h-4 w-4" />
                    Publish
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3 — History ──────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4 — Distribution History</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedLpId ? (
              <p className="text-sm text-gray-400">
                Select an LP fund in Step 1 to view distribution history.
              </p>
            ) : distLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading
                distributions...
              </div>
            ) : distributions.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No distributions found for this LP.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      {[
                        "Period",
                        "Amount",
                        "Status",
                        "Created",
                        "Approved",
                        "Paid",
                        "Allocations",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {distributions.map((d) => (
                      <tr key={d.event_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {d.period_label}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {cad.format(Number(d.total_distributable))}
                        </td>
                        <td className="px-3 py-2">{statusBadge(d.status)}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {d.created_date
                            ? new Date(d.created_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {d.approved_date
                            ? new Date(d.approved_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {d.paid_date
                            ? new Date(d.paid_date).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">
                          {d.allocations?.length ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-start">
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedLpId}
                onClick={() => refetchDistributions()}
              >
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
