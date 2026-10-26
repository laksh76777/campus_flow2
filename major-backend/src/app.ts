import express, { Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { checkDatabaseHealth } from "./database/db.js";
import { securityHeaders, generalApiLimiter } from "./middlewares/security.middleware.js";
import apiRouter from "./routes/index.routes.js";
import { ApiError } from "./utils/ApiError.js";

const app = express();

const configuredOrigins = (env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const deployedFrontendOrigins = [
    "https://campus-flow-smoky-ten.vercel.app"
];

const defaultAllowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173"
];

const isOriginAllowed = (origin?: string): boolean => {
    if (!origin) return true; // Allow non-browser clients (Postman, mobile, curl)
    const normalized = origin.replace(/\/+$/, "");

    if (configuredOrigins.includes(normalized) || deployedFrontendOrigins.includes(normalized)) {
        return true;
    }

    if (
        env.NODE_ENV !== "production" &&
        (defaultAllowedOrigins.includes(normalized) ||
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized))
    ) {
        return true;
    }

    return false;
};

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            return callback(null, true);
        }
        console.warn("Blocked by CORS:", origin);
        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin"
    ],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200
};

app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use("/api", generalApiLimiter);

// Health Check & Diagnostics Endpoints
app.get("/", async (req: Request, res: Response) => {
    const health = await checkDatabaseHealth();
    const isReady = health.status === "connected";
    return res
        .status(isReady ? 200 : 503)
        .send(isReady ? "CampusFlow V3 Backend is running" : "CampusFlow V3 Backend database unavailable");
});

app.get("/health", async (req: Request, res: Response) => {
    const health = await checkDatabaseHealth();
    const isReady = health.status === "connected";
    return res.status(isReady ? 200 : 503).json({
        version: "3.0.0",
        status: isReady ? "ok" : "unavailable",
        database: health.status,
        provider: "Supabase PostgreSQL",
        timestamp: new Date().toISOString()
    });
});

app.get("/ready", async (req: Request, res: Response) => {
    const health = await checkDatabaseHealth();
    const isReady = health.status === "connected";
    return res.status(isReady ? 200 : 503).json({
        version: "3.0.0",
        status: isReady ? "ready" : "unavailable",
        database: health.status
    });
});

// API Routes
app.use("/api/v1", apiRouter);

// 404 Route Handler
app.use((req: Request, res: Response, next: NextFunction) => {
    next(new ApiError(404, `Route not found: ${req.method} ${req.path}`));
});

// Centralized Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
        return next(err);
    }

    const statusCode =
        err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE"
            ? 413
            : Number.isInteger(err.statusCode) && err.statusCode >= 400
            ? err.statusCode
            : 500;

    const isServerError = statusCode >= 500;
    if (isServerError) {
        console.error("Unhandled API error:", {
            method: req.method,
            path: req.path,
            statusCode,
            errorName: err.name,
            message: err.message
        });
    }

    const userMessage = statusCode === 413
        ? "Uploaded file is too large. Please upload a smaller file."
        : (env.NODE_ENV === "production" && isServerError)
        ? "An internal server error occurred. Please try again later."
        : err.message || "An error occurred";

    return res.status(statusCode).json({
        statusCode,
        success: false,
        message: userMessage,
        errors: Array.isArray(err.errors) ? err.errors : []
    });
});

export { app };
