import test from "node:test";
import assert from "node:assert/strict";
import { getPool } from "../dist/database/db.js";

test("Database Stabilization - enforces case-insensitive unique email", async () => {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const testEmail = `stabilization_test_${Date.now()}@campusflow.edu`;

        await client.query(
            "INSERT INTO users (id, full_name, email, password_hash, role) VALUES (gen_random_uuid(), 'Test Upper', $1, 'hash', 'student')",
            [testEmail.toUpperCase()]
        );

        // Attempt duplicate insertion in lowercase
        let threw = false;
        try {
            await client.query(
                "INSERT INTO users (id, full_name, email, password_hash, role) VALUES (gen_random_uuid(), 'Test Lower', $1, 'hash', 'student')",
                [testEmail.toLowerCase()]
            );
        } catch (err) {
            threw = true;
            assert.equal(err.code, "23505", "Must throw unique constraint violation (23505)");
        }

        assert.equal(threw, true, "Case-insensitive duplicate email must be rejected by database");
    } finally {
        await client.query("ROLLBACK");
        client.release();
    }
});

test("Database Stabilization - enforces case-insensitive unique USN", async () => {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const userRes = await client.query(
            "INSERT INTO users (id, full_name, email, password_hash, role) VALUES (gen_random_uuid(), 'USN Test User 1', $1, 'hash', 'student') RETURNING id",
            [`usn_user_1_${Date.now()}@campusflow.edu`]
        );
        const user2Res = await client.query(
            "INSERT INTO users (id, full_name, email, password_hash, role) VALUES (gen_random_uuid(), 'USN Test User 2', $1, 'hash', 'student') RETURNING id",
            [`usn_user_2_${Date.now()}@campusflow.edu`]
        );

        const testUsn = `1RV26CS${Math.floor(100 + Math.random() * 899)}`;

        await client.query(`
            INSERT INTO student_profiles (
                id, user_id, enrollment_number, usn, branch, graduation_year, semester
            )
            VALUES (gen_random_uuid(), $1, $2, $3, 'CSE', 2026, 7)
        `, [userRes.rows[0].id, `EN_${Date.now()}_1`, testUsn.toUpperCase()]);

        // Attempt duplicate USN in lowercase
        let threw = false;
        try {
            await client.query(`
                INSERT INTO student_profiles (
                    id, user_id, enrollment_number, usn, branch, graduation_year, semester
                )
                VALUES (gen_random_uuid(), $1, $2, $3, 'CSE', 2026, 7)
            `, [user2Res.rows[0].id, `EN_${Date.now()}_2`, testUsn.toLowerCase()]);
        } catch (err) {
            threw = true;
            assert.equal(err.code, "23505", "Must throw unique constraint violation (23505)");
        }

        assert.equal(threw, true, "Case-insensitive duplicate USN must be rejected by database");
    } finally {
        await client.query("ROLLBACK");
        client.release();
    }
});

test("Database Stabilization - enforces single active placement session constraint", async () => {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // First, check existing active session
        const activeCheck = await client.query("SELECT id FROM placement_sessions WHERE is_active = true LIMIT 1");
        assert.ok(activeCheck.rows.length <= 1, "There can be at most one active session initially");

        if (activeCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO placement_sessions (
                    id, session_year, name, academic_year, is_active, status
                )
                VALUES (gen_random_uuid(), 2098, '2098-2099', '2098-2099', true, 'ACTIVE')
            `);
        }

        // Attempt to insert a second active session
        let threw = false;
        try {
            await client.query(`
                INSERT INTO placement_sessions (
                    id, session_year, name, academic_year, is_active, status
                )
                VALUES (gen_random_uuid(), 2099, '2099-2100', '2099-2100', true, 'ACTIVE')
            `);
        } catch (err) {
            threw = true;
            assert.equal(err.code, "23505", "Must violate idx_single_active_session partial unique index");
        }

        assert.equal(threw, true, "Database must reject creating multiple active sessions simultaneously");
    } finally {
        await client.query("ROLLBACK");
        client.release();
    }
});

test("Database Stabilization - enforces CGPA range constraints (0.00 to 10.00)", async () => {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const userRes = await client.query(
            "INSERT INTO users (id, full_name, email, password_hash, role) VALUES (gen_random_uuid(), 'CGPA Test', $1, 'hash', 'student') RETURNING id",
            [`cgpa_test_${Date.now()}@campusflow.edu`]
        );

        // Attempt invalid CGPA = 11.5
        let threw = false;
        try {
            await client.query(`
                INSERT INTO student_profiles (
                    id, user_id, enrollment_number, usn, branch, graduation_year, semester, cgpa
                )
                VALUES (gen_random_uuid(), $1, $2, $3, 'CSE', 2026, 7, 11.50)
            `, [userRes.rows[0].id, `EN_CGPA_${Date.now()}`, `1RV26CS${Math.floor(100 + Math.random() * 899)}`]);
        } catch (err) {
            threw = true;
            assert.equal(err.code, "23514", "Must violate check_valid_cgpa constraint (23514)");
        }

        assert.equal(threw, true, "Invalid CGPA > 10.00 must be rejected by database");
    } finally {
        await client.query("ROLLBACK");
        client.release();
    }
});

test("Database Stabilization - enforces placement drive application deadline order", async () => {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const compRes = await client.query("SELECT id FROM companies LIMIT 1");
        const companyId = compRes.rows[0]?.id;
        const adminRes = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        const adminId = adminRes.rows[0]?.id;

        if (!companyId || !adminId) {
            return; // Skip if no seed company
        }

        // Attempt deadline earlier than start_date
        let threw = false;
        try {
            await client.query(`
                INSERT INTO placement_drives (
                    id, company_id, job_title, job_type, package, location,
                    eligible_branches, minimum_cgpa, graduation_year,
                    application_start_date, application_deadline, drive_date, is_active, created_by
                )
                VALUES (
                    gen_random_uuid(), $1, 'Invalid Deadline Drive', 'full-time', 15.00, 'TestCity',
                    ARRAY['CSE'], 7.00, 2026,
                    now() + interval '5 days', now() + interval '2 days', now() + interval '10 days',
                    true, $2
                )
            `, [companyId, adminId]);
        } catch (err) {
            threw = true;
            assert.equal(err.code, "23514", "Must violate check_drive_deadline_order constraint (23514)");
        }

        assert.equal(threw, true, "Drive with deadline earlier than start date must be rejected");
    } finally {
        await client.query("ROLLBACK");
        client.release();
    }
});
