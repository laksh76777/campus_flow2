import { query } from "../database/db.js";
import { DepartmentRecord } from "../database/types.js";
import { PROGRAM_CATALOG } from "../constants/programCatalog.js";

const DEFAULT_DEPARTMENTS: any[] = PROGRAM_CATALOG.map((p, idx) => ({
    id: `00000000-0000-0000-0000-0000000000${(idx + 1).toString().padStart(2, "0")}`,
    name: p.name,
    code: p.code,
    course: p.degreeType,
    program_level: p.programLevel,
    degree_type: p.degreeType,
    college: "Engineering & Technology",
    is_active: true,
    description: `Department of ${p.name}`
}));

export class DepartmentRepository {
    static async findAll(activeOnly: boolean = false): Promise<DepartmentRecord[]> {
        const sql = activeOnly
            ? "SELECT * FROM departments WHERE is_active = true ORDER BY name ASC"
            : "SELECT * FROM departments ORDER BY code ASC";
        try {
            const res = await query<DepartmentRecord>(sql);
            return res.rows.length > 0 ? res.rows : DEFAULT_DEPARTMENTS;
        } catch {
            return DEFAULT_DEPARTMENTS;
        }
    }

    static async findById(id: string): Promise<DepartmentRecord | null> {
        try {
            const res = await query<DepartmentRecord>("SELECT * FROM departments WHERE id = $1 LIMIT 1", [id]);
            return res.rows[0] || DEFAULT_DEPARTMENTS.find((d) => d.id === id) || null;
        } catch {
            return DEFAULT_DEPARTMENTS.find((d) => d.id === id) || null;
        }
    }

    static async findByCode(code: string): Promise<DepartmentRecord | null> {
        const clean = code.trim().toLowerCase();
        try {
            const res = await query<DepartmentRecord>(
                "SELECT * FROM departments WHERE LOWER(code) = LOWER($1) LIMIT 1",
                [clean]
            );
            return res.rows[0] || DEFAULT_DEPARTMENTS.find((d) => d.code.toLowerCase() === clean) || null;
        } catch {
            return DEFAULT_DEPARTMENTS.find((d) => d.code.toLowerCase() === clean) || null;
        }
    }
}
