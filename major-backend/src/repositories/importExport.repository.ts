import { query } from "../database/db.js";

export class ImportExportRepository {
    static async createBatch(data: {
        batchId: string;
        importType: string;
        placementDriveId?: string | null;
        placementSessionId?: string | null;
        originalFilename: string;
        initiatedBy: string;
        totalRows?: number;
        validRows?: number;
        invalidRows?: number;
        conflictRows?: number;
        previewResults?: any[];
        errorReport?: any[];
        summary?: string;
    }): Promise<any> {
        const res = await query(
            `INSERT INTO import_batches (
                batch_id, import_type, placement_drive_id, placement_session_id,
                original_filename, initiated_by, status, total_rows, valid_rows,
                invalid_rows, conflict_rows, preview_results, error_report, summary
             )
             VALUES ($1, $2, $3, $4, $5, $6, 'PREVIEWED', $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                data.batchId,
                data.importType,
                data.placementDriveId || null,
                data.placementSessionId || null,
                data.originalFilename,
                data.initiatedBy,
                data.totalRows || 0,
                data.validRows || 0,
                data.invalidRows || 0,
                data.conflictRows || 0,
                JSON.stringify(data.previewResults || []),
                JSON.stringify(data.errorReport || []),
                data.summary || ""
            ]
        );
        return res.rows[0];
    }

    static async findBatchById(batchId: string): Promise<any | null> {
        const res = await query("SELECT * FROM import_batches WHERE batch_id = $1 LIMIT 1", [batchId]);
        return res.rows[0] || null;
    }

    static async updateBatchCommit(
        batchId: string,
        stats: {
            insertedRows: number;
            updatedRows: number;
            skippedRows: number;
            failedRows: number;
            status: "COMMITTED" | "FAILED" | "PARTIAL_COMMIT";
            summary?: string;
        }
    ): Promise<any> {
        const res = await query(
            `UPDATE import_batches
             SET inserted_rows = $1,
                 updated_rows = $2,
                 skipped_rows = $3,
                 failed_rows = $4,
                 status = $5,
                 summary = COALESCE($6, summary),
                 completed_at = now()
             WHERE batch_id = $7
             RETURNING *`,
            [
                stats.insertedRows,
                stats.updatedRows,
                stats.skippedRows,
                stats.failedRows,
                stats.status,
                stats.summary || null,
                batchId
            ]
        );
        return res.rows[0];
    }

    static async logExport(data: {
        placementDriveId: string;
        exportedBy: string;
        exportFormat?: string;
        exportedFields?: string[];
        applicantCount?: number;
        statusFilter?: string;
        branchFilter?: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void> {
        await query(
            `INSERT INTO export_logs (
                placement_drive_id, exported_by, export_format, exported_fields,
                applicant_count, status_filter, branch_filter, ip_address, user_agent
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                data.placementDriveId,
                data.exportedBy,
                data.exportFormat || "csv",
                data.exportedFields || [],
                data.applicantCount || 0,
                data.statusFilter || "all",
                data.branchFilter || "all",
                data.ipAddress || "",
                data.userAgent || ""
            ]
        );
    }
}
