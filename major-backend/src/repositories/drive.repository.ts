import { query } from "../database/db.js";
import { PlacementDriveRecord, CompanyRecord } from "../database/types.js";
import { DEFAULT_SELECTION_ROUNDS, DEFAULT_STUDENT_REQUIREMENTS } from "../constants/appConstants.js";
import { ApiError } from "../utils/ApiError.js";

export class DriveRepository {
    static async findAll(filters: {
        search?: string;
        graduationYear?: number;
        isActive?: boolean;
        companyId?: string;
        sessionId?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<{ drives: any[]; total: number; page: number; totalPages: number }> {
        const page = Math.max(1, filters.page || 1);
        const limit = Math.min(100, Math.max(1, filters.limit || 20));
        const offset = (page - 1) * limit;

        const conditions: string[] = ["1=1"];
        const params: any[] = [];
        let idx = 1;

        if (filters.search) {
            conditions.push(
                `(LOWER(pd.job_title) LIKE $${idx} OR LOWER(c.company_name) LIKE $${idx})`
            );
            params.push(`%${filters.search.trim().toLowerCase()}%`);
            idx++;
        }

        if (filters.graduationYear) {
            conditions.push(`pd.graduation_year = $${idx}`);
            params.push(filters.graduationYear);
            idx++;
        }

        if (filters.isActive !== undefined) {
            conditions.push(`pd.is_active = $${idx}`);
            params.push(filters.isActive);
            idx++;
        }

        if (filters.companyId) {
            conditions.push(`pd.company_id = $${idx}`);
            params.push(filters.companyId);
            idx++;
        }

        if (filters.sessionId) {
            conditions.push(`pd.placement_session_id = $${idx}`);
            params.push(filters.sessionId);
            idx++;
        }

        const whereClause = conditions.join(" AND ");

        try {
            const countRes = await query(
                `SELECT COUNT(*) AS total
                 FROM placement_drives pd
                 JOIN companies c ON c.id = pd.company_id
                 WHERE ${whereClause}`,
                params
            );
            const total = parseInt(countRes.rows[0]?.total || "0", 10);

            const listRes = await query(
                `SELECT pd.*,
                        c.company_name, c.company_logo_url, c.company_website, c.industry,
                        ps.name AS session_name, ps.session_year
                 FROM placement_drives pd
                 JOIN companies c ON c.id = pd.company_id
                 LEFT JOIN placement_sessions ps ON ps.id = pd.placement_session_id
                 WHERE ${whereClause}
                 ORDER BY pd.created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...params, limit, offset]
            );

            return {
                drives: listRes.rows,
                total,
                page,
                totalPages: Math.max(1, Math.ceil(total / limit))
            };
        } catch {
            return {
                drives: [],
                total: 0,
                page: 1,
                totalPages: 1
            };
        }
    }

    static async findById(id: string): Promise<(PlacementDriveRecord & { company: CompanyRecord; session?: any }) | null> {
        try {
            const res = await query(
                `SELECT pd.*,
                        row_to_json(c.*) AS company,
                        row_to_json(ps.*) AS session
                 FROM placement_drives pd
                 JOIN companies c ON c.id = pd.company_id
                 LEFT JOIN placement_sessions ps ON ps.id = pd.placement_session_id
                 WHERE pd.id = $1 LIMIT 1`,
                [id]
            );
            return res.rows[0] || null;
        } catch {
            return null;
        }
    }

    static async create(data: Partial<PlacementDriveRecord>): Promise<PlacementDriveRecord> {
        if (!data.company_id) throw new ApiError(400, "Company reference is required.");
        if (!data.job_title?.trim()) throw new ApiError(400, "Job title is required.");
        if (!data.job_type) throw new ApiError(400, "Job type is required.");
        if (!data.graduation_year) throw new ApiError(400, "Graduation year cohort is required.");
        if (!data.application_start_date) throw new ApiError(400, "Application start date is required.");
        if (!data.application_deadline) throw new ApiError(400, "Application deadline is required.");
        if (!data.drive_date) throw new ApiError(400, "Drive date is required.");

        const start = new Date(data.application_start_date);
        const deadline = new Date(data.application_deadline);
        const driveDate = new Date(data.drive_date);

        if (isNaN(start.getTime()) || isNaN(deadline.getTime()) || isNaN(driveDate.getTime())) {
            throw new ApiError(400, "Invalid date format provided for drive schedule.");
        }
        if (deadline < start) {
            throw new ApiError(400, "Application deadline cannot precede application start date.");
        }
        if (driveDate < deadline) {
            throw new ApiError(400, "Drive execution date cannot precede application deadline.");
        }

        if (data.minimum_cgpa != null && (data.minimum_cgpa < 0 || data.minimum_cgpa > 10)) {
            throw new ApiError(400, "Minimum CGPA must be between 0.00 and 10.00.");
        }
        if (data.maximum_backlogs != null && data.maximum_backlogs < 0) {
            throw new ApiError(400, "Maximum backlogs cannot be negative.");
        }

        const res = await query<PlacementDriveRecord>(
            `INSERT INTO placement_drives (
                company_id, job_title, job_description, job_type, internship_type,
                stipend, internship_duration, jd_pdf_url, jd_pdf_filename, package,
                location, eligible_branches, eligible_program_codes, minimum_cgpa,
                maximum_backlogs, maximum_historical_backlogs, graduation_year,
                placement_session_id, check_cgpa, check_backlogs, check_tenth_marks,
                minimum_tenth_percentage, check_twelfth_marks, minimum_twelfth_percentage,
                check_education_gaps, allow_education_gaps, max_education_gap_years,
                custom_questions, reminder_settings, selection_rounds, current_round_number,
                student_requirements, application_start_date, application_deadline, drive_date,
                venue, application_link, is_active, created_by
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35, $36, $37, $38, $39
             )
             RETURNING *`,
            [
                data.company_id,
                data.job_title.trim(),
                data.job_description || "",
                data.job_type,
                data.internship_type || "not_applicable",
                data.stipend || "",
                data.internship_duration || "",
                data.jd_pdf_url || "",
                data.jd_pdf_filename || "",
                data.package || 0,
                data.location || "",
                data.eligible_branches || [],
                data.eligible_program_codes || [],
                data.minimum_cgpa || 0,
                data.maximum_backlogs || 0,
                data.maximum_historical_backlogs || null,
                data.graduation_year,
                data.placement_session_id || null,
                data.check_cgpa ?? true,
                data.check_backlogs ?? true,
                data.check_tenth_marks ?? false,
                data.minimum_tenth_percentage || 0,
                data.check_twelfth_marks ?? false,
                data.minimum_twelfth_percentage || 0,
                data.check_education_gaps ?? false,
                data.allow_education_gaps ?? true,
                data.max_education_gap_years || 0,
                JSON.stringify(data.custom_questions || []),
                JSON.stringify(data.reminder_settings || { remindersEnabled: true, reminderOffsetsHours: [6], channels: ["in_app", "email"] }),
                JSON.stringify(data.selection_rounds || DEFAULT_SELECTION_ROUNDS),
                data.current_round_number || 1,
                JSON.stringify(data.student_requirements || DEFAULT_STUDENT_REQUIREMENTS),
                data.application_start_date,
                data.application_deadline,
                data.drive_date,
                data.venue || "",
                data.application_link || "",
                data.is_active ?? true,
                data.created_by
            ]
        );
        return res.rows[0];
    }

    static async update(id: string, updates: Partial<PlacementDriveRecord>): Promise<PlacementDriveRecord> {
        // Enforce immutability of core targeting attributes once applications exist
        if (
            updates.graduation_year !== undefined ||
            updates.company_id !== undefined ||
            updates.placement_session_id !== undefined
        ) {
            const appCount = await query("SELECT COUNT(*) AS total FROM applications WHERE placement_drive_id = $1", [id]);
            if (parseInt(appCount.rows[0]?.total || "0", 10) > 0) {
                throw new ApiError(400, "Cannot change company, graduation cohort, or session on a drive with existing student applications.");
            }
        }

        if (updates.application_start_date && updates.application_deadline) {
            const start = new Date(updates.application_start_date);
            const deadline = new Date(updates.application_deadline);
            if (deadline < start) {
                throw new ApiError(400, "Application deadline cannot precede application start date.");
            }
        }

        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        for (const [key, val] of Object.entries(updates)) {
            const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            setClauses.push(`${snakeKey} = $${idx}`);
            values.push(
                ["custom_questions", "reminder_settings", "selection_rounds", "student_requirements"].includes(snakeKey) && typeof val === "object"
                    ? JSON.stringify(val)
                    : val === undefined
                    ? null
                    : val
            );
            idx++;
        }

        values.push(id);
        const res = await query<PlacementDriveRecord>(
            `UPDATE placement_drives SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
            values
        );
        return res.rows[0];
    }

    static async archive(id: string): Promise<PlacementDriveRecord> {
        const res = await query<PlacementDriveRecord>(
            "UPDATE placement_drives SET is_active = false WHERE id = $1 RETURNING *",
            [id]
        );
        return res.rows[0];
    }

    static async reactivate(id: string): Promise<PlacementDriveRecord> {
        const res = await query<PlacementDriveRecord>(
            "UPDATE placement_drives SET is_active = true WHERE id = $1 RETURNING *",
            [id]
        );
        return res.rows[0];
    }

    static async delete(id: string): Promise<boolean> {
        const appCount = await query("SELECT COUNT(*) AS total FROM applications WHERE placement_drive_id = $1", [id]);
        if (parseInt(appCount.rows[0]?.total || "0", 10) > 0) {
            throw new ApiError(
                400,
                "Cannot delete placement drive with existing student applications or interview history. Please cancel or archive the drive instead to preserve recruitment audit records."
            );
        }
        await query("DELETE FROM placement_drives WHERE id = $1", [id]);
        return true;
    }
}
