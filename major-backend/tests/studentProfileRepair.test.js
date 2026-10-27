import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { query } from "../dist/database/db.js";
import { UserRepository } from "../dist/repositories/user.repository.js";
import { StudentRepository } from "../dist/repositories/student.repository.js";

test("Student Profile Repair - Enforces unique USN and enrollment number", async (t) => {
    const timestamp = Date.now();
    const testEmail1 = `student_profile_a_${timestamp}@testcampus.internal`;
    const testEmail2 = `student_profile_b_${timestamp}@testcampus.internal`;
    const uniqueUsn = `USN_${timestamp}`;
    const passwordHash = await bcrypt.hash("Student@123", 10);

    const user1 = await UserRepository.createUser({
        fullName: "Student One",
        email: testEmail1,
        passwordHash,
        role: "student"
    });

    const user2 = await UserRepository.createUser({
        fullName: "Student Two",
        email: testEmail2,
        passwordHash,
        role: "student"
    });

    let profile1;
    try {
        profile1 = await StudentRepository.createProfile({
            userId: user1.id,
            enrollmentNumber: `EN_${timestamp}_1`,
            usn: uniqueUsn,
            branch: "Computer Science & Engineering (CSE)",
            graduationYear: 2026,
            semester: 7
        });
        assert.ok(profile1.id);
        assert.equal(profile1.usn, uniqueUsn);

        // Attempt to create second profile with identical USN
        await assert.rejects(
            async () => {
                await StudentRepository.createProfile({
                    userId: user2.id,
                    enrollmentNumber: `EN_${timestamp}_2`,
                    usn: uniqueUsn,
                    branch: "Information Science & Engineering (ISE)",
                    graduationYear: 2026,
                    semester: 7
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
    } finally {
        if (profile1?.id) {
            await query("DELETE FROM student_profiles WHERE id = $1", [profile1.id]);
        }
        await query("DELETE FROM users WHERE id IN ($1, $2)", [user1.id, user2.id]);
    }
});

test("Student Profile Repair - Profile lock and modification request approval flow", async (t) => {
    const timestamp = Date.now();
    const testEmail = `student_mod_${timestamp}@testcampus.internal`;
    const passwordHash = await bcrypt.hash("Student@123", 10);

    const user = await UserRepository.createUser({
        fullName: "Modification Flow Tester",
        email: testEmail,
        passwordHash,
        role: "student"
    });

    let profile;
    try {
        profile = await StudentRepository.createProfile({
            userId: user.id,
            enrollmentNumber: `EN_${timestamp}_MOD`,
            usn: `USN_${timestamp}_MOD`,
            branch: "Mechanical Engineering (ME)",
            graduationYear: 2026,
            semester: 6
        });

        // 1. Lock Profile
        await StudentRepository.setProfileLock(profile.id, true);
        const lockedProfile = await StudentRepository.findById(profile.id);
        assert.equal(lockedProfile.is_profile_locked, true, "Profile must be marked locked");

        // 2. Student submits modification request
        await StudentRepository.addModificationRequest(profile.id, {
            reason: "Need to update 5th semester SGPA and active backlogs",
            fieldsToModify: ["semester_results", "backlogs", "cgpa"]
        });

        // 3. Admin retrieves modification requests
        const allRequests = await StudentRepository.getAllModificationRequests();
        const request = allRequests.find((r) => r.studentProfileId === profile.id || r.studentId === profile.id);
        assert.ok(request, "Modification request must be retrieved for admin review");
        assert.equal(request.status, "PENDING");
        assert.equal(request.reason, "Need to update 5th semester SGPA and active backlogs");

        // 4. Admin reviews and approves request
        const reviewedProfile = await StudentRepository.reviewModificationRequest(
            profile.id,
            request.id,
            "approve",
            "TPO Lead Admin",
            ""
        );

        // 5. Verify profile is unlocked and request marked APPROVED without losing identity
        assert.equal(reviewedProfile.is_profile_locked, false, "Approved profile must be unlocked");
        assert.equal(reviewedProfile.usn, `USN_${timestamp}_MOD`, "USN must remain intact");
        assert.equal(reviewedProfile.branch, "Mechanical Engineering (ME)", "Branch must remain intact");

        const updatedRequests = reviewedProfile.modification_requests;
        assert.ok(Array.isArray(updatedRequests));
        assert.equal(updatedRequests[0].status, "APPROVED");
        assert.equal(updatedRequests[0].reviewedByName, "TPO Lead Admin");
    } finally {
        if (profile?.id) {
            await query("DELETE FROM student_profiles WHERE id = $1", [profile.id]);
        }
        await query("DELETE FROM users WHERE id = $1", [user.id]);
    }
});

test("Student Profile Repair - Backlog mutation and semester result persistence", async (t) => {
    const timestamp = Date.now();
    const testEmail = `student_academic_${timestamp}@testcampus.internal`;
    const passwordHash = await bcrypt.hash("Student@123", 10);

    const user = await UserRepository.createUser({
        fullName: "Academic Record Tester",
        email: testEmail,
        passwordHash,
        role: "student"
    });

    let profile;
    try {
        profile = await StudentRepository.createProfile({
            userId: user.id,
            enrollmentNumber: `EN_${timestamp}_ACAD`,
            usn: `USN_${timestamp}_ACAD`,
            branch: "Computer Science & Engineering (CSE)",
            graduationYear: 2026,
            semester: 6
        });

        // Add semester result
        const withSemester = await StudentRepository.addSemesterResult(profile.id, {
            semesterNumber: 5,
            sgpa: 8.65,
            creditsEarned: 24,
            passed: true
        });
        assert.ok(Array.isArray(withSemester.semester_results));
        assert.equal(withSemester.semester_results.length, 1);
        assert.equal(withSemester.semester_results[0].semesterNumber, 5);
        assert.equal(withSemester.semester_results[0].sgpa, 8.65);

        // Add backlog record
        const withBacklog = await StudentRepository.addBacklogRecord(profile.id, {
            subjectCode: "CS501",
            subjectName: "Operating Systems",
            semester: 5
        });
        assert.ok(Array.isArray(withBacklog.backlog_details));
        assert.equal(withBacklog.backlog_details.length, 1);
        assert.equal(withBacklog.backlog_details[0].subjectCode, "CS501");
        assert.equal(withBacklog.active_backlogs, 1);

        // Delete backlog record
        const backlogId = withBacklog.backlog_details[0].id;
        const clearedBacklog = await StudentRepository.deleteBacklogRecord(profile.id, backlogId);
        assert.equal(clearedBacklog.backlog_details.length, 0);
        assert.equal(clearedBacklog.active_backlogs, 0);
    } finally {
        if (profile?.id) {
            await query("DELETE FROM student_profiles WHERE id = $1", [profile.id]);
        }
        await query("DELETE FROM users WHERE id = $1", [user.id]);
    }
});
