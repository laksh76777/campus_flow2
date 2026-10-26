import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken, verifySupabaseToken } from "../utils/tokenUtils.js";
import { UserRepository } from "../repositories/user.repository.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { AdminRepository } from "../repositories/admin.repository.js";

declare global {
    namespace Express {
        interface Request {
            user?: any;
            student?: any;
            admin?: any;
        }
    }
}

export const verifyJWT = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        throw new ApiError(401, "Authentication token required. Please sign in.");
    }

    // 1. Try local verified JWT token
    const decoded = verifyAccessToken(token);
    let userId = decoded?.id;

    // 2. Fallback to Supabase Auth token verification
    if (!userId) {
        const supabaseUser = await verifySupabaseToken(token);
        if (supabaseUser) {
            userId = supabaseUser.id;
        }
    }

    if (!userId) {
        throw new ApiError(401, "Invalid or expired session token. Please log in again.");
    }

    const user = await UserRepository.findById(userId);
    if (!user || !user.is_active) {
        throw new ApiError(401, "User account is inactive or not found.");
    }

    req.user = user;
    next();
});

export const verifyStudent = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "student") {
        throw new ApiError(403, "Access denied: Student privilege required.");
    }

    const profile = await StudentRepository.findByUserId(req.user.id);
    if (!profile) {
        throw new ApiError(404, "Student academic profile not found. Please complete registration.");
    }

    req.student = profile;
    next();
});

export const verifyAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== "admin") {
        throw new ApiError(403, "Access denied: Administrator/TPO privilege required.");
    }

    const admin = await AdminRepository.findByUserId(req.user.id);
    req.admin = admin;
    next();
});
