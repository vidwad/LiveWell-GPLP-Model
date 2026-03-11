"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { UserRole } from "@/types/auth";
import { Skeleton } from "@/components/ui/skeleton";

export function RoleGuard({
  allowed,
  children,
}: {
  allowed: UserRole[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
      return;
    }
    if (!isLoading && user && !allowed.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, allowed, router]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!user || !allowed.includes(user.role)) return null;
  return <>{children}</>;
}
