import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

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
