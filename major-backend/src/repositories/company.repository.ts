import { query } from "../database/db.js";
import { CompanyRecord } from "../database/types.js";
import { ApiError } from "../utils/ApiError.js";

export class CompanyRepository {
    static async findAll(activeOnly: boolean = false, search?: string): Promise<CompanyRecord[]> {
        const conditions: string[] = ["1=1"];
        const params: any[] = [];
        let idx = 1;

        if (activeOnly) {
            conditions.push("is_active = true");
        }

        if (search && search.trim()) {
            conditions.push(
                `(LOWER(company_name) LIKE $${idx} OR LOWER(industry) LIKE $${idx} OR LOWER(location) LIKE $${idx})`
            );
            params.push(`%${search.trim().toLowerCase()}%`);
            idx++;
        }

        const sql = `SELECT * FROM companies WHERE ${conditions.join(" AND ")} ORDER BY company_name ASC`;
        try {
            const res = await query<CompanyRecord>(sql, params);
            return res.rows;
        } catch {
            return [];
        }
    }

    static async findById(id: string): Promise<CompanyRecord | null> {
        try {
            const res = await query<CompanyRecord>("SELECT * FROM companies WHERE id = $1 LIMIT 1", [id]);
            return res.rows[0] || null;
        } catch {
            return null;
        }
    }

    static async findByName(name: string): Promise<CompanyRecord | null> {
        try {
            const res = await query<CompanyRecord>(
                "SELECT * FROM companies WHERE LOWER(TRIM(company_name)) = LOWER(TRIM($1)) LIMIT 1",
                [name.trim()]
            );
            return res.rows[0] || null;
        } catch {
            return null;
        }
    }

    static async create(data: {
        companyName: string;
        companyDescription?: string;
        companyWebsite?: string;
        companyLogoUrl?: string;
        companyLogoPublicId?: string;
        industry?: string;
        location?: string;
        contactEmail?: string;
        contactPhone?: string;
        createdBy?: string;
    }): Promise<CompanyRecord> {
        const existing = await this.findByName(data.companyName);
        if (existing) {
            throw new ApiError(409, "A company with this name already exists.");
        }

        try {
            const res = await query<CompanyRecord>(
                `INSERT INTO companies (
                    company_name, company_description, company_website,
                    company_logo_url, company_logo_public_id,
                    industry, location, contact_email, contact_phone, created_by
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [
                    data.companyName.trim(),
                    data.companyDescription || "",
                    data.companyWebsite || "",
                    data.companyLogoUrl || "",
                    data.companyLogoPublicId || "",
                    data.industry || "",
                    data.location || "",
                    data.contactEmail ? data.contactEmail.trim().toLowerCase() : "",
                    data.contactPhone || "",
                    data.createdBy || null
                ]
            );
            return res.rows[0];
        } catch (err: any) {
            if (err?.code === "23505") {
                throw new ApiError(409, "A company with this name already exists.");
            }
            throw err;
        }
    }

    static async update(id: string, updates: Partial<CompanyRecord>): Promise<CompanyRecord> {
        if (updates.company_name || (updates as any).companyName) {
            const newName = updates.company_name || (updates as any).companyName;
            const existing = await this.findByName(newName);
            if (existing && existing.id !== id) {
                throw new ApiError(409, "A company with this name already exists.");
            }
        }

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
        try {
            const res = await query<CompanyRecord>(
                `UPDATE companies SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
                values
            );
            return res.rows[0];
        } catch (err: any) {
            if (err?.code === "23505") {
                throw new ApiError(409, "A company with this name already exists.");
            }
            throw err;
        }
    }

    static async deactivate(id: string): Promise<CompanyRecord> {
        return await this.update(id, { is_active: false });
    }

    static async reactivate(id: string): Promise<CompanyRecord> {
        return await this.update(id, { is_active: true });
    }

    static async delete(id: string): Promise<void> {
        const driveCount = await query("SELECT COUNT(*) AS total FROM placement_drives WHERE company_id = $1", [id]);
        if (parseInt(driveCount.rows[0]?.total || "0", 10) > 0) {
            throw new ApiError(
                400,
                "Cannot delete company with associated placement drives. Deactivate the company instead to preserve placement drive history."
            );
        }
        await query("DELETE FROM companies WHERE id = $1", [id]);
    }
}
