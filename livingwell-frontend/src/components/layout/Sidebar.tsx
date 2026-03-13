"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  Wrench,
  Sparkles,
  LogOut,
  Heart,
  BarChart2,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { UserRole } from "@/types/auth";

const ALL_ROLES: UserRole[] = [
  "GP_ADMIN",
  "OPERATIONS_MANAGER",
  "PROPERTY_MANAGER",
  "INVESTOR",
  "RESIDENT",
];

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ALL_ROLES,
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: Building2,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER"] as UserRole[],
  },
  {
    href: "/investment",
    label: "Investment",
    icon: Landmark,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER"] as UserRole[],
  },
  {
    href: "/communities",
    label: "Communities",
    icon: Users,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER"] as UserRole[],
  },
  {
    href: "/investors",
    label: "Investors",
    icon: TrendingUp,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER", "INVESTOR"] as UserRole[],
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: Wrench,
    roles: [
      "GP_ADMIN",
      "OPERATIONS_MANAGER",
      "PROPERTY_MANAGER",
      "RESIDENT",
    ] as UserRole[],
  },
  {
    href: "/ai",
    label: "AI Assistant",
    icon: Sparkles,
    roles: [
      "GP_ADMIN",
      "OPERATIONS_MANAGER",
      "PROPERTY_MANAGER",
    ] as UserRole[],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart2,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER"] as UserRole[],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <Heart className="h-6 w-6 text-primary fill-primary" />
        <div>
          <p className="text-sm font-bold leading-tight">Living Well</p>
          <p className="text-xs text-muted-foreground leading-tight">Communities</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {user && (
        <div className="border-t border-border p-4">
          <div className="mb-2">
            <p className="text-sm font-medium truncate">{user.full_name ?? user.email}</p>
            <p className="text-xs text-muted-foreground truncate">{user.role.replace(/_/g, " ")}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
