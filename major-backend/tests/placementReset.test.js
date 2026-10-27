import test from "node:test";
import assert from "node:assert/strict";
import { PlacementDataResetService } from "../dist/services/placementDataReset.service.js";
import { getPool } from "../dist/database/db.js";

test("Placement Reset Safeguards - rejects missing environment", async () => {
    await assert.rejects(
        async () => {
            await PlacementDataResetService.executeReset({ environment: "" });
        },
        /Target environment \(--env\) must be specified/
    );
});

test("Placement Reset Safeguards - rejects missing confirmation token", async () => {
    await assert.rejects(
        async () => {
            await PlacementDataResetService.executeReset({
                environment: "development",
                confirm: "WRONG_TOKEN"
            });
        },
        /Confirmation required/
    );
});

test("Placement Reset Safeguards - rejects production execution without production token", async () => {
    await assert.rejects(
        async () => {
            await PlacementDataResetService.executeReset({
                environment: "production",
                confirm: PlacementDataResetService.CONFIRMATION_TOKEN
            });
        },
        /CRITICAL PRODUCTION SAFEGUARD: Production deletion blocked/
    );
});

test("Placement Reset Safeguards - rejects production execution when ALLOW_PRODUCTION_RESET != 'true'", async () => {
    const prevEnv = process.env.ALLOW_PRODUCTION_RESET;
    delete process.env.ALLOW_PRODUCTION_RESET;

    try {
        await assert.rejects(
            async () => {
                await PlacementDataResetService.executeReset({
                    environment: "production",
                    confirm: PlacementDataResetService.CONFIRMATION_TOKEN,
                    confirmProduction: PlacementDataResetService.PRODUCTION_CONFIRMATION_TOKEN
                });
            },
            /environment variable ALLOW_PRODUCTION_RESET is not set to 'true'/
        );
    } finally {
        if (prevEnv !== undefined) {
            process.env.ALLOW_PRODUCTION_RESET = prevEnv;
        }
    }
});

test("Placement Reset Dry-Run - reports accurate counts without mutating state", async () => {
    const summary = await PlacementDataResetService.getDryRunSummary("test");

    assert.equal(summary.mode, "DRY_RUN");
    assert.equal(summary.environment, "test");
    assert.ok(typeof summary.tablesToDelete.placement_drives === "number");
    assert.ok(typeof summary.tablesToDelete.companies === "number");
    assert.ok(typeof summary.tablesToDelete.applications === "number");
    assert.ok(typeof summary.tablesToDelete.reminder_jobs === "number");

    // Preserved entities must be active
    assert.ok(summary.preservedEntities.users > 0, "Users must be preserved");
    assert.ok(summary.preservedEntities.admins > 0, "Admins must be preserved");
    assert.ok(summary.preservedEntities.student_profiles > 0, "Student profiles must be preserved");
    assert.ok(summary.preservedEntities.departments > 0, "Departments must be preserved");
    assert.ok(summary.preservedEntities.placement_sessions > 0, "Sessions must be preserved");
});

test("Placement Reset Transactional Execution & Idempotency - test-isolated synthetic dataset", async () => {
    const pool = getPool();
    const client = await pool.connect();

    try {
        // Begin isolated test transaction
        await client.query("BEGIN");

        // 1. Create synthetic placement dataset inside transaction
        const compRes = await client.query(`
            INSERT INTO companies (id, company_name, industry, location, is_active)
            VALUES (gen_random_uuid(), 'Synthetic Test Corp', 'Technology', 'TestCity', true)
            RETURNING id
        `);
        const syntheticCompanyId = compRes.rows[0].id;

        const adminRes = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        const adminId = adminRes.rows[0].id;

        const driveRes = await client.query(`
            INSERT INTO placement_drives (
                id, company_id, job_title, job_type, package, location,
                eligible_branches, minimum_cgpa, graduation_year, application_start_date,
                application_deadline, drive_date, is_active, created_by
            )
            VALUES (
                gen_random_uuid(), $1, 'Synthetic Test Engineer', 'full-time', 12.00, 'TestCity',
                ARRAY['CSE'], 6.00, 2026, now(), now() + interval '7 days', now() + interval '14 days', true, $2
            )
            RETURNING id
        `, [syntheticCompanyId, adminId]);
        const syntheticDriveId = driveRes.rows[0].id;

        const studentRes = await client.query("SELECT id, user_id FROM student_profiles LIMIT 1");
        const studentId = studentRes.rows[0].id;
        const studentUserId = studentRes.rows[0].user_id;

        const appRes = await client.query(`
            INSERT INTO applications (
                id, student_id, placement_drive_id, status, applied_at
            )
            VALUES (gen_random_uuid(), $1, $2, 'applied', now())
            RETURNING id
        `, [studentId, syntheticDriveId]);
        const syntheticAppId = appRes.rows[0].id;

        await client.query(`
            INSERT INTO reminder_jobs (
                id, drive_id, idempotency_key, offset_hours, scheduled_time, drive_deadline, status
            )
            VALUES (gen_random_uuid(), $1, 'synthetic_test_job_1', 6, now() + interval '1 hour', now() + interval '7 days', 'PENDING')
        `, [syntheticDriveId]);

        await client.query(`
            INSERT INTO notifications (
                id, user_id, title, message, type, application_id, company_name, job_title
            )
            VALUES (gen_random_uuid(), $1, 'Test Drive Alert', 'Synthetic notification', 'status_update', $2, 'Synthetic Test Corp', 'Synthetic Test Engineer')
        `, [studentUserId, syntheticAppId]);

        // Mark student as placed for test verification
        await client.query(`
            UPDATE student_profiles
            SET is_placed = true, placed_company = 'Synthetic Test Corp', placed_package = 12.00
            WHERE id = $1
        `, [studentId]);

        // 2. Run reset within this isolated transaction
        const resetSummary = await PlacementDataResetService.executeReset({
            environment: "test",
            confirm: PlacementDataResetService.CONFIRMATION_TOKEN,
            backupDir: "backups/test"
        }, client);

        assert.equal(resetSummary.mode, "COMMITTED");
        assert.ok(resetSummary.postResetIntegrityCheck?.usersPreserved);
        assert.ok(resetSummary.postResetIntegrityCheck?.studentsPreserved);
        assert.ok(resetSummary.postResetIntegrityCheck?.adminsPreserved);
        assert.ok(resetSummary.postResetIntegrityCheck?.departmentsPreserved);

        // 3. Verify target placement records were removed
        const checkDrives = await client.query("SELECT COUNT(*)::int AS count FROM placement_drives");
        const checkApps = await client.query("SELECT COUNT(*)::int AS count FROM applications");
        const checkCompanies = await client.query("SELECT COUNT(*)::int AS count FROM companies");
        const checkReminders = await client.query("SELECT COUNT(*)::int AS count FROM reminder_jobs");

        assert.equal(checkDrives.rows[0].count, 0, "All placement drives must be removed");
        assert.equal(checkApps.rows[0].count, 0, "All applications must be removed");
        assert.equal(checkCompanies.rows[0].count, 0, "All companies must be removed");
        assert.equal(checkReminders.rows[0].count, 0, "All reminder jobs must be removed");

        // 4. Verify student placed status was reset
        const checkStudent = await client.query("SELECT is_placed, placed_company, placed_package FROM student_profiles WHERE id = $1", [studentId]);
        assert.equal(checkStudent.rows[0].is_placed, false, "Student is_placed must be reset to false");
        assert.equal(checkStudent.rows[0].placed_company, "", "Student placed_company must be empty");
        assert.equal(checkStudent.rows[0].placed_package, null, "Student placed_package must be null");

        // 5. Verify core entities are intact
        const checkUsers = await client.query("SELECT COUNT(*)::int AS count FROM users");
        const checkStudents = await client.query("SELECT COUNT(*)::int AS count FROM student_profiles");
        const checkAdmins = await client.query("SELECT COUNT(*)::int AS count FROM admins");
        const checkDepts = await client.query("SELECT COUNT(*)::int AS count FROM departments");

        assert.ok(checkUsers.rows[0].count >= 2, "Users must remain in database");
        assert.ok(checkStudents.rows[0].count >= 1, "Students must remain in database");
        assert.ok(checkAdmins.rows[0].count >= 1, "Admins must remain in database");
        assert.ok(checkDepts.rows[0].count >= 13, "Departments must remain in database");

        // 6. Test Idempotency: execute reset a second time
        const idempotentSummary = await PlacementDataResetService.executeReset({
            environment: "test",
            confirm: PlacementDataResetService.CONFIRMATION_TOKEN,
            backupDir: "backups/test"
        }, client);

        assert.equal(idempotentSummary.tablesToDelete.placement_drives, 0, "Idempotent run deletes 0 drives");
        assert.equal(idempotentSummary.tablesToDelete.companies, 0, "Idempotent run deletes 0 companies");
        assert.equal(idempotentSummary.tablesToDelete.applications, 0, "Idempotent run deletes 0 applications");

    } finally {
        // ALWAYS roll back test transaction so database remains 100% clean and untouched
        await client.query("ROLLBACK");
        client.release();
    }
});
