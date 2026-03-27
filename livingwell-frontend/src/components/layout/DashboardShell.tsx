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
        <header className="hidden md:flex items-center justify-end gap-3 px-6 py-3 border-b border-border bg-card shrink-0">
          <NotificationBell />
          <Link href="/profile" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            {photoUrl ? (
              <img
                src={photoUrl.startsWith("http") ? photoUrl : `${apiClient.defaults.baseURL}${photoUrl}`}
                alt=""
                className="h-8 w-8 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
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
