"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  HardHat,
  Banknote,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import {
  useConstructionBudgetSummary,
  useConstructionExpenses,
  useCreateConstructionExpense,
  useUpdateConstructionExpense,
  useDeleteConstructionExpense,
  useConstructionDraws,
  useCreateConstructionDraw,
  useUpdateConstructionDraw,
  useDeleteConstructionDraw,
  useDevelopmentPlans,
  useDebtFacilities,
} from "@/hooks/usePortfolio";
import type {
  ConstructionExpense,
  ConstructionExpenseCreate,
  ConstructionDraw,
  DevelopmentPlan,
  DebtFacility,
} from "@/types/portfolio";

const EXPENSE_CATEGORIES = [
  { value: "hard_costs", label: "Hard Costs", color: "bg-orange-500" },
  { value: "soft_costs", label: "Soft Costs", color: "bg-blue-500" },
  { value: "site_costs", label: "Site Costs", color: "bg-amber-500" },
  { value: "financing_costs", label: "Financing Costs", color: "bg-purple-500" },
  { value: "contingency", label: "Contingency", color: "bg-slate-500" },
];

const DRAW_STATUSES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  requested: { label: "Requested", variant: "outline" },
  approved: { label: "Approved", variant: "secondary" },
  funded: { label: "Funded", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function categoryLabel(cat: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function categoryColor(cat: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.color ?? "bg-gray-500";
}

interface Props {
  propertyId: number;
  canEdit: boolean;
}

const emptyExpenseForm = {
  category: "hard_costs",
  description: "",
  budgeted_amount: "",
  actual_amount: "",
  vendor: "",
  invoice_ref: "",
  expense_date: "",
  notes: "",
};

const emptyDrawForm = {
  debt_id: "",
  draw_number: "",
  requested_amount: "",
  description: "",
  requested_date: "",
  notes: "",
};

export function ConstructionBudgetTab({ propertyId, canEdit }: Props) {
  const { data: plans, isLoading: plansLoading } = useDevelopmentPlans(propertyId);
  const { data: debtFacilities } = useDebtFacilities(propertyId);

  // Select active plan by default, or first plan
  const activePlan = useMemo(() => {
    if (!plans || plans.length === 0) return null;
    return plans.find((p: DevelopmentPlan) => p.status === "active") ?? plans[0];
  }, [plans]);

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const effectivePlanId = selectedPlanId ?? activePlan?.plan_id ?? 0;

  const { data: summary, isLoading: summaryLoading } = useConstructionBudgetSummary(propertyId, effectivePlanId);
  const { data: expenses } = useConstructionExpenses(propertyId, effectivePlanId);
  const { data: draws } = useConstructionDraws(propertyId);

  const createExpense = useCreateConstructionExpense(propertyId);
  const updateExpense = useUpdateConstructionExpense(propertyId);
  const deleteExpense = useDeleteConstructionExpense(propertyId);
  const createDraw = useCreateConstructionDraw(propertyId);
  const updateDraw = useUpdateConstructionDraw(propertyId);
  const deleteDraw = useDeleteConstructionDraw(propertyId);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);

  const [drawOpen, setDrawOpen] = useState(false);
  const [drawForm, setDrawForm] = useState(emptyDrawForm);

  // Construction loan facilities for draws
  const constructionLoans = useMemo(
    () => (debtFacilities ?? []).filter((d: DebtFacility) => d.debt_type === "construction_loan"),
    [debtFacilities]
  );

  // Budget from plan
  const planBudget = activePlan
    ? Number(activePlan.estimated_construction_cost ?? 0)
    : 0;
  const totalBudgeted = Number(summary?.total_budgeted ?? 0);
  const totalActual = Number(summary?.total_actual ?? 0);
  const totalVariance = Number(summary?.total_variance ?? 0);
  const spentPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;

  function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const payload: ConstructionExpenseCreate = {
      plan_id: effectivePlanId,
      category: expenseForm.category,
      description: expenseForm.description || undefined,
      budgeted_amount: Number(expenseForm.budgeted_amount) || 0,
      actual_amount: Number(expenseForm.actual_amount) || 0,
      vendor: expenseForm.vendor || undefined,
      invoice_ref: expenseForm.invoice_ref || undefined,
      expense_date: expenseForm.expense_date || undefined,
      notes: expenseForm.notes || undefined,
    };
    createExpense.mutate(payload, {
      onSuccess: () => {
        toast.success("Construction expense added");
        setExpenseForm(emptyExpenseForm);
        setExpenseOpen(false);
      },
      onError: () => toast.error("Failed to add expense"),
    });
  }

  function handleUpdateExpense(expenseId: number) {
    const payload: Partial<ConstructionExpenseCreate> = {
      category: expenseForm.category,
      description: expenseForm.description || undefined,
      budgeted_amount: Number(expenseForm.budgeted_amount) || 0,
      actual_amount: Number(expenseForm.actual_amount) || 0,
      vendor: expenseForm.vendor || undefined,
      invoice_ref: expenseForm.invoice_ref || undefined,
      expense_date: expenseForm.expense_date || undefined,
      notes: expenseForm.notes || undefined,
    };
    updateExpense.mutate(
      { expenseId, data: payload },
      {
        onSuccess: () => {
          toast.success("Expense updated");
          setEditingExpenseId(null);
          setExpenseForm(emptyExpenseForm);
        },
        onError: () => toast.error("Failed to update expense"),
      }
    );
  }

  function startEditExpense(exp: ConstructionExpense) {
    setEditingExpenseId(exp.expense_id);
    setExpenseForm({
      category: exp.category,
      description: exp.description ?? "",
      budgeted_amount: String(exp.budgeted_amount),
      actual_amount: String(exp.actual_amount),
      vendor: exp.vendor ?? "",
      invoice_ref: exp.invoice_ref ?? "",
      expense_date: exp.expense_date ?? "",
      notes: exp.notes ?? "",
    });
  }

  function handleDeleteExpense(id: number) {
    if (!confirm("Delete this expense line item?")) return;
    deleteExpense.mutate(id, {
      onSuccess: () => toast.success("Expense deleted"),
      onError: () => toast.error("Failed to delete"),
    });
  }

  function handleAddDraw(e: React.FormEvent) {
    e.preventDefault();
    createDraw.mutate(
      {
        debt_id: Number(drawForm.debt_id),
        draw_number: Number(drawForm.draw_number),
        requested_amount: Number(drawForm.requested_amount),
        description: drawForm.description || undefined,
        requested_date: drawForm.requested_date || undefined,
        notes: drawForm.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Draw request created");
          setDrawForm(emptyDrawForm);
          setDrawOpen(false);
        },
        onError: () => toast.error("Failed to create draw"),
      }
    );
  }

  function handleDrawStatusChange(drawId: number, status: string) {
    const data: Record<string, unknown> = { status };
    if (status === "approved") data.approved_date = new Date().toISOString().split("T")[0];
    if (status === "funded") data.funded_date = new Date().toISOString().split("T")[0];
    updateDraw.mutate(
      { drawId, data },
      {
        onSuccess: () => toast.success(`Draw ${status}`),
        onError: () => toast.error("Failed to update draw"),
      }
    );
  }

  if (plansLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6 text-center">
          <HardHat className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No development plans yet. Create a plan in the Dev Plans tab to start tracking construction costs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Selector */}
      {plans.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Development Plan:</Label>
          <Select
            value={String(effectivePlanId)}
            onValueChange={(v) => setSelectedPlanId(Number(v))}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p: DevelopmentPlan) => (
                <SelectItem key={p.plan_id} value={String(p.plan_id)}>
                  {p.plan_name || `Plan v${p.version}`} ({p.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Plan Budget</p>
            <p className="text-lg font-bold">{formatCurrency(planBudget)}</p>
            <p className="text-xs text-muted-foreground">Total estimated cost</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Budgeted (Line Items)</p>
            <p className="text-lg font-bold">{formatCurrency(totalBudgeted)}</p>
            <p className="text-xs text-muted-foreground">
              {(expenses ?? []).length} line item{(expenses ?? []).length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Actual Spent</p>
            <p className="text-lg font-bold text-amber-700">{formatCurrency(totalActual)}</p>
            <p className="text-xs text-muted-foreground">
              {spentPct > 0 ? `${spentPct.toFixed(1)}% of budget` : "No spend recorded"}
            </p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", totalVariance >= 0 ? "border-l-green-500" : "border-l-red-500")}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Variance</p>
            <p className={cn("text-lg font-bold", totalVariance >= 0 ? "text-green-700" : "text-red-700")}>
              {totalVariance >= 0 ? "" : "-"}{formatCurrency(Math.abs(totalVariance))}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {totalVariance >= 0 ? (
                <><TrendingDown className="h-3 w-3 text-green-600" /> Under budget</>
              ) : (
                <><TrendingUp className="h-3 w-3 text-red-600" /> Over budget</>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Budget Progress Bar ── */}
      {totalBudgeted > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Overall Spend Progress</p>
              <p className="text-sm font-medium tabular-nums">{spentPct.toFixed(1)}%</p>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  spentPct > 100 ? "bg-red-500" : spentPct > 90 ? "bg-amber-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(spentPct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Category Breakdown ── */}
      {summary?.by_category && Object.keys(summary.by_category).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Budget vs Actual by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Budgeted</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">% Spent</TableHead>
                    <TableHead className="w-[120px]">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(summary.by_category).map(([cat, vals]) => {
                    const pct = vals.budgeted > 0 ? (vals.actual / vals.budgeted) * 100 : 0;
                    return (
                      <TableRow key={cat}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2.5 w-2.5 rounded-full", categoryColor(cat))} />
                            {categoryLabel(cat)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(vals.budgeted)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(vals.actual)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums font-medium", vals.variance >= 0 ? "text-green-600" : "text-red-600")}>
                          {vals.variance >= 0 ? "" : "-"}{formatCurrency(Math.abs(vals.variance))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pct.toFixed(1)}%</TableCell>
                        <TableCell>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                pct > 100 ? "bg-red-500" : pct > 90 ? "bg-amber-500" : "bg-green-500"
                              )}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totalBudgeted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totalActual)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", totalVariance >= 0 ? "text-green-600" : "text-red-600")}>
                      {totalVariance >= 0 ? "" : "-"}{formatCurrency(Math.abs(totalVariance))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{spentPct.toFixed(1)}%</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Expense Line Items ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Expense Line Items</CardTitle>
          {canEdit && (
            <Dialog open={expenseOpen} onOpenChange={(open) => { setExpenseOpen(open); if (!open) setExpenseForm(emptyExpenseForm); }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Construction Expense</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm((f) => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Framing lumber" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Budgeted Amount ($)</Label>
                      <Input type="number" step="0.01" value={expenseForm.budgeted_amount} onChange={(e) => setExpenseForm((f) => ({ ...f, budgeted_amount: e.target.value }))} placeholder="0.00" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Actual Amount ($)</Label>
                      <Input type="number" step="0.01" value={expenseForm.actual_amount} onChange={(e) => setExpenseForm((f) => ({ ...f, actual_amount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vendor</Label>
                      <Input value={expenseForm.vendor} onChange={(e) => setExpenseForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="e.g. ABC Construction" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Invoice Ref</Label>
                      <Input value={expenseForm.invoice_ref} onChange={(e) => setExpenseForm((f) => ({ ...f, invoice_ref: e.target.value }))} placeholder="INV-001" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expense Date</Label>
                      <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm((f) => ({ ...f, expense_date: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={expenseForm.notes} onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <Button type="submit" disabled={createExpense.isPending} className="w-full">
                    {createExpense.isPending ? "Adding..." : "Add Expense"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {!expenses || expenses.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No expense line items recorded yet.</p>
              {canEdit && (
                <p className="text-xs text-muted-foreground mt-1">
                  Add expenses to track budgeted vs actual construction costs.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Budgeted</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((exp: ConstructionExpense) => {
                    const budgeted = Number(exp.budgeted_amount);
                    const actual = Number(exp.actual_amount);
                    const variance = budgeted - actual;
                    const isEditing = editingExpenseId === exp.expense_id;

                    if (isEditing) {
                      return (
                        <TableRow key={exp.expense_id} className="bg-blue-50/50">
                          <TableCell>
                            <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm((f) => ({ ...f, category: v }))}>
                              <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {EXPENSE_CATEGORIES.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input className="h-8" value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8" value={expenseForm.vendor} onChange={(e) => setExpenseForm((f) => ({ ...f, vendor: e.target.value }))} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8" value={expenseForm.invoice_ref} onChange={(e) => setExpenseForm((f) => ({ ...f, invoice_ref: e.target.value }))} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8" type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm((f) => ({ ...f, expense_date: e.target.value }))} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 w-24 text-right" type="number" step="0.01" value={expenseForm.budgeted_amount} onChange={(e) => setExpenseForm((f) => ({ ...f, budgeted_amount: e.target.value }))} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 w-24 text-right" type="number" step="0.01" value={expenseForm.actual_amount} onChange={(e) => setExpenseForm((f) => ({ ...f, actual_amount: e.target.value }))} />
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleUpdateExpense(exp.expense_id)}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingExpenseId(null); setExpenseForm(emptyExpenseForm); }}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return (
                      <TableRow key={exp.expense_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full", categoryColor(exp.category))} />
                            <span className="text-xs">{categoryLabel(exp.category)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{exp.description || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{exp.vendor || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{exp.invoice_ref || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{exp.expense_date || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(budgeted)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(actual)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums font-medium", variance >= 0 ? "text-green-600" : "text-red-600")}>
                          {variance >= 0 ? "" : "-"}{formatCurrency(Math.abs(variance))}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditExpense(exp)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDeleteExpense(exp.expense_id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Construction Draws ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Construction Draw Schedule</CardTitle>
          {canEdit && constructionLoans.length > 0 && (
            <Dialog open={drawOpen} onOpenChange={(open) => { setDrawOpen(open); if (!open) setDrawForm(emptyDrawForm); }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Request Draw
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Request Construction Draw</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddDraw} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Construction Loan</Label>
                      <Select value={drawForm.debt_id} onValueChange={(v) => setDrawForm((f) => ({ ...f, debt_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select loan..." /></SelectTrigger>
                        <SelectContent>
                          {constructionLoans.map((d: DebtFacility) => (
                            <SelectItem key={d.debt_id} value={String(d.debt_id)}>
                              {d.lender_name} — {formatCurrency(d.commitment_amount)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Draw Number</Label>
                      <Input type="number" value={drawForm.draw_number} onChange={(e) => setDrawForm((f) => ({ ...f, draw_number: e.target.value }))} placeholder="1" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Requested Amount ($)</Label>
                      <Input type="number" step="0.01" value={drawForm.requested_amount} onChange={(e) => setDrawForm((f) => ({ ...f, requested_amount: e.target.value }))} placeholder="100,000" required />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input value={drawForm.description} onChange={(e) => setDrawForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Foundation completion" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Request Date</Label>
                      <Input type="date" value={drawForm.requested_date} onChange={(e) => setDrawForm((f) => ({ ...f, requested_date: e.target.value }))} />
                    </div>
                  </div>
                  <Button type="submit" disabled={createDraw.isPending} className="w-full">
                    {createDraw.isPending ? "Submitting..." : "Submit Draw Request"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {constructionLoans.length === 0 ? (
            <div className="text-center py-8">
              <Banknote className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No construction loans configured. Add a construction loan in the Debt & Financing tab to track draws.
              </p>
            </div>
          ) : !draws || draws.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No draw requests yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Draw #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Requested Amt</TableHead>
                    <TableHead className="text-right">Approved Amt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Funded</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draws.map((draw: ConstructionDraw) => {
                    const statusInfo = DRAW_STATUSES[draw.status] ?? { label: draw.status, variant: "outline" as const };
                    return (
                      <TableRow key={draw.draw_id}>
                        <TableCell className="font-medium">#{draw.draw_number}</TableCell>
                        <TableCell className="text-sm">{draw.description || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{draw.requested_date || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(draw.requested_amount))}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {draw.approved_amount ? formatCurrency(Number(draw.approved_amount)) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant} className="text-xs">
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{draw.funded_date || "—"}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {draw.status === "requested" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-green-600"
                                    onClick={() => handleDrawStatusChange(draw.draw_id, "approved")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-red-600"
                                    onClick={() => handleDrawStatusChange(draw.draw_id, "rejected")}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {draw.status === "approved" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-blue-600"
                                  onClick={() => handleDrawStatusChange(draw.draw_id, "funded")}
                                >
                                  Mark Funded
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => {
                                  if (!confirm("Delete this draw?")) return;
                                  deleteDraw.mutate(draw.draw_id, {
                                    onSuccess: () => toast.success("Draw deleted"),
                                    onError: () => toast.error("Failed to delete"),
                                  });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
