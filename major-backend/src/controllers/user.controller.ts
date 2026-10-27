import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    getCookieOptions
} from "../utils/tokenUtils.js";
import { UserRepository } from "../repositories/user.repository.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { AdminRepository } from "../repositories/admin.repository.js";
import { PasswordResetRepository } from "../repositories/passwordReset.repository.js";
import { sendOtpEmail } from "../services/integrations/email/mail.service.js";
import { uploadToStorage } from "../services/integrations/storage/cloudinary.service.js";
import {
    syncUserToSupabaseAuth,
    signInWithSupabase,
    updateSupabaseAuthPassword
} from "../services/integrations/auth/supabaseAuth.service.js";
import { env } from "../config/env.js";

export const registerStudent = asyncHandler(async (req: Request, res: Response) => {
    const {
        fullName,
        email,
        password,
        enrollmentNumber,
        usn,
        branch,
        department,
        course,
        programCode,
        graduationYear,
        semester,
        currentSemester,
        phone
    } = req.body;

    // Check existing email
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
        throw new ApiError(409, "An account with this email address already exists.");
    }

    // Check existing enrollment or USN
    const existingEnrollment = await StudentRepository.findByEnrollment(enrollmentNumber);
    if (existingEnrollment) {
        throw new ApiError(409, "Enrollment number is already registered.");
    }

    if (usn) {
        const existingUSN = await StudentRepository.findByUSN(usn);
        if (existingUSN) {
            throw new ApiError(409, "USN is already registered.");
        }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserRepository.createUser({
        fullName,
        email,
        passwordHash,
        role: "student",
        phone
    });

    const studentProfile = await StudentRepository.createProfile({
        userId: user.id,
        enrollmentNumber,
        usn,
        branch,
        department,
        course,
        programCode,
        graduationYear,
        semester,
        currentSemester
    });

    // Synchronize user to Supabase Auth
    await syncUserToSupabaseAuth({
        id: user.id,
        email: user.email,
        password,
        role: "student",
        fullName: user.full_name
    });

    const supabaseSession = await signInWithSupabase(user.email, password);
    const accessToken = supabaseSession?.accessToken || generateAccessToken({ id: user.id, email: user.email, role: "student" });
    const refreshToken = supabaseSession?.refreshToken || generateRefreshToken({ id: user.id });

    await UserRepository.updateRefreshToken(user.id, refreshToken);

    const cookieOptions = getCookieOptions();
    res.cookie("accessToken", accessToken, cookieOptions);
    res.cookie("refreshToken", refreshToken, cookieOptions);

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone
                },
                studentProfile,
                accessToken,
                refreshToken
            },
            "Student registered successfully."
        )
    );
});

export const registerAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { fullName, email, password, adminSecretKey, employeeId, designation, department, phone } = req.body;

    if (adminSecretKey !== env.ADMIN_SECRET_KEY) {
        throw new ApiError(403, "Invalid Administrator Passkey.");
    }

    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
        throw new ApiError(409, "An account with this email address already exists.");
    }

    const existingEmp = await AdminRepository.findByEmployeeId(employeeId);
    if (existingEmp) {
        throw new ApiError(409, "Employee ID is already registered.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserRepository.createUser({
        fullName,
        email,
        passwordHash,
        role: "admin",
        phone
    });

    const admin = await AdminRepository.createAdmin({
        userId: user.id,
        employeeId,
        designation,
        department
    });

    // Synchronize admin to Supabase Auth
    await syncUserToSupabaseAuth({
        id: user.id,
        email: user.email,
        password,
        role: "admin",
        fullName: user.full_name
    });

    const supabaseSession = await signInWithSupabase(user.email, password);
    const accessToken = supabaseSession?.accessToken || generateAccessToken({ id: user.id, email: user.email, role: "admin" });
    const refreshToken = supabaseSession?.refreshToken || generateRefreshToken({ id: user.id });

    await UserRepository.updateRefreshToken(user.id, refreshToken);

    const cookieOptions = getCookieOptions();
    res.cookie("accessToken", accessToken, cookieOptions);
    res.cookie("refreshToken", refreshToken, cookieOptions);

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone
                },
                admin,
                accessToken,
                refreshToken
            },
            "Administrator registered successfully."
        )
    );
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    const rawIdentifier = req.body.email || req.body.rollNumber || req.body.identifier;
    const { password } = req.body;

    if (!rawIdentifier) {
        throw new ApiError(400, "Email, USN, or Enrollment number is required.");
    }

    const record = await UserRepository.findByUSNorEmail(rawIdentifier);
    if (!record) {
        throw new ApiError(401, "Invalid email/USN or password.");
    }

    const user = record.user;
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid email/USN or password.");
    }

    // Authenticate and synchronize with Supabase Auth
    let supabaseSession = await signInWithSupabase(user.email, password);
    if (!supabaseSession) {
        await syncUserToSupabaseAuth({
            id: user.id,
            email: user.email,
            password,
            role: user.role,
            fullName: user.full_name
        });
        supabaseSession = await signInWithSupabase(user.email, password);
    }

    const accessToken = supabaseSession?.accessToken || generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = supabaseSession?.refreshToken || generateRefreshToken({ id: user.id });

    await UserRepository.updateRefreshToken(user.id, refreshToken);
    await UserRepository.updateLastLogin(user.id);

    const cookieOptions = getCookieOptions();
    res.cookie("accessToken", accessToken, cookieOptions);
    res.cookie("refreshToken", refreshToken, cookieOptions);

    let studentProfile = null;
    let adminProfile = null;

    if (user.role === "student") {
        studentProfile = await StudentRepository.findByUserId(user.id);
    } else if (user.role === "admin") {
        adminProfile = await AdminRepository.findByUserId(user.id);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    avatar: user.avatar_url
                },
                studentProfile,
                adminProfile,
                accessToken,
                refreshToken
            },
            "Logged in successfully."
        )
    );
});

export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
    if (req.user?.id) {
        await UserRepository.updateRefreshToken(req.user.id, null);
    }

    const cookieOptions = getCookieOptions();
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);

    return res.status(200).json(new ApiResponse(200, {}, "Logged out successfully."));
});

export const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token required.");
    }

    const decoded = verifyRefreshToken(incomingRefreshToken);
    if (!decoded) {
        throw new ApiError(401, "Invalid or expired refresh token.");
    }

    const user = await UserRepository.findById(decoded.id);
    if (!user || user.refresh_token !== incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is invalid or has been revoked.");
    }

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const newRefreshToken = generateRefreshToken({ id: user.id });

    await UserRepository.updateRefreshToken(user.id, newRefreshToken);

    const cookieOptions = getCookieOptions();
    res.cookie("accessToken", accessToken, cookieOptions);
    res.cookie("refreshToken", newRefreshToken, cookieOptions);

    return res.status(200).json(
        new ApiResponse(
            200,
            { accessToken, refreshToken: newRefreshToken },
            "Token refreshed successfully."
        )
    );
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    let studentProfile = null;
    let adminProfile = null;

    if (user.role === "student") {
        studentProfile = await StudentRepository.findByUserId(user.id);
    } else if (user.role === "admin") {
        adminProfile = await AdminRepository.findByUserId(user.id);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    avatar: user.avatar_url
                },
                studentProfile,
                adminProfile
            },
            "Current user retrieved."
        )
    );
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await UserRepository.findByEmail(email);

    if (!user) {
        // Return success to avoid email enumeration
        return res.status(200).json(
            new ApiResponse(200, {}, "If an account exists with this email, a verification code has been dispatched.")
        );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PasswordResetRepository.createChallenge({
        userId: user.id,
        email: user.email,
        otpHash,
        expiresAt
    });

    await sendOtpEmail(user.email, otp);

    return res.status(200).json(
        new ApiResponse(200, {}, "A 6-digit verification code has been sent to your email.")
    );
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const challenge = await PasswordResetRepository.findPendingByEmail(email);

    if (!challenge) {
        throw new ApiError(400, "Invalid or expired verification request. Please request a new code.");
    }

    const incomingHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (incomingHash !== challenge.otp_hash) {
        await PasswordResetRepository.incrementAttempts(challenge.id);
        throw new ApiError(400, "Incorrect OTP code. Please check your email and try again.");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordResetRepository.setVerified(challenge.id, resetTokenHash, tokenExpiresAt);

    return res.status(200).json(
        new ApiResponse(200, { resetToken }, "OTP verified successfully. You may now reset your password.")
    );
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { resetToken, newPassword } = req.body;

    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const challenge = await PasswordResetRepository.findVerifiedByToken(resetTokenHash);

    if (!challenge) {
        throw new ApiError(400, "Reset token is invalid or has expired. Please initiate password recovery again.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await UserRepository.updatePassword(challenge.user_id, passwordHash);
    await updateSupabaseAuthPassword(challenge.user_id, newPassword);
    await PasswordResetRepository.consume(challenge.id);

    return res.status(200).json(
        new ApiResponse(200, {}, "Password updated successfully. You can now log in.")
    );
});

export const updateAvatar = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new ApiError(400, "Avatar image file is required.");
    }

    const result = await uploadToStorage(
        req.file.buffer,
        "avatars",
        `user_${req.user.id}_avatar`,
        "image"
    );

    await UserRepository.updateAvatar(req.user.id, result.url, result.publicId);
    const updatedUser = await UserRepository.findById(req.user.id);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                avatarUrl: result.url,
                user: updatedUser
            },
            "Avatar updated successfully."
        )
    );
});

export const deleteAvatar = asyncHandler(async (req: Request, res: Response) => {
    await UserRepository.updateAvatar(req.user.id, "", "");
    const updatedUser = await UserRepository.findById(req.user.id);

    return res.status(200).json(
        new ApiResponse(200, { user: updatedUser }, "Avatar removed successfully.")
    );
});

