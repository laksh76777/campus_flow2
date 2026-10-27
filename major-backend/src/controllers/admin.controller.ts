import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { getParam } from "../utils/params.js";
import { query } from "../database/db.js";

export const getStudentsList = asyncHandler(async (req: Request, res: Response) => {
    const { search, branch, sessionYear, verificationStatus, page, limit } = req.query;

    const result = await StudentRepository.findAll({
        search: search as string,
        branch: branch as string,
        sessionYear: sessionYear ? parseInt(sessionYear as string, 10) : undefined,
        verificationStatus: verificationStatus as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
    });

    return res.status(200).json(new ApiResponse(200, result, "Students retrieved."));
});

export const getStudentDetails = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const student = await StudentRepository.findByIdOrUsn(id);
    if (!student) {
        throw new ApiError(404, "Student profile not found.");
    }
    return res.status(200).json(new ApiResponse(200, student, "Student details retrieved."));
});

export const verifyStudentProfile = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const { status, remarks, verifiedCGPA } = req.body;

    const profile = await StudentRepository.findByIdOrUsn(id);
    if (!profile) {
        throw new ApiError(404, "Student profile not found.");
    }

    const updates: any = {
        verification_status: status || "VERIFIED",
        verified_by: req.user.id,
        verified_at: new Date().toISOString(),
        verification_remarks: remarks || ""
    };

    if (verifiedCGPA !== undefined) {
        updates.verified_cgpa = verifiedCGPA;
    }

    const updated = await StudentRepository.updateProfile(profile.id, updates);
    return res.status(200).json(
        new ApiResponse(200, updated, "Student verification status updated successfully.")
    );
});

export const reviewModificationRequest = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const { requestId, action, rejectionReason } = req.body;

    const updated = await StudentRepository.reviewModificationRequest(
        id,
        requestId,
        action,
        req.user.full_name || "TPO Officer",
        rejectionReason
    );

    return res.status(200).json(
        new ApiResponse(200, updated, `Modification request ${action}ed successfully.`)
    );
});

export const getDashboardAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { sessionYear, branch } = req.query;

    const conditions: string[] = ["1=1"];
    const params: any[] = [];
    let idx = 1;

    if (sessionYear && sessionYear !== "all") {
        conditions.push(`graduation_year = $${idx}`);
        params.push(parseInt(String(sessionYear), 10));
        idx++;
    }

    if (branch && branch !== "all") {
        conditions.push(`branch = $${idx}`);
        params.push(String(branch));
        idx++;
    }

    const whereClause = conditions.join(" AND ");

    const totalStudentsRes = await query(`SELECT COUNT(*) AS count FROM student_profiles WHERE ${whereClause}`, params);
    const totalPlacedRes = await query(`SELECT COUNT(*) AS count FROM student_profiles WHERE is_placed = true AND ${whereClause}`, params);
    const totalDrivesRes = await query("SELECT COUNT(*) AS count FROM placement_drives WHERE is_active = true");
    const totalCompaniesRes = await query("SELECT COUNT(*) AS count FROM companies WHERE is_active = true");

    const branchAnalyticsRes = await query(`
        SELECT branch,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE is_placed = true) AS placed,
               ROUND(AVG(cgpa)::numeric, 2) AS avg_cgpa
        FROM student_profiles
        WHERE ${whereClause}
        GROUP BY branch
        ORDER BY total DESC
    `, params);

    const salaryRangesRes = await query(`
        SELECT
            COUNT(*) FILTER (WHERE package < 5) AS under_5_lpa,
            COUNT(*) FILTER (WHERE package >= 5 AND package < 10) AS range_5_10_lpa,
            COUNT(*) FILTER (WHERE package >= 10 AND package < 20) AS range_10_20_lpa,
            COUNT(*) FILTER (WHERE package >= 20) AS above_20_lpa
        FROM placement_drives
        WHERE is_active = true
    `);

    const totalStudents = parseInt(totalStudentsRes.rows[0]?.count || "0", 10);
    const totalPlaced = parseInt(totalPlacedRes.rows[0]?.count || "0", 10);
    const placementRate = totalStudents > 0 ? ((totalPlaced / totalStudents) * 100).toFixed(1) : "0.0";

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalStudents,
                totalPlaced,
                activeDrives: parseInt(totalDrivesRes.rows[0]?.count || "0", 10),
                totalCompanies: parseInt(totalCompaniesRes.rows[0]?.count || "0", 10),
                placementRate,
                branchAnalytics: branchAnalyticsRes.rows,
                salaryDistribution: salaryRangesRes.rows[0] || {
                    under_5_lpa: 0,
                    range_5_10_lpa: 0,
                    range_10_20_lpa: 0,
                    above_20_lpa: 0
                }
            },
            "Analytics metrics retrieved."
        )
    );
});
