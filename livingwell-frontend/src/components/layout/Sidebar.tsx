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
  HandCoins,
  RefreshCw,
  Activity,
  UserPlus,
  Home,
  PieChart,
  AlertTriangle,
  ClipboardList,
  Settings,
  MapPin,
  Banknote,
  FolderOpen,
  Target,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { UserRole } from "@/types/auth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useQuery } from "@tanstack/react-query";
import { developer as devApi } from "@/lib/api";

// Roles that access this platform (RESIDENT will have separate app)
type PlatformRole = "DEVELOPER" | "GP_ADMIN" | "OPERATIONS_MANAGER" | "PROPERTY_MANAGER" | "INVESTOR";

const DEV = "DEVELOPER" as UserRole;
const GP = "GP_ADMIN" as UserRole;
const OP = "OPERATIONS_MANAGER" as UserRole;
const PM = "PROPERTY_MANAGER" as UserRole;
const INV = "INVESTOR" as UserRole;
const PARTNER = "PARTNER" as UserRole;

const ALL_PLATFORM: UserRole[] = [DEV, GP, OP, PM, INV, PARTNER];

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

interface NavSection {
  section: string;
  roles: UserRole[];
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    section: "",
    roles: ALL_PLATFORM,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_PLATFORM },
    ],
  },
  {
    section: "Investment",
    roles: [DEV, GP, INV],
    items: [
      { href: "/investment", label: "LP Funds", icon: Landmark, roles: [DEV, GP] },
      { href: "/investors", label: "Investors", icon: TrendingUp, roles: [DEV, GP, INV] },
      { href: "/investor-onboarding", label: "CRM & Onboarding", icon: UserPlus, roles: [DEV, GP] },
      { href: "/pipeline", label: "My Pipeline", icon: Target, roles: [DEV, GP] },
    ],
  },
  {
    section: "Portfolio",
    roles: [DEV, GP, PM],
    items: [
      { href: "/portfolio", label: "Properties", icon: Building2, roles: [DEV, GP, PM] },
      { href: "/lifecycle", label: "Property Lifecycle", icon: GitBranch, roles: [DEV, GP, PM] },
      { href: "/analytics", label: "Portfolio Analytics", icon: PieChart, roles: [DEV, GP] },
      { href: "/lp-comparison", label: "LP Comparison", icon: GitBranch, roles: [DEV, GP] },
      { href: "/trends", label: "Trends", icon: TrendingUp, roles: [DEV, GP] },
    ],
  },
  {
    section: "Operations",
    roles: [DEV, GP, OP, PM],
    items: [
      { href: "/communities", label: "Communities", icon: Home, roles: [DEV, GP, OP, PM] },
      { href: "/maintenance", label: "Maintenance", icon: Wrench, roles: [DEV, GP, OP, PM] },
      { href: "/arrears-aging", label: "Arrears Aging", icon: DollarSign, roles: [DEV, GP, OP] },
      { href: "/vacancy-alerts", label: "Vacancy Alerts", icon: AlertTriangle, roles: [DEV, GP, OP, PM] },
      { href: "/operator/turnovers", label: "Unit Turnovers", icon: RefreshCw, roles: [DEV, GP, OP, PM] },
      { href: "/operations", label: "Operations P&L", icon: Activity, roles: [DEV, GP, OP, PM] },
      { href: "/staffing", label: "Staffing", icon: Users, roles: [DEV, GP, OP, PM] },
      { href: "/funding", label: "Grants & Funding", icon: HandCoins, roles: [DEV, GP, OP] },
    ],
  },
  {
    section: "Reporting",
    roles: [DEV, GP, INV],
    items: [
      { href: "/quarterly-reports", label: "Quarterly Reports", icon: FileText, roles: [DEV, GP, INV] },
      { href: "/reports", label: "Reports", icon: BarChart2, roles: [DEV, GP] },
      { href: "/cash-flow", label: "Cash Flow", icon: Banknote, roles: [DEV, GP] },
      { href: "/debt-maturity", label: "Debt Maturity", icon: Landmark, roles: [DEV, GP] },
      { href: "/tax-documents", label: "K-1 Tax Docs", icon: FileText, roles: [DEV, GP] },
    ],
  },
  {
    section: "Administration",
    roles: [DEV, GP, PM],
    items: [
      { href: "/ai", label: "AI Assistant", icon: Sparkles, roles: ALL_PLATFORM },
      { href: "/property-managers", label: "Property Managers", icon: Settings, roles: [DEV, GP, PM] },
      { href: "/operator", label: "Operators", icon: ClipboardList, roles: [DEV, GP] },
      { href: "/documents", label: "Documents", icon: FolderOpen, roles: [DEV, GP] },
      { href: "/distributions", label: "Distributions", icon: DollarSign, roles: [DEV, GP] },
      { href: "/etransfers", label: "eTransfers", icon: Send, roles: [DEV, GP] },
      { href: "/user-management", label: "User Management", icon: Users, roles: [DEV, GP] },
      { href: "/settings", label: "Settings", icon: Settings, roles: [DEV, GP] },
    ],
  },
  {
    section: "Developer",
    roles: [DEV],
    items: [
      { href: "/developer/screen-access", label: "Screen Access Control", icon: Shield, roles: [DEV] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch allowed screens from DB (managed by Developer in Screen Access Control)
  const { data: screenPerms } = useQuery({
    queryKey: ["my-screen-permissions", user?.role],
    queryFn: () => devApi.getMyScreenPermissions(),
    enabled: !!user,
    staleTime: 60000, // Cache for 1 minute
  });
  const allowedScreens: Set<string> | null = screenPerms?.screens
    ? new Set(screenPerms.screens as string[])
    : null; // null = permissions not loaded yet, use hardcoded roles as fallback

  const roleLabels: Record<string, string> = {
    DEVELOPER: "Developer",
    GP_ADMIN: "GP Admin",
    OPERATIONS_MANAGER: "Operator",
    PROPERTY_MANAGER: "Property Manager",
    INVESTOR: "Investor",
    RESIDENT: "Resident",
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm">
            <Heart className="h-5 w-5 text-white fill-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">Living Well</p>
            <p className="text-[11px] text-sidebar-muted leading-tight">Communities</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1 rounded-md hover:bg-white/10 text-sidebar-foreground"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_SECTIONS.map((section, si) => {
          const visibleItems = section.items.filter((item) => {
            if (!user) return false;
            // If DB permissions loaded, use them; otherwise fall back to hardcoded roles
            if (allowedScreens) {
              return allowedScreens.has(item.href);
            }
            return item.roles.includes(user.role);
          });
          if (visibleItems.length === 0) return null;

          const showHeader = section.section && visibleItems.length > 0;

          return (
            <div key={si}>
              {showHeader && (
                <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-muted">
                  {section.section}
                </p>
              )}
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
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent/15 text-white"
                        : "text-sidebar-foreground hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-accent" />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-sidebar-accent")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      {user && (
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-2.5 flex items-center gap-2.5">
            <Link href="/profile" className="shrink-0">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </div>
            </Link>
            <div className="min-w-0">
              <Link href="/profile" className="text-sm font-medium text-white truncate hover:text-emerald-300 transition-colors block">
                {user.full_name ?? user.email}
              </Link>
              <p className="text-[11px] text-sidebar-muted truncate">
                {roleLabels[user.role] || user.role.replace(/_/g, " ")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground transition-all duration-200"
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
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg bg-card border border-border shadow-md"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-out */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar-bg transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-60 flex-col bg-sidebar-bg shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}
