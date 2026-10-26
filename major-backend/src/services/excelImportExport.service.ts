import ExcelJS from "exceljs";
import bcrypt from "bcrypt";
import { withTransaction } from "../database/db.js";
import { ImportExportRepository } from "../repositories/importExport.repository.js";
import { StudentRepository } from "../repositories/student.repository.js";
import { UserRepository } from "../repositories/user.repository.js";

/**
 * Sanitizes spreadsheet cell strings to prevent Excel Formula Injection (CSV Injection).
 */
export const sanitizeFormula = (val: any): any => {
    if (typeof val !== "string") return val;
    const dangerousChars = ["=", "+", "-", "@", "\t", "\r"];
    if (dangerousChars.some((char) => val.startsWith(char))) {
        return `'${val}`;
    }
    return val;
};

export interface PreviewRow {
    rowNumber: number;
    identifier: string;
    name: string;
    email: string;
    branch: string;
    graduationYear: number;
    semester: number;
    cgpa?: number;
    status: "VALID" | "WARNING" | "CONFLICT" | "ERROR";
    action: "INSERT" | "UPDATE" | "SKIP" | "ERROR";
    reason?: string;
}

export class ExcelImportExportService {
    static async previewStudentExcel(
        buffer: Buffer,
        originalFilename: string,
        userId: string,
        placementSessionId?: string
    ): Promise<any> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new Error("Uploaded workbook contains no worksheets.");
        }

        const previewRows: PreviewRow[] = [];
        const seenUsns = new Set<string>();
        const errorReport: any[] = [];

        let validCount = 0;
        let conflictCount = 0;
        let invalidCount = 0;

        // Header mapping
        const headers: { [col: number]: string } = {};
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = String(cell.value || "").trim().toLowerCase();
        });

        const findCol = (keys: string[]): number | undefined => {
            for (const [col, name] of Object.entries(headers)) {
                if (keys.some((k) => name.includes(k))) return Number(col);
            }
            return undefined;
        };

        const colUsn = findCol(["usn", "seat number", "roll number"]) || 1;
        const colName = findCol(["name", "student name", "full name"]) || 2;
        const colEmail = findCol(["email", "mail"]) || 3;
        const colBranch = findCol(["branch", "dept", "department"]) || 4;
        const colGradYear = findCol(["grad", "year", "batch"]) || 5;
        const colCgpa = findCol(["cgpa", "gpa", "marks"]) || 6;

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip headers

            const usn = String(row.getCell(colUsn).value || "").trim().toUpperCase();
            const name = String(row.getCell(colName).value || "").trim();
            const email = String(row.getCell(colEmail).value || "").trim().toLowerCase();
            const branch = String(row.getCell(colBranch).value || "").trim();
            const gradYear = parseInt(String(row.getCell(colGradYear).value || "2026"), 10);
            const cgpaRaw = row.getCell(colCgpa).value;
            const cgpa = cgpaRaw ? parseFloat(String(cgpaRaw)) : undefined;

            if (!usn && !email) return; // Skip blank rows

            let status: "VALID" | "WARNING" | "CONFLICT" | "ERROR" = "VALID";
            let action: "INSERT" | "UPDATE" | "SKIP" | "ERROR" = "INSERT";
            let reason = "";

            if (!usn) {
                status = "ERROR";
                action = "ERROR";
                reason = "USN is missing";
                invalidCount++;
            } else if (seenUsns.has(usn)) {
                status = "CONFLICT";
                action = "SKIP";
                reason = "Duplicate USN in spreadsheet";
                conflictCount++;
            } else if (!email || !email.includes("@")) {
                status = "ERROR";
                action = "ERROR";
                reason = "Invalid email format";
                invalidCount++;
            } else {
                seenUsns.add(usn);
                validCount++;
            }

            if (status === "ERROR") {
                errorReport.push({ rowNumber, identifier: usn || email, reason });
            }

            previewRows.push({
                rowNumber,
                identifier: usn,
                name: name || "Student",
                email,
                branch: branch || "General",
                graduationYear: isNaN(gradYear) ? 2026 : gradYear,
                semester: 7,
                cgpa,
                status,
                action,
                reason
            });
        });

        const batchId = `import_${Date.now()}`;
        const batch = await ImportExportRepository.createBatch({
            batchId,
            importType: "student_records",
            placementSessionId,
            originalFilename,
            initiatedBy: userId,
            totalRows: previewRows.length,
            validRows: validCount,
            invalidRows: invalidCount,
            conflictRows: conflictCount,
            previewResults: previewRows,
            errorReport,
            summary: `Preview completed: ${validCount} valid, ${conflictCount} conflicts, ${invalidCount} invalid rows.`
        });

        return {
            batchId,
            totalRows: previewRows.length,
            validRows: validCount,
            conflictRows: conflictCount,
            invalidRows: invalidCount,
            preview: previewRows.slice(0, 50),
            errorReport
        };
    }

    static async commitStudentBatch(batchId: string): Promise<any> {
        const batch = await ImportExportRepository.findBatchById(batchId);
        if (!batch) throw new Error("Import batch not found");
        if (batch.status === "COMMITTED") throw new Error("Batch has already been committed");

        const previewResults: PreviewRow[] = batch.preview_results || [];
        const validRows = previewResults.filter((r) => r.status === "VALID" || r.action === "INSERT");

        let inserted = 0;
        let skipped = 0;
        let failed = 0;

        const defaultPasswordHash = await bcrypt.hash("CampusFlow@2026", 10);

        for (const row of validRows) {
            try {
                await withTransaction(async (client) => {
                    // Check if email or USN already exists in database
                    const existingUserRes = await client.query(
                        "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
                        [row.email]
                    );
                    if (existingUserRes.rows.length > 0) {
                        skipped++;
                        return;
                    }

                    const userRes = await client.query(
                        `INSERT INTO users (full_name, email, password_hash, role)
                         VALUES ($1, $2, $3, 'student')
                         RETURNING id`,
                        [row.name, row.email, defaultPasswordHash]
                    );
                    const newUserId = userRes.rows[0].id;

                    await client.query(
                        `INSERT INTO student_profiles (
                            user_id, enrollment_number, usn, branch, graduation_year, semester, cgpa, placement_session_id
                         )
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            newUserId,
                            row.identifier,
                            row.identifier,
                            row.branch,
                            row.graduationYear,
                            row.semester,
                            row.cgpa || null,
                            batch.placement_session_id || null
                        ]
                    );
                    inserted++;
                });
            } catch (err) {
                console.error(`Failed to commit row ${row.rowNumber} (${row.identifier}):`, err);
                failed++;
            }
        }

        const finalStatus = failed === 0 ? "COMMITTED" : "PARTIAL_COMMIT";
        return await ImportExportRepository.updateBatchCommit(batchId, {
            insertedRows: inserted,
            updatedRows: 0,
            skippedRows: skipped,
            failedRows: failed,
            status: finalStatus,
            summary: `Import committed: ${inserted} inserted, ${skipped} skipped, ${failed} failed.`
        });
    }
}
