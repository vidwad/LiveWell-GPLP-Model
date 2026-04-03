"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, TrendingUp, ArrowDownRight, ArrowUpRight,
  Building2, Calendar, RefreshCw, Banknote, Target,
  ChevronDown, ChevronUp, Percent, PiggyBank,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface PropertyIncomeIntegrationTabProps {
  lpId: number;
}

interface WaterfallData {
  gross_revenue: number;
  vacancy_loss: number;
  effective_gross_income: number;
  other_income: number;
  total_revenue: number;
  operating_expenses: number;
  noi: number;
  debt_service: number;
  cash_after_debt: number;
  management_fee: number;
  asset_management_fee: number;
  capital_reserves: number;
  total_lp_deductions: number;
  distributable_cash: number;
}

interface PropertyDetail {
  property_id: number;
  address: string;
  city: string;
  gross_revenue: number;
  vacancy_loss: number;
  other_income: number;
  operating_expenses: number;
  noi: number;
  debt_service: number;
  cash_after_debt: number;
}

interface DistributableCashData {
  lp_id: number;
  lp_name: string;
  property_count: number;
  waterfall: WaterfallData;
  fee_detail: { management_fee_percent: number; asset_management_fee_percent: number; capital_reserve_percent: number };
  properties: PropertyDetail[];
}

interface CapitalEvent {
  scenario_id: number;
  property_id: number;
  property_address: string;
  label: string;
  expected_date: string | null;
  net_proceeds: number;
  linked_event: string | null;
  [key: string]: any;
}

interface CapitalEventsData {
  refinance_events: CapitalEvent[];
  sale_events: CapitalEvent[];
  total_refinance_proceeds: number;
  total_sale_proceeds: number;
  total_capital_event_proceeds: number;
}

interface YearProjection {
  year: number;
  year_index: number;
  gross_revenue: number;
  vacancy_loss: number;
  other_income: number;
  effective_gross_income: number;
  operating_expenses: number;
  noi: number;
  debt_service: number;
  cash_after_debt: number;
  management_fee: number;
  asset_management_fee: number;
  capital_reserves: number;
  operating_distributable: number;
  refinance_proceeds: number;
  sale_proceeds: number;
  total_distributable: number;
  lp_distribution: number;
  gp_distribution: number;
  cumulative_lp_distributions: number;
  unreturned_capital: number;
  unpaid_preferred: number;
}

interface ReturnProjectionData {
  lp_id: number;
  lp_name: string;
  total_equity_invested: number;
  summary: {
    irr: number | null;
    equity_multiple: number;
    cash_on_cash_yield: number;
    total_lp_distributions: number;
    terminal_value: number;
    terminal_net_proceeds: number;
  };
  yearly_projections: YearProjection[];
}

const fmt = (v: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function PropertyIncomeIntegrationTab({ lpId }: PropertyIncomeIntegrationTabProps) {
  const [distributableData, setDistributableData] = useState<DistributableCashData | null>(null);
  const [capitalEventsData, setCapitalEventsData] = useState<CapitalEventsData | null>(null);
  const [returnData, setReturnData] = useState<ReturnProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPropertyBreakdown, setShowPropertyBreakdown] = useState(false);
  const [showProjectionTable, setShowProjectionTable] = useState(false);

  // Projection assumptions
  const [years, setYears] = useState(10);
  const [rentEsc, setRentEsc] = useState(3.0);
  const [expEsc, setExpEsc] = useState(2.5);
  const [vacRate, setVacRate] = useState(5.0);
  const [exitCap, setExitCap] = useState(5.5);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [distRes, capRes, retRes] = await Promise.all([
        apiClient.get(`/api/investment/lp/${lpId}/distributable-cash`),
        apiClient.get(`/api/investment/lp/${lpId}/capital-events`),
        apiClient.get(`/api/investment/lp/${lpId}/investor-return-projection?years=${years}&rent_escalation=${rentEsc}&expense_escalation=${expEsc}&vacancy_rate=${vacRate}&exit_cap_rate=${exitCap}`),
      ]);
      setDistributableData(distRes.data);
      setCapitalEventsData(capRes.data);
      setReturnData(retRes.data);
    } catch (e) {
      console.error("Failed to fetch LP bridge data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [lpId]);

  const runProjection = async () => {
    try {
      const res = await apiClient.get(`/api/investment/lp/${lpId}/investor-return-projection?years=${years}&rent_escalation=${rentEsc}&expense_escalation=${expEsc}&vacancy_rate=${vacRate}&exit_cap_rate=${exitCap}`);
      setReturnData(res.data);
    } catch (e) {
      console.error("Failed to run projection", e);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const wf = distributableData?.waterfall;
  const summary = returnData?.summary;

  return (
    <div className="space-y-6">
      {/* ── Section 1: Investor Return KPIs ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">IRR</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {summary.irr !== null ? `${summary.irr}%` : "N/A"}
              </div>
              <p className="text-xs text-blue-600 mt-1">Internal Rate of Return</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Equity Multiple</span>
              </div>
              <div className="text-2xl font-bold text-green-900">
                {summary.equity_multiple.toFixed(2)}x
              </div>
              <p className="text-xs text-green-600 mt-1">Total Return / Equity</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Percent className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Cash-on-Cash</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {fmtPct(summary.cash_on_cash_yield)}
              </div>
              <p className="text-xs text-purple-600 mt-1">Stabilized Annual Yield</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <PiggyBank className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Total LP Distributions</span>
              </div>
              <div className="text-2xl font-bold text-amber-900">
                {fmt(summary.total_lp_distributions)}
              </div>
              <p className="text-xs text-amber-600 mt-1">Cumulative over {years} years</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Section 2: Distributable Cash Waterfall ── */}
      {wf && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ArrowDownRight className="h-5 w-5 text-blue-600" />
                Distributable Cash Waterfall
              </CardTitle>
              <Badge variant="outline">{distributableData?.property_count} Properties</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {[
                { label: "Gross Property Revenue", value: wf.gross_revenue, indent: 0, bold: false, color: "text-foreground" },
                { label: "Less: Vacancy Loss", value: -wf.vacancy_loss, indent: 1, bold: false, color: "text-red-600" },
                { label: "Plus: Other Income", value: wf.other_income, indent: 1, bold: false, color: "text-green-600" },
                { label: "Effective Gross Income", value: wf.total_revenue, indent: 0, bold: true, color: "text-foreground", border: true },
                { label: "Less: Operating Expenses", value: -wf.operating_expenses, indent: 1, bold: false, color: "text-red-600" },
                { label: "Net Operating Income (NOI)", value: wf.noi, indent: 0, bold: true, color: "text-blue-700", border: true },
                { label: "Less: Debt Service", value: -wf.debt_service, indent: 1, bold: false, color: "text-red-600" },
                { label: "Cash After Debt Service", value: wf.cash_after_debt, indent: 0, bold: true, color: "text-foreground", border: true },
                { label: `Less: Management Fee (${distributableData?.fee_detail.management_fee_percent}%)`, value: -wf.management_fee, indent: 1, bold: false, color: "text-orange-600" },
                { label: `Less: Asset Mgmt Fee (${distributableData?.fee_detail.asset_management_fee_percent}%)`, value: -wf.asset_management_fee, indent: 1, bold: false, color: "text-orange-600" },
                { label: `Less: Capital Reserves (${distributableData?.fee_detail.capital_reserve_percent}%)`, value: -wf.capital_reserves, indent: 1, bold: false, color: "text-orange-600" },
                { label: "Distributable Cash", value: wf.distributable_cash, indent: 0, bold: true, color: wf.distributable_cash >= 0 ? "text-green-700" : "text-red-700", border: true, highlight: true },
              ].map((row, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center py-1.5 px-3 rounded ${row.highlight ? "bg-green-50 border border-green-200" : ""} ${row.border && !row.highlight ? "border-t" : ""}`}
                  style={{ paddingLeft: `${12 + row.indent * 24}px` }}
                >
                  <span className={`text-sm ${row.bold ? "font-semibold" : ""} ${row.color}`}>{row.label}</span>
                  <span className={`text-sm font-mono ${row.bold ? "font-semibold" : ""} ${row.color}`}>
                    {fmt(row.value)}
                  </span>
                </div>
              ))}
            </div>

            {/* Property Breakdown Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setShowPropertyBreakdown(!showPropertyBreakdown)}
            >
              {showPropertyBreakdown ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
              {showPropertyBreakdown ? "Hide" : "Show"} Per-Property Breakdown
            </Button>

            {showPropertyBreakdown && distributableData?.properties && (
              <div className="mt-3 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">OpEx</TableHead>
                      <TableHead className="text-right">NOI</TableHead>
                      <TableHead className="text-right">Debt Svc</TableHead>
                      <TableHead className="text-right">Cash Flow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributableData.properties.map((p) => (
                      <TableRow key={p.property_id}>
                        <TableCell className="font-medium">
                          <div>{p.address}</div>
                          <div className="text-xs text-muted-foreground">{p.city}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(p.gross_revenue)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-600">{fmt(p.operating_expenses)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-blue-600">{fmt(p.noi)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-600">{fmt(p.debt_service)}</TableCell>
                        <TableCell className={`text-right font-mono text-sm font-semibold ${p.cash_after_debt >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {fmt(p.cash_after_debt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Capital Events Timeline ── */}
      {capitalEventsData && (capitalEventsData.refinance_events.length > 0 || capitalEventsData.sale_events.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                Capital Events Timeline
              </CardTitle>
              <Badge className="bg-purple-100 text-purple-700">
                {fmt(capitalEventsData.total_capital_event_proceeds)} Total Proceeds
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Refinance Events */}
              {capitalEventsData.refinance_events.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" /> Refinance Events
                  </h4>
                  <div className="space-y-2">
                    {capitalEventsData.refinance_events.map((evt) => (
                      <div key={`refi-${evt.scenario_id}`} className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{evt.label}</span>
                            {evt.linked_event && <Badge variant="outline" className="text-xs">{evt.linked_event}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{evt.property_address}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-muted-foreground">{evt.expected_date || "TBD"}</div>
                          <div className={`font-mono font-semibold text-sm ${evt.net_proceeds >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {fmt(evt.net_proceeds)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sale Events */}
              {capitalEventsData.sale_events.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Disposition Events
                  </h4>
                  <div className="space-y-2">
                    {capitalEventsData.sale_events.map((evt) => (
                      <div key={`sale-${evt.scenario_id}`} className="flex items-center gap-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                        <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{evt.label}</span>
                            {evt.linked_event && <Badge variant="outline" className="text-xs">{evt.linked_event}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{evt.property_address}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-muted-foreground">{evt.expected_date || "TBD"}</div>
                          <div className={`font-mono font-semibold text-sm ${evt.net_proceeds >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {fmt(evt.net_proceeds)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 4: Multi-Year Investor Return Projection ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
              Multi-Year Investor Return Projection
            </CardTitle>
            {returnData && (
              <Badge className="bg-blue-100 text-blue-700">
                {fmt(returnData.total_equity_invested)} Equity Invested
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Assumptions Controls */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-xs">Projection Years</Label>
              <Input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} min={1} max={30} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Rent Escalation %</Label>
              <Input type="number" value={rentEsc} onChange={(e) => setRentEsc(Number(e.target.value))} step={0.5} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Expense Escalation %</Label>
              <Input type="number" value={expEsc} onChange={(e) => setExpEsc(Number(e.target.value))} step={0.5} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Vacancy Rate %</Label>
              <Input type="number" value={vacRate} onChange={(e) => setVacRate(Number(e.target.value))} step={0.5} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Exit Cap Rate %</Label>
              <Input type="number" value={exitCap} onChange={(e) => setExitCap(Number(e.target.value))} step={0.25} className="h-8 text-sm" />
            </div>
          </div>
          <Button onClick={runProjection} size="sm" className="mb-4">
            <RefreshCw className="h-4 w-4 mr-2" /> Run Projection
          </Button>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-xs text-muted-foreground">Terminal Value</div>
                <div className="text-lg font-bold">{fmt(summary.terminal_value)}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-xs text-muted-foreground">Terminal Net Proceeds</div>
                <div className="text-lg font-bold">{fmt(summary.terminal_net_proceeds)}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-xs text-muted-foreground">Total Equity Invested</div>
                <div className="text-lg font-bold">{fmt(returnData?.total_equity_invested || 0)}</div>
              </div>
            </div>
          )}

          {/* Projection Table Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowProjectionTable(!showProjectionTable)}
          >
            {showProjectionTable ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
            {showProjectionTable ? "Hide" : "Show"} Year-by-Year Projection
          </Button>

          {showProjectionTable && returnData?.yearly_projections && (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Year</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">NOI</TableHead>
                    <TableHead className="text-right">Debt Svc</TableHead>
                    <TableHead className="text-right">Op. Dist.</TableHead>
                    <TableHead className="text-right">Refi</TableHead>
                    <TableHead className="text-right">Sale</TableHead>
                    <TableHead className="text-right">LP Dist.</TableHead>
                    <TableHead className="text-right">GP Dist.</TableHead>
                    <TableHead className="text-right">Cumul. LP</TableHead>
                    <TableHead className="text-right">Unret. Cap.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnData.yearly_projections.map((yr) => (
                    <TableRow key={yr.year} className={yr.refinance_proceeds > 0 || yr.sale_proceeds > 0 ? "bg-purple-50" : ""}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{yr.year}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(yr.effective_gross_income)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-blue-600">{fmt(yr.noi)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-red-600">{fmt(yr.debt_service)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(yr.operating_distributable)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-purple-600">{yr.refinance_proceeds > 0 ? fmt(yr.refinance_proceeds) : "-"}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-600">{yr.sale_proceeds > 0 ? fmt(yr.sale_proceeds) : "-"}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-green-600">{fmt(yr.lp_distribution)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-orange-600">{fmt(yr.gp_distribution)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">{fmt(yr.cumulative_lp_distributions)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(yr.unreturned_capital)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
