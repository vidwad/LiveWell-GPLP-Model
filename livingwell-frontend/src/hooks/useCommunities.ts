import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Community,
  Unit,
  Resident,
  RentPayment,
  MaintenanceRequest,
  MaintenanceStatus,
} from "@/types/community";

export function useCommunities() {
  return useQuery({
    queryKey: ["communities"],
    queryFn: () =>
      apiClient.get<Community[]>("/api/community/communities").then((r) => r.data),
  });
}

export function useCommunity(id: number) {
  return useQuery({
    queryKey: ["communities", id],
    queryFn: () =>
      apiClient.get<Community>(`/api/community/communities/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Community, "community_id">) =>
      apiClient.post<Community>("/api/community/communities", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communities"] }),
  });
}

export function useUnits(communityId: number) {
  return useQuery({
    queryKey: ["units", communityId],
    queryFn: () =>
      apiClient
        .get<Unit[]>(`/api/community/communities/${communityId}/units`)
        .then((r) => r.data),
    enabled: !!communityId,
  });
}

export function useCreateUnit(communityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Unit, "unit_id" | "community_id" | "is_occupied">) =>
      apiClient
        .post<Unit>(`/api/community/communities/${communityId}/units`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units", communityId] }),
  });
}

export function useCommunityProperties(communityId: number) {
  return useQuery({
    queryKey: ["community-properties", communityId],
    queryFn: () =>
      apiClient
        .get(`/api/community/communities/${communityId}/properties`)
        .then((r) => r.data),
    enabled: !!communityId,
  });
}

export function useResidents(communityId: number) {
  return useQuery({
    queryKey: ["residents", communityId],
    queryFn: () =>
      apiClient
        .get<Resident[]>(`/api/community/communities/${communityId}/residents`)
        .then((r) => r.data),
    enabled: !!communityId,
  });
}

export function useCreateResident(communityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Resident, "resident_id" | "community_id">) =>
      apiClient
        .post<Resident>(`/api/community/communities/${communityId}/residents`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residents", communityId] });
      qc.invalidateQueries({ queryKey: ["units", communityId] });
    },
  });
}

export function useDeleteResident(communityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (residentId: number) =>
      apiClient.delete(`/api/community/residents/${residentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["residents", communityId] });
      qc.invalidateQueries({ queryKey: ["units", communityId] });
    },
  });
}

export function useRecordPayment(residentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      amount: number;
      payment_date: string;
      period_month: number;
      period_year: number;
      status?: string;
    }) =>
      apiClient
        .post<RentPayment>(
          `/api/community/residents/${residentId}/payments`,
          data
        )
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["residents"] }),
  });
}

export function useMaintenanceRequests() {
  return useQuery({
    queryKey: ["maintenance"],
    queryFn: () =>
      apiClient
        .get<MaintenanceRequest[]>("/api/community/maintenance")
        .then((r) => r.data),
  });
}

export function useCreateMaintenanceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      property_id: number;
      description: string;
      resident_id?: number;
    }) =>
      apiClient
        .post<MaintenanceRequest>("/api/community/maintenance", data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

export function useUpdateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: MaintenanceStatus }) =>
      apiClient
        .patch<MaintenanceRequest>(`/api/community/maintenance/${id}`, { status })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}
