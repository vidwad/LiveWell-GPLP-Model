"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/lib/api";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Sidebar } from "./Sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      apiClient.get("/api/auth/me").then((r) => {
        if (r.data?.profile_photo_url) setPhotoUrl(r.data.profile_photo_url);
      }).catch(() => {});
    }
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar — desktop only */}
        <header className="hidden md:flex items-center justify-end gap-3 px-6 py-3.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <NotificationBell />
          <Link href="/profile" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            {photoUrl ? (
              <img
                src={photoUrl.startsWith("http") ? photoUrl : `${apiClient.defaults.baseURL}${photoUrl}`}
                alt=""
                className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/10"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium">{user?.full_name || user?.email}</span>
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pt-14 md:p-8 md:pt-6">{children}</main>
      </div>
    </div>
  );
}
