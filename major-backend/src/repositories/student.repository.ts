import { query } from "../database/db.js";
import { StudentProfileRecord } from "../database/types.js";
import { ApiError } from "../utils/ApiError.js";

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

export function formatStudentResponse(row: any): any {
    if (!row) return null;
    const id = row.id;
    const fullName = row.full_name || row.fullName || "";
    const email = row.email || "";
    const phone = row.user_phone || row.phone || "";
    const avatarUrl = row.avatar_url || row.avatarUrl || null;
    const resumeUrl = row.resume_url || row.resumeUrl || "";
    const resumePublicId = row.resume_public_id || row.resumePublicId || "";

    return {
        ...row,
        id,
        _id: id,
        userId: row.user_id,
        fullName,
        email,
        phone,
        avatarUrl,
        user: {
            id: row.user_id,
            _id: row.user_id,
            fullName,
            email,
            phone,
            avatar: { url: avatarUrl },
            avatarUrl
        },
        enrollmentNumber: row.enrollment_number,
        enrollment_number: row.enrollment_number,
        usn: row.usn,
        branch: row.branch,
        department: row.department,
        course: row.course,
        programCode: row.program_code,
        program_code: row.program_code,
        graduationYear: row.graduation_year,
        graduation_year: row.graduation_year,
        currentSemester: row.current_semester ?? row.semester,
        current_semester: row.current_semester ?? row.semester,
        semester: row.semester ?? row.current_semester,
        section: row.section,
        cgpa: row.cgpa !== null && row.cgpa !== undefined ? Number(row.cgpa) : null,
        verifiedCGPA: row.verified_cgpa !== null && row.verified_cgpa !== undefined ? Number(row.verified_cgpa) : null,
        verified_cgpa: row.verified_cgpa !== null && row.verified_cgpa !== undefined ? Number(row.verified_cgpa) : null,
        backlogs: row.backlogs !== null && row.backlogs !== undefined ? Number(row.backlogs) : 0,
        activeBacklogs: row.active_backlogs !== null && row.active_backlogs !== undefined ? Number(row.active_backlogs) : 0,
        active_backlogs: row.active_backlogs !== null && row.active_backlogs !== undefined ? Number(row.active_backlogs) : 0,
        historicalBacklogs: row.historical_backlogs !== null && row.historical_backlogs !== undefined ? Number(row.historical_backlogs) : 0,
        historical_backlogs: row.historical_backlogs !== null && row.historical_backlogs !== undefined ? Number(row.historical_backlogs) : 0,
        clearedBacklogsCount: Math.max(0, (Number(row.historical_backlogs) || 0) - (Number(row.active_backlogs) || 0)),
        tenthDetails: row.tenth_details || {},
        tenth_details: row.tenth_details || {},
        tenthPercentage: row.tenth_percentage ?? row.tenth_details?.percentage,
        tenth_percentage: row.tenth_percentage ?? row.tenth_details?.percentage,
        twelfthOrDiplomaDetails: row.twelfth_or_diploma_details || {},
        twelfth_or_diploma_details: row.twelfth_or_diploma_details || {},
        twelfthPercentage: row.twelfth_percentage ?? row.twelfth_or_diploma_details?.percentage,
        twelfth_percentage: row.twelfth_percentage ?? row.twelfth_or_diploma_details?.percentage,
        hasEducationGap: row.has_education_gap ?? false,
        has_education_gap: row.has_education_gap ?? false,
        educationGaps: row.education_gaps || [],
        education_gaps: row.education_gaps || [],
        semesterResults: row.semester_results || [],
        semester_results: row.semester_results || [],
        backlogDetails: row.backlog_details || [],
        backlog_details: row.backlog_details || [],
        skills: Array.isArray(row.skills) ? row.skills : [],
        certificates: Array.isArray(row.certificates) ? row.certificates : [],
        about: row.about || "",
        resumeUrl,
        resume_url: resumeUrl,
        resumePublicId,
        resume_public_id: resumePublicId,
        resume: {
            url: resumeUrl,
            publicId: resumePublicId
        },
        verificationStatus: row.verification_status || "PENDING",
        verification_status: row.verification_status || "PENDING",
        verificationRemarks: row.verification_remarks || "",
        verification_remarks: row.verification_remarks || "",
        profileCompleteness: row.profile_completeness ?? 0,
        profile_completeness: row.profile_completeness ?? 0,
        isPlaced: Boolean(row.is_placed),
        is_placed: Boolean(row.is_placed),
        placedCompany: row.placed_company || "",
        placed_company: row.placed_company || "",
        placedPackage: row.placed_package !== null && row.placed_package !== undefined ? Number(row.placed_package) : null,
        placed_package: row.placed_package !== null && row.placed_package !== undefined ? Number(row.placed_package) : null,
        isProfileLocked: Boolean(row.is_profile_locked),
        is_profile_locked: Boolean(row.is_profile_locked),
        modificationRequests: row.modification_requests || [],
        modification_requests: row.modification_requests || [],
        currentAddress: row.current_address || {},
        current_address: row.current_address || {},
        permanentAddress: row.permanent_address || {},
        permanent_address: row.permanent_address || {},
        family: row.family || {},
        personalEmail: row.personal_email || "",
        personal_email: row.personal_email || "",
        collegeEmail: row.college_email || "",
        college_email: row.college_email || ""
    };
}

export class StudentRepository {
    static async findById(id: string): Promise<(StudentProfileRecord & { full_name?: string; email?: string; [key: string]: any }) | null> {
        if (!id || typeof id !== "string") return null;
        const clean = id.trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);

        try {
            if (isUUID) {
                const res = await query(
                    `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                     FROM student_profiles sp
                     JOIN users u ON u.id = sp.user_id
                     WHERE sp.id = $1 LIMIT 1`,
                    [clean]
                );
                return res.rows[0] ? formatStudentResponse(res.rows[0]) : null;
            } else {
                return this.findByUSN(clean);
            }
        } catch {
            return null;
        }
    }

    static async findByIdOrUsn(identifier: string): Promise<(StudentProfileRecord & { full_name?: string; email?: string; [key: string]: any }) | null> {
        if (!identifier || typeof identifier !== "string") return null;
        const clean = identifier.trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);

        try {
            let res;
            if (isUUID) {
                res = await query(
                    `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                     FROM student_profiles sp
                     JOIN users u ON u.id = sp.user_id
                     WHERE sp.id = $1 OR sp.user_id = $1
                     LIMIT 1`,
                    [clean]
                );
            } else {
                res = await query(
                    `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                     FROM student_profiles sp
                     JOIN users u ON u.id = sp.user_id
                     WHERE LOWER(TRIM(sp.usn)) = LOWER(TRIM($1))
                        OR LOWER(TRIM(sp.enrollment_number)) = LOWER(TRIM($1))
                     LIMIT 1`,
                    [clean]
                );
            }
            return res.rows[0] ? formatStudentResponse(res.rows[0]) : null;
        } catch (err) {
            console.error("Error in findByIdOrUsn:", err);
            return null;
        }
    }

    static async findByUserId(userId: string): Promise<(StudentProfileRecord & { full_name?: string; email?: string; [key: string]: any }) | null> {
        if (!userId || typeof userId !== "string") return null;
        try {
            const res = await query(
                `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                 FROM student_profiles sp
                 JOIN users u ON u.id = sp.user_id
                 WHERE sp.user_id = $1 LIMIT 1`,
                [userId.trim()]
            );
            return res.rows[0] ? formatStudentResponse(res.rows[0]) : null;
        } catch {
            return null;
        }
    }

    static async findByUSN(usn: string): Promise<any | null> {
        if (!usn || typeof usn !== "string") return null;
        try {
            const res = await query(
                `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                 FROM student_profiles sp
                 JOIN users u ON u.id = sp.user_id
                 WHERE LOWER(TRIM(sp.usn)) = LOWER(TRIM($1))
                    OR LOWER(TRIM(sp.enrollment_number)) = LOWER(TRIM($1))
                 LIMIT 1`,
                [usn.trim()]
            );
            return res.rows[0] ? formatStudentResponse(res.rows[0]) : null;
        } catch {
            return null;
        }
    }

    static async findByEnrollment(enrollmentNumber: string): Promise<any | null> {
        if (!enrollmentNumber || typeof enrollmentNumber !== "string") return null;
        try {
            const res = await query(
                `SELECT sp.*, u.full_name, u.email, u.phone AS user_phone, u.avatar_url
                 FROM student_profiles sp
                 JOIN users u ON u.id = sp.user_id
                 WHERE LOWER(TRIM(sp.enrollment_number)) = LOWER(TRIM($1))
                    OR LOWER(TRIM(sp.usn)) = LOWER(TRIM($1))
                 LIMIT 1`,
                [enrollmentNumber.trim()]
            );
            return res.rows[0] ? formatStudentResponse(res.rows[0]) : null;
        } catch {
            return null;
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
        try {
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
        } catch (err: any) {
            if (err?.code === "23505") {
                throw new ApiError(409, "A student profile with this USN or enrollment number already exists.");
            }
            throw err;
        }
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
            if (val !== null && typeof val === "object" && !(val instanceof Date)) {
                values.push(JSON.stringify(val));
            } else {
                values.push(val === undefined ? null : val);
            }
            idx++;
        }

        values.push(id);
        const sql = `UPDATE student_profiles SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`;
        try {
            const res = await query<StudentProfileRecord>(sql, values);
            return res.rows[0];
        } catch (err: any) {
            if (err?.code === "23505") {
                throw new ApiError(409, "A student profile with this USN or enrollment number already exists.");
            }
            throw err;
        }
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

    static async getAllModificationRequests(): Promise<any[]> {
        try {
            const res = await query(`
                SELECT 
                    sp.id AS student_profile_id,
                    sp.user_id,
                    sp.usn,
                    sp.enrollment_number,
                    sp.branch,
                    sp.department,
                    u.full_name,
                    u.email,
                    u.phone,
                    req.*
                FROM student_profiles sp
                JOIN users u ON u.id = sp.user_id,
                jsonb_to_recordset(
                    CASE 
                        WHEN jsonb_typeof(sp.modification_requests) = 'array' THEN sp.modification_requests 
                        ELSE '[]'::jsonb 
                    END
                ) AS req(
                    id text,
                    "requestedAt" text,
                    status text,
                    reason text,
                    "fieldsToModify" text[],
                    "reviewedAt" text,
                    "reviewedByName" text,
                    "rejectionReason" text
                )
                ORDER BY req."requestedAt" DESC
            `);

            return res.rows.map((row: any) => ({
                id: row.id,
                _id: row.id,
                studentProfileId: row.student_profile_id,
                userId: row.user_id,
                usn: row.usn,
                enrollmentNumber: row.enrollment_number,
                fullName: row.full_name,
                email: row.email,
                phone: row.phone,
                branch: row.branch,
                department: row.department,
                requestedAt: row.requestedAt,
                status: row.status,
                reason: row.reason,
                fieldsToModify: row.fieldsToModify || [],
                reviewedAt: row.reviewedAt,
                reviewedByName: row.reviewedByName,
                rejectionReason: row.rejectionReason
            }));
        } catch (err) {
            console.error("Error retrieving modification requests:", err);
            return [];
        }
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
                students: listRes.rows.map(formatStudentResponse),
                total,
                page,
                totalPages: Math.max(1, Math.ceil(total / limit))
            };
        } catch (err) {
            console.error("Error in StudentRepository.findAll:", err);
            return {
                students: [],
                total: 0,
                page: 1,
                totalPages: 1
            };
        }
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
