import { Router } from "express";
import {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    getAnnouncementPreview,
    createBroadcastAnnouncement,
    getScheduledReminders,
    triggerReminderWorker,
    getSmtpStatus,
    sendSmtpTestEmail,
    getBroadcastHistory,
    deleteBroadcastAnnouncement,
    freshstartNotifications
} from "../controllers/notification.controller.js";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT);

// 1. Student / User In-App Notifications
router.get("/", getMyNotifications);
router.patch("/mark-all-read", markAllNotificationsAsRead);
router.patch("/read-all", markAllNotificationsAsRead);
router.delete("/clear-all", clearAllNotifications);
router.patch("/:id/read", markNotificationAsRead);
router.delete("/:id", deleteNotification);

// 2. Announcements & Targeting (Admin)
router.get("/announcement-preview", verifyAdmin, getAnnouncementPreview);
router.post("/broadcast", verifyAdmin, createBroadcastAnnouncement);
router.get("/broadcast-history", verifyAdmin, getBroadcastHistory);
router.delete("/broadcast/:identifier", verifyAdmin, deleteBroadcastAnnouncement);
router.post("/admin/freshstart", verifyAdmin, freshstartNotifications);

// 3. Reminders & Delivery Diagnostics (Admin)
router.get("/scheduled-reminders", verifyAdmin, getScheduledReminders);
router.post("/trigger-reminders", verifyAdmin, triggerReminderWorker);
router.get("/smtp-status", verifyAdmin, getSmtpStatus);
router.post("/smtp-test-email", verifyAdmin, sendSmtpTestEmail);

export default router;
