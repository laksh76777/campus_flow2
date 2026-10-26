import { Router } from "express";
import {
    registerStudent,
    registerAdmin,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    forgotPassword,
    verifyOtp,
    resetPassword,
    updateAvatar,
    deleteAvatar
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { authLimiter } from "../middlewares/security.middleware.js";
import {
    studentRegisterSchema,
    adminRegisterSchema,
    loginSchema,
    forgotPasswordSchema,
    verifyOtpSchema,
    resetPasswordSchema
} from "../schemas/auth.schema.js";

const router = Router();

// Authentication & Registration
router.post("/register/student", authLimiter, validate(studentRegisterSchema), registerStudent);
router.post("/register/admin", authLimiter, validate(adminRegisterSchema), registerAdmin);
router.post("/login", authLimiter, validate(loginSchema), loginUser);
router.post("/logout", verifyJWT, logoutUser);
router.post("/refresh-token", refreshAccessToken);
router.get("/current-user", verifyJWT, getCurrentUser);

// User Profile Avatar
router.patch("/update-avatar", verifyJWT, upload.single("avatar"), updateAvatar);
router.delete("/delete-avatar", verifyJWT, deleteAvatar);

// Password Reset Flow
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/verify-otp", authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
