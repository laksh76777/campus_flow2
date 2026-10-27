import { getPool } from "../database/db.js";

async function main() {
    const p = getPool();
    console.log("Starting Data Integrity & Constraint Pre-Check...");

    // 1. Duplicate emails
    const dupEmails = await p.query(
        "SELECT LOWER(email) AS email, COUNT(*) AS count FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1"
    );
    console.log("Duplicate emails (case-insensitive):", dupEmails.rows);

    // 2. Duplicate USNs
    const dupUsns = await p.query(
        "SELECT LOWER(TRIM(usn)) AS usn, COUNT(*) AS count FROM student_profiles WHERE usn IS NOT NULL AND usn != '' GROUP BY LOWER(TRIM(usn)) HAVING COUNT(*) > 1"
    );
    console.log("Duplicate USNs (case-insensitive):", dupUsns.rows);

    // 3. Duplicate Enrollment Numbers
    const dupEnroll = await p.query(
        "SELECT LOWER(TRIM(enrollment_number)) AS enrollment_number, COUNT(*) AS count FROM student_profiles GROUP BY LOWER(TRIM(enrollment_number)) HAVING COUNT(*) > 1"
    );
    console.log("Duplicate Enrollment Numbers:", dupEnroll.rows);

    // 4. Active Sessions count
    const activeSessions = await p.query(
        "SELECT id, session_year, is_active FROM placement_sessions WHERE is_active = true"
    );
    console.log("Active placement sessions count:", activeSessions.rows.length);

    // 5. Invalid CGPA ranges
    const invalidCgpa = await p.query(
        "SELECT id, usn, cgpa, verified_cgpa FROM student_profiles WHERE (cgpa IS NOT NULL AND (cgpa < 0 OR cgpa > 10)) OR (verified_cgpa IS NOT NULL AND (verified_cgpa < 0 OR verified_cgpa > 10))"
    );
    console.log("Invalid CGPA rows:", invalidCgpa.rows);

    // 6. Invalid Percentage ranges
    const invalidPct = await p.query(
        "SELECT id, usn, tenth_percentage, twelfth_percentage FROM student_profiles WHERE (tenth_percentage IS NOT NULL AND (tenth_percentage < 0 OR tenth_percentage > 100)) OR (twelfth_percentage IS NOT NULL AND (twelfth_percentage < 0 OR twelfth_percentage > 100))"
    );
    console.log("Invalid percentage rows:", invalidPct.rows);

    // 7. Invalid Placement Drive Dates
    const invalidDates = await p.query(
        "SELECT id, job_title, application_start_date, application_deadline FROM placement_drives WHERE application_deadline < application_start_date"
    );
    console.log("Invalid placement drive deadline rows:", invalidDates.rows);

    // 8. Orphaned applications
    const orphanedApps = await p.query(
        "SELECT a.id FROM applications a LEFT JOIN student_profiles sp ON sp.id = a.student_id WHERE sp.id IS NULL"
    );
    console.log("Orphaned applications:", orphanedApps.rows.length);

    process.exit(0);
}

main().catch((err) => {
    console.error("Audit error:", err);
    process.exit(1);
});
