import { Router } from "express";
import {
    applyToDrive,
    getMyApplications,
    getApplicationsForDrive,
    getAllApplications,
    getApplicationById,
    updateApplicationStatus,
    overrideEligibility,
    respondToOffer,
    checkPreApplicationRequirements,
    withdrawApplication
} from "../controllers/application.controller.js";
import { verifyJWT, verifyStudent, verifyAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateApplicationStatusSchema, tpoOverrideSchema } from "../schemas/application.schema.js";

const router = Router();
router.use(verifyJWT);

// Named Routes & Pre-Checks
router.get("/all-applications", verifyAdmin, getAllApplications);
router.get("/my-applications", verifyStudent, getMyApplications);
router.get("/:driveId/precheck", verifyStudent, checkPreApplicationRequirements);

// Application Submission
router.post("/:driveId/apply", verifyStudent, applyToDrive);
router.post("/apply", verifyStudent, applyToDrive);

// Withdrawal
router.post("/:id/withdraw", verifyStudent, withdrawApplication);
router.patch("/:id/withdraw", verifyStudent, withdrawApplication);

// Student Offer Decision
router.patch("/:id/respond-offer", verifyStudent, respondToOffer);

// Admin Review & Pipeline Workflows
router.get("/drive/:driveId", verifyAdmin, getApplicationsForDrive);
router.get("/:id", getApplicationById);
router.patch("/:id/status", verifyAdmin, validate(updateApplicationStatusSchema), updateApplicationStatus);
router.post("/:id/override", verifyAdmin, validate(tpoOverrideSchema), overrideEligibility);
router.post("/:id/admin-override", verifyAdmin, validate(tpoOverrideSchema), overrideEligibility);

export default router;
