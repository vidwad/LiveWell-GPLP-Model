"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calculator, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import { useProperty, useRunProjection } from "@/hooks/usePortfolio";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

// ── Types matching backend _ProjectionInput / _ProjectionResultOut ──

interface ProjectionInput {
  planned_units: number | null;
  monthly_rent_per_unit: number | null;
  annual_expense_ratio: number | null;
  vacancy_rate: number | null;
  construction_start_date: string;
  construction_months: number;
  lease_up_months: number;
  annual_debt_service: number | null;
  exit_cap_rate: number | null;
  projection_years: number;
  total_equity_invested: number;
  carrying_cost_annual: number;
  annual_rent_increase: number | null;
  expense_growth_rate: number;
}

interface YearProjection {
  year: number;
  phase: string;
  rentable_months: number;
  occupancy_rate: number;
  gross_potential_rent: number;
  vacancy_loss: number;
  effective_gross_income: number;
  management_fee: number;
  operating_expenses: number;
  total_expenses: number;
  noi: number;
  construction_mgmt_fee: number;
  annual_debt_service: number;
  cash_flow: number;
  cumulative_cash_flow: number;
}

interface ProjectionSummary {
  total_cash_flow: number;
  exit_noi: number;
  exit_cap_rate: number;
  terminal_value: number;
  disposition_costs: number;
  net_exit_proceeds: number;
  total_return: number;
  total_equity_invested: number;
  equity_multiple: number | null;
  irr_estimate: number | null;
  cash_on_cash_avg: number | null;
  annualized_roi: number | null;
  lp_share_of_profits: number | null;
  gp_share_of_profits: number | null;
}

interface ProjectionResult {
  projections: YearProjection[];
  summary: ProjectionSummary;
}

// ── Helpers ──

const phaseBadge: Record<string, { label: string; cls: string }> = {
  as_is: { label: "As-Is", cls: "bg-gray-100 text-gray-700" },
  construction: { label: "Construction", cls: "bg-orange-100 text-orange-700" },
  lease_up: { label: "Lease-Up", cls: "bg-blue-100 text-blue-700" },
  stabilized: { label: "Stabilized", cls: "bg-green-100 text-green-700" },
};

function fmt(v: number) {
  return formatCurrency(v);
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

// ── Component ──

export default function ModelPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const propertyId = Number(id);
  const { data: property } = useProperty(propertyId);
  const { mutateAsync: runProjection, isPending } = useRunProjection(propertyId);
  const [result, setResult] = useState<ProjectionResult | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<ProjectionInput>({
    planned_units: null,
    monthly_rent_per_unit: null,
    annual_expense_ratio: 35,
    vacancy_rate: 5,
    construction_start_date: today,
    construction_months: 18,
    lease_up_months: 6,
    annual_debt_service: null,
    exit_cap_rate: 5.5,
    projection_years: 10,
    total_equity_invested: 0,
    carrying_cost_annual: 0,
    annual_rent_increase: 3,
    expense_growth_rate: 2,
  });

  const setField = <K extends keyof ProjectionInput>(
    key: K,
    value: ProjectionInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const numChange = (key: keyof ProjectionInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setField(key, raw === "" ? null as never : Number(raw) as never);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build payload converting UI percentages to decimals
    const payload: Record<string, unknown> = {
      planned_units: form.planned_units,
      monthly_rent_per_unit: form.monthly_rent_per_unit,
      annual_expense_ratio: form.annual_expense_ratio != null ? form.annual_expense_ratio / 100 : null,
      vacancy_rate: form.vacancy_rate != null ? form.vacancy_rate / 100 : null,
      construction_start_date: form.construction_start_date || null,
      construction_months: form.construction_months,
      lease_up_months: form.lease_up_months,
      annual_debt_service: form.annual_debt_service,
      exit_cap_rate: form.exit_cap_rate != null ? form.exit_cap_rate / 100 : null,
      projection_years: form.projection_years,
      total_equity_invested: form.total_equity_invested,
      carrying_cost_annual: form.carrying_cost_annual,
      annual_rent_increase: form.annual_rent_increase != null ? form.annual_rent_increase / 100 : null,
      expense_growth_rate: form.expense_growth_rate / 100,
    };

    try {
      const res = (await runProjection(payload)) as ProjectionResult;
      setResult(res);
      toast.success("Projection calculated successfully");
    } catch {
      toast.error("Projection failed. Check your inputs and try again.");
    }
  };

  // Derived summary metrics
  const totalNoi = result
    ? result.projections.reduce((s, y) => s + y.noi, 0)
    : 0;
  const avgCashOnCash = result?.summary.cash_on_cash_avg;
  const terminalValue = result?.summary.terminal_value ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <LinkButton variant="ghost" size="sm" href={`/portfolio/${propertyId}`} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Property
        </LinkButton>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Financial Model
        </h1>
        {property && (
          <p className="text-muted-foreground">
            {property.address}, {property.city}
          </p>
        )}
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Projection Inputs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Revenue Assumptions */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Revenue Assumptions
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Planned Units</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.planned_units ?? ""}
                    onChange={numChange("planned_units")}
                    placeholder="e.g. 12"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly Rent / Unit ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={50}
                    value={form.monthly_rent_per_unit ?? ""}
                    onChange={numChange("monthly_rent_per_unit")}
                    placeholder="e.g. 2500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Expense Ratio (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={form.annual_expense_ratio ?? ""}
                    onChange={numChange("annual_expense_ratio")}
                    placeholder="35"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vacancy Rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={form.vacancy_rate ?? ""}
                    onChange={numChange("vacancy_rate")}
                    placeholder="5"
                  />
                </div>
              </div>
            </div>

            {/* Growth Assumptions */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Growth Assumptions
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Annual Rent Increase (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={form.annual_rent_increase ?? ""}
                    onChange={numChange("annual_rent_increase")}
                    placeholder="3"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Expense Growth Rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={form.expense_growth_rate}
                    onChange={numChange("expense_growth_rate")}
                    placeholder="2"
                  />
                </div>
              </div>
            </div>

            {/* Construction Timeline */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Construction Timeline
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Construction Start Date</Label>
                  <Input
                    type="date"
                    value={form.construction_start_date}
                    onChange={(e) => setField("construction_start_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Construction (months)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={form.construction_months}
                    onChange={numChange("construction_months")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Lease-Up (months)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    value={form.lease_up_months}
                    onChange={numChange("lease_up_months")}
                  />
                </div>
              </div>
            </div>

            {/* Debt & Exit */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Debt Service & Exit
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Annual Debt Service ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={form.annual_debt_service ?? ""}
                    onChange={numChange("annual_debt_service")}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Exit Cap Rate (%)</Label>
                  <Input
                    type="number"
                    min={0.1}
                    max={20}
                    step={0.25}
                    value={form.exit_cap_rate ?? ""}
                    onChange={numChange("exit_cap_rate")}
                    placeholder="5.5"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Total Equity Invested ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={10000}
                    value={form.total_equity_invested || ""}
                    onChange={numChange("total_equity_invested")}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Carrying Cost / Year ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={form.carrying_cost_annual || ""}
                    onChange={numChange("carrying_cost_annual")}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Projection Horizon */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Projection Horizon
              </h3>
              <div className="w-48">
                <div className="space-y-1.5">
                  <Label>Years</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={form.projection_years}
                    onChange={numChange("projection_years")}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
              <Calculator className="mr-2 h-4 w-4" />
              {isPending ? "Calculating..." : "Run Projection"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  Total NOI
                </div>
                <p className="text-2xl font-bold">{fmt(totalNoi)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sum across {result.projections.length} years
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Avg Cash-on-Cash
                </div>
                <p className="text-2xl font-bold">
                  {avgCashOnCash != null ? `${avgCashOnCash.toFixed(2)}%` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Stabilized annual avg
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  Terminal Value
                </div>
                <p className="text-2xl font-bold">{fmt(terminalValue)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Exit NOI / {form.exit_cap_rate}% cap
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  IRR / Equity Multiple
                </div>
                <p className="text-2xl font-bold">
                  {result.summary.irr_estimate != null
                    ? `${result.summary.irr_estimate.toFixed(2)}%`
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {result.summary.equity_multiple != null
                    ? `${result.summary.equity_multiple.toFixed(2)}x equity multiple`
                    : "Set equity invested for metrics"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Summary Row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Cash Flow</p>
                <p className="text-xl font-semibold">{fmt(result.summary.total_cash_flow)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Net Exit Proceeds</p>
                <p className="text-xl font-semibold">{fmt(result.summary.net_exit_proceeds)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p className="text-xl font-semibold">{fmt(result.summary.total_return)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Year-by-Year Table */}
          <Card>
            <CardHeader>
              <CardTitle>Year-by-Year Cash Flow Projection</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2 font-semibold">Year</th>
                    <th className="py-2 px-2 font-semibold">Phase</th>
                    <th className="py-2 px-2 font-semibold text-right">Occupancy %</th>
                    <th className="py-2 px-2 font-semibold text-right">Gross Revenue</th>
                    <th className="py-2 px-2 font-semibold text-right">Vacancy Loss</th>
                    <th className="py-2 px-2 font-semibold text-right">EGI</th>
                    <th className="py-2 px-2 font-semibold text-right">OpEx</th>
                    <th className="py-2 px-2 font-semibold text-right">NOI</th>
                    <th className="py-2 px-2 font-semibold text-right">Debt Service</th>
                    <th className="py-2 px-2 font-semibold text-right">Cash Flow</th>
                    <th className="py-2 px-2 font-semibold text-right">Cumulative CF</th>
                  </tr>
                </thead>
                <tbody>
                  {result.projections.map((row) => {
                    const badge = phaseBadge[row.phase] ?? {
                      label: row.phase,
                      cls: "bg-gray-100 text-gray-700",
                    };
                    return (
                      <tr
                        key={row.year}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2 px-2 font-medium">{row.year}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">{pct(row.occupancy_rate)}</td>
                        <td className="py-2 px-2 text-right">{fmt(row.gross_potential_rent)}</td>
                        <td className="py-2 px-2 text-right text-red-600">
                          {row.vacancy_loss > 0 ? `(${fmt(row.vacancy_loss)})` : fmt(0)}
                        </td>
                        <td className="py-2 px-2 text-right">{fmt(row.effective_gross_income)}</td>
                        <td className="py-2 px-2 text-right">{fmt(row.total_expenses)}</td>
                        <td className="py-2 px-2 text-right font-medium">{fmt(row.noi)}</td>
                        <td className="py-2 px-2 text-right">{fmt(row.annual_debt_service)}</td>
                        <td
                          className={`py-2 px-2 text-right font-medium ${
                            row.cash_flow < 0 ? "text-red-600" : "text-green-700"
                          }`}
                        >
                          {fmt(row.cash_flow)}
                        </td>
                        <td
                          className={`py-2 px-2 text-right ${
                            row.cumulative_cash_flow < 0 ? "text-red-600" : ""
                          }`}
                        >
                          {fmt(row.cumulative_cash_flow)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
