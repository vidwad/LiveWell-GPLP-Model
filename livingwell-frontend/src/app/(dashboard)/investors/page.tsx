"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, TrendingUp } from "lucide-react";
import { useInvestors, useInvestorDashboard } from "@/hooks/useInvestors";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

export default function InvestorsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isInvestor = user?.role === "INVESTOR";

  // Investors see their own dashboard directly
  const { data: dashboard, isLoading: dashLoading } = useInvestorDashboard(
    isInvestor ? undefined : undefined
  );

  useEffect(() => {
    if (isInvestor && dashboard) {
      router.replace(`/investors/${dashboard.investor.investor_id}`);
    }
  }, [isInvestor, dashboard, router]);

  const { data: investors, isLoading } = useInvestors();
  const canCreate =
    user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  if (isInvestor) {
    return (
      <div className="flex items-center justify-center py-20">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investors</h1>
          <p className="text-muted-foreground">Manage LP investors and capital</p>
        </div>
        {canCreate && (
          <LinkButton href="/investors/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Investor
          </LinkButton>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : investors?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No investors yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {investors?.map((inv) => (
            <Link key={inv.investor_id} href={`/investors/${inv.investor_id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{inv.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{inv.email}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium">{inv.accredited_status}</span>
                    </div>
                    {inv.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{inv.phone}</span>
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
