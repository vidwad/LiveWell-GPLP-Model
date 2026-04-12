"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import {
  Landmark, ShieldCheck, TrendingUp, Calendar, DollarSign, Target,
  Lock, Save, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n) : "—";
const fmtPct = (n: number | null | undefined) => n != null ? `${Number(n).toFixed(2)}%` : "—";
const fmtX = (n: number | null | undefined) => n != null ? `${Number(n).toFixed(2)}x` : "—";

interface AcquisitionTabProps {
  propertyId: number;
  property: Record<string, any>;
  canEdit: boolean;
}

export function AcquisitionTab({ propertyId, property, canEdit }: AcquisitionTabProps) {
  const qc = useQueryClient();

  const { data: baseline, isLoading } = useQuery({
    queryKey: ["acquisition-baseline", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/acquisition-baseline`).then(r => r.data),
    enabled: propertyId > 0,
  });

  // LPs available for assignment (used by the LP Fund dropdown)
  const { data: lps } = useQuery({
    queryKey: ["lps-for-property-assignment"],
    queryFn: () => apiClient.get("/api/investment/lp").then(r => {
      const raw = r.data;
      return Array.isArray(raw) ? raw : (raw?.items || raw?.data || []);
    }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.post(`/api/portfolio/properties/${propertyId}/acquisition-baseline`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acquisition-baseline", propertyId] });
      qc.invalidateQueries({ queryKey: ["lifetime-cashflow", propertyId] });
      qc.invalidateQueries({ queryKey: ["phase-cashflow", propertyId] });
      qc.invalidateQueries({ queryKey: ["lending-metrics", propertyId] });
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
      qc.invalidateQueries({ queryKey: ["exit-forecast", propertyId] });
    },
    onError: () => toast.error("Failed to save"),
  });

  // Property-level fields (e.g. lp_id) live on the Property model, not on the
  // AcquisitionBaseline. We PATCH them in parallel with the baseline save.
  const savePropertyMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.patch(`/api/portfolio/properties/${propertyId}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
      qc.invalidateQueries({ queryKey: ["lp-portfolio-cashflow"] });
      qc.invalidateQueries({ queryKey: ["properties-by-lp"] });
    },
    onError: () => toast.error("Failed to save LP assignment"),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const isLocked = baseline?.exists === true;

  // Populate form from baseline data
  useEffect(() => {
    if (!baseline) return;
    const f: Record<string, string> = {};
    const fields = [
      "purchase_price", "purchase_date", "closing_costs", "total_acquisition_cost",
      "initial_equity", "initial_debt", "acquisition_noi", "acquisition_cap_rate",
      "acquisition_occupancy_pct", "target_hold_years", "target_sale_year",
      "earliest_sale_date", "latest_sale_date", "original_exit_cap_rate",
      "original_exit_noi", "original_selling_cost_pct", "original_sale_price",
      "original_net_proceeds", "target_irr", "target_equity_multiple",
      "intended_disposition_type", "notes", "development_stage",
    ];
    for (const k of fields) {
      f[k] = baseline[k] != null ? String(baseline[k]) : "";
    }
    // lp_id and development_stage live on Property, not on the baseline
    f.lp_id = property?.lp_id != null ? String(property.lp_id) : "";
    f.development_stage = property?.development_stage || "prospect";
    setForm(f);
  }, [baseline, property?.lp_id]);

  const sf = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    const payload: Record<string, any> = {};
    const numFields = [
      "purchase_price", "closing_costs", "total_acquisition_cost",
      "initial_equity", "initial_debt", "acquisition_noi", "acquisition_cap_rate",
      "acquisition_occupancy_pct", "original_exit_cap_rate", "original_exit_noi",
      "original_selling_cost_pct", "original_sale_price", "original_net_proceeds",
      "target_irr", "target_equity_multiple",
    ];
    const intFields = ["target_hold_years", "target_sale_year"];
    const strFields = ["purchase_date", "earliest_sale_date", "latest_sale_date", "intended_disposition_type", "notes"];

    for (const k of numFields) {
      if (form[k]) payload[k] = Number(form[k]);
    }
    for (const k of intFields) {
      if (form[k]) payload[k] = parseInt(form[k], 10);
    }
    for (const k of strFields) {
      if (form[k]) payload[k] = form[k];
    }

    // Save baseline + property in parallel; show one toast on success
    const propertyPatch: Record<string, any> = {};
    if ((form.lp_id !== "" || property?.lp_id != null) && form.lp_id !== String(property?.lp_id ?? "")) {
      propertyPatch.lp_id = form.lp_id ? Number(form.lp_id) : null;
    }
    if (form.development_stage && form.development_stage !== (property?.development_stage || "prospect")) {
      propertyPatch.development_stage = form.development_stage;
    }
    Promise.allSettled([
      saveMutation.mutateAsync(payload),
      Object.keys(propertyPatch).length > 0
        ? savePropertyMutation.mutateAsync(propertyPatch)
        : Promise.resolve(),
    ]).then((results) => {
      const hadError = results.some((r) => r.status === "rejected");
      if (!hadError) toast.success("Acquisition baseline saved");
    });
    setEditing(false);
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  const readOnly = isLocked && !editing;

  return (
    <div className="space-y-6">
      {/* Lock Status Banner */}
      {isLocked && !editing && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <Lock className="h-4 w-4" />
              <span className="font-medium">Acquisition baseline is locked.</span>
              <span className="text-amber-600">This preserves the original underwriting assumptions for variance tracking.</span>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit Baseline
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isLocked && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardContent className="py-3 px-4 flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <AlertTriangle className="h-4 w-4" />
            <span>No acquisition baseline recorded yet. Fill in the acquisition facts and LP mandate below, then save to lock.</span>
          </CardContent>
        </Card>
      )}

      {/* Acquisition Facts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Acquisition Facts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* LP Fund assignment — affects which LP this property rolls up into */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                LP Fund
                <span className="text-[10px] italic">(determines portfolio rollup)</span>
              </Label>
              {readOnly ? (
                <div className="text-sm font-medium py-2">
                  {(() => {
                    const lpId = form.lp_id ? Number(form.lp_id) : null;
                    if (!lpId) return <span className="text-muted-foreground italic">Unassigned</span>;
                    const lp = (lps as any[] | undefined)?.find((l: any) => l.lp_id === lpId);
                    return lp?.name || `LP #${lpId}`;
                  })()}
                </div>
              ) : (
                <Select
                  value={form.lp_id || "__none__"}
                  onValueChange={(v) => sf("lp_id", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select LP fund…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Unassigned —</SelectItem>
                    {((lps as any[] | undefined) || []).map((lp: any) => (
                      <SelectItem key={lp.lp_id} value={String(lp.lp_id)}>
                        {lp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                Development Stage
              </Label>
              {readOnly ? (
                <div className="text-sm font-medium py-2 capitalize">
                  {(form.development_stage || "prospect").replace(/_/g, " ")}
                </div>
              ) : (
                <Select
                  value={form.development_stage || "prospect"}
                  onValueChange={(v) => sf("development_stage", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="acquisition">Acquisition</SelectItem>
                    <SelectItem value="pre_development">Pre-Development</SelectItem>
                    <SelectItem value="construction">Construction</SelectItem>
                    <SelectItem value="lease_up">Lease-Up</SelectItem>
                    <SelectItem value="stabilized">Stabilized</SelectItem>
                    <SelectItem value="disposition">Disposition</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Purchase Price ($)" value={form.purchase_price} onChange={v => sf("purchase_price", v)} readOnly={readOnly} type="number" />
            <Field label="Purchase Date" value={form.purchase_date} onChange={v => sf("purchase_date", v)} readOnly={readOnly} type="date" />
            <Field label="Closing Costs ($)" value={form.closing_costs} onChange={v => sf("closing_costs", v)} readOnly={readOnly} type="number" />
            <Field label="Total Acquisition Cost ($)" value={form.total_acquisition_cost} onChange={v => sf("total_acquisition_cost", v)} readOnly={readOnly} type="number" placeholder="Auto: price + closing" />
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Initial Equity ($)" value={form.initial_equity} onChange={v => sf("initial_equity", v)} readOnly={readOnly} type="number" />
            <Field label="Initial Debt ($)" value={form.initial_debt} onChange={v => sf("initial_debt", v)} readOnly={readOnly} type="number" />
            <Field label="Acquisition NOI ($)" value={form.acquisition_noi} onChange={v => sf("acquisition_noi", v)} readOnly={readOnly} type="number" />
            <Field label="Going-In Cap Rate (%)" value={form.acquisition_cap_rate} onChange={v => sf("acquisition_cap_rate", v)} readOnly={readOnly} type="number" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Field label="Occupancy at Acquisition (%)" value={form.acquisition_occupancy_pct} onChange={v => sf("acquisition_occupancy_pct", v)} readOnly={readOnly} type="number" />
          </div>
        </CardContent>
      </Card>

      {/* LP Hold Mandate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-muted-foreground" />
            LP Hold Mandate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Target Hold Period (years)" value={form.target_hold_years} onChange={v => sf("target_hold_years", v)} readOnly={readOnly} type="number" placeholder="e.g. 7" />
            <Field label="Target Sale Year" value={form.target_sale_year} onChange={v => sf("target_sale_year", v)} readOnly={readOnly} type="number" placeholder="e.g. 2033" />
            <Field label="Earliest Sale Date" value={form.earliest_sale_date} onChange={v => sf("earliest_sale_date", v)} readOnly={readOnly} type="date" />
            <Field label="Latest Sale Date" value={form.latest_sale_date} onChange={v => sf("latest_sale_date", v)} readOnly={readOnly} type="date" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Intended Disposition Type</Label>
              {readOnly ? (
                <p className="text-sm font-medium capitalize">{(form.intended_disposition_type || "—").replace(/_/g, " ")}</p>
              ) : (
                <Select value={form.intended_disposition_type || ""} onValueChange={v => sf("intended_disposition_type", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stabilized_sale">Stabilized Sale</SelectItem>
                    <SelectItem value="redevelopment_sale">Redevelopment Sale</SelectItem>
                    <SelectItem value="partial_lease_up_sale">Partial Lease-Up Sale</SelectItem>
                    <SelectItem value="as_is_sale">As-Is Sale</SelectItem>
                    <SelectItem value="portfolio_sale">Portfolio Sale</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Original Exit Assumptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Original Exit Assumptions
            <Badge variant="outline" className="ml-2 text-xs">Underwritten at Acquisition</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Exit Cap Rate (%)" value={form.original_exit_cap_rate} onChange={v => sf("original_exit_cap_rate", v)} readOnly={readOnly} type="number" placeholder="e.g. 5.0" />
            <Field label="Exit NOI ($)" value={form.original_exit_noi} onChange={v => sf("original_exit_noi", v)} readOnly={readOnly} type="number" />
            <Field label="Selling Cost (%)" value={form.original_selling_cost_pct} onChange={v => sf("original_selling_cost_pct", v)} readOnly={readOnly} type="number" placeholder="e.g. 5.0" />
            <Field label="Gross Sale Price ($)" value={form.original_sale_price} onChange={v => sf("original_sale_price", v)} readOnly={readOnly} type="number" placeholder="Auto: NOI / cap" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Field label="Net Sale Proceeds ($)" value={form.original_net_proceeds} onChange={v => sf("original_net_proceeds", v)} readOnly={readOnly} type="number" />
            <Field label="Target IRR (%)" value={form.target_irr} onChange={v => sf("target_irr", v)} readOnly={readOnly} type="number" placeholder="e.g. 18" />
            <Field label="Target Equity Multiple (x)" value={form.target_equity_multiple} onChange={v => sf("target_equity_multiple", v)} readOnly={readOnly} type="number" placeholder="e.g. 2.0" />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            {readOnly ? (
              <p className="text-sm whitespace-pre-wrap">{form.notes || "—"}</p>
            ) : (
              <textarea
                value={form.notes || ""}
                onChange={e => sf("notes", e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px]"
                placeholder="Investment thesis, key assumptions, risk factors..."
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save / Cancel */}
      {(!isLocked || editing) && canEdit && (
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1.5" />
            {saveMutation.isPending ? "Saving..." : isLocked ? "Update Baseline" : "Save & Lock Baseline"}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          )}
        </div>
      )}
    </div>
  );
}


// ── Reusable Field Component ──

function Field({
  label, value, onChange, readOnly, type = "text", placeholder,
}: {
  label: string; value: string | undefined; onChange: (v: string) => void;
  readOnly: boolean; type?: string; placeholder?: string;
}) {
  if (readOnly) {
    const display = (() => {
      if (!value) return "—";
      if (type === "number") {
        const n = Number(value);
        if (label.includes("($)") || label.includes("Price") || label.includes("Cost") || label.includes("NOI") || label.includes("Equity") || label.includes("Debt") || label.includes("Proceeds")) {
          return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
        }
        if (label.includes("(%)") || label.includes("Rate") || label.includes("IRR")) return `${n}%`;
        if (label.includes("(x)") || label.includes("Multiple")) return `${n}x`;
        return String(n);
      }
      if (type === "date" && value) {
        try { return new Date(value + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }); }
        catch { return value; }
      }
      return value;
    })();
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <p className="text-sm font-medium tabular-nums">{display}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    </div>
  );
}
