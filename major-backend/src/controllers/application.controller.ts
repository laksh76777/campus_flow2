import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApplicationRepository } from "../repositories/application.repository.js";
import { DriveRepository } from "../repositories/drive.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { EligibilityService } from "../services/eligibility.service.js";
import { LEGAL_TRANSITIONS } from "../constants/appConstants.js";
import { getParam } from "../utils/params.js";

export const applyToDrive = asyncHandler(async (req: Request, res: Response) => {
    const student = req.student;
    const placementDriveId = getParam(req.params.driveId || req.params.placementDriveId || req.body.placementDriveId);

    const drive = await DriveRepository.findById(placementDriveId);
    if (!drive) {
        throw new ApiError(404, "Placement drive not found.");
    }

    if (!drive.is_active) {
        throw new ApiError(400, "This placement drive is closed or inactive.");
    }

    const now = new Date();
    const deadline = new Date(drive.application_deadline);
    if (now > deadline) {
        throw new ApiError(400, "The application deadline for this placement drive has passed.");
    }

    // Check existing application
    const existing = await ApplicationRepository.findByStudentAndDrive(student.id, drive.id);
    if (existing) {
        throw new ApiError(409, "You have already submitted an application for this placement drive.");
    }

    // Evaluate eligibility
    const eligibility = EligibilityService.evaluate(student, drive);
    if (!eligibility.isEligible) {
        throw new ApiError(
            403,
            `You are not currently eligible for this drive: ${eligibility.reasons.join(", ")}`
        );
    }

    // Freeze submitted snapshot
    const submittedSnapshot = {
        studentProfileId: student.id,
        fullName: student.full_name,
        usn: student.usn,
        enrollmentNumber: student.enrollment_number,
        email: student.email,
        personalEmail: student.personal_email,
        phone: student.phone || student.user_phone,
        branch: student.branch,
        department: student.department,
        course: student.course,
        graduationYear: student.graduation_year,
        semester: student.semester,
        cgpa: student.verified_cgpa ?? student.cgpa,
        activeBacklogs: student.active_backlogs ?? student.backlogs ?? 0,
        historicalBacklogs: student.historical_backlogs ?? 0,
        resumeUrl: student.resume_url,
        appliedAt: new Date().toISOString()
    };

    const application = await ApplicationRepository.create({
        studentId: student.id,
        placementDriveId: drive.id,
        submittedSnapshot,
        eligibilitySnapshot: (eligibility as any) || {},
        customAnswers: req.body.customAnswers || []
    });

    // Notify student
    await NotificationRepository.create({
        user_id: req.user.id,
        title: "Application Submitted Successfully",
        message: `Your application for ${drive.job_title} at ${drive.company.company_name} has been recorded.`,
        type: "application",
        company_name: drive.company.company_name,
        job_title: drive.job_title,
        application_id: application.id
    });

    return res.status(201).json(new ApiResponse(201, application, "Application submitted successfully."));
});

export const getMyApplications = asyncHandler(async (req: Request, res: Response) => {
    const student = req.student;
    const applications = await ApplicationRepository.findByStudent(student.id);
    return res.status(200).json(new ApiResponse(200, applications, "My applications retrieved."));
});

export const getApplicationsForDrive = asyncHandler(async (req: Request, res: Response) => {
    const driveId = getParam(req.params.driveId);
    const applications = await ApplicationRepository.findByDrive(driveId);
    return res.status(200).json(new ApiResponse(200, applications, "Drive applications retrieved."));
});

export const getAllApplications = asyncHandler(async (req: Request, res: Response) => {
    const { status, sessionId, driveId, page, limit } = req.query;
    const apps = await ApplicationRepository.findAll({
        status: status as string,
        sessionId: sessionId as string,
        driveId: driveId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50
    });
    return res.status(200).json(new ApiResponse(200, apps, "All applications retrieved."));
});

export const getApplicationById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const application = await ApplicationRepository.findById(id);
    if (!application) {
        throw new ApiError(404, "Application not found.");
    }
    return res.status(200).json(new ApiResponse(200, application, "Application retrieved."));
});

export const updateApplicationStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const { status, remarks, interviewDate, interviewRound, interviewLocation, offeredPackage, offerDetails } = req.body;

    const app = await ApplicationRepository.findById(id);
    if (!app) {
        throw new ApiError(404, "Application not found.");
    }

    const allowedTransitions = LEGAL_TRANSITIONS[app.status] || [];
    if (!allowedTransitions.includes(status)) {
        throw new ApiError(400, `Cannot transition application status from '${app.status}' to '${status}'.`);
    }

    const updated = await ApplicationRepository.updateStatus(
        id,
        status,
        remarks || `Status updated to ${status}`,
        req.user.id,
        { interviewDate, interviewRound, interviewLocation, offeredPackage, offerDetails }
    );

    await NotificationRepository.create({
        user_id: app.user_id,
        title: `Application Status: ${status.toUpperCase()}`,
        message: `Your application for ${app.job_title} at ${app.company_name} has moved to ${status}. ${remarks || ""}`.trim(),
        type: status === "selected" ? "selection" : status === "rejected" ? "rejection" : "status_update",
        status,
        company_name: app.company_name,
        job_title: app.job_title,
        application_id: app.id
    });

    return res.status(200).json(new ApiResponse(200, updated, "Application status updated successfully."));
});

export const overrideEligibility = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const { reason } = req.body;

    const updated = await ApplicationRepository.overrideEligibility(id, reason, req.user.id);
    return res.status(200).json(
        new ApiResponse(200, updated, "Eligibility override granted successfully.")
    );
});

export const respondToOffer = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const { decision, remarks } = req.body;
    const student = req.student;

    const app = await ApplicationRepository.findById(id);
    if (!app) {
        throw new ApiError(404, "Application not found.");
    }
    if (app.student_id !== student.id) {
        throw new ApiError(403, "You can only respond to your own offers.");
    }

    const nextStatus = decision === "accepted" ? "offer_accepted" : "rejected";
    const updated = await ApplicationRepository.updateStatus(
        id,
        nextStatus,
        remarks || `Offer ${decision} by candidate`,
        req.user.id
    );

    return res.status(200).json(new ApiResponse(200, updated, `Offer successfully ${decision}.`));
});

export const checkPreApplicationRequirements = asyncHandler(async (req: Request, res: Response) => {
    const driveId = getParam(req.params.driveId || req.params.id);
    const drive = await DriveRepository.findById(driveId);
    if (!drive) {
        throw new ApiError(404, "Placement drive not found.");
    }
    const student = req.student;
    const report = EligibilityService.evaluate(student, drive);

    return res.status(200).json(new ApiResponse(200, {
        canApply: report.isEligible,
        missingFields: report.missingFields,
        reasons: report.reasons,
        studentProfileLocked: student.is_profile_locked
    }, "Pre-check evaluated."));
});

export const withdrawApplication = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const student = req.student;

    const app = await ApplicationRepository.findById(id);
    if (!app) {
        throw new ApiError(404, "Application not found.");
    }

    if (app.student_id !== student.id) {
        throw new ApiError(403, "You can only withdraw your own applications.");
    }

    const updated = await ApplicationRepository.withdraw(id, student.id);
    return res.status(200).json(new ApiResponse(200, updated, "Application withdrawn successfully."));
});
