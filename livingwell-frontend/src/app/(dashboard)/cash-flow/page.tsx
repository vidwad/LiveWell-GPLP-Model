"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Building2,
  Landmark,
  ArrowRight,
  Settings2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, cn } from "@/lib/utils";
import { useCashFlowProjection } from "@/hooks/useReports";
import { useFundPerformance } from "@/hooks/useReports";

function formatCompact(val: number) {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function CashFlowPage() {
  const [projectionYears, setProjectionYears] = useState(10);
  const [lpId, setLpId] = useState<number | undefined>(undefined);
  const [rentGrowth, setRentGrowth] = useState(3.0);
  const [expenseGrowth, setExpenseGrowth] = useState(2.5);
  const [vacancyRate, setVacancyRate] = useState(5.0);
  const [showSettings, setShowSettings] = useState(false);

  const { data: fundData } = useFundPerformance();
  const { data, isLoading } = useCashFlowProjection({
    projection_years: projectionYears,
    lp_id: lpId,
    rent_growth: rentGrowth,
    expense_growth: expenseGrowth,
    vacancy_rate: vacancyRate,
  });

  const chartData = useMemo(() => {
    if (!data?.projections) return [];
    return data.projections.map((p) => ({
      name: `Yr ${p.year}`,
      year: p.year,
      revenue: p.gross_revenue,
      expenses: p.operating_expenses + p.vacancy_loss,
      noi: p.noi,
      debtService: p.debt_service,
      cashFlow: p.net_cash_flow,
      cumulative: p.cumulative_cash_flow,
    }));
  }, [data]);

  const snapshot = data?.current_snapshot;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cash Flow Projections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Portfolio-wide projected revenue, expenses, and net cash flow
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* LP Filter */}
          {fundData?.funds && fundData.funds.length > 1 && (
            <Select
              value={lpId ? String(lpId) : "all"}
              onValueChange={(v) => setLpId(v === "all" ? undefined : Number(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Funds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Funds</SelectItem>
                {fundData.funds.map((f) => (
                  <SelectItem key={f.lp_id} value={String(f.lp_id)}>
                    {f.lp_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
              showSettings ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
            )}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4" />
            Assumptions
          </button>
        </div>
      </div>

      {/* Assumptions Panel */}
      {showSettings && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Projection Years</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={projectionYears}
                  onChange={(e) => setProjectionYears(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rent Growth (%/yr)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={rentGrowth}
                  onChange={(e) => setRentGrowth(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expense Growth (%/yr)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={expenseGrowth}
                  onChange={(e) => setExpenseGrowth(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vacancy Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={vacancyRate}
                  onChange={(e) => setVacancyRate(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <Badge variant="outline" className="text-xs">
                  Auto-updates on change
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : !data ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No properties found to project.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current Snapshot KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Properties</p>
                <p className="text-xl font-bold">{snapshot?.property_count ?? 0}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> In portfolio
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Annual NOI</p>
                <p className="text-xl font-bold text-green-700">
                  {formatCompact(snapshot?.total_noi ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Current year</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Debt Service</p>
                <p className="text-xl font-bold text-red-700">
                  {formatCompact(snapshot?.total_debt_service ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Annual</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Net Cash Flow</p>
                <p className={cn("text-xl font-bold", (snapshot?.total_cash_flow ?? 0) >= 0 ? "text-green-700" : "text-red-700")}>
                  {formatCompact(snapshot?.total_cash_flow ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">NOI less debt service</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Portfolio Value</p>
                <p className="text-xl font-bold">
                  {formatCompact(snapshot?.total_market_value ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Market value</p>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Projected Net Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => formatCompact(v)}
                  />
                  <Tooltip
                    formatter={(v: any) => formatCurrency(v as number)}
                    labelFormatter={(l) => `Year ${l.replace("Yr ", "")}`}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="cashFlow"
                    name="Net Cash Flow"
                    fill="#10b981"
                    fillOpacity={0.3}
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative"
                    fill="#3b82f6"
                    fillOpacity={0.15}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue vs Expenses vs Debt Service */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue, NOI & Debt Service Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
                  <Legend />
                  <Bar dataKey="noi" name="NOI" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="debtService" name="Debt Service" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="cashFlow" name="Net Cash Flow" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Year-by-Year Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Year-by-Year Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Gross Revenue</TableHead>
                      <TableHead className="text-right">Vacancy Loss</TableHead>
                      <TableHead className="text-right">Operating Exp.</TableHead>
                      <TableHead className="text-right">NOI</TableHead>
                      <TableHead className="text-right">Debt Service</TableHead>
                      <TableHead className="text-right">Net Cash Flow</TableHead>
                      <TableHead className="text-right">Cumulative</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.projections.map((row) => (
                      <TableRow key={row.year}>
                        <TableCell className="font-medium">Year {row.year}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.gross_revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">({formatCurrency(row.vacancy_loss)})</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">({formatCurrency(row.operating_expenses)})</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-green-700">{formatCurrency(row.noi)}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">({formatCurrency(row.debt_service)})</TableCell>
                        <TableCell className={cn("text-right tabular-nums font-bold", row.net_cash_flow >= 0 ? "text-green-700" : "text-red-700")}>
                          {formatCurrency(row.net_cash_flow)}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", row.cumulative_cash_flow >= 0 ? "text-blue-600" : "text-red-600")}>
                          {formatCurrency(row.cumulative_cash_flow)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Per-Property Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Property-Level Cash Flow (Current)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Property</TableHead>
                      <TableHead>Fund</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Market Value</TableHead>
                      <TableHead className="text-right">NOI</TableHead>
                      <TableHead className="text-right">Debt Service</TableHead>
                      <TableHead className="text-right">Cash Flow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.properties.map((prop) => (
                      <TableRow key={prop.property_id}>
                        <TableCell className="font-medium">{prop.address}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{prop.lp_name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {prop.stage.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(prop.market_value)}</TableCell>
                        <TableCell className="text-right tabular-nums text-green-700">{formatCurrency(prop.current_noi)}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">
                          {prop.current_ads > 0 ? `(${formatCurrency(prop.current_ads)})` : "—"}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums font-medium", prop.current_cash_flow >= 0 ? "text-green-700" : "text-red-700")}>
                          {formatCurrency(prop.current_cash_flow)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
