import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../dist/database/db.js";
import { ApplicationRepository } from "../dist/repositories/application.repository.js";
import { DriveRepository } from "../dist/repositories/drive.repository.js";
import { CompanyRepository } from "../dist/repositories/company.repository.js";
import { StudentRepository } from "../dist/repositories/student.repository.js";
import { LEGAL_TRANSITIONS } from "../dist/constants/appConstants.js";

test("Placement Pipeline - State Machine & Authorized Workflow Transitions", async (t) => {
    // 1. Verify Legal Transitions Integrity
    await t.test("State transitions define permitted recruiter progression paths", () => {
        assert.ok(LEGAL_TRANSITIONS.applied.includes("shortlisted"));
        assert.ok(LEGAL_TRANSITIONS.shortlisted.includes("interview"));
        assert.ok(LEGAL_TRANSITIONS.interview.includes("selected"));
        assert.ok(LEGAL_TRANSITIONS.selected.includes("offer_received"));
        assert.ok(LEGAL_TRANSITIONS.offer_received.includes("offer_accepted"));
        assert.ok(LEGAL_TRANSITIONS.offer_received.includes("offer_declined"));
        
        // Disallow direct invalid jumps
        assert.ok(!LEGAL_TRANSITIONS.applied.includes("offer_accepted"), "Cannot jump directly from applied to offer_accepted");
        assert.ok(!LEGAL_TRANSITIONS.withdrawn.includes("selected"), "Withdrawn cannot transition to selected");
    });
});

test("Placement Pipeline - End-to-End Application, Recruiter Actions & Placement Sync", async (t) => {
    const timestamp = Date.now();
    let company = null;
    let drive = null;
    let student = null;
    let application = null;

    try {
        const adminRes = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        const adminId = adminRes.rows[0].id;

        // Fetch a real student profile
        const studentRes = await query(`
            SELECT sp.*, u.email, u.full_name
            FROM student_profiles sp
            JOIN users u ON u.id = sp.user_id
            LIMIT 1
        `);
        student = studentRes.rows[0];

        // 1. Create a dedicated test company
        company = await CompanyRepository.create({
            companyName: `Pipeline Corp ${timestamp}`,
            industry: "Software & Cloud Services",
            location: "Bengaluru",
            createdBy: adminId
        });

        // 2. Create a published, active placement drive matching student's graduation year
        drive = await DriveRepository.create({
            company_id: company.id,
            job_title: `Full-Stack Software Engineer ${timestamp}`,
            job_type: "full-time",
            graduation_year: student.graduation_year || 2026,
            application_start_date: new Date(Date.now() - 86400000),
            application_deadline: new Date(Date.now() + 86400000 * 5),
            drive_date: new Date(Date.now() + 86400000 * 10),
            minimum_cgpa: 6.0,
            maximum_backlogs: 2,
            package: 14.50,
            location: "Bengaluru",
            eligible_branches: [student.branch || "CSE"],
            eligible_program_codes: [student.program_code || "CSE"],
            created_by: adminId
        });

        // 3. Submit initial application
        const submittedSnapshot = {
            studentProfileId: student.id,
            fullName: student.full_name,
            usn: student.usn,
            cgpa: student.cgpa,
            appliedAt: new Date().toISOString()
        };

        application = await ApplicationRepository.create({
            studentId: student.id,
            placementDriveId: drive.id,
            submittedSnapshot,
            eligibilitySnapshot: { isEligible: true, status: "ELIGIBLE" },
            status: "applied"
        });

        assert.ok(application.id, "Application must be created with ID");
        assert.equal(application.status, "applied");

        // 4. Duplicate submission prevention
        await assert.rejects(
            async () => {
                await ApplicationRepository.create({
                    studentId: student.id,
                    placementDriveId: drive.id,
                    submittedSnapshot,
                    eligibilitySnapshot: { isEligible: true, status: "ELIGIBLE" },
                    status: "applied"
                });
            },
            (err) => {
                assert.ok(err.code === "23505" || err.message.includes("unique"), "Duplicate application must be rejected by unique constraint");
                return true;
            }
        );

        // 5. Illegal transition rejection: applied directly to offer_accepted
        await assert.rejects(
            async () => {
                await ApplicationRepository.updateStatus(application.id, "offer_accepted", "Illegal fast-track offer");
            },
            (err) => {
                assert.ok(
                    err.message.includes("Cannot transition application status from 'applied' to 'offer_accepted'"),
                    `Expected illegal transition block, got: ${err.message}`
                );
                return true;
            }
        );

        // 6. Valid step-by-step pipeline progression
        // Step A: Shortlist
        let updated = await ApplicationRepository.updateStatus(
            application.id,
            "shortlisted",
            "Screened and shortlisted for Round 1",
            adminId
        );
        assert.equal(updated.status, "shortlisted");

        // Step B: Technical Interview Round 1
        updated = await ApplicationRepository.updateStatus(
            application.id,
            "interview",
            "Interview scheduled with Engineering Lead",
            adminId,
            {
                interviewRound: "Round 1 - Technical Assessment",
                interviewLocation: "Virtual Room A",
                interviewDate: new Date(Date.now() + 86400000 * 2).toISOString()
            }
        );
        assert.equal(updated.status, "interview");
        assert.equal(updated.interview_round, "Round 1 - Technical Assessment");

        // Step C: Candidate Selected
        updated = await ApplicationRepository.updateStatus(
            application.id,
            "selected",
            "Candidate cleared all interview rounds",
            adminId
        );
        assert.equal(updated.status, "selected");

        // Step D: Offer Extended
        updated = await ApplicationRepository.updateStatus(
            application.id,
            "offer_received",
            "Official offer letter dispatched",
            adminId,
            {
                offeredPackage: 15.00,
                offerDetails: { joiningBonus: "1.00 LPA", designation: "Associate Software Engineer" }
            }
        );
        assert.equal(updated.status, "offer_received");
        assert.equal(Number(updated.offered_package), 15.00);

        // Step E: Offer Accepted & Student Profile Synchronization
        updated = await ApplicationRepository.updateStatus(
            application.id,
            "offer_accepted",
            "Offer accepted by candidate",
            student.user_id
        );
        assert.equal(updated.status, "offer_accepted");

        // Verify student_profiles placed status was synchronized
        const reloadedStudent = await StudentRepository.findById(student.id);
        assert.equal(reloadedStudent.is_placed, true, "Student is_placed must be true after accepting offer");
        assert.equal(reloadedStudent.placed_company, `Pipeline Corp ${timestamp}`);
        assert.equal(Number(reloadedStudent.placed_package), 15.00);

        // Step F: Safe revocation / offer declined resets student placement metrics
        updated = await ApplicationRepository.updateStatus(
            application.id,
            "offer_declined",
            "Candidate rescinded acceptance for higher studies",
            student.user_id
        );
        assert.equal(updated.status, "offer_declined");

        const resetStudent = await StudentRepository.findById(student.id);
        assert.equal(resetStudent.is_placed, false, "Student is_placed must reset to false after offer declined");
        assert.equal(resetStudent.placed_company, "");

        // 7. Verify Status History Audit Trail
        const reloadedApp = await ApplicationRepository.findById(application.id);
        const history = reloadedApp.status_history || [];
        assert.ok(history.length >= 6, "Audit trail must preserve all intermediate transitions");
        assert.equal(history[0].toStatus, "applied");
        assert.equal(history[1].toStatus, "shortlisted");
        assert.equal(history[2].toStatus, "interview");

        // Clean up synthetic application
        await query("DELETE FROM applications WHERE id = $1", [application.id]);
        application = null;

        // Clean up drive and company
        await DriveRepository.delete(drive.id);
        drive = null;
        await CompanyRepository.delete(company.id);
        company = null;
    } finally {
        if (application?.id) {
            await query("DELETE FROM applications WHERE id = $1", [application.id]);
        }
        if (drive?.id) {
            await query("DELETE FROM applications WHERE placement_drive_id = $1", [drive.id]);
            await query("DELETE FROM placement_drives WHERE id = $1", [drive.id]);
        }
        if (company?.id) {
            await query("DELETE FROM companies WHERE id = $1", [company.id]);
        }
        if (student?.id) {
            await query("UPDATE student_profiles SET is_placed = false, placed_company = '', placed_package = NULL WHERE id = $1", [student.id]);
        }
    }
});
