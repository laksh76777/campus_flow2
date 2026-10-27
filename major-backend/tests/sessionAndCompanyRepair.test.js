import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../dist/database/db.js";
import { SessionRepository } from "../dist/repositories/session.repository.js";
import { CompanyRepository } from "../dist/repositories/company.repository.js";

test("Session Repair - Lifecycle, duplicate prevention, and single-active session enforcement", async (t) => {
    const timestamp = Date.now();
    const uniqueYear1 = 2040 + (timestamp % 20);
    const uniqueYear2 = uniqueYear1 + 1;

    let session1;
    let session2;

    try {
        // 1. Create session 1
        session1 = await SessionRepository.create({
            sessionYear: uniqueYear1,
            name: `Session Class of ${uniqueYear1}`,
            academicYear: `${uniqueYear1 - 1}-${uniqueYear1}`,
            description: "Synthetic test placement cohort",
            isActive: true,
            status: "ACTIVE"
        });

        assert.ok(session1.id);
        assert.equal(session1.session_year, uniqueYear1);
        assert.equal(session1.is_active, true);

        // 2. Prevent duplicate session year
        await assert.rejects(
            async () => {
                await SessionRepository.create({
                    sessionYear: uniqueYear1,
                    name: `Duplicate Session ${uniqueYear1}`
                });
            },
            (err) => {
                assert.ok(
                    err.message.includes("already exists") || err.statusCode === 409 || err.code === "23505",
                    `Expected duplicate constraint rejection, received: ${err.message}`
                );
                return true;
            }
        );

        // 3. Create session 2 and activate it - must deactivate session 1
        session2 = await SessionRepository.create({
            sessionYear: uniqueYear2,
            name: `Session Class of ${uniqueYear2}`,
            academicYear: `${uniqueYear2 - 1}-${uniqueYear2}`,
            isActive: true,
            status: "ACTIVE"
        });

        const reloaded1 = await SessionRepository.findById(session1.id);
        const reloaded2 = await SessionRepository.findById(session2.id);

        assert.equal(reloaded2.is_active, true, "Newly activated session must be active");
        assert.equal(reloaded1.is_active, false, "Previous active session must be automatically deactivated");

        // 4. Close session 2
        const closed = await SessionRepository.close(session2.id);
        assert.equal(closed.is_active, false);
        assert.equal(closed.is_closed, true);
        assert.equal(closed.status, "CLOSED");

        // 5. Archive session 2
        const archived = await SessionRepository.archive(session2.id);
        assert.equal(archived.is_active, false);
        assert.equal(archived.is_archived, true);
        assert.equal(archived.status, "ARCHIVED");
    } finally {
        if (session1?.id) await query("DELETE FROM placement_sessions WHERE id = $1", [session1.id]);
        if (session2?.id) await query("DELETE FROM placement_sessions WHERE id = $1", [session2.id]);
    }
});

test("Company Repair - Creation, duplicate rejection, lifecycle, and deletion safety", async (t) => {
    const timestamp = Date.now();
    const companyName = `Synthetic Corp ${timestamp}`;

    let company;

    try {
        // 1. Create company
        company = await CompanyRepository.create({
            companyName,
            companyDescription: "Global enterprise software provider",
            companyWebsite: "https://synthetic.internal",
            industry: "Enterprise Software",
            location: "Bangalore",
            contactEmail: `recruiter_${timestamp}@synthetic.internal`,
            contactPhone: "+91 9888877777"
        });

        assert.ok(company.id);
        assert.equal(company.company_name, companyName);
        assert.equal(company.is_active, true);

        // 2. Reject duplicate company name (case-insensitive)
        await assert.rejects(
            async () => {
                await CompanyRepository.create({
                    companyName: companyName.toLowerCase(),
                    companyDescription: "Duplicate attempt"
                });
            },
            (err) => {
                assert.ok(
                    err.message.includes("already exists") || err.statusCode === 409 || err.code === "23505",
                    `Expected duplicate company rejection, received: ${err.message}`
                );
                return true;
            }
        );

        // 3. Deactivate company
        const deactivated = await CompanyRepository.deactivate(company.id);
        assert.equal(deactivated.is_active, false, "Company must be marked inactive");

        // 4. Reactivate company
        const reactivated = await CompanyRepository.reactivate(company.id);
        assert.equal(reactivated.is_active, true, "Company must be reactivated");

        // 5. Block deletion when associated with placement drives
        const adminRes = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        const adminId = adminRes.rows[0].id;
        const fakeDriveId = "dddddddd-dddd-dddd-dddd-" + String(timestamp).slice(-12).padStart(12, "0");
        await query(
            `INSERT INTO placement_drives (
                id, company_id, job_title, job_type, graduation_year, application_start_date, application_deadline, drive_date, minimum_cgpa, is_active, created_by
             )
             VALUES ($1, $2, 'Software Engineer', 'full-time', 2026, now(), now() + interval '5 days', now() + interval '10 days', 7.5, true, $3)`,
            [fakeDriveId, company.id, adminId]
        );

        await assert.rejects(
            async () => {
                await CompanyRepository.delete(company.id);
            },
            (err) => {
                assert.ok(
                    err.message.includes("Cannot delete company with associated placement drives") || err.statusCode === 400,
                    `Expected deletion block with associated drives, received: ${err.message}`
                );
                return true;
            }
        );

        // Remove synthetic drive
        await query("DELETE FROM placement_drives WHERE id = $1", [fakeDriveId]);

        // 6. Safe deletion when 0 drives are associated
        await CompanyRepository.delete(company.id);
        const reloaded = await CompanyRepository.findById(company.id);
        assert.equal(reloaded, null, "Company without drives must be safely deleted");
        company = null; // Cleaned up
    } finally {
        if (company?.id) {
            await query("DELETE FROM companies WHERE id = $1", [company.id]);
        }
    }
});
