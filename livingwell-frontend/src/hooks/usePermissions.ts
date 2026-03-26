"use client";

import { useAuth } from "@/providers/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { UserRole } from "@/types/auth";

/**
 * Well-known capabilities matching backend CAPABILITIES set.
 */
export type Capability =
  | "view_financials"
  | "manage_properties"
  | "approve_distributions"
  | "manage_debt"
  | "manage_construction"
  | "manage_staff"
  | "manage_residents"
  | "manage_investors"
  | "create_reports"
  | "manage_grants"
  | "manage_documents"
  | "transition_stages"
  | "manage_valuations"
  | "manage_waterfall"
  | "admin_users";

/**
 * Default capabilities per role (mirrors backend ROLE_DEFAULT_CAPABILITIES).
 * Used for optimistic client-side checks before the API response arrives.
 */
const ROLE_DEFAULTS: Record<string, Set<Capability>> = {
  GP_ADMIN: new Set<Capability>([
    "view_financials", "manage_properties", "approve_distributions",
    "manage_debt", "manage_construction", "manage_staff", "manage_residents",
    "manage_investors", "create_reports", "manage_grants", "manage_documents",
    "transition_stages", "manage_valuations", "manage_waterfall", "admin_users",
  ]),
  OPERATIONS_MANAGER: new Set<Capability>([
    "view_financials", "manage_properties", "manage_debt",
    "manage_construction", "manage_staff", "manage_residents",
    "create_reports", "manage_grants", "manage_documents",
    "transition_stages", "manage_valuations",
  ]),
  PROPERTY_MANAGER: new Set<Capability>([
    "view_financials", "manage_properties", "manage_staff",
    "manage_residents", "manage_construction", "create_reports",
    "manage_documents", "manage_grants",
  ]),
  INVESTOR: new Set<Capability>(["view_financials", "create_reports"]),
};

/**
 * Role-based and capability-based permission helpers for frontend UI.
 *
 * Usage:
 *   const { canEdit, hasCapability } = usePermissions();
 *   {hasCapability("approve_distributions") && <Button>Approve</Button>}
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  const isAdmin = role === "GP_ADMIN";
  const isOps = role === "OPERATIONS_MANAGER";
  const isPM = role === "PROPERTY_MANAGER";
  const isInvestor = role === "INVESTOR";
  const isResident = role === "RESIDENT";

  // GP_ADMIN can do everything
  // OPERATIONS_MANAGER can create/edit most things but not delete LPs
  // PROPERTY_MANAGER can edit property-level items
  // INVESTOR and RESIDENT are read-only
  const canCreate = isAdmin || isOps;
  const canEdit = isAdmin || isOps;
  const canDelete = isAdmin;
  const canManageInvestments = isAdmin;
  const canManageOperations = isAdmin || isOps;
  const canManageProperties = isAdmin || isOps || isPM;
  const canViewFinancials = isAdmin || isOps || isInvestor;

  /**
   * Check if the user has one of the specified roles.
   */
  function hasRole(...roles: UserRole[]): boolean {
    return !!role && roles.includes(role);
  }

  /**
   * Check capability using role defaults (optimistic, synchronous).
   * For server-authoritative checks, use useUserCapabilities() hook.
   */
  function hasCapability(cap: Capability): boolean {
    if (!role) return false;
    return ROLE_DEFAULTS[role]?.has(cap) ?? false;
  }

  /**
   * Check if user has ALL of the given capabilities.
   */
  function hasAllCapabilities(...caps: Capability[]): boolean {
    return caps.every((c) => hasCapability(c));
  }

  /**
   * Check if user has ANY of the given capabilities.
   */
  function hasAnyCapability(...caps: Capability[]): boolean {
    return caps.some((c) => hasCapability(c));
  }

  return {
    role,
    isAdmin,
    isOps,
    isPM,
    isInvestor,
    isResident,
    canCreate,
    canEdit,
    canDelete,
    canManageInvestments,
    canManageOperations,
    canManageProperties,
    canViewFinancials,
    hasRole,
    hasCapability,
    hasAllCapabilities,
    hasAnyCapability,
  };
}

/**
 * Fetch server-authoritative capabilities for a specific user.
 * Used in admin UI for managing user permissions.
 */
export function useUserCapabilities(userId?: number) {
  return useQuery({
    queryKey: ["user-capabilities", userId],
    queryFn: () =>
      apiClient
        .get<{
          user_id: number;
          role: string;
          effective_capabilities: string[];
          explicit_grants: string[];
          from_role: string[];
          all_known_capabilities: string[];
        }>(`/api/auth/users/${userId}/capabilities`)
        .then((r) => r.data),
    enabled: !!userId,
  });
}
