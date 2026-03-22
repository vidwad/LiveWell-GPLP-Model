"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCreateProperty } from "@/hooks/usePortfolio";
import { PropertyCreate, DevelopmentStage } from "@/types/portfolio";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { PropertyLookup } from "@/components/property/PropertyLookup";

export default function NewPropertyPage() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateProperty();

  const [form, setForm] = useState<PropertyCreate>({
    address: "",
    city: "",
    province: "",
    purchase_date: "",
    purchase_price: 0,
    development_stage: "acquisition",
  });

  const [lpOptions, setLpOptions] = useState<{ lp_id: number; name: string }[]>([]);
  const [communityOptions, setCommunityOptions] = useState<{ community_id: number; name: string }[]>([]);

  useEffect(() => {
    api.investment.getLPs().then((lps: any[]) => setLpOptions(lps.map(l => ({ lp_id: l.lp_id, name: l.name }))));
    api.communities.getAll().then((cs: any[]) => setCommunityOptions(cs.map(c => ({ community_id: c.community_id, name: c.name }))));
  }, []);

  const set = (k: keyof PropertyCreate, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prop = await mutateAsync({
        ...form,
        purchase_price: Number(form.purchase_price),
        assessed_value: form.assessed_value ? Number(form.assessed_value) : undefined,
        current_market_value: form.current_market_value ? Number(form.current_market_value) : undefined,
        lot_size: form.lot_size ? Number(form.lot_size) : undefined,
        max_buildable_area: form.max_buildable_area
          ? Number(form.max_buildable_area)
          : undefined,
        lp_id: form.lp_id || undefined,
        community_id: form.community_id || undefined,
      });
      toast.success("Property created");
      router.push(`/portfolio/${prop.property_id}`);
    } catch {
      toast.error("Failed to create property");
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <LinkButton variant="ghost" size="sm" href="/portfolio" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Properties
        </LinkButton>
        <h1 className="text-2xl font-bold">Add Property</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Toronto"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Input
                  value={form.province}
                  onChange={(e) => set("province", e.target.value)}
                  placeholder="ON"
                  required
                />
              </div>
            </div>

            {/* Property Data Lookup */}
            {form.address && form.city && (
              <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/30 p-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Auto-populate fields from municipal data, MLS, and AI estimates
                </p>
                <PropertyLookup
                  address={form.address}
                  city={form.city}
                  onApply={(fields) => {
                    setForm((f) => ({
                      ...f,
                      ...(fields.assessed_value != null ? { assessed_value: fields.assessed_value } : {}),
                      ...(fields.current_market_value != null ? { current_market_value: fields.current_market_value } : {}),
                      ...(fields.lot_size != null ? { lot_size: fields.lot_size } : {}),
                      ...(fields.zoning != null ? { zoning: fields.zoning } : {}),
                      ...(fields.max_buildable_area != null ? { max_buildable_area: fields.max_buildable_area } : {}),
                    }));
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>LP Fund</Label>
                <Select
                  value={form.lp_id ? String(form.lp_id) : ""}
                  onValueChange={(v) => set("lp_id", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select LP Fund" />
                  </SelectTrigger>
                  <SelectContent>
                    {lpOptions.map((lp) => (
                      <SelectItem key={lp.lp_id} value={String(lp.lp_id)}>
                        {lp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Community</Label>
                <Select
                  value={form.community_id ? String(form.community_id) : ""}
                  onValueChange={(v) => set("community_id", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Community" />
                  </SelectTrigger>
                  <SelectContent>
                    {communityOptions.map((c) => (
                      <SelectItem key={c.community_id} value={String(c.community_id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => set("purchase_date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase Price (CAD)</Label>
                <Input
                  type="number"
                  value={form.purchase_price || ""}
                  onChange={(e) => set("purchase_price", e.target.value)}
                  placeholder="1000000"
                  min={0}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assessed Value (CAD)</Label>
                <Input
                  type="number"
                  value={form.assessed_value || ""}
                  onChange={(e) => set("assessed_value", e.target.value)}
                  placeholder="600000"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Current Market Value (CAD)</Label>
                <Input
                  type="number"
                  value={form.current_market_value || ""}
                  onChange={(e) => set("current_market_value", e.target.value)}
                  placeholder="700000"
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lot Size (sqft, optional)</Label>
                <Input
                  type="number"
                  value={form.lot_size || ""}
                  onChange={(e) => set("lot_size", e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Buildable Area (sqft, optional)</Label>
                <Input
                  type="number"
                  value={form.max_buildable_area || ""}
                  onChange={(e) => set("max_buildable_area", e.target.value)}
                  placeholder="4000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zoning (optional)</Label>
                <Input
                  value={form.zoning || ""}
                  onChange={(e) => set("zoning", e.target.value)}
                  placeholder="R3"
                />
              </div>
              <div className="space-y-2">
                <Label>Development Stage</Label>
                <Select
                  value={form.development_stage}
                  onValueChange={(v) => set("development_stage", v as DevelopmentStage)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["prospect", "acquisition", "interim_operation", "planning", "construction", "lease_up", "stabilized", "exit"] as DevelopmentStage[]).map((s) => {
                      const labels: Record<string, string> = {
                        prospect: "Prospect", acquisition: "Acquisition", interim_operation: "Interim Operation",
                        planning: "Planning", construction: "Construction", lease_up: "Lease-Up",
                        stabilized: "Stabilized", exit: "Exit",
                      };
                      return (
                        <SelectItem key={s} value={s}>
                          {labels[s] ?? s}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Property"}
              </Button>
              <LinkButton variant="outline" href="/portfolio">Cancel</LinkButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
