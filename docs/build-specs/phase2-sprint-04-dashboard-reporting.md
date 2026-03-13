# Phase 2 Sprint 4: Dashboard & Reporting Overhaul

> **Status:** Ready for Claude  
> **Depends on:** Phase 2 Sprint 3 (AI Decision Layer)  
> **Estimated effort:** Medium  

## Overview

This sprint overhauls the GP Admin dashboard and the Reports module to utilize the new calculation engines and LP-centric data model. It introduces:

1. **GP Portfolio Dashboard** — Aggregates NOI, DSCR, and LTV across all properties
2. **Fund Performance Report** — Rolls up property metrics to the LP level
3. **Frontend Dashboard Update** — Replaces dummy KPI cards with real calculated data

---

## Section A — Reporting Service

### File: `backend/app/services/reporting.py` (NEW FILE)

```python
from sqlalchemy.orm import Session
from app.db.models import Property, LPEntity, DebtFacility
from app.services.calculations import calculate_noi, calculate_annual_debt_service, calculate_ltv

def generate_fund_performance_report(db: Session) -> dict:
    """
    Generate a performance report rolled up by LP Entity.
    """
    lps = db.query(LPEntity).all()
    report = []

    for lp in lps:
        properties = db.query(Property).filter(Property.lp_id == lp.lp_id).all()
        
        total_value = 0.0
        total_debt = 0.0
        total_noi = 0.0
        total_debt_service = 0.0

        for prop in properties:
            # Value
            val = float(prop.estimated_value or prop.purchase_price or 0)
            total_value += val

            # Debt
            debts = db.query(DebtFacility).filter(
                DebtFacility.property_id == prop.property_id,
                DebtFacility.status == "active"
            ).all()
            
            prop_debt = sum(float(d.outstanding_balance or 0) for d in debts)
            total_debt += prop_debt

            for d in debts:
                if d.outstanding_balance and d.interest_rate:
                    ds = calculate_annual_debt_service(
                        float(d.outstanding_balance),
                        float(d.interest_rate),
                        d.amortization_months or 0,
                        d.io_period_months or 0
                    )
                    total_debt_service += ds

            # NOI (Estimate based on units if available)
            if prop.units:
                gross_rev = len(prop.units) * 1500 * 12
                noi_dict = calculate_noi(gross_potential_revenue=gross_rev, operating_expenses=gross_rev * 0.3)
                total_noi += noi_dict["noi"]

        # Fund level metrics
        fund_ltv = (total_debt / total_value * 100) if total_value > 0 else 0
        fund_dscr = (total_noi / total_debt_service) if total_debt_service > 0 else None

        report.append({
            "lp_id": lp.lp_id,
            "lp_name": lp.name,
            "property_count": len(properties),
            "total_value": round(total_value, 2),
            "total_debt": round(total_debt, 2),
            "total_equity": round(total_value - total_debt, 2),
            "total_noi": round(total_noi, 2),
            "portfolio_ltv": round(fund_ltv, 2),
            "portfolio_dscr": round(fund_dscr, 2) if fund_dscr else None
        })

    return {"funds": report}
```

---

## Section B — Reporting Routes

### File: `backend/app/routes/reports.py`

**Replace the entire file** with this:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User
from app.core.deps import require_gp_or_ops
from app.services.reporting import generate_fund_performance_report

router = APIRouter()

@router.get("/fund-performance")
def get_fund_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_gp_or_ops),
):
    """Get aggregated performance metrics rolled up by LP."""
    return generate_fund_performance_report(db)
```

---

## Section C — Frontend API & Hooks

### File: `livingwell-frontend/src/lib/api.ts`

**Add this to the `api` object** (inside the `reports` section if it exists, or create it):

```typescript
  reports: {
    getFundPerformance: () => api.get('/reports/fund-performance'),
  },
```

### File: `livingwell-frontend/src/hooks/useReports.ts` (NEW FILE)

```typescript
import { useQuery } from '@tanreact/query';
import api from '@/lib/api';

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
      const response = await api.reports.getFundPerformance();
      return response.data;
    },
  });
}
```

---

## Section D — Frontend Dashboard Update

### File: `livingwell-frontend/src/app/(dashboard)/dashboard/page.tsx`

**Replace the entire file** with this:

```tsx
'use client';

import { useProperties } from '@/hooks/usePortfolio';
import { useFundPerformance } from '@/hooks/useReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, DollarSign, Activity, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function DashboardPage() {
  const { data: properties } = useProperties();
  const { data: report } = useFundPerformance();

  const totalValue = report?.funds.reduce((sum, f) => sum + f.total_value, 0) || 0;
  const totalNOI = report?.funds.reduce((sum, f) => sum + f.total_noi, 0) || 0;
  const totalDebt = report?.funds.reduce((sum, f) => sum + f.total_debt, 0) || 0;
  const blendedLTV = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

  const chartData = report?.funds.map(f => ({
    name: f.lp_name.replace('Living Well ', '').replace(' LP', ''),
    Equity: f.total_equity,
    Debt: f.total_debt
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">GP Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide portfolio performance and metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalValue / 1000000).toFixed(2)}M</div>
            <p className="text-xs text-muted-foreground">Across {properties?.length || 0} properties</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Annual NOI</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalNOI / 1000).toFixed(1)}k</div>
            <p className="text-xs text-muted-foreground">Run-rate based on current occupancy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blended LTV</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blendedLTV.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Total Debt: ${(totalDebt / 1000000).toFixed(2)}M</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Funds</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report?.funds.length || 0}</div>
            <p className="text-xs text-muted-foreground">LP Entities under management</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Capital Stack by Fund</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `$${value / 1000000}M`} />
                  <Tooltip formatter={(value: number) => `$${(value / 1000000).toFixed(2)}M`} />
                  <Legend />
                  <Bar dataKey="Debt" stackId="a" fill="#94a3b8" />
                  <Bar dataKey="Equity" stackId="a" fill="#0f172a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Fund Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {report?.funds.map((fund) => (
                <div key={fund.lp_id} className="flex items-center">
                  <div className="ml-4 space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">{fund.lp_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {fund.property_count} Properties
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">LTV: {fund.portfolio_ltv.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">
                      DSCR: {fund.portfolio_dscr ? `${fund.portfolio_dscr.toFixed(2)}x` : 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Section E — Verification Checklist

1. Start backend and frontend
2. Login as `admin@livingwell.ca`
3. Test API: `GET /api/reports/fund-performance`
   - Should return an array of funds with aggregated value, debt, NOI, LTV, and DSCR
4. Navigate to the Dashboard in the frontend
5. Verify the 4 KPI cards show real calculated data (Total Value, NOI, Blended LTV, Active Funds)
6. Verify the Capital Stack bar chart renders correctly with Debt and Equity stacked
7. Verify the Fund Performance list shows LTV and DSCR for each fund
