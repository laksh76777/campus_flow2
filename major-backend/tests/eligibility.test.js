import test from "node:test";
import assert from "node:assert/strict";
import { EligibilityService, EligibilityStatus } from "../dist/services/eligibility.service.js";

test("EligibilityService - flags missing data when student profile has missing essential metrics", () => {
    const student = {
        branch: "Computer Science & Engineering",
        graduation_year: 2026,
        cgpa: null, // Missing CGPA
        resume_url: "https://example.com/resume.pdf"
    };

    const drive = {
        is_active: true,
        application_deadline: new Date(Date.now() + 86400000).toISOString(),
        graduation_year: 2026,
        eligible_branches: ["Computer Science & Engineering (CSE)"],
        eligible_program_codes: ["CSE"],
        minimum_cgpa: 7.0,
        maximum_backlogs: 0
    };

    const result = EligibilityService.evaluate(student, drive);
    assert.equal(result.status, EligibilityStatus.MISSING_DATA);
    assert.equal(result.isEligible, false);
    assert.ok(result.missingFields.includes("CGPA"));
});

test("EligibilityService - marks student eligible when all criteria are satisfied", () => {
    const student = {
        branch: "Computer Science & Engineering (CSE)",
        program_code: "CSE",
        graduation_year: 2026,
        cgpa: 8.5,
        active_backlogs: 0,
        resume_url: "https://example.com/resume.pdf"
    };

    const drive = {
        is_active: true,
        application_deadline: new Date(Date.now() + 86400000).toISOString(),
        graduation_year: 2026,
        eligible_branches: ["Computer Science & Engineering (CSE)"],
        eligible_program_codes: ["CSE"],
        minimum_cgpa: 7.0,
        maximum_backlogs: 0
    };

    const result = EligibilityService.evaluate(student, drive);
    assert.equal(result.status, EligibilityStatus.ELIGIBLE);
    assert.equal(result.isEligible, true);
    assert.equal(result.reasons.length, 0);
});

test("EligibilityService - rejects student when CGPA is below cutoff", () => {
    const student = {
        branch: "Computer Science & Engineering (CSE)",
        program_code: "CSE",
        graduation_year: 2026,
        cgpa: 6.5,
        active_backlogs: 0,
        resume_url: "https://example.com/resume.pdf"
    };

    const drive = {
        is_active: true,
        application_deadline: new Date(Date.now() + 86400000).toISOString(),
        graduation_year: 2026,
        eligible_branches: ["Computer Science & Engineering (CSE)"],
        eligible_program_codes: ["CSE"],
        minimum_cgpa: 7.0,
        maximum_backlogs: 0
    };

    const result = EligibilityService.evaluate(student, drive);
    assert.equal(result.status, EligibilityStatus.INELIGIBLE);
    assert.equal(result.isEligible, false);
    assert.ok(result.reasons.some((r) => r.includes("below minimum required")));
});
