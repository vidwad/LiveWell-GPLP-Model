import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type {
  StageTransition,
  AllowedTransition,
  TransitionRequest,
  PropertyMilestone,
  MilestoneCreate,
  MilestoneUpdate,
  QuarterlyReport,
  QuarterlyReportCreate,
  QuarterlyReportUpdate,
  ETransferTracking,
  ETransferCreate,
  ETransferUpdate,
  MessageReply,
  MessageReplyCreate,
} from "@/types/lifecycle";

// ── Stage Transitions ───────────────────────────────────────────────

export function useStageTransitions(propertyId: number) {
  return useQuery({
    queryKey: ["transitions", propertyId],
    queryFn: () =>
      apiClient
        .get<StageTransition[]>(`/api/lifecycle/properties/${propertyId}/transitions`)
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function useAllowedTransitions(propertyId: number) {
  return useQuery({
    queryKey: ["allowed-transitions", propertyId],
    queryFn: () =>
      apiClient
        .get<AllowedTransition>(`/api/lifecycle/properties/${propertyId}/allowed-transitions`)
        .then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function useTransitionProperty(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TransitionRequest) =>
      apiClient
        .post<StageTransition>(`/api/lifecycle/properties/${propertyId}/transition`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transitions", propertyId] });
      qc.invalidateQueries({ queryKey: ["allowed-transitions", propertyId] });
      qc.invalidateQueries({ queryKey: ["properties", propertyId] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["milestones", propertyId] });
    },
  });
}

// ── Milestones ──────────────────────────────────────────────────────

export function useMilestones(propertyId: number, stage?: string) {
  return useQuery({
    queryKey: ["milestones", propertyId, stage],
    queryFn: () => {
      const params = stage ? `?stage=${stage}` : "";
      return apiClient
        .get<PropertyMilestone[]>(`/api/lifecycle/properties/${propertyId}/milestones${params}`)
        .then((r) => r.data);
    },
    enabled: !!propertyId,
  });
}

export function useCreateMilestone(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MilestoneCreate) =>
      apiClient
        .post<PropertyMilestone>(`/api/lifecycle/properties/${propertyId}/milestones`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", propertyId] }),
  });
}

export function useUpdateMilestone(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, data }: { milestoneId: number; data: MilestoneUpdate }) =>
      apiClient
        .patch<PropertyMilestone>(`/api/lifecycle/milestones/${milestoneId}`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", propertyId] }),
  });
}

// ── Quarterly Reports ───────────────────────────────────────────────

export function useQuarterlyReports(lpId: number) {
  return useQuery({
    queryKey: ["quarterly-reports", lpId],
    queryFn: () =>
      apiClient
        .get<QuarterlyReport[]>(`/api/lifecycle/lp/${lpId}/quarterly-reports`)
        .then((r) => r.data),
    enabled: !!lpId,
  });
}

export function useGenerateReport(lpId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QuarterlyReportCreate) =>
      apiClient
        .post<QuarterlyReport>(`/api/lifecycle/lp/${lpId}/quarterly-reports`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quarterly-reports", lpId] }),
  });
}

export function useUpdateReport(lpId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, data }: { reportId: number; data: QuarterlyReportUpdate }) =>
      apiClient
        .patch<QuarterlyReport>(`/api/lifecycle/quarterly-reports/${reportId}`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quarterly-reports", lpId] }),
  });
}

// ── eTransfer Tracking ──────────────────────────────────────────────

export function useETransfers(statusFilter?: string) {
  return useQuery({
    queryKey: ["etransfers", statusFilter],
    queryFn: () => {
      const params = statusFilter ? `?status_filter=${statusFilter}` : "";
      return apiClient
        .get<ETransferTracking[]>(`/api/lifecycle/etransfers${params}`)
        .then((r) => r.data);
    },
  });
}

export function useCreateETransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ETransferCreate) =>
      apiClient
        .post<ETransferTracking>("/api/lifecycle/etransfers", data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etransfers"] }),
  });
}

export function useUpdateETransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ etransferId, data }: { etransferId: number; data: ETransferUpdate }) =>
      apiClient
        .patch<ETransferTracking>(`/api/lifecycle/etransfers/${etransferId}`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etransfers"] }),
  });
}

// ── Message Threads ─────────────────────────────────────────────────

export function useMessageReplies(messageId: number) {
  return useQuery({
    queryKey: ["message-replies", messageId],
    queryFn: () =>
      apiClient
        .get<MessageReply[]>(`/api/lifecycle/messages/${messageId}/replies`)
        .then((r) => r.data),
    enabled: !!messageId,
  });
}

export function useCreateReply(messageId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MessageReplyCreate) =>
      apiClient
        .post<MessageReply>(`/api/lifecycle/messages/${messageId}/replies`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-replies", messageId] }),
  });
}
