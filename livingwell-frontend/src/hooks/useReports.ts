import { useQuery } from "@tanstack/react-query";
import { apiClient, reports } from "@/lib/api";

export interface ReportSummary {
  // KPIs
  total_properties: number;
  total_communities: number;
  total_units: number;
  occupied_units: number;
  occupancy_rate: number;
  total_residents: number;
  total_investors: number;
  total_land_value: number;
  total_rent_collected: number;
  total_funded: number;
  total_contributed: number;
  total_distributed: number;
  net_invested: number;
  maintenance_resolution_rate: number;
  // Chart data
  stage_breakdown: { stage: string; count: number }[];
  community_type_breakdown: { type: string; count: number }[];
  community_occupancy: {
    name: string;
    total: number;
    occupied: number;
    vacant: number;
    rate: number;
  }[];
  monthly_revenue: { month: string; revenue: number }[];
  capital_timeline: { month: string; contributed: number }[];
  maintenance_by_status: { status: string; count: number }[];
}

export function useReportSummary() {
  return useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () =>
      apiClient.get<ReportSummary>("/api/reports/summary").then((r) => r.data),
    staleTime: 60_000,
  });
}

// ── Fund Performance ──────────────────────────────────────────────────

export interface FundPerformance {
  lp_id: number;
  lp_name: string;
  property_count: number;
  total_value: number;
  total_debt: number;
  total_equity: number;
  total_noi: number;
  portfolio_ltv: number;
  portfolio_dscr: number | null;
}

export interface FundPerformanceReport {
  funds: FundPerformance[];
}

export function useFundPerformance() {
  return useQuery<FundPerformanceReport, Error>({
    queryKey: ['reports', 'fund-performance'],
    queryFn: async () => {
      return await reports.getFundPerformance();
    },
  });
}

// ── Management Pack ───────────────────────────────────────────────────

export function useManagementPack() {
  return useQuery({
    queryKey: ["reports", "management-pack"],
    queryFn: () =>
      apiClient.get("/api/reports/management-pack").then((r) => r.data),
    staleTime: 60_000,
  });
}
