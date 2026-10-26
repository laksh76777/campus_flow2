import { query } from "../database/db.js";

export class PasswordResetRepository {
    static async createChallenge(data: {
        userId: string;
        email: string;
        otpHash: string;
        expiresAt: Date;
    }): Promise<any> {
        // Mark previous active challenges for this email as superseded
        await query(
            "UPDATE password_reset_challenges SET status = 'SUPERSEDED' WHERE LOWER(email) = LOWER($1) AND status = 'PENDING'",
            [data.email]
        );

        const res = await query(
            `INSERT INTO password_reset_challenges (
                user_id, email, otp_hash, expires_at, status
             )
             VALUES ($1, LOWER($2), $3, $4, 'PENDING')
             RETURNING *`,
            [data.userId, data.email.trim(), data.otpHash, data.expiresAt]
        );
        return res.rows[0];
    }

    static async findPendingByEmail(email: string): Promise<any | null> {
        const res = await query(
            `SELECT * FROM password_reset_challenges
             WHERE LOWER(email) = LOWER($1) AND status = 'PENDING' AND expires_at > now()
             ORDER BY created_at DESC LIMIT 1`,
            [email.trim()]
        );
        return res.rows[0] || null;
    }

    static async setVerified(id: string, resetTokenHash: string, tokenExpiresAt: Date): Promise<void> {
        await query(
            `UPDATE password_reset_challenges
             SET status = 'VERIFIED',
                 reset_token_hash = $1,
                 reset_token_expires_at = $2,
                 verified_at = now()
             WHERE id = $3`,
            [resetTokenHash, tokenExpiresAt, id]
        );
    }

    static async findVerifiedByToken(resetTokenHash: string): Promise<any | null> {
        const res = await query(
            `SELECT * FROM password_reset_challenges
             WHERE reset_token_hash = $1
               AND status = 'VERIFIED'
               AND reset_token_expires_at > now()
             LIMIT 1`,
            [resetTokenHash]
        );
        return res.rows[0] || null;
    }

    static async consume(id: string): Promise<void> {
        await query(
            "UPDATE password_reset_challenges SET status = 'CONSUMED', consumed_at = now() WHERE id = $1",
            [id]
        );
    }

    static async incrementAttempts(id: string): Promise<number> {
        const res = await query(
            `UPDATE password_reset_challenges
             SET attempts = attempts + 1,
                 status = CASE WHEN attempts + 1 >= max_attempts THEN 'EXHAUSTED' ELSE status END
             WHERE id = $1
             RETURNING attempts, status`,
            [id]
        );
        return res.rows[0]?.attempts || 0;
    }
}
