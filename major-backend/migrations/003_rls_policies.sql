-- CampusFlow V3 PostgreSQL Database Schema
-- Migration 003: Row Level Security (RLS) Policies

-- Enable Row Level Security on all core entities
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_challenges ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current auth.uid() is an Admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if the current auth.uid() is a Student
CREATE OR REPLACE FUNCTION is_student()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'student' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. USERS POLICIES
-- Service role bypass
CREATE POLICY service_role_all_users ON users FOR ALL USING (auth.role() = 'service_role');
-- Users can view their own record
CREATE POLICY users_view_own ON users FOR SELECT USING (id = auth.uid() OR is_admin());
-- Users can update their own profile (name, phone, avatar)
CREATE POLICY users_update_own ON users FOR UPDATE USING (id = auth.uid() OR is_admin());

-- 2. ADMINS POLICIES
CREATE POLICY service_role_all_admins ON admins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY admins_view_all ON admins FOR SELECT USING (is_admin());
CREATE POLICY admins_manage_all ON admins FOR ALL USING (is_admin());

-- 3. PLACEMENT SESSIONS POLICIES
CREATE POLICY service_role_all_sessions ON placement_sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY sessions_view_active ON placement_sessions FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY sessions_admin_manage ON placement_sessions FOR ALL USING (is_admin());

-- 4. DEPARTMENTS POLICIES
CREATE POLICY service_role_all_departments ON departments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY departments_view_active ON departments FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY departments_admin_manage ON departments FOR ALL USING (is_admin());

-- 5. COMPANIES POLICIES
CREATE POLICY service_role_all_companies ON companies FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY companies_view_active ON companies FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY companies_admin_manage ON companies FOR ALL USING (is_admin());

-- 6. STUDENT PROFILES POLICIES
CREATE POLICY service_role_all_students ON student_profiles FOR ALL USING (auth.role() = 'service_role');
-- Students can only view their own profile; admins can view all
CREATE POLICY student_view_own ON student_profiles FOR SELECT USING (user_id = auth.uid() OR is_admin());
-- Students can update their own profile ONLY if not locked; admins can update anytime
CREATE POLICY student_update_own ON student_profiles FOR UPDATE USING (
    (user_id = auth.uid() AND is_profile_locked = false) OR is_admin()
);
-- Profile creation during signup
CREATE POLICY student_insert_own ON student_profiles FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

-- 7. PLACEMENT DRIVES POLICIES
CREATE POLICY service_role_all_drives ON placement_drives FOR ALL USING (auth.role() = 'service_role');
-- Students can view active drives; admins can view all drives
CREATE POLICY drives_view_active ON placement_drives FOR SELECT USING (is_active = true OR is_admin());
-- Only admins can create, update, or archive drives
CREATE POLICY drives_admin_manage ON placement_drives FOR ALL USING (is_admin());

-- 8. APPLICATIONS POLICIES
CREATE POLICY service_role_all_apps ON applications FOR ALL USING (auth.role() = 'service_role');
-- Students can view only their own applications; admins can view all
CREATE POLICY apps_view_own ON applications FOR SELECT USING (
    student_id IN (SELECT id FROM student_profiles WHERE user_id = auth.uid()) OR is_admin()
);
-- Students can create an application for themselves
CREATE POLICY apps_insert_own ON applications FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM student_profiles WHERE user_id = auth.uid())
);
-- Only admins can update status or offer details; students can only withdraw
CREATE POLICY apps_manage_admin ON applications FOR ALL USING (is_admin());

-- 9. NOTIFICATIONS POLICIES
CREATE POLICY service_role_all_notifs ON notifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY notifs_view_own ON notifications FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY notifs_update_own ON notifications FOR UPDATE USING (user_id = auth.uid() OR is_admin());

-- 10. REMINDER JOBS POLICIES
CREATE POLICY service_role_all_reminders ON reminder_jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY reminders_admin_only ON reminder_jobs FOR ALL USING (is_admin());

-- 11. SUPPORT CONVERSATIONS POLICIES
CREATE POLICY service_role_all_support ON support_conversations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY support_view_own ON support_conversations FOR SELECT USING (student_id = auth.uid() OR is_admin());
CREATE POLICY support_insert_own ON support_conversations FOR INSERT WITH CHECK (student_id = auth.uid() OR is_admin());
CREATE POLICY support_update_own ON support_conversations FOR UPDATE USING (student_id = auth.uid() OR is_admin());

-- 12. IMPORT BATCHES & EXPORT LOGS POLICIES
CREATE POLICY service_role_all_imports ON import_batches FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY imports_admin_only ON import_batches FOR ALL USING (is_admin());

CREATE POLICY service_role_all_exports ON export_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY exports_admin_only ON export_logs FOR ALL USING (is_admin());

-- 13. PASSWORD RESET CHALLENGES POLICIES
CREATE POLICY service_role_all_resets ON password_reset_challenges FOR ALL USING (auth.role() = 'service_role');
