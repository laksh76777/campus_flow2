import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeFormula } from "../dist/services/excelImportExport.service.js";

test("sanitizeFormula - prefixes formula triggers with a single quote", () => {
    // Formula triggers
    assert.equal(sanitizeFormula("=SUM(A1:A10)"), "'=SUM(A1:A10)");
    assert.equal(sanitizeFormula("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
    assert.equal(sanitizeFormula("+1+2"), "'+1+2");
    assert.equal(sanitizeFormula("-5+10"), "'-5+10");
    assert.equal(sanitizeFormula("@HYPERLINK(\"http://evil.com\")"), "'@HYPERLINK(\"http://evil.com\")");
    assert.equal(sanitizeFormula("\t=1+1"), "'\t=1+1");
    assert.equal(sanitizeFormula("\r=1+1"), "'\r=1+1");
});

test("sanitizeFormula - leaves legitimate strings intact", () => {
    assert.equal(sanitizeFormula("1MS22CS001"), "1MS22CS001");
    assert.equal(sanitizeFormula("Student Name"), "Student Name");
    assert.equal(sanitizeFormula("user@example.com"), "user@example.com");
    assert.equal(sanitizeFormula("B.E. Computer Science"), "B.E. Computer Science");
});

test("sanitizeFormula - safely handles non-string values", () => {
    assert.equal(sanitizeFormula(12345), 12345);
    assert.equal(sanitizeFormula(9.75), 9.75);
    assert.equal(sanitizeFormula(null), null);
    assert.equal(sanitizeFormula(undefined), undefined);
    assert.equal(sanitizeFormula(true), true);
});
