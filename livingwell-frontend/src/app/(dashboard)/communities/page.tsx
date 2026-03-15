"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { useCommunities } from "@/hooks/useCommunities";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityType } from "@/types/community";

const TYPE_COLORS: Record<CommunityType, string> = {
  RecoverWell: "bg-purple-100 text-purple-800",
  StudyWell: "bg-blue-100 text-blue-800",
  RetireWell: "bg-green-100 text-green-800",
};

export default function CommunitiesPage() {
  const { data: communities, isLoading } = useCommunities();
  const { user } = useAuth();
  const canCreate =
    user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community Portfolios</h1>
          <p className="text-muted-foreground">Manage community portfolios, properties, and residents</p>
        </div>
        {canCreate && (
          <LinkButton href="/communities/new">
            <Plus className="mr-2 h-4 w-4" />
            New Community
          </LinkButton>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : communities?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No communities yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communities?.map((c) => (
            <Link key={c.community_id} href={`/communities/${c.community_id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[c.community_type]}`}
                    >
                      {c.community_type}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {c.city}, {c.province}
                  </p>
                  {c.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
