"use client";

import { useState } from "react";
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
  GitBranch,
  DollarSign,
  FileText,
  Send,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { UserRole } from "@/types/auth";
import { NotificationBell } from "@/components/notifications/NotificationBell";

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
    href: "/lifecycle",
    label: "Lifecycle",
    icon: GitBranch,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER", "PROPERTY_MANAGER"] as UserRole[],
  },
  {
    href: "/operator",
    label: "Operator",
    icon: DollarSign,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER"] as UserRole[],
  },
  {
    href: "/quarterly-reports",
    label: "Quarterly Reports",
    icon: FileText,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER", "INVESTOR"] as UserRole[],
  },
  {
    href: "/etransfers",
    label: "eTransfers",
    icon: Send,
    roles: ["GP_ADMIN", "OPERATIONS_MANAGER"] as UserRole[],
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary fill-primary" />
          <div>
            <p className="text-sm font-bold leading-tight">Living Well</p>
            <p className="text-xs text-muted-foreground leading-tight">Communities</p>
          </div>
        </div>
        {/* Close button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1 rounded-md hover:bg-muted"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
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
              onClick={() => setMobileOpen(false)}
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
          <div className="flex items-center justify-between">
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
            <NotificationBell />
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile hamburger button — fixed top-left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-md bg-card border border-border shadow-sm"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-out sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-card border-r border-border transition-transform duration-200 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex h-screen w-60 flex-col border-r border-border bg-card shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}
