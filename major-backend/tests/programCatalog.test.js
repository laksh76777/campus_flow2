import test from "node:test";
import assert from "node:assert/strict";
import { resolveStudentProgram, PROGRAM_CATALOG } from "../dist/constants/programCatalog.js";

test("PROGRAM_CATALOG - contains exactly 13 approved academic programs", () => {
    assert.equal(PROGRAM_CATALOG.length, 13);
});

test("resolveStudentProgram - resolves program by code CSE", () => {
    const resolved = resolveStudentProgram({ programCode: "CSE" });
    assert.ok(resolved);
    assert.equal(resolved?.code, "CSE");
    assert.equal(resolved?.degreeType, "B.E.");
});

test("resolveStudentProgram - resolves program by branch string", () => {
    const resolved = resolveStudentProgram({ branch: "Information Science and Engineering" });
    assert.ok(resolved);
    assert.equal(resolved?.code, "ISE");
});

test("resolveStudentProgram - resolves postgraduate MCA", () => {
    const resolved = resolveStudentProgram({ programCode: "MCA" });
    assert.ok(resolved);
    assert.equal(resolved?.programLevel, "Postgraduate");
    assert.equal(resolved?.degreeType, "MCA");
});
