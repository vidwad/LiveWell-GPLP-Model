"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { developer as devApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Monitor,
} from "lucide-react";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  DEVELOPER: { label: "Developer", color: "bg-red-100 text-red-700" },
  GP_ADMIN: { label: "GP Admin", color: "bg-blue-100 text-blue-700" },
  OPERATIONS_MANAGER: { label: "Ops Manager", color: "bg-amber-100 text-amber-700" },
  PROPERTY_MANAGER: { label: "Property Mgr", color: "bg-green-100 text-green-700" },
  INVESTOR: { label: "Investor", color: "bg-violet-100 text-violet-700" },
};

export default function ScreenAccessPage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["screen-permissions"],
    queryFn: () => devApi.getScreenPermissions(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ permissionId, isEnabled }: { permissionId: number; isEnabled: boolean }) => {
      setSaving(permissionId);
      return devApi.togglePermission(permissionId, isEnabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screen-permissions"] });
    },
    onSettled: () => setSaving(null),
    onError: (e: any) => {
      alert(e?.response?.data?.detail || "Failed to update permission");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const sections = data?.sections || {};
  const roles: string[] = data?.roles || [];
  const sectionOrder = [
    "Dashboard", "Investment", "Portfolio", "Operations",
    "Finance", "Reports", "AI", "Admin", "Developer",
  ];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-red-600" />
          Screen Access Control
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which user roles can access each screen. Changes take effect immediately.
        </p>
      </div>

      {/* Role Legend */}
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => {
          const cfg = ROLE_LABELS[role] || { label: role, color: "bg-gray-100 text-gray-700" };
          return (
            <Badge key={role} className={`text-[10px] ${cfg.color}`}>
              {cfg.label}
            </Badge>
          );
        })}
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground min-w-[200px]">
                    Screen
                  </th>
                  {roles.map((role) => {
                    const cfg = ROLE_LABELS[role] || { label: role, color: "" };
                    return (
                      <th key={role} className="px-2 py-3 text-center text-[10px] font-semibold text-muted-foreground min-w-[90px]">
                        <span className={`inline-block px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sectionOrder.map((sectionName) => {
                  const screens = sections[sectionName];
                  if (!screens || screens.length === 0) return null;

                  return (
                    <SectionGroup
                      key={sectionName}
                      sectionName={sectionName}
                      screens={screens}
                      roles={roles}
                      saving={saving}
                      onToggle={(permissionId, isEnabled) =>
                        toggleMutation.mutate({ permissionId, isEnabled })
                      }
                    />
                  );
                })}
                {/* Sections not in the predefined order */}
                {Object.keys(sections)
                  .filter((s) => !sectionOrder.includes(s))
                  .map((sectionName) => (
                    <SectionGroup
                      key={sectionName}
                      sectionName={sectionName}
                      screens={sections[sectionName]}
                      roles={roles}
                      saving={saving}
                      onToggle={(permissionId, isEnabled) =>
                        toggleMutation.mutate({ permissionId, isEnabled })
                      }
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <Monitor className="h-4 w-4" /> How it works
        </p>
        <ul className="list-disc list-inside space-y-0.5 ml-1 text-amber-700">
          <li>Toggle access on/off for each role per screen</li>
          <li>Changes take effect on the user&apos;s next page load</li>
          <li>Developer access to this page cannot be disabled</li>
          <li>New screens added to the app will automatically appear here</li>
        </ul>
      </div>
    </div>
  );
}

function SectionGroup({
  sectionName,
  screens,
  roles,
  saving,
  onToggle,
}: {
  sectionName: string;
  screens: Array<Record<string, any>>;
  roles: string[];
  saving: number | null;
  onToggle: (permissionId: number, isEnabled: boolean) => void;
}) {
  return (
    <>
      {/* Section Header Row */}
      <tr className="bg-muted/20">
        <td colSpan={roles.length + 1} className="px-4 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {sectionName}
          </span>
        </td>
      </tr>
      {/* Screen Rows */}
      {screens.map((screen: Record<string, any>) => (
        <tr key={screen.screen_key} className="border-b hover:bg-muted/10 transition-colors">
          <td className="px-4 py-2.5">
            <div>
              <span className="text-sm font-medium">{screen.screen_label}</span>
              <span className="block text-[10px] text-muted-foreground font-mono">{screen.screen_key}</span>
            </div>
          </td>
          {roles.map((role) => {
            const perm = screen.roles?.[role];
            if (!perm) return <td key={role} className="px-2 py-2.5 text-center text-muted-foreground/30">—</td>;

            const isEnabled = perm.is_enabled;
            const isSaving = saving === perm.permission_id;
            const isDeveloperSelf = screen.screen_key === "/developer/screen-access" && role === "DEVELOPER";

            return (
              <td key={role} className="px-2 py-2.5 text-center">
                <button
                  disabled={isSaving || isDeveloperSelf}
                  onClick={() => onToggle(perm.permission_id, !isEnabled)}
                  className={`inline-flex items-center justify-center h-7 w-7 rounded-md transition-all ${
                    isDeveloperSelf
                      ? "bg-green-100 cursor-not-allowed"
                      : isEnabled
                      ? "bg-green-100 hover:bg-green-200 cursor-pointer"
                      : "bg-red-50 hover:bg-red-100 cursor-pointer"
                  }`}
                  title={isDeveloperSelf ? "Cannot disable" : isEnabled ? "Click to disable" : "Click to enable"}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : isEnabled ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
