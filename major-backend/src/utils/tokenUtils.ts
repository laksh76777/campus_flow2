import jwt from "jsonwebtoken";
import { CookieOptions } from "express";
import { env } from "../config/env.js";
import { getSupabaseAdmin } from "../database/supabase.js";

export const getCookieOptions = (): CookieOptions => {
    const isProduction = env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/"
    };
};

export interface TokenPayload {
    id: string;
    email: string;
    role: "student" | "admin";
}

export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        expiresIn: env.ACCESS_TOKEN_EXPIRY as any
    });
};

export const generateRefreshToken = (payload: { id: string }): string => {
    return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
        expiresIn: env.REFRESH_TOKEN_EXPIRY as any
    });
};

export const verifyAccessToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as TokenPayload;
    } catch {
        return null;
    }
};

export const verifyRefreshToken = (token: string): { id: string } | null => {
    try {
        return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as { id: string };
    } catch {
        return null;
    }
};

/**
 * Verifies identity via Supabase Auth token if provided
 */
export const verifySupabaseToken = async (token: string): Promise<{ id: string; email: string; role?: string } | null> => {
    try {
        const supabase = getSupabaseAdmin();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return null;
        return {
            id: user.id,
            email: user.email || "",
            role: user.user_metadata?.role || "student"
        };
    } catch {
        return null;
    }
};
