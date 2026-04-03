"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings,
  Key,
  Shield,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Map,
  Brain,
  Server,
  Save,
  Trash2,
  ChevronRight,
  ExternalLink,
  CircleDot,
  Mail,
  Phone,
  Database,
  Building2,
  Globe,
  Train,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { settingsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface PlatformSetting {
  setting_id: number;
  key: string;
  value: string;
  category: string;
  label: string | null;
  description: string | null;
  is_secret: boolean;
  is_configured: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

interface Integration {
  key: string;
  name: string;
  status: "active" | "configured" | "not_configured";
  features: string[];
}

interface IntegrationStatus {
  integrations: Integration[];
  ai_model: string;
  environment: string;
}

/* ── Status Badge ──────────────────────────────────────────────────────── */

function IntegrationStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
        <Check className="h-3 w-3" /> Active
      </Badge>
    );
  }
  if (status === "configured") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
        <CircleDot className="h-3 w-3" /> Configured
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-gray-500 gap-1">
      <X className="h-3 w-3" /> Not Configured
    </Badge>
  );
}

/* ── Source Item (Area Research Data Sources) ─────────────────────────── */

function SourceItem({
  tier,
  name,
  url,
  note,
  datasets,
  requiresKey,
  isConfigured,
}: {
  tier: 1 | 2 | 3;
  name: string;
  url?: string;
  note?: string;
  datasets?: string[];
  requiresKey?: string;
  isConfigured?: boolean;
}) {
  const tierColors = {
    1: "bg-green-100 text-green-800 border-green-200",
    2: "bg-amber-100 text-amber-800 border-amber-200",
    3: "bg-blue-100 text-blue-800 border-blue-200",
  };
  const tierLabels = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };

  return (
    <div className="border rounded-md p-2.5 space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium text-xs">{name}</span>
        <Badge className={cn("text-[9px] px-1.5 py-0", tierColors[tier])}>
          {tierLabels[tier]}
        </Badge>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
        >
          <Globe className="h-2.5 w-2.5" /> {url.replace("https://", "")}
        </a>
      )}
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
      {datasets && datasets.length > 0 && (
        <ul className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
          {datasets.map((d) => (
            <li key={d} className="flex items-center gap-1">
              <Check className="h-2.5 w-2.5 text-green-600 shrink-0" /> {d}
            </li>
          ))}
        </ul>
      )}
      {requiresKey && (
        <div className="flex items-center gap-1 mt-1">
          <Key className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Requires: {requiresKey}
          </span>
          {isConfigured !== undefined &&
            (isConfigured ? (
              <Check className="h-2.5 w-2.5 text-green-600" />
            ) : (
              <X className="h-2.5 w-2.5 text-red-500" />
            ))}
        </div>
      )}
    </div>
  );
}

/* ── Category Config ───────────────────────────────────────────────────── */

const CATEGORY_CONFIG: Record<
  string,
  { title: string; description: string; icon: React.ElementType }
> = {
  api_keys: {
    title: "API Keys",
    description: "External service API keys for AI, maps, and integrations",
    icon: Key,
  },
  ai: {
    title: "AI Configuration",
    description: "Model selection and AI feature settings",
    icon: Brain,
  },
  email: {
    title: "Email Configuration",
    description: "Email service settings for invitations and notifications",
    icon: Mail,
  },
  general: {
    title: "General",
    description: "Platform environment and URL configuration",
    icon: Server,
  },
  telephony: {
    title: "Telephony (Twilio)",
    description: "Phone number and webhook settings for calls and SMS",
    icon: Phone,
  },
};

/* ── Key Icon Helper ───────────────────────────────────────────────────── */

function getKeyIcon(key: string): React.ElementType {
  if (key.includes("ANTHROPIC")) return Sparkles;
  if (key.includes("OPENAI")) return Brain;
  if (key.includes("GOOGLE") || key.includes("MAP")) return Map;
  if (key.includes("CLAUDE")) return Sparkles;
  if (key.includes("RESEND") || key.includes("EMAIL")) return Mail;
  return Settings;
}

/* ── Setting Row Component ─────────────────────────────────────────────── */

function SettingRow({
  setting,
  onSave,
  onClear,
  isSaving,
}: {
  setting: PlatformSetting;
  onSave: (key: string, value: string) => void;
  onClear: (key: string) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);

  const Icon = getKeyIcon(setting.key);

  const handleSave = () => {
    if (!value.trim()) return;
    onSave(setting.key, value);
    setEditing(false);
    setValue("");
    setShowValue(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setValue("");
    setShowValue(false);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              setting.is_configured
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-400"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">{setting.label || setting.key}</p>
              {setting.is_configured ? (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-green-50 text-green-700 border-green-200"
                >
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-gray-400">
                  Not Set
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {setting.description}
            </p>
            {setting.is_configured && !editing && (
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                  {setting.is_secret ? setting.value : setting.value}
                </code>
                {setting.updated_at && (
                  <span className="text-[10px] text-muted-foreground">
                    Updated {new Date(setting.updated_at).toLocaleDateString()}
                    {setting.updated_by && ` by ${setting.updated_by}`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setEditing(true)}
              >
                {setting.is_configured ? "Update" : "Set Key"}
              </Button>
              {setting.is_configured && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                  onClick={() => onClear(setting.key)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Input
              type={setting.is_secret && !showValue ? "password" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                setting.is_secret
                  ? "Enter API key..."
                  : `Enter ${setting.label || setting.key}...`
              }
              className="pr-10 font-mono text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            {setting.is_secret && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowValue(!showValue)}
              >
                {showValue ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
          <Button
            size="sm"
            className="h-9"
            onClick={handleSave}
            disabled={!value.trim() || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Integration Card ──────────────────────────────────────────────────── */

function IntegrationCard({ integration }: { integration: Integration }) {
  const Icon = getKeyIcon(integration.key);
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        integration.status === "active"
          ? "border-green-200 bg-green-50/30"
          : integration.status === "configured"
            ? "border-yellow-200 bg-yellow-50/30"
            : "border-gray-200"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">{integration.name}</p>
        </div>
        <IntegrationStatusBadge status={integration.status} />
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {integration.features.map((f, i) => (
          <Badge
            key={i}
            variant="secondary"
            className={cn(
              "text-[10px]",
              integration.status === "not_configured" && "opacity-50"
            )}
          >
            {f}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/* ── Main Settings Page ────────────────────────────────────────────────── */

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // Fetch settings
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery<PlatformSetting[]>({
    queryKey: ["platform-settings"],
    queryFn: () => settingsApi.getAll(),
  });

  // Fetch integration status
  const { data: status } = useQuery<IntegrationStatus>({
    queryKey: ["integration-status"],
    queryFn: () => settingsApi.getStatus(),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      settingsApi.update(key, value),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      queryClient.invalidateQueries({ queryKey: ["integration-status"] });
    },
    onError: () => {
      toast.error("Failed to update setting");
    },
  });

  // Clear mutation
  const clearMutation = useMutation({
    mutationFn: (key: string) => settingsApi.clear(key),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      queryClient.invalidateQueries({ queryKey: ["integration-status"] });
    },
    onError: () => {
      toast.error("Failed to clear setting");
    },
  });

  const handleSave = (key: string, value: string) => {
    updateMutation.mutate({ key, value });
  };

  const handleClear = (key: string) => {
    clearMutation.mutate(key);
  };

  // Group settings by category
  const grouped = (settings || []).reduce(
    (acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    },
    {} as Record<string, PlatformSetting[]>
  );

  const configuredCount = (settings || []).filter((s) => s.is_configured).length;
  const totalCount = (settings || []).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-muted-foreground">
          Failed to load settings. You may not have admin permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys, integrations, and platform configuration.
          {totalCount > 0 && (
            <span className="ml-2">
              <Badge variant="secondary" className="text-[10px]">
                {configuredCount}/{totalCount} configured
              </Badge>
            </span>
          )}
        </p>
      </div>

      {/* Integration Status Overview */}
      {status && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {status.integrations.map((integration) => (
                <IntegrationCard
                  key={integration.key}
                  integration={integration}
                />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
              <span>
                AI Model: <strong>{status.ai_model}</strong>
              </span>
              <span>
                Environment:{" "}
                <Badge variant="outline" className="text-[10px]">
                  {status.environment}
                </Badge>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Area Research Data Sources */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Area Research — Source Stack
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Data sources used when generating area research reports. Tier 1 sources are
            queried via direct API; Tier 2 uses AI-powered web search.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Calgary */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Building2 className="h-3.5 w-3.5" />
              Calgary
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <SourceItem
                tier={1}
                name="City of Calgary Open Data"
                url="https://data.calgary.ca"
                datasets={[
                  "Development Permits",
                  "Building Permits",
                  "Land Use Designation Codes",
                  "Civic Census by Community",
                  "Census by Community 2019",
                ]}
              />
              <SourceItem
                tier={2}
                name="CREB / MLS"
                note="Comparable sales & active listings via web search"
                requiresKey="OPENAI_API_KEY"
                isConfigured={
                  !!(settings || []).find(
                    (s) => s.key === "OPENAI_API_KEY" && s.is_configured
                  )
                }
              />
              <SourceItem
                tier={2}
                name="CMHC Rental Market Survey"
                note="Vacancy rates, average rents, rent trends via web search"
                requiresKey="OPENAI_API_KEY"
                isConfigured={
                  !!(settings || []).find(
                    (s) => s.key === "OPENAI_API_KEY" && s.is_configured
                  )
                }
              />
              <SourceItem
                tier={3}
                name="AI Synthesis"
                note="Combines all data into structured report"
                requiresKey="ANTHROPIC_API_KEY or OPENAI_API_KEY"
                isConfigured={
                  !!(settings || []).find(
                    (s) =>
                      (s.key === "ANTHROPIC_API_KEY" ||
                        s.key === "OPENAI_API_KEY") &&
                      s.is_configured
                  )
                }
              />
            </div>
          </div>

          <Separator />

          {/* Edmonton */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Building2 className="h-3.5 w-3.5" />
              Edmonton
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <SourceItem
                tier={1}
                name="City of Edmonton Open Data"
                url="https://data.edmonton.ca"
                datasets={[
                  "Development Permits",
                  "General Building Permits",
                  "Zoning Bylaw (2023 framework)",
                  "Property Assessments (Current + Historical)",
                  "Census Population by Age Range",
                  "Neighbourhood Boundaries",
                  "LRT Stations & ETS Bus Stops",
                ]}
              />
              <SourceItem
                tier={2}
                name="REALTORS Association of Edmonton / MLS"
                note="Comparable sales & active listings via web search"
                requiresKey="OPENAI_API_KEY"
                isConfigured={
                  !!(settings || []).find(
                    (s) => s.key === "OPENAI_API_KEY" && s.is_configured
                  )
                }
              />
              <SourceItem
                tier={2}
                name="CMHC Rental Market Survey"
                note="Vacancy rates, average rents by zone via web search"
                requiresKey="OPENAI_API_KEY"
                isConfigured={
                  !!(settings || []).find(
                    (s) => s.key === "OPENAI_API_KEY" && s.is_configured
                  )
                }
              />
              <SourceItem
                tier={3}
                name="AI Synthesis"
                note="Combines all data into structured report"
                requiresKey="ANTHROPIC_API_KEY or OPENAI_API_KEY"
                isConfigured={
                  !!(settings || []).find(
                    (s) =>
                      (s.key === "ANTHROPIC_API_KEY" ||
                        s.key === "OPENAI_API_KEY") &&
                      s.is_configured
                  )
                }
              />
            </div>
          </div>

          <div className="pt-2 border-t text-[10px] text-muted-foreground space-y-1">
            <p>
              <strong>Tier 1 (Authoritative):</strong> Direct API — always
              available, no API keys required. Real-time municipal data.
            </p>
            <p>
              <strong>Tier 2 (Market Data):</strong> AI-powered web search —
              requires OpenAI API key for CREB/RAE/CMHC queries.
            </p>
            <p>
              <strong>Tier 3 (Synthesis):</strong> AI combines all sources into
              a structured investment report — requires Anthropic or OpenAI key.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Settings by Category */}
      {["api_keys", "ai", "email", "telephony", "general"].map((category) => {
        const categorySettings = grouped[category];
        if (!categorySettings || categorySettings.length === 0) return null;

        const cfg = CATEGORY_CONFIG[category] || {
          title: category,
          description: "",
          icon: Settings,
        };
        const CatIcon = cfg.icon;

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CatIcon className="h-4 w-4" />
                {cfg.title}
              </CardTitle>
              {cfg.description && (
                <p className="text-xs text-muted-foreground">
                  {cfg.description}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {categorySettings.map((setting) => (
                <SettingRow
                  key={setting.key}
                  setting={setting}
                  onSave={handleSave}
                  onClear={handleClear}
                  isSaving={updateMutation.isPending}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Help */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> API keys are stored securely and never
            displayed in full after saving. Changes to AI keys take effect
            immediately. Settings configured here override environment
            variables. The Google Maps API key is used by the frontend — after saving it
            here, set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
            in your frontend environment to the same value.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
