-- CampusFlow V3 PostgreSQL Database Schema
-- Migration 005: Data Layer Stabilization, Integrity Constraints, Performance Indexes & RLS Hardening

-- 1. Unique Constraints & Case-Insensitive Normalization
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email 
ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_lower_usn 
ON student_profiles (LOWER(TRIM(usn))) 
WHERE usn IS NOT NULL AND usn != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_lower_enrollment 
ON student_profiles (LOWER(TRIM(enrollment_number)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_session 
ON placement_sessions (is_active) 
WHERE is_active = true;

-- 2. Student Profiles Data Integrity Check Constraints
ALTER TABLE student_profiles 
DROP CONSTRAINT IF EXISTS check_valid_cgpa;
ALTER TABLE student_profiles 
ADD CONSTRAINT check_valid_cgpa 
CHECK (cgpa IS NULL OR (cgpa >= 0.00 AND cgpa <= 10.00));

ALTER TABLE student_profiles 
DROP CONSTRAINT IF EXISTS check_valid_verified_cgpa;
ALTER TABLE student_profiles 
ADD CONSTRAINT check_valid_verified_cgpa 
CHECK (verified_cgpa IS NULL OR (verified_cgpa >= 0.00 AND verified_cgpa <= 10.00));

ALTER TABLE student_profiles 
DROP CONSTRAINT IF EXISTS check_non_negative_backlogs;
ALTER TABLE student_profiles 
ADD CONSTRAINT check_non_negative_backlogs 
CHECK (backlogs >= 0 AND active_backlogs >= 0);

ALTER TABLE student_profiles 
DROP CONSTRAINT IF EXISTS check_tenth_percentage;
ALTER TABLE student_profiles 
ADD CONSTRAINT check_tenth_percentage 
CHECK (tenth_percentage IS NULL OR (tenth_percentage >= 0.00 AND tenth_percentage <= 100.00));

ALTER TABLE student_profiles 
DROP CONSTRAINT IF EXISTS check_twelfth_percentage;
ALTER TABLE student_profiles 
ADD CONSTRAINT check_twelfth_percentage 
CHECK (twelfth_percentage IS NULL OR (twelfth_percentage >= 0.00 AND twelfth_percentage <= 100.00));

-- 3. Placement Sessions Constraints
ALTER TABLE placement_sessions 
DROP CONSTRAINT IF EXISTS check_session_year;
ALTER TABLE placement_sessions 
ADD CONSTRAINT check_session_year 
CHECK (session_year >= 2000 AND session_year <= 2100);

-- 4. Placement Drives Constraints
ALTER TABLE placement_drives 
DROP CONSTRAINT IF EXISTS check_drive_package;
ALTER TABLE placement_drives 
ADD CONSTRAINT check_drive_package 
CHECK (package >= 0);

ALTER TABLE placement_drives 
DROP CONSTRAINT IF EXISTS check_drive_min_cgpa;
ALTER TABLE placement_drives 
ADD CONSTRAINT check_drive_min_cgpa 
CHECK (minimum_cgpa >= 0.00 AND minimum_cgpa <= 10.00);

ALTER TABLE placement_drives 
DROP CONSTRAINT IF EXISTS check_drive_max_backlogs;
ALTER TABLE placement_drives 
ADD CONSTRAINT check_drive_max_backlogs 
CHECK (maximum_backlogs >= 0);

ALTER TABLE placement_drives 
DROP CONSTRAINT IF EXISTS check_drive_deadline_order;
ALTER TABLE placement_drives 
ADD CONSTRAINT check_drive_deadline_order 
CHECK (application_deadline >= application_start_date);

-- 5. Applications Constraints
ALTER TABLE applications 
DROP CONSTRAINT IF EXISTS check_offered_package;
ALTER TABLE applications 
ADD CONSTRAINT check_offered_package 
CHECK (offered_package IS NULL OR offered_package >= 0);

-- 6. High Performance Query Indexes
-- Composite index for fast notification lookups and unread badges
CREATE INDEX IF NOT EXISTS idx_notifs_user_unread 
ON notifications (user_id, is_read, created_at DESC);

-- Partial index for active pending reminder worker jobs
CREATE INDEX IF NOT EXISTS idx_reminders_pending_due 
ON reminder_jobs (scheduled_time) 
WHERE status = 'PENDING';

-- Composite index for placement drive eligibility scans
CREATE INDEX IF NOT EXISTS idx_students_eligibility 
ON student_profiles (graduation_year, cgpa, active_backlogs, is_profile_locked);

-- Index for departmental branch searches sorted by CGPA
CREATE INDEX IF NOT EXISTS idx_students_branch_cgpa 
ON student_profiles (branch, cgpa DESC);

-- Index for drive session lookups and deadlines
CREATE INDEX IF NOT EXISTS idx_drives_session_active 
ON placement_drives (placement_session_id, is_active, application_deadline);

-- Index for applicant status lookups per drive
CREATE INDEX IF NOT EXISTS idx_apps_drive_status 
ON applications (placement_drive_id, status);

-- 7. RLS Policy Hardening: Student Self-Update on Applications
-- Allows students to withdraw applications or accept/decline offers via authenticated Supabase client
DROP POLICY IF EXISTS apps_student_update_own ON applications;
CREATE POLICY apps_student_update_own ON applications 
FOR UPDATE 
USING (
    student_id IN (SELECT id FROM student_profiles WHERE user_id = auth.uid())
) 
WITH CHECK (
    student_id IN (SELECT id FROM student_profiles WHERE user_id = auth.uid())
    AND status IN ('withdrawn', 'offer_accepted', 'offer_declined')
);
