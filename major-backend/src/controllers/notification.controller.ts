import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { ReminderRepository } from "../repositories/reminder.repository.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { ReminderSchedulerService } from "../services/reminderScheduler.service.js";
import { getSmtpConfigStatus, sendEmail } from "../services/integrations/email/mail.service.js";
import { getParam } from "../utils/params.js";

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
    const notifications = await NotificationRepository.findByUser(req.user.id);
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    return res.status(200).json(
        new ApiResponse(200, { notifications, unreadCount }, "Notifications retrieved.")
    );
});

export const markNotificationAsRead = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    await NotificationRepository.markAsRead(id, req.user.id);
    return res.status(200).json(new ApiResponse(200, {}, "Notification marked as read."));
});

export const markAllNotificationsAsRead = asyncHandler(async (req: Request, res: Response) => {
    await NotificationRepository.markAllAsRead(req.user.id);
    return res.status(200).json(new ApiResponse(200, {}, "All notifications marked as read."));
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    await NotificationRepository.deleteNotification(id, req.user.id);
    return res.status(200).json(new ApiResponse(200, {}, "Notification removed."));
});

export const clearAllNotifications = asyncHandler(async (req: Request, res: Response) => {
    await NotificationRepository.clearAllForUser(req.user.id);
    return res.status(200).json(new ApiResponse(200, {}, "All notifications cleared."));
});

export const getAnnouncementPreview = asyncHandler(async (req: Request, res: Response) => {
    const targetSession = req.query.targetSession ? parseInt(String(req.query.targetSession), 10) : undefined;
    const targetBranch = req.query.targetBranch ? String(req.query.targetBranch) : undefined;

    const { students, total } = await StudentRepository.findAll({
        branch: targetBranch !== "all" ? targetBranch : undefined,
        sessionYear: targetSession,
        limit: 10
    });

    return res.status(200).json(
        new ApiResponse(200, {
            recipientCount: total,
            sampleRecipients: students.map((s) => ({
                id: s.id,
                name: s.full_name,
                usn: s.usn || s.enrollment_number,
                branch: s.branch
            }))
        }, "Announcement preview calculated.")
    );
});

export const createBroadcastAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const { title, message, targetSession, targetBranch } = req.body;
    if (!title || !message) {
        throw new ApiError(400, "Title and message are required for broadcast announcement.");
    }

    const { students } = await StudentRepository.findAll({
        branch: targetBranch && targetBranch !== "all" ? targetBranch : undefined,
        sessionYear: targetSession && targetSession !== "all" ? parseInt(targetSession, 10) : undefined,
        limit: 5000
    });

    const broadcastId = `bcast_${Date.now()}`;
    let createdCount = 0;

    for (const student of students) {
        await NotificationRepository.create({
            user_id: student.user_id,
            title,
            message,
            type: "announcement",
            broadcast_id: broadcastId
        });
        createdCount++;
    }

    return res.status(201).json(
        new ApiResponse(201, { broadcastId, createdCount }, `Broadcast announcement dispatched to ${createdCount} students.`)
    );
});

export const getScheduledReminders = asyncHandler(async (req: Request, res: Response) => {
    const jobs = await ReminderRepository.findAllJobs(100);
    return res.status(200).json(new ApiResponse(200, jobs, "Scheduled reminder jobs retrieved."));
});

export const triggerReminderWorker = asyncHandler(async (req: Request, res: Response) => {
    const result = await ReminderSchedulerService.processDueReminders();
    return res.status(200).json(new ApiResponse(200, result, "Reminder worker execution complete."));
});

export const getSmtpStatus = asyncHandler(async (req: Request, res: Response) => {
    const status = getSmtpConfigStatus();
    return res.status(200).json(new ApiResponse(200, status, "Email provider configuration status retrieved."));
});

export const sendSmtpTestEmail = asyncHandler(async (req: Request, res: Response) => {
    const { testEmail } = req.body;
    if (!testEmail) throw new ApiError(400, "Test email address is required.");

    const sent = await sendEmail({
        to: testEmail,
        subject: "CampusFlow V3 Email Delivery Verification",
        html: `<h3>CampusFlow V3 System Test</h3><p>This is a verified test email sent from CampusFlow V3 placement automation platform.</p>`
    });

    return res.status(200).json(
        new ApiResponse(200, { sent, recipient: testEmail }, sent ? "Test email dispatched successfully." : "Failed to deliver email. Check provider logs.")
    );
});

export const getBroadcastHistory = asyncHandler(async (req: Request, res: Response) => {
    const history = await NotificationRepository.getBroadcastHistory();
    return res.status(200).json(new ApiResponse(200, history, "Broadcast announcement history retrieved."));
});

export const deleteBroadcastAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const identifier = getParam(req.params.identifier);
    const result = await NotificationRepository.deleteBroadcast(identifier);
    return res.status(200).json(
        new ApiResponse(200, result, `Recalled ${result.deletedCount} notifications across student inboxes.`)
    );
});

export const freshstartNotifications = asyncHandler(async (req: Request, res: Response) => {
    const result = await NotificationRepository.freshstartNotifications();
    return res.status(200).json(
        new ApiResponse(200, result, `Purged ${result.purgedCount} test broadcast notifications.`)
    );
});
