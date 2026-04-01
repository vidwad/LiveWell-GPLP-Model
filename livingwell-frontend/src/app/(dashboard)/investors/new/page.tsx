"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useCreateInvestor } from "@/hooks/useInvestors";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewInvestorPage() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateInvestor();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    email: "",
    phone: "",
    mobile: "",
    street_address: "",
    street_address_2: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Canada",
    entity_type: "individual",
    accredited_status: "pending",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    try {
      const payload: Record<string, string | null> = { ...form };
      // Clean empty strings to null
      for (const k of Object.keys(payload)) {
        if (payload[k] === "") payload[k] = null;
      }
      // Ensure required fields
      payload.first_name = form.first_name.trim();
      payload.last_name = form.last_name.trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = await mutateAsync(payload as any);
      toast.success("Investor added");
      router.push(`/investors/${inv.investor_id}`);
    } catch {
      toast.error("Failed to create investor");
    }
  };

  return (
    <div className="max-w-2xl">
      <LinkButton variant="ghost" size="sm" href="/investors" className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </LinkButton>
      <h1 className="mb-6 text-2xl font-bold flex items-center gap-2">
        <UserPlus className="h-6 w-6" />
        Add Investor
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name <span className="text-red-500">*</span></Label>
                <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label>Last Name <span className="text-red-500">*</span></Label>
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required placeholder="Smith" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company / Trust Name</Label>
              <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Optional — e.g. Smith Family Trust" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity Type <span className="text-red-500">*</span></Label>
                <Select value={form.entity_type} onValueChange={(v) => set("entity_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="corporation">Corporation</SelectItem>
                    <SelectItem value="trust">Trust</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Accredited Status <span className="text-red-500">*</span></Label>
                <Select value={form.accredited_status} onValueChange={(v) => set("accredited_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accredited">Accredited</SelectItem>
                    <SelectItem value="non_accredited">Non-Accredited</SelectItem>
                    <SelectItem value="pending">Pending Verification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required placeholder="john@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(604) 555-0123" />
              </div>
              <div className="space-y-2">
                <Label>Mobile / Cell</Label>
                <Input type="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="(604) 555-0456" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input value={form.street_address} onChange={(e) => set("street_address", e.target.value)} placeholder="123 Main Street" />
            </div>
            <div className="space-y-2">
              <Label>Street Address 2</Label>
              <Input value={form.street_address_2} onChange={(e) => set("street_address_2", e.target.value)} placeholder="Suite, Unit, Floor (optional)" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Calgary" />
              </div>
              <div className="space-y-2">
                <Label>Province / State</Label>
                <Input value={form.province} onChange={(e) => set("province", e.target.value)} placeholder="Alberta" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="T2P 1A1" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Canada" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className="px-8">
            {isPending ? "Creating…" : "Add Investor"}
          </Button>
          <LinkButton variant="outline" href="/investors">Cancel</LinkButton>
        </div>
      </form>
    </div>
  );
}
