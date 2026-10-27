-- CampusFlow V3 PostgreSQL Database Schema
-- Migration 004: Seed Reference Data (Approved Departments, Program Catalog, Active Session & Demo Accounts)

-- 1. Seed Default Active Placement Session
INSERT INTO placement_sessions (
    id,
    session_year,
    name,
    academic_year,
    description,
    is_active,
    status,
    admission_year_mapping,
    target_placement_percentage
)
VALUES (
    '00000000-0000-0000-0000-000000002026',
    2026,
    '2025-2026',
    '2025-2026',
    'Placement Cohort for Graduating Class of 2026',
    true,
    'ACTIVE',
    '[
        {"course": "B.E.", "courseDurationYears": 4, "admissionYear": 2022},
        {"course": "MBA", "courseDurationYears": 2, "admissionYear": 2024},
        {"course": "MCA", "courseDurationYears": 2, "admissionYear": 2024},
        {"course": "M.Tech", "courseDurationYears": 2, "admissionYear": 2024}
    ]'::jsonb,
    95.0
)
ON CONFLICT (session_year) DO NOTHING;

-- 2. Seed the 13 Approved Academic Programs & Departments
INSERT INTO departments (name, code, course, program_level, degree_type, college, is_active, description)
VALUES
    ('Computer Science & Engineering (CSE)', 'CSE', 'B.E.', 'Undergraduate', 'B.E.', 'Engineering & Technology', true, 'Department of Computer Science and Engineering'),
    ('Computer Science & Engineering - Artificial Intelligence & Machine Learning (CSE - AI & ML)', 'CSE-AIML', 'B.E.', 'Undergraduate', 'B.E.', 'Engineering & Technology', true, 'Department of CSE (AI & ML)'),
    ('Information Science & Engineering (ISE)', 'ISE', 'B.E.', 'Undergraduate', 'B.E.', 'Engineering & Technology', true, 'Department of Information Science and Engineering'),
    ('Electronics & Communication Engineering (ECE)', 'ECE', 'B.E.', 'Undergraduate', 'B.E.', 'Engineering & Technology', true, 'Department of Electronics and Communication Engineering'),
    ('Electronics & Instrumentation Engineering (EIE)', 'EIE', 'B.E.', 'Undergraduate', 'B.E.', 'Engineering & Technology', true, 'Department of Electronics and Instrumentation Engineering'),
    ('Robotics & Automation (RA)', 'RA', 'B.E.', 'Undergraduate', 'B.E.', 'Engineering & Technology', true, 'Department of Robotics and Automation'),
    ('Civil Engineering', 'CIVIL', 'B.E.', 'Undergraduate', 'B.E.', 'Engineering & Technology', true, 'Department of Civil Engineering'),
    ('Mechanical Engineering', 'MECH', 'B.E.', 'Undergraduate', 'B.E.', 'Engineering & Technology', true, 'Department of Mechanical Engineering'),
    ('Master of Business Administration (MBA)', 'MBA', 'MBA', 'Postgraduate', 'MBA', 'Management Studies', true, 'Department of Management Studies (MBA)'),
    ('Master of Computer Applications (MCA)', 'MCA', 'MCA', 'Postgraduate', 'MCA', 'Computer Applications', true, 'Department of Computer Applications (MCA)'),
    ('M.Tech in Data Science', 'MTECH-DS', 'M.Tech', 'Postgraduate', 'M.Tech', 'Engineering & Technology', true, 'M.Tech Data Science Postgraduate Program'),
    ('M.Tech in VLSI Design & Embedded Systems', 'MTECH-VLSI', 'M.Tech', 'Postgraduate', 'M.Tech', 'Engineering & Technology', true, 'M.Tech VLSI & Embedded Systems Program'),
    ('M.Tech in Thermal Engineering', 'MTECH-THERMAL', 'M.Tech', 'Postgraduate', 'M.Tech', 'Engineering & Technology', true, 'M.Tech Thermal Engineering Program')
ON CONFLICT (code) DO NOTHING;

-- 3. Seed Demo Administrator Account (admin@campusflow.edu / Admin@12345)
INSERT INTO users (id, full_name, email, password_hash, role, phone, is_active)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'TPO Administrator',
    'admin@campusflow.edu',
    '$2b$10$aYattEKPDsPvvsWeg7AUYOPIVSY7.KOXAhBKj5DZY/9o8PqfT8Gfu',
    'admin',
    '+91 9876543210',
    true
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO admins (id, user_id, employee_id, designation, department, is_placement_officer)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'TPO-2026-001',
    'Head of Training & Placement',
    'Training & Placement Cell',
    true
)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Seed Demo Student Account (student@campusflow.edu / Student@12345)
INSERT INTO users (id, full_name, email, password_hash, role, phone, is_active)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Alex Sharma',
    'student@campusflow.edu',
    '$2b$10$MQMLcptc7sQfFaihm2szRO3ivaJDNXDlOfkbjgbA3qSRKxee3AEr6',
    'student',
    '+91 9123456789',
    true
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO student_profiles (
    id,
    user_id,
    enrollment_number,
    usn,
    course,
    program_code,
    degree_type,
    branch,
    department,
    admission_year,
    graduation_year,
    semester,
    current_semester,
    section,
    placement_session_id,
    cgpa,
    verified_cgpa,
    backlogs,
    active_backlogs,
    historical_backlogs,
    skills,
    resume_url,
    verification_status,
    profile_completeness,
    is_profile_locked,
    semester_results
)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'EN2022CSE042',
    '1RV22CS042',
    'B.E.',
    'CSE',
    'B.E.',
    'Computer Science & Engineering (CSE)',
    'Computer Science & Engineering (CSE)',
    2022,
    2026,
    7,
    7,
    'A',
    '00000000-0000-0000-0000-000000002026',
    8.75,
    8.75,
    0,
    0,
    0,
    ARRAY['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Python', 'Algorithms'],
    'https://example.com/demo_resume.pdf',
    'VERIFIED',
    100,
    false,
    '[
        {"semesterNumber": 1, "sgpa": 8.4, "creditsEarned": 20, "passed": true},
        {"semesterNumber": 2, "sgpa": 8.6, "creditsEarned": 20, "passed": true},
        {"semesterNumber": 3, "sgpa": 8.8, "creditsEarned": 22, "passed": true},
        {"semesterNumber": 4, "sgpa": 8.7, "creditsEarned": 22, "passed": true},
        {"semesterNumber": 5, "sgpa": 8.9, "creditsEarned": 24, "passed": true},
        {"semesterNumber": 6, "sgpa": 9.0, "creditsEarned": 24, "passed": true}
    ]'::jsonb
)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Seed Recruiting Companies & Featured Placement Drives
INSERT INTO companies (id, company_name, company_description, company_website, industry, location, is_active)
VALUES
    ('33333333-3333-3333-3333-333333333333', 'Google LLC', 'Global Technology Leader in Cloud, Search, and AI Infrastructure', 'https://careers.google.com', 'Information Technology', 'Bangalore, India', true),
    ('44444444-4444-4444-4444-444444444444', 'Microsoft Corporation', 'Leading global developer of software, cloud platforms, and enterprise solutions', 'https://careers.microsoft.com', 'Information Technology', 'Hyderabad, India', true),
    ('55555555-5555-5555-5555-555555555555', 'Amazon Web Services', 'Pioneer in cloud infrastructure, enterprise computing, and scalable software', 'https://amazon.jobs', 'Cloud Computing', 'Bangalore, India', true)
ON CONFLICT (company_name) DO NOTHING;

INSERT INTO placement_drives (
    id,
    company_id,
    job_title,
    job_description,
    job_type,
    package,
    location,
    eligible_branches,
    eligible_program_codes,
    minimum_cgpa,
    maximum_backlogs,
    graduation_year,
    application_start_date,
    application_deadline,
    drive_date,
    is_active,
    created_by
)
VALUES
    (
        '66666666-6666-6666-6666-666666666666',
        '33333333-3333-3333-3333-333333333333',
        'Software Development Engineer I',
        'Design, develop, test, deploy, and maintain large-scale software solutions for global users.',
        'full-time',
        24.50,
        'Bangalore, India',
        ARRAY['Computer Science & Engineering (CSE)', 'Information Science & Engineering (ISE)'],
        ARRAY['CSE', 'ISE'],
        7.50,
        0,
        2026,
        now(),
        now() + interval '14 days',
        now() + interval '21 days',
        true,
        '11111111-1111-1111-1111-111111111111'
    ),
    (
        '77777777-7777-7777-7777-777777777777',
        '44444444-4444-4444-4444-444444444444',
        'Cloud Solutions Engineer',
        'Build and scale enterprise cloud applications with high availability and security.',
        'full-time',
        20.00,
        'Hyderabad, India',
        ARRAY['Computer Science & Engineering (CSE)', 'Information Science & Engineering (ISE)', 'Electronics & Communication Engineering (ECE)'],
        ARRAY['CSE', 'ISE', 'ECE'],
        7.00,
        0,
        2026,
        now(),
        now() + interval '10 days',
        now() + interval '18 days',
        true,
        '11111111-1111-1111-1111-111111111111'
    )
ON CONFLICT (id) DO NOTHING;
