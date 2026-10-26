import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runMigrations = async (): Promise<void> => {
    console.log("Starting CampusFlow V3 PostgreSQL Migrations...");

    const migrationsDir = path.resolve(__dirname, "../../migrations");
    if (!fs.existsSync(migrationsDir)) {
        throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const files = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort();

    console.log(`Discovered ${files.length} migration script(s) in ${migrationsDir}`);

    // Create migrations tracker table if not exists
    await query(`
        CREATE TABLE IF NOT EXISTS _schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    for (const file of files) {
        const check = await query("SELECT id FROM _schema_migrations WHERE filename = $1", [file]);
        if (check.rows.length > 0) {
            console.log(`[SKIPPED] ${file} (already executed)`);
            continue;
        }

        console.log(`[EXECUTING] ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf-8");

        await query(sql);
        await query("INSERT INTO _schema_migrations (filename) VALUES ($1)", [file]);
        console.log(`[SUCCESS] ${file} applied successfully.`);
    }

    console.log("All migrations applied successfully!");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runMigrations()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("Migration failed:", err);
            process.exit(1);
        });
}
