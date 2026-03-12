"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { useInvestorDashboard, useContributions, useAddContribution, useAddOwnership, useCreateDistribution } from "@/hooks/useInvestors";
import { useProperties } from "@/hooks/usePortfolio";
import { useAuth } from "@/providers/AuthProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { DistributionMethod } from "@/types/investor";

export default function InvestorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const investorId = Number(id);
  const { user } = useAuth();

  const { data: dashboard, isLoading } = useInvestorDashboard(investorId);
  const { data: contributions } = useContributions(investorId);
  const { data: properties } = useProperties();
  const { mutateAsync: addContribution, isPending: contribPending } = useAddContribution(investorId);
  const { mutateAsync: addOwnership, isPending: ownPending } = useAddOwnership(investorId);
  const { mutateAsync: createDistribution, isPending: distPending } = useCreateDistribution();

  const canManage = user?.role === "GP_ADMIN" || user?.role === "OPERATIONS_MANAGER";

  const [contribOpen, setContribOpen] = useState(false);
  const [contribForm, setContribForm] = useState({ amount: 0, date: "", notes: "" });

  const [ownOpen, setOwnOpen] = useState(false);
  const [ownForm, setOwnForm] = useState({ property_id: 0, ownership_percent: 0 });

  const [distOpen, setDistOpen] = useState(false);
  const [distForm, setDistForm] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split("T")[0],
    method: "eTransfer" as DistributionMethod,
    notes: "",
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!dashboard) return <p>Investor not found.</p>;

  const { investor, total_contributed, total_distributed, net_position, ownership_positions, recent_distributions } = dashboard;

  const handleAddContrib = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addContribution(contribForm);
      toast.success("Contribution recorded");
      setContribOpen(false);
    } catch {
      toast.error("Failed to record contribution");
    }
  };

  const handleAddOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addOwnership(ownForm);
      toast.success("Ownership added");
      setOwnOpen(false);
    } catch {
      toast.error("Failed to add ownership");
    }
  };

  const handleAddDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDistribution({ investor_id: investorId, ...distForm });
      toast.success("Distribution recorded");
      setDistOpen(false);
    } catch {
      toast.error("Failed to record distribution");
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <LinkButton variant="ghost" size="sm" href="/investors" className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </LinkButton>
        <h1 className="text-2xl font-bold">{investor.name}</h1>
        <p className="text-muted-foreground">{investor.email}</p>
      </div>

      {/* KPI Summary */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Total Contributed", value: formatCurrency(total_contributed) },
          { label: "Total Distributed", value: formatCurrency(total_distributed) },
          { label: "Net Position", value: formatCurrency(net_position) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ownership */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ownership Positions</CardTitle>
            {user?.role === "GP_ADMIN" && (
              <Dialog open={ownOpen} onOpenChange={setOwnOpen}>
                <DialogTrigger className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Ownership</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddOwnership} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Property</Label>
                      <Select
                        value={String(ownForm.property_id)}
                        onValueChange={(v) => setOwnForm((f) => ({ ...f, property_id: Number(v) }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select property…" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties?.map((p) => (
                            <SelectItem key={p.property_id} value={String(p.property_id)}>
                              {p.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ownership % (e.g. 10.5)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={ownForm.ownership_percent || ""}
                        onChange={(e) =>
                          setOwnForm((f) => ({ ...f, ownership_percent: Number(e.target.value) }))
                        }
                        required
                      />
                    </div>
                    <Button type="submit" disabled={ownPending}>
                      {ownPending ? "Adding…" : "Add"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {ownership_positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ownership positions.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Ownership %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ownership_positions.map((o) => (
                    <TableRow key={o.ownership_id}>
                      <TableCell>
                        {properties?.find((p) => p.property_id === o.property_id)?.address ??
                          `Property #${o.property_id}`}
                      </TableCell>
                      <TableCell>{Number(o.ownership_percent).toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Contributions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Contributions</CardTitle>
            {canManage && (
              <Dialog open={contribOpen} onOpenChange={setContribOpen}>
                <DialogTrigger className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Contribution</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddContrib} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Amount (CAD)</Label>
                      <Input
                        type="number"
                        value={contribForm.amount || ""}
                        onChange={(e) =>
                          setContribForm((f) => ({ ...f, amount: Number(e.target.value) }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={contribForm.date}
                        onChange={(e) => setContribForm((f) => ({ ...f, date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Input
                        value={contribForm.notes}
                        onChange={(e) => setContribForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" disabled={contribPending}>
                      {contribPending ? "Saving…" : "Record"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!contributions || contributions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contributions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributions.map((c) => (
                    <TableRow key={c.contribution_id}>
                      <TableCell>{formatDate(c.date)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(c.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{c.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Distributions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Distributions</CardTitle>
            {canManage && (
              <Dialog open={distOpen} onOpenChange={setDistOpen}>
                <DialogTrigger className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  <Plus className="mr-2 h-4 w-4" />
                  Distribution
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Distribution</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddDistribution} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Amount (CAD)</Label>
                      <Input
                        type="number"
                        value={distForm.amount || ""}
                        onChange={(e) =>
                          setDistForm((f) => ({ ...f, amount: Number(e.target.value) }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Date</Label>
                      <Input
                        type="date"
                        value={distForm.payment_date}
                        onChange={(e) =>
                          setDistForm((f) => ({ ...f, payment_date: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Method</Label>
                      <Select
                        value={distForm.method}
                        onValueChange={(v) =>
                          setDistForm((f) => ({ ...f, method: v as DistributionMethod }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["eTransfer", "Wire", "ACH"] as DistributionMethod[]).map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Input
                        value={distForm.notes}
                        onChange={(e) => setDistForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" disabled={distPending}>
                      {distPending ? "Saving…" : "Record"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {recent_distributions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No distributions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent_distributions.map((d) => (
                    <TableRow key={d.distribution_id}>
                      <TableCell>{formatDate(d.payment_date)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(d.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{d.method}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
