# CampusFlow — Phase 02: PostgreSQL Schema-to-Code Mapping & Data Layer Audit

**Target Architecture**: Supabase PostgreSQL 15.8 (Session Pooler: `aws-0-ap-south-1.pooler.supabase.com:5432`)  
**Backend Framework**: Express 4 + TypeScript 5.8  
**ORM / Driver**: Raw Parameterized SQL via `pg.Pool`  
**Date of Audit**: 2026-10-27  

---

## 1. Complete Table-to-Code Mapping Matrix

| Table Name | PK | TypeScript Interface | Repository File | Router Mount | Frontend Service / Store | Indexes & Constraints | RLS Policy |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | UUID | `UserRecord` | `user.repository.ts` | `/api/v1/auth` | `authService.ts`<br>`useAuthStore.ts` | `idx_users_email`<br>`idx_users_lower_email` (UNIQUE)<br>`idx_users_role` | `users_view_own`<br>`users_update_own`<br>`service_role_all_users` |
| `admins` | UUID | `AdminRecord` | `admin.repository.ts` | `/api/v1/admin` | `adminService.ts` | `idx_admins_user_id`<br>`idx_admins_employee_id` (UNIQUE) | `admins_view_all`<br>`admins_manage_all` |
| `placement_sessions`| UUID | `PlacementSessionRecord` | `session.repository.ts` | `/api/v1/placement-session` | `sessionService.ts` | `session_year` (UNIQUE)<br>`idx_single_active_session` (UNIQUE partial)<br>`check_session_year` | `sessions_view_active`<br>`sessions_admin_manage` |
| `departments` | UUID | `DepartmentRecord` | `department.repository.ts` | `/api/v1/programs` | `programCatalogService.ts` | `code` (UNIQUE)<br>`name` (UNIQUE)<br>`idx_departments_is_active` | `departments_view_active`<br>`departments_admin_manage` |
| `companies` | UUID | `CompanyRecord` | `company.repository.ts` | `/api/v1/company` | `companyService.ts` | `company_name` (UNIQUE)<br>`idx_companies_is_active` | `companies_view_active`<br>`companies_admin_manage` |
| `student_profiles` | UUID | `StudentProfileRecord` | `student.repository.ts` | `/api/v1/student-profile` | `studentService.ts`<br>`profileService.ts` | `idx_students_lower_usn` (UNIQUE)<br>`idx_students_lower_enrollment` (UNIQUE)<br>`check_valid_cgpa`<br>`check_non_negative_backlogs`<br>`check_tenth_percentage`<br>`check_twelfth_percentage`<br>`idx_students_eligibility` | `student_view_own`<br>`student_update_own`<br>`student_insert_own` |
| `placement_drives` | UUID | `PlacementDriveRecord` | `drive.repository.ts` | `/api/v1/placement-drive` | `driveService.ts` | `check_drive_package`<br>`check_drive_min_cgpa`<br>`check_drive_max_backlogs`<br>`check_drive_deadline_order`<br>`idx_drives_session_active` | `drives_view_active`<br>`drives_admin_manage` |
| `applications` | UUID | `ApplicationRecord` | `application.repository.ts`| `/api/v1/application` | `applicationService.ts` | `unique_student_drive_application` (UNIQUE)<br>`check_offered_package`<br>`idx_apps_drive_status` | `apps_view_own`<br>`apps_insert_own`<br>`apps_manage_admin`<br>`apps_student_update_own` |
| `notifications` | UUID | `NotificationRecord` | `notification.repository.ts`| `/api/v1/notification` | `notificationService.ts` | `idx_notifs_user_unread` (user_id, is_read, created_at DESC) | `notifs_view_own`<br>`notifs_update_own` |
| `reminder_jobs` | UUID | `ReminderJobRecord` | `reminder.repository.ts` | `/api/v1/notification` | Internal scheduler | `idempotency_key` (UNIQUE)<br>`idx_reminders_pending_due` (scheduled_time WHERE status = 'PENDING') | `reminders_admin_only` |
| `support_conversations`| UUID| `SupportConversationRecord`| `support.repository.ts`| `/api/v1/support` | `supportService.ts` | `idx_support_student_id`<br>`idx_support_status` | `support_view_own`<br>`support_insert_own`<br>`support_update_own` |
| `import_batches` | UUID | `ImportBatchRecord` | `importExport.repository.ts`| `/api/v1/excel` | `excelMigrationService.ts`| `batch_id` (UNIQUE)<br>`idx_import_type` | `imports_admin_only` |
| `export_logs` | UUID | `ExportLogRecord` | `importExport.repository.ts`| `/api/v1/excel` | `excelMigrationService.ts`| `idx_export_drive_id` | `exports_admin_only` |
| `password_reset_challenges`| UUID| `PasswordResetRecord`| `passwordReset.repository.ts`| `/api/v1/auth` | `authService.ts` | `idx_pw_reset_email`<br>`idx_pw_reset_token`<br>`idx_pw_reset_expires` | `service_role_all_resets` |

---

## 2. Migration Sequencing & Verification Status

All 5 migration scripts have been executed, tested, and verified on live Supabase PostgreSQL:

| Sequence | Migration File | Purpose | Verification Status | Verification Evidence |
| :---: | :--- | :--- | :---: | :--- |
| **001** | `001_initial_schema.sql` | 14 relational tables with UUID PKs and initial constraints | **VERIFIED** | Executed against Supabase; all 14 tables created with check constraints. |
| **002** | `002_create_indexes_and_constraints.sql` | Base foreign keys, lookup indexes, and automated `updated_at` trigger | **VERIFIED** | Executed against Supabase; triggers and 25 indexes active. |
| **003** | `003_rls_policies.sql` | Row Level Security enabled with `is_admin()`, `is_student()`, and `auth.uid()` checks | **VERIFIED** | Executed against Supabase; RLS active across all tables. |
| **004** | `004_seed_data.sql` | Master 13 departments, initial placement session (2025-2026), demo admin & student accounts | **VERIFIED** | Verified by `tests/demoAccounts.test.js` (`1RV22CS042` and `TPO-2026-001`). |
| **005** | `005_data_layer_stabilization.sql` | Case-insensitive unique indexes, range checks, partial single-session index, and student RLS update | **VERIFIED** | Executed cleanly via `npm run migrate` on live Supabase pooler. |

---

## 3. Query Parameterization Audit

Every SQL query across all 13 repositories and controllers was audited:

- **Strict Parameterization**: All queries use `$1`, `$2`, `$3` positional placeholders passed to `pg.query(sql, params)`.
- **Zero Interpolation of User Inputs**: Search queries dynamically construct parameterized conditions (`LOWER(name) LIKE $1`) rather than interpolating values.
- **CSV / Formula Sanitization**: Inputs during student Excel imports are passed through `sanitizeFormula()` to prevent spreadsheet injection (`=`, `+`, `-`, `@`).

---

## 4. Elimination of Legacy MongoDB Assumptions

### Identified Conflicts:
1. **`id` vs `_id`**: PostgreSQL emits `id`. Frontend components frequently looked for `_id`.
2. **`snake_case` vs `camelCase`**: PostgreSQL emits `is_active`, `company_name`, `job_title`, `graduation_year`. Frontend expected `isActive`, `companyName`, `jobTitle`.
3. **Hardcoded Mock Fallbacks**: `drive.repository.ts` and `application.repository.ts` contained in-memory `DEMO_DRIVES` and `DEMO_APPLICATIONS` that reappeared if database queries returned zero results.

### Resolved Architecture:
1. **Axios Response Normalizer**: Implemented in `frontend/src/services/api.ts`. Every incoming API response object automatically provides dual-compatibility:
   - `_id: obj.id`
   - `isActive: obj.is_active`
   - `companyName: obj.company_name`
   - `jobTitle: obj.job_title`
   - `isRead: obj.is_read`
   - `graduationYear: obj.graduation_year`
   This bridges legacy components completely without maintaining dual database models.
2. **Removed Repository Mocks**: In-memory `DEMO_DRIVES` and `DEMO_APPLICATIONS` fallbacks have been eliminated from `drive.repository.ts` and `application.repository.ts`. The database is the authoritative single source of truth.

---

## 5. Atomicity & Concurrency Controls

1. **Unique Application Constraint (`unique_student_drive_application`)**:
   - Enforced in database schema: `UNIQUE (student_id, placement_drive_id)`.
   - `application.controller.ts` catches PostgreSQL error code `23505` and returns HTTP `409 Conflict` ("You have already submitted an application for this placement drive.") ensuring atomic duplicate prevention under concurrent requests.
2. **Single Active Placement Session (`idx_single_active_session`)**:
   - Enforced by partial unique index `WHERE is_active = true`. Concurrent attempts to activate multiple sessions will be rejected by the database.
3. **Transactional Placement Reset**:
   - Placement data reset and snapshot restoration execute within `withTransaction((client) => ...)` guaranteeing atomic execution with rollback on error.
