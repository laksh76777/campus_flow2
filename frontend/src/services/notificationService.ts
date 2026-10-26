import api from "./api";
import type { ApiResponse, Notification } from "../types";

// Fetch student's real notifications and unread count
export const getMyNotifications = async (): Promise<ApiResponse<{ notifications: Notification[]; unreadCount: number }>> => {
  const response = await api.get("/notifications");
  return response.data;
};

// Mark a single notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<ApiResponse<Notification>> => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<ApiResponse<any>> => {
  const response = await api.patch("/notifications/mark-all-read");
  return response.data;
};

// Delete a single notification
export const deleteNotification = async (notificationId: string): Promise<ApiResponse<any>> => {
  const response = await api.delete(`/notifications/${notificationId}`);
  return response.data;
};

// Clear all notifications for the current student
export const clearAllNotifications = async (): Promise<ApiResponse<any>> => {
  const response = await api.delete("/notifications/clear-all");
  return response.data;
};

// Preview announcement audience count and recipients
export const getAnnouncementPreview = async (params: Record<string, any>): Promise<ApiResponse<any>> => {
  const response = await api.get("/notifications/announcement-preview", { params });
  return response.data;
};

// Broadcast announcement to student cohorts (Admin)
export const broadcastAnnouncement = async (announcementData: Record<string, any>): Promise<ApiResponse<any>> => {
  const response = await api.post("/notifications/broadcast", announcementData);
  return response.data;
};

// Get scheduled reminder jobs (Admin)
export const getScheduledReminders = async (): Promise<ApiResponse<any[]>> => {
  const response = await api.get("/notifications/scheduled-reminders");
  return response.data;
};

// Manually trigger reminder worker execution (Admin)
export const triggerReminderWorker = async (): Promise<ApiResponse<any>> => {
  const response = await api.post("/notifications/trigger-reminders");
  return response.data;
};

// Safe SMTP diagnostics status (Admin)
export const getSmtpStatus = async (): Promise<ApiResponse<any>> => {
  const response = await api.get("/notifications/smtp-status");
  return response.data;
};

// Send single controlled test email (Admin)
export const sendSmtpTestEmail = async (testEmail: string): Promise<ApiResponse<any>> => {
  const response = await api.post("/notifications/smtp-test-email", { testEmail });
  return response.data;
};

// Get broadcast announcement history (Admin)
export const getBroadcastHistory = async (): Promise<ApiResponse<any[]>> => {
  const response = await api.get("/notifications/broadcast-history");
  return response.data;
};

// Delete/recall a broadcast announcement from all student inboxes (Admin)
export const deleteBroadcastAnnouncement = async (identifier: string): Promise<ApiResponse<any>> => {
  const response = await api.delete(`/notifications/broadcast/${encodeURIComponent(identifier)}`);
  return response.data;
};

// Freshstart / purge all broadcast test notifications (Admin)
export const freshstartNotifications = async (): Promise<ApiResponse<any>> => {
  const response = await api.post("/notifications/admin/freshstart");
  return response.data;
};
