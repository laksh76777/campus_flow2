import { query } from "../database/db.js";
import { NotificationRecord } from "../database/types.js";

export class NotificationRepository {
    static async findByUser(userId: string): Promise<NotificationRecord[]> {
        try {
            const res = await query<NotificationRecord>(
                `SELECT * FROM notifications
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [userId]
            );
            return res.rows;
        } catch {
            return [];
        }
    }

    static async create(data: Partial<NotificationRecord>): Promise<NotificationRecord> {
        const res = await query<NotificationRecord>(
            `INSERT INTO notifications (
                user_id, title, message, type, status, company_name, job_title,
                remarks, interview_date, interview_round, interview_location,
                offered_package, application_id, broadcast_id
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [
                data.user_id,
                data.title,
                data.message,
                data.type || "status_update",
                data.status || null,
                data.company_name || "",
                data.job_title || "",
                data.remarks || "",
                data.interview_date || null,
                data.interview_round || "",
                data.interview_location || "",
                data.offered_package || null,
                data.application_id || null,
                data.broadcast_id || ""
            ]
        );
        return res.rows[0];
    }

    static async markAsRead(id: string, userId: string): Promise<void> {
        await query(
            "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
            [id, userId]
        );
    }

    static async markAllAsRead(userId: string): Promise<void> {
        await query(
            "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
            [userId]
        );
    }

    static async deleteNotification(id: string, userId: string): Promise<void> {
        await query(
            "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
            [id, userId]
        );
    }

    static async clearAllForUser(userId: string): Promise<void> {
        await query("DELETE FROM notifications WHERE user_id = $1", [userId]);
    }

    static async getBroadcastHistory(): Promise<any[]> {
        const res = await query(
            `SELECT broadcast_id, title, message, MIN(created_at) AS created_at, COUNT(*) AS recipient_count
             FROM notifications
             WHERE broadcast_id IS NOT NULL AND broadcast_id != ''
             GROUP BY broadcast_id, title, message
             ORDER BY MIN(created_at) DESC`
        );
        return res.rows;
    }

    static async deleteBroadcast(identifier: string): Promise<{ deletedCount: number }> {
        const res = await query(
            `DELETE FROM notifications
             WHERE broadcast_id = $1 OR id::text = $1`,
            [identifier]
        );
        return { deletedCount: (res as any).rowCount || 0 };
    }

    static async freshstartNotifications(): Promise<{ purgedCount: number }> {
        const res = await query(
            `DELETE FROM notifications
             WHERE type = 'announcement' OR (broadcast_id IS NOT NULL AND broadcast_id != '')`
        );
        return { purgedCount: (res as any).rowCount || 0 };
    }
}
