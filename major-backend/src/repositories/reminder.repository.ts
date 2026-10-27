import { query } from "../database/db.js";
import { ReminderJobRecord } from "../database/types.js";

export class ReminderRepository {
    /**
     * Atomically claims pending reminder jobs that are due for execution using FOR UPDATE SKIP LOCKED.
     * Also recovers zombie jobs that were left in PROCESSING state after an unexpected worker crash.
     */
    static async claimDueJobs(limit: number = 10, now: Date = new Date()): Promise<ReminderJobRecord[]> {
        // 1. Recover zombie jobs that were abandoned in PROCESSING for > 10 minutes
        await query(
            `UPDATE reminder_jobs
             SET status = 'PENDING',
                 error_category = 'Worker timeout recovery - rescheduled to pending'
             WHERE status = 'PROCESSING'
               AND last_attempt_at < now() - INTERVAL '10 minutes'
               AND attempts < max_attempts`
        );

        // 2. Mark permanently failed jobs that timed out and reached max_attempts
        await query(
            `UPDATE reminder_jobs
             SET status = 'FAILED',
                 error_category = 'Exceeded maximum retry attempts during processing'
             WHERE status = 'PROCESSING'
               AND last_attempt_at < now() - INTERVAL '10 minutes'
               AND attempts >= max_attempts`
        );

        // 3. Atomically claim due pending jobs with SKIP LOCKED concurrency protection
        const res = await query<ReminderJobRecord>(
            `WITH claimable AS (
                SELECT id FROM reminder_jobs
                WHERE status = 'PENDING'
                  AND scheduled_time <= $1
                ORDER BY scheduled_time ASC
                LIMIT $2
                FOR UPDATE SKIP LOCKED
             )
             UPDATE reminder_jobs rj
             SET status = 'PROCESSING',
                 attempts = attempts + 1,
                 last_attempt_at = now()
             FROM claimable
             WHERE rj.id = claimable.id
             RETURNING rj.*`,
            [now, limit]
        );

        return res.rows;
    }

    static async findPendingDue(now: Date = new Date()): Promise<ReminderJobRecord[]> {
        const res = await query<ReminderJobRecord>(
            `SELECT * FROM reminder_jobs
             WHERE status = 'PENDING' AND scheduled_time <= $1
             ORDER BY scheduled_time ASC
             LIMIT 50`,
            [now]
        );
        return res.rows;
    }

    static async findById(id: string): Promise<ReminderJobRecord | null> {
        const res = await query<ReminderJobRecord>(
            "SELECT * FROM reminder_jobs WHERE id = $1 LIMIT 1",
            [id]
        );
        return res.rows[0] || null;
    }

    static async findByIdempotencyKey(key: string): Promise<ReminderJobRecord | null> {
        const res = await query<ReminderJobRecord>(
            "SELECT * FROM reminder_jobs WHERE idempotency_key = $1 LIMIT 1",
            [key]
        );
        return res.rows[0] || null;
    }

    static async createJob(data: {
        driveId: string;
        idempotencyKey: string;
        offsetHours: number;
        scheduledTime: Date;
        driveDeadline: Date;
        channels?: string[];
    }): Promise<ReminderJobRecord | null> {
        const res = await query<ReminderJobRecord>(
            `INSERT INTO reminder_jobs (
                drive_id, idempotency_key, offset_hours, scheduled_time,
                drive_deadline, channels, status
             )
             VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
             ON CONFLICT (idempotency_key) DO NOTHING
             RETURNING *`,
            [
                data.driveId,
                data.idempotencyKey,
                data.offsetHours,
                data.scheduledTime,
                data.driveDeadline,
                data.channels || ["in_app", "email"]
            ]
        );
        return res.rows[0] || null;
    }

    static async updateJobStatus(
        id: string,
        status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED",
        extra: {
            attempts?: number;
            errorCategory?: string;
            deliverySummary?: Record<string, any>;
            inAppCompleted?: boolean;
            emailCompleted?: boolean;
        } = {}
    ): Promise<void> {
        await query(
            `UPDATE reminder_jobs
             SET status = $1,
                 attempts = COALESCE($2, attempts),
                 last_attempt_at = now(),
                 error_category = COALESCE($3, error_category),
                 delivery_summary = COALESCE($4, delivery_summary),
                 in_app_completed = COALESCE($5, in_app_completed),
                 email_completed = COALESCE($6, email_completed),
                 updated_at = now()
             WHERE id = $7`,
            [
                status,
                extra.attempts != null ? extra.attempts : null,
                extra.errorCategory != null ? extra.errorCategory : null,
                extra.deliverySummary ? JSON.stringify(extra.deliverySummary) : null,
                extra.inAppCompleted ?? null,
                extra.emailCompleted ?? null,
                id
            ]
        );
    }

    static async cancelPendingForDrive(driveId: string, reason: string): Promise<number> {
        const res = await query(
            `UPDATE reminder_jobs
             SET status = 'CANCELLED', error_category = $1, updated_at = now()
             WHERE drive_id = $2 AND status = 'PENDING'`,
            [reason, driveId]
        );
        return (res as any).rowCount || 0;
    }

    static async findAllJobs(limit: number = 100): Promise<ReminderJobRecord[]> {
        const res = await query<ReminderJobRecord>(
            `SELECT rj.*, pd.job_title, c.company_name
             FROM reminder_jobs rj
             LEFT JOIN placement_drives pd ON pd.id = rj.drive_id
             LEFT JOIN companies c ON c.id = pd.company_id
             ORDER BY rj.scheduled_time DESC
             LIMIT $1`,
            [limit]
        );
        return res.rows;
    }
}
