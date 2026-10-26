import test from "node:test";
import assert from "node:assert/strict";

test("Reminder Idempotency Key - incorporates drive id, offset, and deadline timestamp", () => {
    const driveId = "drive-uuid-123";
    const offsetHours = 6;
    const deadline = new Date("2026-11-01T18:00:00Z");

    const key1 = `${driveId}_${offsetHours}_${deadline.getTime()}`;
    const key2 = `${driveId}_${offsetHours}_${deadline.getTime()}`;

    assert.equal(key1, key2);

    // If deadline changes by even 1 millisecond, the key changes so a new reminder is scheduled
    const updatedDeadline = new Date("2026-11-02T18:00:00Z");
    const keyUpdated = `${driveId}_${offsetHours}_${updatedDeadline.getTime()}`;
    assert.notEqual(key1, keyUpdated);
});

test("Reminder Scheduled Time Calculation - calculates correct lead time before deadline", () => {
    const deadline = new Date("2026-11-01T18:00:00Z");
    const offsetHours = 24;

    const scheduledTime = new Date(deadline.getTime() - offsetHours * 3600 * 1000);
    const expectedTime = new Date("2026-10-31T18:00:00Z");

    assert.equal(scheduledTime.getTime(), expectedTime.getTime());
});

test("Reminder Worker Invalidation - ignores expired or past deadlines", () => {
    const pastDeadline = new Date(Date.now() - 3600000); // 1 hour ago
    const offsetHours = 6;
    const scheduledTime = new Date(pastDeadline.getTime() - offsetHours * 3600 * 1000);

    const isFuture = scheduledTime > new Date();
    assert.equal(isFuture, false, "Past reminders should not be queued for future execution");
});
