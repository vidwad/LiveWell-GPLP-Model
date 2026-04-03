"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Calculator, ArrowLeftRight } from "lucide-react";
import { OperatingExpensesSection } from "@/components/property/OperatingExpensesSection";
import { LenderUnderwritingSection } from "@/components/property/LenderUnderwritingSection";

interface ProFormaData {
  proforma_id?: number;
  label: string;
  status?: string;
  gross_potential_rent: number;
  other_income: number;
  vacancy_rate: number;
  vacancy_loss: number;
  effective_gross_income: number;
  operating_expenses: number;
  property_tax: number;
  insurance: number;
  management_fee: number;
  management_fee_rate: number;
  replacement_reserves: number;
  total_expenses: number;
  noi: number;
  expense_ratio: number;
  annual_debt_service: number;
  cash_flow_after_debt: number;
  dscr: number | null;
  cap_rate: number | null;
  ltv: number | null;
  total_debt: number;
  property_value: number;
  implied_value_at_cap: number | null;
  total_equity: number;
  cash_on_cash: number | null;
  total_units: number;
  total_beds: number;
  total_sqft: number;
  noi_per_unit: number | null;
  noi_per_bed: number | null;
  noi_per_sqft: number | null;
  saved?: boolean;
}

const fmt = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
};

const fmtPct = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)}%` : "—");
const fmtX = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)}x` : "—");

export function ProFormaTab({ propertyId }: { propertyId: number }) {
  const qc = useQueryClient();
  const [scenarios, setScenarios] = useState<ProFormaData[]>([]);
  const [inputs, setInputs] = useState({
    vacancy_rate: 5.0,
    management_fee_rate: 4.0,
    replacement_reserve_pct: 2.0,
    cap_rate_assumption: 5.5,
    label: "",
  });

  // Saved pro formas
  const { data: savedList } = useQuery({
    queryKey: ["pro-formas", propertyId],
    queryFn: () => apiClient.get(`/api/portfolio/properties/${propertyId}/pro-formas`).then(r => r.data),
    enabled: propertyId > 0,
  });

  const generateMutation = useMutation({
    mutationFn: (params: typeof inputs) =>
      apiClient.post<ProFormaData>(`/api/portfolio/properties/${propertyId}/pro-forma/generate`, params).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (params: typeof inputs) =>
      apiClient.post<ProFormaData>(`/api/portfolio/properties/${propertyId}/pro-forma/save`, params).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-formas", propertyId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/portfolio/pro-formas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-formas", propertyId] }),
  });

  const handleGenerate = async () => {
    const data = await generateMutation.mutateAsync(inputs);
    setScenarios(prev => [...prev, data]);
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync({ ...inputs, label: inputs.label || `Scenario ${(savedList?.length || 0) + 1}` });
  };

  const removeScenario = (idx: number) => {
    setScenarios(prev => prev.filter((_, i) => i !== idx));
  };

  const comparing = scenarios.length >= 2;

  return (
    <div className="space-y-6">
      {/* Input Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Stabilized Pro Forma Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vacancy Rate (%)</label>
              <input
                type="number"
                step="any"
                value={inputs.vacancy_rate}
                onChange={e => setInputs(p => ({ ...p, vacancy_rate: parseFloat(e.target.value) || 0 }))}
                className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mgmt Fee Rate (%)</label>
              <input
                type="number"
                step="any"
                value={inputs.management_fee_rate}
                onChange={e => setInputs(p => ({ ...p, management_fee_rate: parseFloat(e.target.value) || 0 }))}
                className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reserves (%)</label>
              <input
                type="number"
                step="any"
                value={inputs.replacement_reserve_pct}
                onChange={e => setInputs(p => ({ ...p, replacement_reserve_pct: parseFloat(e.target.value) || 0 }))}
                className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cap Rate Assumption (%)</label>
              <input
                type="number"
                step="any"
                value={inputs.cap_rate_assumption}
                onChange={e => setInputs(p => ({ ...p, cap_rate_assumption: parseFloat(e.target.value) || 0 }))}
                className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Label</label>
              <input
                type="text"
                value={inputs.label}
                onChange={e => setInputs(p => ({ ...p, label: e.target.value }))}
                placeholder="Base Case"
                className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Scenario
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save to Property
            </Button>
            {scenarios.length > 0 && (
              <Button variant="ghost" onClick={() => setScenarios([])}>Clear All</Button>
            )}
          </div>
          {saveMutation.isSuccess && (
            <p className="text-sm text-green-600 mt-2">Pro forma saved successfully.</p>
          )}
        </CardContent>
      </Card>

      {/* Comparison Table */}
      {scenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              {comparing ? "Scenario Comparison" : "Pro Forma Results"}
              <Badge variant="outline" className="ml-2">{scenarios.length} scenario{scenarios.length > 1 ? "s" : ""}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-[200px]">Metric</th>
                    {scenarios.map((s, i) => (
                      <th key={i} className="text-right py-2 px-3 font-medium min-w-[140px]">
                        <div className="flex items-center justify-end gap-1">
                          <span>{s.label || `Scenario ${i + 1}`}</span>
                          <button onClick={() => removeScenario(i)} className="text-muted-foreground hover:text-red-500 ml-1">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* Revenue Section */}
                  <tr className="bg-muted/50"><td colSpan={scenarios.length + 1} className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue</td></tr>
                  <Row label="Gross Potential Rent" values={scenarios.map(s => fmt(s.gross_potential_rent))} />
                  <Row label={`Vacancy Loss (${scenarios[0]?.vacancy_rate}%)`} values={scenarios.map(s => `(${fmt(s.vacancy_loss)})`)} negative />
                  <Row label="Effective Gross Income" values={scenarios.map(s => fmt(s.effective_gross_income))} bold />

                  {/* Expenses Section */}
                  <tr className="bg-muted/50"><td colSpan={scenarios.length + 1} className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expenses</td></tr>
                  <Row label="Operating Expenses" values={scenarios.map(s => fmt(s.operating_expenses))} />
                  <Row label="Property Tax" values={scenarios.map(s => fmt(s.property_tax))} />
                  <Row label="Insurance" values={scenarios.map(s => fmt(s.insurance))} />
                  <Row label="Management Fee" values={scenarios.map(s => fmt(s.management_fee))} />
                  <Row label="Reserves" values={scenarios.map(s => fmt(s.replacement_reserves))} />
                  <Row label="Total Expenses" values={scenarios.map(s => fmt(s.total_expenses))} bold />
                  <Row label="Expense Ratio" values={scenarios.map(s => fmtPct(s.expense_ratio))} />

                  {/* NOI */}
                  <tr className="bg-muted/50"><td colSpan={scenarios.length + 1} className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Operating Income</td></tr>
                  <Row label="NOI" values={scenarios.map(s => fmt(s.noi))} bold highlight />

                  {/* Debt */}
                  <tr className="bg-muted/50"><td colSpan={scenarios.length + 1} className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Debt Service</td></tr>
                  <Row label="Annual Debt Service" values={scenarios.map(s => fmt(s.annual_debt_service))} />
                  <Row label="Cash Flow After Debt" values={scenarios.map(s => fmt(s.cash_flow_after_debt))} bold />

                  {/* Ratios */}
                  <tr className="bg-muted/50"><td colSpan={scenarios.length + 1} className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Ratios</td></tr>
                  <Row label="DSCR" values={scenarios.map(s => fmtX(s.dscr))} />
                  <Row label="Cap Rate" values={scenarios.map(s => fmtPct(s.cap_rate))} />
                  <Row label="LTV" values={scenarios.map(s => fmtPct(s.ltv))} />
                  <Row label="Cash-on-Cash" values={scenarios.map(s => fmtPct(s.cash_on_cash))} />

                  {/* Valuation */}
                  <tr className="bg-muted/50"><td colSpan={scenarios.length + 1} className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valuation</td></tr>
                  <Row label="Property Value" values={scenarios.map(s => fmt(s.property_value))} />
                  <Row label="Implied Value @ Cap" values={scenarios.map(s => fmt(s.implied_value_at_cap))} bold />
                  <Row label="Total Equity" values={scenarios.map(s => fmt(s.total_equity))} />

                  {/* Per-Unit */}
                  <tr className="bg-muted/50"><td colSpan={scenarios.length + 1} className="py-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Per-Unit Metrics</td></tr>
                  <Row label="Units / Beds / SqFt" values={scenarios.map(s => `${s.total_units} / ${s.total_beds} / ${s.total_sqft?.toLocaleString()}`)} />
                  <Row label="NOI per Unit" values={scenarios.map(s => fmt(s.noi_per_unit))} />
                  <Row label="NOI per Bed" values={scenarios.map(s => fmt(s.noi_per_bed))} />
                  <Row label="NOI per SqFt" values={scenarios.map(s => fmt(s.noi_per_sqft))} />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lender Underwriting Summary */}
      <LenderUnderwritingSection propertyId={propertyId} />

      {/* Granular Operating Expenses */}
      <OperatingExpensesSection
        propertyId={propertyId}
        planId={null}
        canEdit={true}
      />

      {/* Saved Pro Formas */}
      {savedList && savedList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Pro Formas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">Label</th>
                    <th className="py-2 px-3 text-right font-medium">NOI</th>
                    <th className="py-2 px-3 text-right font-medium">Cap Rate</th>
                    <th className="py-2 px-3 text-right font-medium">DSCR</th>
                    <th className="py-2 px-3 text-right font-medium">CoC</th>
                    <th className="py-2 px-3 text-right font-medium">Value</th>
                    <th className="py-2 px-3 text-right font-medium">Created</th>
                    <th className="py-2 px-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {savedList.map((pf: Record<string, unknown>) => (
                    <tr key={pf.proforma_id as number} className="hover:bg-muted/50">
                      <td className="py-2 pr-4 font-medium">{pf.label as string}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(pf.noi as number)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtPct(pf.cap_rate as number)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtX(pf.dscr as number)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtPct(pf.cash_on_cash as number)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(pf.property_value as number)}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground text-xs">{(pf.created_at as string)?.slice(0, 10)}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => deleteMutation.mutate(pf.proforma_id as number)}
                          className="text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Table Row Helper ──

function Row({ label, values, bold, negative, highlight }: {
  label: string;
  values: string[];
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-green-50 dark:bg-green-950/20" : ""}>
      <td className={`py-1.5 pr-4 ${bold ? "font-semibold" : ""}`}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`py-1.5 px-3 text-right tabular-nums ${bold ? "font-semibold" : ""} ${negative ? "text-red-500" : ""}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}
