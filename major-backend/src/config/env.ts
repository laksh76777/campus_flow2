import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default("8000").transform((val) => parseInt(val, 10)),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SUPABASE_URL: z.string().optional().default("https://placeholder-project.supabase.co"),
    SUPABASE_ANON_KEY: z.string().optional().default(""),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
    SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(""),
    SUPABASE_DATABASE_URL: z.string().optional().default(""),
    DATABASE_URL: z.string().optional().default(""),
    DIRECT_URL: z.string().optional().default(""),
    CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:3000"),
    ACCESS_TOKEN_SECRET: z.string().default("default_access_secret_change_in_production_32char"),
    ACCESS_TOKEN_EXPIRY: z.string().default("1d"),
    REFRESH_TOKEN_SECRET: z.string().default("default_refresh_secret_change_in_production_32char"),
    REFRESH_TOKEN_EXPIRY: z.string().default("10d"),
    ADMIN_SECRET_KEY: z.string().default("TPO_ADMIN_2026"),
    CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
    CLOUDINARY_API_KEY: z.string().optional().default(""),
    CLOUDINARY_API_SECRET: z.string().optional().default(""),
    RESEND_API_KEY: z.string().optional().default(""),
    EMAIL_USER: z.string().optional().default(""),
    EMAIL_PASS: z.string().optional().default(""),
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.string().default("587").transform((val) => parseInt(val, 10)),
    SMTP_SECURE: z.string().default("tls"),
    EMAIL_FROM: z.string().default("CampusFlow Notifications <notifications@campusflow.edu>"),
    FRONTEND_URL: z.string().default("http://localhost:5173"),
    ENABLE_EMBEDDED_WORKER: z.string().optional().default("true"),
    GROQ_API_KEY: z.string().optional().default(""),
    GROQ_MODEL: z.string().default("qwen/qwen3.8-27b"),
    GEMINI_API_KEY: z.string().optional().default(""),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.format());
    throw new Error("Invalid environment configuration: Environment schema validation failed.");
}

// Fallback to generic JWT_SECRET if specific secrets were not explicitly provided
const jwtFallback = process.env.JWT_SECRET?.trim();
if (jwtFallback) {
    if (parsed.data.ACCESS_TOKEN_SECRET === "default_access_secret_change_in_production_32char") {
        parsed.data.ACCESS_TOKEN_SECRET = jwtFallback;
    }
    if (parsed.data.REFRESH_TOKEN_SECRET === "default_refresh_secret_change_in_production_32char") {
        parsed.data.REFRESH_TOKEN_SECRET = jwtFallback;
    }
}

// Production release validation guardrail
if (parsed.data.NODE_ENV === "production") {
    const missingSettings: string[] = [];
    if (!parsed.data.SUPABASE_DATABASE_URL && !parsed.data.DATABASE_URL) {
        missingSettings.push("SUPABASE_DATABASE_URL (or DATABASE_URL)");
    }
    if (
        !parsed.data.ACCESS_TOKEN_SECRET ||
        parsed.data.ACCESS_TOKEN_SECRET === "default_access_secret_change_in_production_32char"
    ) {
        missingSettings.push("ACCESS_TOKEN_SECRET (or JWT_SECRET must be set to a secure secret)");
    }
    if (
        !parsed.data.REFRESH_TOKEN_SECRET ||
        parsed.data.REFRESH_TOKEN_SECRET === "default_refresh_secret_change_in_production_32char"
    ) {
        missingSettings.push("REFRESH_TOKEN_SECRET (or JWT_SECRET must be set to a secure secret)");
    }

    if (missingSettings.length > 0) {
        const errorMsg = `[FATAL] Production release startup failed. Essential environment variables missing or insecure: ${missingSettings.join(", ")}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
}

export const env = parsed.data;
