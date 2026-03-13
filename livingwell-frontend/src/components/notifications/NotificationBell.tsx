"use client";

import { useState } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/hooks/useNotifications";
import type { Notification } from "@/types/notifications";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, string> = {
  stage_transition: "🏗️",
  quarterly_report: "📊",
  etransfer: "💸",
  document_uploaded: "📄",
  distribution: "💰",
  general: "🔔",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: allNotifs = [] } = useNotifications();
  const unreadCount = allNotifs.filter((n) => !n.is_read).length;
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const router = useRouter();

  function handleClick(notif: Notification) {
    if (!notif.is_read) markRead.mutate(notif.notification_id);
    if (notif.action_url) {
      router.push(notif.action_url);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute left-full bottom-0 z-50 ml-2 w-80 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {allNotifs.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet
                </p>
              ) : (
                allNotifs.slice(0, 20).map((notif) => (
                  <button
                    key={notif.notification_id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors",
                      !notif.is_read && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5">
                        {TYPE_ICONS[notif.type] ?? "🔔"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className={cn("text-sm truncate", !notif.is_read && "font-semibold")}>
                            {notif.title}
                          </p>
                          {notif.action_url && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notif.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {timeAgo(notif.created_at)}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
