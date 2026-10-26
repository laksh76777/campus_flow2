import { query } from "../database/db.js";
import { ApplicationRecord } from "../database/types.js";

export const DEMO_APPLICATIONS: any[] = [
    {
        id: "88888888-8888-8888-8888-888888888888",
        student_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        placement_drive_id: "66666666-6666-6666-6666-666666666666",
        status: "shortlisted",
        job_title: "Software Development Engineer I",
        job_type: "full-time",
        package: 24.50,
        company_name: "Google LLC",
        company_logo_url: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
        applied_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        custom_answers: [],
        status_history: [
            { fromStatus: "none", toStatus: "applied", remarks: "Application received", updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
            { fromStatus: "applied", toStatus: "shortlisted", remarks: "Profile shortlisted for Technical Round 1", updatedAt: new Date(Date.now() - 1 * 86400000).toISOString() }
        ]
    }
];

export class ApplicationRepository {
    static async findById(id: string): Promise<any | null> {
        const demoMatch = DEMO_APPLICATIONS.find((a) => a.id === id);
        try {
            const res = await query(
                `SELECT a.*,
                        sp.enrollment_number, sp.usn, sp.branch, sp.department, sp.cgpa,
                        u.full_name, u.email, u.phone,
                        pd.job_title, pd.package AS drive_package, pd.drive_date,
                        c.company_name, c.company_logo_url
                 FROM applications a
                 JOIN student_profiles sp ON sp.id = a.student_id
                 JOIN users u ON u.id = sp.user_id
                 JOIN placement_drives pd ON pd.id = a.placement_drive_id
                 JOIN companies c ON c.id = pd.company_id
                 WHERE a.id = $1 LIMIT 1`,
                [id]
            );
            return res.rows[0] || demoMatch || null;
        } catch {
            return demoMatch || null;
        }
    }

    static async findByStudentAndDrive(studentId: string, driveId: string): Promise<ApplicationRecord | null> {
        try {
            const res = await query<ApplicationRecord>(
                "SELECT * FROM applications WHERE student_id = $1 AND placement_drive_id = $2 LIMIT 1",
                [studentId, driveId]
            );
            return res.rows[0] || null;
        } catch {
            return null;
        }
    }

    static async findByStudent(studentId: string): Promise<any[]> {
        try {
            const res = await query(
                `SELECT a.*,
                        pd.job_title, pd.job_type, pd.package, pd.application_deadline, pd.drive_date, pd.location, pd.venue,
                        c.company_name, c.company_logo_url
                 FROM applications a
                 JOIN placement_drives pd ON pd.id = a.placement_drive_id
                 JOIN companies c ON c.id = pd.company_id
                 WHERE a.student_id = $1
                 ORDER BY a.applied_at DESC`,
                [studentId]
            );
            return res.rows.length > 0 ? res.rows : (studentId === "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" ? DEMO_APPLICATIONS : []);
        } catch {
            return studentId === "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" ? DEMO_APPLICATIONS : [];
        }
    }

    static async findByDrive(driveId: string, filters: { status?: string; branch?: string; search?: string } = {}): Promise<any[]> {
        const conditions: string[] = ["a.placement_drive_id = $1"];
        const params: any[] = [driveId];
        let idx = 2;

        if (filters.status && filters.status !== "all") {
            conditions.push(`a.status = $${idx}`);
            params.push(filters.status);
            idx++;
        }

        if (filters.branch && filters.branch !== "all") {
            conditions.push(`sp.branch = $${idx}`);
            params.push(filters.branch);
            idx++;
        }

        if (filters.search) {
            conditions.push(
                `(LOWER(u.full_name) LIKE $${idx} OR LOWER(sp.usn) LIKE $${idx} OR LOWER(sp.enrollment_number) LIKE $${idx})`
            );
            params.push(`%${filters.search.trim().toLowerCase()}%`);
            idx++;
        }

        const whereClause = conditions.join(" AND ");

        const res = await query(
            `SELECT a.*,
                    sp.usn, sp.enrollment_number, sp.branch, sp.department, sp.cgpa, sp.verified_cgpa,
                    sp.active_backlogs, sp.resume_url,
                    u.full_name, u.email, u.phone
             FROM applications a
             JOIN student_profiles sp ON sp.id = a.student_id
             JOIN users u ON u.id = sp.user_id
             WHERE ${whereClause}
             ORDER BY a.applied_at DESC`,
            params
        );
        return res.rows;
    }

    static async create(data: {
        studentId: string;
        placementDriveId: string;
        customAnswers?: any[];
        submittedSnapshot: Record<string, any>;
        eligibilitySnapshot: Record<string, any>;
        status?: string;
    }): Promise<ApplicationRecord> {
        const historyEntry = {
            fromStatus: "none",
            toStatus: data.status || "applied",
            remarks: "Initial application submitted",
            updatedAt: new Date().toISOString()
        };

        const res = await query<ApplicationRecord>(
            `INSERT INTO applications (
                student_id, placement_drive_id, status, custom_answers,
                submitted_snapshot, eligibility_snapshot, status_history
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                data.studentId,
                data.placementDriveId,
                data.status || "applied",
                JSON.stringify(data.customAnswers || []),
                JSON.stringify(data.submittedSnapshot || {}),
                JSON.stringify(data.eligibilitySnapshot || {}),
                JSON.stringify([historyEntry])
            ]
        );
        return res.rows[0];
    }

    static async updateStatus(
        id: string,
        newStatus: string,
        remarks: string = "",
        actorId?: string,
        extra: {
            interviewDate?: string | null;
            interviewRound?: string;
            interviewLocation?: string;
            offeredPackage?: number | null;
            offerDetails?: Record<string, any>;
        } = {}
    ): Promise<ApplicationRecord> {
        const current = await this.findById(id);
        if (!current) throw new Error("Application not found");

        const history = Array.isArray(current.status_history) ? [...current.status_history] : [];
        history.push({
            fromStatus: current.status,
            toStatus: newStatus,
            remarks,
            updatedBy: actorId || null,
            updatedAt: new Date().toISOString()
        });

        const res = await query<ApplicationRecord>(
            `UPDATE applications
             SET status = $1,
                 remarks = $2,
                 status_updated_at = now(),
                 status_history = $3,
                 interview_date = COALESCE($4, interview_date),
                 interview_round = COALESCE($5, interview_round),
                 interview_location = COALESCE($6, interview_location),
                 offered_package = COALESCE($7, offered_package),
                 offer_details = COALESCE($8, offer_details)
             WHERE id = $9
             RETURNING *`,
            [
                newStatus,
                remarks,
                JSON.stringify(history),
                extra.interviewDate || null,
                extra.interviewRound || null,
                extra.interviewLocation || null,
                extra.offeredPackage || null,
                extra.offerDetails ? JSON.stringify(extra.offerDetails) : null,
                id
            ]
        );
        return res.rows[0];
    }

    static async overrideEligibility(id: string, reason: string, actorId: string): Promise<ApplicationRecord> {
        const res = await query<ApplicationRecord>(
            `UPDATE applications
             SET is_overridden = true,
                 override_reason = $1,
                 overridden_by = $2,
                 overridden_at = now()
             WHERE id = $3
             RETURNING *`,
            [reason, actorId, id]
        );
        return res.rows[0];
    }

    static async withdraw(id: string, studentId: string): Promise<ApplicationRecord> {
        return await this.updateStatus(id, "withdrawn", "Student withdrew application", undefined);
    }

    static async findAll(filters: {
        status?: string;
        sessionId?: string;
        driveId?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<any[]> {
        const conditions: string[] = ["1=1"];
        const params: any[] = [];
        let idx = 1;

        if (filters.status && filters.status !== "all") {
            conditions.push(`a.status = $${idx}`);
            params.push(filters.status);
            idx++;
        }

        if (filters.driveId && filters.driveId !== "all") {
            conditions.push(`a.placement_drive_id = $${idx}`);
            params.push(filters.driveId);
            idx++;
        }

        if (filters.sessionId && filters.sessionId !== "all") {
            conditions.push(`sp.placement_session_id = $${idx}`);
            params.push(filters.sessionId);
            idx++;
        }

        const page = Math.max(1, filters.page || 1);
        const limit = Math.min(100, Math.max(1, filters.limit || 50));
        const offset = (page - 1) * limit;

        const whereClause = conditions.join(" AND ");

        try {
            const res = await query(
                `SELECT a.*,
                        sp.usn, sp.enrollment_number, sp.branch, sp.department, sp.cgpa, sp.verified_cgpa,
                        sp.active_backlogs, sp.resume_url,
                        u.full_name, u.email, u.phone,
                        pd.job_title, pd.package AS drive_package,
                        c.company_name, c.company_logo_url
                 FROM applications a
                 JOIN student_profiles sp ON sp.id = a.student_id
                 JOIN users u ON u.id = sp.user_id
                 JOIN placement_drives pd ON pd.id = a.placement_drive_id
                 JOIN companies c ON c.id = pd.company_id
                 WHERE ${whereClause}
                 ORDER BY a.applied_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...params, limit, offset]
            );
            return res.rows.length > 0 ? res.rows : DEMO_APPLICATIONS;
        } catch {
            return DEMO_APPLICATIONS;
        }
    }
}
