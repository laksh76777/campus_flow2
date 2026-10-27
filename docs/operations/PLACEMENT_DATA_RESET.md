# CampusFlow — Phase 01: Safe Placement Data Reset Runbook

**Document Version**: 1.0.0  
**Target Architecture**: Supabase PostgreSQL 15.8 (Session Pooler: `aws-0-ap-south-1.pooler.supabase.com`)  
**Service Location**: `major-backend/src/services/placementDataReset.service.ts`  
**CLI Tool Location**: `major-backend/src/scripts/resetPlacementData.ts`  
**Restore Tool Location**: `major-backend/src/scripts/restorePlacementData.ts`  
**Test Suite**: `major-backend/tests/placementReset.test.js`  

---

## 1. Scope & Preservation Guarantees

The placement data reset tool executes a surgical, dependency-ordered removal of placement activity while preserving the core institutional database:

### What is PRESERVED (Untouched)
- **Student Accounts & Credentials**: All records in `users` with `role = 'student'`, hashed passwords, and login sessions.
- **Student Profiles & Academics**: All rows in `student_profiles`, USNs, enrollment numbers, branch mappings, 10th/12th percentages, semester-by-semester SGPA results, CGPA, backlogs, contact details, physical addresses, skills, and existing PDF resumes in Supabase Storage.
- **Administrator & TPO Accounts**: All records in `users` with `role = 'admin'` and all staff profiles in `admins` (employee IDs, designations, placement officer privileges).
- **Academic Program Catalog**: All institutional degree types, programs, and departments in `departments` (CSE, ISE, ECE, ME, MBA, MCA, M.Tech).
- **Placement Sessions**: Academic session cohorts in `placement_sessions` (e.g., 2025-2026 / 2026).
- **Institutional Notifications**: Broadcast announcements, security alerts, and profile verification notifications.
- **Helpdesk & Support**: All support tickets and messages in `support_conversations`.
- **Security Challenges**: All OTPs and reset tokens in `password_reset_challenges`.

### What is RESET (Safely Removed)
- **Placement Drives**: All rows in `placement_drives` (eligibility rules, custom questions, selection rounds, packages, dates).
- **Recruiting Companies**: All company records in `companies` linked to placement drives.
- **Student Applications**: All rows in `applications` (application statuses, submitted snapshots, interview round progress, offers, remarks).
- **Reminder Schedules & Queued Jobs**: All records in `reminder_jobs`, in-memory scheduler timeouts, and delivery idempotency keys.
- **Drive Export & Import Records**: All logs in `export_logs` and drive-specific import records in `import_batches`.
- **Placement Notifications**: All alerts in `notifications` referencing deleted companies, drives, or application statuses.
- **Student Placed Status Reset**: In `student_profiles`, students with `is_placed = true` are reset to `is_placed = false`, `placed_company = ''`, `placed_package = NULL`, `placed_at = NULL`, `placed_job_title = ''`.

---

## 2. Safety Safeguards & Architecture

1. **Explicit Invocation Only**: The reset logic is completely decoupled from application startup, migrations, and standard database seeding (`migrate.ts`, `seed.ts`, `server.ts`).
2. **Environment Specification**: The operator must explicitly pass `--env=<development|staging|test|production>`.
3. **Double Confirmation Requirement**: Execution requires passing `--confirm=CONFIRM_RESET_PLACEMENT_DATA`.
4. **Triple-Lock Production Safeguard**: When `--env=production` is specified, the command will abort unless:
   - The extra token `--confirm-production=I_UNDERSTAND_THIS_WILL_DELETE_ALL_PLACEMENT_DATA` is supplied.
   - The environment variable `ALLOW_PRODUCTION_RESET=true` is explicitly set in the process environment.
5. **Pre-Execution Snapshot**: Prior to deletion, the tool exports a full, restorable JSON snapshot of all affected records with a cryptographic SHA-256 checksum to `backups/placement_snapshot_<env>_<timestamp>.json`.
6. **Strict Dependency Order**: Deletions occur in reverse foreign-key dependency order (`reminder_jobs` -> `export_logs` -> `import_batches` -> `notifications` -> `applications` -> `placement_drives` -> `companies`). Foreign-key constraints are never disabled.
7. **Single Atomic Transaction**: All deletions, updates, and integrity checks are wrapped inside a PostgreSQL transaction (`BEGIN ... COMMIT / ROLLBACK`). If any assertion fails, the database is rolled back immediately.
8. **In-Flight Job Cancellation**: Any active or pending background workers in `reminder_jobs` are cancelled and memory intervals are cleared via `ReminderSchedulerService.stopWorker()`.
9. **Zero PII Logging**: Summaries and logs report row counts only. No student names, emails, or credentials appear in console logs.

---

## 3. Step-by-Step Operator Runbook

### Step 1: Pre-Execution Inspection (Dry-Run Mode)

Always run in `--dry-run` mode first to verify table counts:

```powershell
cd c:\Users\Akshat\.gemini\antigravity\scratch\campus-flow\campus_flow2\major-backend
npm run reset:placement-data -- --dry-run --env=development
```

#### Expected Dry-Run Output
```text
================================================================================
 CAMPUSFLOW PLACEMENT DATA RESET — Mode: DRY-RUN (READ-ONLY)
 Target Environment: DEVELOPMENT
================================================================================

>>> DRY-RUN INSPECTION RESULTS (No database changes were made):
--------------------------------------------------------------------------------
  PLACEMENT DATA TO BE REMOVED:
   - Placement Drives:        2
   - Applications & Offers:   0
   - Recruiting Companies:    3
   - Reminder Jobs / Queue:   0
   - Drive Export Logs:       0
   - Drive Import Batches:    0
   - Drive Notifications:     0
--------------------------------------------------------------------------------
  STUDENT STATE TO BE RESET:
   - Placed Students Reset:   0
--------------------------------------------------------------------------------
  CORE ENTITIES PRESERVED (UNTOUCHED):
   - User Accounts:           2 (students + admins)
   - Admin / TPO Profiles:    1
   - Student Profiles:        1 (USNs, CGPA, Resumes)
   - Academic Departments:    13
   - Placement Sessions:      1
   - Support Conversations:   0
   - Unrelated Notifications: 0
--------------------------------------------------------------------------------
```

---

### Step 2: Executing the Reset in Non-Production (Development / Staging)

When you are ready to execute the reset on your development or staging database:

```powershell
cd c:\Users\Akshat\.gemini\antigravity\scratch\campus-flow\campus_flow2\major-backend
npm run reset:placement-data -- --env=development --confirm=CONFIRM_RESET_PLACEMENT_DATA
```

#### Expected Execution Output
```text
================================================================================
 CAMPUSFLOW PLACEMENT DATA RESET — Mode: ACTIVE EXECUTION
 Target Environment: DEVELOPMENT
================================================================================

>>> RESET SUCCESSFULLY EXECUTED AND COMMITTED:
--------------------------------------------------------------------------------
 Execution ID:     reset_dryrun_...
 Backup Snapshot:  C:\Users\Akshat\...\major-backend\backups\placement_snapshot_development_...json
 Backup Checksum:  5a7e4b9...
--------------------------------------------------------------------------------
 RECORDS REMOVED:
  - Placement Drives:        2
  - Applications & Offers:   0
  - Recruiting Companies:    3
  - Reminder Jobs / Queue:   0
  - Drive Notifications:     0
--------------------------------------------------------------------------------
 INTEGRITY VERIFICATION:
  - Remaining Drives:        0 (must be 0)
  - Remaining Applications:  0 (must be 0)
  - Remaining Companies:     0 (must be 0)
  - Users Preserved:         YES
  - Students Preserved:      YES
  - Admins Preserved:        YES
--------------------------------------------------------------------------------
```

---

### Step 3: Executing in Production (Triple-Lock Safeguard)

In production, run with the production confirmation flag and environment variable:

```powershell
# PowerShell:
$env:ALLOW_PRODUCTION_RESET="true"
npm run reset:placement-data -- --env=production --confirm=CONFIRM_RESET_PLACEMENT_DATA --confirm-production=I_UNDERSTAND_THIS_WILL_DELETE_ALL_PLACEMENT_DATA
Remove-Item Env:\ALLOW_PRODUCTION_RESET

# Linux / Bash:
ALLOW_PRODUCTION_RESET=true npm run reset:placement-data -- \
  --env=production \
  --confirm=CONFIRM_RESET_PLACEMENT_DATA \
  --confirm-production=I_UNDERSTAND_THIS_WILL_DELETE_ALL_PLACEMENT_DATA
```

---

### Step 4: Post-Reset Verification Queries

Run these SQL verification queries via psql or Supabase SQL Editor:

```sql
-- 1. Verify placement tables are completely clean:
SELECT 
    (SELECT COUNT(*) FROM placement_drives) AS drives_count,
    (SELECT COUNT(*) FROM companies) AS companies_count,
    (SELECT COUNT(*) FROM applications) AS applications_count,
    (SELECT COUNT(*) FROM reminder_jobs) AS reminder_jobs_count;
-- Expected Result: 0 | 0 | 0 | 0

-- 2. Verify all core institutional data is completely preserved:
SELECT 
    (SELECT COUNT(*) FROM users) AS users_count,
    (SELECT COUNT(*) FROM student_profiles) AS students_count,
    (SELECT COUNT(*) FROM admins) AS admins_count,
    (SELECT COUNT(*) FROM departments) AS departments_count,
    (SELECT COUNT(*) FROM placement_sessions) AS sessions_count;
-- Expected Result: > 0 for all columns (e.g. 2 | 1 | 1 | 13 | 1)

-- 3. Verify student placement flags are cleared:
SELECT COUNT(*) AS unreset_placed_students 
FROM student_profiles 
WHERE is_placed = true OR placed_company != '' OR placed_package IS NOT NULL;
-- Expected Result: 0
```

---

## 4. Rollback & Emergency Recovery Procedure

If an operator mistakenly resets a dataset or needs to restore previously reset records, use the captured snapshot:

```powershell
cd c:\Users\Akshat\.gemini\antigravity\scratch\campus-flow\campus_flow2\major-backend
npm run restore:placement-data -- --file=backups/placement_snapshot_development_1730000000000.json
```

The restore script:
1. Re-computes and verifies the SHA-256 checksum to ensure data integrity.
2. Inserts companies, placement drives, and applications in foreign-key dependency order inside a transaction (`ON CONFLICT DO NOTHING`).
3. Re-applies student placement flags.
4. Commits atomically.
