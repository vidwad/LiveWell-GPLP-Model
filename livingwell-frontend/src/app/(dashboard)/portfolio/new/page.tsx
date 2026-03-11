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
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

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

  const set = (k: keyof PropertyCreate, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const prop = await mutateAsync({
        ...form,
        purchase_price: Number(form.purchase_price),
        lot_size: form.lot_size ? Number(form.lot_size) : undefined,
        max_buildable_area: form.max_buildable_area
          ? Number(form.max_buildable_area)
          : undefined,
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
          Back to Portfolio
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
                    {(["acquisition", "planning", "construction", "operational"] as DevelopmentStage[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
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
