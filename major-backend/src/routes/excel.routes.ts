import { Router } from "express";
import {
    previewStudentExcel,
    commitStudentBatch,
    exportApplicants
} from "../controllers/excel.controller.js";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();
router.use(verifyJWT, verifyAdmin);

router.post("/preview-students", upload.single("file"), previewStudentExcel);
router.post("/commit-batch/:batchId", commitStudentBatch);
router.get("/export-applicants/:driveId", exportApplicants);

export default router;
