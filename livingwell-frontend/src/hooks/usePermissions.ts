"use client";

import { useAuth } from "@/providers/AuthProvider";
import { UserRole } from "@/types/auth";

/**
 * Role-based permission helpers for frontend UI.
 *
 * Usage:
 *   const { canEdit, canCreate, canDelete, isAdmin, isInvestor } = usePermissions();
 *   {canCreate && <Button>Create LP</Button>}
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
  };
}
