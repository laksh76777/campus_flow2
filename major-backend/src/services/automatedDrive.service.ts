import ExcelJS from "exceljs";
import { DriveRepository } from "../repositories/drive.repository.js";
import { ApplicationRepository } from "../repositories/application.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { DEFAULT_SELECTION_ROUNDS, LEGAL_TRANSITIONS } from "../constants/appConstants.js";
import { sanitizeFormula } from "./excelImportExport.service.js";

export class AutomatedDriveService {
    static async getDriveRoundsAndPools(driveId: string): Promise<any> {
        const drive = await DriveRepository.findById(driveId);
        if (!drive) throw new Error("Placement drive not found");

        let rounds = Array.isArray(drive.selection_rounds) && drive.selection_rounds.length > 0
            ? drive.selection_rounds
            : DEFAULT_SELECTION_ROUNDS;

        const applications = await ApplicationRepository.findByDrive(driveId);

        const roundsWithStats = rounds.map((round: any) => {
            const roundNum = round.roundNumber;
            const clearedCount = applications.filter((app: any) =>
                Array.isArray(app.interview_rounds) &&
                app.interview_rounds.some((r: any) => r.roundNumber === roundNum && r.status === "cleared")
            ).length;

            const failedCount = applications.filter((app: any) =>
                Array.isArray(app.interview_rounds) &&
                app.interview_rounds.some((r: any) => r.roundNumber === roundNum && r.status === "failed")
            ).length;

            return {
                ...round,
                advancedCount: round.advancedCount || clearedCount,
                rejectedCount: round.rejectedCount || failedCount
            };
        });

        return {
            driveId: drive.id,
            jobTitle: drive.job_title,
            companyName: drive.company.company_name,
            currentRoundNumber: drive.current_round_number || 1,
            selectionRounds: roundsWithStats,
            totalApplications: applications.length
        };
    }

    static async advanceCandidatesInRound(
        driveId: string,
        roundNumber: number,
        candidateApplicationIds: string[],
        action: "advance" | "reject",
        remarks: string = "",
        actorId?: string
    ): Promise<any> {
        const drive = await DriveRepository.findById(driveId);
        if (!drive) throw new Error("Placement drive not found");

        let advanced = 0;
        let rejected = 0;

        for (const appId of candidateApplicationIds) {
            const app = await ApplicationRepository.findById(appId);
            if (!app || app.placement_drive_id !== driveId) continue;

            const rounds = Array.isArray(app.interview_rounds) ? [...app.interview_rounds] : [];
            const rIndex = rounds.findIndex((r: any) => r.roundNumber === roundNumber);

            const roundStatus = action === "advance" ? "cleared" : "failed";

            if (rIndex !== -1) {
                rounds[rIndex] = {
                    ...rounds[rIndex],
                    status: roundStatus,
                    feedback: remarks
                };
            } else {
                rounds.push({
                    roundNumber,
                    roundName: `Round ${roundNumber}`,
                    status: roundStatus,
                    feedback: remarks,
                    scheduledAt: new Date().toISOString()
                });
            }

            const targetAppStatus = action === "advance"
                ? roundNumber >= 4 ? "selected" : "interview"
                : "rejected";

            await ApplicationRepository.updateStatus(
                appId,
                targetAppStatus,
                `Round ${roundNumber} ${action === "advance" ? "cleared" : "not cleared"}: ${remarks}`,
                actorId,
                { interviewRound: `Round ${roundNumber}` }
            );

            // Notify candidate
            await NotificationRepository.create({
                user_id: app.user_id,
                title: action === "advance" ? "Round Cleared" : "Application Update",
                message: action === "advance"
                    ? `Congratulations! You cleared Round ${roundNumber} for ${drive.company.company_name}.`
                    : `Your application status for ${drive.company.company_name} has been updated.`,
                type: "status_update",
                status: targetAppStatus,
                company_name: drive.company.company_name,
                job_title: drive.job_title
            });

            if (action === "advance") advanced++;
            else rejected++;
        }

        return {
            success: true,
            roundNumber,
            action,
            advancedCount: advanced,
            rejectedCount: rejected
        };
    }

    static async exportRoundWorkbook(driveId: string, roundNumber: number): Promise<Buffer> {
        const drive = await DriveRepository.findById(driveId);
        if (!drive) throw new Error("Placement drive not found");

        const applications = await ApplicationRepository.findByDrive(driveId);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(`Round_${roundNumber}_Candidates`);

        sheet.columns = [
            { header: "USN", key: "usn", width: 16 },
            { header: "Candidate Name", key: "name", width: 25 },
            { header: "Email", key: "email", width: 30 },
            { header: "Branch", key: "branch", width: 20 },
            { header: "CGPA", key: "cgpa", width: 12 },
            { header: "Current Status", key: "status", width: 16 },
            { header: `Round ${roundNumber} Result (CLEARED/FAILED/PENDING)`, key: "result", width: 35 }
        ];

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1D38CF" }
        };

        for (const app of applications) {
            sheet.addRow({
                usn: sanitizeFormula(app.usn || app.enrollment_number || ""),
                name: sanitizeFormula(app.full_name || ""),
                email: sanitizeFormula(app.email || ""),
                branch: sanitizeFormula(app.branch || ""),
                cgpa: app.verified_cgpa ?? app.cgpa ?? "N/A",
                status: sanitizeFormula(app.status?.toUpperCase() || ""),
                result: "PENDING"
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}
