import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ExcelImportExportService } from "../services/excelImportExport.service.js";
import { CompanyApplicantExportService } from "../services/companyApplicantExport.service.js";
import { getParam } from "../utils/params.js";

export const previewStudentExcel = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new ApiError(400, "Excel spreadsheet (.xlsx) is required.");
    }

    const { placementSessionId } = req.body;
    const result = await ExcelImportExportService.previewStudentExcel(
        req.file.buffer,
        req.file.originalname,
        req.user.id,
        placementSessionId
    );

    return res.status(200).json(new ApiResponse(200, result, "Spreadsheet preview generated."));
});

export const commitStudentBatch = asyncHandler(async (req: Request, res: Response) => {
    const batchId = getParam(req.params.batchId);
    const result = await ExcelImportExportService.commitStudentBatch(batchId);
    return res.status(200).json(new ApiResponse(200, result, "Batch committed successfully."));
});

export const exportApplicants = asyncHandler(async (req: Request, res: Response) => {
    const driveId = getParam(req.params.driveId);
    const { status, branch } = req.query;

    const buffer = await CompanyApplicantExportService.exportApplicantsWorkbook(
        driveId,
        req.user.id,
        { status: status as string, branch: branch as string }
    );

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename=applicants_${driveId}_${Date.now()}.xlsx`
    );
    return res.send(buffer);
});
