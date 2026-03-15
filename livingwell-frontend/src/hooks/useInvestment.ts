import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { investment } from "@/lib/api";
import type { LPCreate, LPTrancheCreate, SubscriptionCreate } from "@/types/investment";

// ── GP ──────────────────────────────────────────────────────────────
export function useGPs() {
  return useQuery({
    queryKey: ["gps"],
    queryFn: () => investment.getGPs(),
  });
}

// ── LP ──────────────────────────────────────────────────────────────
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

export function useUpdateLP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LPCreate> }) =>
      investment.updateLP(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["lps"] });
      qc.invalidateQueries({ queryKey: ["lps", v.id] });
    },
  });
}

// ── Tranches ────────────────────────────────────────────────────────
export function useTranches(lpId: number) {
  return useQuery({
    queryKey: ["tranches", lpId],
    queryFn: () => investment.getTranches(lpId),
    enabled: !!lpId,
  });
}

export function useCreateTranche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lpId, data }: { lpId: number; data: LPTrancheCreate }) =>
      investment.createTranche(lpId, data),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["tranches", v.lpId] }),
  });
}

export function useUpdateTranche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      trancheId,
      data,
    }: {
      trancheId: number;
      data: Partial<LPTrancheCreate>;
    }) => investment.updateTranche(trancheId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tranches"] }),
  });
}

// ── Investors ───────────────────────────────────────────────────────
export function useInvestors() {
  return useQuery({
    queryKey: ["inv-investors"],
    queryFn: () => investment.getInvestors(),
  });
}

// ── Subscriptions ───────────────────────────────────────────────────
export function useSubscriptions(lpId: number) {
  return useQuery({
    queryKey: ["subscriptions", lpId],
    queryFn: () => investment.getSubscriptions(lpId),
    enabled: !!lpId,
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lpId, data }: { lpId: number; data: SubscriptionCreate }) =>
      investment.createSubscription(lpId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["subscriptions", v.lpId] });
      qc.invalidateQueries({ queryKey: ["tranches", v.lpId] });
      qc.invalidateQueries({ queryKey: ["lps", v.lpId] });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      subId,
      data,
    }: {
      subId: number;
      data: Partial<SubscriptionCreate>;
    }) => investment.updateSubscription(subId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["tranches"] });
      qc.invalidateQueries({ queryKey: ["lps"] });
    },
  });
}

// ── Holdings ────────────────────────────────────────────────────────
export function useHoldings(lpId: number) {
  return useQuery({
    queryKey: ["holdings", lpId],
    queryFn: () => investment.getHoldings(lpId),
    enabled: !!lpId,
  });
}

// ── Target Properties ───────────────────────────────────────────────
export function useTargetProperties(lpId: number) {
  return useQuery({
    queryKey: ["target-properties", lpId],
    queryFn: () => investment.getTargetProperties(lpId),
    enabled: !!lpId,
  });
}

export function useCreateTargetProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lpId,
      data,
    }: {
      lpId: number;
      data: Partial<import("@/types/investment").TargetProperty>;
    }) => investment.createTargetProperty(lpId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["target-properties", v.lpId] });
      qc.invalidateQueries({ queryKey: ["portfolio-rollup", v.lpId] });
    },
  });
}

// ── Portfolio Roll-up ───────────────────────────────────────────────
export function usePortfolioRollup(lpId: number) {
  return useQuery({
    queryKey: ["portfolio-rollup", lpId],
    queryFn: () => investment.getPortfolioRollup(lpId),
    enabled: !!lpId,
  });
}

// ── Distribution Events ─────────────────────────────────────────────
export function useDistributionEvents(lpId: number) {
  return useQuery({
    queryKey: ["distributions", lpId],
    queryFn: () => investment.getDistributions(lpId),
    enabled: !!lpId,
  });
}
