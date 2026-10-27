# CAMPUSFLOW — PHASES 09 & 10: RELIABLE EMAIL, NOTIFICATIONS & DURABLE REMINDER SCHEDULING

## Executive Summary

Phases 09 and 10 audited and repaired the communication, notification, and automated reminder infrastructure of CampusFlow V3 across the Express API, Supabase PostgreSQL, background reminder scheduler, and React frontend.

---

## 1. Phase 09: Reliable Email & In-App Notification System

### 1.1 Email Provider Integration & Guardrails
- **Primary Provider**: Resend HTTPS API (`https://api.resend.com/emails`) utilizing standard `Bearer` token authorization.
- **Secondary / Fallback Provider**: Nodemailer SMTP transport.
- **Provider Normalization & Error Mapping**:
  - `sendViaResend` captures HTTP responses, extracts provider message IDs (`data.id`), and maps HTTP status codes into standardized states: `ACCEPTED`, `FAILED`, `THROTTLED` (HTTP 429), `TIMEOUT`, and `INVALID_RECIPIENT`.
  - Added request timeout guardrail using `AbortSignal.timeout(10000)` (10-second bounded timeout).
- **Zero-Credential Startup Validation**:
  - `validateEmailConfigOnStartup` evaluates provider configuration at boot and logs active provider and sender details without printing API keys, passwords, or tokens.
- **Recipient & Privacy Protections**:
  - `validateEmailAddress` enforces RFC-compliant email formatting prior to dispatch.
  - Reset links and deadline alerts omit private student identifiers, tokens, and USNs from URLs.

### 1.2 In-App Notifications & Dual-Casing Serialization
- **Database Schema**: Stored in PostgreSQL `notifications` table indexed by `(user_id, is_read, created_at DESC)`.
- **Dual-Casing Formatter (`formatNotificationResponse`)**:
  - Resolves frontend/backend contract mismatches by providing both camelCase and snake_case properties (`id`, `_id`, `is_read`, `isRead`, `created_at`, `createdAt`, `interview_date`, `interviewDate`, `offered_package`, `offeredPackage`, etc.).
- **Pagination & Badge Counts**:
  - `findByUserPaged` provides paginated message listings alongside atomic `unread_count` and `total` records.
- **Security & IDOR Isolation**:
  - Recipient ownership (`WHERE user_id = $2`) is strictly enforced across `markAsRead`, `markAllAsRead`, `deleteNotification`, and `clearAllForUser`. Unauthorized users cannot view or manipulate other students' notifications.
- **Pipeline Event Enrichment**:
  - Recruiter status transitions (`shortlisted`, `interview`, `selected`, `offer_received`) automatically attach `interview_date`, `interview_round`, `interview_location`, and `offered_package` directly to student notifications.

### 1.3 Audience Targeting & Bulk Announcements
- **Audience Resolver (`resolveAudienceStudents`)**:
  - Fully supports targeting by:
    1. `all`: Entire student body.
    2. `program` / `branch`: Departmental cohorts.
    3. `session` / `sessionYear`: Graduating placement classes.
    4. `drive_applicants`: Candidates who applied to a specific placement drive.
    5. `student`: Individual target student.
- **Channel Delivery Metrics**:
  - Multi-channel delivery records `inAppCreated`, `emailsSent`, `emailsFailed`, `skippedMissingEmail`, and returns authoritative `emailStatus` (`DELIVERED`, `PARTIAL_FAILURE`, `FAILED`, `SMTP_NOT_CONFIGURED`, `NO_VALID_EMAILS`).

---

## 2. Phase 10: Durable Reminder Scheduling & Background Worker

### 2.1 Scheduler Rules & Documented Offsets
- **Standard Trigger Offsets**: `DEFAULT_REMINDER_OFFSETS_HOURS = [24, 6, 2]`.
- **Drive Lifecycle & Schedule Sync (`syncDriveReminders`)**:
  - Only active drives (`is_active = true`) with future deadlines (`deadline > now()`) are eligible for reminder jobs.
  - When a drive's deadline is modified, pending reminder jobs computed against the old deadline are automatically cancelled (`status = 'CANCELLED'`).
  - When a drive is archived, deactivated, or deleted, all pending reminder jobs are cancelled.

### 2.2 Concurrency Safety & PostgreSQL `SKIP LOCKED`
- **Idempotency Key**:
  - Key format: `${drive.id}:${offsetHours}:${new Date(deadline).toISOString()}`.
  - Enforced via unique constraint on `reminder_jobs.idempotency_key` with `ON CONFLICT (idempotency_key) DO NOTHING`.
- **Atomic Job Claiming (`claimDueJobs`)**:
  ```sql
  WITH claimable AS (
      SELECT id FROM reminder_jobs
      WHERE status = 'PENDING'
        AND scheduled_time <= $1
      ORDER BY scheduled_time ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
  )
  UPDATE reminder_jobs rj
  SET status = 'PROCESSING',
      attempts = attempts + 1,
      last_attempt_at = now()
  FROM claimable
  WHERE rj.id = claimable.id
  RETURNING rj.*
  ```
- **Crash Recovery (Zombie Job Reaping)**:
  - Jobs trapped in `PROCESSING` status for over 10 minutes due to worker crashes are automatically reset to `PENDING` if `attempts < max_attempts`, or marked terminal `FAILED` if retries are exhausted.
- **Bounded Retries with Backoff**:
  - Transient execution failures re-queue with a 5-minute backoff delay. Jobs exceeding `max_attempts` (default: 3) transition to `FAILED` with diagnostics logged in `error_category`.

### 2.3 Standalone Worker & Render Configuration
- **Worker Entry Point**: Created dedicated `major-backend/src/worker.ts` with standalone PostgreSQL pool management and graceful SIGTERM/SIGINT shutdown.
- **Render Service Alignment (`render.yaml`)**:
  - Updated worker service `startCommand` from `node dist/server.js` (erroneous web server) to `npm run worker` (`node dist/worker.js`).
  - Added `ENABLE_EMBEDDED_WORKER: "false"` to the API web service to eliminate duplicate polling between the web dyno and worker dyno.

---

## 3. Verification & Automated Test Results

### 3.1 Email and Reminder Test Suite (`emailAndReminderRepair.test.js`)
```
TAP version 13
# Subtest: Email Service - Validation, Normalization and Provider Guardrails
    ok 1 - Validates authentic RFC-compliant recipient email addresses
    ok 2 - Detects placeholder and dummy values safely
    ok 3 - Startup validator checks configuration without credential leaks
    ok 4 - Rejects dispatch to invalid recipient addresses with normalized error
ok 1 - Email Service - Validation, Normalization and Provider Guardrails
# Subtest: In-App Notifications - Persistence, Security and Dual Casing Formatting
ok 2 - In-App Notifications - Persistence, Security and Dual Casing Formatting
# Subtest: Durable Reminder Scheduling - Idempotency, Atomic Claiming and Lifecycle
ok 3 - Durable Reminder Scheduling - Idempotency, Atomic Claiming and Lifecycle
1..3
# tests 7
# pass 7
# fail 0
```

### 3.2 Full Regression Suite (Phases 05, 06, 07, 08, 09, 10)
```
TAP version 13
ok 1 - Eligibility Engine - Comprehensive Boundary & Criteria Evaluation (12 tests)
ok 2 - Placement Drive Management - Lifecycle, Validation, and Referential Safety
ok 3 - Placement Pipeline - State Machine & Authorized Workflow Transitions
ok 4 - Placement Pipeline - End-to-End Application, Recruiter Actions & Placement Sync
ok 5 - Session Repair - Lifecycle, duplicate prevention, and single-active session enforcement
ok 6 - Company Repair - Creation, duplicate rejection, lifecycle, and deletion safety
1..6
# tests 19
# pass 19
# fail 0
```

### 3.3 Build Verification
- **Backend Build (`tsc`)**: Exited with code `0`.
- **Frontend Build (`tsc -b && vite build`)**: Exited with code `0`.
