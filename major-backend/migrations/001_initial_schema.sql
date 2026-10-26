-- CampusFlow V3 PostgreSQL Database Schema
-- Migration 001: Initial Schema & Relational Tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    phone VARCHAR(30),
    avatar_url TEXT,
    avatar_public_id TEXT,
    is_email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    refresh_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ADMINS
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100) DEFAULT 'Training & Placement',
    is_placement_officer BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PLACEMENT SESSIONS
CREATE TABLE IF NOT EXISTS placement_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_year INT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    academic_year VARCHAR(50) DEFAULT '',
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT false,
    is_closed BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('UPCOMING', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ,
    admission_year_mapping JSONB DEFAULT '[]'::jsonb,
    target_placement_percentage NUMERIC(5,2) DEFAULT 90,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    course VARCHAR(50),
    program_level VARCHAR(50) CHECK (program_level IN ('Undergraduate', 'Postgraduate')),
    degree_type VARCHAR(50) CHECK (degree_type IN ('B.E.', 'MBA', 'MCA', 'M.Tech')),
    college VARCHAR(100) DEFAULT 'Engineering & Technology',
    is_active BOOLEAN DEFAULT true,
    description TEXT DEFAULT '',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. COMPANIES
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(150) NOT NULL UNIQUE,
    company_description TEXT DEFAULT '',
    company_website VARCHAR(255) DEFAULT '',
    company_logo_url TEXT DEFAULT '',
    company_logo_public_id TEXT DEFAULT '',
    industry VARCHAR(100) DEFAULT '',
    location VARCHAR(150) DEFAULT '',
    contact_email VARCHAR(255) DEFAULT '',
    contact_phone VARCHAR(50) DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. STUDENT PROFILES
CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    enrollment_number VARCHAR(50) NOT NULL UNIQUE,
    usn VARCHAR(50) UNIQUE,
    course VARCHAR(50),
    program_code VARCHAR(50),
    program_level VARCHAR(50),
    degree_type VARCHAR(50),
    branch VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    admission_year INT,
    graduation_year INT NOT NULL,
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 10),
    current_semester INT CHECK (current_semester BETWEEN 1 AND 10),
    section VARCHAR(10) DEFAULT 'A',
    placement_session_id UUID REFERENCES placement_sessions(id) ON DELETE SET NULL,
    gender VARCHAR(30) DEFAULT 'Prefer not to say',
    dob DATE,
    personal_email VARCHAR(255) DEFAULT '',
    college_email VARCHAR(255) DEFAULT '',
    alternate_phone VARCHAR(30) DEFAULT '',
    aadhar_number VARCHAR(30) DEFAULT '',
    family JSONB DEFAULT '{}'::jsonb,
    current_address JSONB DEFAULT '{}'::jsonb,
    permanent_address JSONB DEFAULT '{}'::jsonb,
    same_as_current BOOLEAN DEFAULT false,
    tenth_details JSONB DEFAULT '{}'::jsonb,
    twelfth_or_diploma_details JSONB DEFAULT '{}'::jsonb,
    tenth_percentage NUMERIC(5,2),
    twelfth_percentage NUMERIC(5,2),
    has_education_gap BOOLEAN DEFAULT false,
    education_gaps JSONB DEFAULT '[]'::jsonb,
    semester_results JSONB DEFAULT '[]'::jsonb,
    cgpa NUMERIC(4,2),
    verified_cgpa NUMERIC(4,2),
    backlogs INT DEFAULT 0,
    active_backlogs INT DEFAULT 0,
    historical_backlogs INT DEFAULT 0,
    cleared_backlogs_count INT DEFAULT 0,
    backlog_details JSONB DEFAULT '[]'::jsonb,
    skills TEXT[] DEFAULT '{}',
    certificates JSONB DEFAULT '[]'::jsonb,
    about TEXT DEFAULT '',
    resume_url TEXT DEFAULT '',
    resume_public_id TEXT DEFAULT '',
    verification_status VARCHAR(30) DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'REVERIFICATION_REQUESTED')),
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verification_remarks TEXT DEFAULT '',
    profile_completeness INT DEFAULT 30,
    is_placed BOOLEAN DEFAULT false,
    placed_company VARCHAR(150) DEFAULT '',
    placed_package NUMERIC(10,2),
    placed_at TIMESTAMPTZ,
    placed_job_title VARCHAR(150) DEFAULT '',
    is_profile_locked BOOLEAN DEFAULT false,
    profile_locked_at TIMESTAMPTZ,
    modification_requests JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PLACEMENT DRIVES
CREATE TABLE IF NOT EXISTS placement_drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    job_title VARCHAR(150) NOT NULL,
    job_description TEXT DEFAULT '',
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('full-time', 'internship', 'internship-to-full-time')),
    internship_type VARCHAR(50) DEFAULT 'not_applicable' CHECK (internship_type IN ('paid', 'unpaid', 'not_applicable')),
    stipend VARCHAR(100) DEFAULT '',
    internship_duration VARCHAR(100) DEFAULT '',
    jd_pdf_url TEXT DEFAULT '',
    jd_pdf_filename VARCHAR(255) DEFAULT '',
    package NUMERIC(10,2) NOT NULL DEFAULT 0,
    location VARCHAR(150) DEFAULT '',
    eligible_branches TEXT[] NOT NULL DEFAULT '{}',
    eligible_program_codes TEXT[] DEFAULT '{}',
    minimum_cgpa NUMERIC(4,2) NOT NULL DEFAULT 0,
    maximum_backlogs INT DEFAULT 0,
    maximum_historical_backlogs INT,
    graduation_year INT NOT NULL,
    placement_session_id UUID REFERENCES placement_sessions(id) ON DELETE SET NULL,
    check_cgpa BOOLEAN DEFAULT true,
    check_backlogs BOOLEAN DEFAULT true,
    check_tenth_marks BOOLEAN DEFAULT false,
    minimum_tenth_percentage NUMERIC(5,2) DEFAULT 0,
    check_twelfth_marks BOOLEAN DEFAULT false,
    minimum_twelfth_percentage NUMERIC(5,2) DEFAULT 0,
    check_education_gaps BOOLEAN DEFAULT false,
    allow_education_gaps BOOLEAN DEFAULT true,
    max_education_gap_years INT DEFAULT 0,
    custom_questions JSONB DEFAULT '[]'::jsonb,
    reminder_settings JSONB DEFAULT '{"remindersEnabled": true, "reminderOffsetsHours": [6], "channels": ["in_app", "email"]}'::jsonb,
    selection_rounds JSONB DEFAULT '[]'::jsonb,
    current_round_number INT DEFAULT 1,
    student_requirements JSONB DEFAULT '{}'::jsonb,
    application_start_date TIMESTAMPTZ NOT NULL,
    application_deadline TIMESTAMPTZ NOT NULL,
    drive_date TIMESTAMPTZ NOT NULL,
    venue VARCHAR(150) DEFAULT '',
    application_link TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. APPLICATIONS
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    placement_drive_id UUID NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'applied' CHECK (status IN (
        'applied', 'shortlisted', 'interview', 'selected', 'rejected', 'on_hold',
        'offer_received', 'offer_accepted', 'offer_declined', 'withdrawn'
    )),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    interview_date TIMESTAMPTZ,
    interview_round VARCHAR(100) DEFAULT '',
    interview_location VARCHAR(150) DEFAULT '',
    interview_rounds JSONB DEFAULT '[]'::jsonb,
    offered_package NUMERIC(10,2),
    offer_details JSONB DEFAULT '{}'::jsonb,
    remarks TEXT DEFAULT '',
    status_updated_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    archived_drive_snapshot JSONB DEFAULT '{}'::jsonb,
    eligibility_snapshot JSONB DEFAULT '{}'::jsonb,
    is_overridden BOOLEAN DEFAULT false,
    override_reason TEXT DEFAULT '',
    overridden_by UUID REFERENCES users(id) ON DELETE SET NULL,
    overridden_at TIMESTAMPTZ,
    status_history JSONB DEFAULT '[]'::jsonb,
    custom_answers JSONB DEFAULT '[]'::jsonb,
    submitted_snapshot JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_student_drive_application UNIQUE (student_id, placement_drive_id)
);

-- 9. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'status_update',
    status VARCHAR(50),
    company_name VARCHAR(150) DEFAULT '',
    job_title VARCHAR(150) DEFAULT '',
    remarks TEXT DEFAULT '',
    interview_date TIMESTAMPTZ,
    interview_round VARCHAR(100) DEFAULT '',
    interview_location VARCHAR(150) DEFAULT '',
    offered_package NUMERIC(10,2),
    is_read BOOLEAN DEFAULT false,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    broadcast_id VARCHAR(100) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. REMINDER JOBS
CREATE TABLE IF NOT EXISTS reminder_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id UUID NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    offset_hours INT NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    drive_deadline TIMESTAMPTZ NOT NULL,
    channels TEXT[] DEFAULT ARRAY['in_app', 'email'],
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    in_app_completed BOOLEAN DEFAULT false,
    email_completed BOOLEAN DEFAULT false,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    error_category TEXT DEFAULT '',
    delivery_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. SUPPORT CONVERSATIONS
CREATE TABLE IF NOT EXISTS support_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(120) NOT NULL,
    status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'answered', 'bot_answered', 'closed')),
    messages JSONB DEFAULT '[]'::jsonb,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    assigned_admin UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. IMPORT BATCHES
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id VARCHAR(100) NOT NULL UNIQUE,
    import_type VARCHAR(50) NOT NULL,
    placement_drive_id UUID REFERENCES placement_drives(id) ON DELETE SET NULL,
    round_number INT,
    placement_session_id UUID REFERENCES placement_sessions(id) ON DELETE SET NULL,
    original_filename VARCHAR(255) NOT NULL,
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'PREVIEWED' CHECK (status IN ('PREVIEWED', 'COMMITTED', 'FAILED', 'PARTIAL_COMMIT')),
    conflict_strategy VARCHAR(30) DEFAULT 'skip',
    total_rows INT DEFAULT 0,
    valid_rows INT DEFAULT 0,
    invalid_rows INT DEFAULT 0,
    conflict_rows INT DEFAULT 0,
    inserted_rows INT DEFAULT 0,
    updated_rows INT DEFAULT 0,
    skipped_rows INT DEFAULT 0,
    failed_rows INT DEFAULT 0,
    preview_results JSONB DEFAULT '[]'::jsonb,
    error_report JSONB DEFAULT '[]'::jsonb,
    summary TEXT DEFAULT '',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. EXPORT LOGS
CREATE TABLE IF NOT EXISTS export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placement_drive_id UUID NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
    exported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    export_format VARCHAR(20) DEFAULT 'csv',
    exported_fields TEXT[] DEFAULT '{}',
    applicant_count INT DEFAULT 0,
    status_filter VARCHAR(50) DEFAULT 'all',
    branch_filter VARCHAR(50) DEFAULT 'all',
    ip_address VARCHAR(50) DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. PASSWORD RESET CHALLENGES
CREATE TABLE IF NOT EXISTS password_reset_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    reset_token_hash VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    reset_token_expires_at TIMESTAMPTZ,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    resend_cooldown_until TIMESTAMPTZ DEFAULT now(),
    send_count INT DEFAULT 1,
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'CONSUMED', 'EXHAUSTED', 'SUPERSEDED')),
    verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
