import { Router } from "express";
import {
    getStudentDashboardStats,
    getAdminDashboardStats
} from "../controllers/dashboard.controller.js";
import { verifyJWT, verifyStudent, verifyAdmin } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT);

// Student dashboard statistics
router.get("/student/stats", verifyStudent, getStudentDashboardStats);
router.get("/student", verifyStudent, getStudentDashboardStats);

// TPO Admin dashboard statistics
router.get("/stats", verifyAdmin, getAdminDashboardStats);
router.get("/admin", verifyAdmin, getAdminDashboardStats);

export default router;
