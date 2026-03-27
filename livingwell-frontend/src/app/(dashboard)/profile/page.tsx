"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  User,
  Mail,
  Phone,
  Linkedin,
  Globe,
  Lock,
  Calendar,
  CheckCircle2,
  XCircle,
  Camera,
  Save,
} from "lucide-react";

const TIMEZONES = [
  "America/Edmonton",
  "America/Vancouver",
  "America/Toronto",
  "America/New_York",
  "UTC",
  "Europe/London",
];

const ROLE_LABELS: Record<string, string> = {
  GP_ADMIN: "GP Admin",
  OPERATIONS_MANAGER: "Operator",
  PROPERTY_MANAGER: "Property Manager",
  INVESTOR: "Investor",
  RESIDENT: "Resident",
};

interface ProfileForm {
  full_name: string;
  title: string;
  phone: string;
  linkedin_url: string;
  bio: string;
  timezone: string;
  profile_photo_url: string;
}

interface PasswordForm {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [editing, setEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile form state
  const [profile, setProfile] = useState<ProfileForm>({
    full_name: "",
    title: "",
    phone: "",
    linkedin_url: "",
    bio: "",
    timezone: "America/Edmonton",
    profile_photo_url: "",
  });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Password form state
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleConnectEmail, setGoogleConnectEmail] = useState("");

  // Populate form when user loads
  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        full_name: user.full_name ?? "",
      }));
      // Fetch extended profile data from /me
      apiClient
        .get("/api/auth/me")
        .then((res) => {
          const data = res.data;
          setProfile({
            full_name: data.full_name ?? user.full_name ?? "",
            title: data.title ?? "",
            phone: data.phone ?? "",
            linkedin_url: data.linkedin_url ?? "",
            bio: data.bio ?? "",
            timezone: data.timezone ?? "America/Edmonton",
            profile_photo_url: data.profile_photo_url ?? "",
          });
          if (data.google_calendar_email) {
            setGoogleConnected(true);
            setGoogleEmail(data.google_calendar_email);
          }
        })
        .catch(() => {
          // Profile endpoint may not exist yet; use auth user data
        });
    }
  }, [user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) =>
      apiClient.patch("/api/auth/me/profile", data).then((r) => r.data),
    onSuccess: () => {
      setEditing(false);
      showSuccess("Profile updated successfully.");
    },
    onError: () => {
      showError("Failed to update profile.");
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: { old_password: string; new_password: string }) =>
      apiClient.patch("/api/auth/me/password", data).then((r) => r.data),
    onSuccess: () => {
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
      showSuccess("Password changed successfully.");
    },
    onError: () => {
      showError("Failed to change password. Check your current password.");
    },
  });

  // Google Calendar connect
  const connectGoogleMutation = useMutation({
    mutationFn: (data: { google_email: string }) =>
      apiClient.post("/api/auth/me/google-calendar/connect", data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      setGoogleConnected(true);
      setGoogleEmail(variables.google_email);
      setGoogleConnectEmail("");
      showSuccess("Google Calendar connected.");
    },
    onError: () => {
      showError("Failed to connect Google Calendar.");
    },
  });

  // Google Calendar disconnect
  const disconnectGoogleMutation = useMutation({
    mutationFn: () =>
      apiClient.delete("/api/auth/me/google-calendar/disconnect").then((r) => r.data),
    onSuccess: () => {
      setGoogleConnected(false);
      setGoogleEmail("");
      showSuccess("Google Calendar disconnected.");
    },
    onError: () => {
      showError("Failed to disconnect Google Calendar.");
    },
  });

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setSuccessMsg(null);
    setTimeout(() => setErrorMsg(null), 4000);
  }

  function handleSaveProfile() {
    updateProfileMutation.mutate(profile);
  }

  function handleChangePassword() {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showError("New passwords do not match.");
      return;
    }
    if (passwordForm.new_password.length < 6) {
      showError("New password must be at least 6 characters.");
      return;
    }
    changePasswordMutation.mutate({
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password,
    });
  }

  function handleConnectGoogle() {
    if (!googleConnectEmail.trim()) {
      showError("Please enter a Google email address.");
      return;
    }
    connectGoogleMutation.mutate({ google_email: googleConnectEmail.trim() });
  }

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Not authenticated.</p>
      </div>
    );
  }

  const initials = getInitials(profile.full_name || user.full_name, user.email);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {/* Feedback messages */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <XCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="flex flex-col items-center pt-6 pb-6 space-y-4">
              {/* Avatar with photo upload */}
              <div className="relative group">
                {profile.profile_photo_url ? (
                  <img
                    src={profile.profile_photo_url.startsWith("http") ? profile.profile_photo_url : `${apiClient.defaults.baseURL}${profile.profile_photo_url}`}
                    alt="Profile"
                    className="h-24 w-24 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                    {initials}
                  </div>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { alert("Photo must be under 5MB"); return; }
                    setUploadingPhoto(true);
                    try {
                      const formData = new FormData();
                      formData.append("file", file);
                      const uploadResp = await apiClient.post("/api/auth/me/profile-photo", formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                      });
                      const photoUrl = uploadResp.data?.url;
                      if (photoUrl) {
                        setProfile((p) => ({ ...p, profile_photo_url: photoUrl }));
                      }
                    } catch { alert("Failed to upload photo"); }
                    finally { setUploadingPhoto(false); if (photoInputRef.current) photoInputRef.current.value = ""; }
                  }}
                />
                <button
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <span className="text-xs">Uploading...</span>
                  ) : (
                    <>
                      <Camera className="h-5 w-5 mr-1" />
                      <span className="text-xs">Upload</span>
                    </>
                  )}
                </button>
              </div>

              {/* Name */}
              <div className="text-center space-y-1">
                <h2 className="text-xl font-semibold">
                  {profile.full_name || user.full_name || "No name set"}
                </h2>
                {profile.title && (
                  <p className="text-sm text-muted-foreground">{profile.title}</p>
                )}
              </div>

              {/* Role badge */}
              <Badge variant="secondary">
                {ROLE_LABELS[user.role] || user.role.replace(/_/g, " ")}
              </Badge>

              {/* Email */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {user.email}
              </div>

              {/* Edit / Save button */}
              <Button
                variant={editing ? "default" : "outline"}
                className="w-full mt-2"
                onClick={() => {
                  if (editing) {
                    handleSaveProfile();
                  } else {
                    setEditing(true);
                  }
                }}
                disabled={updateProfileMutation.isPending}
              >
                {editing ? (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? "Saving..." : "Save"}
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 mr-2" />
                    Edit Profile
                  </>
                )}
              </Button>
              {editing && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tabbed Sections */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="personal">
            <TabsList>
              <TabsTrigger value="personal">
                <User className="h-4 w-4 mr-1.5" />
                Personal Info
              </TabsTrigger>
              <TabsTrigger value="security">
                <Lock className="h-4 w-4 mr-1.5" />
                Security
              </TabsTrigger>
              <TabsTrigger value="integrations">
                <Globe className="h-4 w-4 mr-1.5" />
                Integrations
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Personal Information */}
            <TabsContent value="personal">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">
                        <User className="h-3.5 w-3.5" />
                        Full Name
                      </Label>
                      <Input
                        id="full_name"
                        value={profile.full_name}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, full_name: e.target.value }))
                        }
                        disabled={!editing}
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Job Title</Label>
                      <Input
                        id="title"
                        value={profile.title}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, title: e.target.value }))
                        }
                        disabled={!editing}
                        placeholder="e.g. Fund Manager"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        <Phone className="h-3.5 w-3.5" />
                        Phone
                      </Label>
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, phone: e.target.value }))
                        }
                        disabled={!editing}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedin_url">
                        <Linkedin className="h-3.5 w-3.5" />
                        LinkedIn URL
                      </Label>
                      <div className="relative">
                        <Input
                          id="linkedin_url"
                          value={profile.linkedin_url}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              linkedin_url: e.target.value,
                            }))
                          }
                          disabled={!editing}
                          placeholder="https://linkedin.com/in/yourprofile"
                        />
                        {profile.linkedin_url && !editing && (
                          <a
                            href={profile.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profile.bio}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, bio: e.target.value }))
                      }
                      disabled={!editing}
                      placeholder="Tell us a bit about yourself..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 max-w-xs">
                    <Label>
                      <Globe className="h-3.5 w-3.5" />
                      Timezone
                    </Label>
                    {editing ? (
                      <Select
                        value={profile.timezone}
                        onValueChange={(v: string | null) => {
                          if (v) setProfile((p) => ({ ...p, timezone: v }));
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground py-1.5">
                        {profile.timezone}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 2: Security */}
            <TabsContent value="security">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="old_password">
                      <Lock className="h-3.5 w-3.5" />
                      Current Password
                    </Label>
                    <Input
                      id="old_password"
                      type="password"
                      value={passwordForm.old_password}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          old_password: e.target.value,
                        }))
                      }
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_password">New Password</Label>
                    <Input
                      id="new_password"
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          new_password: e.target.value,
                        }))
                      }
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          confirm_password: e.target.value,
                        }))
                      }
                      placeholder="Confirm new password"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={
                      changePasswordMutation.isPending ||
                      !passwordForm.old_password ||
                      !passwordForm.new_password ||
                      !passwordForm.confirm_password
                    }
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {changePasswordMutation.isPending
                      ? "Saving..."
                      : "Change Password"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab 3: Integrations */}
            <TabsContent value="integrations">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Google Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {googleConnected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>
                          Connected as{" "}
                          <span className="font-medium">{googleEmail}</span>
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => disconnectGoogleMutation.mutate()}
                        disabled={disconnectGoogleMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {disconnectGoogleMutation.isPending
                          ? "Disconnecting..."
                          : "Disconnect"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <XCircle className="h-4 w-4" />
                        Not connected
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="space-y-2 flex-1 max-w-sm">
                          <Label htmlFor="google_email">
                            <Mail className="h-3.5 w-3.5" />
                            Google Email
                          </Label>
                          <Input
                            id="google_email"
                            type="email"
                            value={googleConnectEmail}
                            onChange={(e) => setGoogleConnectEmail(e.target.value)}
                            placeholder="your.email@gmail.com"
                          />
                        </div>
                        <Button
                          onClick={handleConnectGoogle}
                          disabled={connectGoogleMutation.isPending}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          {connectGoogleMutation.isPending
                            ? "Connecting..."
                            : "Connect"}
                        </Button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-2">
                    When connected, scheduled follow-ups will offer to add events to
                    your Google Calendar.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
