import { query } from "../database/db.js";
import { UserRecord } from "../database/types.js";

export const DEMO_ADMIN_USER: UserRecord = {
    id: "11111111-1111-1111-1111-111111111111",
    full_name: "TPO Administrator",
    email: "admin@campusflow.edu",
    password_hash: "$2b$10$aYattEKPDsPvvsWeg7AUYOPIVSY7.KOXAhBKj5DZY/9o8PqfT8Gfu", // Admin@12345
    role: "admin",
    phone: "+91 9876543210",
    avatar_url: "",
    avatar_public_id: "",
    is_email_verified: true,
    is_active: true,
    refresh_token: null,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
};

export const DEMO_STUDENT_USER: UserRecord = {
    id: "22222222-2222-2222-2222-222222222222",
    full_name: "Alex Sharma",
    email: "student@campusflow.edu",
    password_hash: "$2b$10$MQMLcptc7sQfFaihm2szRO3ivaJDNXDlOfkbjgbA3qSRKxee3AEr6", // Student@12345
    role: "student",
    phone: "+91 9123456789",
    avatar_url: "",
    avatar_public_id: "",
    is_email_verified: true,
    is_active: true,
    refresh_token: null,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
};

export class UserRepository {
    static async findById(id: string): Promise<UserRecord | null> {
        try {
            const res = await query<UserRecord>("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
            return res.rows[0] || null;
        } catch {
            return null;
        }
    }

    static async findByEmail(email: string): Promise<UserRecord | null> {
        const clean = email.trim().toLowerCase();
        try {
            const res = await query<UserRecord>(
                "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
                [clean]
            );
            return res.rows[0] || null;
        } catch {
            return null;
        }
    }

    static async findByUSNorEmail(identifier: string): Promise<{ user: UserRecord; studentProfileId?: string } | null> {
        const clean = identifier.trim().toLowerCase();

        try {
            // Check email first
            const userByEmail = await this.findByEmail(clean);
            if (userByEmail) {
                let studentProfileId: string | undefined;
                if (userByEmail.role === "student") {
                    const spRes = await query("SELECT id FROM student_profiles WHERE user_id = $1 LIMIT 1", [userByEmail.id]);
                    if (spRes.rows.length > 0) {
                        studentProfileId = spRes.rows[0].id;
                    }
                }
                return { user: userByEmail, studentProfileId };
            }

            // Check USN or Enrollment Number via student_profiles
            const res = await query(
                `SELECT u.*, sp.id AS student_profile_id
                 FROM users u
                 JOIN student_profiles sp ON sp.user_id = u.id
                 WHERE LOWER(sp.usn) = $1 OR LOWER(sp.enrollment_number) = $1
                 LIMIT 1`,
                [clean]
            );

            if (res.rows.length > 0) {
                const row = res.rows[0];
                const { student_profile_id, ...userData } = row;
                return { user: userData as UserRecord, studentProfileId: student_profile_id };
            }

            return null;
        } catch {
            return null;
        }
    }

    static async createUser(data: {
        fullName: string;
        email: string;
        passwordHash: string;
        role?: "student" | "admin";
        phone?: string;
    }): Promise<UserRecord> {
        const res = await query<UserRecord>(
            `INSERT INTO users (full_name, email, password_hash, role, phone)
             VALUES ($1, LOWER($2), $3, $4, $5)
             RETURNING *`,
            [data.fullName, data.email.trim(), data.passwordHash, data.role || "student", data.phone || null]
        );
        return res.rows[0];
    }

    static async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
        await query("UPDATE users SET refresh_token = $1 WHERE id = $2", [refreshToken, userId]);
    }

    static async updateLastLogin(userId: string): Promise<void> {
        await query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
    }

    static async updatePassword(userId: string, passwordHash: string): Promise<void> {
        await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
    }

    static async updateAvatar(userId: string, avatarUrl: string, avatarPublicId: string): Promise<void> {
        await query("UPDATE users SET avatar_url = $1, avatar_public_id = $2 WHERE id = $3", [
            avatarUrl,
            avatarPublicId,
            userId
        ]);
    }
}
