"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useCreateCommunity } from "@/hooks/useCommunities";
import { CommunityType } from "@/types/community";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewCommunityPage() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateCommunity();

  const [name, setName] = useState("");
  const [communityType, setCommunityType] = useState<CommunityType>("RecoverWell");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("Alberta");
  const [description, setDescription] = useState("");
  const [hasMealPlan, setHasMealPlan] = useState(false);
  const [mealPlanCost, setMealPlanCost] = useState("");
  const [targetOccupancy, setTargetOccupancy] = useState("95");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const c = await mutateAsync({
        name,
        community_type: communityType,
        city,
        province,
        description: description || undefined,
        has_meal_plan: hasMealPlan,
        meal_plan_monthly_cost: hasMealPlan && mealPlanCost ? Number(mealPlanCost) : undefined,
        target_occupancy_percent: targetOccupancy ? Number(targetOccupancy) : undefined,
      } as any);
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
                placeholder="RecoverWell Calgary"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Calgary"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Alberta"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the community purpose and focus..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Occupancy (%)</Label>
              <Input
                type="number"
                value={targetOccupancy}
                onChange={(e) => setTargetOccupancy(e.target.value)}
                placeholder="95"
                min={0}
                max={100}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="meal-plan"
                checked={hasMealPlan}
                onChange={(e) => setHasMealPlan(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="meal-plan">Has Meal Plan</Label>
            </div>
            {hasMealPlan && (
              <div className="space-y-2">
                <Label>Meal Plan Monthly Cost ($)</Label>
                <Input
                  type="number"
                  value={mealPlanCost}
                  onChange={(e) => setMealPlanCost(e.target.value)}
                  placeholder="350"
                  min={0}
                  step="0.01"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending || !name || !city}>
                {isPending ? "Creating..." : "Create"}
              </Button>
              <LinkButton variant="outline" href="/communities">Cancel</LinkButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
