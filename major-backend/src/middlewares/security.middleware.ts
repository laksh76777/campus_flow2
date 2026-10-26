import { Request, Response, NextFunction } from "express";

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
};

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export const createSimpleRateLimiter = (options: { windowMs: number; max: number; message: string }) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
        const key = `${req.baseUrl || ""}_${ip}`;
        const now = Date.now();

        const bucket = rateLimitBuckets.get(key);
        if (!bucket || now > bucket.resetAt) {
            rateLimitBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
            return next();
        }

        bucket.count++;
        if (bucket.count > options.max) {
            return res.status(429).json({
                statusCode: 429,
                success: false,
                message: options.message,
                retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000)
            });
        }

        next();
    };
};

export const generalApiLimiter = createSimpleRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    message: "Too many requests. Please slow down."
});

export const authLimiter = createSimpleRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many authentication attempts. Please try again later."
});

export const supportAssistantLimiter = createSimpleRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: "Support assistant rate limit reached. Please wait a moment."
});
