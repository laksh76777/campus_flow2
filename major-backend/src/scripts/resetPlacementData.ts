import { PlacementDataResetService, ResetOptions } from "../services/placementDataReset.service.js";

function parseArgs(): {
    environment: "development" | "staging" | "test" | "production" | null;
    confirm: string | null;
    confirmProduction: string | null;
    isDryRun: boolean;
    backupDir?: string;
    jsonOutput: boolean;
} {
    const args = process.argv.slice(2);
    let environment: any = null;
    let confirm: string | null = null;
    let confirmProduction: string | null = null;
    let isDryRun = false;
    let backupDir: string | undefined = undefined;
    let jsonOutput = false;

    for (const arg of args) {
        if (arg === "--dry-run") {
            isDryRun = true;
        } else if (arg === "--json") {
            jsonOutput = true;
        } else if (arg.startsWith("--env=")) {
            environment = arg.split("=")[1];
        } else if (arg.startsWith("--confirm=")) {
            confirm = arg.split("=")[1];
        } else if (arg.startsWith("--confirm-production=")) {
            confirmProduction = arg.split("=")[1];
        } else if (arg.startsWith("--backup-dir=")) {
            backupDir = arg.split("=")[1];
        }
    }

    return { environment, confirm, confirmProduction, isDryRun, backupDir, jsonOutput };
}

function printHelp(): void {
    console.log(`
================================================================================
           CAMPUSFLOW V3 — SAFE PLACEMENT DATA RESET TOOL
================================================================================
DESCRIPTION:
  Safely and repeatably resets placement drives, company records, job applications,
  interview rounds, offers, and reminder jobs while PRESERVING student accounts,
  academic profiles, admin credentials, program catalog, and placement sessions.

USAGE:
  # 1. Preview planned deletions (DRY-RUN):
  npm run reset:placement-data -- --dry-run --env=development

  # 2. Execute reset in Non-Production Environment (Development / Staging / Test):
  npm run reset:placement-data -- --env=development --confirm=CONFIRM_RESET_PLACEMENT_DATA

  # 3. Execute reset in Production Environment (Triple Safeguard Required):
  ALLOW_PRODUCTION_RESET=true npm run reset:placement-data -- \\
    --env=production \\
    --confirm=CONFIRM_RESET_PLACEMENT_DATA \\
    --confirm-production=I_UNDERSTAND_THIS_WILL_DELETE_ALL_PLACEMENT_DATA

OPTIONS:
  --dry-run                         Run in read-only analysis mode without mutating database
  --env=<env>                       Target environment: development | staging | test | production
  --confirm=<token>                 Required confirmation token: CONFIRM_RESET_PLACEMENT_DATA
  --confirm-production=<token>      Extra safeguard token required for production
  --backup-dir=<path>               Custom directory for pre-execution JSON backup snapshot
  --json                            Emit machine-readable JSON to stdout
================================================================================
`);
}

async function main(): Promise<void> {
    const { environment, confirm, confirmProduction, isDryRun, backupDir, jsonOutput } = parseArgs();

    if (!environment && !isDryRun) {
        printHelp();
        console.error("ERROR: Missing target environment. Specify --env=<development|staging|test|production>\n");
        process.exit(1);
    }

    const options: ResetOptions = {
        environment: (environment as any) || "development",
        confirm: confirm || undefined,
        confirmProduction: confirmProduction || undefined,
        isDryRun,
        backupDir,
        executedBy: process.env.USER || process.env.USERNAME || "operator"
    };

    try {
        if (!jsonOutput) {
            console.log("\n================================================================================");
            console.log(` CAMPUSFLOW PLACEMENT DATA RESET — Mode: ${isDryRun ? "DRY-RUN (READ-ONLY)" : "ACTIVE EXECUTION"}`);
            console.log(` Target Environment: ${options.environment.toUpperCase()}`);
            console.log("================================================================================\n");
        }

        const summary = await PlacementDataResetService.executeReset(options);

        if (jsonOutput) {
            console.log(JSON.stringify(summary, null, 2));
            process.exit(0);
        }

        if (isDryRun) {
            console.log(">>> DRY-RUN INSPECTION RESULTS (No database changes were made):");
            console.log("--------------------------------------------------------------------------------");
            console.log("  PLACEMENT DATA TO BE REMOVED:");
            console.log(`   - Placement Drives:        ${summary.tablesToDelete.placement_drives}`);
            console.log(`   - Applications & Offers:   ${summary.tablesToDelete.applications}`);
            console.log(`   - Recruiting Companies:    ${summary.tablesToDelete.companies}`);
            console.log(`   - Reminder Jobs / Queue:   ${summary.tablesToDelete.reminder_jobs}`);
            console.log(`   - Drive Export Logs:       ${summary.tablesToDelete.export_logs}`);
            console.log(`   - Drive Import Batches:    ${summary.tablesToDelete.import_batches}`);
            console.log(`   - Drive Notifications:     ${summary.tablesToDelete.drive_notifications}`);
            console.log("--------------------------------------------------------------------------------");
            console.log("  STUDENT STATE TO BE RESET:");
            console.log(`   - Placed Students Reset:   ${summary.tablesToUpdate.student_profiles_placed_reset}`);
            console.log("--------------------------------------------------------------------------------");
            console.log("  CORE ENTITIES PRESERVED (UNTOUCHED):");
            console.log(`   - User Accounts:           ${summary.preservedEntities.users} (students + admins)`);
            console.log(`   - Admin / TPO Profiles:    ${summary.preservedEntities.admins}`);
            console.log(`   - Student Profiles:        ${summary.preservedEntities.student_profiles} (USNs, CGPA, Resumes)`);
            console.log(`   - Academic Departments:    ${summary.preservedEntities.departments}`);
            console.log(`   - Placement Sessions:      ${summary.preservedEntities.placement_sessions}`);
            console.log(`   - Support Conversations:   ${summary.preservedEntities.support_conversations}`);
            console.log(`   - Unrelated Notifications: ${summary.preservedEntities.unrelated_notifications}`);
            console.log("--------------------------------------------------------------------------------");
            console.log("\nReady to execute? Run the command without --dry-run and provide the confirmation token.");
        } else {
            console.log(">>> RESET SUCCESSFULLY EXECUTED AND COMMITTED:");
            console.log("--------------------------------------------------------------------------------");
            console.log(` Execution ID:     ${summary.executionId}`);
            console.log(` Backup Snapshot:  ${summary.backupPath}`);
            console.log(` Backup Checksum:  ${summary.backupChecksum}`);
            console.log("--------------------------------------------------------------------------------");
            console.log("  RECORDS REMOVED:");
            console.log(`   - Placement Drives:        ${summary.tablesToDelete.placement_drives}`);
            console.log(`   - Applications & Offers:   ${summary.tablesToDelete.applications}`);
            console.log(`   - Recruiting Companies:    ${summary.tablesToDelete.companies}`);
            console.log(`   - Reminder Jobs / Queue:   ${summary.tablesToDelete.reminder_jobs}`);
            console.log(`   - Drive Notifications:     ${summary.tablesToDelete.drive_notifications}`);
            console.log("--------------------------------------------------------------------------------");
            console.log("  INTEGRITY VERIFICATION:");
            console.log(`   - Remaining Drives:        ${summary.postResetIntegrityCheck?.remainingPlacementDrives} (must be 0)`);
            console.log(`   - Remaining Applications:  ${summary.postResetIntegrityCheck?.remainingApplications} (must be 0)`);
            console.log(`   - Remaining Companies:     ${summary.postResetIntegrityCheck?.remainingCompanies} (must be 0)`);
            console.log(`   - Users Preserved:         ${summary.postResetIntegrityCheck?.usersPreserved ? "YES" : "NO"}`);
            console.log(`   - Students Preserved:      ${summary.postResetIntegrityCheck?.studentsPreserved ? "YES" : "NO"}`);
            console.log(`   - Admins Preserved:        ${summary.postResetIntegrityCheck?.adminsPreserved ? "YES" : "NO"}`);
            console.log("--------------------------------------------------------------------------------\n");
        }

        process.exit(0);
    } catch (err: any) {
        if (jsonOutput) {
            console.error(JSON.stringify({ error: err?.message || String(err) }, null, 2));
        } else {
            console.error("\n================================================================================");
            console.error(" EXECUTION ABORTED (SAFEGUARD TRIGGERED / ERROR):");
            console.error(` ${err?.message || err}`);
            console.error("================================================================================\n");
        }
        process.exit(1);
    }
}

if (process.argv[1]?.endsWith("resetPlacementData.ts") || process.argv[1]?.endsWith("resetPlacementData.js")) {
    main();
}
