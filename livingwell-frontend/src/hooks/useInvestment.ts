import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { investment } from "@/lib/api";
import type { LPCreate } from "@/types/investment";

export function useGPs() {
  return useQuery({
    queryKey: ["gps"],
    queryFn: () => investment.getGPs(),
  });
}

export function useLPs() {
  return useQuery({
    queryKey: ["lps"],
    queryFn: () => investment.getLPs(),
  });
}

export function useLP(id: number) {
  return useQuery({
    queryKey: ["lps", id],
    queryFn: () => investment.getLP(id),
    enabled: !!id,
  });
}

export function useCreateLP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LPCreate) => investment.createLP(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lps"] }),
  });
}

export function useSubscriptions(lpId: number) {
  return useQuery({
    queryKey: ["subscriptions", lpId],
    queryFn: () => investment.getSubscriptions(lpId),
    enabled: !!lpId,
  });
}

export function useHoldings(lpId: number) {
  return useQuery({
    queryKey: ["holdings", lpId],
    queryFn: () => investment.getHoldings(lpId),
    enabled: !!lpId,
  });
}

export function useDistributionEvents(lpId: number) {
  return useQuery({
    queryKey: ["distributions", lpId],
    queryFn: () => investment.getDistributions(lpId),
    enabled: !!lpId,
  });
}
