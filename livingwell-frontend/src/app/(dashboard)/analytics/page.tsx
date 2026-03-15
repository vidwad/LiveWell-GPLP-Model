"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  BarChart3,
  Landmark,
  PieChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LPFundRow {
  lp_id: number;
  name: string;
  status: string;
  total_committed: number;
  total_funded: number;
  total_deployed: number;
  nav: number;
  nav_per_unit: number;
  property_count: number;
  investor_count: number;
}

interface PortfolioAnalytics {
  total_aum: number;
  total_committed: number;
  total_funded: number;
  total_deployed: number;
  total_nav: number;
  total_investors: number;
  total_properties: number;
  lp_count: number;
  blended_deployment_ratio: number;
  nav_premium_discount: number;
  lp_funds: LPFundRow[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmt = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KPI({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
          {sub && (
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  LP Fund Table                                                      */
/* ------------------------------------------------------------------ */

function LPFundTable({ funds }: { funds: LPFundRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Committed</th>
            <th className="px-4 py-3 text-right font-medium">Funded</th>
            <th className="px-4 py-3 text-right font-medium">Deployed</th>
            <th className="px-4 py-3 text-right font-medium">NAV</th>
            <th className="px-4 py-3 text-right font-medium">NAV/Unit</th>
            <th className="px-4 py-3 text-right font-medium">Properties</th>
            <th className="px-4 py-3 text-right font-medium">Investors</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {funds.map((f) => (
            <tr key={f.lp_id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{f.name}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    f.status === "active"
                      ? "bg-green-100 text-green-700"
                      : f.status === "fundraising"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {f.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(f.total_committed)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(f.total_funded)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(f.total_deployed)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(f.nav)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt(f.nav_per_unit)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{f.property_count}</td>
              <td className="px-4 py-3 text-right tabular-nums">{f.investor_count}</td>
            </tr>
          ))}
          {funds.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                No LP funds found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<PortfolioAnalytics>({
    queryKey: ["portfolio-analytics"],
    queryFn: () =>
      apiClient.get("/api/investment/portfolio-analytics").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const funds = data?.lp_funds ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Aggregate investment metrics across all LP funds and properties
        </p>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
          <KPI
            label="Total AUM"
            value={fmtCompact(data.total_aum)}
            icon={DollarSign}
          />
          <KPI
            label="Total Committed"
            value={fmtCompact(data.total_committed)}
            icon={Landmark}
          />
          <KPI
            label="Total Funded"
            value={fmtCompact(data.total_funded)}
            icon={TrendingUp}
          />
          <KPI
            label="Total Deployed"
            value={fmtCompact(data.total_deployed)}
            sub={`Deployment ratio: ${fmtPct(data.blended_deployment_ratio)}`}
            icon={BarChart3}
          />
          <KPI
            label="Total NAV"
            value={fmtCompact(data.total_nav)}
            sub={`Premium/Discount: ${data.nav_premium_discount >= 0 ? "+" : ""}${fmtPct(data.nav_premium_discount)}`}
            icon={PieChart}
          />
          <KPI
            label="Total Investors"
            value={String(data.total_investors)}
            icon={Users}
          />
          <KPI
            label="Total Properties"
            value={String(data.total_properties)}
            icon={Building2}
          />
          <KPI
            label="LP Funds"
            value={String(data.lp_count)}
            icon={Landmark}
          />
        </div>
      )}

      {/* LP Fund Detail */}
      <Tabs defaultValue="table">
        <TabsList variant="line">
          <TabsTrigger value="table">All LP Funds</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">LP Fund Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <LPFundTable funds={funds} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
