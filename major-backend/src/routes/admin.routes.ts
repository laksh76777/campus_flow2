import { Router } from "express";
import {
    getStudentsList,
    getStudentDetails,
    verifyStudentProfile,
    reviewModificationRequest,
    getDashboardAnalytics
} from "../controllers/admin.controller.js";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { reviewModificationSchema } from "../schemas/student.schema.js";

const router = Router();
router.use(verifyJWT, verifyAdmin);

router.get("/students", getStudentsList);
router.get("/students/:id", getStudentDetails);
router.patch("/students/:id/verify", verifyStudentProfile);
router.patch("/students/:id/review-modification", validate(reviewModificationSchema), reviewModificationRequest);
router.get("/analytics", getDashboardAnalytics);

export default router;
