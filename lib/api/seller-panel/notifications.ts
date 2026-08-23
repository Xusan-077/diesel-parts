import { sellerApiRequest } from "./client";
import type { AppNotification } from "./types";

export function fetchNotifications(): Promise<AppNotification[]> {
  return sellerApiRequest<AppNotification[]>("/notifications");
}

export function markNotificationRead(id: string): Promise<AppNotification> {
  return sellerApiRequest<AppNotification>(`/notifications/${id}/read`, { method: "PATCH" });
}
