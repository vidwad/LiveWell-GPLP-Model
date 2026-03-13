import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@/lib/api";
import type { Notification } from "@/types/notifications";

export function useNotifications(unreadOnly = false) {
  return useQuery<Notification[]>({
    queryKey: ["notifications", unreadOnly],
    queryFn: () => notifications.list(unreadOnly),
    refetchInterval: 30_000, // poll every 30s
  });
}

export function useUnreadCount() {
  const { data } = useNotifications(true);
  return data?.length ?? 0;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) => notifications.markRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
