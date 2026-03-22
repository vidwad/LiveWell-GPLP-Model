"use client";

import React from "react";
import { MapPin, DollarSign, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyLookup } from "@/components/property/PropertyLookup";
import { formatCurrencyCompact, formatDate } from "@/lib/utils";
import type { DevelopmentPlan } from "@/types/portfolio";

interface OverviewTabProps {
  property: Record<string, any>;
  activePlan: DevelopmentPlan | undefined;
  totalDebtCommitment: number;
  totalDebtOutstanding: number;
  debtFacilitiesCount: number;
}

export function OverviewTab({
  property,
  activePlan,
  totalDebtCommitment,
  totalDebtOutstanding,
  debtFacilitiesCount,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Property Details */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Property Details
              </CardTitle>
              <PropertyLookup
                address={property.address}
                city={property.city}
              />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-0 text-sm">
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Address</dt>
                <dd className="font-medium text-right">{property.address}, {property.city}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Province</dt>
                <dd className="font-medium text-right">{property.province}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Zoning</dt>
                <dd className="font-medium text-right">{property.zoning ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Lot Size</dt>
                <dd className="font-medium text-right">{property.lot_size ? `${Number(property.lot_size).toLocaleString()} sqft` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Max Buildable</dt>
                <dd className="font-medium text-right">{property.max_buildable_area ? `${Number(property.max_buildable_area).toLocaleString()} sqft` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Floor Area Ratio</dt>
                <dd className="font-medium text-right">{property.floor_area_ratio ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2.5">
                <dt className="text-muted-foreground shrink-0">Purchase Date</dt>
                <dd className="font-medium text-right">{property.purchase_date ? formatDate(property.purchase_date) : "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Financial Snapshot */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Financial Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-0 text-sm">
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Purchase Price</dt>
                <dd className="font-medium text-right tabular-nums whitespace-nowrap">{property.purchase_price ? formatCurrencyCompact(property.purchase_price) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Assessed Value</dt>
                <dd className="font-medium text-right tabular-nums whitespace-nowrap">{property.assessed_value ? formatCurrencyCompact(property.assessed_value) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Market Value</dt>
                <dd className="font-medium text-right text-blue-600 tabular-nums whitespace-nowrap">{property.current_market_value ? formatCurrencyCompact(property.current_market_value) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Total Debt</dt>
                <dd className="font-medium text-right tabular-nums whitespace-nowrap">{totalDebtCommitment > 0 ? formatCurrencyCompact(totalDebtCommitment) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                <dt className="text-muted-foreground shrink-0">Outstanding</dt>
                <dd className="font-medium text-right text-amber-600 tabular-nums whitespace-nowrap">{totalDebtOutstanding > 0 ? formatCurrencyCompact(totalDebtOutstanding) : "$0"}</dd>
              </div>
              {activePlan && (
                <>
                  <div className="flex justify-between gap-4 py-2.5 border-b border-dashed">
                    <dt className="text-muted-foreground shrink-0">Construction Cost</dt>
                    <dd className="font-medium text-right tabular-nums whitespace-nowrap">{activePlan.estimated_construction_cost ? formatCurrencyCompact(activePlan.estimated_construction_cost) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground shrink-0">Annual NOI</dt>
                    <dd className="font-semibold text-right text-green-600 tabular-nums whitespace-nowrap">{activePlan.projected_annual_noi ? formatCurrencyCompact(activePlan.projected_annual_noi) : "—"}</dd>
                  </div>
                </>
              )}
              {!activePlan && (
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Development Plan</dt>
                  <dd className="text-muted-foreground italic">No active plan</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Development Plan Summary (if exists) */}
      {activePlan && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Active Development Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Units</p>
                <p className="text-lg font-bold">{activePlan.planned_units}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Beds</p>
                <p className="text-lg font-bold">{activePlan.planned_beds}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sqft</p>
                <p className="text-lg font-bold">{Number(activePlan.planned_sqft).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cost / sqft</p>
                <p className="text-lg font-bold">{activePlan.cost_per_sqft ? `$${Number(activePlan.cost_per_sqft).toFixed(0)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-lg font-bold">{activePlan.development_start_date ? formatDate(activePlan.development_start_date) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completion</p>
                <p className="text-lg font-bold">{activePlan.estimated_completion_date ? formatDate(activePlan.estimated_completion_date) : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
