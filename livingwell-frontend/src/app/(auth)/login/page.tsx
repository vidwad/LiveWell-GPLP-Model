"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = "/dashboard";
    } catch {
      const message = "Invalid email or password";
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
        {/* Decorative circles */}
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
              Manage your portfolio with confidence.
            </h1>
            <p className="mt-4 text-lg text-emerald-100/80 leading-relaxed">
              A unified platform for GP administrators, property managers, and investors to track performance, manage operations, and grow together.
            </p>
          </motion.div>

          <p className="text-sm text-emerald-300/60">
            &copy; {new Date().getFullYear()} Living Well Communities. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
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
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Link
                  href="#"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-11 rounded-lg"
                required
              />
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
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80 transition-colors">
              Create one
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
