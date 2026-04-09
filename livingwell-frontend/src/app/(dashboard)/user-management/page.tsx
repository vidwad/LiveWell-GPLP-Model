"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UserPlus,
  Mail,
  Shield,
  Users,
  Copy,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/errors";
import { UserRole } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/* ── Types ──────────────────────────────────────────────────────────── */

interface PlatformUser {
  user_id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

interface Invitation {
  invitation_id: string;
  email: string;
  role: UserRole;
  status: "pending" | "accepted" | "expired" | "revoked";
  invited_by_name: string | null;
  created_at: string;
  invite_link?: string;
}

interface InviteFormData {
  email: string;
  full_name: string;
  role: UserRole;
  personal_message: string;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: "GP_ADMIN", label: "GP Admin" },
  { value: "OPERATIONS_MANAGER", label: "Operations Manager" },
  { value: "PROPERTY_MANAGER", label: "Property Manager" },
  { value: "INVESTOR", label: "Investor" },
  { value: "PARTNER", label: "Partner" },
];

const ROLE_LABELS: Record<string, string> = {
  GP_ADMIN: "GP Admin",
  OPERATIONS_MANAGER: "Ops Manager",
  PROPERTY_MANAGER: "Property Mgr",
  INVESTOR: "Investor",
  PARTNER: "Partner",
  RESIDENT: "Resident",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  expired: "bg-red-100 text-red-800 border-red-200",
  revoked: "bg-gray-100 text-gray-500 border-gray-200",
};

/* ── Users Tab ─────────────────────────────────────────────────────── */

function UsersTab() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("GP_ADMIN");
  const [editActive, setEditActive] = useState(true);

  const { data: users, isLoading } = useQuery<PlatformUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiClient.get("/api/auth/users").then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: number;
      data: { role?: UserRole; is_active?: boolean };
    }) => apiClient.patch(`/api/auth/users/${userId}`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingId(null);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update user"));
    },
  });

  const startEdit = (user: PlatformUser) => {
    setEditingId(user.user_id);
    setEditRole(user.role);
    setEditActive(user.is_active);
  };

  const saveEdit = (userId: number) => {
    updateMutation.mutate({ userId, data: { role: editRole, is_active: editActive } });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          All Users ({users?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.full_name || "\u2014"}</TableCell>
                <TableCell>
                  {editingId === user.user_id ? (
                    <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === user.user_id ? (
                    <button
                      type="button"
                      onClick={() => setEditActive(!editActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editActive ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          editActive ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  ) : (
                    <Badge
                      className={
                        user.is_active
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === user.user_id ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => saveEdit(user.user_id)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => startEdit(user)}
                    >
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Invitations Tab ───────────────────────────────────────────────── */

function InvitationsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [form, setForm] = useState<InviteFormData>({
    email: "",
    full_name: "",
    role: "INVESTOR",
    personal_message: "",
  });

  const { data: invitations, isLoading } = useQuery<Invitation[]>({
    queryKey: ["admin-invitations"],
    queryFn: () => apiClient.get("/api/auth/invitations").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: InviteFormData) =>
      apiClient.post("/api/auth/invitations", {
        email: data.email,
        full_name: data.full_name || undefined,
        role: data.role,
        personal_message: data.personal_message || undefined,
      }).then((r) => r.data),
    onSuccess: (data: any) => {
      // The backend returns email_sent: true|false. The invite row exists either
      // way, but warn the user if delivery actually failed so they know to copy
      // the magic link manually instead of waiting for an email that won't arrive.
      if (data.email_sent === false) {
        toast.warning(
          "Invitation created but email delivery failed. Copy the invite link below and send it manually.",
          { duration: 8000 },
        );
      } else {
        toast.success("Invitation sent");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
      setCreatedLink(data.invite_link ?? data.invite_url ?? null);
      setForm({ email: "", full_name: "", role: "INVESTOR", personal_message: "" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to send invitation"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiClient.delete(`/api/auth/invitations/${invitationId}`).then((r) => r.data),
    onSuccess: () => {
      toast.success("Invitation revoked");
      queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to revoke invitation"));
    },
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedLink(text);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Invite Button / Form */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite New User
            </CardTitle>
            {!showForm && (
              <Button size="sm" onClick={() => { setShowForm(true); setCreatedLink(null); }}>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Invite
              </Button>
            )}
          </div>
        </CardHeader>
        {showForm && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Full Name</Label>
                  <Input
                    id="invite-name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-message">Personal Message (optional)</Label>
                <Textarea
                  id="invite-message"
                  value={form.personal_message}
                  onChange={(e) => setForm({ ...form, personal_message: e.target.value })}
                  placeholder="Add a personal welcome message..."
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Mail className="h-4 w-4 mr-1.5" />
                  )}
                  Send Invitation
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setCreatedLink(null); }}>
                  Cancel
                </Button>
              </div>
            </form>

            {/* Created link display */}
            {createdLink && (
              <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800 mb-2">Invite link created:</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={createdLink}
                    readOnly
                    className="font-mono text-xs bg-white"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(createdLink)}
                    className="shrink-0"
                  >
                    {copiedLink === createdLink ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Invitations Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            All Invitations ({invitations?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations?.map((inv) => (
                  <TableRow key={inv.invitation_id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[inv.role] || inv.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[inv.status] ?? ""}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell>{inv.invited_by_name || "\u2014"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => revokeMutation.mutate(inv.invitation_id)}
                          disabled={revokeMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {invitations?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No invitations yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function UserManagementPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          User Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage platform users and invitations.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="h-4 w-4 mr-1.5" />
            Invitations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="invitations">
          <InvitationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
