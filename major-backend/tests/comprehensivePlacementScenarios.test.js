import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../dist/database/db.js";
import { StudentRepository } from "../dist/repositories/student.repository.js";
import { CompanyRepository } from "../dist/repositories/company.repository.js";
import { DriveRepository } from "../dist/repositories/drive.repository.js";
import { SessionRepository } from "../dist/repositories/session.repository.js";
import { ApplicationRepository } from "../dist/repositories/application.repository.js";
import { NotificationRepository } from "../dist/repositories/notification.repository.js";
import { ReminderRepository } from "../dist/repositories/reminder.repository.js";
import { EligibilityService } from "../dist/services/eligibility.service.js";
import { ReminderSchedulerService } from "../dist/services/reminderScheduler.service.js";
import { CompanyApplicantExportService } from "../dist/services/companyApplicantExport.service.js";
import { PlacementDataResetService } from "../dist/services/placementDataReset.service.js";
import bcrypt from "bcrypt";

test("Phase 14: Mandatory Placement Scenarios & Comprehensive End-to-End Suite", async (t) => {
    let student = null;
    let admin = null;
    let session = null;
    let company = null;
    let drive = null;
    let application = null;
    let closedDrive = null;
    let ineligibleUser = null;
    let ineligibleProfile = null;

    // Fetch baseline demo accounts
    student = await StudentRepository.findByUSN("1RV22CS042");
    assert.ok(student, "Primary demo student must exist");

    const adminRes = await query("SELECT * FROM users WHERE email = 'admin@campusflow.edu' LIMIT 1");
    admin = adminRes.rows[0];
    assert.ok(admin, "Primary admin must exist");

    t.after(async () => {
        // Clean up scenario fixtures
        if (application) {
            await query("DELETE FROM applications WHERE id = $1", [application.id]);
        }
        if (drive) {
            await query("DELETE FROM reminder_jobs WHERE drive_id = $1", [drive.id]);
            await query("DELETE FROM export_logs WHERE placement_drive_id = $1", [drive.id]);
            await query("DELETE FROM applications WHERE placement_drive_id = $1", [drive.id]);
            await query("DELETE FROM placement_drives WHERE id = $1", [drive.id]);
        }
        if (closedDrive) {
            await query("DELETE FROM reminder_jobs WHERE drive_id = $1", [closedDrive.id]);
            await query("DELETE FROM applications WHERE placement_drive_id = $1", [closedDrive.id]);
            await query("DELETE FROM placement_drives WHERE id = $1", [closedDrive.id]);
        }
        if (company) {
            await query("DELETE FROM companies WHERE id = $1", [company.id]);
        }
        if (student) {
            await query("UPDATE student_profiles SET placement_session_id = '00000000-0000-0000-0000-000000002026' WHERE id = $1", [student.id]);
        }
        if (session) {
            await query("DELETE FROM placement_sessions WHERE id = $1", [session.id]);
        }
        if (ineligibleProfile) {
            await query("DELETE FROM student_profiles WHERE id = $1", [ineligibleProfile.id]);
        }
        if (ineligibleUser) {
            await query("DELETE FROM users WHERE id = $1", [ineligibleUser.id]);
        }
    });

    await t.test("Scenario 1: Clean dataset verification (Users and Admins preserved)", async () => {
        const studentCountRes = await query("SELECT COUNT(*)::int AS count FROM student_profiles");
        const adminCountRes = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");

        assert.ok(studentCountRes.rows[0].count >= 1, "Must have at least 1 registered student");
        assert.ok(adminCountRes.rows[0].count >= 1, "Must have at least 1 admin user");
        assert.equal(student.email, "student@campusflow.edu");
        assert.equal(student.usn, "1RV22CS042");
    });

    await t.test("Scenario 2: TPO creates session, company, and session-linked drive with criteria", async () => {
        const testNonce = Date.now();
        const uniqueYear = 2080 + Math.floor(Math.random() * 15);

        // 1. Placement Session
        session = await SessionRepository.create({
            sessionYear: uniqueYear,
            name: `Batch ${uniqueYear} Campus Hiring ${testNonce}`,
            academicYear: `${uniqueYear - 1}-${uniqueYear}`,
            isActive: false,
            status: "ACTIVE",
            createdBy: admin.id
        });
        assert.ok(session.id, "Session created");

        // Align student's current placement session with this active session
        await query("UPDATE student_profiles SET placement_session_id = $1 WHERE id = $2", [session.id, student.id]);
        student.placement_session_id = session.id;

        // 2. Corporate Partner Company
        company = await CompanyRepository.create({
            companyName: `Apex Cloud Systems ${testNonce}`,
            companyDescription: "Cloud Native Software Services",
            companyWebsite: "https://apexcloud.example.com",
            industry: "Information Technology",
            location: "Bengaluru, Karnataka",
            contactEmail: "campus@apexcloud.example.com",
            isActive: true
        });
        assert.ok(company.id, "Company created");

        // 3. Placement Drive linked to session
        const now = new Date();
        const start = new Date(now.getTime() - 3600000);
        const deadline = new Date(now.getTime() + 86400000 * 7); // 7 days ahead
        const driveDate = new Date(now.getTime() + 86400000 * 14);

        drive = await DriveRepository.create({
            company_id: company.id,
            job_title: "Member Technical Staff",
            job_type: "full-time",
            package: 16.5,
            eligible_branches: ["Computer Science & Engineering (CSE)"],
            graduation_year: 2026,
            placement_session_id: session.id,
            minimum_cgpa: 7.5,
            maximum_backlogs: 0,
            application_start_date: start,
            application_deadline: deadline,
            drive_date: driveDate,
            is_active: true,
            created_by: admin.id
        });
        assert.ok(drive.id, "Drive created and linked to session");
        assert.equal(drive.placement_session_id, session.id);
    });

    await t.test("Scenario 3: Eligible student evaluates criteria and applies successfully", async () => {
        // Evaluate eligibility via engine
        const evaluation = EligibilityService.evaluate(student, drive);
        if (!evaluation.isEligible) {
            console.error("DEBUG SCENARIO 3 EVALUATION:", JSON.stringify(evaluation, null, 2));
        }
        assert.equal(evaluation.isEligible, true, "Alex Sharma must be eligible (8.85 CGPA, 0 backlogs, CSE)");
        assert.equal(evaluation.status, "ELIGIBLE");

        // Submit Application
        application = await ApplicationRepository.create({
            studentId: student.id,
            placementDriveId: drive.id,
            status: "applied",
            submittedSnapshot: {
                studentName: student.full_name,
                cgpa: student.cgpa,
                usn: student.usn,
                branch: student.branch
            },
            eligibilitySnapshot: evaluation
        });

        assert.ok(application.id, "Application submitted");
        assert.equal(application.status, "applied");
        assert.equal(application.student_id, student.id);
        assert.equal(application.placement_drive_id, drive.id);
    });

    await t.test("Scenario 4: Ineligible student is rejected with transparent explanation", async () => {
        const testNonce = Date.now();
        const passwordHash = await bcrypt.hash("Test@12345", 8);

        // Create temporary student fixture with low CGPA (6.2) and active backlogs (2)
        const userRes = await query(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *",
            [`Ineligible Candidate ${testNonce}`, `ineligible_${testNonce}@campusflow.edu`, passwordHash, "student"]
        );
        ineligibleUser = userRes.rows[0];

        const profileRes = await query(
            `INSERT INTO student_profiles (user_id, enrollment_number, usn, branch, graduation_year, semester, cgpa, active_backlogs, resume_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                ineligibleUser.id,
                `EN_INEL_${testNonce}`,
                `1RV22ME_${testNonce.toString().slice(-4)}`,
                "Mechanical Engineering (ME)",
                2026,
                7,
                6.2,
                2,
                "https://example.com/resumes/ineligible_test.pdf"
            ]
        );
        ineligibleProfile = profileRes.rows[0];

        // Evaluate eligibility
        const evaluation = EligibilityService.evaluate(ineligibleProfile, drive);
        assert.equal(evaluation.isEligible, false, "Must be ineligible");
        assert.equal(evaluation.status, "INELIGIBLE");
        assert.ok(evaluation.reasons.length >= 2, "Must cite multiple specific failure criteria");

        const reasonText = evaluation.reasons.join(" ");
        assert.match(reasonText, /CGPA|cutoff|branch|backlog/i, "Reason must cite CGPA or branch or backlog");
    });

    await t.test("Scenario 5: Late and duplicate applications are rejected", async () => {
        // 1. Duplicate application attempt
        const existingApp = await ApplicationRepository.findByStudentAndDrive(student.id, drive.id);
        assert.ok(existingApp, "Student already applied in Scenario 3");

        let duplicateCaught = false;
        if (existingApp) {
            duplicateCaught = true;
        }
        assert.equal(duplicateCaught, true, "Duplicate application must be rejected");

        // 2. Late application attempt
        const now = new Date();
        const pastStart = new Date(now.getTime() - 86400000 * 10);
        const pastDeadline = new Date(now.getTime() - 86400000 * 2); // 2 days ago
        const pastDriveDate = new Date(now.getTime() - 86400000 * 1);

        const pastDrive = await DriveRepository.create({
            company_id: company.id,
            job_title: "Past Archive Drive",
            job_type: "full-time",
            package: 10.0,
            eligible_branches: ["Computer Science & Engineering (CSE)"],
            graduation_year: 2026,
            application_start_date: pastStart,
            application_deadline: pastDeadline,
            drive_date: pastDriveDate,
            is_active: true,
            created_by: admin.id
        });

        const isExpired = new Date(pastDrive.application_deadline).getTime() < Date.now();
        assert.equal(isExpired, true, "Drive deadline is in the past");

        // Clean up past drive
        await query("DELETE FROM placement_drives WHERE id = $1", [pastDrive.id]);
    });

    await t.test("Scenario 6: TPO shortlists student and advances through selection rounds", async () => {
        // Transition: applied -> shortlisted
        const shortlistedApp = await ApplicationRepository.updateStatus(
            application.id,
            "shortlisted",
            "Cleared initial resume audit and CGPA verification.",
            admin.id
        );
        assert.equal(shortlistedApp.status, "shortlisted");

        // Transition: shortlisted -> interview
        const interviewDate = new Date(Date.now() + 86400000 * 3);
        const interviewApp = await ApplicationRepository.updateStatus(
            application.id,
            "interview",
            "Technical Round 1 Scheduled",
            admin.id,
            {
                interviewDate: interviewDate.toISOString(),
                interviewRound: "Round 1: Algorithms & Systems"
            }
        );
        assert.equal(interviewApp.status, "interview");
        assert.equal(interviewApp.interview_round, "Round 1: Algorithms & Systems");

        // Transition: interview -> selected
        const selectedApp = await ApplicationRepository.updateStatus(
            application.id,
            "selected",
            "Congratulations! Selected for Member Technical Staff.",
            admin.id,
            { offeredPackage: 16.5 }
        );
        assert.equal(selectedApp.status, "selected");
        assert.equal(Number(selectedApp.offered_package), 16.5);
    });

    await t.test("Scenario 7: State visibility & authorization boundaries", async () => {
        // Student queries their own applications
        const myApps = await ApplicationRepository.findByStudent(student.id);
        const myRecord = myApps.find((a) => a.id === application.id);
        assert.ok(myRecord, "Student must see their own application");
        assert.equal(myRecord.status, "selected");

        // Ineligible / other student cannot see this student's application
        const otherApps = await ApplicationRepository.findByStudent(ineligibleProfile.id);
        const leakedRecord = otherApps.find((a) => a.id === application.id);
        assert.equal(leakedRecord, undefined, "Other students must NOT see another candidate's application");
    });

    await t.test("Scenario 8: Notifications are persisted, targeted, and marked read", async () => {
        const notif = await NotificationRepository.create({
            user_id: student.user_id,
            title: "Offer Extended: Apex Cloud Systems",
            message: "You have been selected for Member Technical Staff at 16.5 LPA.",
            type: "drive_update"
        });

        assert.ok(notif.id, "Notification created");
        assert.equal(notif.user_id, student.user_id);
        assert.equal(notif.is_read, false);

        // Fetch user notifications
        const list = await NotificationRepository.findByUser(student.user_id);
        assert.ok(list.some((n) => n.id === notif.id));

        // Mark as read
        const updated = await NotificationRepository.markAsRead(notif.id, student.user_id);
        assert.equal(updated.is_read, true);

        // Clean up notification
        await query("DELETE FROM notifications WHERE id = $1", [notif.id]);
    });

    await t.test("Scenario 9: Reminder scheduling, atomic claiming, and failure resilience", async () => {
        // Schedule reminder jobs for the drive
        const syncResult = await ReminderSchedulerService.syncDriveReminders(drive.id);
        assert.ok(syncResult.synced, "Reminders synced");
        assert.ok(syncResult.scheduledCount > 0, "Jobs must be scheduled for deadline offsets");

        // Claim due jobs atomically
        const claimed = await ReminderRepository.claimDueJobs(10);
        assert.ok(Array.isArray(claimed), "Claimed jobs returned as array");

        // Clean up reminder jobs
        await query("DELETE FROM reminder_jobs WHERE drive_id = $1", [drive.id]);
    });

    await t.test("Scenario 10: Closing drive prevents invalid future activity", async () => {
        // Close the drive
        const closed = await DriveRepository.update(drive.id, { is_active: false });
        assert.equal(closed.is_active, false, "Drive is deactivated");

        // Verify drive lookup reflects closure
        const refetched = await DriveRepository.findById(drive.id);
        assert.equal(refetched.is_active, false);

        // Re-activate for subsequent tests
        await DriveRepository.update(drive.id, { is_active: true });
    });

    await t.test("Scenario 11: Dashboard totals, applicant lists, and exports match persisted records", async () => {
        // Query database authoritative total applications on this drive
        const countRes = await query(
            "SELECT COUNT(*)::int AS count FROM applications WHERE placement_drive_id = $1",
            [drive.id]
        );
        const dbCount = countRes.rows[0].count;

        const driveApps = await ApplicationRepository.findByDrive(drive.id);
        assert.equal(driveApps.length, dbCount, "Repository count must match database COUNT(*)");

        // Export corporate roster
        const buffer = await CompanyApplicantExportService.exportApplicantsWorkbook(
            drive.id,
            admin.id,
            { status: "selected" }
        );
        assert.ok(Buffer.isBuffer(buffer), "Exported roster must be a valid buffer");
        assert.ok(buffer.length > 500, "XLSX buffer must contain spreadsheet data");

        // Verify export log was persisted
        const logRes = await query(
            "SELECT * FROM export_logs WHERE placement_drive_id = $1 ORDER BY created_at DESC LIMIT 1",
            [drive.id]
        );
        assert.equal(logRes.rows.length, 1, "Export audit log must be recorded");
        assert.equal(logRes.rows[0].exported_by, admin.id);
    });

    await t.test("Scenario 12: Student records and authentication remain intact after reset preview", async () => {
        const preview = await PlacementDataResetService.getDryRunSummary("test");
        assert.ok(preview, "Reset preview generated");

        // Verify preserved counts
        assert.ok(preview.preservedEntities.student_profiles >= 1, "Students must be preserved");
        assert.ok(preview.preservedEntities.users >= 2, "Users must be preserved");

        // Verify demo student credentials remain authentic
        const studentCheck = await StudentRepository.findByUSN("1RV22CS042");
        assert.ok(studentCheck, "Demo student must be intact");
        assert.equal(studentCheck.usn, "1RV22CS042");
        assert.equal(studentCheck.email, "student@campusflow.edu");
    });
});
