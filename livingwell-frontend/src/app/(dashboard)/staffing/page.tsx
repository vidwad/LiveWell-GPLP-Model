"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Trash2,
  Pencil,
  Calendar,
  Clock,
  DollarSign,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { useCommunities } from "@/hooks/useCommunities";
import {
  useStaff,
  useStaffSummary,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  useShifts,
  useWeeklySchedule,
  useCreateShift,
  useDeleteShift,
  useUpdateShift,
  StaffMember,
  ShiftRecord,
} from "@/hooks/useOperator";

const ROLE_LABELS: Record<string, string> = {
  community_manager: "Community Manager",
  house_manager: "House Manager",
  caregiver: "Caregiver",
  support_worker: "Support Worker",
  maintenance_tech: "Maintenance Tech",
  cook: "Cook",
  cleaner: "Cleaner",
  admin: "Admin",
  security: "Security",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  on_leave: "bg-amber-100 text-amber-700",
  terminated: "bg-red-100 text-red-700",
};

const SHIFT_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function formatDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

const emptyStaffForm = {
  community_id: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "support_worker",
  hourly_rate: "",
  hire_date: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  notes: "",
};

const emptyShiftForm = {
  staff_id: "",
  community_id: "",
  shift_date: "",
  start_time: "08:00",
  end_time: "16:00",
  notes: "",
};

export default function StaffingPage() {
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const communityId = communityFilter === "all" ? undefined : Number(communityFilter);

  const { data: communities } = useCommunities();
  const { data: staff, isLoading: staffLoading } = useStaff(communityId);
  const { data: summary } = useStaffSummary(communityId);

  // Week navigation for schedule
  const [weekOffset, setWeekOffset] = useState(0);
  const currentMonday = useMemo(() => {
    const d = getMonday(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);
  const weekStart = formatDateStr(currentMonday);
  const weekEnd = formatDateStr(new Date(currentMonday.getTime() + 6 * 24 * 3600 * 1000));

  const { data: shifts } = useShifts({
    community_id: communityId,
    start_date: weekStart,
    end_date: weekEnd,
  });
  const { data: weeklySummary } = useWeeklySchedule(communityId, weekStart);

  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);

  function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    createStaff.mutate(
      {
        community_id: Number(staffForm.community_id),
        first_name: staffForm.first_name,
        last_name: staffForm.last_name,
        email: staffForm.email || undefined,
        phone: staffForm.phone || undefined,
        role: staffForm.role,
        hourly_rate: staffForm.hourly_rate ? Number(staffForm.hourly_rate) : undefined,
        hire_date: staffForm.hire_date || undefined,
        emergency_contact_name: staffForm.emergency_contact_name || undefined,
        emergency_contact_phone: staffForm.emergency_contact_phone || undefined,
        notes: staffForm.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Staff member added");
          setStaffForm(emptyStaffForm);
          setStaffOpen(false);
        },
        onError: () => toast.error("Failed to add staff"),
      }
    );
  }

  function handleDeleteStaff(id: number) {
    if (!confirm("Remove this staff member?")) return;
    deleteStaff.mutate(id, {
      onSuccess: () => toast.success("Staff member removed"),
      onError: () => toast.error("Failed to remove"),
    });
  }

  function handleAddShift(e: React.FormEvent) {
    e.preventDefault();
    createShift.mutate(
      {
        staff_id: Number(shiftForm.staff_id),
        community_id: shiftForm.community_id ? Number(shiftForm.community_id) : undefined,
        shift_date: shiftForm.shift_date,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        notes: shiftForm.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Shift scheduled");
          setShiftForm(emptyShiftForm);
          setShiftOpen(false);
        },
        onError: () => toast.error("Failed to schedule shift"),
      }
    );
  }

  function handleShiftStatus(shiftId: number, status: string) {
    updateShift.mutate(
      { shiftId, data: { status } },
      {
        onSuccess: () => toast.success(`Shift ${status}`),
        onError: () => toast.error("Failed to update"),
      }
    );
  }

  // Days of the week for schedule grid
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staffing & Scheduling</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff members and schedule shifts across communities
          </p>
        </div>
        <div className="flex items-center gap-3">
          {communities && communities.length > 1 && (
            <Select value={communityFilter} onValueChange={setCommunityFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Communities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Communities</SelectItem>
                {communities.map((c: { community_id: number; name: string }) => (
                  <SelectItem key={c.community_id} value={String(c.community_id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Active Staff</p>
            <p className="text-xl font-bold">{summary?.total_active ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {Object.keys(summary?.by_community ?? {}).length} communit{Object.keys(summary?.by_community ?? {}).length === 1 ? "y" : "ies"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">This Week</p>
            <p className="text-xl font-bold">{weeklySummary?.total_shifts ?? 0} shifts</p>
            <p className="text-xs text-muted-foreground">{weeklySummary?.total_hours ?? 0} hours</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Weekly Cost</p>
            <p className="text-xl font-bold">{formatCurrency(weeklySummary?.total_estimated_cost ?? summary?.estimated_weekly_cost ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Estimated</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Monthly Cost</p>
            <p className="text-xl font-bold">{formatCurrency(summary?.estimated_monthly_cost ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Estimated</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff"><Users className="h-4 w-4 mr-1.5" />Staff Directory</TabsTrigger>
          <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-1.5" />Schedule</TabsTrigger>
          <TabsTrigger value="weekly"><Clock className="h-4 w-4 mr-1.5" />Weekly Summary</TabsTrigger>
        </TabsList>

        {/* ── Staff Directory ── */}
        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Staff Members</CardTitle>
              <Dialog open={staffOpen} onOpenChange={(open) => { setStaffOpen(open); if (!open) setStaffForm(emptyStaffForm); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><UserPlus className="h-4 w-4 mr-1.5" />Add Staff</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddStaff} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Community</Label>
                        <Select value={staffForm.community_id} onValueChange={(v) => setStaffForm((f) => ({ ...f, community_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            {communities?.map((c: { community_id: number; name: string }) => (
                              <SelectItem key={c.community_id} value={String(c.community_id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">First Name</Label>
                        <Input value={staffForm.first_name} onChange={(e) => setStaffForm((f) => ({ ...f, first_name: e.target.value }))} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Last Name</Label>
                        <Input value={staffForm.last_name} onChange={(e) => setStaffForm((f) => ({ ...f, last_name: e.target.value }))} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Role</Label>
                        <Select value={staffForm.role} onValueChange={(v) => setStaffForm((f) => ({ ...f, role: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hourly Rate ($)</Label>
                        <Input type="number" step="0.01" value={staffForm.hourly_rate} onChange={(e) => setStaffForm((f) => ({ ...f, hourly_rate: e.target.value }))} placeholder="25.00" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input type="email" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input value={staffForm.phone} onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hire Date</Label>
                        <Input type="date" value={staffForm.hire_date} onChange={(e) => setStaffForm((f) => ({ ...f, hire_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Emergency Contact</Label>
                        <Input value={staffForm.emergency_contact_name} onChange={(e) => setStaffForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} placeholder="Name" />
                      </div>
                    </div>
                    <Button type="submit" disabled={createStaff.isPending} className="w-full">
                      {createStaff.isPending ? "Adding..." : "Add Staff Member"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <Skeleton className="h-32" />
              ) : !staff || staff.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No staff members yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Community</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Hired</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.map((s: StaffMember) => (
                        <TableRow key={s.staff_id}>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {ROLE_LABELS[s.role] ?? s.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.community_name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-xs", STATUS_COLORS[s.status])}>
                              {s.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.hourly_rate ? `$${s.hourly_rate}/hr` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.email || s.phone || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.hire_date ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteStaff(s.staff_id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Schedule ── */}
        <TabsContent value="schedule" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2">
                {currentMonday.toLocaleDateString("en-CA", { month: "short", day: "numeric" })} — {new Date(currentMonday.getTime() + 6 * 24 * 3600 * 1000).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
              )}
            </div>
            <Dialog open={shiftOpen} onOpenChange={(open) => { setShiftOpen(open); if (!open) setShiftForm(emptyShiftForm); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Shift</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Schedule Shift</DialogTitle></DialogHeader>
                <form onSubmit={handleAddShift} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Staff Member</Label>
                      <Select value={shiftForm.staff_id} onValueChange={(v) => setShiftForm((f) => ({ ...f, staff_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {(staff ?? []).filter((s: StaffMember) => s.status === "active").map((s: StaffMember) => (
                            <SelectItem key={s.staff_id} value={String(s.staff_id)}>
                              {s.full_name} — {ROLE_LABELS[s.role] ?? s.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={shiftForm.shift_date} onChange={(e) => setShiftForm((f) => ({ ...f, shift_date: e.target.value }))} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={shiftForm.notes} onChange={(e) => setShiftForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start Time</Label>
                      <Input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm((f) => ({ ...f, start_time: e.target.value }))} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Time</Label>
                      <Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm((f) => ({ ...f, end_time: e.target.value }))} required />
                    </div>
                  </div>
                  <Button type="submit" disabled={createShift.isPending} className="w-full">
                    {createShift.isPending ? "Scheduling..." : "Schedule Shift"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Week Grid */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[700px]">
              {weekDays.map((day) => {
                const dateStr = formatDateStr(day);
                const dayShifts = (shifts ?? []).filter((s: ShiftRecord) => s.shift_date === dateStr);
                const isToday = dateStr === formatDateStr(new Date());

                return (
                  <Card key={dateStr} className={cn("border", isToday && "ring-2 ring-blue-400")}>
                    <CardHeader className="pb-1 pt-2 px-2">
                      <p className={cn("text-xs font-medium text-center", isToday ? "text-blue-600" : "text-muted-foreground")}>
                        {day.toLocaleDateString("en-CA", { weekday: "short" })}
                      </p>
                      <p className={cn("text-lg font-bold text-center", isToday && "text-blue-600")}>
                        {day.getDate()}
                      </p>
                    </CardHeader>
                    <CardContent className="px-2 pb-2 space-y-1">
                      {dayShifts.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2">No shifts</p>
                      ) : (
                        dayShifts.map((shift: ShiftRecord) => (
                          <div
                            key={shift.shift_id}
                            className={cn(
                              "rounded px-1.5 py-1 text-[10px] border cursor-default",
                              SHIFT_STATUS_COLORS[shift.status] ?? "bg-gray-50"
                            )}
                            title={`${shift.staff_name} — ${shift.start_time}-${shift.end_time}`}
                          >
                            <p className="font-medium truncate">{shift.staff_name}</p>
                            <p>{shift.start_time}–{shift.end_time}</p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Shift List */}
          {shifts && shifts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Shift Details</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((s: ShiftRecord) => (
                        <TableRow key={s.shift_id}>
                          <TableCell className="font-medium">{s.shift_date}</TableCell>
                          <TableCell>{s.staff_name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {ROLE_LABELS[s.staff_role ?? ""] ?? s.staff_role}
                            </Badge>
                          </TableCell>
                          <TableCell>{s.start_time}–{s.end_time}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.hours ?? "—"}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-xs", SHIFT_STATUS_COLORS[s.status])}>
                              {s.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {s.status === "scheduled" && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600" onClick={() => handleShiftStatus(s.shift_id, "completed")}>
                                  Complete
                                </Button>
                              )}
                              {s.status === "scheduled" && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => handleShiftStatus(s.shift_id, "no_show")}>
                                  No Show
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => {
                                if (!confirm("Delete this shift?")) return;
                                deleteShift.mutate(s.shift_id, {
                                  onSuccess: () => toast.success("Shift deleted"),
                                });
                              }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Weekly Summary ── */}
        <TabsContent value="weekly" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Weekly Summary — {weeklySummary?.week_start} to {weeklySummary?.week_end}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!weeklySummary || weeklySummary.staff.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No shifts scheduled for this week.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Shifts</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-right">Est. Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklySummary.staff.map((s) => (
                        <TableRow key={s.staff_id}>
                          <TableCell className="font-medium">{s.staff_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {ROLE_LABELS[s.role ?? ""] ?? s.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{s.total_shifts}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.total_hours}h</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatCurrency(s.estimated_cost)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums">{weeklySummary.total_shifts}</TableCell>
                        <TableCell className="text-right tabular-nums">{weeklySummary.total_hours}h</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(weeklySummary.total_estimated_cost)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
