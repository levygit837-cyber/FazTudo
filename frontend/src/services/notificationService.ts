import api, { ApiResponse, extractData } from "./api";
import { Notification, NotificationStatus } from "../types";

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export const getNotifications = async (
  params?: { status?: NotificationStatus; limit?: number; offset?: number }
): Promise<NotificationListResponse> => {
  const response = await api.get<ApiResponse<NotificationListResponse>>(
    "/services/notifications",
    { params }
  );
  return extractData(response);
};

export const markAsRead = async (id: number): Promise<void> => {
  await api.put(`/services/notifications/${id}`, { status: "READ" });
};

export const markAllAsRead = async (): Promise<void> => {
  await api.post("/services/notifications/read-all");
};

export const getUnreadCount = async (): Promise<number> => {
  const data = await getNotifications({ status: NotificationStatus.UNREAD, limit: 0 });
  return data.unreadCount;
};
