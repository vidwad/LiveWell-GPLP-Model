"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import {
  TrendingUp, Target, ShieldCheck, DollarSign, Calendar, BarChart3,
  ArrowRight, Save, AlertTriangle, CheckCircle2, XCircle,
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

interface ExitReturnsTabProps {
  propertyId: number;
  canEdit: boolean;
  property: Record<string, any>;
  totalDebtOutstanding: number;
  totalAnnualDebtService: number;
}

export function ExitReturnsTab({ propertyId, canEdit, property, totalDebtOutstanding, totalAnnualDebtService }: ExitReturnsTabProps) {
  const qc = useQueryClient();
  const [subSection, setSubSection] = useState<"forecast" | "readiness" | "execution" | "returns" | "variance">("forecast");

  // Fetch all three versions
  const { data: baseline } = useQuery({
    queryKey: ["acquisition-baseline", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/acquisition-baseline`).then(r => r.data),
    enabled: propertyId > 0,
  });
  const { data: forecast } = useQuery({
    queryKey: ["exit-forecast", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/exit-forecast`).then(r => r.data),
    enabled: propertyId > 0,
  });
  const { data: actual } = useQuery({
    queryKey: ["exit-actual", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/exit-actual`).then(r => r.data),
    enabled: propertyId > 0,
  });
  const { data: variance } = useQuery({
    queryKey: ["exit-variance", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/exit-variance`).then(r => r.data),
    enabled: propertyId > 0,
  });

  // Forecast form
  const [fcForm, setFcForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!forecast) return;
    const f: Record<string, string> = {};
    for (const k of Object.keys(forecast)) {
      if (k !== "exists" && k !== "property_id" && forecast[k] != null)
        f[k] = String(forecast[k]);
    }
    setFcForm(f);
  }, [forecast]);

  const saveForecast = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.put(`/api/portfolio/properties/${propertyId}/exit-forecast`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exit-forecast", propertyId] });
      qc.invalidateQueries({ queryKey: ["exit-variance", propertyId] });
      toast.success("Exit forecast updated");
    },
    onError: () => toast.error("Failed to save forecast"),
  });

  // Actual form
  const [acForm, setAcForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!actual) return;
    const f: Record<string, string> = {};
    for (const k of Object.keys(actual)) {
      if (k !== "exists" && k !== "property_id" && actual[k] != null)
        f[k] = String(actual[k]);
    }
    setAcForm(f);
  }, [actual]);

  const saveActual = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.put(`/api/portfolio/properties/${propertyId}/exit-actual`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exit-actual", propertyId] });
      qc.invalidateQueries({ queryKey: ["exit-variance", propertyId] });
      toast.success("Exit actual updated");
    },
    onError: () => toast.error("Failed to save"),
  });

  const fcSf = (k: string, v: string) => setFcForm(p => ({ ...p, [k]: v }));
  const acSf = (k: string, v: string) => setAcForm(p => ({ ...p, [k]: v }));

  const handleSaveForecast = () => {
    const payload: Record<string, any> = {};
    const numFields = ["forecast_exit_noi", "forecast_exit_cap_rate", "forecast_sale_price",
      "forecast_selling_cost_pct", "forecast_selling_costs", "forecast_debt_payoff",
      "forecast_mortgage_prepayment", "forecast_net_proceeds", "forecast_irr",
      "forecast_equity_multiple", "min_occupancy_threshold_pct"];
    const intFields = ["forecast_sale_year", "required_trailing_months"];
    const strFields = ["sale_status", "forecast_sale_date", "planned_disposition_type",
      "planned_sale_condition", "outstanding_capex_items", "unresolved_leasing_issues", "notes"];
    for (const k of numFields) { if (fcForm[k]) payload[k] = Number(fcForm[k]); }
    for (const k of intFields) { if (fcForm[k]) payload[k] = parseInt(fcForm[k], 10); }
    for (const k of strFields) { if (fcForm[k]) payload[k] = fcForm[k]; }
    saveForecast.mutate(payload);
  };

  const handleSaveActual = () => {
    const payload: Record<string, any> = {};
    const numFields = ["actual_sale_price", "actual_selling_costs", "actual_mortgage_payout",
      "actual_mortgage_prepayment_penalty", "actual_net_proceeds", "actual_exit_noi",
      "actual_exit_occupancy_pct", "actual_exit_cap_rate", "total_equity_invested",
      "total_interim_distributions", "total_refinance_proceeds", "total_sale_proceeds",
      "total_lp_distributions", "realized_irr", "realized_equity_multiple"];
    const strFields = ["listing_date", "broker_name", "offer_date", "contract_date",
      "close_date", "notes"];
    for (const k of numFields) { if (acForm[k]) payload[k] = Number(acForm[k]); }
    for (const k of strFields) { if (acForm[k]) payload[k] = acForm[k]; }
    saveActual.mutate(payload);
  };

  return (
    <div className="space-y-4">
      {/* Sub-section selector */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-wrap">
        {[
          { key: "forecast" as const, label: "Disposition Plan" },
          { key: "readiness" as const, label: "Sale Readiness" },
          { key: "execution" as const, label: "Sale Execution" },
          { key: "returns" as const, label: "Returns" },
          { key: "variance" as const, label: "Variance" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubSection(key)}
            className={cn(
              "relative px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              subSection === key
                ? "bg-white shadow-sm text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-primary after:rounded-full"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Disposition Plan */}
      {subSection === "forecast" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-muted-foreground" />
              Current Exit Forecast
              {forecast?.sale_status && (
                <Badge variant={forecast.sale_status === "sold" ? "default" : "secondary"} className="ml-2 capitalize">
                  {forecast.sale_status}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sale Status</Label>
                <Select value={fcForm.sale_status || "planned"} onValueChange={v => fcSf("sale_status", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="marketed">Marketed</SelectItem>
                    <SelectItem value="under_contract">Under Contract</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FField label="Sale Year" value={fcForm.forecast_sale_year} onChange={v => fcSf("forecast_sale_year", v)} type="number" placeholder="e.g. 2033" />
              <FField label="Sale Date" value={fcForm.forecast_sale_date} onChange={v => fcSf("forecast_sale_date", v)} type="date" />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Disposition Type</Label>
                <Select value={fcForm.planned_disposition_type || ""} onValueChange={v => fcSf("planned_disposition_type", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stabilized_sale">Stabilized Sale</SelectItem>
                    <SelectItem value="redevelopment_sale">Redevelopment Sale</SelectItem>
                    <SelectItem value="partial_lease_up_sale">Partial Lease-Up Sale</SelectItem>
                    <SelectItem value="as_is_sale">As-Is Sale</SelectItem>
                    <SelectItem value="portfolio_sale">Portfolio Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FField label="Exit NOI ($)" value={fcForm.forecast_exit_noi} onChange={v => fcSf("forecast_exit_noi", v)} type="number" />
              <FField label="Exit Cap Rate (%)" value={fcForm.forecast_exit_cap_rate} onChange={v => fcSf("forecast_exit_cap_rate", v)} type="number" />
              <FField label="Gross Sale Price ($)" value={fcForm.forecast_sale_price} onChange={v => fcSf("forecast_sale_price", v)} type="number" placeholder="Auto: NOI / cap" />
              <FField label="Selling Cost (%)" value={fcForm.forecast_selling_cost_pct} onChange={v => fcSf("forecast_selling_cost_pct", v)} type="number" placeholder="5.0" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FField label="Selling Costs ($)" value={fcForm.forecast_selling_costs} onChange={v => fcSf("forecast_selling_costs", v)} type="number" />
              <FField label="Debt Payoff ($)" value={fcForm.forecast_debt_payoff} onChange={v => fcSf("forecast_debt_payoff", v)} type="number" placeholder={totalDebtOutstanding > 0 ? `Auto: $${Math.round(totalDebtOutstanding).toLocaleString()}` : ""} />
              <FField label="Prepayment Penalty ($)" value={fcForm.forecast_mortgage_prepayment} onChange={v => fcSf("forecast_mortgage_prepayment", v)} type="number" />
              <FField label="Net Sale Proceeds ($)" value={fcForm.forecast_net_proceeds} onChange={v => fcSf("forecast_net_proceeds", v)} type="number" placeholder="Auto-calc" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FField label="Forecast IRR (%)" value={fcForm.forecast_irr} onChange={v => fcSf("forecast_irr", v)} type="number" />
              <FField label="Forecast Equity Multiple (x)" value={fcForm.forecast_equity_multiple} onChange={v => fcSf("forecast_equity_multiple", v)} type="number" />
            </div>
            {canEdit && (
              <Button onClick={handleSaveForecast} disabled={saveForecast.isPending}>
                <Save className="h-4 w-4 mr-1.5" />
                {saveForecast.isPending ? "Saving..." : "Save Forecast"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sale Readiness */}
      {subSection === "readiness" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Sale Readiness Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FField label="Min Occupancy Threshold (%)" value={fcForm.min_occupancy_threshold_pct} onChange={v => fcSf("min_occupancy_threshold_pct", v)} type="number" placeholder="90" />
              <FField label="Required Trailing Months" value={fcForm.required_trailing_months} onChange={v => fcSf("required_trailing_months", v)} type="number" placeholder="12" />
              <FField label="Planned Sale Condition" value={fcForm.planned_sale_condition} onChange={v => fcSf("planned_sale_condition", v)} placeholder="e.g. stabilized at 95%" />
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Outstanding Capex Items</Label>
                <textarea value={fcForm.outstanding_capex_items || ""} onChange={e => fcSf("outstanding_capex_items", e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]" placeholder="List any remaining capital expenditure items..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Unresolved Leasing Issues</Label>
                <textarea value={fcForm.unresolved_leasing_issues || ""} onChange={e => fcSf("unresolved_leasing_issues", e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]" placeholder="List any leasing issues to resolve before sale..." />
              </div>
            </div>
            {canEdit && (
              <Button onClick={handleSaveForecast} disabled={saveForecast.isPending}>
                <Save className="h-4 w-4 mr-1.5" />Save Readiness
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sale Execution */}
      {subSection === "execution" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Actual Disposition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FField label="Listing Date" value={acForm.listing_date} onChange={v => acSf("listing_date", v)} type="date" />
              <FField label="Broker" value={acForm.broker_name} onChange={v => acSf("broker_name", v)} placeholder="Broker name" />
              <FField label="Offer Date" value={acForm.offer_date} onChange={v => acSf("offer_date", v)} type="date" />
              <FField label="Contract Date" value={acForm.contract_date} onChange={v => acSf("contract_date", v)} type="date" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FField label="Close Date" value={acForm.close_date} onChange={v => acSf("close_date", v)} type="date" />
              <FField label="Actual Sale Price ($)" value={acForm.actual_sale_price} onChange={v => acSf("actual_sale_price", v)} type="number" />
              <FField label="Actual Selling Costs ($)" value={acForm.actual_selling_costs} onChange={v => acSf("actual_selling_costs", v)} type="number" />
              <FField label="Mortgage Payout ($)" value={acForm.actual_mortgage_payout} onChange={v => acSf("actual_mortgage_payout", v)} type="number" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FField label="Prepayment Penalty ($)" value={acForm.actual_mortgage_prepayment_penalty} onChange={v => acSf("actual_mortgage_prepayment_penalty", v)} type="number" />
              <FField label="Net Proceeds ($)" value={acForm.actual_net_proceeds} onChange={v => acSf("actual_net_proceeds", v)} type="number" placeholder="Auto-calc" />
              <FField label="NOI at Exit ($)" value={acForm.actual_exit_noi} onChange={v => acSf("actual_exit_noi", v)} type="number" />
              <FField label="Occupancy at Exit (%)" value={acForm.actual_exit_occupancy_pct} onChange={v => acSf("actual_exit_occupancy_pct", v)} type="number" />
            </div>
            {canEdit && (
              <Button onClick={handleSaveActual} disabled={saveActual.isPending}>
                <Save className="h-4 w-4 mr-1.5" />{saveActual.isPending ? "Saving..." : "Save Actual"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Returns Waterfall */}
      {subSection === "returns" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Returns Waterfall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FField label="Total Equity Invested ($)" value={acForm.total_equity_invested} onChange={v => acSf("total_equity_invested", v)} type="number" />
                  <FField label="Interim Cash Distributions ($)" value={acForm.total_interim_distributions} onChange={v => acSf("total_interim_distributions", v)} type="number" />
                  <FField label="Refinance Proceeds ($)" value={acForm.total_refinance_proceeds} onChange={v => acSf("total_refinance_proceeds", v)} type="number" />
                  <FField label="Net Sale Proceeds ($)" value={acForm.total_sale_proceeds || acForm.actual_net_proceeds} onChange={v => acSf("total_sale_proceeds", v)} type="number" />
                </div>
                <Separator />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FField label="Total LP Distributions ($)" value={acForm.total_lp_distributions} onChange={v => acSf("total_lp_distributions", v)} type="number" placeholder="Auto-calc" />
                  <FField label="Realized IRR (%)" value={acForm.realized_irr} onChange={v => acSf("realized_irr", v)} type="number" />
                  <FField label="Realized Equity Multiple (x)" value={acForm.realized_equity_multiple} onChange={v => acSf("realized_equity_multiple", v)} type="number" />
                </div>
              </div>
              {canEdit && (
                <Button onClick={handleSaveActual} disabled={saveActual.isPending}>
                  <Save className="h-4 w-4 mr-1.5" />{saveActual.isPending ? "Saving..." : "Save Returns"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variance */}
      {subSection === "variance" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Exit Variance: Underwritten vs Forecast vs Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!variance?.has_baseline ? (
              <div className="py-8 text-center text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm">Set up the Acquisition Baseline first to enable variance tracking.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-[200px]">Metric</th>
                      <th className="text-right py-2 px-3 font-medium min-w-[120px]">Underwritten</th>
                      <th className="text-right py-2 px-3 font-medium min-w-[120px]">Forecast</th>
                      <th className="text-right py-2 px-3 font-medium min-w-[120px]">Actual</th>
                      <th className="text-right py-2 px-3 font-medium min-w-[120px]">Variance (F vs U)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(variance?.rows || []).map((row: any, i: number) => (
                      <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                        <td className="py-2 pr-4 font-medium">{row.label}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtCell(row.label, row.underwritten)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtCell(row.label, row.forecast)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtCell(row.label, row.actual)}</td>
                        <td className={cn("py-2 px-3 text-right tabular-nums font-medium",
                          row.variance_fc_vs_uw > 0 ? "text-green-600" : row.variance_fc_vs_uw < 0 ? "text-red-600" : "")}>
                          {row.variance_fc_vs_uw != null ? (row.variance_fc_vs_uw > 0 ? "+" : "") + fmtCell(row.label, row.variance_fc_vs_uw) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper to format cell based on metric label
function fmtCell(label: string, val: number | null | undefined): string {
  if (val == null) return "—";
  if (label.includes("Cap Rate") || label.includes("IRR")) return `${Number(val).toFixed(2)}%`;
  if (label.includes("Multiple")) return `${Number(val).toFixed(2)}x`;
  if (label.includes("Year")) return String(Math.round(val));
  if (label.includes("Price") || label.includes("Proceeds") || label.includes("NOI") || label.includes("Costs") || label.includes("Payoff"))
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(val);
  return String(val);
}

// Simple form field
function FField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string | undefined; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
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
