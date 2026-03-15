import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { investors } from "@/lib/api";
import type { InvestorCreate, WaterfallInput } from "@/types/investor";

export function useInvestors() {
  return useQuery({
    queryKey: ["investors"],
    queryFn: () => investors.getAll(),
  });
}

export function useInvestorSummaries() {
  return useQuery({
    queryKey: ["investor-summaries"],
    queryFn: () => investors.getSummaries(),
  });
}

export function useInvestor(id: number) {
  return useQuery({
    queryKey: ["investors", id],
    queryFn: () => investors.get(id),
    enabled: !!id,
  });
}

export function useInvestorDashboard(id?: number) {
  return useQuery({
    queryKey: ["investor-dashboard", id],
    queryFn: () => investors.getDashboard(id),
  });
}

export function useCreateInvestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InvestorCreate) => investors.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investors"] }),
  });
}

export function useInvestorSubscriptions(investorId: number) {
  return useQuery({
    queryKey: ["investor-subscriptions", investorId],
    queryFn: () => investors.getSubscriptions(investorId),
    enabled: !!investorId,
  });
}

export function useInvestorDocuments(investorId: number) {
  return useQuery({
    queryKey: ["investor-documents", investorId],
    queryFn: () => investors.getDocuments(investorId),
    enabled: !!investorId,
  });
}

export function useInvestorMessages(investorId: number) {
  return useQuery({
    queryKey: ["investor-messages", investorId],
    queryFn: () => investors.getMessages(investorId),
    enabled: !!investorId,
  });
}

export function useInvestorDistributions(investorId: number) {
  return useQuery({
    queryKey: ["investor-distributions", investorId],
    queryFn: () => investors.getDistributions(investorId),
    enabled: !!investorId,
  });
}

export function useCalculateWaterfall() {
  return useMutation({
    mutationFn: (data: WaterfallInput) => investors.calculateWaterfall(data),
  });
}
