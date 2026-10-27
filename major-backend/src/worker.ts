import { checkDatabaseHealth, getPool } from "./database/db.js";
import { validateEmailConfigOnStartup } from "./services/integrations/email/mail.service.js";
import { ReminderSchedulerService } from "./services/reminderScheduler.service.js";

const WORKER_POLL_INTERVAL_MS = 30000; // 30 seconds

async function startReminderWorker() {
    console.log("=================================================");
    console.log("  CAMPUSFLOW V3 — DEDICATED REMINDER WORKER");
    console.log("=================================================");

    // 1. Verify database connectivity
    const health = await checkDatabaseHealth();
    if (health.status !== "connected") {
        console.error(`[WORKER FATAL] Unable to connect to Supabase PostgreSQL: ${health.error}`);
        process.exit(1);
    }
    console.log("[WORKER] Database connection verified successfully.");

    // 2. Validate email provider configuration
    validateEmailConfigOnStartup();

    // 3. Process any due reminders immediately on boot
    console.log("[WORKER] Performing initial due reminder sweep...");
    try {
        const initialResult = await ReminderSchedulerService.processDueReminders();
        console.log(`[WORKER] Initial sweep complete: ${initialResult.message}`);
    } catch (err: any) {
        console.error("[WORKER] Initial sweep encountered an error:", err?.message || err);
    }

    // 4. Start polling worker
    ReminderSchedulerService.startWorker(WORKER_POLL_INTERVAL_MS);
    console.log(`[WORKER] Daemon polling loop initiated (every ${WORKER_POLL_INTERVAL_MS / 1000}s). Ready.`);

    // 5. Graceful shutdown handlers
    const shutdown = async (signal: string) => {
        console.log(`[WORKER] Received ${signal}. Shutting down worker gracefully...`);
        ReminderSchedulerService.stopWorker();
        try {
            await getPool().end();
            console.log("[WORKER] Database connection pool closed.");
        } catch (err) {
            console.error("[WORKER] Error closing database pool:", err);
        }
        process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

startReminderWorker().catch((err) => {
    console.error("[WORKER FATAL] Unexpected top-level worker crash:", err);
    process.exit(1);
});
