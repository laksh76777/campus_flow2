import { query } from "../database/db.js";
import { PlacementSessionRecord } from "../database/types.js";

export const DEMO_SESSION: any = {
    id: "00000000-0000-0000-0000-000000002026",
    session_year: 2026,
    name: "2025-2026",
    academic_year: "2025-2026",
    description: "Placement Cohort for Graduating Class of 2026",
    is_active: true,
    is_closed: false,
    is_archived: false,
    status: "ACTIVE",
    start_date: new Date("2025-07-01T00:00:00Z"),
    end_date: new Date("2026-06-30T00:00:00Z"),
    admission_year_mapping: [
        { course: "B.E.", courseDurationYears: 4, admissionYear: 2022 },
        { course: "MBA", courseDurationYears: 2, admissionYear: 2024 },
        { course: "MCA", courseDurationYears: 2, admissionYear: 2024 },
        { course: "M.Tech", courseDurationYears: 2, admissionYear: 2024 }
    ],
    target_placement_percentage: 95.0,
    created_by: null,
    created_at: new Date("2025-01-01T00:00:00Z"),
    updated_at: new Date("2025-01-01T00:00:00Z")
};

export class SessionRepository {
    static async findAll(): Promise<PlacementSessionRecord[]> {
        try {
            const res = await query<PlacementSessionRecord>(
                "SELECT * FROM placement_sessions ORDER BY session_year DESC"
            );
            return res.rows.length > 0 ? res.rows : [DEMO_SESSION];
        } catch {
            return [DEMO_SESSION];
        }
    }

    static async findById(id: string): Promise<PlacementSessionRecord | null> {
        try {
            const res = await query<PlacementSessionRecord>(
                "SELECT * FROM placement_sessions WHERE id = $1 LIMIT 1",
                [id]
            );
            return res.rows[0] || (id === DEMO_SESSION.id ? DEMO_SESSION : null);
        } catch {
            return id === DEMO_SESSION.id ? DEMO_SESSION : null;
        }
    }

    static async findByYear(year: number): Promise<PlacementSessionRecord | null> {
        try {
            const res = await query<PlacementSessionRecord>(
                "SELECT * FROM placement_sessions WHERE session_year = $1 LIMIT 1",
                [year]
            );
            return res.rows[0] || (year === DEMO_SESSION.session_year ? DEMO_SESSION : null);
        } catch {
            return year === DEMO_SESSION.session_year ? DEMO_SESSION : null;
        }
    }

    static async findActive(): Promise<PlacementSessionRecord | null> {
        try {
            const res = await query<PlacementSessionRecord>(
                "SELECT * FROM placement_sessions WHERE is_active = true LIMIT 1"
            );
            return res.rows[0] || DEMO_SESSION;
        } catch {
            return DEMO_SESSION;
        }
    }

    static async create(data: {
        sessionYear: number;
        name: string;
        academicYear?: string;
        description?: string;
        isActive?: boolean;
        status?: "UPCOMING" | "ACTIVE" | "CLOSED" | "ARCHIVED";
        startDate?: string;
        endDate?: string | null;
        admissionYearMapping?: any[];
        targetPlacementPercentage?: number;
        createdBy?: string;
    }): Promise<PlacementSessionRecord> {
        if (data.isActive) {
            // Deactivate other sessions
            await query("UPDATE placement_sessions SET is_active = false WHERE is_active = true");
        }

        const res = await query<PlacementSessionRecord>(
            `INSERT INTO placement_sessions (
                session_year, name, academic_year, description, is_active,
                status, start_date, end_date, admission_year_mapping,
                target_placement_percentage, created_by
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                data.sessionYear,
                data.name,
                data.academicYear || "",
                data.description || "",
                data.isActive ?? false,
                data.status || "ACTIVE",
                data.startDate || new Date().toISOString(),
                data.endDate || null,
                JSON.stringify(data.admissionYearMapping || []),
                data.targetPlacementPercentage || 90,
                data.createdBy || null
            ]
        );
        return res.rows[0];
    }

    static async update(id: string, updates: Partial<PlacementSessionRecord>): Promise<PlacementSessionRecord> {
        if (updates.is_active || (updates as any).isActive) {
            await query("UPDATE placement_sessions SET is_active = false WHERE id != $1 AND is_active = true", [id]);
        }

        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        for (const [key, val] of Object.entries(updates)) {
            const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            setClauses.push(`${snakeKey} = $${idx}`);
            values.push(
                snakeKey === "admission_year_mapping" && Array.isArray(val)
                    ? JSON.stringify(val)
                    : val === undefined
                    ? null
                    : val
            );
            idx++;
        }

        values.push(id);
        const res = await query<PlacementSessionRecord>(
            `UPDATE placement_sessions SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
            values
        );
        return res.rows[0];
    }

    static async activate(id: string): Promise<PlacementSessionRecord> {
        await query("UPDATE placement_sessions SET is_active = false WHERE is_active = true");
        const res = await query<PlacementSessionRecord>(
            `UPDATE placement_sessions
             SET is_active = true, status = 'ACTIVE', is_closed = false, is_archived = false
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return res.rows[0];
    }

    static async close(id: string): Promise<PlacementSessionRecord> {
        const res = await query<PlacementSessionRecord>(
            `UPDATE placement_sessions
             SET is_active = false, status = 'CLOSED', is_closed = true
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return res.rows[0];
    }

    static async archive(id: string): Promise<PlacementSessionRecord> {
        const res = await query<PlacementSessionRecord>(
            `UPDATE placement_sessions
             SET is_active = false, status = 'ARCHIVED', is_archived = true
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return res.rows[0];
    }

    static async transferStudents(
        studentIds: string[],
        targetSessionId: string,
        updateGraduationYear: boolean = true
    ): Promise<{ transferredCount: number }> {
        const targetSession = await this.findById(targetSessionId);
        if (!targetSession) throw new Error("Target placement session not found.");

        if (updateGraduationYear) {
            await query(
                `UPDATE student_profiles
                 SET placement_session_id = $1, graduation_year = $2
                 WHERE id = ANY($3::uuid[])`,
                [targetSessionId, targetSession.session_year, studentIds]
            );
        } else {
            await query(
                `UPDATE student_profiles
                 SET placement_session_id = $1
                 WHERE id = ANY($2::uuid[])`,
                [targetSessionId, studentIds]
            );
        }

        return { transferredCount: studentIds.length };
    }

    static async previewBackfill(): Promise<{ unassignedStudents: number; breakdownByAdmissionYear: any[] }> {
        const unassignedRes = await query(
            `SELECT COUNT(*) AS total FROM student_profiles WHERE placement_session_id IS NULL`
        );
        const breakdownRes = await query(
            `SELECT admission_year, graduation_year, COUNT(*) AS count
             FROM student_profiles
             WHERE placement_session_id IS NULL
             GROUP BY admission_year, graduation_year
             ORDER BY admission_year DESC NULLS LAST`
        );

        return {
            unassignedStudents: parseInt(unassignedRes.rows[0]?.total || "0", 10),
            breakdownByAdmissionYear: breakdownRes.rows
        };
    }

    static async executeBackfill(mappings: Array<{
        admissionYear?: number;
        graduationYear?: number;
        targetSessionId: string;
    }>): Promise<{ updatedCount: number }> {
        let total = 0;
        for (const m of mappings) {
            if (m.targetSessionId) {
                const session = await this.findById(m.targetSessionId);
                const sessionYear = session ? session.session_year : m.graduationYear;

                let res;
                if (m.admissionYear) {
                    res = await query(
                        `UPDATE student_profiles
                         SET placement_session_id = $1, graduation_year = COALESCE($2, graduation_year)
                         WHERE admission_year = $3 AND placement_session_id IS NULL`,
                        [m.targetSessionId, sessionYear, m.admissionYear]
                    );
                } else if (m.graduationYear) {
                    res = await query(
                        `UPDATE student_profiles
                         SET placement_session_id = $1
                         WHERE graduation_year = $2 AND placement_session_id IS NULL`,
                        [m.targetSessionId, m.graduationYear]
                    );
                }
                if (res) total += (res as any).rowCount || 0;
            }
        }
        return { updatedCount: total };
    }
}
