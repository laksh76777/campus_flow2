import test from "node:test";
import assert from "node:assert/strict";
import { generateAccessToken, verifyAccessToken } from "../dist/utils/tokenUtils.js";

test("Token Security - signs and verifies authenticated claims faithfully", () => {
    const studentClaims = {
        id: "student-uuid-001",
        email: "student@rvce.edu.in",
        role: "student"
    };

    const token = generateAccessToken(studentClaims);
    assert.ok(token);

    const verified = verifyAccessToken(token);
    assert.ok(verified);
    assert.equal(verified?.id, studentClaims.id);
    assert.equal(verified?.email, studentClaims.email);
    assert.equal(verified?.role, "student");
});

test("Token Security - rejects altered tokens or invalid signatures", () => {
    const adminClaims = {
        id: "admin-uuid-999",
        email: "tpo@rvce.edu.in",
        role: "admin"
    };

    const token = generateAccessToken(adminClaims);
    // Tamper with the signature portion
    const tampered = token.slice(0, -6) + "xxxxxx";

    const verified = verifyAccessToken(tampered);
    assert.equal(verified, null, "Tampered token must fail signature verification");
});

test("Role Enforcement - distinguishes between student and admin authorizations", () => {
    const studentToken = generateAccessToken({
        id: "student-1",
        email: "student@rvce.edu.in",
        role: "student"
    });

    const adminToken = generateAccessToken({
        id: "admin-1",
        email: "tpo@rvce.edu.in",
        role: "admin"
    });

    const studentVerified = verifyAccessToken(studentToken);
    const adminVerified = verifyAccessToken(adminToken);

    assert.equal(studentVerified?.role, "student");
    assert.notEqual(studentVerified?.role, "admin");

    assert.equal(adminVerified?.role, "admin");
    assert.notEqual(adminVerified?.role, "student");
});
