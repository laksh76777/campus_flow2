import { query } from "../database/db.js";
import { CompanyRecord } from "../database/types.js";

export const DEMO_COMPANIES: any[] = [
    {
        id: "33333333-3333-3333-3333-333333333333",
        company_name: "Google LLC",
        company_description: "Global Technology Leader in Cloud, Search, and AI Infrastructure",
        company_website: "https://careers.google.com",
        company_logo_url: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
        industry: "Information Technology",
        location: "Bangalore, India",
        is_active: true
    },
    {
        id: "44444444-4444-4444-4444-444444444444",
        company_name: "Microsoft Corporation",
        company_description: "Leading global developer of software, cloud platforms, and enterprise solutions",
        company_website: "https://careers.microsoft.com",
        company_logo_url: "https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg",
        industry: "Information Technology",
        location: "Hyderabad, India",
        is_active: true
    }
];

export class CompanyRepository {
    static async findAll(activeOnly: boolean = false): Promise<CompanyRecord[]> {
        const sql = activeOnly
            ? "SELECT * FROM companies WHERE is_active = true ORDER BY company_name ASC"
            : "SELECT * FROM companies ORDER BY created_at DESC";
        try {
            const res = await query<CompanyRecord>(sql);
            return res.rows.length > 0 ? res.rows : DEMO_COMPANIES;
        } catch {
            return DEMO_COMPANIES;
        }
    }

    static async findById(id: string): Promise<CompanyRecord | null> {
        const res = await query<CompanyRecord>("SELECT * FROM companies WHERE id = $1 LIMIT 1", [id]);
        return res.rows[0] || null;
    }

    static async findByName(name: string): Promise<CompanyRecord | null> {
        const res = await query<CompanyRecord>(
            "SELECT * FROM companies WHERE LOWER(company_name) = LOWER($1) LIMIT 1",
            [name.trim()]
        );
        return res.rows[0] || null;
    }

    static async create(data: {
        companyName: string;
        companyDescription?: string;
        companyWebsite?: string;
        industry?: string;
        location?: string;
        contactEmail?: string;
        contactPhone?: string;
        createdBy?: string;
    }): Promise<CompanyRecord> {
        const res = await query<CompanyRecord>(
            `INSERT INTO companies (
                company_name, company_description, company_website,
                industry, location, contact_email, contact_phone, created_by
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                data.companyName.trim(),
                data.companyDescription || "",
                data.companyWebsite || "",
                data.industry || "",
                data.location || "",
                data.contactEmail ? data.contactEmail.trim().toLowerCase() : "",
                data.contactPhone || "",
                data.createdBy || null
            ]
        );
        return res.rows[0];
    }

    static async update(id: string, updates: Partial<CompanyRecord>): Promise<CompanyRecord> {
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        for (const [key, val] of Object.entries(updates)) {
            const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
            setClauses.push(`${snakeKey} = $${idx}`);
            values.push(val === undefined ? null : val);
            idx++;
        }

        values.push(id);
        const res = await query<CompanyRecord>(
            `UPDATE companies SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
            values
        );
        return res.rows[0];
    }
}
