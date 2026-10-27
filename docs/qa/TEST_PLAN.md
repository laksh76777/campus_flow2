# CAMPUSFLOW — QA MASTER TEST PLAN (PHASE 14)

## 1. Executive Summary & Quality Strategy

This Master Test Plan establishes a comprehensive, reproducible, multi-layered quality verification harness for **CampusFlow V3**. The testing strategy enforces continuous verification across pure business logic, database constraints, API security boundaries, placement pipeline state machines, AI copilot integrations, and end-to-end recruitment lifecycle scenarios.

### Quality Core Tenets
1. **Authoritative Evidence**: No mocked or stubbed success responses are accepted in place of real database interactions.
2. **Order Independence**: Every test suite manages synthetic fixtures and restores baseline state in lifecycle hooks (`before`, `after`, `finally`).
3. **Defense-in-Depth**: Strict separation of concerns between database constraints, repository-level validations, route authorization guards, and service-layer error handling.
4. **Deterministic Reproducibility**: Consistent execution across developer environments, staging pipelines, and production release verification.

---

## 2. Test Architecture & Layer Hierarchy

The CampusFlow test suite is structured into six complementary layers:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 6: End-to-End Placement Lifecycles (12 Mandatory Scenarios)   │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 5: Security & Role Boundary Penetration Suite                 │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 4: Integration, Provider Resiliency & AI Fallback Suite       │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 3: Frontend Component, Deep Linking & Route Access Suite      │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 2: Backend Integration & PostgreSQL Schema Migration Suite    │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 1: Deterministic Pure Unit & Utility Test Suite               │
└──────────────────────────────────────────────────────────────────────┘
```

### Layer 1: Pure Unit Tests
- **Eligibility Engine Rules**: Boundary evaluation of CGPA cutoffs, active backlog tolerances, graduation cohort matching, 10th/12th percentages, and missing profile attributes.
- **Spreadsheet Security**: Neutralization of CSV/Excel formula injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) in candidate export pipelines.
- **Academic Program Catalog**: Resolution and mapping of 13 approved degree codes and program identifiers across undergraduate and postgraduate branches.
- **Reminder & Date Calculations**: Idempotency key generation, deadline offset calculations (`[24h, 6h, 2h]`), and lead-time validation.

### Layer 2: Backend Integration Tests
- Real migrations and foreign-key constraints executed against an isolated PostgreSQL instance.
- ACID transactional rollbacks and commit guarantees under `withTransaction`.
- Partial unique indexes (`idx_single_active_session`, `idx_unique_student_usn`).
- Pagination, filtering, and case-insensitive query indexing.

### Layer 3: Frontend Component & Route Safety
- Full TypeScript type-checking (`tsc --noEmit`).
- Production bundle verification (`vite build`).
- Client-side deep-link routing and direct URL accessibility (`/admin/sessions`, `/admin/excel-hub`, `/admin/announcements`).
- Role-based route shields (`RequireAuth`, `RequireRole`).

### Layer 4: Provider Resilience & AI Fault Tolerance
- **AI Integrations**: Server-side model credential isolation, prompt injection defenses, context boundary scoping, token limits, and multi-model fallback (`Groq` $\rightarrow$ `Gemini` $\rightarrow$ deterministic safe reporting).
- **Email & Notification**: Provider failure handling, template rendering without credential leakage, and RFC-compliant recipient address normalization.
- **Worker & Job Outages**: Atomic `FOR UPDATE SKIP LOCKED` reminder claiming and zombie worker timeout recovery.

### Layer 5: Security & Role Penetration Tests
- Student vs. TPO authorization barriers and role spoofing prevention on public signup.
- Inactive/deactivated account login lockout.
- Password reset token hashing, expiration, and single-use invalidation.
- Refresh token rotation and replay attack mitigation.
- Prevention of IDOR on student profiles and support conversations.

### Layer 6: Mandatory Placement Pipeline Lifecycle Scenarios
- End-to-end sequential verification of all 12 institutional placement workflow scenarios:
  1. Clean dataset baseline verification (admin and student accounts intact).
  2. TPO creates academic session, corporate partner company, and session-linked drive with criteria.
  3. Eligible student applies successfully with persisted audit snapshots.
  4. Ineligible student is rejected with specific, transparent failure reasons.
  5. Late and duplicate application attempts are rejected.
  6. Recruiter advances student through selection rounds (`applied` $\rightarrow$ `shortlisted` $\rightarrow$ `interview` $\rightarrow$ `selected`).
  7. State visibility and candidate isolation boundaries are strictly enforced.
  8. In-app notifications are generated, targeted, and marked read.
  9. Deadline reminder jobs are synchronized, idempotently scheduled, and atomically claimed.
  10. Closing or archiving a drive prevents invalid future applications.
  11. Real-time dashboard KPI metrics and export logs match authoritative PostgreSQL tables.
  12. Student credentials and profiles remain authentic and uncorrupted after placement reset dry-run.

---

## 3. Environment & Synthetic Data Management

| Environment Variable | Description | Test Configuration |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime execution mode | `test` / `development` |
| `SUPABASE_DATABASE_URL` | PostgreSQL connection string | Direct transaction pool connection |
| `JWT_SECRET` | Authentication signing secret | Dedicated test secret |
| `ALLOWED_ORIGIN` | CORS authorized origin | `http://localhost:5173` |
| `PORT` | Backend HTTP port | `5000` |
| `GROQ_API_KEY` | Primary LLM inference provider | Sandboxed / rate-limit resilient |
| `GEMINI_API_KEY` | Secondary LLM fallback provider | Sandboxed / deterministic fallback |

### Synthetic Fixture Lifecycle Policy
- All test runs create nonce-suffixed entities (e.g. `Apex Cloud Systems ${Date.now()}`).
- Teardown hooks clean up dependent tables in strict topological order:
  `reminder_jobs` $\rightarrow$ `export_logs` $\rightarrow$ `applications` $\rightarrow$ `placement_drives` $\rightarrow$ `companies` $\rightarrow$ `placement_sessions`.
- The primary demo student (`1RV22CS042` / `student@campusflow.edu`) and system admin (`admin@campusflow.edu`) are preserved across all test suites.

---

## 4. Test Execution Commands

```bash
# Backend compilation check
cd major-backend && npm run build

# Backend typecheck
cd major-backend && npm run typecheck

# Full backend automated regression suite (serial database isolation)
cd major-backend && npm test

# Individual mandatory placement scenarios suite
cd major-backend && node --test tests/comprehensivePlacementScenarios.test.js

# Frontend type safety verification
cd frontend && npm run typecheck

# Frontend production bundle compilation
cd frontend && npm run build
```
