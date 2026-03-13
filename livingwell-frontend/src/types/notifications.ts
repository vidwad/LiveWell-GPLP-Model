export type NotificationType =
  | "stage_transition"
  | "quarterly_report"
  | "etransfer"
  | "document_uploaded"
  | "distribution"
  | "general";

export interface Notification {
  notification_id: number;
  user_id: number;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}
