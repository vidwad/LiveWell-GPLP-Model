"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Loader2, AlertCircle, UserPlus, Shield } from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────── */

interface InviteValidation {
  valid: boolean;
  email: string;
  full_name: string | null;
  role: string;
  invited_by_name: string | null;
  personal_message: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  GP_ADMIN: "GP Admin",
  OPERATIONS_MANAGER: "Operations Manager",
  PROPERTY_MANAGER: "Property Manager",
  INVESTOR: "Investor",
  PARTNER: "Partner",
  RESIDENT: "Resident",
};

/* ── Inner Component (uses useSearchParams) ─────────────────────────── */

function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [invite, setInvite] = useState<InviteValidation | null>(null);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError("No invitation token provided. Please check your invite link.");
      setValidating(false);
      return;
    }

    apiClient
      .get<InviteValidation>(`/api/auth/invitations/${token}/validate`)
      .then((r) => {
        setInvite(r.data);
        if (r.data.full_name) {
          setFullName(r.data.full_name);
        }
      })
      .catch((err) => {
        setError(
          getApiErrorMessage(
            err,
            "This invitation link is invalid or has expired."
          )
        );
      })
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post("/api/auth/invitations/accept", {
        token,
        password,
        full_name: fullName,
      });

      // Store tokens
      localStorage.setItem("lwc_access_token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("lwc_refresh_token", data.refresh_token);
      }

      // Set flag cookie so middleware sees the user is logged in
      document.cookie =
        "lwc_token_present=1; path=/; max-age=604800; SameSite=Lax";

      toast.success("Account created successfully!");
      window.location.href = "/dashboard";
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to create account");
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Verifying your invitation...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
            <CardDescription>
              {error || "This invitation link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Please contact the person who invited you for a new link.
            </p>
            <Link href="/login">
              <Button variant="outline">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invite - show registration form
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Heart className="h-10 w-10 text-primary fill-primary" />
          </div>
          <CardTitle className="text-2xl">
            Join Living Well Communities
          </CardTitle>
          <CardDescription>
            {invite.invited_by_name
              ? `${invite.invited_by_name} has invited you to join the platform`
              : "You've been invited to join the platform"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite details */}
          <div className="rounded-md border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                {ROLE_LABELS[invite.role] || invite.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{invite.email}</span>
            </div>
          </div>

          {/* Personal message */}
          {invite.personal_message && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm italic text-muted-foreground">
                &ldquo;{invite.personal_message}&rdquo;
              </p>
              {invite.invited_by_name && (
                <p className="text-xs text-muted-foreground mt-1">
                  &mdash; {invite.invited_by_name}
                </p>
              )}
            </div>
          )}

          {/* Registration form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
              />
            </div>

            {formError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Page wrapper with Suspense ────────────────────────────────────── */

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AcceptInviteInner />
    </Suspense>
  );
}
