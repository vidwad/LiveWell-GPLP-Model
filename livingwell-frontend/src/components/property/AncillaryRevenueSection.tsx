"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  DollarSign,
  Edit2,
  Plus,
  Save,
  Trash2,
  X,
  Car,
  PawPrint,
  Package,
  Bike,
  WashingMachine,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAncillaryRevenue,
  useAncillaryRevenueSummary,
  useCreateAncillaryRevenue,
  useUpdateAncillaryRevenue,
  useDeleteAncillaryRevenue,
} from "@/hooks/usePortfolio";
import type { AncillaryRevenueStream, AncillaryRevenueStreamCreate } from "@/types/portfolio";

const STREAM_TYPES = [
  { value: "parking", label: "Parking", icon: Car },
  { value: "pet_fee", label: "Pet Fee", icon: PawPrint },
  { value: "storage", label: "Storage", icon: Package },
  { value: "bike", label: "Bike Storage", icon: Bike },
  { value: "laundry", label: "Laundry", icon: WashingMachine },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

function getStreamIcon(type: string) {
  const found = STREAM_TYPES.find((s) => s.value === type);
  return found ? found.icon : DollarSign;
}

function getStreamLabel(type: string) {
  const found = STREAM_TYPES.find((s) => s.value === type);
  return found ? found.label : type;
}

interface AncillaryRevenueSectionProps {
  propertyId: number;
  planId?: number | null;
  canEdit: boolean;
  label?: string;
}

export function AncillaryRevenueSection({
  propertyId,
  planId = null,
  canEdit,
  label = "Ancillary Revenue Streams",
}: AncillaryRevenueSectionProps) {
  const { data: streams } = useAncillaryRevenue(propertyId, planId);
  const { data: summary } = useAncillaryRevenueSummary(propertyId, planId);
  const createMutation = useCreateAncillaryRevenue(propertyId);
  const updateMutation = useUpdateAncillaryRevenue(propertyId);
  const deleteMutation = useDeleteAncillaryRevenue(propertyId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AncillaryRevenueStreamCreate>({
    stream_type: "parking",
    description: "",
    total_count: 0,
    utilization_pct: 100,
    monthly_rate: 0,
    annual_escalation_pct: 3,
    development_plan_id: planId,
  });

  const resetForm = () => {
    setForm({
      stream_type: "parking",
      description: "",
      total_count: 0,
      utilization_pct: 100,
      monthly_rate: 0,
      annual_escalation_pct: 3,
      development_plan_id: planId,
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleCreate = () => {
    createMutation.mutate(form, {
      onSuccess: () => {
        toast.success("Revenue stream added");
        resetForm();
      },
      onError: () => toast.error("Failed to add revenue stream"),
    });
  };

  const handleUpdate = (streamId: number) => {
    updateMutation.mutate(
      { streamId, data: form },
      {
        onSuccess: () => {
          toast.success("Revenue stream updated");
          resetForm();
        },
        onError: () => toast.error("Failed to update revenue stream"),
      }
    );
  };

  const handleDelete = (streamId: number) => {
    deleteMutation.mutate(streamId, {
      onSuccess: () => toast.success("Revenue stream removed"),
      onError: () => toast.error("Failed to remove revenue stream"),
    });
  };

  const startEdit = (stream: AncillaryRevenueStream) => {
    setEditingId(stream.stream_id);
    setForm({
      stream_type: stream.stream_type,
      description: stream.description || "",
      total_count: stream.total_count,
      utilization_pct: stream.utilization_pct,
      monthly_rate: stream.monthly_rate,
      annual_escalation_pct: stream.annual_escalation_pct ?? 3,
      development_plan_id: stream.development_plan_id,
    });
    setShowAddForm(false);
  };

  const filteredStreams = streams?.filter((s) =>
    planId !== null
      ? s.development_plan_id === planId
      : s.development_plan_id === null
  ) || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            {label}
          </CardTitle>
          {canEdit && !showAddForm && editingId === null && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Stream
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary KPIs */}
        {summary && summary.stream_count > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Monthly Total</p>
              <p className="text-lg font-bold text-green-700">
                ${summary.total_monthly_revenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Annual Total</p>
              <p className="text-lg font-bold text-green-700">
                ${summary.total_annual_revenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Active Streams</p>
              <p className="text-lg font-bold">{summary.stream_count}</p>
            </div>
          </div>
        )}

        {/* Stream List */}
        {filteredStreams.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Count</th>
                  <th className="text-right px-3 py-2 font-medium">Utilization</th>
                  <th className="text-right px-3 py-2 font-medium">Rate/Mo</th>
                  <th className="text-right px-3 py-2 font-medium">Monthly Rev</th>
                  <th className="text-right px-3 py-2 font-medium">Annual Rev</th>
                  <th className="text-right px-3 py-2 font-medium">Esc. %</th>
                  {canEdit && <th className="px-3 py-2 w-20" />}
                </tr>
              </thead>
              <tbody>
                {filteredStreams.map((stream) => {
                  const Icon = getStreamIcon(stream.stream_type);
                  if (editingId === stream.stream_id) {
                    return (
                      <tr key={stream.stream_id} className="bg-blue-50/50">
                        <td colSpan={canEdit ? 8 : 7} className="p-3">
                          <StreamForm
                            form={form}
                            setForm={setForm}
                            onSave={() => handleUpdate(stream.stream_id)}
                            onCancel={resetForm}
                            saving={updateMutation.isPending}
                          />
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={stream.stream_id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{getStreamLabel(stream.stream_type)}</span>
                          {stream.description && (
                            <span className="text-xs text-muted-foreground">
                              — {stream.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right px-3 py-2">{stream.total_count}</td>
                      <td className="text-right px-3 py-2">{Number(stream.utilization_pct).toFixed(0)}%</td>
                      <td className="text-right px-3 py-2">${Number(stream.monthly_rate).toFixed(0)}</td>
                      <td className="text-right px-3 py-2 font-medium text-green-700">
                        ${(stream.monthly_revenue ?? 0).toLocaleString()}
                      </td>
                      <td className="text-right px-3 py-2 font-medium text-green-700">
                        ${(stream.annual_revenue ?? 0).toLocaleString()}
                      </td>
                      <td className="text-right px-3 py-2">
                        {stream.annual_escalation_pct != null
                          ? `${Number(stream.annual_escalation_pct).toFixed(1)}%`
                          : "—"}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => startEdit(stream)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(stream.stream_id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {filteredStreams.length === 0 && !showAddForm && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No ancillary revenue streams configured.
            {canEdit && " Click \"Add Stream\" to add parking, pet fees, storage, etc."}
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="border rounded-lg p-4 bg-blue-50/30">
            <StreamForm
              form={form}
              setForm={setForm}
              onSave={handleCreate}
              onCancel={resetForm}
              saving={createMutation.isPending}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Inline Form Component ──────────────────────────────────────────

interface StreamFormProps {
  form: AncillaryRevenueStreamCreate;
  setForm: React.Dispatch<React.SetStateAction<AncillaryRevenueStreamCreate>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function StreamForm({ form, setForm, onSave, onCancel, saving }: StreamFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Type</Label>
          <Select
            value={form.stream_type}
            onValueChange={(v) => setForm((f) => ({ ...f, stream_type: v ?? "parking" }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STREAM_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input
            className="h-8 text-sm"
            placeholder="e.g. Covered Stalls"
            value={form.description || ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">Total Count</Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={0}
            value={form.total_count}
            onChange={(e) =>
              setForm((f) => ({ ...f, total_count: parseInt(e.target.value) || 0 }))
            }
          />
        </div>
        <div>
          <Label className="text-xs">Utilization %</Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={0}
            max={100}
            value={form.utilization_pct}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                utilization_pct: parseFloat(e.target.value) || 0,
              }))
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Monthly Rate ($)</Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={0}
            step={5}
            value={form.monthly_rate}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                monthly_rate: parseFloat(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div>
          <Label className="text-xs">Annual Escalation %</Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={0}
            step={0.5}
            value={form.annual_escalation_pct ?? 0}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                annual_escalation_pct: parseFloat(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div className="md:col-span-2 flex items-end gap-2">
          <Button size="sm" onClick={onSave} disabled={saving || form.total_count <= 0}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          {form.total_count > 0 && form.monthly_rate > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              Est: ${(
                form.total_count *
                form.monthly_rate *
                (form.utilization_pct / 100)
              ).toFixed(0)}
              /mo
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
