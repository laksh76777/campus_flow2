import { app } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabaseHealth } from "./database/db.js";
import { ReminderSchedulerService } from "./services/reminderScheduler.service.js";

const PORT = env.PORT || 8000;

const startServer = async () => {
    console.log(`Starting CampusFlow V3 Backend on Port ${PORT}...`);

    // Verify database connectivity
    const health = await checkDatabaseHealth();
    if (health.status === "connected") {
        console.log("Connected to Supabase PostgreSQL database successfully.");
    } else {
        console.warn(`[WARNING] Database connection unavailable at startup: ${health.error}`);
        console.warn("The server will continue running. Update SUPABASE_DATABASE_URL or Supabase credentials in .env to connect.");
    }

    // Start background reminder worker (60-second polling cycle)
    ReminderSchedulerService.startWorker(60000);

    const server = app.listen(PORT, () => {
        console.log(`CampusFlow V3 REST API running on http://localhost:${PORT}`);
        console.log(`Health Check: http://localhost:${PORT}/health`);
    });

    // Graceful Shutdown
    const handleShutdown = (signal: string) => {
        console.log(`Received ${signal}. Shutting down gracefully...`);
        ReminderSchedulerService.stopWorker();
        server.close(() => {
            console.log("HTTP server closed.");
            process.exit(0);
        });
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
};

startServer().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
