"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Landmark,
  TrendingUp,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const fmt = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
};

const fmtPct = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `${Number(n).toFixed(2)}%`;
};

const fmtX = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `${Number(n).toFixed(2)}x`;
};

function HealthBadge({ health }: { health: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    strong: { color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3 w-3" /> },
    healthy: { color: "bg-green-50 text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> },
    adequate: { color: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="h-3 w-3" /> },
    tight: { color: "bg-orange-100 text-orange-800", icon: <AlertTriangle className="h-3 w-3" /> },
    distressed: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
    no_debt: { color: "bg-gray-100 text-gray-600", icon: <Shield className="h-3 w-3" /> },
  };
  const c = config[health] || config.no_debt;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      {c.icon} {health.replace(/_/g, " ")}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const config: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    conservative: "bg-green-50 text-green-700",
    moderate: "bg-yellow-100 text-yellow-800",
    elevated: "bg-orange-100 text-orange-800",
    high: "bg-red-100 text-red-800",
    unknown: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config[risk] || config.unknown}`}>
      {risk}
    </span>
  );
}

interface LenderUnderwritingSectionProps {
  propertyId: number;
}

export function LenderUnderwritingSection({ propertyId }: LenderUnderwritingSectionProps) {
  const [vacancyRate, setVacancyRate] = useState(5.0);
  const [capRate, setCapRate] = useState(5.5);
  const [showDetail, setShowDetail] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["underwriting-summary", propertyId, vacancyRate, capRate],
    queryFn: () =>
      apiClient
        .get(`/api/portfolio/properties/${propertyId}/underwriting-summary`, {
          params: { vacancy_rate: vacancyRate, cap_rate: capRate },
        })
        .then((r) => r.data),
    enabled: !!propertyId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Lender Underwriting Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Lender Underwriting Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No data available. Add units, beds, and debt facilities to generate underwriting metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-blue-600" />
            Lender Underwriting Summary
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs whitespace-nowrap">Vacancy %</Label>
              <Input
                type="number"
                step={0.5}
                min={0}
                max={100}
                className="h-7 w-16 text-xs"
                value={vacancyRate}
                onChange={(e) => setVacancyRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs whitespace-nowrap">Cap Rate %</Label>
              <Input
                type="number"
                step={0.25}
                min={0}
                className="h-7 w-16 text-xs"
                value={capRate}
                onChange={(e) => setCapRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">DSCR</p>
            <p className="text-xl font-bold text-blue-700">{fmtX(data.dscr)}</p>
            <HealthBadge health={data.dscr_health} />
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">LTV</p>
            <p className="text-xl font-bold text-amber-700">{fmtPct(data.ltv)}</p>
            <RiskBadge risk={data.ltv_risk} />
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Debt Yield</p>
            <p className="text-xl font-bold text-purple-700">{fmtPct(data.debt_yield)}</p>
            <span className="text-xs text-muted-foreground">NOI / Loan</span>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Break-Even Occ.</p>
            <p className="text-xl font-bold text-green-700">{fmtPct(data.break_even_occupancy)}</p>
            <span className="text-xs text-muted-foreground">
              {data.break_even_occupancy && data.break_even_occupancy < 85 ? "Healthy" : data.break_even_occupancy && data.break_even_occupancy < 95 ? "Tight" : "Risky"}
            </span>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">NOI</p>
            <p className="text-sm font-bold">{fmt(data.noi)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">NOI / Unit</p>
            <p className="text-sm font-bold">{fmt(data.noi_per_unit)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Value / Suite</p>
            <p className="text-sm font-bold">{fmt(data.value_per_suite)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Loan / Suite</p>
            <p className="text-sm font-bold">{fmt(data.loan_per_suite)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Expense Ratio</p>
            <p className="text-sm font-bold">{fmtPct(data.expense_ratio)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Implied Value</p>
            <p className="text-sm font-bold">{fmt(data.implied_value_at_cap)}</p>
          </div>
        </div>

        {/* CMHC Info */}
        {data.cmhc_insured_loans && data.cmhc_insured_loans.length > 0 && (
          <div className="border rounded-lg p-3 bg-purple-50/30 border-purple-200">
            <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5 mb-2">
              <Shield className="h-3.5 w-3.5" />
              CMHC Insured Loans
            </p>
            <div className="space-y-2">
              {data.cmhc_insured_loans.map((loan: any) => (
                <div key={loan.debt_id} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{loan.lender_name}</span>
                  <div className="flex items-center gap-3">
                    {loan.cmhc_program && <Badge variant="outline" className="text-xs">{loan.cmhc_program}</Badge>}
                    <span>Premium: {fmtPct(loan.insurance_premium_pct)}</span>
                    <span>Amount: {fmt(loan.insurance_premium_amount)}</span>
                    <span>Cap. Fees: {fmt(loan.capitalized_fees)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Detail */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setShowDetail(!showDetail)}
        >
          {showDetail ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
          {showDetail ? "Hide" : "Show"} Detailed Breakdown
        </Button>

        {showDetail && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {/* Revenue */}
                <tr className="bg-muted/50">
                  <td colSpan={2} className="py-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Revenue
                  </td>
                </tr>
                <tr className="border-t"><td className="py-1.5 px-3">Gross Potential Rent</td><td className="py-1.5 px-3 text-right font-medium tabular-nums">{fmt(data.gross_potential_rent)}</td></tr>
                <tr className="border-t"><td className="py-1.5 px-3">Ancillary Revenue</td><td className="py-1.5 px-3 text-right font-medium tabular-nums">{fmt(data.ancillary_revenue)}</td></tr>
                <tr className="border-t"><td className="py-1.5 px-3">Gross Potential Revenue</td><td className="py-1.5 px-3 text-right font-bold tabular-nums">{fmt(data.gross_potential_revenue)}</td></tr>
                <tr className="border-t"><td className="py-1.5 px-3 text-red-600">Less: Vacancy ({fmtPct(data.vacancy_rate)})</td><td className="py-1.5 px-3 text-right font-medium tabular-nums text-red-600">({fmt(data.vacancy_loss)})</td></tr>
                <tr className="border-t bg-green-50"><td className="py-1.5 px-3 font-semibold">Effective Gross Income</td><td className="py-1.5 px-3 text-right font-bold tabular-nums">{fmt(data.effective_gross_income)}</td></tr>

                {/* Expenses */}
                <tr className="bg-muted/50">
                  <td colSpan={2} className="py-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Operating Expenses
                  </td>
                </tr>
                {data.expense_breakdown?.map((item: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="py-1.5 px-3 text-red-600">{item.description || item.category.replace(/_/g, " ")}</td>
                    <td className="py-1.5 px-3 text-right font-medium tabular-nums text-red-600">({fmt(item.annual_amount)})</td>
                  </tr>
                ))}
                <tr className="border-t bg-red-50"><td className="py-1.5 px-3 font-semibold text-red-700">Total Operating Expenses</td><td className="py-1.5 px-3 text-right font-bold tabular-nums text-red-700">({fmt(data.total_operating_expenses)})</td></tr>

                {/* NOI */}
                <tr className="bg-green-100">
                  <td className="py-2 px-3 font-bold text-green-800">Net Operating Income (NOI)</td>
                  <td className="py-2 px-3 text-right font-bold text-lg tabular-nums text-green-800">{fmt(data.noi)}</td>
                </tr>

                {/* Debt Service */}
                <tr className="bg-muted/50">
                  <td colSpan={2} className="py-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Debt Service
                  </td>
                </tr>
                <tr className="border-t"><td className="py-1.5 px-3">Total Debt Outstanding</td><td className="py-1.5 px-3 text-right font-medium tabular-nums">{fmt(data.total_debt)}</td></tr>
                <tr className="border-t"><td className="py-1.5 px-3 text-red-600">Annual Debt Service</td><td className="py-1.5 px-3 text-right font-medium tabular-nums text-red-600">({fmt(data.annual_debt_service)})</td></tr>
                <tr className="border-t bg-blue-50"><td className="py-1.5 px-3 font-semibold">Cash Flow After Debt</td><td className="py-1.5 px-3 text-right font-bold tabular-nums">{fmt(data.cash_flow_after_debt)}</td></tr>

                {/* Scale */}
                <tr className="bg-muted/50">
                  <td colSpan={2} className="py-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Property Scale
                  </td>
                </tr>
                <tr className="border-t"><td className="py-1.5 px-3">Total Units</td><td className="py-1.5 px-3 text-right font-medium">{data.total_units}</td></tr>
                <tr className="border-t"><td className="py-1.5 px-3">Total Beds</td><td className="py-1.5 px-3 text-right font-medium">{data.total_beds}</td></tr>
                <tr className="border-t"><td className="py-1.5 px-3">Total SqFt</td><td className="py-1.5 px-3 text-right font-medium">{data.total_sqft?.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
