import { PlacementDataResetService } from "../services/placementDataReset.service.js";

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    let snapshotPath: string | null = null;

    for (const arg of args) {
        if (arg.startsWith("--file=")) {
            snapshotPath = arg.split("=")[1];
        } else if (!arg.startsWith("--")) {
            snapshotPath = arg;
        }
    }

    if (!snapshotPath) {
        console.error(`
================================================================================
         CAMPUSFLOW V3 — PLACEMENT DATA RESTORE TOOL
================================================================================
USAGE:
  npm run restore:placement-data -- --file=backups/placement_snapshot_development_12345.json

DESCRIPTION:
  Restores a previously captured snapshot of placement drives, companies,
  applications, and reminder jobs back into the database within an atomic transaction.
================================================================================
`);
        process.exit(1);
    }

    try {
        console.log(`\nStarting restoration from snapshot: ${snapshotPath}...`);
        const result = await PlacementDataResetService.restoreFromSnapshot(snapshotPath);
        console.log(`>>> Restoration complete! Restored ${result.restoredCount} placement records. Status: ${result.status}\n`);
        process.exit(0);
    } catch (err: any) {
        console.error(`\n>>> Restoration failed: ${err?.message || err}\n`);
        process.exit(1);
    }
}

if (process.argv[1]?.endsWith("restorePlacementData.ts") || process.argv[1]?.endsWith("restorePlacementData.js")) {
    main();
}
