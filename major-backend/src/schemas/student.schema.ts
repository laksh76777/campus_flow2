import { z } from "zod";

export const updateProfileSchema = z.object({
    personalEmail: z.string().email().optional().or(z.literal("")),
    collegeEmail: z.string().email().optional().or(z.literal("")),
    alternatePhone: z.string().optional().or(z.literal("")),
    aadharNumber: z.string().optional().or(z.literal("")),
    dob: z.string().optional().nullable(),
    gender: z.enum(["Male", "Female", "Other", "Prefer not to say"]).optional(),
    currentAddress: z.record(z.any()).optional(),
    permanentAddress: z.record(z.any()).optional(),
    sameAsCurrent: z.boolean().optional(),
    family: z.record(z.any()).optional(),
    tenthDetails: z.record(z.any()).optional(),
    twelfthOrDiplomaDetails: z.record(z.any()).optional(),
    tenthPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
    twelfthPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
    semesterResults: z.array(z.any()).optional(),
    cgpa: z.coerce.number().min(0).max(10).optional().nullable(),
    activeBacklogs: z.coerce.number().int().min(0).optional(),
    historicalBacklogs: z.coerce.number().int().min(0).optional(),
    backlogDetails: z.array(z.any()).optional(),
    hasEducationGap: z.boolean().optional(),
    educationGaps: z.array(z.any()).optional(),
    skills: z.array(z.string()).optional(),
    certificates: z.array(z.any()).optional(),
    about: z.string().max(500).optional(),
    resumeUrl: z.string().optional(),
    resumePublicId: z.string().optional()
});

export const requestModificationSchema = z.object({
    reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
    fieldsToModify: z.array(z.string()).min(1, "At least one field to modify is required")
});

export const reviewModificationSchema = z.object({
    requestId: z.string().min(1, "Request ID is required"),
    action: z.enum(["approve", "reject"]),
    rejectionReason: z.string().optional()
});
