"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Edit2,
  Plus,
  Save,
  Trash2,
  X,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useOperatingExpenses,
  useOperatingExpenseSummary,
  useCreateOperatingExpense,
  useUpdateOperatingExpense,
  useDeleteOperatingExpense,
  useInitializeOperatingExpenses,
} from "@/hooks/usePortfolio";
import type {
  OperatingExpenseLineItem,
  OperatingExpenseLineItemCreate,
} from "@/types/portfolio";

const EXPENSE_CATEGORIES = [
  { value: "property_tax", label: "Property Taxes" },
  { value: "insurance", label: "Insurance" },
  { value: "utilities", label: "Utilities" },
  { value: "salaries", label: "Salaries / Caretaker" },
  { value: "management_fee", label: "Management Fee" },
  { value: "repairs_maintenance", label: "Repairs & Maintenance" },
  { value: "miscellaneous", label: "Miscellaneous" },
  { value: "reserves", label: "Furniture / Appliance Reserve" },
  { value: "elevator", label: "Elevator Maintenance" },
  { value: "premium_services", label: "Premium Services" },
  { value: "other", label: "Other" },
];

const CALC_METHODS = [
  { value: "per_unit", label: "Per Unit / Year" },
  { value: "pct_egi", label: "% of EGI" },
  { value: "fixed", label: "Fixed Annual" },
];

function getCategoryLabel(cat: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label || cat;
}

function getCalcMethodLabel(method: string) {
  return CALC_METHODS.find((m) => m.value === method)?.label || method;
}

function formatBaseAmount(method: string, amount: number) {
  if (method === "pct_egi") return `${Number(amount).toFixed(1)}%`;
  return `$${Number(amount).toLocaleString()}`;
}

interface OperatingExpensesSectionProps {
  propertyId: number;
  planId?: number | null;
  canEdit: boolean;
  phaseName?: string;
}

export function OperatingExpensesSection({
  propertyId,
  planId = null,
  canEdit,
  phaseName,
}: OperatingExpensesSectionProps) {
  const { data: expenses } = useOperatingExpenses(propertyId, planId);
  const { data: summary } = useOperatingExpenseSummary(propertyId, planId);
  const createMutation = useCreateOperatingExpense(propertyId);
  const updateMutation = useUpdateOperatingExpense(propertyId);
  const deleteMutation = useDeleteOperatingExpense(propertyId);
  const initMutation = useInitializeOperatingExpenses(propertyId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<OperatingExpenseLineItemCreate>({
    category: "other",
    description: "",
    calc_method: "per_unit",
    base_amount: 0,
    annual_escalation_pct: 3,
    development_plan_id: planId,
  });

  const resetForm = () => {
    setForm({
      category: "other",
      description: "",
      calc_method: "per_unit",
      base_amount: 0,
      annual_escalation_pct: 3,
      development_plan_id: planId,
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleCreate = () => {
    createMutation.mutate(form, {
      onSuccess: () => {
        toast.success("Expense item added");
        resetForm();
      },
      onError: () => toast.error("Failed to add expense item"),
    });
  };

  const handleUpdate = (itemId: number) => {
    updateMutation.mutate(
      { expenseItemId: itemId, data: form },
      {
        onSuccess: () => {
          toast.success("Expense item updated");
          resetForm();
        },
        onError: () => toast.error("Failed to update expense item"),
      }
    );
  };

  const handleDelete = (itemId: number) => {
    deleteMutation.mutate(itemId, {
      onSuccess: () => toast.success("Expense item removed"),
      onError: () => toast.error("Failed to remove expense item"),
    });
  };

  const handleInitialize = () => {
    initMutation.mutate(planId, {
      onSuccess: () => toast.success("Default expense items created"),
      onError: (err: any) => {
        const msg = err?.response?.data?.detail || "Failed to initialize";
        toast.error(msg);
      },
    });
  };

  const startEdit = (item: OperatingExpenseLineItem) => {
    setEditingId(item.expense_item_id);
    setForm({
      category: item.category,
      description: item.description || "",
      calc_method: item.calc_method,
      base_amount: Number(item.base_amount),
      annual_escalation_pct: Number(item.annual_escalation_pct),
      development_plan_id: item.development_plan_id,
    });
    setShowAddForm(false);
  };

  const items = expenses || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-red-600" />
            Annual Operating Expenses — Post {phaseName || (planId ? "Development" : "As-Is")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {canEdit && items.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleInitialize}
                disabled={initMutation.isPending}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {initMutation.isPending ? "Creating..." : "Initialize Defaults"}
              </Button>
            )}
            {canEdit && !showAddForm && editingId === null && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary KPIs */}
        {summary && summary.total_annual_expenses > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Annual Expenses</p>
              <p className="text-lg font-bold text-red-700">
                ${Number(summary.total_annual_expenses).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Expense Ratio</p>
              <p className="text-lg font-bold">
                {Number(summary.expense_ratio).toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Units</p>
              <p className="text-lg font-bold">{summary.total_units}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">EGI</p>
              <p className="text-lg font-bold text-green-700">
                ${Number(summary.egi).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Expense Items Table */}
        {items.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-center px-3 py-2 font-medium">Method</th>
                  <th className="text-right px-3 py-2 font-medium">Base Amount</th>
                  <th className="text-right px-3 py-2 font-medium">Annual Cost</th>
                  <th className="text-right px-3 py-2 font-medium">Esc. %</th>
                  {canEdit && <th className="px-3 py-2 w-20" />}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  if (editingId === item.expense_item_id) {
                    return (
                      <tr key={item.expense_item_id} className="bg-blue-50/50">
                        <td colSpan={canEdit ? 7 : 6} className="p-3">
                          <ExpenseForm
                            form={form}
                            setForm={setForm}
                            onSave={() => handleUpdate(item.expense_item_id)}
                            onCancel={resetForm}
                            saving={updateMutation.isPending}
                          />
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={item.expense_item_id}
                      className="border-t hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 font-medium">
                        {getCategoryLabel(item.category)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {item.description || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {getCalcMethodLabel(item.calc_method)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatBaseAmount(item.calc_method, Number(item.base_amount))}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-red-700">
                        ${Number(item.computed_annual_amount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {Number(item.annual_escalation_pct).toFixed(1)}%
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => startEdit(item)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(item.expense_item_id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {/* Totals Row */}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-3 py-2" colSpan={4}>
                    Total Operating Expenses
                  </td>
                  <td className="px-3 py-2 text-right text-red-700">
                    ${Number(summary?.total_annual_expenses || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2" />
                  {canEdit && <td className="px-3 py-2" />}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && !showAddForm && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No operating expense line items configured.
            {canEdit &&
              " Click \"Initialize Defaults\" to create standard expense categories, or \"Add Item\" to add individually."}
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="border rounded-lg p-4 bg-blue-50/30">
            <ExpenseForm
              form={form}
              setForm={setForm}
              onSave={handleCreate}
              onCancel={resetForm}
              saving={createMutation.isPending}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Inline Form Component ──────────────────────────────────────────

interface ExpenseFormProps {
  form: OperatingExpenseLineItemCreate;
  setForm: React.Dispatch<
    React.SetStateAction<OperatingExpenseLineItemCreate>
  >;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function ExpenseForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
}: ExpenseFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Category</Label>
          <Select
            value={form.category}
            onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "property_taxes" }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. Caretaker Salary"
            value={form.description || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </div>
        <div>
          <Label className="text-xs">Calculation Method</Label>
          <Select
            value={form.calc_method}
            onValueChange={(v) => setForm((f) => ({ ...f, calc_method: v ?? "fixed" }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CALC_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">
            {form.calc_method === "pct_egi"
              ? "Percentage (%)"
              : form.calc_method === "per_unit"
              ? "Amount Per Unit ($)"
              : "Fixed Annual ($)"}
          </Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={0}
            step={form.calc_method === "pct_egi" ? 0.5 : 100}
            value={form.base_amount}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                base_amount: parseFloat(e.target.value) || 0,
              }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Annual Escalation %</Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={0}
            step={0.5}
            value={form.annual_escalation_pct ?? 3}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                annual_escalation_pct: parseFloat(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div className="md:col-span-3 flex items-end gap-2">
          <Button size="sm" onClick={onSave} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
