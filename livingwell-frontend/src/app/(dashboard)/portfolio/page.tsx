"use client";

import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { useProperties } from "@/hooks/usePortfolio";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DevelopmentStage } from "@/types/portfolio";

const STAGE_COLORS: Record<DevelopmentStage, string> = {
  acquisition: "bg-blue-100 text-blue-800",
  planning: "bg-yellow-100 text-yellow-800",
  construction: "bg-orange-100 text-orange-800",
  operational: "bg-green-100 text-green-800",
};

export default function PortfolioPage() {
  const { data: properties, isLoading } = useProperties();
  const { user } = useAuth();
  const canCreate =
    user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">Manage properties and development plans</p>
        </div>
        {canCreate && (
          <LinkButton href="/portfolio/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </LinkButton>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : properties?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No properties yet</p>
          {canCreate && (
            <LinkButton href="/portfolio/new" className="mt-4">Add your first property</LinkButton>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties?.map((p) => (
            <Link key={p.property_id} href={`/portfolio/${p.property_id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                      {p.address}
                    </CardTitle>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[p.development_stage]}`}
                    >
                      {p.development_stage}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.city}, {p.province}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Price</span>
                      <span className="font-medium">
                        {formatCurrency(p.purchase_price)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Date</span>
                      <span>{formatDate(p.purchase_date)}</span>
                    </div>
                    {p.zoning && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Zoning</span>
                        <Badge variant="outline">{p.zoning}</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
