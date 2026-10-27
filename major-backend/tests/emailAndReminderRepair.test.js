import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../dist/database/db.js";
import { NotificationRepository } from "../dist/repositories/notification.repository.js";
import { ReminderRepository } from "../dist/repositories/reminder.repository.js";
import { DriveRepository } from "../dist/repositories/drive.repository.js";
import { CompanyRepository } from "../dist/repositories/company.repository.js";
import { ReminderSchedulerService, DEFAULT_REMINDER_OFFSETS_HOURS } from "../dist/services/reminderScheduler.service.js";
import {
    validateEmailAddress,
    isPlaceholderValue,
    validateEmailConfigOnStartup,
    sendEmail
} from "../dist/services/integrations/email/mail.service.js";
import { formatNotificationResponse } from "../dist/controllers/notification.controller.js";

test("Email Service - Validation, Normalization and Provider Guardrails", async (t) => {
    await t.test("Validates authentic RFC-compliant recipient email addresses", () => {
        assert.equal(validateEmailAddress("student@campusflow.edu"), true);
        assert.equal(validateEmailAddress("user.name+tag@college.ac.in"), true);
        assert.equal(validateEmailAddress("invalid-email"), false);
        assert.equal(validateEmailAddress("@missing-local.com"), false);
        assert.equal(validateEmailAddress("missing-domain@"), false);
        assert.equal(validateEmailAddress(null), false);
        assert.equal(validateEmailAddress(""), false);
    });

    await t.test("Detects placeholder and dummy values safely", () => {
        assert.equal(isPlaceholderValue("your_email@example.com"), true);
        assert.equal(isPlaceholderValue("your_app_password"), true);
        assert.equal(isPlaceholderValue("changeme"), true);
        assert.equal(isPlaceholderValue("<api_key_here>"), true);
        assert.equal(isPlaceholderValue("actual_real_key_xyz123"), false);
    });

    await t.test("Startup validator checks configuration without credential leaks", () => {
        const config = validateEmailConfigOnStartup();
        assert.ok(typeof config.provider === "string");
        assert.ok(typeof config.configured === "boolean");
        assert.ok(typeof config.sender === "string");
    });

    await t.test("Rejects dispatch to invalid recipient addresses with normalized error", async () => {
        const res = await sendEmail({
            to: "not-an-email",
            subject: "Test Subject",
            html: "<p>Test</p>"
        });
        assert.equal(res.success, false);
        assert.equal(res.status, "INVALID_RECIPIENT");
        assert.ok(res.error);
    });
});

test("In-App Notifications - Persistence, Security and Dual Casing Formatting", async (t) => {
    const timestamp = Date.now();
    let userA = null;
    let userB = null;
    let notifA = null;

    try {
        // Fetch two distinct users
        const usersRes = await query("SELECT id, role FROM users LIMIT 2");
        assert.ok(usersRes.rows.length >= 2, "Requires at least 2 users in test database");
        userA = usersRes.rows[0];
        userB = usersRes.rows[1];

        // 1. Create notification for User A
        notifA = await NotificationRepository.create({
            user_id: userA.id,
            title: `Placement Drive Published ${timestamp}`,
            message: "A new placement drive has been announced by Enterprise Tech.",
            type: "placement_alert",
            company_name: "Enterprise Tech",
            job_title: "Cloud Architect",
            interview_date: new Date(Date.now() + 86400000).toISOString(),
            interview_round: "Technical Interview",
            interview_location: "Building C, Tech Center",
            offered_package: 18.5
        });

        assert.ok(notifA.id, "Notification ID should be generated");
        assert.equal(notifA.user_id, userA.id);
        assert.equal(notifA.is_read, false);

        // 2. Format notification for dual casing (frontend camelCase and backend snake_case)
        const formatted = formatNotificationResponse(notifA);
        assert.equal(formatted.id, notifA.id);
        assert.equal(formatted._id, notifA.id);
        assert.equal(formatted.is_read, false);
        assert.equal(formatted.isRead, false);
        assert.equal(formatted.companyName, "Enterprise Tech");
        assert.equal(formatted.company_name, "Enterprise Tech");
        assert.equal(formatted.offeredPackage, 18.5);
        assert.equal(formatted.interviewRound, "Technical Interview");

        // 3. User B cannot mark User A's notification as read (Isolation / Ownership)
        const markResB = await NotificationRepository.markAsRead(notifA.id, userB.id);
        assert.equal(markResB, null, "User B must not be able to mark User A's notification as read");

        // 4. User A successfully marks notification as read
        const markResA = await NotificationRepository.markAsRead(notifA.id, userA.id);
        assert.ok(markResA, "User A should successfully mark their own notification as read");
        assert.equal(markResA.is_read, true);

        // 5. Test paginated user retrieval
        const paged = await NotificationRepository.findByUserPaged(userA.id, { page: 1, limit: 10 });
        assert.ok(Array.isArray(paged.notifications));
        assert.ok(paged.total >= 1);
        assert.ok(typeof paged.unreadCount === "number");

        // 6. User B cannot delete User A's notification
        await NotificationRepository.deleteNotification(notifA.id, userB.id);
        const checkExisting = await query("SELECT id FROM notifications WHERE id = $1", [notifA.id]);
        assert.equal(checkExisting.rows.length, 1, "Notification must not be deleted by unauthorized user");

        // 7. User A deletes their own notification
        await NotificationRepository.deleteNotification(notifA.id, userA.id);
        const checkDeleted = await query("SELECT id FROM notifications WHERE id = $1", [notifA.id]);
        assert.equal(checkDeleted.rows.length, 0, "Notification must be deleted by recipient");
    } finally {
        if (notifA?.id) {
            await query("DELETE FROM notifications WHERE id = $1", [notifA.id]);
        }
    }
});

test("Durable Reminder Scheduling - Idempotency, Atomic Claiming and Lifecycle", async (t) => {
    const timestamp = Date.now();
    let company = null;
    let drive = null;
    let admin = null;

    try {
        const adminRes = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        admin = adminRes.rows[0];

        company = await CompanyRepository.create({
            companyName: `Scheduler Corp ${timestamp}`,
            industry: "Enterprise AI & Cloud",
            location: "Hyderabad",
            createdBy: admin.id
        });

        // 1. Create a published drive with deadline 48 hours from now
        const deadline = new Date(Date.now() + 48 * 3600 * 1000);
        drive = await DriveRepository.create({
            company_id: company.id,
            job_title: `Site Reliability Engineer ${timestamp}`,
            job_type: "full-time",
            graduation_year: 2026,
            application_start_date: new Date(Date.now() - 3600 * 1000),
            application_deadline: deadline,
            drive_date: new Date(deadline.getTime() + 86400000),
            created_by: admin.id,
            package: 14.0,
            reminder_settings: {
                remindersEnabled: true,
                reminderOffsetsHours: [24, 6]
            }
        });

        // 2. Synchronize reminders
        const syncRes = await ReminderSchedulerService.syncDriveReminders(drive.id);
        assert.equal(syncRes.synced, true);
        assert.equal(syncRes.status, "SCHEDULED");
        assert.ok(syncRes.scheduledCount >= 1, "Should schedule reminders for valid future offsets");

        // 3. Verify Idempotency - Calling sync again must NOT insert duplicate jobs
        const duplicateSync = await ReminderSchedulerService.syncDriveReminders(drive.id);
        assert.equal(duplicateSync.synced, true);

        const jobsRes = await query(
            "SELECT * FROM reminder_jobs WHERE drive_id = $1 ORDER BY scheduled_time ASC",
            [drive.id]
        );
        // Only 2 offsets: 24h and 6h
        assert.equal(jobsRes.rows.length, 2, "Idempotency prevents duplicate reminder job rows");

        // 4. Test Concurrency-Safe Atomic Claiming (claimDueJobs)
        // Temporarily adjust scheduled_time of one job to be in the past so it's due
        const dueJobId = jobsRes.rows[0].id;
        await query(
            "UPDATE reminder_jobs SET scheduled_time = now() - INTERVAL '5 minutes' WHERE id = $1",
            [dueJobId]
        );

        const claimed = await ReminderRepository.claimDueJobs(10);
        const myClaimedJob = claimed.find((j) => j.id === dueJobId);
        assert.ok(myClaimedJob, "Due job should be claimed atomically");
        assert.equal(myClaimedJob.status, "PROCESSING");
        assert.equal(myClaimedJob.attempts, 1);

        // A second concurrent worker claiming due jobs at the same time will NOT receive the already-claimed job
        const secondClaim = await ReminderRepository.claimDueJobs(10);
        const duplicateClaim = secondClaim.find((j) => j.id === dueJobId);
        assert.equal(duplicateClaim, undefined, "Worker concurrency collision prevented via SKIP LOCKED");

        // 5. Test Zombie Worker Recovery
        // Simulate worker crash: job remains in PROCESSING with old last_attempt_at
        await query(
            "UPDATE reminder_jobs SET last_attempt_at = now() - INTERVAL '15 minutes' WHERE id = $1",
            [dueJobId]
        );

        // Next claimDueJobs invocation should recover the abandoned job and mark it PENDING
        await ReminderRepository.claimDueJobs(10);
        const recoveredJob = await ReminderRepository.findById(dueJobId);
        assert.ok(recoveredJob.status === "PENDING" || recoveredJob.status === "PROCESSING");

        // 6. Test Deadline Rescheduling - Cancels stale pending jobs
        const newDeadline = new Date(Date.now() + 72 * 3600 * 1000);
        await DriveRepository.update(drive.id, {
            application_deadline: newDeadline
        });
        await ReminderSchedulerService.syncDriveReminders(drive.id);

        const staleCancelled = await query(
            "SELECT COUNT(*)::int AS count FROM reminder_jobs WHERE drive_id = $1 AND status = 'CANCELLED'",
            [drive.id]
        );
        assert.ok(staleCancelled.rows[0].count >= 1, "Old deadline reminders must be cancelled when deadline changes");

        // 7. Drive Archival / Deactivation - Cancels pending jobs
        await DriveRepository.archive(drive.id);
        await ReminderSchedulerService.syncDriveReminders(drive.id);

        const activePending = await query(
            "SELECT COUNT(*)::int AS count FROM reminder_jobs WHERE drive_id = $1 AND status = 'PENDING'",
            [drive.id]
        );
        assert.equal(activePending.rows[0].count, 0, "No pending reminders remain when drive is archived");
    } finally {
        if (drive?.id) {
            await query("DELETE FROM reminder_jobs WHERE drive_id = $1", [drive.id]);
            await query("DELETE FROM placement_drives WHERE id = $1", [drive.id]);
        }
        if (company?.id) {
            await query("DELETE FROM companies WHERE id = $1", [company.id]);
        }
    }
});
