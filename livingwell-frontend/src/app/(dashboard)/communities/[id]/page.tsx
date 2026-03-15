"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  useCommunity,
  useUnits,
  useCreateUnit,
  useResidents,
  useCreateResident,
  useDeleteResident,
  useRecordPayment,
} from "@/hooks/useCommunities";
import { useAuth } from "@/providers/AuthProvider";
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

  const [unitOpen, setUnitOpen] = useState(false);
  const [unitForm, setUnitForm] = useState({
    unit_number: "",
    unit_type: "studio" as UnitType,
    bed_count: 1,
    sqft: 0,
  });

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

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUnit(unitForm as any);
      toast.success("Unit added");
      setUnitOpen(false);
    } catch {
      toast.error("Failed to add unit");
    }
  };

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

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <LinkButton variant="ghost" size="sm" href="/communities" className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </LinkButton>
        <h1 className="text-2xl font-bold">{community.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline">{community.community_type}</Badge>
          <span className="text-muted-foreground text-sm">
            {community.city}, {community.province}
          </span>
        </div>
      </div>

      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">Units ({units?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="residents">Residents ({residents?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Units Tab */}
        <TabsContent value="units" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Units</CardTitle>
              {canEdit && (
                <Dialog open={unitOpen} onOpenChange={setUnitOpen}>
                  <DialogTrigger className={cn(buttonVariants({ size: "sm" }))}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Unit
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Unit</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddUnit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Unit Number</Label>
                          <Input
                            value={unitForm.unit_number}
                            onChange={(e) =>
                              setUnitForm((f) => ({ ...f, unit_number: e.target.value }))
                            }
                            placeholder="101"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={unitForm.unit_type}
                            onValueChange={(v) =>
                              setUnitForm((f) => ({ ...f, unit_type: v as UnitType }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["studio", "1br", "2br"] as UnitType[]).map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Beds</Label>
                          <Input
                            type="number"
                            value={unitForm.bed_count}
                            onChange={(e) =>
                              setUnitForm((f) => ({ ...f, bed_count: Number(e.target.value) }))
                            }
                            min={1}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Sqft</Label>
                          <Input
                            type="number"
                            value={unitForm.sqft || ""}
                            onChange={(e) =>
                              setUnitForm((f) => ({ ...f, sqft: Number(e.target.value) }))
                            }
                            required
                          />
                        </div>
                        {/* TODO: fetch bed rents — rent is now tracked per bed, not per unit */}
                      </div>
                      <Button type="submit" disabled={unitPending}>
                        {unitPending ? "Adding…" : "Add Unit"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!units || units.length === 0 ? (
                <p className="text-sm text-muted-foreground">No units yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Beds</TableHead>
                      <TableHead>Sqft</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((u) => (
                      <TableRow key={u.unit_id}>
                        <TableCell className="font-medium">{u.unit_number}</TableCell>
                        <TableCell>{u.unit_type}</TableCell>
                        <TableCell>{u.bed_count}</TableCell>
                        <TableCell>{Number(u.sqft).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={u.is_occupied ? "default" : "secondary"}>
                            {u.is_occupied ? "Occupied" : "Vacant"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
                              <SelectValue placeholder="Select unit…" />
                            </SelectTrigger>
                            <SelectContent>
                              {units
                                ?.filter((u) => !u.is_occupied)
                                .map((u) => (
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
                        {resPending ? "Adding…" : "Add Resident"}
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
                    {residents.map((r) => (
                      <TableRow key={r.resident_id}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell>
                          {units?.find((u) => u.unit_id === r.unit_id)?.unit_number ?? r.unit_id}
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
                                        {payPending ? "Recording…" : "Record Payment"}
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
    </div>
  );
}
