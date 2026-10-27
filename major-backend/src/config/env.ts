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
    GROQ_API_KEY: z.string().optional().default(""),
    GROQ_MODEL: z.string().default("qwen/qwen3.8-27b"),
    GEMINI_API_KEY: z.string().optional().default(""),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.format());
    throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
