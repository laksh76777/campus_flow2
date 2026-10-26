import { query } from "../database/db.js";
import { StudentProfileRecord } from "../database/types.js";

export const DEMO_STUDENT_PROFILE: any = {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    user_id: "22222222-2222-2222-2222-222222222222",
    full_name: "Alex Sharma",
    email: "student@campusflow.edu",
    user_phone: "+91 9123456789",
    enrollment_number: "EN2022CSE042",
    usn: "1RV22CS042",
    course: "B.E.",
    program_code: "CSE",
    degree_type: "B.E.",
    branch: "Computer Science & Engineering (CSE)",
    department: "Computer Science & Engineering (CSE)",
    admission_year: 2022,
    graduation_year: 2026,
    semester: 7,
    current_semester: 7,
    section: "A",
    cgpa: 8.75,
    verified_cgpa: 8.75,
    backlogs: 0,
    active_backlogs: 0,
    historical_backlogs: 0,
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker", "Python", "Algorithms"],
    resume_url: "https://example.com/demo_resume.pdf",
    verification_status: "VERIFIED",
    profile_completeness: 100,
    is_profile_locked: false,
    semester_results: [
        { semesterNumber: 1, sgpa: 8.4, creditsEarned: 20, passed: true },
        { semesterNumber: 2, sgpa: 8.6, creditsEarned: 20, passed: true },
        { semesterNumber: 3, sgpa: 8.8, creditsEarned: 22, passed: true },
        { semesterNumber: 4, sgpa: 8.7, creditsEarned: 22, passed: true },
        { semesterNumber: 5, sgpa: 8.9, creditsEarned: 24, passed: true },
        { semesterNumber: 6, sgpa: 9.0, creditsEarned: 24, passed: true }
    ],
    modification_requests: [],
    certificates: [],
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z")
};

export class StudentRepository {
    static async findById(id: string): Promise<(StudentProfileRecord & { full_name?: string; email?: string }) | null> {
        if (id === DEMO_STUDENT_PROFILE.id) return DEMO_STUDENT_PROFILE;
        try {
            const res = await query(
                `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                 FROM student_profiles sp
                 JOIN users u ON u.id = sp.user_id
                 WHERE sp.id = $1 LIMIT 1`,
                [id]
            );
            return res.rows[0] || (id === DEMO_STUDENT_PROFILE.id ? DEMO_STUDENT_PROFILE : null);
        } catch {
            return id === DEMO_STUDENT_PROFILE.id ? DEMO_STUDENT_PROFILE : null;
        }
    }

    static async findByUserId(userId: string): Promise<(StudentProfileRecord & { full_name?: string; email?: string }) | null> {
        if (userId === DEMO_STUDENT_PROFILE.user_id) return DEMO_STUDENT_PROFILE;
        try {
            const res = await query(
                `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                 FROM student_profiles sp
                 JOIN users u ON u.id = sp.user_id
                 WHERE sp.user_id = $1 LIMIT 1`,
                [userId]
            );
            return res.rows[0] || (userId === DEMO_STUDENT_PROFILE.user_id ? DEMO_STUDENT_PROFILE : null);
        } catch {
            return userId === DEMO_STUDENT_PROFILE.user_id ? DEMO_STUDENT_PROFILE : null;
        }
    }

    static async findByUSN(usn: string): Promise<StudentProfileRecord | null> {
        if (usn.trim().toUpperCase() === DEMO_STUDENT_PROFILE.usn) return DEMO_STUDENT_PROFILE;
        try {
            const res = await query<StudentProfileRecord>(
                "SELECT * FROM student_profiles WHERE LOWER(usn) = LOWER($1) LIMIT 1",
                [usn.trim()]
            );
            return res.rows[0] || (usn.trim().toUpperCase() === DEMO_STUDENT_PROFILE.usn ? DEMO_STUDENT_PROFILE : null);
        } catch {
            return usn.trim().toUpperCase() === DEMO_STUDENT_PROFILE.usn ? DEMO_STUDENT_PROFILE : null;
        }
    }

    static async findByEnrollment(enrollmentNumber: string): Promise<StudentProfileRecord | null> {
        if (enrollmentNumber.trim().toUpperCase() === DEMO_STUDENT_PROFILE.enrollment_number) return DEMO_STUDENT_PROFILE;
        try {
            const res = await query<StudentProfileRecord>(
                "SELECT * FROM student_profiles WHERE LOWER(enrollment_number) = LOWER($1) LIMIT 1",
                [enrollmentNumber.trim()]
            );
            return res.rows[0] || (enrollmentNumber.trim().toUpperCase() === DEMO_STUDENT_PROFILE.enrollment_number ? DEMO_STUDENT_PROFILE : null);
        } catch {
            return enrollmentNumber.trim().toUpperCase() === DEMO_STUDENT_PROFILE.enrollment_number ? DEMO_STUDENT_PROFILE : null;
        }
    }

    static async createProfile(data: {
        userId: string;
        enrollmentNumber: string;
        usn?: string;
        branch: string;
        department?: string;
        course?: string;
        programCode?: string;
        graduationYear: number;
        semester: number;
        currentSemester?: number;
        placementSessionId?: string;
    }): Promise<StudentProfileRecord> {
        const res = await query<StudentProfileRecord>(
            `INSERT INTO student_profiles (
                user_id, enrollment_number, usn, branch, department,
                course, program_code, graduation_year, semester, current_semester, placement_session_id
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                data.userId,
                data.enrollmentNumber.trim(),
                data.usn ? data.usn.trim().toUpperCase() : null,
                data.branch,
                data.department || data.branch,
                data.course || "B.E.",
                data.programCode || null,
                data.graduationYear,
                data.semester,
                data.currentSemester || data.semester,
                data.placementSessionId || null
            ]
        );
        return res.rows[0];
    }

    static async updateProfile(id: string, updates: Partial<StudentProfileRecord>): Promise<StudentProfileRecord> {
        const keys = Object.keys(updates);
        if (keys.length === 0) {
            const current = await this.findById(id);
            return current!;
        }

        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        for (const [key, val] of Object.entries(updates)) {
            // Convert camelCase to snake_case for DB columns if necessary
            const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            setClauses.push(`${snakeKey} = $${idx}`);
            values.push(val === undefined ? null : val);
            idx++;
        }

        values.push(id);
        const sql = `UPDATE student_profiles SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`;
        const res = await query<StudentProfileRecord>(sql, values);
        return res.rows[0];
    }

    static async setProfileLock(id: string, locked: boolean): Promise<StudentProfileRecord> {
        const res = await query<StudentProfileRecord>(
            `UPDATE student_profiles
             SET is_profile_locked = $1, profile_locked_at = ${locked ? "now()" : "null"}
             WHERE id = $2
             RETURNING *`,
            [locked, id]
        );
        return res.rows[0];
    }

    static async addModificationRequest(id: string, request: { reason: string; fieldsToModify: string[] }): Promise<void> {
        const entry = {
            id: `req_${Date.now()}`,
            requestedAt: new Date().toISOString(),
            status: "PENDING",
            reason: request.reason,
            fieldsToModify: request.fieldsToModify
        };
        await query(
            `UPDATE student_profiles
             SET modification_requests = modification_requests || $1::jsonb
             WHERE id = $2`,
            [JSON.stringify([entry]), id]
        );
    }

    static async reviewModificationRequest(
        id: string,
        requestId: string,
        action: "approve" | "reject",
        adminName: string,
        rejectionReason: string = ""
    ): Promise<StudentProfileRecord> {
        const profile = await this.findById(id);
        if (!profile) throw new Error("Student profile not found");

        const requests = Array.isArray(profile.modification_requests) ? [...profile.modification_requests] : [];
        const reqIndex = requests.findIndex((r: any) => r.id === requestId || r._id === requestId);
        if (reqIndex !== -1) {
            requests[reqIndex] = {
                ...requests[reqIndex],
                status: action === "approve" ? "APPROVED" : "REJECTED",
                reviewedAt: new Date().toISOString(),
                reviewedByName: adminName,
                rejectionReason: action === "reject" ? rejectionReason : ""
            };
        }

        const isLocked = action === "approve" ? false : profile.is_profile_locked;

        return await this.updateProfile(id, {
            modification_requests: requests,
            is_profile_locked: isLocked
        });
    }

    static async findAll(filters: {
        search?: string;
        branch?: string;
        sessionYear?: number;
        verificationStatus?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<{ students: any[]; total: number; page: number; totalPages: number }> {
        const page = Math.max(1, filters.page || 1);
        const limit = Math.min(100, Math.max(1, filters.limit || 20));
        const offset = (page - 1) * limit;

        const conditions: string[] = ["1=1"];
        const params: any[] = [];
        let idx = 1;

        if (filters.search) {
            conditions.push(
                `(LOWER(u.full_name) LIKE $${idx} OR LOWER(sp.enrollment_number) LIKE $${idx} OR LOWER(sp.usn) LIKE $${idx} OR LOWER(u.email) LIKE $${idx})`
            );
            params.push(`%${filters.search.trim().toLowerCase()}%`);
            idx++;
        }

        if (filters.branch && filters.branch !== "all") {
            conditions.push(`sp.branch = $${idx}`);
            params.push(filters.branch);
            idx++;
        }

        if (filters.sessionYear) {
            conditions.push(`sp.graduation_year = $${idx}`);
            params.push(filters.sessionYear);
            idx++;
        }

        if (filters.verificationStatus && filters.verificationStatus !== "all") {
            conditions.push(`sp.verification_status = $${idx}`);
            params.push(filters.verificationStatus);
            idx++;
        }

        const whereClause = conditions.join(" AND ");

        try {
            const countRes = await query(
                `SELECT COUNT(*) AS total
                 FROM student_profiles sp
                 JOIN users u ON u.id = sp.user_id
                 WHERE ${whereClause}`,
                params
            );
            const total = parseInt(countRes.rows[0]?.total || "0", 10);

            const listRes = await query(
                `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                 FROM student_profiles sp
                 JOIN users u ON u.id = sp.user_id
                 WHERE ${whereClause}
                 ORDER BY sp.created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...params, limit, offset]
            );

            return {
                students: listRes.rows.length > 0 ? listRes.rows : [DEMO_STUDENT_PROFILE],
                total: total > 0 ? total : 1,
                page,
                totalPages: Math.max(1, Math.ceil((total || 1) / limit))
            };
        } catch {
            return {
                students: [DEMO_STUDENT_PROFILE],
                total: 1,
                page: 1,
                totalPages: 1
            };
        }
    }

    static async getAllModificationRequests(): Promise<any[]> {
        const res = await query(
            `SELECT sp.id AS student_id, sp.usn, sp.enrollment_number, sp.branch,
                    u.full_name, u.email, sp.modification_requests
             FROM student_profiles sp
             JOIN users u ON u.id = sp.user_id
             WHERE sp.modification_requests IS NOT NULL 
               AND jsonb_array_length(sp.modification_requests) > 0
             ORDER BY sp.updated_at DESC`
        );

        const flattened: any[] = [];
        for (const row of res.rows) {
            const reqs = Array.isArray(row.modification_requests) ? row.modification_requests : [];
            for (const r of reqs) {
                flattened.push({
                    id: r.id || r._id,
                    studentProfileId: row.student_id,
                    studentId: row.student_id,
                    studentName: row.full_name,
                    usn: row.usn || row.enrollment_number,
                    branch: row.branch,
                    email: row.email,
                    reason: r.reason,
                    fieldsToModify: r.fieldsToModify || [],
                    requestedAt: r.requestedAt,
                    status: r.status || "PENDING",
                    reviewedAt: r.reviewedAt,
                    reviewedByName: r.reviewedByName,
                    rejectionReason: r.rejectionReason
                });
            }
        }
        return flattened;
    }

    static async addSemesterResult(id: string, semesterData: any): Promise<StudentProfileRecord> {
        const profile = await this.findById(id);
        if (!profile) throw new Error("Student profile not found");

        const semNumber = Number(semesterData.semesterNumber || semesterData.semester || 1);
        const existingResults = Array.isArray(profile.semester_results) ? [...profile.semester_results] : [];
        const index = existingResults.findIndex((r: any) => Number(r.semesterNumber || r.semester) === semNumber);

        const entry = {
            id: `sem_${semNumber}_${Date.now()}`,
            semesterNumber: semNumber,
            sgpa: parseFloat(semesterData.sgpa || "0"),
            creditsEarned: parseFloat(semesterData.creditsEarned || "0"),
            totalCredits: parseFloat(semesterData.totalCredits || "0"),
            passed: semesterData.passed !== false,
            marksheetUrl: semesterData.marksheetUrl || "",
            recordedAt: new Date().toISOString()
        };

        if (index >= 0) {
            existingResults[index] = { ...existingResults[index], ...entry };
        } else {
            existingResults.push(entry);
        }

        // Recalculate CGPA as simple average of SGPAs or credit-weighted
        let totalWeighted = 0;
        let totalCredits = 0;
        for (const res of existingResults) {
            const sgpa = Number(res.sgpa) || 0;
            const credits = Number(res.creditsEarned || res.totalCredits) || 20;
            totalWeighted += sgpa * credits;
            totalCredits += credits;
        }
        const newCgpa = totalCredits > 0 ? parseFloat((totalWeighted / totalCredits).toFixed(2)) : profile.cgpa;

        return await this.updateProfile(id, {
            semester_results: existingResults,
            cgpa: newCgpa
        });
    }

    static async addBacklogRecord(id: string, backlogData: any): Promise<StudentProfileRecord> {
        const profile = await this.findById(id);
        if (!profile) throw new Error("Student profile not found");

        const backlogs = Array.isArray(profile.backlog_details) ? [...profile.backlog_details] : [];
        const entry = {
            id: `bl_${Date.now()}`,
            subjectCode: backlogData.subjectCode || "",
            subjectName: backlogData.subjectName || "",
            semester: Number(backlogData.semester || 1),
            status: backlogData.status || "ACTIVE", // ACTIVE or CLEARED
            attempts: Number(backlogData.attempts || 1),
            clearedDate: backlogData.clearedDate || null,
            createdAt: new Date().toISOString()
        };
        backlogs.push(entry);

        const activeCount = backlogs.filter((b: any) => b.status === "ACTIVE").length;
        const historicalCount = backlogs.length;

        return await this.updateProfile(id, {
            backlog_details: backlogs,
            active_backlogs: activeCount,
            historical_backlogs: historicalCount,
            backlogs: activeCount
        });
    }

    static async deleteBacklogRecord(id: string, backlogId: string): Promise<StudentProfileRecord> {
        const profile = await this.findById(id);
        if (!profile) throw new Error("Student profile not found");

        const backlogs = Array.isArray(profile.backlog_details)
            ? profile.backlog_details.filter((b: any) => b.id !== backlogId && b._id !== backlogId)
            : [];

        const activeCount = backlogs.filter((b: any) => b.status === "ACTIVE").length;

        return await this.updateProfile(id, {
            backlog_details: backlogs,
            active_backlogs: activeCount,
            backlogs: activeCount
        });
    }

    static async verifyProfile(
        id: string,
        status: "VERIFIED" | "REJECTED" | "REVERIFICATION_REQUESTED",
        remarks: string,
        adminId: string
    ): Promise<StudentProfileRecord> {
        return await this.updateProfile(id, {
            verification_status: status,
            verification_remarks: remarks,
            verified_by: adminId,
            verified_at: new Date() as any
        });
    }

    static async addCertificate(id: string, certData: any): Promise<StudentProfileRecord> {
        const profile = await this.findById(id);
        if (!profile) throw new Error("Student profile not found");

        const certs = Array.isArray(profile.certificates) ? [...profile.certificates] : [];
        const entry = {
            id: `cert_${Date.now()}`,
            title: certData.title || certData.name || "Certificate",
            issuer: certData.issuer || certData.issuingOrganization || "",
            issueDate: certData.issueDate || new Date().toISOString(),
            certificateUrl: certData.certificateUrl || certData.url || "",
            verificationStatus: certData.verificationStatus || "PENDING",
            verificationScore: certData.verificationScore || 100,
            aiVerified: certData.aiVerified || false,
            createdAt: new Date().toISOString()
        };
        certs.push(entry);

        return await this.updateProfile(id, { certificates: certs });
    }

    static async deleteCertificate(id: string, certId: string): Promise<StudentProfileRecord> {
        const profile = await this.findById(id);
        if (!profile) throw new Error("Student profile not found");

        const certs = Array.isArray(profile.certificates)
            ? profile.certificates.filter((c: any) => c.id !== certId && c._id !== certId)
            : [];

        return await this.updateProfile(id, { certificates: certs });
    }

    static async reviewCertificate(
        id: string,
        certId: string,
        reviewData: { status: "APPROVED" | "REJECTED"; remarks?: string }
    ): Promise<StudentProfileRecord> {
        const profile = await this.findById(id);
        if (!profile) throw new Error("Student profile not found");

        const certs = Array.isArray(profile.certificates) ? [...profile.certificates] : [];
        const index = certs.findIndex((c: any) => c.id === certId || c._id === certId);
        if (index !== -1) {
            certs[index] = {
                ...certs[index],
                verificationStatus: reviewData.status,
                adminRemarks: reviewData.remarks || "",
                reviewedAt: new Date().toISOString()
            };
        }

        return await this.updateProfile(id, { certificates: certs });
    }
}
