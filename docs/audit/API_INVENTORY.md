# CampusFlow — Phase 00: Comprehensive API Inventory

**Target Backend**: Express 4 + TypeScript (`major-backend/src/`)  
**Base URL**: `/api/v1`  
**Total Endpoints**: 64  
**Date of Audit**: 2026-10-27  

---

## 1. Global Middleware & Router Mounts

All routes are registered in `major-backend/src/app.ts`:

```typescript
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/student-profile", studentProfileRouter);
app.use("/api/v1/academic", academicRouter);
app.use("/api/v1/placement-session", placementSessionRouter);
app.use("/api/v1/placement-drive", placementDriveRouter);
app.use("/api/v1/application", applicationRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/excel", excelRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/support", supportRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/programs", programsRouter);
// Root health check:
app.get("/health", (req, res) => res.status(200).json({ status: "OK", timestamp: ... }));
```

---

## 2. Authentication Router (`/api/v1/auth`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/register` | None | `{ email, password, role, fullName }` | `201: { user, accessToken, refreshToken }` | Validates role `student` \| `admin`. Creates record in `users`. Passwords hashed with bcrypt (salt 10). |
| `POST` | `/login` | None | `{ email, password }` | `200: { user, accessToken, refreshToken }` | Sets `refreshToken` in `httpOnly` secure cookie. Verifies bcrypt hash. |
| `POST` | `/logout` | `verifyJWT` | Empty | `200: { message: "Logged out" }` | Clears refresh cookie and removes refresh token hash from database. |
| `POST` | `/refresh-token` | None | Cookie or `{ refreshToken }` | `200: { accessToken, refreshToken }` | Validates refresh token against secret and DB hash. Rotates tokens. |
| `GET` | `/me` | `verifyJWT` | None | `200: { user }` | Fetches active user identity from token claims. |
| `POST` | `/change-password` | `verifyJWT` | `{ currentPassword, newPassword }` | `200: { message: "Password updated" }` | Requires re-authentication before updating password hash. |
| `POST` | `/supabase-sync` | `verifyJWT` | `{ supabaseUid, email }` | `200: { synced: true }` | Synchronizes Supabase Auth UID with local `users.supabase_uid` column. |

---

## 3. Student Profile Router (`/api/v1/student-profile`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/me` | `verifyJWT`, `verifyStudent` | None | `200: { profile, academic }` | Returns authenticated student profile, academic record, and backlogs. |
| `PUT` | `/me` | `verifyJWT`, `verifyStudent` | `{ fullName, phone, dob, gender, address, ... }` | `200: { profile }` | Validates profile lock status (`is_locked`). Rejects edit if locked. |
| `POST` | `/resume` | `verifyJWT`, `verifyStudent`, `upload.single('resume')` | Multipart form (`resume` file) | `200: { resumeUrl }` | Validates PDF MIME type, max 5MB. Uploads to Supabase Storage bucket `resumes`. |
| `POST` | `/avatar` | `verifyJWT`, `verifyStudent`, `upload.single('avatar')` | Multipart form (`avatar` file) | `200: { avatarUrl }` | Validates image MIME types (JPEG, PNG, WEBP), max 2MB. Bucket `avatars`. |
| `GET` | `/:studentId` | `verifyJWT`, `verifyAdmin` | None | `200: { student }` | Admin view of individual student profile. |
| `PUT` | `/:studentId/lock` | `verifyJWT`, `verifyAdmin` | `{ isLocked: boolean }` | `200: { student }` | Allows TPO admins to freeze or unfreeze student records for drive integrity. |
| `POST` | `/backlog-record` | `verifyJWT` | `{ semester, subjectCode, subjectName, status }` | `201: { backlog }` | **DEFECT (P1)**: Missing `verifyStudent` middleware. Relies on `req.student?.id` which evaluates to undefined. |
| `DELETE` | `/backlog-record/:backlogId`| `verifyJWT` | None | `200: { message: "Deleted" }` | **DEFECT (P1)**: Missing `verifyStudent` middleware. Fails with 400. |

---

## 4. Academic Router (`/api/v1/academic`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/my-record` | `verifyJWT`, `verifyStudent` | None | `200: { academicRecord }` | Returns 10th, 12th, diploma, SGPA array, CGPA, and backlog count. |
| `PUT` | `/my-record` | `verifyJWT`, `verifyStudent` | `{ tenthPercentage, twelfthPercentage, sgpaList, ... }` | `200: { academicRecord }` | Validates ranges (0-100% and 0-10.0 CGPA). Rejects if profile is locked. |
| `GET` | `/student/:studentId`| `verifyJWT`, `verifyAdmin` | None | `200: { academicRecord }` | Admin lookup of student academic standing. |
| `PUT` | `/student/:studentId`| `verifyJWT`, `verifyAdmin` | `{ tenthPercentage, twelfthPercentage, ... }` | `200: { academicRecord }` | Admin direct override of academic records. |

---

## 5. Placement Session Router (`/api/v1/placement-session`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `verifyJWT` | None | `200: [ sessions ]` | Returns all academic placement sessions (e.g., 2023-2027). |
| `GET` | `/active` | `verifyJWT` | None | `200: { session }` | Returns the currently active placement cycle. |
| `POST` | `/` | `verifyJWT`, `verifyAdmin` | `{ academicYear, startDate, endDate, isActive }` | `201: { session }` | Enforces that only one session can have `is_active = true` at a time. |
| `PUT` | `/:id` | `verifyJWT`, `verifyAdmin` | `{ academicYear, startDate, endDate, isActive }` | `200: { session }` | Updates session dates or active state. |
| `DELETE`| `/:id` | `verifyJWT`, `verifyAdmin` | None | `200: { message: "Session deleted" }`| Cascades check; prevents deletion if active drives exist. |

---

## 6. Placement Drive Router (`/api/v1/placement-drive`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `verifyJWT` | Query: `?status=&search=&session=` | `200: [ drives ]` | Lists placement drives. Filters by active session. |
| `GET` | `/:id` | `verifyJWT` | None | `200: { drive, eligibility }` | Returns full drive details including round schedule and criteria. |
| `POST` | `/` | `verifyJWT`, `verifyAdmin` | `{ companyName, jobTitle, jobRole, packageLpa, eligibilityCriteria, ... }` | `201: { drive }` | Creates drive and inserts linked row in `eligibility_criteria`. |
| `PUT` | `/:id` | `verifyJWT`, `verifyAdmin` | `{ companyName, jobTitle, packageLpa, ... }` | `200: { drive }` | Updates placement drive. Prevents editing criteria after applications open. |
| `DELETE`| `/:id` | `verifyJWT`, `verifyAdmin` | None | `200: { message: "Drive deleted" }` | Soft-deletes or cancels drive. |
| `POST` | `/:id/publish` | `verifyJWT`, `verifyAdmin` | None | `200: { drive }` | Transitions drive from DRAFT to PUBLISHED; notifies eligible candidates. |
| `POST` | `/:id/preview-results` | `verifyJWT`, `verifyAdmin`, `upload.single('file')` | Multipart Excel file | `200: { preview }` | **DEFECT (P1)**: Stubbed response returning hardcoded `{ matchedCandidates: 0 }`. |
| `POST` | `/:id/enroll-eligible-students` | `verifyJWT`, `verifyAdmin` | None | `200: { enrolledCount }` | **DEFECT (P1)**: Stubbed response returning `{ enrolledCount: 0 }`. |

---

## 7. Application Router (`/api/v1/application`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/my-applications` | `verifyJWT`, `verifyStudent` | None | `200: [ applications ]` | Returns all drives applied to by the logged-in student. |
| `GET` | `/:id` | `verifyJWT` | None | `200: { application }` | **DEFECT (P0 IDOR)**: Any authenticated user can view any application without ownership check. |
| `POST` | `/apply` | `verifyJWT`, `verifyStudent` | `{ driveId }` | `201: { application }` | Validates eligibility (CGPA, backlogs, branch) before creating application. |
| `POST` | `/:id/withdraw` | `verifyJWT`, `verifyStudent` | `{ reason }` | `200: { application }` | Allows candidate to withdraw application before drive locking deadline. |
| `GET` | `/drive/:driveId` | `verifyJWT`, `verifyAdmin` | Query: `?status=&round=` | `200: [ applications ]` | Admin roster of all candidates for a specific company drive. |
| `PUT` | `/:id/status` | `verifyJWT`, `verifyAdmin` | `{ status, feedback, currentRound }` | `200: { application }` | Admin updates candidate progression (SHORTLISTED, REJECTED, OFFERED). |
| `POST` | `/:id/offer-response` | `verifyJWT`, `verifyStudent` | `{ response: 'ACCEPTED' \| 'DECLINED' }` | `200: { application }` | Candidate accepts or declines official placement offer. |

---

## 8. Notification Router (`/api/v1/notification`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `verifyJWT` | None | `200: [ notifications ]` | Returns notifications for the current authenticated user (`user_id = req.user.id`). |
| `PUT` | `/:id/read` | `verifyJWT` | None | `200: { success: true }` | Marks notification as read. Validates user ownership. |
| `PUT` | `/read-all` | `verifyJWT` | None | `200: { success: true }` | Marks all unread alerts for user as read. |
| `POST` | `/broadcast` | `verifyJWT`, `verifyAdmin` | `{ title, message, targetType, targetId }` | `201: { count }` | Broadcasts announcement to all students or specific department. |

---

## 9. Excel Migration Router (`/api/v1/excel`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/import-students` | `verifyJWT`, `verifyAdmin`, `upload.single('file')` | Multipart Excel file | `200: { successCount, errors, summary }` | Parses batch student records. Sanitizes CSV injection characters (`=`, `+`, `-`, `@`). |
| `GET` | `/export-students` | `verifyJWT`, `verifyAdmin` | Query: `?department=&minCgpa=` | Binary Excel stream | Streams styled Excel workbook of filtered student database. |
| `GET` | `/export-drive-applications/:driveId` | `verifyJWT`, `verifyAdmin` | None | Binary Excel stream | Generates company-ready applicant report with academics and resumes. |
| `GET` | `/template` | `verifyJWT`, `verifyAdmin` | None | Binary Excel stream | Provides blank template formatted with required columns and validation notes. |

---

## 10. Analytics Router (`/api/v1/analytics`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/overview` | `verifyJWT`, `verifyAdmin` | None | `200: { stats, trends, placementsByDept }` | High-level KPI aggregations: total drives, placement rate, average CTC. |
| `GET` | `/drive-stats/:driveId` | `verifyJWT`, `verifyAdmin` | None | `200: { totalApplied, shortlisted, offered }` | Funnel drop-off metrics per interview round. |
| `GET` | `/student-readiness` | `verifyJWT`, `verifyAdmin` | None | `200: { eligibleStudents, unplacedStudents }` | Identifies unplaced eligible candidates needing intervention. |

---

## 11. Support & Messaging Router (`/api/v1/support`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/conversations` | `verifyJWT` | `{ subject, category, initialMessage }` | `201: { conversation }` | Opens a support ticket between student and TPO cell. |
| `GET` | `/conversations` | `verifyJWT` | None | `200: [ conversations ]` | Lists user's tickets (or all tickets if user is admin). |
| `GET` | `/conversations/:conversationId` | `verifyJWT` | None | `200: { conversation, messages }` | **DEFECT (P0 IDOR)**: Does not verify that ticket belongs to `req.user.id`. |
| `POST` | `/conversations/:conversationId/messages`| `verifyJWT` | `{ content }` | `201: { message }` | **DEFECT (P0 IDOR)**: Allows unauthorized message posting into any ticket. |

---

## 12. AI Assistant Router (`/api/v1/ai`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/chat` | `verifyJWT` | `{ message, conversationContext }` | `200: { response }` | LLM-based placement assistant. Scoped with system prompt boundaries. |
| `POST` | `/analyze-resume` | `verifyJWT`, `verifyStudent` | None | `200: { suggestions, score, keywords }` | Parses candidate resume URL against target job roles. |

---

## 13. Academic Programs Router (`/api/v1/programs`)

| Method | Endpoint | Auth Guards | Request Payload | Response Contract | Status & Security Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `verifyJWT` | None | `200: [ programs ]` | Returns institutional degree catalog (e.g., B.Tech, M.Tech, MCA). |
| `GET` | `/departments` | `verifyJWT` | Query: `?programCode=` | `200: [ departments ]` | Returns departments (CSE, ISE, ECE, ME) with active student counts. |
