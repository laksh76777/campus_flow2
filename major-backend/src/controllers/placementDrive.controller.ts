import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { DriveRepository } from "../repositories/drive.repository.js";
import { CompanyRepository } from "../repositories/company.repository.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { ReminderRepository } from "../repositories/reminder.repository.js";
import { ReminderSchedulerService } from "../services/reminderScheduler.service.js";
import { EligibilityService } from "../services/eligibility.service.js";
import { uploadToStorage } from "../services/integrations/storage/cloudinary.service.js";
import { getParam } from "../utils/params.js";

export const createDrive = asyncHandler(async (req: Request, res: Response) => {
    const { company: companyId } = req.body;

    const company = await CompanyRepository.findById(companyId);
    if (!company) {
        throw new ApiError(404, "Selected company does not exist.");
    }

    const driveData = {
        ...req.body,
        company_id: companyId,
        created_by: req.user.id
    };

    const drive = await DriveRepository.create(driveData);
    await ReminderSchedulerService.syncDriveReminders(drive.id);

    return res.status(201).json(new ApiResponse(201, drive, "Placement drive created successfully."));
});

export const getAllDrives = asyncHandler(async (req: Request, res: Response) => {
    const { search, graduationYear, isActive, companyId, sessionId, page, limit } = req.query;

    const result = await DriveRepository.findAll({
        search: search as string,
        graduationYear: graduationYear ? parseInt(graduationYear as string, 10) : undefined,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        companyId: companyId as string,
        sessionId: sessionId as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
    });

    return res.status(200).json(new ApiResponse(200, result, "Placement drives retrieved."));
});

export const getDriveById = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const drive = await DriveRepository.findById(id);
    if (!drive) {
        throw new ApiError(404, "Placement drive not found.");
    }
    return res.status(200).json(new ApiResponse(200, drive, "Placement drive details retrieved."));
});

export const updateDrive = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const drive = await DriveRepository.findById(id);
    if (!drive) {
        throw new ApiError(404, "Placement drive not found.");
    }

    const updated = await DriveRepository.update(id, req.body);
    await ReminderSchedulerService.syncDriveReminders(id);

    return res.status(200).json(new ApiResponse(200, updated, "Placement drive updated successfully."));
});

export const archiveDrive = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const archived = await DriveRepository.archive(id);
    await ReminderSchedulerService.syncDriveReminders(id);

    return res.status(200).json(new ApiResponse(200, archived, "Placement drive archived successfully."));
});

export const reactivateDrive = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const reactivated = await DriveRepository.reactivate(id);
    await ReminderSchedulerService.syncDriveReminders(id);

    return res.status(200).json(new ApiResponse(200, reactivated, "Placement drive reactivated successfully."));
});

export const deleteDrive = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    await ReminderRepository.cancelPendingForDrive(id, "Drive deleted by administrator");
    await DriveRepository.delete(id);

    return res.status(200).json(new ApiResponse(200, { deletedId: id }, "Placement drive deleted successfully."));
});

export const checkDriveEligibility = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const drive = await DriveRepository.findById(id);
    if (!drive) {
        throw new ApiError(404, "Placement drive not found.");
    }

    const student = req.student;
    const report = EligibilityService.evaluate(student, drive);

    return res.status(200).json(new ApiResponse(200, report, "Eligibility evaluation completed."));
});

export const getStudentDrivesWithEligibility = asyncHandler(async (req: Request, res: Response) => {
    const student = req.student;
    const { drives } = await DriveRepository.findAll({ isActive: true, limit: 100 });

    const enrichedDrives = drives.map((drive: any) => {
        const eligibility = EligibilityService.evaluate(student, drive);
        return {
            ...drive,
            eligibility
        };
    });

    return res.status(200).json(new ApiResponse(200, enrichedDrives, "Student drives with eligibility evaluated."));
});

export const getEligibleStudentsForDrive = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const drive = await DriveRepository.findById(id);
    if (!drive) {
        throw new ApiError(404, "Placement drive not found.");
    }

    const { students } = await StudentRepository.findAll({
        sessionYear: drive.graduation_year,
        limit: 1000
    });

    const eligible = students.filter((s: any) => {
        const report = EligibilityService.evaluate(s, drive);
        return report.isEligible;
    });

    return res.status(200).json(new ApiResponse(200, {
        driveId: drive.id,
        jobTitle: drive.job_title,
        totalEligible: eligible.length,
        students: eligible
    }, "Eligible students retrieved."));
});

export const getDriveEligibilityPreview = asyncHandler(async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const drive = await DriveRepository.findById(id);
    if (!drive) {
        throw new ApiError(404, "Placement drive not found.");
    }

    const { students } = await StudentRepository.findAll({
        sessionYear: drive.graduation_year,
        limit: 1000
    });

    let eligibleCount = 0;
    let ineligibleCount = 0;
    let missingDataCount = 0;

    for (const s of students) {
        const report = EligibilityService.evaluate(s, drive);
        if (report.status === "ELIGIBLE") eligibleCount++;
        else if (report.status === "MISSING_DATA") missingDataCount++;
        else ineligibleCount++;
    }

    return res.status(200).json(new ApiResponse(200, {
        driveId: drive.id,
        jobTitle: drive.job_title,
        totalStudentsInBatch: students.length,
        eligibleCount,
        ineligibleCount,
        missingDataCount
    }, "Drive eligibility preview generated."));
});

export const uploadJdPdf = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new ApiError(400, "JD PDF document is required.");
    }

    const result = await uploadToStorage(
        req.file.buffer,
        "jds",
        req.file.originalname,
        "raw"
    );

    return res.status(200).json(
        new ApiResponse(200, { url: result.url, fileName: req.file.originalname }, "JD uploaded successfully.")
    );
});
