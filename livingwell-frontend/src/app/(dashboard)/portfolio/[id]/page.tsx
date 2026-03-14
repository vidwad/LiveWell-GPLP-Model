"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Calculator, ChevronDown, ChevronRight } from "lucide-react";
import {
  useProperty,
  useDevelopmentPlans,
  useCreatePlan,
  useDeleteProperty,
  useDebtFacilities,
  useAmortizationSchedule,
  useRunProjection,
  useRefinanceScenarios,
  useCreateRefinanceScenario,
  useDeleteRefinanceScenario,
  useSaleScenarios,
  useCreateSaleScenario,
  useDeleteSaleScenario,
} from "@/hooks/usePortfolio";
import { useAuth } from "@/providers/AuthProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { DevelopmentPlanCreate } from "@/types/portfolio";

const PHASE_COLORS: Record<string, string> = {
  interim: "bg-yellow-100 text-yellow-800",
  construction: "bg-orange-100 text-orange-800",
  lease_up: "bg-blue-100 text-blue-800",
  stabilized: "bg-green-100 text-green-800",
};

// ── Amortization Panel ────────────────────────────────────────────────────────

function AmortizationPanel({ propertyId, debtId }: { propertyId: number; debtId: number }) {
  const [years, setYears] = useState(10);
  const [showMonthly, setShowMonthly] = useState(false);

  const { data, isLoading } = useAmortizationSchedule(propertyId, debtId, years);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">No schedule data.</p>;

  const annual: Array<{
    year: number;
    opening_balance: number;
    total_payment: number;
    total_interest: number;
    total_principal: number;
    closing_balance: number;
  }> = data.annual ?? [];

  const monthly: Array<{
    period: number;
    year: number;
    month: number;
    opening_balance: number;
    payment: number;
    interest: number;
    principal: number;
    closing_balance: number;
  }> = data.monthly ?? [];

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center gap-3">
        <Label className="text-xs">Projection years:</Label>
        {[5, 10, 15, 20, 25].map((y) => (
          <button
            key={y}
            onClick={() => setYears(y)}
            className={cn(
              "px-2 py-1 text-xs rounded border transition-colors",
              years === y ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            )}
          >
            {y}
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Annual Summary</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="text-right">Payment</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Closing Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {annual.map((row) => (
                <TableRow key={row.year}>
                  <TableCell>{row.year}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.opening_balance)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.total_payment)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(row.total_interest)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(row.total_principal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.closing_balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <button
        onClick={() => setShowMonthly((v) => !v)}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {showMonthly ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {showMonthly ? "Hide" : "Show"} monthly schedule
      </button>

      {showMonthly && (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="text-right">Payment</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Closing Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((row) => (
                <TableRow key={row.period}>
                  <TableCell>{row.period}</TableCell>
                  <TableCell>{row.year}</TableCell>
                  <TableCell>{row.month}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.opening_balance)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.payment)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(row.interest)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(row.principal)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.closing_balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const propertyId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const { data: property, isLoading } = useProperty(propertyId);
  const { data: plans } = useDevelopmentPlans(propertyId);
  const { mutateAsync: createPlan, isPending: planPending } = useCreatePlan(propertyId);
  const { mutateAsync: deleteProperty, isPending: deletePending } = useDeleteProperty();

  // Debt & Amortization
  const { data: debtFacilities } = useDebtFacilities(propertyId);
  const [expandedDebtId, setExpandedDebtId] = useState<number | null>(null);

  // Projections
  const { mutateAsync: runProjection, isPending: projPending } = useRunProjection(propertyId);
  const [projResults, setProjResults] = useState<Array<Record<string, unknown>> | null>(null);
  const [projForm, setProjForm] = useState({
    planned_units: "",
    monthly_rent_per_unit: "",
    annual_expense_ratio: "35",
    vacancy_rate_stabilized: "5",
    construction_start_date: "",
    construction_months: "18",
    lease_up_months: "12",
    annual_debt_service: "",
    exit_cap_rate: "5.5",
  });

  // Refinance Scenarios
  const { data: refiScenarios } = useRefinanceScenarios(propertyId);
  const { mutateAsync: createRefi, isPending: refiPending } = useCreateRefinanceScenario(propertyId);
  const { mutateAsync: deleteRefi } = useDeleteRefinanceScenario(propertyId);
  const [refiForm, setRefiForm] = useState({
    label: "Refinance Scenario",
    assumed_new_valuation: "",
    new_ltv_percent: "75",
    new_interest_rate: "",
    new_amortization_months: "300",
    existing_debt_payout: "",
    closing_costs: "0",
    notes: "",
  });

  // Sale Scenarios
  const { data: saleScenarios } = useSaleScenarios(propertyId);
  const { mutateAsync: createSale, isPending: salePending } = useCreateSaleScenario(propertyId);
  const { mutateAsync: deleteSale } = useDeleteSaleScenario(propertyId);
  const [saleForm, setSaleForm] = useState({
    label: "Sale Scenario",
    assumed_sale_price: "",
    selling_costs_percent: "5",
    debt_payout: "",
    capital_gains_reserve: "0",
    notes: "",
  });

  // Plan form
  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState<DevelopmentPlanCreate>({
    planned_units: 0,
    planned_beds: 0,
    planned_sqft: 0,
    estimated_construction_cost: 0,
    development_start_date: "",
    construction_duration_days: 0,
  });

  const canEdit =
    user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPlan(planForm);
      toast.success("Development plan added");
      setPlanOpen(false);
    } catch {
      toast.error("Failed to add plan");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    try {
      await deleteProperty(propertyId);
      toast.success("Property deleted");
      router.push("/portfolio");
    } catch {
      toast.error("Failed to delete property");
    }
  };

  const handleRunProjection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const input = {
        planned_units: Number(projForm.planned_units),
        monthly_rent_per_unit: Number(projForm.monthly_rent_per_unit),
        annual_expense_ratio: Number(projForm.annual_expense_ratio) / 100,
        vacancy_rate_stabilized: Number(projForm.vacancy_rate_stabilized) / 100,
        construction_start_date: projForm.construction_start_date || undefined,
        construction_months: Number(projForm.construction_months),
        lease_up_months: Number(projForm.lease_up_months),
        annual_debt_service: projForm.annual_debt_service ? Number(projForm.annual_debt_service) : undefined,
        exit_cap_rate: Number(projForm.exit_cap_rate) / 100,
      };
      const result = await runProjection(input);
      setProjResults((result as { projections?: Array<Record<string, unknown>> }).projections ?? (result as Array<Record<string, unknown>>));
      toast.success("Projection complete");
    } catch {
      toast.error("Failed to run projection");
    }
  };

  const handleCreateRefi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRefi({
        label: refiForm.label,
        assumed_new_valuation: Number(refiForm.assumed_new_valuation),
        new_ltv_percent: Number(refiForm.new_ltv_percent),
        new_interest_rate: refiForm.new_interest_rate ? Number(refiForm.new_interest_rate) : undefined,
        new_amortization_months: refiForm.new_amortization_months ? Number(refiForm.new_amortization_months) : undefined,
        existing_debt_payout: refiForm.existing_debt_payout ? Number(refiForm.existing_debt_payout) : undefined,
        closing_costs: Number(refiForm.closing_costs),
        notes: refiForm.notes || undefined,
      });
      toast.success("Refinance scenario saved");
      setRefiForm({ label: "Refinance Scenario", assumed_new_valuation: "", new_ltv_percent: "75", new_interest_rate: "", new_amortization_months: "300", existing_debt_payout: "", closing_costs: "0", notes: "" });
    } catch {
      toast.error("Failed to save refinance scenario");
    }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSale({
        label: saleForm.label,
        assumed_sale_price: Number(saleForm.assumed_sale_price),
        selling_costs_percent: Number(saleForm.selling_costs_percent),
        debt_payout: saleForm.debt_payout ? Number(saleForm.debt_payout) : undefined,
        capital_gains_reserve: Number(saleForm.capital_gains_reserve),
        notes: saleForm.notes || undefined,
      });
      toast.success("Sale scenario saved");
      setSaleForm({ label: "Sale Scenario", assumed_sale_price: "", selling_costs_percent: "5", debt_payout: "", capital_gains_reserve: "0", notes: "" });
    } catch {
      toast.error("Failed to save sale scenario");
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!property) return <p>Property not found.</p>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <LinkButton variant="ghost" size="sm" href="/portfolio" className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </LinkButton>
          <h1 className="text-2xl font-bold">{property.address}</h1>
          <p className="text-muted-foreground">
            {property.city}, {property.province}
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton variant="outline" href={`/portfolio/${propertyId}/model`}>
            <Calculator className="mr-2 h-4 w-4" />
            Model
          </LinkButton>
          {canEdit && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deletePending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Development Plans</TabsTrigger>
          <TabsTrigger value="debt">Debt &amp; Amortization</TabsTrigger>
          <TabsTrigger value="projections">Projections</TabsTrigger>
          <TabsTrigger value="exit">Exit Scenarios</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Purchase Price</dt>
                  <dd className="font-medium">{property.purchase_price ? formatCurrency(property.purchase_price) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Purchase Date</dt>
                  <dd className="font-medium">{property.purchase_date ? formatDate(property.purchase_date) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Development Stage</dt>
                  <dd>
                    <Badge variant="outline">{property.development_stage}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Zoning</dt>
                  <dd className="font-medium">{property.zoning ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Lot Size</dt>
                  <dd className="font-medium">
                    {property.lot_size ? `${Number(property.lot_size).toLocaleString()} sqft` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Max Buildable Area</dt>
                  <dd className="font-medium">
                    {property.max_buildable_area
                      ? `${Number(property.max_buildable_area).toLocaleString()} sqft`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Development Plans ── */}
        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Development Plans</CardTitle>
              {canEdit && (
                <Dialog open={planOpen} onOpenChange={setPlanOpen}>
                  <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Plan
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Development Plan</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddPlan} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Planned Units</Label>
                          <Input
                            type="number"
                            value={planForm.planned_units || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({ ...f, planned_units: Number(e.target.value) }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Beds</Label>
                          <Input
                            type="number"
                            value={planForm.planned_beds || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({ ...f, planned_beds: Number(e.target.value) }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Sqft</Label>
                          <Input
                            type="number"
                            value={planForm.planned_sqft || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({ ...f, planned_sqft: Number(e.target.value) }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Est. Construction Cost</Label>
                          <Input
                            type="number"
                            value={planForm.estimated_construction_cost || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({
                                ...f,
                                estimated_construction_cost: Number(e.target.value),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={planForm.development_start_date}
                            onChange={(e) =>
                              setPlanForm((f) => ({
                                ...f,
                                development_start_date: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (days)</Label>
                          <Input
                            type="number"
                            value={planForm.construction_duration_days || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({
                                ...f,
                                construction_duration_days: Number(e.target.value),
                              }))
                            }
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={planPending}>
                        {planPending ? "Adding…" : "Add Plan"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!plans || plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No development plans yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Units</TableHead>
                        <TableHead>Beds</TableHead>
                        <TableHead>Sqft</TableHead>
                        <TableHead>Est. Cost</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.plan_id}>
                          <TableCell>{plan.planned_units}</TableCell>
                          <TableCell>{plan.planned_beds}</TableCell>
                          <TableCell>{Number(plan.planned_sqft).toLocaleString()}</TableCell>
                          <TableCell>{plan.estimated_construction_cost ? formatCurrency(plan.estimated_construction_cost) : "—"}</TableCell>
                          <TableCell>{plan.development_start_date ? formatDate(plan.development_start_date) : "—"}</TableCell>
                          <TableCell>{plan.construction_duration_days} days</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Debt & Amortization ── */}
        <TabsContent value="debt" className="mt-4 space-y-4">
          {!debtFacilities || debtFacilities.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">No debt facilities recorded for this property.</p>
              </CardContent>
            </Card>
          ) : (
            debtFacilities.map((debt: {
              debt_id: number;
              lender_name: string;
              debt_type: string;
              status: string;
              commitment_amount: number;
              outstanding_balance: number;
              interest_rate: number | null;
              rate_type: string;
              term_months: number | null;
              maturity_date: string | null;
            }) => (
              <Card key={debt.debt_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{debt.lender_name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {debt.debt_type} · {debt.rate_type} ·{" "}
                        {debt.interest_rate != null ? `${Number(debt.interest_rate).toFixed(2)}%` : "rate TBD"}
                        {debt.term_months ? ` · ${debt.term_months}mo term` : ""}
                        {debt.maturity_date ? ` · matures ${formatDate(debt.maturity_date)}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(debt.commitment_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(debt.outstanding_balance)} outstanding
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <button
                    onClick={() =>
                      setExpandedDebtId(expandedDebtId === debt.debt_id ? null : debt.debt_id)
                    }
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {expandedDebtId === debt.debt_id ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {expandedDebtId === debt.debt_id ? "Hide" : "View"} amortization schedule
                  </button>
                  {expandedDebtId === debt.debt_id && (
                    <AmortizationPanel propertyId={propertyId} debtId={debt.debt_id} />
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Projections ── */}
        <TabsContent value="projections" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projection Inputs</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRunProjection} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Planned Units</Label>
                    <Input
                      type="number"
                      value={projForm.planned_units}
                      onChange={(e) => setProjForm((f) => ({ ...f, planned_units: e.target.value }))}
                      placeholder="e.g. 10"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Monthly Rent / Unit ($)</Label>
                    <Input
                      type="number"
                      value={projForm.monthly_rent_per_unit}
                      onChange={(e) => setProjForm((f) => ({ ...f, monthly_rent_per_unit: e.target.value }))}
                      placeholder="e.g. 2200"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Annual Expense Ratio (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={projForm.annual_expense_ratio}
                      onChange={(e) => setProjForm((f) => ({ ...f, annual_expense_ratio: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stabilized Vacancy Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={projForm.vacancy_rate_stabilized}
                      onChange={(e) => setProjForm((f) => ({ ...f, vacancy_rate_stabilized: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Construction Start Date</Label>
                    <Input
                      type="date"
                      value={projForm.construction_start_date}
                      onChange={(e) => setProjForm((f) => ({ ...f, construction_start_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Construction Duration (months)</Label>
                    <Input
                      type="number"
                      value={projForm.construction_months}
                      onChange={(e) => setProjForm((f) => ({ ...f, construction_months: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lease-Up Period (months)</Label>
                    <Input
                      type="number"
                      value={projForm.lease_up_months}
                      onChange={(e) => setProjForm((f) => ({ ...f, lease_up_months: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Annual Debt Service ($) — optional</Label>
                    <Input
                      type="number"
                      value={projForm.annual_debt_service}
                      onChange={(e) => setProjForm((f) => ({ ...f, annual_debt_service: e.target.value }))}
                      placeholder="leave blank if none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Exit Cap Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={projForm.exit_cap_rate}
                      onChange={(e) => setProjForm((f) => ({ ...f, exit_cap_rate: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={projPending}>
                    {projPending ? "Running…" : "Run Projection"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div>
              {!projResults ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Fill in the inputs and run a projection to see year-by-year results.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Year-by-Year Projection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Year</TableHead>
                            <TableHead>Phase</TableHead>
                            <TableHead className="text-right">Gross Revenue</TableHead>
                            <TableHead className="text-right">NOI</TableHead>
                            <TableHead className="text-right">Debt Service</TableHead>
                            <TableHead className="text-right">Cash Flow</TableHead>
                            <TableHead className="text-right">Cumulative CF</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projResults.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell>{String(row.year ?? i + 1)}</TableCell>
                              <TableCell>
                                <span className={cn("px-2 py-0.5 rounded text-xs font-medium", PHASE_COLORS[String(row.phase ?? "")] ?? "bg-gray-100 text-gray-700")}>
                                  {String(row.phase ?? "—")}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{row.gross_revenue != null ? formatCurrency(row.gross_revenue as number) : "—"}</TableCell>
                              <TableCell className="text-right">{row.noi != null ? formatCurrency(row.noi as number) : "—"}</TableCell>
                              <TableCell className="text-right">{row.annual_debt_service != null ? formatCurrency(row.annual_debt_service as number) : "—"}</TableCell>
                              <TableCell className={cn("text-right font-medium", (row.cash_flow as number) < 0 ? "text-red-600" : "text-green-600")}>
                                {row.cash_flow != null ? formatCurrency(row.cash_flow as number) : "—"}
                              </TableCell>
                              <TableCell className={cn("text-right", (row.cumulative_cash_flow as number) < 0 ? "text-red-600" : "text-green-600")}>
                                {row.cumulative_cash_flow != null ? formatCurrency(row.cumulative_cash_flow as number) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Exit Scenarios ── */}
        <TabsContent value="exit" className="mt-4 space-y-8">

          {/* Refinance Scenarios */}
          <section>
            <h3 className="text-base font-semibold mb-3">Refinance Scenarios</h3>
            <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">New Refinance Scenario</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateRefi} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input value={refiForm.label} onChange={(e) => setRefiForm((f) => ({ ...f, label: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Assumed New Valuation ($)</Label>
                      <Input type="number" value={refiForm.assumed_new_valuation} onChange={(e) => setRefiForm((f) => ({ ...f, assumed_new_valuation: e.target.value }))} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">New LTV (%)</Label>
                      <Input type="number" step="0.1" value={refiForm.new_ltv_percent} onChange={(e) => setRefiForm((f) => ({ ...f, new_ltv_percent: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">New Interest Rate (%)</Label>
                      <Input type="number" step="0.01" value={refiForm.new_interest_rate} onChange={(e) => setRefiForm((f) => ({ ...f, new_interest_rate: e.target.value }))} placeholder="optional" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">New Amortization (months)</Label>
                      <Input type="number" value={refiForm.new_amortization_months} onChange={(e) => setRefiForm((f) => ({ ...f, new_amortization_months: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Existing Debt Payout ($)</Label>
                      <Input type="number" value={refiForm.existing_debt_payout} onChange={(e) => setRefiForm((f) => ({ ...f, existing_debt_payout: e.target.value }))} placeholder="optional" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Closing Costs ($)</Label>
                      <Input type="number" value={refiForm.closing_costs} onChange={(e) => setRefiForm((f) => ({ ...f, closing_costs: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={refiForm.notes} onChange={(e) => setRefiForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <Button type="submit" className="w-full" disabled={refiPending}>
                      {refiPending ? "Saving…" : "Save Scenario"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Saved Refinance Scenarios</CardTitle>
                </CardHeader>
                <CardContent>
                  {!refiScenarios || refiScenarios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No refinance scenarios yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Label</TableHead>
                            <TableHead className="text-right">Valuation</TableHead>
                            <TableHead className="text-right">LTV%</TableHead>
                            <TableHead className="text-right">New Loan</TableHead>
                            <TableHead className="text-right">Net Proceeds</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {refiScenarios.map((s: {
                            scenario_id: number;
                            label: string;
                            assumed_new_valuation: number;
                            new_ltv_percent: number;
                            new_loan_amount: number;
                            net_proceeds: number;
                          }) => (
                            <TableRow key={s.scenario_id}>
                              <TableCell className="font-medium">{s.label}</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.assumed_new_valuation)}</TableCell>
                              <TableCell className="text-right">{s.new_ltv_percent}%</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.new_loan_amount)}</TableCell>
                              <TableCell className={cn("text-right font-semibold", s.net_proceeds >= 0 ? "text-green-600" : "text-red-600")}>
                                {formatCurrency(s.net_proceeds)}
                              </TableCell>
                              <TableCell>
                                <button
                                  onClick={() => deleteRefi(s.scenario_id)}
                                  className="text-red-500 hover:underline text-xs"
                                >
                                  Delete
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Sale Scenarios */}
          <section>
            <h3 className="text-base font-semibold mb-3">Sale Scenarios</h3>
            <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">New Sale Scenario</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateSale} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input value={saleForm.label} onChange={(e) => setSaleForm((f) => ({ ...f, label: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Assumed Sale Price ($)</Label>
                      <Input type="number" value={saleForm.assumed_sale_price} onChange={(e) => setSaleForm((f) => ({ ...f, assumed_sale_price: e.target.value }))} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Selling Costs (%)</Label>
                      <Input type="number" step="0.1" value={saleForm.selling_costs_percent} onChange={(e) => setSaleForm((f) => ({ ...f, selling_costs_percent: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Debt Payout ($)</Label>
                      <Input type="number" value={saleForm.debt_payout} onChange={(e) => setSaleForm((f) => ({ ...f, debt_payout: e.target.value }))} placeholder="optional" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Capital Gains Reserve ($)</Label>
                      <Input type="number" value={saleForm.capital_gains_reserve} onChange={(e) => setSaleForm((f) => ({ ...f, capital_gains_reserve: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={saleForm.notes} onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <Button type="submit" className="w-full" disabled={salePending}>
                      {salePending ? "Saving…" : "Save Scenario"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Saved Sale Scenarios</CardTitle>
                </CardHeader>
                <CardContent>
                  {!saleScenarios || saleScenarios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sale scenarios yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Label</TableHead>
                            <TableHead className="text-right">Sale Price</TableHead>
                            <TableHead className="text-right">Selling Costs</TableHead>
                            <TableHead className="text-right">Net Proceeds</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saleScenarios.map((s: {
                            scenario_id: number;
                            label: string;
                            assumed_sale_price: number;
                            selling_costs: number;
                            net_proceeds: number;
                          }) => (
                            <TableRow key={s.scenario_id}>
                              <TableCell className="font-medium">{s.label}</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.assumed_sale_price)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(s.selling_costs)}</TableCell>
                              <TableCell className={cn("text-right font-semibold", s.net_proceeds >= 0 ? "text-green-600" : "text-red-600")}>
                                {formatCurrency(s.net_proceeds)}
                              </TableCell>
                              <TableCell>
                                <button
                                  onClick={() => deleteSale(s.scenario_id)}
                                  className="text-red-500 hover:underline text-xs"
                                >
                                  Delete
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
