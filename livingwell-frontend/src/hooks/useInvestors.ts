import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Investor,
  Contribution,
  Ownership,
  Distribution,
  InvestorDashboard,
} from "@/types/investor";

export function useInvestors() {
  return useQuery({
    queryKey: ["investors"],
    queryFn: () =>
      apiClient.get<Investor[]>("/api/investor/investors").then((r) => r.data),
  });
}

export function useInvestor(id: number) {
  return useQuery({
    queryKey: ["investors", id],
    queryFn: () =>
      apiClient.get<Investor>(`/api/investor/investors/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useInvestorDashboard(id?: number) {
  return useQuery({
    queryKey: ["investor-dashboard", id],
    queryFn: () => {
      const url = id
        ? `/api/investor/investors/${id}/dashboard`
        : "/api/investor/dashboard";
      return apiClient.get<InvestorDashboard>(url).then((r) => r.data);
    },
  });
}

export function useCreateInvestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Investor, "investor_id">) =>
      apiClient.post<Investor>("/api/investor/investors", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investors"] }),
  });
}

export function useAddContribution(investorId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; date: string; notes?: string }) =>
      apiClient
        .post<Contribution>(`/api/investor/investors/${investorId}/contributions`, data)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["investor-dashboard", investorId] }),
  });
}

export function useAddOwnership(investorId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { property_id?: number; ownership_percent: number }) =>
      apiClient
        .post<Ownership>(`/api/investor/investors/${investorId}/ownership`, data)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["investor-dashboard", investorId] }),
  });
}

export function useContributions(investorId: number) {
  return useQuery({
    queryKey: ["contributions", investorId],
    queryFn: () =>
      apiClient
        .get<Contribution[]>(`/api/investor/investors/${investorId}/contributions`)
        .then((r) => r.data),
    enabled: !!investorId,
  });
}

export function useDistributions() {
  return useQuery({
    queryKey: ["distributions"],
    queryFn: () =>
      apiClient.get<Distribution[]>("/api/investor/distributions").then((r) => r.data),
  });
}

export function useCreateDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      investor_id: number;
      amount: number;
      payment_date: string;
      method: string;
      notes?: string;
    }) =>
      apiClient
        .post<Distribution>("/api/investor/distributions", data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distributions"] });
      qc.invalidateQueries({ queryKey: ["investor-dashboard"] });
    },
  });
}
