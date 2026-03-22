"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Building2,
  TrendingUp,
  DollarSign,
  Shield,
  Landmark,
  GitCompare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { useCrossLPComparison } from "@/hooks/useReports";
import { usePortfolioReturns } from "@/hooks/usePortfolio";

const FUND_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function formatCompact(val: number) {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function LPComparisonPage() {
  const { data: perfData, isLoading: perfLoading } = useCrossLPComparison();
  const { data: returnsData, isLoading: returnsLoading } = usePortfolioReturns();

  const isLoading = perfLoading || returnsLoading;
  const funds = perfData?.funds ?? [];
  const returns = returnsData?.funds ?? [];

  // Merge perf + returns data
  const mergedFunds = useMemo(() => {
    return funds.map((f: Record<string, unknown>, idx: number) => {
      const ret = returns.find((r: Record<string, unknown>) => r.lp_id === f.lp_id);
      return {
        ...f,
        color: FUND_COLORS[idx % FUND_COLORS.length],
        xirr: ret?.xirr_percent ?? null,
        equity_multiple: ret?.equity_multiple ?? null,
        total_invested: ret?.total_invested_capital ?? 0,
        total_distributed: ret?.total_distributions ?? 0,
        investor_count: ret?.investor_count ?? 0,
      };
    });
  }, [funds, returns]);

  // Chart data
  const valueChart = mergedFunds.map((f: Record<string, unknown>) => ({
    name: f.lp_name as string,
    "Portfolio Value": f.total_value as number,
    "Total Debt": f.total_debt as number,
    Equity: f.total_equity as number,
  }));

  const performanceChart = mergedFunds.map((f: Record<string, unknown>) => ({
    name: f.lp_name as string,
    NOI: f.total_noi as number,
    "Cash Flow": f.projected_annual_cash_flow as number,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (mergedFunds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Cross-LP Comparison</h1>
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <GitCompare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No LP funds found to compare.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cross-LP Comparison</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Side-by-side comparison of all LP fund performance metrics
        </p>
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fund Comparison Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[180px] sticky left-0 bg-muted/50">Metric</TableHead>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableHead key={f.lp_id as number} className="text-center min-w-[140px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: f.color as string }}
                        />
                        {f.lp_name as string}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Properties</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums font-bold">{f.property_count as number}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Portfolio Value</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums">{formatCompact(f.total_value as number)}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Total Debt</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums text-red-600">{formatCompact(f.total_debt as number)}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Equity</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums text-green-600">{formatCompact(f.total_equity as number)}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Annual NOI</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums text-green-700">{formatCompact(f.total_noi as number)}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Cash Flow</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className={cn("text-center tabular-nums font-bold", (f.projected_annual_cash_flow as number) >= 0 ? "text-green-700" : "text-red-700")}>
                      {formatCompact(f.projected_annual_cash_flow as number)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">LTV</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums">
                      {f.portfolio_ltv ? `${(f.portfolio_ltv as number).toFixed(1)}%` : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">DSCR</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums">
                      {f.portfolio_dscr ? `${(f.portfolio_dscr as number).toFixed(2)}x` : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">XIRR</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums font-bold text-blue-600">
                      {f.xirr !== null ? `${(f.xirr as number).toFixed(1)}%` : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Equity Multiple</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums font-bold">
                      {f.equity_multiple !== null ? `${(f.equity_multiple as number).toFixed(2)}x` : "—"}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium sticky left-0 bg-background">Investors</TableCell>
                  {mergedFunds.map((f: Record<string, unknown>) => (
                    <TableCell key={f.lp_id as number} className="text-center tabular-nums">{f.investor_count as number}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio Value & Capital Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={valueChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="Portfolio Value" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Total Debt" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Equity" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">NOI & Cash Flow Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="NOI" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Cash Flow" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
