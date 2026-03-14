"use client";

import { useState } from "react";
import {
  DollarSign,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  PieChart,
} from "lucide-react";
import {
  useBudgets,
  useExpenses,
  useExpenseSummary,
  useCreateExpense,
  useUpdateBudget,
} from "@/hooks/useOperator";
import { useCommunities } from "@/hooks/useCommunities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/types/lifecycle";

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "property_management", label: "Property Management" },
  { value: "utilities", label: "Utilities" },
  { value: "insurance", label: "Insurance" },
  { value: "property_tax", label: "Property Tax" },
  { value: "maintenance_repairs", label: "Maintenance & Repairs" },
  { value: "staffing", label: "Staffing" },
  { value: "meal_program", label: "Meal Program" },
  { value: "supplies", label: "Supplies" },
  { value: "marketing", label: "Marketing" },
  { value: "technology", label: "Technology" },
  { value: "professional_fees", label: "Professional Fees" },
  { value: "other", label: "Other" },
];

export default function OperatorPage() {
  const { data: communitiesData, isLoading: commLoading } = useCommunities();
  const communities = communitiesData as any[] | undefined;
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);

  if (!selectedCommunityId && communities && communities.length > 0) {
    setSelectedCommunityId(communities[0].community_id);
  }

  if (commLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <DollarSign className="h-6 w-6" />
          Operator Management
        </h1>
        <p className="text-muted-foreground">
          Budgets, operating expenses, and financial tracking by community
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {communities?.map((c: any) => (
              <button
                key={c.community_id}
                onClick={() => setSelectedCommunityId(c.community_id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCommunityId === c.community_id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div>{c.name}</div>
                <div className="text-xs opacity-75">{c.community_type}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedCommunityId && (
        <Tabs defaultValue="budgets">
          <TabsList>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="budgets" className="mt-4">
            <BudgetsTab communityId={selectedCommunityId} />
          </TabsContent>
          <TabsContent value="expenses" className="mt-4">
            <ExpensesTab communityId={selectedCommunityId} />
          </TabsContent>
          <TabsContent value="summary" className="mt-4">
            <SummaryTab communityId={selectedCommunityId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function BudgetsTab({ communityId }: { communityId: number }) {
  const { data: budgets, isLoading } = useBudgets(communityId);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Budget Periods</CardTitle>
      </CardHeader>
      <CardContent>
        {!budgets || budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budgets found.</p>
        ) : (
          <div className="space-y-4">
            {budgets.map((b) => {
              const hasActuals = b.actual_revenue !== null;
              const revenueVariance = hasActuals
                ? Number(b.actual_revenue) - Number(b.budgeted_revenue)
                : null;
              const expenseVariance = hasActuals
                ? Number(b.actual_expenses) - Number(b.budgeted_expenses)
                : null;

              return (
                <div key={b.budget_id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{b.period_label}</span>
                      <Badge variant="outline">{b.period_type}</Badge>
                    </div>
                    {hasActuals ? (
                      <Badge className="bg-green-100 text-green-700">
                        Actuals Recorded
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Budget Only</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Revenue</p>
                      <p className="font-medium">{formatCurrency(b.budgeted_revenue)}</p>
                      {hasActuals && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">Actual:</span>
                          <span className="text-xs font-medium">{formatCurrency(b.actual_revenue!)}</span>
                          <VarianceIndicator value={revenueVariance!} positive />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Expenses</p>
                      <p className="font-medium">{formatCurrency(b.budgeted_expenses)}</p>
                      {hasActuals && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">Actual:</span>
                          <span className="text-xs font-medium">{formatCurrency(b.actual_expenses!)}</span>
                          <VarianceIndicator value={expenseVariance!} positive={false} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">NOI</p>
                      <p className="font-medium">{formatCurrency(b.budgeted_noi)}</p>
                      {hasActuals && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">Actual:</span>
                          <span className="text-xs font-medium">{formatCurrency(b.actual_noi!)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {b.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{b.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpensesTab({ communityId }: { communityId: number }) {
  const { data: expenses, isLoading } = useExpenses(communityId);
  const { mutateAsync: createExpense, isPending: creating } = useCreateExpense();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    category: "" as string,
    description: "",
    amount: "",
    expense_date: "",
    vendor: "",
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createExpense({
        community_id: communityId,
        category: form.category as ExpenseCategory,
        description: form.description,
        amount: Number(form.amount),
        expense_date: form.expense_date,
        period_month: form.period_month,
        period_year: form.period_year,
        vendor: form.vendor || undefined,
      });
      toast.success("Expense added");
      setAddOpen(false);
      setForm({
        category: "",
        description: "",
        amount: "",
        expense_date: "",
        vendor: "",
        period_month: new Date().getMonth() + 1,
        period_year: new Date().getFullYear(),
      });
    } catch {
      toast.error("Failed to add expense");
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Operating Expenses</CardTitle>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Operating Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v ?? "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
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
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, expense_date: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input
                  value={form.vendor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vendor: e.target.value }))
                  }
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding..." : "Add Expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!expenses || expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses found.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((exp) => (
                <TableRow key={exp.expense_id}>
                  <TableCell className="text-sm">{formatDate(exp.expense_date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {exp.category.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{exp.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {exp.vendor ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(exp.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTab({ communityId }: { communityId: number }) {
  const [year, setYear] = useState(2025);
  const [quarter, setQuarter] = useState<number | undefined>(4);
  const { data: summary, isLoading } = useExpenseSummary(communityId, year, quarter);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Expense Summary
          </CardTitle>
          <div className="flex gap-2">
            <Select
              value={String(year)}
              onValueChange={(v) => v && setYear(Number(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={quarter ? String(quarter) : "all"}
              onValueChange={(v) =>
                setQuarter(v === "all" || !v ? undefined : Number(v))
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Full Year</SelectItem>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!summary ? (
          <p className="text-sm text-muted-foreground">No data available.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.total_expenses)}</p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Expense Line Items</p>
                <p className="text-2xl font-bold">{summary.expense_count}</p>
              </div>
            </div>

            {summary.by_category && Object.keys(summary.by_category).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">By Category</h4>
                <div className="space-y-2">
                  {Object.entries(summary.by_category)
                    .sort(([, a], [, b]) => Number(b) - Number(a))
                    .map(([cat, amount]) => {
                      const pct =
                        Number(summary.total_expenses) > 0
                          ? (Number(amount) / Number(summary.total_expenses)) * 100
                          : 0;
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-sm w-40 truncate">
                            {cat.replace(/_/g, " ")}
                          </span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-24 text-right">
                            {formatCurrency(amount)}
                          </span>
                          <span className="text-xs text-muted-foreground w-12 text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VarianceIndicator({
  value,
  positive,
}: {
  value: number;
  positive: boolean;
}) {
  const isGood = positive ? value >= 0 : value <= 0;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span
      className={`inline-flex items-center text-xs ${
        isGood ? "text-green-600" : "text-red-600"
      }`}
    >
      <Icon className="h-3 w-3 mr-0.5" />
      {formatCurrency(Math.abs(value))}
    </span>
  );
}
