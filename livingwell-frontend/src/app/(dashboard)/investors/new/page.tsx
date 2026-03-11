"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
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
    name: "",
    email: "",
    accredited_status: "accredited",
    phone: "",
    user_id: null as number | null,
  });

  const set = (k: string, v: string | null) => setForm((f) => ({ ...f, [k]: v ?? "" }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = await mutateAsync(form as any);
      toast.success("Investor added");
      router.push(`/investors/${inv.investor_id}`);
    } catch {
      toast.error("Failed to create investor");
    }
  };

  return (
    <div className="max-w-lg">
      <LinkButton variant="ghost" size="sm" href="/investors" className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </LinkButton>
      <h1 className="mb-6 text-2xl font-bold">Add Investor</h1>
      <Card>
        <CardHeader>
          <CardTitle>Investor Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Accredited Status</Label>
              <Select
                value={form.accredited_status}
                onValueChange={(v) => set("accredited_status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accredited">Accredited</SelectItem>
                  <SelectItem value="non_accredited">Non-Accredited</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Add Investor"}
              </Button>
              <LinkButton variant="outline" href="/investors">Cancel</LinkButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
