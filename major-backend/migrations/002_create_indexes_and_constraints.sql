-- CampusFlow V3 PostgreSQL Database Schema
-- Migration 002: Indexes, Performance Optimizations & Automated Updated_At Triggers

-- Indexes on Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Indexes on Admins
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_employee_id ON admins(employee_id);

-- Indexes on Placement Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_session_year ON placement_sessions(session_year);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON placement_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON placement_sessions(status);

-- Indexes on Departments
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);

-- Indexes on Companies
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);

-- Indexes on Student Profiles
CREATE INDEX IF NOT EXISTS idx_students_user_id ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON student_profiles(enrollment_number);
CREATE INDEX IF NOT EXISTS idx_students_usn ON student_profiles(usn);
CREATE INDEX IF NOT EXISTS idx_students_program_code ON student_profiles(program_code);
CREATE INDEX IF NOT EXISTS idx_students_branch ON student_profiles(branch);
CREATE INDEX IF NOT EXISTS idx_students_grad_year ON student_profiles(graduation_year);
CREATE INDEX IF NOT EXISTS idx_students_session_id ON student_profiles(placement_session_id);
CREATE INDEX IF NOT EXISTS idx_students_verif_status ON student_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_students_is_placed ON student_profiles(is_placed);

-- Indexes on Placement Drives
CREATE INDEX IF NOT EXISTS idx_drives_company_id ON placement_drives(company_id);
CREATE INDEX IF NOT EXISTS idx_drives_grad_year ON placement_drives(graduation_year);
CREATE INDEX IF NOT EXISTS idx_drives_session_id ON placement_drives(placement_session_id);
CREATE INDEX IF NOT EXISTS idx_drives_deadline ON placement_drives(application_deadline);
CREATE INDEX IF NOT EXISTS idx_drives_is_active ON placement_drives(is_active);
CREATE INDEX IF NOT EXISTS idx_drives_created_by ON placement_drives(created_by);

-- Indexes on Applications
CREATE INDEX IF NOT EXISTS idx_apps_student_id ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_apps_drive_id ON applications(placement_drive_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_apps_applied_at ON applications(applied_at);
CREATE INDEX IF NOT EXISTS idx_apps_is_archived ON applications(is_archived);

-- Indexes on Notifications
CREATE INDEX IF NOT EXISTS idx_notifs_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifs_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_broadcast_id ON notifications(broadcast_id);

-- Indexes on Reminder Jobs
CREATE INDEX IF NOT EXISTS idx_reminders_status_time ON reminder_jobs(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_reminders_drive_id ON reminder_jobs(drive_id);
CREATE INDEX IF NOT EXISTS idx_reminders_idempotency ON reminder_jobs(idempotency_key);

-- Indexes on Support Conversations
CREATE INDEX IF NOT EXISTS idx_support_student_id ON support_conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_last_msg ON support_conversations(last_message_at DESC);

-- Indexes on Import Batches & Export Logs
CREATE INDEX IF NOT EXISTS idx_import_batch_id ON import_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_type ON import_batches(import_type);
CREATE INDEX IF NOT EXISTS idx_import_drive_id ON import_batches(placement_drive_id);
CREATE INDEX IF NOT EXISTS idx_export_drive_id ON export_logs(placement_drive_id);

-- Indexes on Password Reset Challenges
CREATE INDEX IF NOT EXISTS idx_pw_reset_email ON password_reset_challenges(email);
CREATE INDEX IF NOT EXISTS idx_pw_reset_status ON password_reset_challenges(status);
CREATE INDEX IF NOT EXISTS idx_pw_reset_token ON password_reset_challenges(reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_pw_reset_expires ON password_reset_challenges(expires_at);

-- Trigger for updated_at automation
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'users', 'admins', 'placement_sessions', 'departments', 'companies',
        'student_profiles', 'placement_drives', 'applications', 'notifications',
        'reminder_jobs', 'support_conversations', 'import_batches', 'password_reset_challenges'
    ]
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_set_updated_at_%1$s ON %1$s;
            CREATE TRIGGER trigger_set_updated_at_%1$s
            BEFORE UPDATE ON %1$s
            FOR EACH ROW
            EXECUTE FUNCTION set_updated_at_timestamp();
        ', tbl);
    END LOOP;
END;
$$;
