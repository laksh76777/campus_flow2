import { z } from "zod";

export const applyDriveSchema = z.object({
    placementDriveId: z.string().min(1, "Placement drive ID is required"),
    customAnswers: z.array(z.object({
        questionId: z.string(),
        question: z.string(),
        type: z.string().optional(),
        answer: z.any()
    })).optional().default([])
});

export const updateApplicationStatusSchema = z.object({
    status: z.enum([
        "applied",
        "shortlisted",
        "interview",
        "selected",
        "rejected",
        "on_hold",
        "offer_received",
        "offer_accepted",
        "offer_declined",
        "withdrawn"
    ]),
    remarks: z.string().optional().default(""),
    interviewDate: z.string().optional().nullable(),
    interviewRound: z.string().optional(),
    interviewLocation: z.string().optional(),
    offeredPackage: z.coerce.number().optional().nullable(),
    offerDetails: z.record(z.any()).optional()
});

export const tpoOverrideSchema = z.object({
    reason: z.string().min(5, "Override reason must be at least 5 characters")
});
