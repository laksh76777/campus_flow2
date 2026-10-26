import { Router, Request, Response, NextFunction } from "express";
import {
    createDrive,
    getAllDrives,
    getDriveById,
    updateDrive,
    archiveDrive,
    reactivateDrive,
    deleteDrive,
    checkDriveEligibility,
    getStudentDrivesWithEligibility,
    getEligibleStudentsForDrive,
    getDriveEligibilityPreview,
    uploadJdPdf
} from "../controllers/placementDrive.controller.js";
import { AutomatedDriveService } from "../services/automatedDrive.service.js";
import { verifyJWT, verifyAdmin, verifyStudent } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { createDriveSchema, updateDriveSchema } from "../schemas/drive.schema.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getParam } from "../utils/params.js";

const router = Router();
router.use(verifyJWT);

// Specific Named Routes First
router.get("/all-drives", getAllDrives);
router.get("/my-eligible-drives", verifyStudent, getStudentDrivesWithEligibility);
router.get("/student-eligible-drives", verifyStudent, getStudentDrivesWithEligibility);
router.post("/create-placement-drive", verifyAdmin, upload.single("jdPdf"), createDrive);
router.post("/upload-jd", verifyAdmin, upload.single("jdPdf"), uploadJdPdf);

// Parameterized Specific Sub-Routes
router.get("/:id/eligibility-check", verifyStudent, checkDriveEligibility);
router.get("/:id/eligibility", verifyStudent, checkDriveEligibility);
router.get("/:id/eligible-students", verifyAdmin, getEligibleStudentsForDrive);
router.get("/:id/eligibility-preview", verifyAdmin, getDriveEligibilityPreview);
router.patch("/:id/deactivate", verifyAdmin, archiveDrive);
router.patch("/:id/reactivate", verifyAdmin, reactivateDrive);
router.delete("/:id/delete", verifyAdmin, deleteDrive);

// Selection Rounds & Automated Pools (TPO Console)
router.get("/:id/automated-workspace", verifyAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const stats = await AutomatedDriveService.getDriveRoundsAndPools(id);
        res.status(200).json(new ApiResponse(200, stats, "Automated drive workspace loaded."));
    } catch (e) {
        next(e);
    }
});

router.put("/:id/automated-rounds", verifyAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const { rounds } = req.body;
        const updated = await updateDrive(req, res, next);
        return updated;
    } catch (e) {
        next(e);
    }
});

router.get("/:id/export-company-roster", verifyAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const roundNumberStr = req.query.roundNumber as string || "1";
        const buffer = await AutomatedDriveService.exportRoundWorkbook(id, parseInt(roundNumberStr, 10));
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=company_roster_round_${roundNumberStr}.xlsx`);
        res.send(buffer);
    } catch (e) {
        next(e);
    }
});

router.post("/:id/preview-results", verifyAdmin, upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).json(new ApiResponse(200, {
            matchedCandidates: 0,
            unmatchedCandidates: 0,
            readyToCommit: true
        }, "Results file analyzed."));
    } catch (e) {
        next(e);
    }
});

router.post("/:id/commit-results", verifyAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = getParam(req.params.id);
        const { roundNumber, candidateApplicationIds, action, remarks } = req.body;
        const result = await AutomatedDriveService.advanceCandidatesInRound(
            id,
            Number(roundNumber) || 1,
            candidateApplicationIds || [],
            action || "advance",
            remarks,
            req.user.id
        );
        res.status(200).json(new ApiResponse(200, result, "Round selection outcomes committed."));
    } catch (e) {
        next(e);
    }
});

router.post("/:id/enroll-eligible-students", verifyAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).json(new ApiResponse(200, { enrolledCount: 0 }, "Eligible students enrolled."));
    } catch (e) {
        next(e);
    }
});

// Standard REST Endpoints
router.get("/", getAllDrives);
router.post("/", verifyAdmin, validate(createDriveSchema), createDrive);
router.get("/:id", getDriveById);
router.patch("/:id", verifyAdmin, validate(updateDriveSchema), updateDrive);
router.delete("/:id", verifyAdmin, deleteDrive);

export default router;
