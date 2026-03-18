"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Building2, ChevronRight } from "lucide-react";
import {
  useCommunity,
  useUnits,
  useCommunityProperties,
  useCreateUnit,
  useResidents,
  useCreateResident,
  useDeleteResident,
  useRecordPayment,
} from "@/hooks/useCommunities";
import { useAuth } from "@/providers/AuthProvider";
import { TrendChart } from "@/components/charts/TrendChart";
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { UnitType, RentType } from "@/types/community";
import Link from "next/link";

interface CommunityProperty {
  property_id: number;
  address: string;
  city: string;
  development_stage: string | null;
  total_units: number;
  total_beds: number;
  occupied_beds: number;
  vacant_beds: number;
  occupancy_rate: number;
  monthly_rent: number;
}

export default function CommunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const communityId = Number(id);
  const { user } = useAuth();

  const { data: community, isLoading } = useCommunity(communityId);
  const { data: units } = useUnits(communityId);
  const { data: communityProperties } = useCommunityProperties(communityId);
  const { data: residents } = useResidents(communityId);
  const { mutateAsync: createUnit, isPending: unitPending } = useCreateUnit(communityId);
  const { mutateAsync: createResident, isPending: resPending } = useCreateResident(communityId);
  const { mutateAsync: deleteResident } = useDeleteResident(communityId);
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);
  const { mutateAsync: recordPayment, isPending: payPending } = useRecordPayment(
    selectedResidentId ?? 0
  );

  const canEdit =
    user?.role === "GP_ADMIN" ||
    user?.role === "OPERATIONS_MANAGER" ||
    user?.role === "PROPERTY_MANAGER";

  const [resOpen, setResOpen] = useState(false);
  const [resForm, setResForm] = useState({
    unit_id: 0,
    full_name: "",
    email: "",
    phone: "",
    bed_number: "1",
    rent_type: "private_pay" as RentType,
    move_in_date: "",
    move_out_date: null as string | null,
  });

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split("T")[0],
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!community) return <p>Community not found.</p>;

  const props = (communityProperties ?? []) as CommunityProperty[];
  const totalUnits = props.reduce((s, p) => s + p.total_units, 0);
  const totalBeds = props.reduce((s, p) => s + p.total_beds, 0);
  const occupiedBeds = props.reduce((s, p) => s + p.occupied_beds, 0);
  const totalRent = props.reduce((s, p) => s + p.monthly_rent, 0);
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100 * 10) / 10 : 0;

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createResident(resForm as any);
      toast.success("Resident added");
      setResOpen(false);
    } catch {
      toast.error("Failed to add resident");
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordPayment(payForm);
      toast.success("Payment recorded");
      setPayOpen(false);
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const stageBadgeColor = (stage: string | null) => {
    switch (stage) {
      case "stabilized": return "default";
      case "construction": return "destructive";
      case "lease_up": return "secondary";
      case "interim_operation": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <LinkButton variant="ghost" size="sm" href="/communities" className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Communities
        </LinkButton>
        <h1 className="text-2xl font-bold">{community.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline">{community.community_type}</Badge>
          <span className="text-muted-foreground text-sm">
            {community.city}, {community.province}
          </span>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Properties</p>
            <p className="text-2xl font-bold">{props.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Units</p>
            <p className="text-2xl font-bold">{totalUnits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Beds</p>
            <p className="text-2xl font-bold">{totalBeds}</p>
            <p className="text-xs text-muted-foreground">{occupiedBeds} occupied / {totalBeds - occupiedBeds} available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Occupancy Rate</p>
            <p className={cn("text-2xl font-bold", occupancyRate >= 90 ? "text-green-600" : occupancyRate >= 70 ? "text-yellow-600" : "text-red-600")}>
              {occupancyRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Monthly Rent</p>
            <p className="text-2xl font-bold">{formatCurrency(totalRent)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties">Properties ({props.length})</TabsTrigger>
          <TabsTrigger value="residents">Residents ({residents?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Properties Tab */}
        <TabsContent value="properties" className="mt-4 space-y-3">
          {props.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No properties assigned to this community yet.</p>
                <p className="text-sm mt-1">Assign properties from the Portfolio page.</p>
              </CardContent>
            </Card>
          ) : (
            props.map((p) => (
              <Link key={p.property_id} href={`/portfolio/${p.property_id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{p.address}</h3>
                          {p.development_stage && (
                            <Badge variant={stageBadgeColor(p.development_stage) as any}>
                              {p.development_stage.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Units</span>
                            <p className="font-medium">{p.total_units}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Beds</span>
                            <p className="font-medium">{p.total_beds}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Occupied</span>
                            <p className="font-medium">{p.occupied_beds} / {p.total_beds}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Occupancy</span>
                            <p className={cn("font-medium", p.occupancy_rate >= 90 ? "text-green-600" : p.occupancy_rate >= 70 ? "text-yellow-600" : "text-red-600")}>
                              {p.occupancy_rate}%
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Monthly Rent</span>
                            <p className="font-medium">{formatCurrency(p.monthly_rent)}</p>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* Residents Tab */}
        <TabsContent value="residents" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Residents</CardTitle>
              {canEdit && (
                <Dialog open={resOpen} onOpenChange={setResOpen}>
                  <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Resident
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Resident</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddResident} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={resForm.full_name}
                          onChange={(e) => setResForm((f) => ({ ...f, full_name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={resForm.email}
                            onChange={(e) => setResForm((f) => ({ ...f, email: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={resForm.phone}
                            onChange={(e) => setResForm((f) => ({ ...f, phone: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Unit</Label>
                          <Select
                            value={String(resForm.unit_id)}
                            onValueChange={(v) =>
                              setResForm((f) => ({ ...f, unit_id: Number(v) }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit..." />
                            </SelectTrigger>
                            <SelectContent>
                              {units
                                ?.filter((u: any) => !u.is_occupied)
                                .map((u: any) => (
                                  <SelectItem key={u.unit_id} value={String(u.unit_id)}>
                                    {u.unit_number} ({u.unit_type})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Bed Number</Label>
                          <Input
                            value={resForm.bed_number}
                            onChange={(e) =>
                              setResForm((f) => ({ ...f, bed_number: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Rent Type</Label>
                          <Select
                            value={resForm.rent_type}
                            onValueChange={(v) =>
                              setResForm((f) => ({ ...f, rent_type: v as RentType }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="private_pay">Private Pay</SelectItem>
                              <SelectItem value="government_supported">Government Supported</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Move-in Date</Label>
                          <Input
                            type="date"
                            value={resForm.move_in_date}
                            onChange={(e) =>
                              setResForm((f) => ({ ...f, move_in_date: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={resPending || !resForm.unit_id}>
                        {resPending ? "Adding..." : "Add Resident"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!residents || residents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No residents yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Rent Type</TableHead>
                      <TableHead>Move-in</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {residents.map((r: any) => (
                      <TableRow key={r.resident_id}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell>
                          {units?.find((u: any) => u.unit_id === r.unit_id)?.unit_number ?? r.unit_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {r.rent_type === "private_pay" ? "Private Pay" : "Gov. Supported"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(r.move_in_date)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {canEdit && (
                              <>
                                <Dialog
                                  open={payOpen && selectedResidentId === r.resident_id}
                                  onOpenChange={(o) => {
                                    setPayOpen(o);
                                    if (o) setSelectedResidentId(r.resident_id);
                                  }}
                                >
                                  <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                                    Payment
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Record Payment — {r.full_name}</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleRecordPayment} className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>Amount (CAD)</Label>
                                        <Input
                                          type="number"
                                          value={payForm.amount || ""}
                                          onChange={(e) =>
                                            setPayForm((f) => ({ ...f, amount: Number(e.target.value) }))
                                          }
                                          required
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Payment Date</Label>
                                        <Input
                                          type="date"
                                          value={payForm.payment_date}
                                          onChange={(e) =>
                                            setPayForm((f) => ({ ...f, payment_date: e.target.value }))
                                          }
                                          required
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label>Month</Label>
                                          <Input
                                            type="number"
                                            value={payForm.period_month}
                                            onChange={(e) =>
                                              setPayForm((f) => ({
                                                ...f,
                                                period_month: Number(e.target.value),
                                              }))
                                            }
                                            min={1}
                                            max={12}
                                            required
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Year</Label>
                                          <Input
                                            type="number"
                                            value={payForm.period_year}
                                            onChange={(e) =>
                                              setPayForm((f) => ({
                                                ...f,
                                                period_year: Number(e.target.value),
                                              }))
                                            }
                                            required
                                          />
                                        </div>
                                      </div>
                                      <Button type="submit" disabled={payPending}>
                                        {payPending ? "Recording..." : "Record Payment"}
                                      </Button>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (!confirm(`Remove ${r.full_name}?`)) return;
                                    try {
                                      await deleteResident(r.resident_id);
                                      toast.success("Resident removed");
                                    } catch {
                                      toast.error("Failed to remove resident");
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Trend Charts */}
      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        <TrendChart
          entityType="community"
          entityId={Number(params.id)}
          title="Occupancy & Revenue Trend"
          metrics={["occupancy_rate", "collected_revenue"]}
        />
        <TrendChart
          entityType="community"
          entityId={Number(params.id)}
          title="NOI & Expenses Trend"
          metrics={["noi", "total_expenses"]}
        />
      </div>
    </div>
  );
}
