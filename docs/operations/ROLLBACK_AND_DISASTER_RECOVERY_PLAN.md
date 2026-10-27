# CAMPUSFLOW — PRODUCTION ROLLBACK & DISASTER RECOVERY PLAN

## 1. Overview & Objectives

This document establishes operational procedures, disaster recovery protocols, and emergency rollback playbooks for **CampusFlow V3**. The target deployment architecture comprises:
- **Frontend**: Vercel Serverless / SPA edge hosting
- **Backend API**: Render Web Service (`campusflow-api-v3`) running Node.js / Express
- **Background Worker**: Render Worker (`campusflow-reminder-worker-v3`)
- **Database**: Supabase Managed PostgreSQL 15.8 (with Connection Pooler)
- **External Integrations**: Resend (Transactional Email), Groq & Gemini (AI Copilot), Cloudinary (Documents/Resumes)

---

## 2. Emergency Incident Classification

| Severity | Definition | Impact | Action Window | Notification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core database down, API 500 across all routes, auth failure | System unusable | Immediate (< 15 mins) | Engineering Lead, TPO Admin |
| **SEV-2 (Major)** | AI assistant down, reminder dispatch delayed, email delivery degraded | Core placement functions intact | < 1 hour | Backend On-Call Engineer |
| **SEV-3 (Minor)** | UI cosmetic defects, analytics card cache delay | Non-blocking | Standard release cycle | Frontend Maintainer |

---

## 3. Application Rollback Playbooks

### A. Frontend (Vercel) Rollback Procedure
Vercel maintains immutable deployment builds for every commit hash.
1. Navigate to the **Vercel Dashboard** $\rightarrow$ `campus-flow` project.
2. Under the **Deployments** tab, locate the last verified stable release (e.g., commit `89e0bbc`).
3. Click the three dots `...` next to the deployment and select **Instant Rollback**.
4. Verify edge propagation:
   ```bash
   curl -I https://campus-flow-smoky-ten.vercel.app
   ```
5. Confirm that `index.html` serves the prior JavaScript bundle hashes.

### B. Backend API (`campusflow-api-v3` on Render) Rollback
1. Open the **Render Dashboard** $\rightarrow$ `campusflow-api-v3`.
2. Under **Events / Deploys**, select the prior successful build.
3. Click **Rollback to this deploy**.
4. Monitor the health check until status `ok` returns:
   ```bash
   curl -f https://campusflow-api.onrender.com/api/v1/health
   # Expected response: {"version":"3.0.0","status":"ok","database":"connected",...}
   ```
5. If rollback is initiated via Git:
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```

### C. Dedicated Reminder Worker (`campusflow-reminder-worker-v3` on Render)
1. In the **Render Dashboard**, roll back the worker service to the matching commit hash.
2. The worker automatically terminates its active polling loop on `SIGTERM` and closes connection pool handles.
3. On reboot, the worker performs an automatic startup sweep to recover any jobs orphaned in `PROCESSING` state for $> 10$ minutes:
   ```sql
   UPDATE reminder_jobs
   SET status = 'PENDING', error_category = 'Worker timeout recovery - rescheduled to pending'
   WHERE status = 'PROCESSING' AND last_attempt_at < now() - INTERVAL '10 minutes';
   ```

---

## 4. Database Disaster Recovery & Rollback

### A. Managed PostgreSQL Point-in-Time Recovery (PITR)
Supabase provides automated continuous WAL logging and daily snapshots.
1. In the **Supabase Dashboard** $\rightarrow$ **Database** $\rightarrow$ **Backups**.
2. Select **Point-in-Time Recovery (PITR)**.
3. Select the timestamp immediately preceding the incident (e.g. 10 minutes prior to deployment).
4. Restore to a new project or current instance.
5. If restored to a new project instance, update the `SUPABASE_DATABASE_URL` environment variable across both Render services (`campusflow-api-v3` and `campusflow-reminder-worker-v3`).

### B. Reverting Faulty Migrations
All migrations are tracked in `_schema_migrations`. To revert an uncommitted or faulty migration script:
1. Connect via `psql` to the primary database connection string:
   ```bash
   psql "$SUPABASE_DATABASE_URL"
   ```
2. Inspect the latest applied migration:
   ```sql
   SELECT * FROM _schema_migrations ORDER BY id DESC LIMIT 5;
   ```
3. Execute the corresponding reverse SQL statements inside an explicit transaction:
   ```sql
   BEGIN;
   -- Example: Drop faulty constraint or column
   ALTER TABLE placement_drives DROP COLUMN IF EXISTS faulty_column;
   DELETE FROM _schema_migrations WHERE filename = '006_faulty_migration.sql';
   COMMIT;
   ```
4. Verify schema consistency using the automated test suite:
   ```bash
   npm test
   ```

### C. Restoring Placement State from Local/S3 Snapshots
Before any bulk data operation, `PlacementDataResetService` writes an immutable JSON snapshot with SHA-256 checksum in `major-backend/backups/`.
To restore placement data:
```bash
cd major-backend
tsx src/scripts/restorePlacementData.ts backups/placement_backup_<TIMESTAMP>.json
```

---

## 5. Security Compromise & Secret Rotation Protocol

If credentials (database password, JWT secret, Resend API key, or Supabase service role key) are compromised:

> [!CAUTION]
> Never rotate secrets blindly in a single step without coordinating dependent services. Abrupt secret rotation can cause immediate authentication failure across all active student and recruiter sessions.

### Coordinated 5-Step Secret Rotation:
1. **Database Password Rotation**:
   - In Supabase Dashboard, generate a new database password.
   - Immediately update `SUPABASE_DATABASE_URL` in Render service environment settings.
   - Trigger manual redeploy with cache clear on Render.
2. **JWT Secret Rotation**:
   - Set the new secret in `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`.
   - Invalidate all existing refresh tokens to force re-authentication:
     ```sql
     UPDATE users SET refresh_token = NULL;
     ```
3. **Resend / Email API Key Rotation**:
   - Generate a new restricted API key in the Resend dashboard.
   - Update `RESEND_API_KEY` on Render.
   - Send test verification email to confirm operational status.
4. **AI Provider Key Rotation**:
   - Rotate `GROQ_API_KEY` and `GEMINI_API_KEY` in respective developer consoles.
   - The backend copilot services automatically fall back to deterministic reporting if upstream keys fail during propagation.

---

## 6. Post-Rollback Verification Checklist

Following any rollback or recovery action, verify all critical checks:

- [ ] `/health` returns HTTP 200 with `database: "connected"`.
- [ ] Admin user (`admin@campusflow.edu`) can log in and view authoritative KPIs.
- [ ] Demo student (`1RV22CS042` / `student@campusflow.edu`) profile is complete and verified.
- [ ] Active placement session is visible and drives are accessible.
- [ ] Reminder worker logs indicate active polling loop (`WORKER Daemon polling loop initiated`).
- [ ] Student public signup and authentication flows reject role spoofing.
- [ ] Zero unhandled 500 errors in Render application logs.
