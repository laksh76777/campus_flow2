import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const seedDatabase = async (): Promise<void> => {
    console.log("Seeding CampusFlow V3 reference data & demo accounts...");

    const seedFilePath = path.resolve(__dirname, "../../migrations/004_seed_data.sql");
    if (!fs.existsSync(seedFilePath)) {
        throw new Error(`Seed SQL file not found at: ${seedFilePath}`);
    }

    const sql = fs.readFileSync(seedFilePath, "utf-8");
    await query(sql);
    console.log("Reference catalog, placement session, and demo accounts seeded successfully.");
    console.log("Demo Accounts Active:");
    console.log(" - Admin:   admin@campusflow.edu   / Admin@12345");
    console.log(" - Student: student@campusflow.edu / Student@12345 (USN: 1RV22CS042)");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    seedDatabase()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("Database seeding encountered an issue:", err);
            process.exit(1);
        });
}
