import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { UserRepository } from "../dist/repositories/user.repository.js";
import { StudentRepository } from "../dist/repositories/student.repository.js";
import { AdminRepository } from "../dist/repositories/admin.repository.js";

test("Demo Admin Account - verifies admin@campusflow.edu / Admin@12345", async () => {
    const record = await UserRepository.findByUSNorEmail("admin@campusflow.edu");
    assert.ok(record, "Demo admin account must be found");
    assert.equal(record.user.email, "admin@campusflow.edu");
    assert.equal(record.user.role, "admin");

    const isMatch = await bcrypt.compare("Admin@12345", record.user.password_hash);
    assert.equal(isMatch, true, "Admin password Admin@12345 must match bcrypt hash");

    const isWrongMatch = await bcrypt.compare("WrongPassword", record.user.password_hash);
    assert.equal(isWrongMatch, false, "Invalid password must be rejected");

    const adminProfile = await AdminRepository.findByUserId(record.user.id);
    assert.ok(adminProfile, "Admin profile must exist");
    assert.equal(adminProfile?.employee_id, "TPO-2026-001");
});

test("Demo Student Account - verifies student@campusflow.edu / Student@12345", async () => {
    const record = await UserRepository.findByUSNorEmail("student@campusflow.edu");
    assert.ok(record, "Demo student account must be found");
    assert.equal(record.user.email, "student@campusflow.edu");
    assert.equal(record.user.role, "student");

    const isMatch = await bcrypt.compare("Student@12345", record.user.password_hash);
    assert.equal(isMatch, true, "Student password Student@12345 must match bcrypt hash");

    const isWrongMatch = await bcrypt.compare("WrongPassword", record.user.password_hash);
    assert.equal(isWrongMatch, false, "Invalid password must be rejected");

    const studentProfile = await StudentRepository.findByUserId(record.user.id);
    assert.ok(studentProfile, "Student profile must exist");
    assert.equal(studentProfile?.usn, "1RV22CS042");
    assert.equal(studentProfile?.branch, "Computer Science & Engineering (CSE)");
});

test("Demo Student Account - resolves by USN 1RV22CS042", async () => {
    const record = await UserRepository.findByUSNorEmail("1RV22CS042");
    assert.ok(record, "Student must be resolvable via USN");
    assert.equal(record.user.email, "student@campusflow.edu");
});
