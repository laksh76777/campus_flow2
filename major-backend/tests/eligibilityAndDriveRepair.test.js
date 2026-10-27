import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../dist/database/db.js";
import { EligibilityService, EligibilityStatus, CURRENT_RULE_VERSION } from "../dist/services/eligibility.service.js";
import { DriveRepository } from "../dist/repositories/drive.repository.js";
import { CompanyRepository } from "../dist/repositories/company.repository.js";

test("Eligibility Engine - Comprehensive Boundary & Criteria Evaluation", async (t) => {
    const baseDrive = {
        is_active: true,
        application_start_date: new Date(Date.now() - 86400000).toISOString(),
        application_deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
        drive_date: new Date(Date.now() + 86400000 * 10).toISOString(),
        graduation_year: 2026,
        eligible_branches: ["Computer Science & Engineering (CSE)"],
        eligible_program_codes: ["CSE"],
        minimum_cgpa: 7.50,
        check_cgpa: true,
        maximum_backlogs: 0,
        check_backlogs: true,
        check_tenth_marks: true,
        minimum_tenth_percentage: 75.0,
        check_twelfth_marks: true,
        minimum_twelfth_percentage: 75.0,
        maximum_historical_backlogs: 1,
        placement_session_id: "11111111-2222-3333-4444-555555555555"
    };

    const baseStudent = {
        id: "student-1",
        branch: "Computer Science & Engineering (CSE)",
        program_code: "CSE",
        graduation_year: 2026,
        placement_session_id: "11111111-2222-3333-4444-555555555555",
        cgpa: 7.50,
        active_backlogs: 0,
        historical_backlogs: 0,
        tenth_percentage: 80.0,
        twelfth_percentage: 80.0,
        resume_url: "https://storage.campusflow.edu/resumes/std1.pdf"
    };

    // 1. Exact CGPA Threshold Boundary
    await t.test("CGPA exact threshold (7.50 vs 7.50) is eligible", () => {
        const res = EligibilityService.evaluate(baseStudent, baseDrive);
        assert.equal(res.status, EligibilityStatus.ELIGIBLE);
        assert.equal(res.isEligible, true);
        assert.equal(res.ruleVersion, CURRENT_RULE_VERSION);
    });

    // 2. Just Below CGPA Boundary
    await t.test("CGPA just below threshold (7.49 vs 7.50) is ineligible", () => {
        const student = { ...baseStudent, cgpa: 7.49 };
        const res = EligibilityService.evaluate(student, baseDrive);
        assert.equal(res.status, EligibilityStatus.INELIGIBLE);
        assert.equal(res.isEligible, false);
        assert.ok(res.reasons.some((r) => r.includes("below minimum required")));
    });

    // 3. Just Above CGPA Boundary
    await t.test("CGPA just above threshold (7.51 vs 7.50) is eligible", () => {
        const student = { ...baseStudent, cgpa: 7.51 };
        const res = EligibilityService.evaluate(student, baseDrive);
        assert.equal(res.status, EligibilityStatus.ELIGIBLE);
        assert.equal(res.isEligible, true);
    });

    // 4. Active Backlogs
    await t.test("Active backlogs exceeding cutoff (1 vs 0 allowed) is ineligible", () => {
        const student = { ...baseStudent, active_backlogs: 1 };
        const res = EligibilityService.evaluate(student, baseDrive);
        assert.equal(res.status, EligibilityStatus.INELIGIBLE);
        assert.ok(res.reasons.some((r) => r.includes("Active backlogs")));
    });

    // 5. Historical Backlogs Ledger
    await t.test("Historical backlogs exceeding cutoff (2 vs 1 allowed) is ineligible", () => {
        const student = { ...baseStudent, historical_backlogs: 2 };
        const res = EligibilityService.evaluate(student, baseDrive);
        assert.equal(res.status, EligibilityStatus.INELIGIBLE);
        assert.ok(res.reasons.some((r) => r.includes("Historical backlogs")));
    });

    // 6. 10th Standard Cutoff
    await t.test("10th percentage below cutoff (74.9% vs 75.0%) is ineligible", () => {
        const student = { ...baseStudent, tenth_percentage: 74.9 };
        const res = EligibilityService.evaluate(student, baseDrive);
        assert.equal(res.status, EligibilityStatus.INELIGIBLE);
        assert.ok(res.reasons.some((r) => r.includes("10th percentage")));
    });

    // 7. 12th Standard Cutoff
    await t.test("12th percentage below cutoff (74.9% vs 75.0%) is ineligible", () => {
        const student = { ...baseStudent, twelfth_percentage: 74.9 };
        const res = EligibilityService.evaluate(student, baseDrive);
        assert.equal(res.status, EligibilityStatus.INELIGIBLE);
        assert.ok(res.reasons.some((r) => r.includes("12th / Diploma percentage")));
    });

    // 8. Missing Academic Information
    await t.test("Missing resume triggers MISSING_DATA status", () => {
        const student = { ...baseStudent, resume_url: null };
        const res = EligibilityService.evaluate(student, baseDrive);
        assert.equal(res.status, EligibilityStatus.MISSING_DATA);
        assert.equal(res.isEligible, false);
        assert.ok(res.missingFields.includes("Master Resume Document"));
    });

    // 9. Expired Deadline
    await t.test("Expired deadline marks candidate ineligible", () => {
        const expiredDrive = {
            ...baseDrive,
            application_deadline: new Date(Date.now() - 3600000).toISOString()
        };
        const res = EligibilityService.evaluate(baseStudent, expiredDrive);
        assert.equal(res.status, EligibilityStatus.INELIGIBLE);
        assert.ok(res.reasons.some((r) => r.includes("Application deadline has passed")));
    });

    // 10. Inactive Drive
    await t.test("Inactive drive marks candidate ineligible", () => {
        const inactiveDrive = { ...baseDrive, is_active: false };
        const res = EligibilityService.evaluate(baseStudent, inactiveDrive);
        assert.equal(res.status, EligibilityStatus.INELIGIBLE);
        assert.ok(res.reasons.some((r) => r.includes("closed or archived")));
    });

    // 11. Program Mismatch
    await t.test("Ineligible program code (MECH vs CSE) is rejected", () => {
        const student = {
            ...baseStudent,
            branch: "Mechanical Engineering",
            program_code: "MECH"
        };
        const res = EligibilityService.evaluate(student, baseDrive);
        assert.equal(res.status, EligibilityStatus.INELIGIBLE);
        assert.ok(res.reasons.some((r) => r.includes("not in the eligible programs list")));
    });

    // 12. Batch Evaluation with evaluateMany
    await t.test("evaluateMany returns coherent map of results", () => {
        const batch = [
            { ...baseStudent, id: "std-a", cgpa: 8.0 },
            { ...baseStudent, id: "std-b", cgpa: 6.0 }
        ];
        const results = EligibilityService.evaluateMany(batch, baseDrive);
        assert.equal(results.size, 2);
        assert.equal(results.get("std-a").isEligible, true);
        assert.equal(results.get("std-b").isEligible, false);
    });
});

test("Placement Drive Management - Lifecycle, Validation, and Referential Safety", async (t) => {
    const timestamp = Date.now();
    let company = null;
    let drive = null;

    try {
        // Create a temporary company
        const adminRes = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        const adminId = adminRes.rows[0].id;

        company = await CompanyRepository.create({
            companyName: `Drive Test Corp ${timestamp}`,
            industry: "Technology",
            location: "Bengaluru",
            createdBy: adminId
        });

        // 1. Rejection on deadline preceding start date
        await assert.rejects(
            async () => {
                await DriveRepository.create({
                    company_id: company.id,
                    job_title: "Test Role",
                    job_type: "full-time",
                    graduation_year: 2026,
                    application_start_date: new Date(Date.now() + 86400000 * 5),
                    application_deadline: new Date(Date.now() + 86400000 * 2), // Invalid: deadline before start
                    drive_date: new Date(Date.now() + 86400000 * 10),
                    created_by: adminId
                });
            },
            (err) => {
                assert.ok(err.message.includes("Application deadline cannot precede application start date"));
                return true;
            }
        );

        // 2. Rejection on drive date preceding deadline
        await assert.rejects(
            async () => {
                await DriveRepository.create({
                    company_id: company.id,
                    job_title: "Test Role",
                    job_type: "full-time",
                    graduation_year: 2026,
                    application_start_date: new Date(),
                    application_deadline: new Date(Date.now() + 86400000 * 5),
                    drive_date: new Date(Date.now() + 86400000 * 3), // Invalid: drive date before deadline
                    created_by: adminId
                });
            },
            (err) => {
                assert.ok(err.message.includes("Drive execution date cannot precede application deadline"));
                return true;
            }
        );

        // 3. Rejection on invalid CGPA
        await assert.rejects(
            async () => {
                await DriveRepository.create({
                    company_id: company.id,
                    job_title: "Test Role",
                    job_type: "full-time",
                    graduation_year: 2026,
                    application_start_date: new Date(),
                    application_deadline: new Date(Date.now() + 86400000 * 5),
                    drive_date: new Date(Date.now() + 86400000 * 10),
                    minimum_cgpa: 12.5, // Invalid > 10
                    created_by: adminId
                });
            },
            (err) => {
                assert.ok(err.message.includes("Minimum CGPA must be between 0.00 and 10.00"));
                return true;
            }
        );

        // 4. Valid Drive Creation
        drive = await DriveRepository.create({
            company_id: company.id,
            job_title: `Lead Systems Architect ${timestamp}`,
            job_type: "full-time",
            graduation_year: 2026,
            application_start_date: new Date(),
            application_deadline: new Date(Date.now() + 86400000 * 5),
            drive_date: new Date(Date.now() + 86400000 * 10),
            minimum_cgpa: 7.5,
            maximum_backlogs: 0,
            package: 18.0,
            location: "Bengaluru",
            eligible_branches: ["CSE", "ISE"],
            created_by: adminId
        });

        assert.ok(drive.id, "Drive must be created with ID");
        assert.equal(drive.job_title, `Lead Systems Architect ${timestamp}`);
        assert.equal(drive.is_active, true);

        // 5. Safe Archive and Reactivate
        const archived = await DriveRepository.archive(drive.id);
        assert.equal(archived.is_active, false, "Drive should be marked inactive after archiving");

        const reactivated = await DriveRepository.reactivate(drive.id);
        assert.equal(reactivated.is_active, true, "Drive should be active after reactivating");

        // 6. Block Deletion when Student Applications Exist
        const studentRes = await query("SELECT id FROM student_profiles LIMIT 1");
        const studentProfileId = studentRes.rows[0].id;
        const fakeAppId = "aaaaaaaa-aaaa-aaaa-aaaa-" + String(timestamp).slice(-12).padStart(12, "0");

        await query(
            `INSERT INTO applications (id, student_id, placement_drive_id, status)
             VALUES ($1, $2, $3, 'applied')`,
            [fakeAppId, studentProfileId, drive.id]
        );

        // Attempting to delete drive with application must be blocked
        await assert.rejects(
            async () => {
                await DriveRepository.delete(drive.id);
            },
            (err) => {
                assert.ok(
                    err.message.includes("Cannot delete placement drive with existing student applications") ||
                    err.statusCode === 400
                );
                return true;
            }
        );

        // Attempting to change core graduation year once applications exist must be blocked
        await assert.rejects(
            async () => {
                await DriveRepository.update(drive.id, { graduation_year: 2028 });
            },
            (err) => {
                assert.ok(err.message.includes("Cannot change company, graduation cohort, or session"));
                return true;
            }
        );

        // Clean up synthetic application
        await query("DELETE FROM applications WHERE id = $1", [fakeAppId]);

        // 7. Safe Deletion when 0 Applications Exist
        await DriveRepository.delete(drive.id);
        const reloaded = await DriveRepository.findById(drive.id);
        assert.equal(reloaded, null, "Drive without applications should be safely deleted");
        drive = null; // Cleaned up
    } finally {
        if (drive?.id) {
            await query("DELETE FROM applications WHERE placement_drive_id = $1", [drive.id]);
            await query("DELETE FROM placement_drives WHERE id = $1", [drive.id]);
        }
        if (company?.id) {
            await query("DELETE FROM companies WHERE id = $1", [company.id]);
        }
    }
});
