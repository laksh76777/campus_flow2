import { ReminderRepository } from "../repositories/reminder.repository.js";
import { DriveRepository } from "../repositories/drive.repository.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { ApplicationRepository } from "../repositories/application.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { EligibilityService } from "./eligibility.service.js";
import { sendDeadlineReminderEmail } from "./integrations/email/mail.service.js";

let schedulerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export class ReminderSchedulerService {
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

        const offsets: number[] = Array.isArray(reminderSettings?.reminderOffsetsHours) && reminderSettings.reminderOffsetsHours.length > 0
            ? reminderSettings.reminderOffsetsHours
            : [6];

        let scheduledCount = 0;

        for (const offset of offsets) {
            const offsetNum = Number(offset);
            if (isNaN(offsetNum) || offsetNum <= 0) continue;

            const scheduledTime = new Date(deadline.getTime() - offsetNum * 3600 * 1000);
            const idempotencyKey = `${drive.id}_${offsetNum}_${deadline.getTime()}`;

            if (scheduledTime > now) {
                await ReminderRepository.createJob({
                    driveId: drive.id,
                    idempotencyKey,
                    offsetHours: offsetNum,
                    scheduledTime,
                    driveDeadline: deadline,
                    channels: reminderSettings?.channels || ["in_app", "email"]
                });
                scheduledCount++;
            }
        }

        return { synced: true, scheduledCount, status: "SCHEDULED" };
    }

    static async processDueReminders(): Promise<{ processed: number; message: string }> {
        if (isProcessing) return { processed: 0, message: "Worker already in progress" };
        isProcessing = true;

        try {
            const dueJobs = await ReminderRepository.findPendingDue();
            if (dueJobs.length === 0) {
                return { processed: 0, message: "No pending reminder jobs due" };
            }

            let processedCount = 0;

            for (const job of dueJobs) {
                await ReminderRepository.updateJobStatus(job.id, "PROCESSING");

                try {
                    const drive = await DriveRepository.findById(job.drive_id);
                    if (!drive || !drive.is_active) {
                        await ReminderRepository.updateJobStatus(job.id, "CANCELLED", {
                            errorCategory: "Drive is missing or archived"
                        });
                        continue;
                    }

                    // Fetch candidate pool
                    const { students } = await StudentRepository.findAll({
                        sessionYear: drive.graduation_year,
                        limit: 1000
                    });

                    // Fetch existing applications to skip candidates who have already applied
                    const existingApps = await ApplicationRepository.findByDrive(drive.id);
                    const appliedStudentIds = new Set(existingApps.map((a: any) => a.student_id));

                    let inAppCreated = 0;
                    let emailAccepted = 0;
                    let skippedAlreadyApplied = 0;
                    let skippedIneligible = 0;

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
                            await NotificationRepository.create({
                                user_id: student.user_id,
                                title: `[Reminder] ${drive.company.company_name} Application Closing Soon`,
                                message: `The application deadline for ${drive.job_title} at ${drive.company.company_name} (₹${drive.package} LPA) closes at ${new Date(drive.application_deadline).toLocaleTimeString()}. Submit your application now!`,
                                type: "deadline_reminder",
                                company_name: drive.company.company_name,
                                job_title: drive.job_title
                            });
                            inAppCreated++;
                        }

                        // Send Email Notification
                        if (job.channels.includes("email") && student.email) {
                            const sent = await sendDeadlineReminderEmail(
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
                            if (sent) emailAccepted++;
                        }
                    }

                    await ReminderRepository.updateJobStatus(job.id, "COMPLETED", {
                        deliverySummary: {
                            targetedCandidates: students.length,
                            inAppCreated,
                            emailAccepted,
                            skippedAlreadyApplied,
                            skippedIneligible
                        },
                        inAppCompleted: inAppCreated > 0,
                        emailCompleted: emailAccepted > 0
                    });

                    processedCount++;
                } catch (err: any) {
                    console.error(`Error executing reminder job ${job.id}:`, err);
                    await ReminderRepository.updateJobStatus(job.id, "FAILED", {
                        attempts: (job.attempts || 0) + 1,
                        errorCategory: err?.message || "Execution failure"
                    });
                }
            }

            return { processed: processedCount, message: `Processed ${processedCount} reminder jobs successfully` };
        } finally {
            isProcessing = false;
        }
    }

    static startWorker(intervalMs: number = 60000): void {
        if (schedulerInterval) return;
        console.log(`[REMINDER WORKER] Started background scheduler (polling every ${intervalMs / 1000}s)`);
        schedulerInterval = setInterval(() => {
            this.processDueReminders().catch((err) =>
                console.error("[REMINDER WORKER ERROR]:", err)
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
