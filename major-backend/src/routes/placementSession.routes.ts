import { Router } from "express";
import {
    createSession,
    getAllSessions,
    getActiveSession,
    getSessionById,
    updateSession,
    activateSession,
    closeSession,
    archiveSession,
    previewSessionBackfill,
    executeSessionBackfill,
    transferStudents
} from "../controllers/placementSession.controller.js";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createSessionSchema, updateSessionSchema } from "../schemas/session.schema.js";

const router = Router();
router.use(verifyJWT);

// Read sessions
router.get("/", getAllSessions);
router.get("/active", getActiveSession);
router.get("/backfill/preview", verifyAdmin, previewSessionBackfill);
router.get("/:id", getSessionById);

// Admin lifecycle actions
router.post("/", verifyAdmin, validate(createSessionSchema), createSession);
router.patch("/:id", verifyAdmin, validate(updateSessionSchema), updateSession);
router.patch("/:id/activate", verifyAdmin, activateSession);
router.patch("/:id/close", verifyAdmin, closeSession);
router.patch("/:id/archive", verifyAdmin, archiveSession);

// Cohort backfill & transfers
router.post("/backfill/execute", verifyAdmin, executeSessionBackfill);
router.post("/transfer-students", verifyAdmin, transferStudents);

export default router;
