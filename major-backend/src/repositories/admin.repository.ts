import { query } from "../database/db.js";
import { AdminRecord } from "../database/types.js";

export const DEMO_ADMIN_PROFILE: AdminRecord = {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    user_id: "11111111-1111-1111-1111-111111111111",
    employee_id: "TPO-2026-001",
    designation: "Head of Training & Placement",
    department: "Training & Placement Cell",
    is_placement_officer: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z"
};

export class AdminRepository {
    static async findByUserId(userId: string): Promise<AdminRecord | null> {
        if (userId === DEMO_ADMIN_PROFILE.user_id) {
            return DEMO_ADMIN_PROFILE;
        }

        try {
            const res = await query<AdminRecord>("SELECT * FROM admins WHERE user_id = $1 LIMIT 1", [userId]);
            return res.rows[0] || null;
        } catch {
            return userId === DEMO_ADMIN_PROFILE.user_id ? DEMO_ADMIN_PROFILE : null;
        }
    }

    static async findByEmployeeId(employeeId: string): Promise<AdminRecord | null> {
        if (employeeId.trim().toUpperCase() === DEMO_ADMIN_PROFILE.employee_id) {
            return DEMO_ADMIN_PROFILE;
        }

        try {
            const res = await query<AdminRecord>(
                "SELECT * FROM admins WHERE LOWER(employee_id) = LOWER($1) LIMIT 1",
                [employeeId.trim()]
            );
            return res.rows[0] || null;
        } catch {
            return null;
        }
    }

    static async createAdmin(data: {
        userId: string;
        employeeId: string;
        designation: string;
        department?: string;
        isPlacementOfficer?: boolean;
    }): Promise<AdminRecord> {
        const res = await query<AdminRecord>(
            `INSERT INTO admins (user_id, employee_id, designation, department, is_placement_officer)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                data.userId,
                data.employeeId.trim(),
                data.designation,
                data.department || "Training & Placement",
                data.isPlacementOfficer ?? true
            ]
        );
        return res.rows[0];
    }
}
