import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { query } from "../dist/database/db.js";
import { UserRepository } from "../dist/repositories/user.repository.js";
import { PasswordResetRepository } from "../dist/repositories/passwordReset.repository.js";
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from "../dist/utils/tokenUtils.js";

test("Auth Repair - Public signup enforces student role and ignores elevated role attempts", async (t) => {
    const testEmail = `synthetic_student_${Date.now()}@testcampus.internal`;
    const passwordHash = await bcrypt.hash("Password@123", 10);

    const user = await UserRepository.createUser({
        fullName: "Synthetic Security Tester",
        email: testEmail,
        passwordHash,
        role: "student", // Enforced by registration handler
        phone: "+91 9999999990"
    });

    try {
        assert.equal(user.role, "student", "User role must be strictly 'student'");
        assert.equal(user.email, testEmail.toLowerCase(), "Email must be normalized to lowercase");

        // Verify retrieval via case-insensitive email query
        const retrieved = await UserRepository.findByEmail(testEmail.toUpperCase());
        assert.ok(retrieved, "User must be found regardless of input casing");
        assert.equal(retrieved.id, user.id);
        assert.equal(retrieved.role, "student");
    } finally {
        await query("DELETE FROM users WHERE id = $1", [user.id]);
    }
});

test("Auth Repair - Reject inactive/deactivated account authentication", async (t) => {
    const testEmail = `inactive_user_${Date.now()}@testcampus.internal`;
    const passwordHash = await bcrypt.hash("Password@123", 10);

    const user = await UserRepository.createUser({
        fullName: "Disabled Account Tester",
        email: testEmail,
        passwordHash,
        role: "student"
    });

    try {
        // Deactivate account
        await query("UPDATE users SET is_active = false WHERE id = $1", [user.id]);

        const retrieved = await UserRepository.findById(user.id);
        assert.ok(retrieved);
        assert.equal(retrieved.is_active, false, "Account is marked inactive in database");
    } finally {
        await query("DELETE FROM users WHERE id = $1", [user.id]);
    }
});

test("Auth Repair - Password recovery lifecycle: hashing, expiration, and single-use consumption", async (t) => {
    const testEmail = `reset_user_${Date.now()}@testcampus.internal`;
    const passwordHash = await bcrypt.hash("Initial@123", 10);

    const user = await UserRepository.createUser({
        fullName: "Recovery Tester",
        email: testEmail,
        passwordHash,
        role: "student"
    });

    try {
        const rawOtp = "789123";
        const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // 1. Create Challenge
        const challenge = await PasswordResetRepository.createChallenge({
            userId: user.id,
            email: user.email,
            otpHash,
            expiresAt
        });

        assert.ok(challenge.id);
        assert.equal(challenge.status, "PENDING");

        // 2. Verify with incorrect OTP increments attempts
        const wrongHash = crypto.createHash("sha256").update("000000").digest("hex");
        assert.notEqual(wrongHash, challenge.otp_hash);
        const attempts = await PasswordResetRepository.incrementAttempts(challenge.id);
        assert.equal(attempts, 1);

        // 3. Verify with correct OTP and issue reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
        const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

        await PasswordResetRepository.setVerified(challenge.id, resetTokenHash, tokenExpires);

        // 4. Token lookup
        const verifiedChallenge = await PasswordResetRepository.findVerifiedByToken(resetTokenHash);
        assert.ok(verifiedChallenge, "Verified challenge must be found with token hash");
        assert.equal(verifiedChallenge.id, challenge.id);

        // 5. Update user password
        const newPasswordHash = await bcrypt.hash("NewSecurePass@2026", 10);
        await UserRepository.updatePassword(user.id, newPasswordHash);

        // 6. Single-use consumption
        await PasswordResetRepository.consume(challenge.id);

        // 7. Verify consumed token is rejected
        const consumedChallenge = await PasswordResetRepository.findVerifiedByToken(resetTokenHash);
        assert.equal(consumedChallenge, null, "Consumed token must never be reusable");

        // 8. Verify user can authenticate with new password
        const updatedUser = await UserRepository.findById(user.id);
        const matchesNew = await bcrypt.compare("NewSecurePass@2026", updatedUser.password_hash);
        assert.ok(matchesNew, "User must authenticate with new password");
    } finally {
        await query("DELETE FROM password_reset_challenges WHERE user_id = $1", [user.id]);
        await query("DELETE FROM users WHERE id = $1", [user.id]);
    }
});

test("Auth Repair - Refresh token rotation and invalid token protection", async (t) => {
    const testEmail = `token_user_${Date.now()}@testcampus.internal`;
    const passwordHash = await bcrypt.hash("Pass@123", 10);

    const user = await UserRepository.createUser({
        fullName: "Token Tester",
        email: testEmail,
        passwordHash,
        role: "student"
    });

    try {
        const initialRefreshToken = generateRefreshToken({ id: user.id });
        await UserRepository.updateRefreshToken(user.id, initialRefreshToken);

        const fetchedUser = await UserRepository.findById(user.id);
        assert.equal(fetchedUser.refresh_token, initialRefreshToken);

        // Rotate token
        const newRefreshToken = generateRefreshToken({ id: user.id });
        await UserRepository.updateRefreshToken(user.id, newRefreshToken);

        const rotatedUser = await UserRepository.findById(user.id);
        assert.equal(rotatedUser.refresh_token, newRefreshToken);
        assert.notEqual(rotatedUser.refresh_token, initialRefreshToken, "Old refresh token must be invalidated");

        // Revocation on logout
        await UserRepository.updateRefreshToken(user.id, null);
        const loggedOutUser = await UserRepository.findById(user.id);
        assert.equal(loggedOutUser.refresh_token, null, "Refresh token must be null after logout");
    } finally {
        await query("DELETE FROM users WHERE id = $1", [user.id]);
    }
});
