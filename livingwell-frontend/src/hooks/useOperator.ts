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

// ── Unit Turnovers ───────────────────────────────────────────────────

export function useTurnovers(communityId?: number) {
  return useQuery({
    queryKey: ["turnovers", communityId],
    queryFn: () => {
      const qs = communityId ? `?community_id=${communityId}` : "";
      return apiClient.get(`/api/operator/turnovers${qs}`).then((r) => r.data);
    },
  });
}

export function useCreateTurnover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) =>
      apiClient.post("/api/operator/turnovers", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["turnovers"] }),
  });
}

export function useUpdateTurnover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      apiClient.patch(`/api/operator/turnovers/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["turnovers"] }),
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

// ── Staffing ───────────────────────────────────────────────────────

export interface StaffMember {
  staff_id: number;
  community_id: number;
  community_name: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  hourly_rate: number | null;
  hire_date: string | null;
  termination_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface StaffSummary {
  total_active: number;
  by_role: Record<string, number>;
  by_community: Record<string, number>;
  estimated_weekly_cost: number;
  estimated_monthly_cost: number;
}

export interface ShiftRecord {
  shift_id: number;
  staff_id: number;
  staff_name: string | null;
  staff_role: string | null;
  community_id: number;
  community_name: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  hours: number | null;
  status: string;
  notes: string | null;
  created_at: string | null;
}

export interface WeeklyScheduleSummary {
  week_start: string;
  week_end: string;
  total_shifts: number;
  total_hours: number;
  total_estimated_cost: number;
  staff: {
    staff_id: number;
    staff_name: string;
    role: string | null;
    total_shifts: number;
    total_hours: number;
    estimated_cost: number;
  }[];
}

export function useStaff(communityId?: number, status?: string) {
  return useQuery<StaffMember[]>({
    queryKey: ["staff", communityId, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (communityId) params.set("community_id", String(communityId));
      if (status) params.set("status", status);
      const qs = params.toString() ? `?${params}` : "";
      return apiClient.get<StaffMember[]>(`/api/operator/staff${qs}`).then((r) => r.data);
    },
  });
}

export function useStaffSummary(communityId?: number) {
  return useQuery<StaffSummary>({
    queryKey: ["staff-summary", communityId],
    queryFn: () => {
      const qs = communityId ? `?community_id=${communityId}` : "";
      return apiClient.get<StaffSummary>(`/api/operator/staff/summary${qs}`).then((r) => r.data);
    },
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post("/api/operator/staff", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });
    },
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, data }: { staffId: number; data: Record<string, unknown> }) =>
      apiClient.patch(`/api/operator/staff/${staffId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (staffId: number) =>
      apiClient.delete(`/api/operator/staff/${staffId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });
    },
  });
}

// ── Shifts / Scheduling ────────────────────────────────────────────

export function useShifts(params?: {
  community_id?: number;
  staff_id?: number;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery<ShiftRecord[]>({
    queryKey: ["shifts", params],
    queryFn: () => {
      const search = new URLSearchParams();
      if (params?.community_id) search.set("community_id", String(params.community_id));
      if (params?.staff_id) search.set("staff_id", String(params.staff_id));
      if (params?.start_date) search.set("start_date", params.start_date);
      if (params?.end_date) search.set("end_date", params.end_date);
      const qs = search.toString() ? `?${search}` : "";
      return apiClient.get<ShiftRecord[]>(`/api/operator/shifts${qs}`).then((r) => r.data);
    },
  });
}

export function useWeeklySchedule(communityId?: number, weekStart?: string) {
  return useQuery<WeeklyScheduleSummary>({
    queryKey: ["weekly-schedule", communityId, weekStart],
    queryFn: () => {
      const params = new URLSearchParams();
      if (communityId) params.set("community_id", String(communityId));
      if (weekStart) params.set("week_start", weekStart);
      return apiClient
        .get<WeeklyScheduleSummary>(`/api/operator/shifts/weekly-summary?${params}`)
        .then((r) => r.data);
    },
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post("/api/operator/shifts", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["weekly-schedule"] });
    },
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, data }: { shiftId: number; data: Record<string, unknown> }) =>
      apiClient.patch(`/api/operator/shifts/${shiftId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["weekly-schedule"] });
    },
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: number) =>
      apiClient.delete(`/api/operator/shifts/${shiftId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["weekly-schedule"] });
    },
  });
}
