# CampusFlow — Phase 05: Session and Company Management Report

## Executive Summary

Phase 05 repairs **Placement Session Management** and **Corporate Partner / Company Management** across the full stack—from frontend user interfaces to Express controllers, repositories, PostgreSQL database constraints, and automated integration tests. All in-memory static fallbacks (`DEMO_SESSION`, `DEMO_COMPANIES`) have been removed; referential integrity is strictly enforced to protect historical placement drives, student applications, and recruitment offers; case-insensitive duplicate prevention is established; and student data privacy rules are enforced server-side.

---

## 1. Placement Sessions Architecture & Repairs

### 1.1 Academic Cohort & Session Relationship
- Explicit mapping connects admission year, academic batch, course duration, and graduating cohort:
  - **UG (Undergraduate)**: 4-Year Duration ($2023 \to 2027$, Class of 2027)
  - **PG (Postgraduate / M.Tech / MCA)**: 2-Year Duration ($2024 \to 2026$, Class of 2026)
  - **Lateral Entry**: 3-Year Duration ($2024 \to 2027$, Class of 2027)
- **Constraint Enforcement**:
  - `idx_single_active_session`: Partial unique index (`WHERE is_current = true`) strictly guarantees at most one active placement session at any given moment. Activating another session atomically deactivates previous active sessions inside a transaction.
  - `check_session_year`: Constrains `session_year` between 2000 and 2100.
  - `academic_year` unique constraint: Disallows duplicate cohort sessions for the same academic cycle.

### 1.2 Session Lifecycle & Historical Preservation
- **Permitted State Transitions**:
  - `Inactive` $\to$ `Active` (`/sessions/:id/activate`)
  - `Active` $\to$ `Closed` (`/sessions/:id/close`)
  - `*` $\to$ `Archived` (`/sessions/:id/archive`)
- **Historical Data Protection**:
  - Closing a session preserves all linked students (`student_profiles.placement_session_id`), past drives (`placement_drives.placement_session_id`), historical applications, and job offers.
  - Modifying `session_year` on an existing session is blocked on the server if placement drives have already been scheduled for that session.
  - **Safe Deletion**: `SessionRepository.delete(id)` verifies whether any placement drives or enrolled students are linked to the session. If any exist, it rejects deletion with `HTTP 400 Bad Request` and prompts the administrator to archive the session instead.

### 1.3 Repository & Controller Implementation
- **Repository** ([session.repository.ts](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/major-backend/src/repositories/session.repository.ts)):
  - Removed static `DEMO_SESSION` fallback across `findAll`, `findById`, `findByYear`, `findActive`.
  - Added filter query support for `status` and `includeArchived`.
  - Implemented `delete(id)` with referential integrity checks against `placement_drives` and `student_profiles`.
- **Controller & Routes**:
  - Added `deleteSession` handler in [placementSession.controller.ts](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/major-backend/src/controllers/placementSession.controller.ts).
  - Mounted `DELETE /api/v1/sessions/:id` protected with `verifyJWT` and `verifyAdmin` in [placementSession.routes.ts](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/major-backend/src/routes/placementSession.routes.ts).

---

## 2. Company & Corporate Partner Management Repairs

### 2.1 Identity Validation & Duplicate Prevention
- Enforced case-insensitive duplicate checking on company names during both creation and update operations:
  ```sql
  SELECT * FROM companies WHERE LOWER(TRIM(company_name)) = LOWER(TRIM($1)) LIMIT 1
  ```
- Attempts to register a duplicate corporate partner reject with `HTTP 409 Conflict: "A company with this name already exists."`

### 2.2 Student Privacy & Recruiter Protection
- Recruiter contact details (`contact_email`, `contact_phone`, `contactEmail`, `contactPhone`) are restricted server-side:
  - If `req.user.role === 'student'`, private recruiter fields are stripped before the response leaves the Express controller.
  - Only authenticated administrators/TPOs receive full contact credentials for recruitment coordination.

### 2.3 Company Lifecycle & Drive Association Protection
- **Deactivation / Reactivation**:
  - `PATCH /api/v1/company/:id/deactivate`: Marks company inactive (`is_active = false`). Inactive companies cannot host new upcoming placement drives, but historical drives and past student offers remain completely intact.
  - `PATCH /api/v1/company/:id/reactivate`: Restores active status (`is_active = true`).
- **Safe Deletion & Retention Rule**:
  - `CompanyRepository.delete(id)` checks for existing records in `placement_drives`:
    ```sql
    SELECT COUNT(*) AS total FROM placement_drives WHERE company_id = $1
    ```
  - If drives exist, deletion is rejected with `HTTP 400 Bad Request: "Cannot delete company with associated placement drives. Please archive or deactivate the company instead to preserve historical records."`
  - Hard deletion is only permitted if 0 placement drives are linked.

### 2.4 Normalized Compatibility Layer
- Implemented `formatCompanyResponse` in [company.controller.ts](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/major-backend/src/controllers/company.controller.ts) providing dual snake_case and camelCase compatibility (`_id`, `id`, `companyName`, `company_name`, `companyLogo.url`, `isActive`, `is_active`) to support all frontend widgets seamlessly.

---

## 3. Frontend UI & Integration Enhancements

1. **Session Management** ([ManageSessions.tsx](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/frontend/src/components/admin/ManageSessions.tsx)):
   - Unified `sess.id || sess._id` resolution.
   - Mounted delete session button with confirmation dialog and toast notifications.
   - Connected `deletePlacementSession` service in [sessionService.ts](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/frontend/src/services/sessionService.ts).
2. **Company Management** ([ManageCompanies.tsx](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/frontend/src/components/admin/ManageCompanies.tsx)):
   - Unified `company.id || company._id` resolution.
   - Added `handleDeleteCompany` with delete button on partner cards.
   - Connected `deleteCompany` service in [adminService.ts](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/frontend/src/services/adminService.ts).
   - Instant refresh and graceful backend error toast when attempting to delete companies with drives.

---

## 4. Test Verification

Automated integration test suite in [sessionAndCompanyRepair.test.js](file:///c:/Users/Akshat/.gemini/antigravity/scratch/campus-flow/campus_flow2/major-backend/tests/sessionAndCompanyRepair.test.js):

```bash
> node --test tests/sessionAndCompanyRepair.test.js

TAP version 13
# Subtest: Session Repair - Lifecycle, duplicate prevention, and single-active session enforcement
ok 1 - Session Repair - Lifecycle, duplicate prevention, and single-active session enforcement
  ---
  duration_ms: 7553.1008
  type: 'test'
  ...
# Subtest: Company Repair - Creation, duplicate rejection, lifecycle, and deletion safety
ok 2 - Company Repair - Creation, duplicate rejection, lifecycle, and deletion safety
  ---
  duration_ms: 627.0223
  type: 'test'
  ...
1..2
# tests 2
# pass 2
# fail 0
```

### Verified Scenarios:
1. **Session Lifecycle**: Creation $\to$ Activation $\to$ Rejection of duplicate active sessions $\to$ Closure $\to$ Archival $\to$ Referential safety check blocking deletion if drives exist.
2. **Company Lifecycle**: Case-insensitive creation $\to$ Duplicate name rejection (HTTP 409) $\to$ Deactivation $\to$ Reactivation $\to$ Deletion blocked when drives exist $\to$ Clean deletion when 0 drives exist.
3. **Frontend Build**: `npm run build` completed cleanly in 993ms with zero TypeScript or bundling errors.
