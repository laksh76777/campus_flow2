import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { ReminderRepository } from "../repositories/reminder.repository.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { ApplicationRepository } from "../repositories/application.repository.js";
import { SessionRepository } from "../repositories/session.repository.js";
import { ReminderSchedulerService } from "../services/reminderScheduler.service.js";
import { getSmtpConfigStatus, isResendConfigured, sendEmail } from "../services/integrations/email/mail.service.js";
import { getParam } from "../utils/params.js";
import { query } from "../database/db.js";

export const formatNotificationResponse = (n: any) => ({
    id: n.id,
    _id: n.id,
    user_id: n.user_id,
    userId: n.user_id,
    title: n.title,
    message: n.message,
    type: n.type || "status_update",
    status: n.status || null,
    company_name: n.company_name || "",
    companyName: n.company_name || "",
    job_title: n.job_title || "",
    jobTitle: n.job_title || "",
    remarks: n.remarks || "",
    interview_date: n.interview_date || null,
    interviewDate: n.interview_date || null,
    interview_round: n.interview_round || "",
    interviewRound: n.interview_round || "",
    interview_location: n.interview_location || "",
    interviewLocation: n.interview_location || "",
    offered_package: n.offered_package != null ? Number(n.offered_package) : null,
    offeredPackage: n.offered_package != null ? Number(n.offered_package) : null,
    is_read: Boolean(n.is_read),
    isRead: Boolean(n.is_read),
    application_id: n.application_id || null,
    applicationId: n.application_id || null,
    broadcast_id: n.broadcast_id || "",
    broadcastId: n.broadcast_id || "",
    created_at: n.created_at,
    createdAt: n.created_at,
    updated_at: n.updated_at,
    updatedAt: n.updated_at
});

/**
 * Resolves audience students based on targeting parameters
 */
async function resolveAudienceStudents(options: {
    targetAudience?: string;
    targetProgramCode?: string;
    targetSessionId?: string;
    targetSession?: any;
    targetBranch?: string;
    driveId?: string;
    targetStudentId?: string;
    limit?: number;
}): Promise<any[]> {
    const limit = options.limit || 5000;
    const audience = options.targetAudience || "all";

    // 1. Single Student
    if (audience === "student" || options.targetStudentId) {
        const studentId = options.targetStudentId;
        if (!studentId) return [];
        const student = (await StudentRepository.findById(studentId)) || (await StudentRepository.findByUserId(studentId));
        return student ? [student] : [];
    }

    // 2. Drive Applicants
    if (audience === "drive_applicants" || options.driveId) {
        const driveId = options.driveId;
        if (!driveId) return [];
        const res = await query(
            `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone
             FROM applications a
             JOIN student_profiles sp ON sp.id = a.student_id
             JOIN users u ON u.id = sp.user_id
             WHERE a.placement_drive_id = $1
             LIMIT $2`,
            [driveId, limit]
        );
        return res.rows;
    }

    // 3. Placement Session
    if (audience === "session" || options.targetSessionId || options.targetSession) {
        let sessionYear: number | undefined;
        if (options.targetSessionId && options.targetSessionId !== "all") {
            const session = await SessionRepository.findById(options.targetSessionId);
            if (session) sessionYear = session.session_year;
        } else if (options.targetSession && options.targetSession !== "all") {
            sessionYear = parseInt(String(options.targetSession), 10);
        }

        const { students } = await StudentRepository.findAll({
            sessionYear: !isNaN(sessionYear as number) ? sessionYear : undefined,
            branch: options.targetBranch && options.targetBranch !== "all" ? options.targetBranch : undefined,
            limit
        });
        return students;
    }

    // 4. Program / Department Branch
    if (audience === "program" || options.targetProgramCode || options.targetBranch) {
        const branch = options.targetProgramCode || options.targetBranch;
        const { students } = await StudentRepository.findAll({
            branch: branch && branch !== "all" ? branch : undefined,
            limit
        });
        return students;
    }

    // 5. Default "all" students
    const { students } = await StudentRepository.findAll({ limit });
    return students;
}

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10)));
    const unreadOnly = req.query.unreadOnly === "true";

    const { notifications, total, unreadCount } = await NotificationRepository.findByUserPaged(req.user.id, {
        page,
        limit,
        unreadOnly
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                notifications: notifications.map(formatNotificationResponse),
                unreadCount,
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit))
            },
            "Notifications retrieved."
        )
    );
});

export const markNotificationAsRead = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const updated = await NotificationRepository.markAsRead(id, req.user.id);
    return res.status(200).json(
        new ApiResponse(200, updated ? formatNotificationResponse(updated) : {}, "Notification marked as read.")
    );
});

export const markAllNotificationsAsRead = asyncHandler(async (req: Request, res: Response) => {
    const updatedCount = await NotificationRepository.markAllAsRead(req.user.id);
    return res.status(200).json(
        new ApiResponse(200, { updatedCount }, "All notifications marked as read.")
    );
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    await NotificationRepository.deleteNotification(id, req.user.id);
    return res.status(200).json(new ApiResponse(200, { deletedId: id }, "Notification removed."));
});

export const clearAllNotifications = asyncHandler(async (req: Request, res: Response) => {
    await NotificationRepository.clearAllForUser(req.user.id);
    return res.status(200).json(new ApiResponse(200, {}, "All notifications cleared."));
});

export const getAnnouncementPreview = asyncHandler(async (req: Request, res: Response) => {
    const students = await resolveAudienceStudents({
        targetAudience: req.query.targetAudience as string,
        targetProgramCode: req.query.targetProgramCode as string,
        targetSessionId: req.query.targetSessionId as string,
        targetSession: req.query.targetSession,
        targetBranch: req.query.targetBranch as string,
        driveId: req.query.driveId as string,
        targetStudentId: req.query.targetStudentId as string,
        limit: 1000
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                recipientCount: students.length,
                sampleRecipients: students.slice(0, 10).map((s) => ({
                    id: s.id,
                    name: s.full_name,
                    usn: s.usn || s.enrollment_number,
                    branch: s.branch
                }))
            },
            "Announcement preview calculated."
        )
    );
});

export const createBroadcastAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const {
        title,
        message,
        type,
        targetAudience,
        targetProgramCode,
        targetSessionId,
        targetSession,
        targetBranch,
        driveId,
        targetStudentId,
        channels
    } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
        throw new ApiError(400, "Title is required for broadcast announcement.");
    }
    if (!message || typeof message !== "string" || !message.trim()) {
        throw new ApiError(400, "Message is required for broadcast announcement.");
    }

    const students = await resolveAudienceStudents({
        targetAudience,
        targetProgramCode,
        targetSessionId,
        targetSession,
        targetBranch,
        driveId,
        targetStudentId,
        limit: 5000
    });

    if (students.length === 0) {
        throw new ApiError(400, "No eligible student recipients found for the selected audience targeting.");
    }

    const broadcastId = `bcast_${Date.now()}`;
    const activeChannels = Array.isArray(channels) && channels.length > 0 ? channels : ["in_app"];

    let inAppCreated = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    let skippedMissingEmail = 0;

    // In-App Notification Dispatch
    if (activeChannels.includes("in_app")) {
        for (const student of students) {
            const userId = student.user_id || student.id;
            if (!userId) continue;
            await NotificationRepository.create({
                user_id: userId,
                title: title.trim(),
                message: message.trim(),
                type: type === "urgent" ? "urgent" : "announcement",
                broadcast_id: broadcastId
            });
            inAppCreated++;
        }
    }

    // Email Dispatch
    let emailStatus = "SKIPPED";
    if (activeChannels.includes("email")) {
        const hasResend = isResendConfigured();
        const smtpStatus = getSmtpConfigStatus();

        if (!hasResend && !smtpStatus.configured) {
            emailStatus = "SMTP_NOT_CONFIGURED";
        } else {
            const validStudents = students.filter((s) => s.email && typeof s.email === "string" && s.email.includes("@"));
            skippedMissingEmail = students.length - validStudents.length;

            if (validStudents.length === 0) {
                emailStatus = "NO_VALID_EMAILS";
            } else {
                for (const student of validStudents) {
                    const emailResult = await sendEmail({
                        to: student.email,
                        subject: `[CampusFlow Official] ${title.trim()}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <div style="font-size: 13px; font-weight: bold; color: #2549e8; text-transform: uppercase;">Official Placement Announcement</div>
                                <h2 style="color: #0f172a; margin-top: 8px;">${title.trim()}</h2>
                                <p style="color: #334155; line-height: 1.6; white-space: pre-line;">${message.trim()}</p>
                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                                <p style="font-size: 12px; color: #64748b;">This announcement was dispatched by the Training & Placement Office through CampusFlow.</p>
                            </div>
                        `
                    });

                    if (emailResult.success) {
                        emailsSent++;
                    } else {
                        emailsFailed++;
                    }
                }

                if (emailsFailed === 0 && emailsSent > 0) {
                    emailStatus = "DELIVERED";
                } else if (emailsFailed > 0 && emailsSent > 0) {
                    emailStatus = "PARTIAL_FAILURE";
                } else {
                    emailStatus = "FAILED";
                }
            }
        }
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                broadcastId,
                inAppCreated,
                emailsSent,
                emailsFailed,
                skippedMissingEmail,
                emailStatus,
                createdCount: inAppCreated || emailsSent
            },
            `Announcement processed: ${inAppCreated} in-app alerts created, ${emailsSent} emails sent.`
        )
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

    const result = await sendEmail({
        to: testEmail,
        subject: "CampusFlow V3 Email Delivery Verification",
        html: `<h3>CampusFlow V3 System Test</h3><p>This is a verified test email sent from CampusFlow V3 placement automation platform.</p>`
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                sent: result.success,
                status: result.status,
                messageId: result.messageId,
                recipient: testEmail
            },
            result.success
                ? "Test email dispatched successfully."
                : `Failed to deliver email: ${result.error || "Check provider configuration"}`
        )
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
