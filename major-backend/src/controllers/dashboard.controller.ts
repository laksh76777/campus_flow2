import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApplicationRepository } from "../repositories/application.repository.js";
import { DriveRepository } from "../repositories/drive.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { EligibilityService } from "../services/eligibility.service.js";
import { query } from "../database/db.js";

export const getStudentDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const student = req.student;

    let applications: any[] = [];
    let notifications: any[] = [];
    let enrichedDrives: any[] = [];

    try {
        applications = await ApplicationRepository.findByStudent(student.id);
    } catch {}

    try {
        notifications = await NotificationRepository.findByUser(req.user.id);
    } catch {}

    try {
        const { drives } = await DriveRepository.findAll({ isActive: true, limit: 10 });
        enrichedDrives = (drives || []).map((d: any) => ({
            ...d,
            eligibility: EligibilityService.evaluate(student, d)
        }));
    } catch {}

    const appliedCount = applications.length;
    const shortlistedCount = applications.filter((a) => a.status === "shortlisted").length;
    const interviewCount = applications.filter((a) => a.status === "interview").length;
    const offersCount = applications.filter((a) =>
        ["selected", "offer_received", "offer_accepted"].includes(a.status)
    ).length;

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                profile: student,
                stats: {
                    appliedDrives: appliedCount,
                    shortlisted: shortlistedCount,
                    interviews: interviewCount,
                    offers: offersCount,
                    profileCompleteness: student.profile_completeness || 100
                },
                recentApplications: applications.slice(0, 5),
                recentDrives: enrichedDrives.slice(0, 5),
                unreadNotifications: notifications.filter((n) => !n.is_read).length
            },
            "Student dashboard metrics retrieved."
        )
    );
});

export const getAdminDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const { sessionYear, branch } = req.query;

    const studentConditions: string[] = ["1=1"];
    const params: any[] = [];
    let pIdx = 1;

    if (sessionYear && sessionYear !== "all") {
        studentConditions.push(`sp.graduation_year = $${pIdx}`);
        params.push(parseInt(String(sessionYear), 10));
        pIdx++;
    }

    if (branch && branch !== "all") {
        studentConditions.push(`sp.branch = $${pIdx}`);
        params.push(String(branch));
        pIdx++;
    }

    const studentWhere = studentConditions.join(" AND ");

    // Authoritative totals from PostgreSQL
    const totalStudentsRes = await query(
        `SELECT COUNT(*)::int AS count FROM student_profiles sp WHERE ${studentWhere}`,
        params
    );
    const placedStudentsRes = await query(
        `SELECT COUNT(*)::int AS count FROM student_profiles sp WHERE ${studentWhere} AND sp.is_placed = true`,
        params
    );

    const driveParams: any[] = [];
    let driveWhere = "1=1";
    if (sessionYear && sessionYear !== "all") {
        driveWhere = "graduation_year = $1";
        driveParams.push(parseInt(String(sessionYear), 10));
    }

    const drivesRes = await query(
        `SELECT COUNT(*)::int AS total_count,
                COUNT(*) FILTER (WHERE is_active = true)::int AS active_count
         FROM placement_drives
         WHERE ${driveWhere}`,
        driveParams
    );

    const companiesRes = await query(
        `SELECT COUNT(*)::int AS total_count,
                COUNT(*) FILTER (WHERE is_active = true)::int AS active_count
         FROM companies`
    );

    let pendingModificationsCount = 0;
    try {
        const pendingModificationsRes = await query(`
            SELECT COUNT(*)::int AS count
            FROM student_profiles sp, jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(sp.modification_requests) = 'array' THEN sp.modification_requests 
                    ELSE '[]'::jsonb 
                END
            ) AS req
            WHERE req->>'status' = 'PENDING'
        `);
        pendingModificationsCount = pendingModificationsRes.rows[0]?.count || 0;
    } catch {
        pendingModificationsCount = 0;
    }

    // Authoritative application status breakdown
    const appStatsRes = await query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'applied')::int AS applied,
               COUNT(*) FILTER (WHERE status = 'shortlisted')::int AS shortlisted,
               COUNT(*) FILTER (WHERE status = 'interview')::int AS interview,
               COUNT(*) FILTER (WHERE status IN ('selected', 'offer_received', 'offer_accepted'))::int AS selected,
               COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
               COUNT(*) FILTER (WHERE status = 'withdrawn')::int AS withdrawn
        FROM applications
    `);
    const appRow = appStatsRes.rows[0] || {};

    const totalStudents = totalStudentsRes.rows[0]?.count || 0;
    const placedStudents = placedStudentsRes.rows[0]?.count || 0;
    const activeDrives = drivesRes.rows[0]?.active_count || 0;
    const totalDrives = drivesRes.rows[0]?.total_count || 0;
    const activeCompanies = companiesRes.rows[0]?.active_count || 0;
    const totalCompanies = companiesRes.rows[0]?.total_count || 0;

    const placementRate = totalStudents > 0
        ? ((placedStudents / totalStudents) * 100).toFixed(1)
        : "0.0";

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalStudents,
                placedStudents,
                activeDrives,
                totalDrives,
                activeCompanies,
                totalCompanies,
                pendingModifications: pendingModificationsCount,
                placementRate,
                students: { total: totalStudents, placed: placedStudents },
                companies: { total: totalCompanies, active: activeCompanies },
                placementDrives: { total: totalDrives, active: activeDrives },
                applications: {
                    total: appRow.total || 0,
                    applied: appRow.applied || 0,
                    shortlisted: appRow.shortlisted || 0,
                    interview: appRow.interview || 0,
                    selected: appRow.selected || 0,
                    rejected: appRow.rejected || 0,
                    withdrawn: appRow.withdrawn || 0
                }
            },
            "TPO Admin dashboard metrics retrieved."
        )
    );
});
