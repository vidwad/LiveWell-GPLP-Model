"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useCreateCommunity } from "@/hooks/useCommunities";
import { useProperties } from "@/hooks/usePortfolio";
import { CommunityType } from "@/types/community";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewCommunityPage() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateCommunity();
  const { data: properties } = useProperties();

  const [name, setName] = useState("");
  const [communityType, setCommunityType] = useState<CommunityType>("RecoverWell");
  const [propertyId, setPropertyId] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const c = await mutateAsync({ name, community_type: communityType, property_id: propertyId } as any);
      toast.success("Community created");
      router.push(`/communities/${c.community_id}`);
    } catch {
      toast.error("Failed to create community");
    }
  };

  return (
    <div className="max-w-lg">
      <LinkButton variant="ghost" size="sm" href="/communities" className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </LinkButton>
      <h1 className="mb-6 text-2xl font-bold">New Community</h1>
      <Card>
        <CardHeader>
          <CardTitle>Community Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="RecoverWell North"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={communityType}
                onValueChange={(v) => setCommunityType(v as CommunityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["RecoverWell", "StudyWell", "RetireWell"] as CommunityType[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={String(propertyId)}
                onValueChange={(v) => setPropertyId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property…" />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.property_id} value={String(p.property_id)}>
                      {p.address}, {p.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending || !propertyId}>
                {isPending ? "Creating…" : "Create"}
              </Button>
              <LinkButton variant="outline" href="/communities">Cancel</LinkButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
