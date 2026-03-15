"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertyManagers } from "@/lib/api";
import type { PropertyManager, PropertyManagerCreate } from "@/types/portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Building2, Phone, Mail } from "lucide-react";

function fmt(v: string | null) {
  if (!v) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

export default function PropertyManagersPage() {
  const qc = useQueryClient();
  const { data: pms = [], isLoading } = useQuery({
    queryKey: ["property-managers"],
    queryFn: propertyManagers.getAll,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyManager | null>(null);
  const [form, setForm] = useState<PropertyManagerCreate>({
    name: "",
  });

  const createMut = useMutation({
    mutationFn: (data: PropertyManagerCreate) => propertyManagers.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["property-managers"] }); setDialogOpen(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PropertyManagerCreate> }) =>
      propertyManagers.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["property-managers"] }); setDialogOpen(false); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => propertyManagers.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["property-managers"] }),
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "" });
    setDialogOpen(true);
  }
  function openEdit(pm: PropertyManager) {
    setEditing(pm);
    setForm({
      name: pm.name,
      contact_email: pm.contact_email ?? undefined,
      contact_phone: pm.contact_phone ?? undefined,
      address: pm.address ?? undefined,
      management_fee_percent: pm.management_fee_percent ? parseFloat(pm.management_fee_percent) : undefined,
      contract_start_date: pm.contract_start_date ?? undefined,
      contract_end_date: pm.contract_end_date ?? undefined,
      notes: pm.notes ?? undefined,
    });
    setDialogOpen(true);
  }
  function handleSave() {
    if (editing) {
      updateMut.mutate({ id: editing.pm_id, data: form });
    } else {
      createMut.mutate(form);
    }
  }
  function handleDelete(pm: PropertyManager) {
    if (confirm(`Delete ${pm.name}? This cannot be undone.`)) {
      deleteMut.mutate(pm.pm_id);
    }
  }

  const set = (field: keyof PropertyManagerCreate, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading property managers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Property Managers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Third-party companies managing the physical buildings — maintenance, inspections, rent collection.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Add Property Manager
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total PMs</p>
            <p className="text-2xl font-bold">{pms.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Properties Managed</p>
            <p className="text-2xl font-bold">{pms.reduce((s, p) => s + p.property_count, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Fee</p>
            <p className="text-2xl font-bold">
              {pms.length > 0
                ? (pms.reduce((s, p) => s + (p.management_fee_percent ? parseFloat(p.management_fee_percent) : 0), 0) / pms.filter(p => p.management_fee_percent).length).toFixed(1) + "%"
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PM Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pms.map((pm) => (
          <Card key={pm.pm_id}>
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  {pm.name}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {pm.management_fee_percent && (
                    <Badge variant="outline">{pm.management_fee_percent}% fee</Badge>
                  )}
                  <Badge variant="secondary">{pm.property_count} properties</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(pm)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(pm)} disabled={pm.property_count > 0}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pm.contact_email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> {pm.contact_email}
                </div>
              )}
              {pm.contact_phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {pm.contact_phone}
                </div>
              )}
              {pm.address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" /> {pm.address}
                </div>
              )}
              {pm.contract_start_date && (
                <p className="text-muted-foreground">
                  Contract: {pm.contract_start_date}{pm.contract_end_date ? ` → ${pm.contract_end_date}` : " → ongoing"}
                </p>
              )}
              {pm.notes && <p className="text-muted-foreground italic">{pm.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Property Manager" : "Add Property Manager"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Company Name *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value || undefined)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value || undefined)} />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value || undefined)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Mgmt Fee %</Label>
                <Input type="number" step="0.1" value={form.management_fee_percent ?? ""} onChange={(e) => set("management_fee_percent", e.target.value ? parseFloat(e.target.value) : undefined)} />
              </div>
              <div>
                <Label>Contract Start</Label>
                <Input type="date" value={form.contract_start_date ?? ""} onChange={(e) => set("contract_start_date", e.target.value || undefined)} />
              </div>
              <div>
                <Label>Contract End</Label>
                <Input type="date" value={form.contract_end_date ?? ""} onChange={(e) => set("contract_end_date", e.target.value || undefined)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || undefined)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || createMut.isPending || updateMut.isPending}>
              {editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
