import { Router } from "express";
import {
    getMyProfile,
    updateMyProfile,
    lockMyProfile,
    unlockStudentProfile,
    requestProfileModification,
    uploadResume,
    deleteResume,
    addSemesterResult,
    addBacklogRecord,
    deleteBacklogRecord,
    verifyStudentProfile,
    validateCertificate,
    addCertificate,
    deleteCertificate,
    reviewCertificate,
    getAllStudentProfiles,
    getModificationRequests,
    reviewModificationRequest,
    safeMigrateProfiles,
    getStudentProfileById
} from "../controllers/studentProfile.controller.js";
import { verifyJWT, verifyStudent, verifyAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { updateProfileSchema, requestModificationSchema } from "../schemas/student.schema.js";

const router = Router();
router.use(verifyJWT);

// 1. Current student profile endpoints (both standard and legacy aliases)
router.get("/me", verifyStudent, getMyProfile);
router.get("/current-student-profile", verifyStudent, getMyProfile);
router.patch("/me", verifyStudent, validate(updateProfileSchema), updateMyProfile);
router.patch("/update-profile", verifyStudent, validate(updateProfileSchema), updateMyProfile);

// 2. Profile Locking and Modification Requests
router.post("/lock", verifyStudent, lockMyProfile);
router.post("/lock-profile", lockMyProfile); // Allowed for student (self) or admin (with userId)
router.post("/:studentId/unlock-profile", verifyAdmin, unlockStudentProfile);
router.post("/request-modification", verifyStudent, validate(requestModificationSchema), requestProfileModification);
router.get("/modification-requests", verifyAdmin, getModificationRequests);
router.post("/modification-requests/:requestId/review", verifyAdmin, reviewModificationRequest);

// 3. Resumes
router.post("/upload-resume", verifyStudent, upload.single("resume"), uploadResume);
router.patch("/update-resume", verifyStudent, upload.single("resume"), uploadResume);
router.delete("/delete-resume", verifyStudent, deleteResume);

// 4. Academic Semester Results & Backlogs
router.post("/semester-result", verifyStudent, addSemesterResult);
router.post("/backlog-record", addBacklogRecord);
router.delete("/backlog-record/:backlogId", deleteBacklogRecord);

// 5. Verification & Administrative Directory
router.get("/all-students", verifyAdmin, getAllStudentProfiles);
router.patch("/:studentId/verify", verifyAdmin, verifyStudentProfile);
router.post("/migrate-profiles", verifyAdmin, safeMigrateProfiles);

// 6. Certificates
router.post("/certificates/validate", upload.single("document"), validateCertificate);
router.post("/certificates", verifyStudent, addCertificate);
router.delete("/certificates/:certId", verifyStudent, deleteCertificate);
router.patch("/certificates/:studentId/:certId/review", verifyAdmin, reviewCertificate);

// 7. Profile by ID (Admin)
router.get("/:id", verifyAdmin, getStudentProfileById);

export default router;
