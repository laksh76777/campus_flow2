import bcrypt from "bcrypt";
import { query, withTransaction } from "../database/db.js";

export async function runFreshStart(): Promise<void> {
    console.log("==================================================");
    console.log("  CAMPUSFLOW V3 — FRESH START RESET EXECUTION");
    console.log("==================================================");

    await withTransaction(async (client) => {
        // 1. Purge all transactional and drive placement data
        console.log("1. Purging transactional tables...");
        await client.query("DELETE FROM reminder_jobs");
        await client.query("DELETE FROM applications");
        await client.query("DELETE FROM placement_drives");
        await client.query("DELETE FROM companies");
        await client.query("DELETE FROM notifications");
        await client.query("DELETE FROM support_conversations");
        await client.query("DELETE FROM import_batches");
        console.log("   - Cleared reminder_jobs, applications, placement_drives, companies, notifications, support_conversations, import_batches.");

        // 2. Remove extraneous non-demo accounts
        console.log("2. Cleaning non-essential user accounts...");
        await client.query(
            "DELETE FROM users WHERE email NOT IN ('admin@campusflow.edu', 'student@campusflow.edu')"
        );

        // 3. Ensure Default Placement Session exists
        console.log("3. Ensuring Active Placement Session (2025-2026)...");
        await client.query(`
            INSERT INTO placement_sessions (
                id, session_year, name, academic_year, description, is_active, status, target_placement_percentage
            )
            VALUES (
                '00000000-0000-0000-0000-000000002026',
                2026,
                '2025-2026',
                '2025-2026',
                'Placement Cohort for Graduating Class of 2026',
                true,
                'ACTIVE',
                95.0
            )
            ON CONFLICT (session_year) DO UPDATE SET is_active = true, status = 'ACTIVE'
        `);

        // 4. Ensure Admin Account (admin@campusflow.edu / Admin@12345)
        console.log("4. Upserting TPO Administrator account...");
        const adminHash = await bcrypt.hash("Admin@12345", 10);
        const adminRes = await client.query(
            `INSERT INTO users (id, full_name, email, password_hash, role, phone, is_active)
             VALUES (
                 '11111111-1111-1111-1111-111111111111',
                 'TPO Administrator',
                 'admin@campusflow.edu',
                 $1,
                 'admin',
                 '+91 9876543210',
                 true
             )
             ON CONFLICT (email) DO UPDATE
             SET password_hash = $1, full_name = 'TPO Administrator', role = 'admin', is_active = true
             RETURNING id`,
            [adminHash]
        );
        const adminId = adminRes.rows[0].id;

        await client.query(
            `INSERT INTO admins (id, user_id, employee_id, designation, department, is_placement_officer)
             VALUES (
                 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                 $1,
                 'TPO-2026-001',
                 'Head of Training & Placement',
                 'Training & Placement Cell',
                 true
             )
             ON CONFLICT (user_id) DO NOTHING`,
            [adminId]
        );

        // 5. Upsert Single Demo Student Account (student@campusflow.edu / Student@12345) with 100% complete details
        console.log("5. Upserting 100% Complete Demo Student (Alex Sharma)...");
        const studentHash = await bcrypt.hash("Student@12345", 10);
        const studentRes = await client.query(
            `INSERT INTO users (id, full_name, email, password_hash, role, phone, is_active)
             VALUES (
                 '22222222-2222-2222-2222-222222222222',
                 'Alex Sharma',
                 'student@campusflow.edu',
                 $1,
                 'student',
                 '+91 9123456789',
                 true
             )
             ON CONFLICT (email) DO UPDATE
             SET password_hash = $1, full_name = 'Alex Sharma', role = 'student', is_active = true
             RETURNING id`,
            [studentHash]
        );
        const studentUserId = studentRes.rows[0].id;

        const familyDetails = {
            fatherName: "Rajesh Sharma",
            fatherOccupation: "Senior Electrical Engineer",
            fatherPhone: "+91 9845012345",
            motherName: "Sunita Sharma",
            motherOccupation: "School Vice Principal",
            motherPhone: "+91 9845054321"
        };

        const currentAddress = {
            street: "42, 5th Cross, Indiranagar",
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560038"
        };

        const tenthDetails = {
            schoolName: "National Public School, Indiranagar",
            board: "CBSE",
            passingYear: 2020,
            percentage: 92.50,
            maxMarks: 500,
            marksObtained: 462.5
        };

        const twelfthDetails = {
            qualificationType: "Class 12",
            institutionName: "St. Joseph's Pre-University College",
            boardOrUniversity: "Karnataka State Pre-University Board",
            passingYear: 2022,
            percentage: 90.80,
            stream: "PCMB"
        };

        const semesterResults = [
            { semester: 1, sgpa: 8.50, credits: 20 },
            { semester: 2, sgpa: 8.70, credits: 20 },
            { semester: 3, sgpa: 8.90, credits: 22 },
            { semester: 4, sgpa: 8.80, credits: 22 },
            { semester: 5, sgpa: 9.05, credits: 24 },
            { semester: 6, sgpa: 9.15, credits: 24 }
        ];

        const skills = [
            "TypeScript", "React", "Node.js", "Express", "PostgreSQL",
            "Docker", "Python", "Data Structures & Algorithms", "Git", "REST APIs"
        ];

        const certificates = [
            {
                title: "AWS Certified Cloud Practitioner",
                issuer: "Amazon Web Services",
                issueDate: "2024-03-15",
                credentialUrl: "https://aws.amazon.com/verification",
                verificationStatus: "Verified"
            },
            {
                title: "Full-Stack Web Development Professional",
                issuer: "Meta / Coursera",
                issueDate: "2023-11-20",
                credentialUrl: "https://coursera.org/verify/meta-fullstack",
                verificationStatus: "Verified"
            }
        ];

        // Ensure student profile is 100% complete, verified, unplaced, with no active backlogs
        await client.query(
            `INSERT INTO student_profiles (
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
                gender,
                dob,
                personal_email,
                college_email,
                alternate_phone,
                aadhar_number,
                family,
                current_address,
                permanent_address,
                same_as_current,
                tenth_details,
                twelfth_or_diploma_details,
                tenth_percentage,
                twelfth_percentage,
                has_education_gap,
                education_gaps,
                semester_results,
                cgpa,
                verified_cgpa,
                backlogs,
                active_backlogs,
                historical_backlogs,
                cleared_backlogs_count,
                skills,
                certificates,
                about,
                resume_url,
                verification_status,
                profile_completeness,
                is_placed,
                placed_company,
                placed_package,
                placed_at,
                placed_job_title,
                is_profile_locked,
                modification_requests,
                placement_session_id
             )
             VALUES (
                'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                $1,
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
                'Male',
                '2004-05-15',
                'alex.sharma.personal@gmail.com',
                'student@campusflow.edu',
                '+91 9876501234',
                'XXXX-XXXX-8921',
                $2,
                $3,
                $3,
                true,
                $4,
                $5,
                92.50,
                90.80,
                false,
                '[]'::jsonb,
                $6,
                8.85,
                8.85,
                0,
                0,
                0,
                0,
                $7,
                $8,
                'Aspiring Software Engineer passionate about distributed cloud architecture, full-stack web applications, and resilient database engineering.',
                'https://example.com/resumes/alex_sharma_cse.pdf',
                'VERIFIED',
                100,
                false,
                null,
                null,
                null,
                null,
                false,
                '[]'::jsonb,
                '00000000-0000-0000-0000-000000002026'
             )
             ON CONFLICT (user_id) DO UPDATE SET
                enrollment_number = 'EN2022CSE042',
                usn = '1RV22CS042',
                branch = 'Computer Science & Engineering (CSE)',
                department = 'Computer Science & Engineering (CSE)',
                graduation_year = 2026,
                current_semester = 7,
                semester = 7,
                gender = 'Male',
                dob = '2004-05-15',
                personal_email = 'alex.sharma.personal@gmail.com',
                college_email = 'student@campusflow.edu',
                alternate_phone = '+91 9876501234',
                aadhar_number = 'XXXX-XXXX-8921',
                family = $2,
                current_address = $3,
                permanent_address = $3,
                same_as_current = true,
                tenth_details = $4,
                twelfth_or_diploma_details = $5,
                tenth_percentage = 92.50,
                twelfth_percentage = 90.80,
                has_education_gap = false,
                education_gaps = '[]'::jsonb,
                semester_results = $6,
                cgpa = 8.85,
                verified_cgpa = 8.85,
                backlogs = 0,
                active_backlogs = 0,
                historical_backlogs = 0,
                cleared_backlogs_count = 0,
                skills = $7,
                certificates = $8,
                about = 'Aspiring Software Engineer passionate about distributed cloud architecture, full-stack web applications, and resilient database engineering.',
                resume_url = 'https://example.com/resumes/alex_sharma_cse.pdf',
                verification_status = 'VERIFIED',
                profile_completeness = 100,
                is_placed = false,
                placed_company = null,
                placed_package = null,
                placed_at = null,
                placed_job_title = null,
                is_profile_locked = false,
                modification_requests = '[]'::jsonb,
                placement_session_id = '00000000-0000-0000-0000-000000002026'`,
            [
                studentUserId,
                JSON.stringify(familyDetails),
                JSON.stringify(currentAddress),
                JSON.stringify(tenthDetails),
                JSON.stringify(twelfthDetails),
                JSON.stringify(semesterResults),
                skills,
                JSON.stringify(certificates)
            ]
        );
        console.log("   - Alex Sharma profile reset: 100% complete, VERIFIED, CGPA 8.85, unplaced.");
    });

    console.log("==================================================");
    console.log("  FRESH START RESET COMPLETED SUCCESSFULLY!");
    console.log("  Accounts:");
    console.log("   - Admin:   admin@campusflow.edu   / Admin@12345");
    console.log("   - Student: student@campusflow.edu / Student@12345 (USN: 1RV22CS042)");
    console.log("  Drives: 0 (clean state)");
    console.log("  Companies: 0 (clean state)");
    console.log("  Applications: 0 (clean state)");
    console.log("  Placed Students: 0 (clean state)");
    console.log("==================================================");
}

// Run immediately if executed via CLI
runFreshStart()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Fresh start failed:", err);
        process.exit(1);
    });
