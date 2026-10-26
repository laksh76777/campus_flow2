import { z } from "zod";

export const createSupportConversationSchema = z.object({
    subject: z.string().min(1, "Subject is required").max(120),
    message: z.string().min(1, "Message is required").max(4000)
});

export const sendSupportMessageSchema = z.object({
    content: z.string().min(1, "Content is required").max(4000)
});

export const adminReplySchema = z.object({
    content: z.string().min(1, "Reply content is required").max(4000)
});

export const adminCopilotSchema = z.object({
    prompt: z.string().min(1, "Prompt is required").max(2000),
    contextFilter: z.record(z.any()).optional()
});
