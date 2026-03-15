"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useGPs, useCreateLP } from "@/hooks/useInvestment";
import { LPCreate } from "@/types/investment";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/* ── helpers ─────────────────────────────────────────────────────── */
function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────── */
export default function NewLPPage() {
  const router = useRouter();
  const { data: gps, isLoading: gpsLoading } = useGPs();
  const { mutateAsync, isPending } = useCreateLP();

  const [form, setForm] = useState<LPCreate>({
    gp_id: 0,
    name: "",
    status: "draft",
  });

  const set = (k: keyof LPCreate, v: string | number | null | undefined) =>
    setForm((f) => ({ ...f, [k]: v ?? undefined }));

  const setNum = (k: keyof LPCreate, raw: string) => {
    if (raw === "") {
      set(k, undefined);
    } else {
      set(k, Number(raw));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.gp_id) {
      toast.error("Please select a General Partner");
      return;
    }
    if (!form.name.trim()) {
      toast.error("LP name is required");
      return;
    }
    try {
      const lp = await mutateAsync(form);
      toast.success("LP created successfully");
      router.push(`/investment/${lp.lp_id}`);
    } catch {
      toast.error("Failed to create LP");
    }
  };

  if (gpsLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <LinkButton
          variant="ghost"
          size="sm"
          href="/investment"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Investment Structure
        </LinkButton>
        <h1 className="text-2xl font-bold">Create New LP</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up a new Limited Partnership fund. You can edit all fields later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section 1: Identity ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fund Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="General Partner" required>
              <Select
                value={form.gp_id ? String(form.gp_id) : ""}
                onValueChange={(v) => set("gp_id", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select GP..." />
                </SelectTrigger>
                <SelectContent>
                  {gps?.map((gp) => (
                    <SelectItem key={gp.gp_id} value={String(gp.gp_id)}>
                      {gp.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="LP Name" required>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Living Well Fund III LP"
              />
            </Field>

            <Field label="Legal Name">
              <Input
                value={form.legal_name ?? ""}
                onChange={(e) => set("legal_name", e.target.value)}
                placeholder="Full legal entity name"
              />
            </Field>

            <Field label="LP Number">
              <Input
                value={form.lp_number ?? ""}
                onChange={(e) => set("lp_number", e.target.value)}
                placeholder="e.g. LW-LP-003"
              />
            </Field>

            <Field label="Purpose Type">
              <Select
                value={form.purpose_type ?? ""}
                onValueChange={(v) => set("purpose_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recover_well">RecoverWell</SelectItem>
                  <SelectItem value="study_well">StudyWell</SelectItem>
                  <SelectItem value="retire_well">RetireWell</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="City Focus">
              <Input
                value={form.city_focus ?? ""}
                onChange={(e) => set("city_focus", e.target.value)}
                placeholder="e.g. Calgary"
              />
            </Field>

            <Field label="Community Focus">
              <Input
                value={form.community_focus ?? ""}
                onChange={(e) => set("community_focus", e.target.value)}
                placeholder="e.g. Calgary Recovery Community"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Brief description of the fund's investment thesis and objectives..."
                  rows={3}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Capital Structure ─────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capital Structure</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Unit Price ($)" hint="Price per LP unit">
              <Input
                type="number"
                step="0.01"
                value={form.unit_price ?? ""}
                onChange={(e) => setNum("unit_price", e.target.value)}
                placeholder="1000.00"
              />
            </Field>

            <Field
              label="Total Units Authorized"
              hint="Maximum units the LP can issue"
            >
              <Input
                type="number"
                value={form.total_units_authorized ?? ""}
                onChange={(e) =>
                  setNum("total_units_authorized", e.target.value)
                }
                placeholder="10000"
              />
            </Field>

            <Field label="Minimum Subscription ($)">
              <Input
                type="number"
                step="0.01"
                value={form.minimum_subscription ?? ""}
                onChange={(e) =>
                  setNum("minimum_subscription", e.target.value)
                }
                placeholder="25000.00"
              />
            </Field>

            <Field label="Target Raise ($)">
              <Input
                type="number"
                step="0.01"
                value={form.target_raise ?? ""}
                onChange={(e) => setNum("target_raise", e.target.value)}
                placeholder="5000000.00"
              />
            </Field>

            <Field label="Minimum Raise ($)">
              <Input
                type="number"
                step="0.01"
                value={form.minimum_raise ?? ""}
                onChange={(e) => setNum("minimum_raise", e.target.value)}
                placeholder="2000000.00"
              />
            </Field>

            <Field label="Maximum Raise ($)">
              <Input
                type="number"
                step="0.01"
                value={form.maximum_raise ?? ""}
                onChange={(e) => setNum("maximum_raise", e.target.value)}
                placeholder="8000000.00"
              />
            </Field>
          </CardContent>
        </Card>

        {/* ── Section 3: Offering Dates ────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offering Timeline</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Offering Date">
              <Input
                type="date"
                value={form.offering_date ?? ""}
                onChange={(e) => set("offering_date", e.target.value)}
              />
            </Field>

            <Field label="Closing Date">
              <Input
                type="date"
                value={form.closing_date ?? ""}
                onChange={(e) => set("closing_date", e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        {/* ── Section 4: Fee & Return Structure ────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fee & Return Structure</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Preferred Return Rate (%)" hint="Annual preferred return to LPs">
              <Input
                type="number"
                step="0.01"
                value={form.preferred_return_rate ?? ""}
                onChange={(e) =>
                  setNum("preferred_return_rate", e.target.value)
                }
                placeholder="8.00"
              />
            </Field>

            <Field label="GP Promote (%)" hint="GP carried interest above hurdle">
              <Input
                type="number"
                step="0.01"
                value={form.gp_promote_percent ?? ""}
                onChange={(e) =>
                  setNum("gp_promote_percent", e.target.value)
                }
                placeholder="20.00"
              />
            </Field>

            <Field label="GP Catch-up (%)" hint="GP catch-up before profit split">
              <Input
                type="number"
                step="0.01"
                value={form.gp_catchup_percent ?? ""}
                onChange={(e) =>
                  setNum("gp_catchup_percent", e.target.value)
                }
                placeholder="100.00"
              />
            </Field>

            <Field label="Asset Management Fee (%)">
              <Input
                type="number"
                step="0.01"
                value={form.asset_management_fee_percent ?? ""}
                onChange={(e) =>
                  setNum("asset_management_fee_percent", e.target.value)
                }
                placeholder="1.50"
              />
            </Field>

            <Field label="Acquisition Fee (%)">
              <Input
                type="number"
                step="0.01"
                value={form.acquisition_fee_percent ?? ""}
                onChange={(e) =>
                  setNum("acquisition_fee_percent", e.target.value)
                }
                placeholder="1.00"
              />
            </Field>
          </CardContent>
        </Card>

        {/* ── Section 5: Costs & Reserves ──────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offering Costs & Reserves</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Formation Costs ($)">
              <Input
                type="number"
                step="0.01"
                value={form.formation_costs ?? ""}
                onChange={(e) => setNum("formation_costs", e.target.value)}
                placeholder="25000.00"
              />
            </Field>

            <Field label="Offering Costs ($)">
              <Input
                type="number"
                step="0.01"
                value={form.offering_costs ?? ""}
                onChange={(e) => setNum("offering_costs", e.target.value)}
                placeholder="50000.00"
              />
            </Field>

            <Field label="Reserve (%)">
              <Input
                type="number"
                step="0.01"
                value={form.reserve_percent ?? ""}
                onChange={(e) => setNum("reserve_percent", e.target.value)}
                placeholder="5.00"
              />
            </Field>

            <Field label="Reserve Amount ($)">
              <Input
                type="number"
                step="0.01"
                value={form.reserve_amount ?? ""}
                onChange={(e) => setNum("reserve_amount", e.target.value)}
                placeholder="250000.00"
              />
            </Field>
          </CardContent>
        </Card>

        {/* ── Section 6: Notes ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Internal notes about this LP..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* ── Actions ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create LP"}
          </Button>
          <LinkButton variant="outline" href="/investment">
            Cancel
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
