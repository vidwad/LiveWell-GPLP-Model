import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Property,
  PropertyCreate,
  DevelopmentPlan,
  DevelopmentPlanCreate,
  DevelopmentPlanUpdate,
  ModelingInput,
  ModelingResult,
} from "@/types/portfolio";

function unwrapPaginated<T>(data: { items: T[]; total: number } | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data.items;
}

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: () =>
      apiClient.get("/api/portfolio/properties").then((r) => unwrapPaginated<Property>(r.data)),
  });
}

export function usePropertiesByLp(lpId: number) {
  return useQuery({
    queryKey: ["properties", "lp", lpId],
    queryFn: () =>
      apiClient.get("/api/portfolio/properties", { params: { lp_id: lpId } }).then((r) => unwrapPaginated<Property>(r.data)),
    enabled: !!lpId,
  });
}

export function useProperty(id: number) {
  return useQuery({
    queryKey: ["properties", id],
    queryFn: () =>
      apiClient.get<Property>(`/api/portfolio/properties/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PropertyCreate) =>
      apiClient.post<Property>("/api/portfolio/properties", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  });
}

export function useUpdateProperty(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PropertyCreate>) =>
      apiClient.patch<Property>(`/api/portfolio/properties/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["properties", id] });
    },
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/portfolio/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  });
}

export function useDevelopmentPlans(propertyId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["plans", propertyId],
    queryFn: () =>
      apiClient
        .get<DevelopmentPlan[]>(`/api/portfolio/properties/${propertyId}/plans`)
        .then((r) => r.data),
    enabled: (options?.enabled ?? true) && !!propertyId,
  });
}

export function useCreatePlan(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DevelopmentPlanCreate) =>
      apiClient
        .post<DevelopmentPlan>(`/api/portfolio/properties/${propertyId}/plans`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans", propertyId] }),
  });
}

export function useUpdatePlan(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, data }: { planId: number; data: DevelopmentPlanUpdate }) =>
      apiClient
        .patch<DevelopmentPlan>(`/api/portfolio/plans/${planId}`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans", propertyId] });
      qc.invalidateQueries({ queryKey: ["rent-roll", propertyId] });
    },
  });
}

export function useDeletePlan(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: number) =>
      apiClient.delete(`/api/portfolio/plans/${planId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans", propertyId] });
      qc.invalidateQueries({ queryKey: ["rent-roll", propertyId] });
    },
  });
}

export function useRunModel() {
  return useMutation({
    mutationFn: (input: ModelingInput) =>
      apiClient
        .post<ModelingResult>("/api/portfolio/model", input)
        .then((r) => r.data),
  });
}

export function usePortfolioReturns() {
  return useQuery({
    queryKey: ["portfolio-returns"],
    queryFn: () =>
      apiClient.get("/api/portfolio/metrics/returns").then((r) => r.data),
  });
}

// ── Debt Facilities ───────────────────────────────────────────────────────

export function useDebtFacilities(propertyId: number) {
  return useQuery({
    queryKey: ["debt", propertyId],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/properties/${propertyId}/debt`)
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function useAmortizationSchedule(
  propertyId: number,
  debtId: number | null,
  years = 10
) {
  return useQuery({
    queryKey: ["amortization", propertyId, debtId, years],
    queryFn: () =>
      apiClient
        .get(
          `/api/portfolio/properties/${propertyId}/debt/${debtId}/amortization?years=${years}`
        )
        .then((r) => r.data),
    enabled: !!propertyId && !!debtId,
  });
}

export function useCreateDebtFacility(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: object) =>
      apiClient
        .post(`/api/portfolio/debt-facilities`, { ...input, property_id: propertyId })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt", propertyId] });
    },
  });
}

export function useUpdateDebtFacility(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, ...input }: { debtId: number; [key: string]: unknown }) =>
      apiClient
        .patch(`/api/portfolio/debt-facilities/${debtId}`, input)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt", propertyId] });
    },
  });
}

// ── Projections ───────────────────────────────────────────────────────────

export function useRunProjection(propertyId: number) {
  return useMutation({
    mutationFn: (input: object) =>
      apiClient
        .post(`/api/portfolio/properties/${propertyId}/projection`, input)
        .then((r) => r.data),
  });
}

// ── Refinance Scenarios ───────────────────────────────────────────────────

export function useRefinanceScenarios(propertyId: number) {
  return useQuery({
    queryKey: ["refinance-scenarios", propertyId],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/properties/${propertyId}/refinance-scenarios`)
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function useCreateRefinanceScenario(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) =>
      apiClient
        .post(
          `/api/portfolio/properties/${propertyId}/refinance-scenarios`,
          data
        )
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["refinance-scenarios", propertyId] }),
  });
}

export function useDeleteRefinanceScenario(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: number) =>
      apiClient.delete(`/api/portfolio/refinance-scenarios/${scenarioId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["refinance-scenarios", propertyId] }),
  });
}

// ── Sale Scenarios ────────────────────────────────────────────────────────

export function useSaleScenarios(propertyId: number) {
  return useQuery({
    queryKey: ["sale-scenarios", propertyId],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/properties/${propertyId}/sale-scenarios`)
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function useCreateSaleScenario(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) =>
      apiClient
        .post(`/api/portfolio/properties/${propertyId}/sale-scenarios`, data)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["sale-scenarios", propertyId] }),
  });
}

export function useDeleteSaleScenario(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: number) =>
      apiClient.delete(`/api/portfolio/sale-scenarios/${scenarioId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["sale-scenarios", propertyId] }),
  });
}


// ---------------------------------------------------------------------------
// Units & Beds
// ---------------------------------------------------------------------------

export function usePropertyUnits(propertyId: number) {
  return useQuery({
    queryKey: ["property-units", propertyId],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/properties/${propertyId}/units`)
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function usePropertyUnitSummary(propertyId: number) {
  return useQuery({
    queryKey: ["property-unit-summary", propertyId],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/properties/${propertyId}/unit-summary`)
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function useCreatePropertyUnit(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) =>
      apiClient
        .post(`/api/portfolio/properties/${propertyId}/units`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property-units", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-unit-summary", propertyId] });
    },
  });
}

export function useUpdatePropertyUnit(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, data }: { unitId: number; data: object }) =>
      apiClient
        .patch(`/api/portfolio/properties/${propertyId}/units/${unitId}`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property-units", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-unit-summary", propertyId] });
    },
  });
}

export function useDeletePropertyUnit(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unitId: number) =>
      apiClient.delete(`/api/portfolio/properties/${propertyId}/units/${unitId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property-units", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-unit-summary", propertyId] });
    },
  });
}

// Rent Roll — returns full dual-phase response with pre_development, post_development, comparison, escalation
export function useRentRoll(propertyId: number) {
  return useQuery({
    queryKey: ["rent-roll", propertyId],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/properties/${propertyId}/rent-roll`)
        .then((r) => r.data),
    enabled: propertyId > 0,
  });
}

export function useUpdateRentPricingMode(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: string) =>
      apiClient.patch(`/api/portfolio/properties/${propertyId}/rent-pricing-mode`, null, { params: { mode } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rent-roll", propertyId] });
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
    },
  });
}

export function useUpdateAnnualRentIncrease(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pct: number) =>
      apiClient.patch(`/api/portfolio/properties/${propertyId}`, { annual_rent_increase_pct: pct }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rent-roll", propertyId] });
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
    },
  });
}

export function useUpdateBed(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bedId, data }: { bedId: number; data: object }) =>
      apiClient.patch(`/api/portfolio/beds/${bedId}`, null, { params: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rent-roll", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-units", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-unit-summary", propertyId] });
    },
  });
}

export function useCreateBed(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, data }: { unitId: number; data: object }) =>
      apiClient
        .post(`/api/portfolio/properties/${propertyId}/units/${unitId}/beds`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rent-roll", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-units", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-unit-summary", propertyId] });
    },
  });
}

export function useDeleteBed(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bedId: number) =>
      apiClient.delete(`/api/portfolio/beds/${bedId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rent-roll", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-units", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-unit-summary", propertyId] });
    },
  });
}
