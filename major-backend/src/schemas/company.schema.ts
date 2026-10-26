import { z } from "zod";

export const createCompanySchema = z.object({
    companyName: z.string().min(1, "Company name is required").max(150),
    companyDescription: z.string().optional().default(""),
    companyWebsite: z.string().optional().default(""),
    industry: z.string().optional().default(""),
    location: z.string().optional().default(""),
    contactEmail: z.string().email().optional().or(z.literal("")),
    contactPhone: z.string().optional().default("")
});

export const updateCompanySchema = createCompanySchema.partial();
