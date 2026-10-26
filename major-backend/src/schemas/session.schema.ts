import { z } from "zod";

export const createSessionSchema = z.object({
    sessionYear: z.coerce.number().int().min(2020).max(2040),
    name: z.string().min(1, "Session name is required"),
    academicYear: z.string().optional().default(""),
    description: z.string().optional().default(""),
    isActive: z.boolean().optional().default(false),
    status: z.enum(["UPCOMING", "ACTIVE", "CLOSED", "ARCHIVED"]).optional().default("ACTIVE"),
    startDate: z.string().optional(),
    endDate: z.string().optional().nullable(),
    admissionYearMapping: z.array(z.object({
        course: z.string(),
        courseDurationYears: z.number(),
        admissionYear: z.number()
    })).optional().default([]),
    targetPlacementPercentage: z.coerce.number().min(0).max(100).optional().default(90)
});

export const updateSessionSchema = createSessionSchema.partial();
