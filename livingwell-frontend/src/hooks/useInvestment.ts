import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { investment } from "@/lib/api";
import type {
  LPCreate,
  LPTrancheCreate,
  SubscriptionCreate,
  Holding,
  TargetProperty,
  Investor as InvInvestor,
} from "@/types/investment";

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
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["tranches", v.lpId] });
      qc.invalidateQueries({ queryKey: ["lps", v.lpId] });
    },
  });
}

export function useUpdateTranche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      trancheId,
      lpId,
      data,
    }: {
      trancheId: number;
      lpId?: number;
      data: Partial<LPTrancheCreate>;
    }) => investment.updateTranche(trancheId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["tranches"] });
      if (v.lpId) qc.invalidateQueries({ queryKey: ["lps", v.lpId] });
    },
  });
}

// ── Investors ───────────────────────────────────────────────────────
export function useInvestors() {
  return useQuery({
    queryKey: ["inv-investors"],
    queryFn: () => investment.getInvestors(),
  });
}

export function useCreateInvestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InvInvestor>) => investment.createInvestor(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inv-investors"] }),
  });
}

export function useUpdateInvestor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InvInvestor> }) =>
      investment.updateInvestor(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inv-investors"] }),
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
      lpId,
      data,
    }: {
      subId: number;
      lpId?: number;
      data: Partial<SubscriptionCreate>;
    }) => investment.updateSubscription(subId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["tranches"] });
      qc.invalidateQueries({ queryKey: ["lps"] });
      if (v.lpId) {
        qc.invalidateQueries({ queryKey: ["subscriptions", v.lpId] });
        qc.invalidateQueries({ queryKey: ["lps", v.lpId] });
      }
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

export function useCreateHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lpId, data }: { lpId: number; data: Partial<Holding> }) =>
      investment.createHolding(lpId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["holdings", v.lpId] });
      qc.invalidateQueries({ queryKey: ["lps", v.lpId] });
    },
  });
}

export function useUpdateHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      holdingId,
      lpId,
      data,
    }: {
      holdingId: number;
      lpId?: number;
      data: Partial<Holding>;
    }) => investment.updateHolding(holdingId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["holdings"] });
      if (v.lpId) qc.invalidateQueries({ queryKey: ["lps", v.lpId] });
    },
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
      data: Partial<TargetProperty>;
    }) => investment.createTargetProperty(lpId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["target-properties", v.lpId] });
      qc.invalidateQueries({ queryKey: ["portfolio-rollup", v.lpId] });
      qc.invalidateQueries({ queryKey: ["lps", v.lpId] });
    },
  });
}

export function useUpdateTargetProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tpId,
      lpId,
      data,
    }: {
      tpId: number;
      lpId?: number;
      data: Partial<TargetProperty>;
    }) => investment.updateTargetProperty(tpId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["target-properties"] });
      qc.invalidateQueries({ queryKey: ["portfolio-rollup"] });
      if (v.lpId) {
        qc.invalidateQueries({ queryKey: ["target-properties", v.lpId] });
        qc.invalidateQueries({ queryKey: ["portfolio-rollup", v.lpId] });
      }
    },
  });
}

export function useDeleteTargetProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tpId }: { tpId: number; lpId?: number }) =>
      investment.deleteTargetProperty(tpId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["target-properties"] });
      qc.invalidateQueries({ queryKey: ["portfolio-rollup"] });
      if (v.lpId) {
        qc.invalidateQueries({ queryKey: ["target-properties", v.lpId] });
        qc.invalidateQueries({ queryKey: ["portfolio-rollup", v.lpId] });
      }
    },
  });
}

export function useConvertTargetProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tpId }: { tpId: number; lpId?: number }) =>
      investment.convertTargetProperty(tpId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["target-properties"] });
      qc.invalidateQueries({ queryKey: ["portfolio-rollup"] });
      qc.invalidateQueries({ queryKey: ["lps"] });
      if (v.lpId) {
        qc.invalidateQueries({ queryKey: ["target-properties", v.lpId] });
        qc.invalidateQueries({ queryKey: ["portfolio-rollup", v.lpId] });
        qc.invalidateQueries({ queryKey: ["lps", v.lpId] });
      }
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
