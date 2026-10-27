import ExcelJS from "exceljs";
import { sanitizeFormula } from "./excelImportExport.service.js";
import { ApplicationRepository } from "../repositories/application.repository.js";
import { ImportExportRepository } from "../repositories/importExport.repository.js";

export class CompanyApplicantExportService {
    static async exportApplicantsWorkbook(
        driveId: string,
        exportedBy: string,
        filters: { status?: string; branch?: string } = {}
    ): Promise<Buffer> {
        const effectiveFilters: any = { ...filters };
        if (!effectiveFilters.status || effectiveFilters.status === "all") {
            // Documented reporting semantics: withdrawn candidates are excluded from corporate applicant rosters
            effectiveFilters.excludeWithdrawn = true;
        }
        const applications = await ApplicationRepository.findByDrive(driveId, effectiveFilters);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Candidates");

        sheet.columns = [
            { header: "USN", key: "usn", width: 16 },
            { header: "Candidate Name", key: "name", width: 25 },
            { header: "Email", key: "email", width: 30 },
            { header: "Phone", key: "phone", width: 16 },
            { header: "Department / Branch", key: "branch", width: 22 },
            { header: "Current CGPA", key: "cgpa", width: 14 },
            { header: "Active Backlogs", key: "backlogs", width: 16 },
            { header: "Application Status", key: "status", width: 18 },
            { header: "Applied Date", key: "appliedAt", width: 20 },
            { header: "Resume Link", key: "resume", width: 40 }
        ];

        // Format header
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF2549E8" }
        };

        for (const app of applications) {
            sheet.addRow({
                usn: sanitizeFormula(app.usn || app.enrollment_number || ""),
                name: sanitizeFormula(app.full_name || ""),
                email: sanitizeFormula(app.email || ""),
                phone: sanitizeFormula(app.phone || ""),
                branch: sanitizeFormula(app.branch || ""),
                cgpa: app.verified_cgpa ?? app.cgpa ?? "N/A",
                backlogs: app.active_backlogs ?? 0,
                status: sanitizeFormula(app.status?.toUpperCase() || ""),
                appliedAt: new Date(app.applied_at).toLocaleDateString(),
                resume: sanitizeFormula(app.resume_url || "")
            });
        }

        await ImportExportRepository.logExport({
            placementDriveId: driveId,
            exportedBy,
            exportFormat: "xlsx",
            applicantCount: applications.length,
            statusFilter: filters.status || "all",
            branchFilter: filters.branch || "all"
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}
