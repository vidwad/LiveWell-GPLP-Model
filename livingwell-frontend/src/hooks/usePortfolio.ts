import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Property,
  PropertyCreate,
  DevelopmentPlan,
  DevelopmentPlanCreate,
  ModelingInput,
  ModelingResult,
} from "@/types/portfolio";

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: () =>
      apiClient.get<Property[]>("/api/portfolio/properties").then((r) => r.data),
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

export function useDevelopmentPlans(propertyId: number) {
  return useQuery({
    queryKey: ["plans", propertyId],
    queryFn: () =>
      apiClient
        .get<DevelopmentPlan[]>(`/api/portfolio/properties/${propertyId}/plans`)
        .then((r) => r.data),
    enabled: !!propertyId,
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

export function useRunModel() {
  return useMutation({
    mutationFn: (input: ModelingInput) =>
      apiClient
        .post<ModelingResult>("/api/portfolio/model", input)
        .then((r) => r.data),
  });
}
