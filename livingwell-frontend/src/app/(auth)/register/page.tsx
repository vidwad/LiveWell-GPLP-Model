"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/errors";
import { useAuth } from "@/providers/AuthProvider";
import { UserRole } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "GP_ADMIN", label: "GP Admin" },
  { value: "OPERATIONS_MANAGER", label: "Operations Manager" },
  { value: "PROPERTY_MANAGER", label: "Property Manager" },
  { value: "INVESTOR", label: "Investor" },
  { value: "RESIDENT", label: "Resident" },
];

export default function RegisterPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("GP_ADMIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/api/auth/register", {
        email,
        password,
        full_name: fullName,
        role,
      });
      await login(email, password);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, "Registration failed");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-emerald-400/10 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Heart className="h-6 w-6 text-white fill-white" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">Living Well</p>
              <p className="text-sm text-emerald-200 leading-tight">Communities</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-md"
          >
            <h1 className="text-4xl font-bold leading-tight">
              Join the platform that powers communities.
            </h1>
            <p className="mt-4 text-lg text-emerald-100/80 leading-relaxed">
              Create your account to access portfolio analytics, investor management, property operations, and more.
            </p>
          </motion.div>

          <p className="text-sm text-emerald-300/60">
            &copy; {new Date().getFullYear()} Living Well Communities. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right panel — register form */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md">
                <Heart className="h-5 w-5 text-white fill-white" />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">Living Well</p>
                <p className="text-xs text-muted-foreground leading-tight">Communities</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Create your account</h2>
            <p className="text-sm text-muted-foreground">
              Get started with the Living Well platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="h-11 rounded-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="h-11 rounded-lg">
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

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
