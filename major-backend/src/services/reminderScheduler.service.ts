import { ReminderRepository } from "../repositories/reminder.repository.js";
import { DriveRepository } from "../repositories/drive.repository.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { ApplicationRepository } from "../repositories/application.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { EligibilityService } from "./eligibility.service.js";
import { sendDeadlineReminderEmail } from "./integrations/email/mail.service.js";
import { query } from "../database/db.js";

export const DEFAULT_REMINDER_OFFSETS_HOURS = [24, 6, 2];

let schedulerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export class ReminderSchedulerService {
    /**
     * Synchronizes scheduled deadline reminders for a placement drive.
     * Ensures only active, published drives with future deadlines have pending reminders.
     * Cancels stale pending reminders when deadlines change or drives are deactivated.
     */
    static async syncDriveReminders(driveId: string): Promise<{ synced: boolean; scheduledCount: number; status: string }> {
        const drive = await DriveRepository.findById(driveId);
        if (!drive) return { synced: false, scheduledCount: 0, status: "NOT_FOUND" };

        const reminderSettings = drive.reminder_settings || (drive as any).reminderSettings;
        const isRemindersEnabled = drive.is_active && reminderSettings?.remindersEnabled !== false;

        if (!isRemindersEnabled) {
            await ReminderRepository.cancelPendingForDrive(driveId, "Reminders disabled or drive inactive");
            return { synced: true, scheduledCount: 0, status: "DISABLED" };
        }

        const deadline = new Date(drive.application_deadline);
        const now = new Date();

        if (now >= deadline) {
            await ReminderRepository.cancelPendingForDrive(driveId, "Deadline already passed");
            return { synced: true, scheduledCount: 0, status: "EXPIRED" };
        }

        // Cancel any pending reminders that were calculated for an older deadline
        await query(
            `UPDATE reminder_jobs
             SET status = 'CANCELLED', error_category = 'Drive deadline updated; stale reminder cancelled', updated_at = now()
             WHERE drive_id = $1 AND status = 'PENDING' AND drive_deadline != $2`,
            [driveId, deadline]
        );

        const offsets: number[] = Array.isArray(reminderSettings?.reminderOffsetsHours) && reminderSettings.reminderOffsetsHours.length > 0
            ? reminderSettings.reminderOffsetsHours
            : DEFAULT_REMINDER_OFFSETS_HOURS;

        let scheduledCount = 0;

        for (const offset of offsets) {
            const offsetNum = Number(offset);
            if (isNaN(offsetNum) || offsetNum <= 0) continue;

            const scheduledTime = new Date(deadline.getTime() - offsetNum * 3600 * 1000);
            const idempotencyKey = `${drive.id}:${offsetNum}:${deadline.getTime()}`;

            // Only schedule if the reminder time is in the future and strictly before the deadline
            if (scheduledTime > now && scheduledTime < deadline) {
                const job = await ReminderRepository.createJob({
                    driveId: drive.id,
                    idempotencyKey,
                    offsetHours: offsetNum,
                    scheduledTime,
                    driveDeadline: deadline,
                    channels: reminderSettings?.channels || ["in_app", "email"]
                });
                if (job) scheduledCount++;
            }
        }

        return { synced: true, scheduledCount, status: "SCHEDULED" };
    }

    /**
     * Atomically claims and processes all due reminder jobs.
     * Concurrency-safe across multiple worker instances via FOR UPDATE SKIP LOCKED.
     */
    static async processDueReminders(limit: number = 20): Promise<{ processed: number; message: string }> {
        if (isProcessing) return { processed: 0, message: "Worker already in progress" };
        isProcessing = true;

        try {
            const dueJobs = await ReminderRepository.claimDueJobs(limit);
            if (dueJobs.length === 0) {
                return { processed: 0, message: "No pending reminder jobs due" };
            }

            let processedCount = 0;

            for (const job of dueJobs) {
                try {
                    const drive = await DriveRepository.findById(job.drive_id);
                    if (!drive || !drive.is_active) {
                        await ReminderRepository.updateJobStatus(job.id, "CANCELLED", {
                            errorCategory: "Drive is missing or archived"
                        });
                        continue;
                    }

                    // Verify deadline has not been rescheduled since this job was generated
                    const currentDeadline = new Date(drive.application_deadline).getTime();
                    const jobDeadline = new Date(job.drive_deadline).getTime();
                    if (currentDeadline !== jobDeadline) {
                        await ReminderRepository.updateJobStatus(job.id, "CANCELLED", {
                            errorCategory: "Drive deadline rescheduled; stale reminder invalidated"
                        });
                        continue;
                    }

                    // Verify deadline has not already elapsed
                    if (new Date() >= new Date(drive.application_deadline)) {
                        await ReminderRepository.updateJobStatus(job.id, "CANCELLED", {
                            errorCategory: "Drive deadline has already passed"
                        });
                        continue;
                    }

                    // Fetch candidate pool for this drive's graduation cohort
                    const { students } = await StudentRepository.findAll({
                        sessionYear: drive.graduation_year,
                        limit: 5000
                    });

                    // Fetch existing applications to exclude students who have already submitted
                    const existingApps = await ApplicationRepository.findByDrive(drive.id);
                    const appliedStudentIds = new Set(existingApps.map((a: any) => a.student_id));

                    let inAppCreated = 0;
                    let emailAccepted = 0;
                    let emailFailed = 0;
                    let skippedAlreadyApplied = 0;
                    let skippedIneligible = 0;
                    const providerMessageIds: string[] = [];

                    for (const student of students) {
                        if (appliedStudentIds.has(student.id)) {
                            skippedAlreadyApplied++;
                            continue;
                        }

                        const report = EligibilityService.evaluate(student, drive);
                        if (!report.isEligible) {
                            skippedIneligible++;
                            continue;
                        }

                        // Send In-App Notification
                        if (job.channels.includes("in_app")) {
                            const studentUserId = student.user_id || student.id;
                            if (studentUserId) {
                                await NotificationRepository.create({
                                    user_id: studentUserId,
                                    title: `[Reminder] ${drive.company.company_name} Application Closing Soon`,
                                    message: `The application deadline for ${drive.job_title} at ${drive.company.company_name} (₹${drive.package} LPA) closes at ${new Date(drive.application_deadline).toLocaleTimeString()}. Submit your application now!`,
                                    type: "deadline_reminder",
                                    company_name: drive.company.company_name,
                                    job_title: drive.job_title
                                });
                                inAppCreated++;
                            }
                        }

                        // Send Email Notification
                        if (job.channels.includes("email") && student.email) {
                            const sendRes = await sendDeadlineReminderEmail(
                                student.email,
                                student.full_name || "Student",
                                {
                                    companyName: drive.company.company_name,
                                    jobTitle: drive.job_title,
                                    package: drive.package,
                                    deadline: drive.application_deadline,
                                    driveId: drive.id
                                }
                            );
                            if (sendRes.success) {
                                emailAccepted++;
                                if (sendRes.messageId) providerMessageIds.push(sendRes.messageId);
                            } else {
                                emailFailed++;
                            }
                        }
                    }

                    await ReminderRepository.updateJobStatus(job.id, "COMPLETED", {
                        deliverySummary: {
                            targetedCandidates: students.length,
                            inAppCreated,
                            emailAccepted,
                            emailFailed,
                            skippedAlreadyApplied,
                            skippedIneligible,
                            providerMessageIds: providerMessageIds.slice(0, 50)
                        },
                        inAppCompleted: inAppCreated > 0,
                        emailCompleted: emailAccepted > 0
                    });

                    processedCount++;
                } catch (err: any) {
                    console.error(`[REMINDER ERROR] Job execution failure (id=${job.id}):`, err?.message || err);
                    const currentAttempts = (job.attempts || 1);
                    const maxAttempts = job.max_attempts || 3;

                    if (currentAttempts >= maxAttempts) {
                        await ReminderRepository.updateJobStatus(job.id, "FAILED", {
                            attempts: currentAttempts,
                            errorCategory: `Terminal failure after ${currentAttempts} attempts: ${err?.message || "Execution error"}`
                        });
                    } else {
                        // Re-queue with bounded retry backoff (5 minutes)
                        const retryTime = new Date(Date.now() + 5 * 60 * 1000);
                        await query(
                            `UPDATE reminder_jobs
                             SET status = 'PENDING',
                                 scheduled_time = $1,
                                 error_category = $2,
                                 updated_at = now()
                             WHERE id = $3`,
                            [
                                retryTime,
                                `Transient failure (attempt ${currentAttempts}): ${err?.message || "Execution error"}. Retrying at ${retryTime.toISOString()}`,
                                job.id
                            ]
                        );
                    }
                }
            }

            return { processed: processedCount, message: `Processed ${processedCount} reminder jobs successfully` };
        } finally {
            isProcessing = false;
        }
    }

    static startWorker(intervalMs: number = 60000): void {
        if (schedulerInterval) return;
        console.log(`[REMINDER WORKER] Scheduler active (polling every ${intervalMs / 1000}s)`);
        schedulerInterval = setInterval(() => {
            this.processDueReminders().catch((err) =>
                console.error("[REMINDER WORKER ERROR]:", err?.message || err)
            );
        }, intervalMs);
    }

    static stopWorker(): void {
        if (schedulerInterval) {
            clearInterval(schedulerInterval);
            schedulerInterval = null;
            console.log("[REMINDER WORKER] Scheduler stopped");
        }
    }
}
