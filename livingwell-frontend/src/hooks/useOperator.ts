import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type {
  OperatorBudget,
  BudgetCreate,
  BudgetUpdate,
  OperatingExpense,
  ExpenseCreate,
  ExpenseUpdate,
  ExpenseSummary,
} from "@/types/lifecycle";

// ── Budgets ─────────────────────────────────────────────────────────

export function useBudgets(communityId?: number, operatorId?: number) {
  return useQuery({
    queryKey: ["budgets", communityId, operatorId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (communityId) params.set("community_id", String(communityId));
      if (operatorId) params.set("operator_id", String(operatorId));
      const qs = params.toString() ? `?${params.toString()}` : "";
      return apiClient
        .get<OperatorBudget[]>(`/api/operator/budgets${qs}`)
        .then((r) => r.data);
    },
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BudgetCreate) =>
      apiClient.post<OperatorBudget>("/api/operator/budgets", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, data }: { budgetId: number; data: BudgetUpdate }) =>
      apiClient
        .patch<OperatorBudget>(`/api/operator/budgets/${budgetId}`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

// ── Expenses ────────────────────────────────────────────────────────

export function useExpenses(communityId?: number, year?: number, month?: number) {
  return useQuery({
    queryKey: ["expenses", communityId, year, month],
    queryFn: () => {
      const params = new URLSearchParams();
      if (communityId) params.set("community_id", String(communityId));
      if (year) params.set("year", String(year));
      if (month) params.set("month", String(month));
      const qs = params.toString() ? `?${params.toString()}` : "";
      return apiClient
        .get<OperatingExpense[]>(`/api/operator/expenses${qs}`)
        .then((r) => r.data);
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseCreate) =>
      apiClient.post<OperatingExpense>("/api/operator/expenses", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: number; data: ExpenseUpdate }) =>
      apiClient
        .patch<OperatingExpense>(`/api/operator/expenses/${expenseId}`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

// ── Expense Summary ─────────────────────────────────────────────────

export function useExpenseSummary(communityId: number, year: number, quarter?: number) {
  return useQuery({
    queryKey: ["expense-summary", communityId, year, quarter],
    queryFn: () => {
      const params = new URLSearchParams({ year: String(year) });
      if (quarter) params.set("quarter", String(quarter));
      return apiClient
        .get<ExpenseSummary>(
          `/api/operator/communities/${communityId}/expense-summary?${params.toString()}`
        )
        .then((r) => r.data);
    },
    enabled: !!communityId && !!year,
  });
}
