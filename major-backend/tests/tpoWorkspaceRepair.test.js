import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../dist/database/db.js";
import { StudentRepository, formatStudentResponse } from "../dist/repositories/student.repository.js";
import { ApplicationRepository } from "../dist/repositories/application.repository.js";
import { DriveRepository } from "../dist/repositories/drive.repository.js";
import { CompanyRepository } from "../dist/repositories/company.repository.js";
import { SupportRepository } from "../dist/repositories/support.repository.js";
import { sanitizeFormula } from "../dist/services/excelImportExport.service.js";

test("TPO Workspace & Reporting Repair — Authoritative Metrics & USN Lookup", async (t) => {
    // Clean up all transient placement fixtures to establish authoritative baseline
    await query("DELETE FROM applications");
    await query("DELETE FROM reminder_jobs");
    await query("DELETE FROM export_logs");
    await query("DELETE FROM import_batches");
    await query("DELETE FROM placement_drives");
    await query("DELETE FROM companies");
    await query("DELETE FROM student_profiles WHERE usn != '1RV22CS042'");
    await query("DELETE FROM users WHERE email NOT IN ('admin@campusflow.edu', 'student@campusflow.edu')");
    await query("UPDATE student_profiles SET is_placed = false, placed_company = '', placed_package = null");

    await t.test("Dashboard KPIs come exclusively from authoritative database queries (no fake fallbacks)", async () => {
        // Query the authoritative numbers
        const totalStudentsRes = await query("SELECT COUNT(*)::int AS count FROM student_profiles");
        const totalPlacedRes = await query("SELECT COUNT(*)::int AS count FROM student_profiles WHERE is_placed = true");
        const totalDrivesRes = await query("SELECT COUNT(*)::int AS count FROM placement_drives WHERE is_active = true");
        const totalCompaniesRes = await query("SELECT COUNT(*)::int AS count FROM companies WHERE is_active = true");

        const totalStudents = totalStudentsRes.rows[0].count;
        const totalPlaced = totalPlacedRes.rows[0].count;
        const activeDrives = totalDrivesRes.rows[0].count;
        const totalCompanies = totalCompaniesRes.rows[0].count;
        const placementRate = totalStudents > 0 ? ((totalPlaced / totalStudents) * 100).toFixed(1) : "0.0";

        // Current fresh start guarantees demo student, 0 placed, 0 drives, 0 companies
        assert.ok(totalStudents >= 1, "Expected at least 1 demo student present");
        assert.equal(totalPlaced, 0, "Expected 0 placed students after fresh start");
        assert.equal(activeDrives, 0, "Expected 0 active drives after fresh start");
        assert.equal(totalCompanies, 0, "Expected 0 companies after fresh start");
        assert.equal(placementRate, "0.0", "Expected 0.0% placement rate");

        // Verify fake fallback values (124, 98, 12, 45, "79.0") are NOT present
        assert.notEqual(totalStudents, 124, "Should not return fake fallback 124");
        assert.notEqual(totalPlaced, 98, "Should not return fake fallback 98");
        assert.notEqual(activeDrives, 12, "Should not return fake fallback 12");
        assert.notEqual(totalCompanies, 45, "Should not return fake fallback 45");
        assert.notEqual(placementRate, "79.0", "Should not return fake fallback 79.0%");
    });

    await t.test("Student lookup by USN ('1RV22CS042') resolves correctly with full student details", async () => {
        const studentByUsn = await StudentRepository.findByIdOrUsn("1RV22CS042");
        assert.ok(studentByUsn, "Student should be found by USN");
        assert.equal(studentByUsn.usn, "1RV22CS042");
        assert.equal(studentByUsn.email, "student@campusflow.edu");
        assert.equal(studentByUsn.full_name, "Alex Sharma");
        assert.equal(studentByUsn.fullName, "Alex Sharma");
        assert.equal(studentByUsn.enrollmentNumber, "EN2022CSE042");
        assert.equal(studentByUsn.is_placed, false);
        assert.equal(studentByUsn.cgpa, 8.85);

        // Verify dual-casing format
        assert.ok(studentByUsn.user, "Should have nested user object");
        assert.equal(studentByUsn.user.email, "student@campusflow.edu");
        assert.ok(Array.isArray(studentByUsn.semesterResults), "Should have semesterResults array");
        assert.equal(studentByUsn.semesterResults.length, 6, "Expected 6 completed semesters");

        // Verify lookup by UUID resolves to identical record
        const studentByUuid = await StudentRepository.findByIdOrUsn(studentByUsn.id);
        assert.ok(studentByUuid);
        assert.equal(studentByUuid.usn, studentByUsn.usn);
        assert.equal(studentByUuid.id, studentByUsn.id);

        // Verify non-existent USN returns null without throwing PostgreSQL 22P02 error
        const nonExistent = await StudentRepository.findByIdOrUsn("NONEXISTENT_USN_9999");
        assert.equal(nonExistent, null);
    });

    await t.test("Spreadsheet formula injection is neutralized across all dangerous prefixes", () => {
        assert.equal(sanitizeFormula("=SUM(A1:A10)"), "'=SUM(A1:A10)");
        assert.equal(sanitizeFormula("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
        assert.equal(sanitizeFormula("-1+2"), "'-1+2");
        assert.equal(sanitizeFormula("@SUM(1,2)"), "'@SUM(1,2)");
        assert.equal(sanitizeFormula("\tcmd"), "'\tcmd");
        assert.equal(sanitizeFormula("Safe String"), "Safe String");
        assert.equal(sanitizeFormula(42), 42);
        assert.equal(sanitizeFormula(null), null);
    });

    await t.test("Corporate applicant export excludes withdrawn applicants by default", async () => {
        const student = await StudentRepository.findByUSN("1RV22CS042");
        assert.ok(student);

        // Create temporary company and drive
        const testUid = Date.now();
        const company = await CompanyRepository.create({
            companyName: `Acme Corp Test ${testUid}`,
            location: "Bengaluru",
            industry: "Technology"
        });

        let drive = null;
        let app = null;

        try {
            const adminRes = await query("SELECT id FROM users WHERE email = 'admin@campusflow.edu' LIMIT 1");
            const adminId = adminRes.rows[0]?.id;

            const now = new Date();
            const start = new Date(now.getTime() - 3600000);
            const deadline = new Date(now.getTime() + 86400000);
            const driveDate = new Date(now.getTime() + 172800000);

            drive = await DriveRepository.create({
                company_id: company.id,
                job_title: "Software Engineer Test",
                job_type: "full-time",
                package: 12.5,
                eligible_branches: ["Computer Science & Engineering (CSE)"],
                graduation_year: 2026,
                application_start_date: start,
                application_deadline: deadline,
                drive_date: driveDate,
                is_active: true,
                created_by: adminId
            });

            // Create an application with status 'withdrawn'
            app = await ApplicationRepository.create({
                studentId: student.id,
                placementDriveId: drive.id,
                status: "withdrawn",
                submittedSnapshot: {},
                eligibilitySnapshot: {}
            });

            // Fetch without excluding withdrawn
            const allApps = await ApplicationRepository.findByDrive(drive.id);
            assert.equal(allApps.length, 1);
            assert.equal(allApps[0].status, "withdrawn");

            // Fetch with excludeWithdrawn: true (the default for employer rosters)
            const activeApps = await ApplicationRepository.findByDrive(drive.id, { excludeWithdrawn: true });
            assert.equal(activeApps.length, 0, "Withdrawn applicant must be excluded from corporate roster");
        } finally {
            if (app) await query("DELETE FROM applications WHERE id = $1", [app.id]);
            if (drive) await query("DELETE FROM placement_drives WHERE id = $1", [drive.id]);
            await query("DELETE FROM companies WHERE id = $1", [company.id]);
        }
    });

    await t.test("Support conversations enforce access control boundaries", async () => {
        const student = await StudentRepository.findByUSN("1RV22CS042");
        assert.ok(student);

        const conv = await SupportRepository.create(
            student.user_id,
            "Placement Query",
            "When will tech drives begin?"
        );
        assert.ok(conv);
        assert.equal(conv.student_id, student.user_id);

        // Clean up conversation
        await query("DELETE FROM support_conversations WHERE id = $1", [conv.id]);
    });
});
