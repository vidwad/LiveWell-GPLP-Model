"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Calculator } from "lucide-react";
import { useProperty, useDevelopmentPlans, useCreatePlan, useDeleteProperty } from "@/hooks/usePortfolio";
import { useAuth } from "@/providers/AuthProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { DevelopmentPlanCreate } from "@/types/portfolio";

export default function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const propertyId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const { data: property, isLoading } = useProperty(propertyId);
  const { data: plans } = useDevelopmentPlans(propertyId);
  const { mutateAsync: createPlan, isPending: planPending } = useCreatePlan(propertyId);
  const { mutateAsync: deleteProperty, isPending: deletePending } = useDeleteProperty();

  const [planOpen, setPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState<DevelopmentPlanCreate>({
    planned_units: 0,
    planned_beds: 0,
    planned_sqft: 0,
    estimated_construction_cost: 0,
    development_start_date: "",
    construction_duration_days: 0,
  });

  const canEdit =
    user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPlan(planForm);
      toast.success("Development plan added");
      setPlanOpen(false);
    } catch {
      toast.error("Failed to add plan");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    try {
      await deleteProperty(propertyId);
      toast.success("Property deleted");
      router.push("/portfolio");
    } catch {
      toast.error("Failed to delete property");
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!property) return <p>Property not found.</p>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <LinkButton variant="ghost" size="sm" href="/portfolio" className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </LinkButton>
          <h1 className="text-2xl font-bold">{property.address}</h1>
          <p className="text-muted-foreground">
            {property.city}, {property.province}
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton variant="outline" href={`/portfolio/${propertyId}/model`}>
            <Calculator className="mr-2 h-4 w-4" />
            Model
          </LinkButton>
          {canEdit && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deletePending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Development Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Purchase Price</dt>
                  <dd className="font-medium">{formatCurrency(property.purchase_price)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Purchase Date</dt>
                  <dd className="font-medium">{formatDate(property.purchase_date)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Development Stage</dt>
                  <dd>
                    <Badge variant="outline">{property.development_stage}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Zoning</dt>
                  <dd className="font-medium">{property.zoning ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Lot Size</dt>
                  <dd className="font-medium">
                    {property.lot_size ? `${Number(property.lot_size).toLocaleString()} sqft` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Max Buildable Area</dt>
                  <dd className="font-medium">
                    {property.max_buildable_area
                      ? `${Number(property.max_buildable_area).toLocaleString()} sqft`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Development Plans</CardTitle>
              {canEdit && (
                <Dialog open={planOpen} onOpenChange={setPlanOpen}>
                  <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Plan
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Development Plan</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddPlan} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Planned Units</Label>
                          <Input
                            type="number"
                            value={planForm.planned_units || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({ ...f, planned_units: Number(e.target.value) }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Beds</Label>
                          <Input
                            type="number"
                            value={planForm.planned_beds || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({ ...f, planned_beds: Number(e.target.value) }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Sqft</Label>
                          <Input
                            type="number"
                            value={planForm.planned_sqft || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({ ...f, planned_sqft: Number(e.target.value) }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Est. Construction Cost</Label>
                          <Input
                            type="number"
                            value={planForm.estimated_construction_cost || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({
                                ...f,
                                estimated_construction_cost: Number(e.target.value),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={planForm.development_start_date}
                            onChange={(e) =>
                              setPlanForm((f) => ({
                                ...f,
                                development_start_date: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (days)</Label>
                          <Input
                            type="number"
                            value={planForm.construction_duration_days || ""}
                            onChange={(e) =>
                              setPlanForm((f) => ({
                                ...f,
                                construction_duration_days: Number(e.target.value),
                              }))
                            }
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={planPending}>
                        {planPending ? "Adding…" : "Add Plan"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!plans || plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No development plans yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Units</TableHead>
                      <TableHead>Beds</TableHead>
                      <TableHead>Sqft</TableHead>
                      <TableHead>Est. Cost</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.plan_id}>
                        <TableCell>{plan.planned_units}</TableCell>
                        <TableCell>{plan.planned_beds}</TableCell>
                        <TableCell>{Number(plan.planned_sqft).toLocaleString()}</TableCell>
                        <TableCell>{formatCurrency(plan.estimated_construction_cost)}</TableCell>
                        <TableCell>{formatDate(plan.development_start_date)}</TableCell>
                        <TableCell>{plan.construction_duration_days} days</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
