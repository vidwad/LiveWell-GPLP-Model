"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  DollarSign,
  TrendingUp,
  Shield,
  BarChart3,
  PieChart,
  Landmark,
  BedDouble,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface PortfolioAnalyticsTabProps {
  lpId: number;
}

interface PropertySummary {
  property_id: number;
  address: string;
  city: string;
  province: string;
  stage: string;
  property_type: string;
  community_name: string;
  zoning: string;
  annual_revenue: number;
  annual_expenses: number;
  noi: number;
  market_value: number;
  purchase_price: number;
  debt_balance: number;
  annual_debt_service: number;
  cap_rate: number;
  dscr: number;
  ltv: number;
  units: number;
  beds: number;
  sqft: number;
}

interface ConsolidatedData {
  total_revenue: number;
  total_expenses: number;
  total_noi: number;
  total_market_value: number;
  total_purchase_price: number;
  total_debt_balance: number;
  total_annual_debt_service: number;
  total_units: number;
  total_beds: number;
  total_sqft: number;
  portfolio_dscr: number;
  portfolio_ltv: number;
  portfolio_debt_yield: number;
  portfolio_cap_rate: number;
  portfolio_expense_ratio: number;
  breakeven_occupancy: number;
  noi_per_unit: number;
  value_per_unit: number;
  debt_per_unit: number;
  portfolio_appreciation: number;
}

interface DiversificationEntry {
  count: number;
  market_value: number;
  noi: number;
  units: number;
  beds: number;
  pct_of_value: number;
  pct_of_noi: number;
}

interface CashflowYear {
  year: number;
  gross_revenue: number;
  vacancy_loss: number;
  effective_revenue: number;
  operating_expenses: number;
  noi: number;
  debt_service: number;
  cash_flow_before_tax: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtX = (n: number) => `${n.toFixed(2)}x`;

function HealthBadge({ value, thresholds, format = "pct" }: { value: number; thresholds: [number, number]; format?: "pct" | "x" }) {
  const isHighGood = thresholds[0] < thresholds[1];
  let color = "bg-red-100 text-red-700";
  if (isHighGood) {
    if (value >= thresholds[1]) color = "bg-green-100 text-green-700";
    else if (value >= thresholds[0]) color = "bg-yellow-100 text-yellow-700";
  } else {
    if (value <= thresholds[0]) color = "bg-green-100 text-green-700";
    else if (value <= thresholds[1]) color = "bg-yellow-100 text-yellow-700";
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {format === "x" ? fmtX(value) : fmtPct(value)}
    </span>
  );
}

export function PortfolioAnalyticsTab({ lpId }: PortfolioAnalyticsTabProps) {
  const [financials, setFinancials] = useState<{
    property_count: number;
    properties: PropertySummary[];
    consolidated: ConsolidatedData;
    diversification: {
      by_city: Record<string, DiversificationEntry>;
      by_stage: Record<string, DiversificationEntry>;
      by_property_type: Record<string, DiversificationEntry>;
      by_community: Record<string, DiversificationEntry>;
    };
  } | null>(null);

  const [cashflow, setCashflow] = useState<{
    assumptions: { rent_escalation: number; expense_escalation: number; vacancy_rate: number; projection_years: number };
    consolidated_years: CashflowYear[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [cfLoading, setCfLoading] = useState(false);
  const [showPropertyTable, setShowPropertyTable] = useState(false);
  const [activeDiversification, setActiveDiversification] = useState<"city" | "stage" | "type" | "community">("city");

  // Cash flow assumptions
  const [cfYears, setCfYears] = useState(10);
  const [cfRentEsc, setCfRentEsc] = useState(3.0);
  const [cfExpEsc, setCfExpEsc] = useState(2.5);
  const [cfVacancy, setCfVacancy] = useState(5.0);

  const fetchFinancials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/investment/lp/${lpId}/consolidated-financials`);
      setFinancials(res.data);
    } catch (err) {
      console.error("Failed to fetch consolidated financials", err);
    } finally {
      setLoading(false);
    }
  }, [lpId]);

  const fetchCashflow = useCallback(async () => {
    setCfLoading(true);
    try {
      const res = await apiClient.get(`/api/investment/lp/${lpId}/consolidated-cashflow`, {
        params: {
          years: cfYears,
          rent_escalation: cfRentEsc,
          expense_escalation: cfExpEsc,
          vacancy_rate: cfVacancy,
        },
      });
      setCashflow(res.data);
    } catch (err) {
      console.error("Failed to fetch consolidated cashflow", err);
    } finally {
      setCfLoading(false);
    }
  }, [lpId, cfYears, cfRentEsc, cfExpEsc, cfVacancy]);

  useEffect(() => {
    fetchFinancials();
    fetchCashflow();
  }, [fetchFinancials, fetchCashflow]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading portfolio analytics...</div>;
  }

  if (!financials || financials.property_count === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No properties assigned to this LP yet. Add properties to see portfolio analytics.
        </CardContent>
      </Card>
    );
  }

  const c = financials.consolidated;
  const div = financials.diversification;

  const diversificationData = {
    city: div.by_city,
    stage: div.by_stage,
    type: div.by_property_type,
    community: div.by_community,
  };

  const activeDiv = diversificationData[activeDiversification];

  // Color palette for diversification bars
  const barColors = [
    "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-orange-500",
  ];

  return (
    <div className="space-y-6">
      {/* ── Portfolio Health KPIs ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Portfolio DSCR</div>
            <div className="text-2xl font-bold">{fmtX(c.portfolio_dscr)}</div>
            <HealthBadge value={c.portfolio_dscr} thresholds={[1.1, 1.25]} format="x" />
            <div className="text-[10px] text-muted-foreground mt-1">Min 1.10x CMHC / 1.20x Conv</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Portfolio LTV</div>
            <div className="text-2xl font-bold">{fmtPct(c.portfolio_ltv)}</div>
            <HealthBadge value={c.portfolio_ltv} thresholds={[75, 85]} />
            <div className="text-[10px] text-muted-foreground mt-1">Max 75% Conv / 85% CMHC</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Debt Yield</div>
            <div className="text-2xl font-bold">{fmtPct(c.portfolio_debt_yield)}</div>
            <HealthBadge value={c.portfolio_debt_yield} thresholds={[8, 10]} />
            <div className="text-[10px] text-muted-foreground mt-1">NOI / Total Debt</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Break-Even Occupancy</div>
            <div className="text-2xl font-bold">{fmtPct(c.breakeven_occupancy)}</div>
            <HealthBadge value={c.breakeven_occupancy} thresholds={[85, 92]} />
            <div className="text-[10px] text-muted-foreground mt-1">(Expenses + DS) / Revenue</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Consolidated Financial Summary ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Revenue & NOI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross Revenue</span><span className="font-medium">{fmt(c.total_revenue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Operating Expenses</span><span className="font-medium text-red-600">({fmt(c.total_expenses)})</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="font-medium">Net Operating Income</span><span className="font-bold text-green-600">{fmt(c.total_noi)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Debt Service</span><span className="font-medium text-red-600">({fmt(c.total_annual_debt_service)})</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="font-medium">Cash Flow Before Tax</span><span className="font-bold">{fmt(c.total_noi - c.total_annual_debt_service)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Portfolio Valuation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Market Value</span><span className="font-bold text-blue-600">{fmt(c.total_market_value)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Purchase Price</span><span className="font-medium">{fmt(c.total_purchase_price)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Appreciation</span><span className={`font-medium ${c.portfolio_appreciation >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtPct(c.portfolio_appreciation)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Debt</span><span className="font-medium">{fmt(c.total_debt_balance)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="font-medium">Equity (Value - Debt)</span><span className="font-bold">{fmt(c.total_market_value - c.total_debt_balance)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* ── Per-Unit Metrics ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Properties</div>
            <div className="text-xl font-bold">{financials.property_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Total Units</div>
            <div className="text-xl font-bold">{c.total_units}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Total Beds</div>
            <div className="text-xl font-bold">{c.total_beds}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">NOI / Unit</div>
            <div className="text-xl font-bold">{fmt(c.noi_per_unit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Value / Unit</div>
            <div className="text-xl font-bold">{fmt(c.value_per_unit)}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Diversification Analysis ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <PieChart className="h-4 w-4" /> Diversification Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {(["city", "stage", "type", "community"] as const).map((key) => (
              <Button
                key={key}
                variant={activeDiversification === key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveDiversification(key)}
              >
                {key === "city" ? "By City" : key === "stage" ? "By Stage" : key === "type" ? "By Type" : "By Community"}
              </Button>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{activeDiversification === "city" ? "City" : activeDiversification === "stage" ? "Stage" : activeDiversification === "type" ? "Property Type" : "Community"}</TableHead>
                <TableHead className="text-right">Properties</TableHead>
                <TableHead className="text-right">Market Value</TableHead>
                <TableHead className="text-right">% of Value</TableHead>
                <TableHead className="text-right">NOI</TableHead>
                <TableHead className="text-right">% of NOI</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Beds</TableHead>
                <TableHead>Concentration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(activeDiv)
                .sort((a, b) => b[1].market_value - a[1].market_value)
                .map(([key, data], idx) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{key}</TableCell>
                    <TableCell className="text-right">{data.count}</TableCell>
                    <TableCell className="text-right">{fmt(data.market_value)}</TableCell>
                    <TableCell className="text-right">{fmtPct(data.pct_of_value)}</TableCell>
                    <TableCell className="text-right">{fmt(data.noi)}</TableCell>
                    <TableCell className="text-right">{fmtPct(data.pct_of_noi)}</TableCell>
                    <TableCell className="text-right">{data.units}</TableCell>
                    <TableCell className="text-right">{data.beds}</TableCell>
                    <TableCell>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${barColors[idx % barColors.length]}`}
                          style={{ width: `${Math.min(data.pct_of_value, 100)}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Consolidated Cash Flow Projection ─────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Consolidated Cash Flow Projection
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchCashflow} disabled={cfLoading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${cfLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Assumptions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-xs">Projection Years</Label>
              <Input
                type="number"
                value={cfYears}
                onChange={(e) => setCfYears(Number(e.target.value))}
                min={1}
                max={30}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Rent Escalation (%)</Label>
              <Input
                type="number"
                value={cfRentEsc}
                onChange={(e) => setCfRentEsc(Number(e.target.value))}
                step={0.5}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Expense Escalation (%)</Label>
              <Input
                type="number"
                value={cfExpEsc}
                onChange={(e) => setCfExpEsc(Number(e.target.value))}
                step={0.5}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Vacancy Rate (%)</Label>
              <Input
                type="number"
                value={cfVacancy}
                onChange={(e) => setCfVacancy(Number(e.target.value))}
                step={0.5}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {cashflow && cashflow.consolidated_years.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10">Year</TableHead>
                    {cashflow.consolidated_years.map((yr) => (
                      <TableHead key={yr.year} className="text-right min-w-[100px]">Yr {yr.year}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium">Gross Revenue</TableCell>
                    {cashflow.consolidated_years.map((yr) => (
                      <TableCell key={yr.year} className="text-right text-xs">{fmt(yr.gross_revenue)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium text-red-600">Vacancy Loss</TableCell>
                    {cashflow.consolidated_years.map((yr) => (
                      <TableCell key={yr.year} className="text-right text-xs text-red-600">({fmt(yr.vacancy_loss)})</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-gray-50">
                    <TableCell className="sticky left-0 bg-gray-50 z-10 font-medium">Effective Revenue</TableCell>
                    {cashflow.consolidated_years.map((yr) => (
                      <TableCell key={yr.year} className="text-right text-xs font-medium">{fmt(yr.effective_revenue)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium text-red-600">Operating Expenses</TableCell>
                    {cashflow.consolidated_years.map((yr) => (
                      <TableCell key={yr.year} className="text-right text-xs text-red-600">({fmt(yr.operating_expenses)})</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-green-50 font-bold">
                    <TableCell className="sticky left-0 bg-green-50 z-10 font-bold text-green-700">NOI</TableCell>
                    {cashflow.consolidated_years.map((yr) => (
                      <TableCell key={yr.year} className="text-right text-xs font-bold text-green-700">{fmt(yr.noi)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium text-red-600">Debt Service</TableCell>
                    {cashflow.consolidated_years.map((yr) => (
                      <TableCell key={yr.year} className="text-right text-xs text-red-600">({fmt(yr.debt_service)})</TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-blue-50 font-bold">
                    <TableCell className="sticky left-0 bg-blue-50 z-10 font-bold text-blue-700">Cash Flow (Pre-Tax)</TableCell>
                    {cashflow.consolidated_years.map((yr) => (
                      <TableCell key={yr.year} className="text-right text-xs font-bold text-blue-700">{fmt(yr.cash_flow_before_tax)}</TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              {cfLoading ? "Loading projections..." : "No projection data available."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Per-Property Breakdown ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Per-Property Financial Summary
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPropertyTable(!showPropertyTable)}
            >
              {showPropertyTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showPropertyTable ? "Collapse" : "Expand"}
            </Button>
          </div>
        </CardHeader>
        {showPropertyTable && (
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10">Property</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">NOI</TableHead>
                    <TableHead className="text-right">Market Value</TableHead>
                    <TableHead className="text-right">Debt</TableHead>
                    <TableHead className="text-right">Cap Rate</TableHead>
                    <TableHead className="text-right">DSCR</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Beds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financials.properties.map((p) => (
                    <TableRow key={p.property_id}>
                      <TableCell className="sticky left-0 bg-white z-10 font-medium text-xs max-w-[200px] truncate">{p.address}</TableCell>
                      <TableCell className="text-xs">{p.city}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{p.stage}</Badge></TableCell>
                      <TableCell className="text-right text-xs">{fmt(p.annual_revenue)}</TableCell>
                      <TableCell className="text-right text-xs text-red-600">{fmt(p.annual_expenses)}</TableCell>
                      <TableCell className="text-right text-xs font-medium text-green-600">{fmt(p.noi)}</TableCell>
                      <TableCell className="text-right text-xs text-blue-600">{fmt(p.market_value)}</TableCell>
                      <TableCell className="text-right text-xs">{fmt(p.debt_balance)}</TableCell>
                      <TableCell className="text-right text-xs">{fmtPct(p.cap_rate)}</TableCell>
                      <TableCell className="text-right text-xs">
                        <HealthBadge value={p.dscr} thresholds={[1.1, 1.25]} format="x" />
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <HealthBadge value={p.ltv} thresholds={[75, 85]} />
                      </TableCell>
                      <TableCell className="text-right text-xs">{p.units}</TableCell>
                      <TableCell className="text-right text-xs">{p.beds}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-gray-100 font-bold">
                    <TableCell className="sticky left-0 bg-gray-100 z-10 font-bold">PORTFOLIO TOTAL</TableCell>
                    <TableCell></TableCell>
                    <TableCell><Badge className="text-[10px]">{financials.property_count} props</Badge></TableCell>
                    <TableCell className="text-right text-xs font-bold">{fmt(c.total_revenue)}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-red-600">{fmt(c.total_expenses)}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-green-600">{fmt(c.total_noi)}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-blue-600">{fmt(c.total_market_value)}</TableCell>
                    <TableCell className="text-right text-xs font-bold">{fmt(c.total_debt_balance)}</TableCell>
                    <TableCell className="text-right text-xs font-bold">{fmtPct(c.portfolio_cap_rate)}</TableCell>
                    <TableCell className="text-right text-xs">
                      <HealthBadge value={c.portfolio_dscr} thresholds={[1.1, 1.25]} format="x" />
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <HealthBadge value={c.portfolio_ltv} thresholds={[75, 85]} />
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold">{c.total_units}</TableCell>
                    <TableCell className="text-right text-xs font-bold">{c.total_beds}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
