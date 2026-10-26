import { z } from "zod";

export const createDriveSchema = z.object({
    company: z.string().min(1, "Company ID is required"),
    jobTitle: z.string().min(1, "Job title is required").max(150),
    jobDescription: z.string().optional().default(""),
    jobType: z.enum(["full-time", "internship", "internship-to-full-time"]),
    internshipType: z.enum(["paid", "unpaid", "not_applicable"]).optional().default("not_applicable"),
    stipend: z.string().optional().default(""),
    internshipDuration: z.string().optional().default(""),
    package: z.coerce.number().min(0, "Package must be non-negative"),
    location: z.string().optional().default(""),
    eligibleBranches: z.array(z.string()).min(1, "At least one eligible branch is required"),
    eligibleProgramCodes: z.array(z.string()).optional(),
    minimumCGPA: z.coerce.number().min(0).max(10).default(0),
    maximumBacklogs: z.coerce.number().int().min(0).default(0),
    maximumHistoricalBacklogs: z.coerce.number().int().min(0).optional().nullable(),
    graduationYear: z.coerce.number().int().min(2020).max(2035),
    placementSession: z.string().optional().nullable(),
    checkCgpa: z.boolean().optional().default(true),
    checkBacklogs: z.boolean().optional().default(true),
    checkTenthMarks: z.boolean().optional().default(false),
    minimumTenthPercentage: z.coerce.number().min(0).max(100).optional().default(0),
    checkTwelfthMarks: z.boolean().optional().default(false),
    minimumTwelfthPercentage: z.coerce.number().min(0).max(100).optional().default(0),
    checkEducationGaps: z.boolean().optional().default(false),
    allowEducationGaps: z.boolean().optional().default(true),
    maxEducationGapYears: z.coerce.number().int().min(0).optional().default(0),
    customQuestions: z.array(z.any()).optional().default([]),
    reminderSettings: z.object({
        remindersEnabled: z.boolean().default(true),
        reminderOffsetsHours: z.array(z.number()).default([6]),
        channels: z.array(z.enum(["in_app", "email"])).default(["in_app", "email"])
    }).optional(),
    selectionRounds: z.array(z.any()).optional(),
    studentRequirements: z.record(z.any()).optional(),
    applicationStartDate: z.string().min(1, "Application start date is required"),
    applicationDeadline: z.string().min(1, "Application deadline is required"),
    driveDate: z.string().min(1, "Drive date is required"),
    venue: z.string().optional().default(""),
    applicationLink: z.string().optional().default("")
});

export const updateDriveSchema = createDriveSchema.partial();
