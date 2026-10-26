import { query } from "../database/db.js";
import { SupportConversationRecord } from "../database/types.js";

export class SupportRepository {
    static async findByStudent(studentId: string): Promise<any[]> {
        const res = await query(
            `SELECT sc.*,
                    u.full_name AS student_name, u.email AS student_email,
                    adm.full_name AS assigned_admin_name
             FROM support_conversations sc
             JOIN users u ON u.id = sc.student_id
             LEFT JOIN users adm ON adm.id = sc.assigned_admin
             WHERE sc.student_id = $1
             ORDER BY sc.last_message_at DESC`,
            [studentId]
        );
        return res.rows;
    }

    static async findAllInbox(): Promise<any[]> {
        const res = await query(
            `SELECT sc.*,
                    u.full_name AS student_name, u.email AS student_email,
                    sp.usn, sp.branch,
                    adm.full_name AS assigned_admin_name
             FROM support_conversations sc
             JOIN users u ON u.id = sc.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = u.id
             LEFT JOIN users adm ON adm.id = sc.assigned_admin
             ORDER BY sc.last_message_at DESC`
        );
        return res.rows;
    }

    static async findById(id: string): Promise<any | null> {
        const res = await query(
            `SELECT sc.*,
                    u.full_name AS student_name, u.email AS student_email,
                    sp.usn, sp.branch, sp.cgpa,
                    adm.full_name AS assigned_admin_name
             FROM support_conversations sc
             JOIN users u ON u.id = sc.student_id
             LEFT JOIN student_profiles sp ON sp.user_id = u.id
             LEFT JOIN users adm ON adm.id = sc.assigned_admin
             WHERE sc.id = $1 LIMIT 1`,
            [id]
        );
        return res.rows[0] || null;
    }

    static async create(studentId: string, subject: string, initialMessage: any): Promise<SupportConversationRecord> {
        const msg = {
            id: `msg_${Date.now()}`,
            senderRole: "student",
            sender: studentId,
            content: initialMessage,
            createdAt: new Date().toISOString()
        };

        const res = await query<SupportConversationRecord>(
            `INSERT INTO support_conversations (
                student_id, subject, status, messages, last_message_at
             )
             VALUES ($1, $2, 'open', $3, now())
             RETURNING *`,
            [studentId, subject.trim(), JSON.stringify([msg])]
        );
        return res.rows[0];
    }

    static async addMessage(
        conversationId: string,
        message: {
            senderRole: "student" | "assistant" | "admin";
            senderId?: string | null;
            content: string;
            confidence?: number;
            handoffRecommended?: boolean;
        }
    ): Promise<SupportConversationRecord> {
        const entry = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            senderRole: message.senderRole,
            sender: message.senderId || null,
            content: message.content,
            confidence: message.confidence ?? null,
            handoffRecommended: message.handoffRecommended ?? false,
            createdAt: new Date().toISOString()
        };

        const statusUpdate = message.senderRole === "admin"
            ? "answered"
            : message.senderRole === "assistant"
            ? "bot_answered"
            : "open";

        const res = await query<SupportConversationRecord>(
            `UPDATE support_conversations
             SET messages = messages || $1::jsonb,
                 last_message_at = now(),
                 status = $2
             WHERE id = $3
             RETURNING *`,
            [JSON.stringify([entry]), statusUpdate, conversationId]
        );
        return res.rows[0];
    }

    static async updateStatus(
        conversationId: string,
        status: "open" | "answered" | "bot_answered" | "closed",
        assignedAdmin?: string | null
    ): Promise<SupportConversationRecord> {
        const res = await query<SupportConversationRecord>(
            `UPDATE support_conversations
             SET status = $1,
                 assigned_admin = COALESCE($2, assigned_admin)
             WHERE id = $3
             RETURNING *`,
            [status, assignedAdmin || null, conversationId]
        );
        return res.rows[0];
    }
}
